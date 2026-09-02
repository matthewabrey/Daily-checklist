"""Idempotent, non-destructive sync helpers for staff / assets / checklist templates.

Records are upserted by their natural key; anything missing from the incoming source is
soft-deleted (staff -> active=False, assets -> retired=True) so nothing is ever hard-deleted
by a scheduled job or an admin upload. Admin account 4444 is never touched.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List

from pymongo import InsertOne, UpdateMany

logger = logging.getLogger(__name__)

ADMIN_EMPLOYEE_NUMBER = "4444"


def _bulk_counts(res) -> tuple:
    return (res.inserted_count if res else 0, res.modified_count if res else 0)


async def upsert_staff(db, staff_data: List[Dict]) -> Dict:
    """Upsert staff by employee_number; staff not in the source are marked inactive.

    Existing keys are updated with UpdateMany so any legacy duplicate copies stay in step.
    """
    incoming = {s["employee_number"] for s in staff_data}
    existing = set(await db.staff.distinct("employee_number", {"employee_number": {"$in": list(incoming)}}))
    ops = []
    for s in staff_data:
        if s["employee_number"] == ADMIN_EMPLOYEE_NUMBER:
            continue
        fields = {
            "name": s["name"],
            "active": True,
            "workshop_control": s.get("workshop_control"),
            "admin_control": s.get("admin_control"),
            "manager_control": s.get("manager_control"),
        }
        if s["employee_number"] in existing:
            ops.append(UpdateMany({"employee_number": s["employee_number"]}, {"$set": fields}))
        else:
            existing.add(s["employee_number"])
            ops.append(InsertOne({"id": str(uuid.uuid4()), "employee_number": s["employee_number"], **fields}))
    added, modified = _bulk_counts(await db.staff.bulk_write(ops, ordered=False) if ops else None)
    deactivated = await db.staff.update_many(
        {"employee_number": {"$nin": list(incoming) + [ADMIN_EMPLOYEE_NUMBER]}, "active": {"$ne": False}},
        {"$set": {"active": False}},
    )
    logger.info(f"Staff sync: {added} added, {modified} updated, {deactivated.modified_count} deactivated")
    return {"added": added, "updated": modified, "deactivated": deactivated.modified_count}


async def upsert_assets(db, assets: List[Dict]) -> Dict:
    """Upsert assets by make+name (keeps id and QR print status); assets not in the source are marked retired."""
    existing_docs = await db.assets.find({}, {"_id": 0, "make": 1, "name": 1, "retired": 1}).to_list(length=20000)
    existing_keys = {(e.get("make"), e.get("name")) for e in existing_docs}
    ops = []
    incoming_keys = set()
    for a in assets:
        key = (a["make"], a["name"])
        if key in incoming_keys:
            continue
        incoming_keys.add(key)
        if key in existing_keys:
            ops.append(UpdateMany({"make": a["make"], "name": a["name"]}, {"$set": {"check_type": a["check_type"], "retired": False}}))
        else:
            ops.append(InsertOne({"id": str(uuid.uuid4()), "make": a["make"], "name": a["name"], "check_type": a["check_type"],
                                  "qr_printed": False, "qr_printed_at": None, "retired": False}))
    added, modified = _bulk_counts(await db.assets.bulk_write(ops, ordered=False) if ops else None)

    missing = [{"make": e.get("make"), "name": e.get("name")} for e in existing_docs
               if not e.get("retired") and (e.get("make"), e.get("name")) not in incoming_keys]
    retired = 0
    if missing:
        res = await db.assets.update_many({"$or": missing}, {"$set": {"retired": True}})
        retired = res.modified_count
    logger.info(f"Asset sync: {added} added, {modified} updated, {retired} retired")
    return {"added": added, "updated": modified, "retired": retired}


async def dedupe_collection(collection, key_fields: List[str]) -> int:
    """Remove duplicate copies sharing the same key, keeping the record with the most populated fields."""
    pipeline = [
        {"$group": {"_id": {k: f"${k}" for k in key_fields}, "docs": {"$push": "$$ROOT"}, "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}},
    ]
    drop_ids = []
    async for group in collection.aggregate(pipeline):
        docs = group["docs"]
        keeper = max(docs, key=lambda d: (bool(d.get("qr_printed")), d.get("active") is not False, sum(1 for v in d.values() if v not in (None, "", False))))
        drop_ids += [d["_id"] for d in docs if d["_id"] != keeper["_id"]]
    if drop_ids:
        await collection.delete_many({"_id": {"$in": drop_ids}})
    return len(drop_ids)


async def upsert_checklist_templates(db, templates: List[Dict]) -> int:
    """Replace each template by check_type (upsert); templates for other check types are left alone."""
    now = datetime.now(timezone.utc).isoformat()
    for t in templates:
        t["updated_at"] = now
        await db.checklist_templates.replace_one({"check_type": t["check_type"]}, t, upsert=True)
    logger.info(f"Checklist templates sync: {len(templates)} templates upserted")
    return len(templates)
