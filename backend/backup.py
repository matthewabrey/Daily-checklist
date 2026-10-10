"""Nightly database backup.

Everything the app has ever recorded lives in one MongoDB instance on
Railway: 10,409 checks, the repairs, the telematics days, the timesheets and
the payroll. There was no copy of it anywhere. Lose that volume and it is
gone — the old Emergent host holding pre-migration data is luck, not a
backup.

So: every collection is written out as JSON, zipped, and pushed into
SharePoint beside the other files, where Microsoft backs it up in turn.
It can also be downloaded on demand.

**Photos are excluded by default and for a reason.** They are stored as
base64 strings inside each checklist, and a single check can carry 10MB+ of
them. A backup that tried to include them every night would be enormous,
slow, and would probably start failing silently — which is worse than not
having one. Photos are backed up separately and less often, deliberately.
"""

import io
import json
import logging
import zipfile
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Everything worth keeping. Anything not listed here is either rebuilt from
# SharePoint every hour or is a cache.
COLLECTIONS = [
    "checklists",          # the big one
    "staff",
    "assets",
    "repair_status",
    "repairs",
    "checklist_templates",
    "service_check_templates",
    "training_records",
    "workplan",
    "news_banner",
    "job_lists",
    "tractor_utilisation",
    "machine_days",        # telematics
    "machine_links",
    "telematics_files",
    "timesheet_days",      # Go2Clock
    "timesheet_weeks",
    "timesheet_links",
    "payroll_people",      # wages
    "payroll_periods",
    "passkeys",
    "birthday_seen",       # who has already had their celebration page
    "sync_logs",
]

# Fields that hold base64 photo data
PHOTO_FIELDS = ("photos", "photo", "images")

BACKUP_FOLDER = "General/Apps/Checklist App/Backups"


def _strip_photos(doc):
    """Replace photo payloads with a count, so the shape survives but the
    weight does not."""
    if isinstance(doc, dict):
        out = {}
        for k, v in doc.items():
            if k in PHOTO_FIELDS and isinstance(v, list):
                out[k] = []
                out[k + "_count_at_backup"] = len(v)
            else:
                out[k] = _strip_photos(v)
        return out
    if isinstance(doc, list):
        return [_strip_photos(x) for x in doc]
    return doc


async def build_zip(db, include_photos: bool = False, version: str = ""):
    """-> (bytes, manifest). One JSON file per collection inside a zip."""
    started = datetime.now(timezone.utc)
    manifest = {
        "taken_at": started.isoformat(),
        "app_version": version,
        "include_photos": include_photos,
        "collections": {},
        "notes": [],
    }
    if not include_photos:
        manifest["notes"].append(
            "Photos are NOT in this backup. They are base64 inside each "
            "checklist and would make the file enormous. Each document keeps "
            "a photos_count_at_backup so you can see what was there.")

    buf = io.BytesIO()
    existing = set(await db.list_collection_names())

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for name in COLLECTIONS:
            if name not in existing:
                manifest["collections"][name] = {"documents": 0, "present": False}
                continue
            docs = []
            async for d in db[name].find({}, {"_id": 0}):
                docs.append(d if include_photos else _strip_photos(d))
            text = json.dumps(docs, ensure_ascii=False, default=str, indent=1)
            z.writestr(f"{name}.json", text)
            manifest["collections"][name] = {
                "documents": len(docs),
                "present": True,
                "json_bytes": len(text.encode("utf-8")),
            }

        # anything in the database we forgot to list — better to know
        extra = sorted(existing - set(COLLECTIONS))
        if extra:
            manifest["notes"].append(
                "These collections exist in the database but are NOT in the "
                "backup list, so they were skipped: " + ", ".join(extra))

        manifest["total_documents"] = sum(
            c.get("documents", 0) for c in manifest["collections"].values())
        z.writestr("manifest.json", json.dumps(manifest, indent=2, default=str))

    data = buf.getvalue()
    manifest["zip_bytes"] = len(data)
    manifest["took_seconds"] = round(
        (datetime.now(timezone.utc) - started).total_seconds(), 1)
    return data, manifest


def filename(when=None, include_photos=False):
    when = when or datetime.now(timezone.utc)
    tag = "-with-photos" if include_photos else ""
    return f"abreys-backup-{when.strftime('%Y-%m-%d-%H%M')}{tag}.zip"
