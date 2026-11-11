"""Workshop: pre-service check review -> job card -> parts -> signed service sheet (v7.5)

Flow
  1. Pre-service checks (check_type "pre_service_check") come in from the existing form.
  2. An engineer reviews a machine: Fix now / Monitor / No action per problem, a comment
     per problem, and parts against each problem. Saved as a draft until he presses Reviewed.
  3. Reviewed creates the job card (JC-0001...) and the parts go onto Parts to order.
  4. A mechanic takes the job (My jobs, or by scanning the machine's QR), ticks off the work,
     signs, and the sheet locks. A workshop_service record is written to db.checklists so it
     shows up in Service History and the servicing exports like any other service.

Machines are grouped by the AssetList check type (e.g. "Irrigator"). Each group has
service ROUNDS (e.g. "Irrigators winter 2026/27"): the board only shows checks done since
the current round started. With no round yet, the last 12 months are used.

Collections: service_jobs, service_rounds, counters (job numbers).
"""
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/workshop")
_db = None

PART_STATUSES = ["To order", "Ordered", "Arrived", "In stock", "Fitted"]
PARTS_IN = {"In stock", "Fitted"}
DECISIONS = {"fix", "monitor", "none"}

# Same fault across many machines: keyword groups for the fleet summary.
# A problem can sit in more than one group ("rear wheel punctured / bearing").
TAGS = [
    ("serial", "Serial number missing / unreadable", None, r"serial"),
    ("pto", "PTO guard missing / damaged", "PTO guard", r"pto\s*guard|pto"),
    ("chain", "Chain guards missing / damaged", "Chain guard", r"chain\s*guard|chain pipe guide|guard rail"),
    ("guard", "Other guards", "Guard", r"guard"),
    ("batt", "Battery box, bracket & wiring", "Battery bracket", r"batter"),
    ("bear", "Bearings", "Bearing", r"bearing"),
    ("leak", "Leaks, hoses & flexi pipe", "Hose / seals", r"leak|hose|flexi|hole in pipe|thin pipe|pipe blows|seal"),
    ("axle", "Axles & axle bolts to check", None, r"axle"),
    ("stop", "Stop / shut-down not working", "Stop mechanism parts", r"shut ?down|stop bar|stop moves|stop coming|stops but|come in straight|gun stop"),
    ("drum", "Drum wrap, chain & panels", "Drum panel / chain", r"\brap\b|wrap|panels? missing|loose chain"),
    ("turn", "Turn motor", "Turn motor", r"turn motor"),
    ("hyd", "Hydraulic pipes & levers", "Hydraulic pipe / lever", r"hydraulic (pipe|lever)|levers"),
    ("wheel", "Wheels, tyres & weights", "Tyre / wheel", r"tyre|tire|punctur|wheel weight|wheels? weight|odd wheels|needs wheel"),
    ("frame", "Frame, pins & brackets", "Pins / bracket", r"\bpins?\b|frame|bracket"),
    ("elec", "Wiring, lights & electrics", "Electrical parts", r"wiring|light|electr|computer"),
    ("rd", "Raindancer not working", None, r"raindancer not working"),
]
TAG_LABEL = {k: lab for k, lab, _, _ in TAGS}
TAG_PART = {k: p for k, _, p, _ in TAGS}


def init(db):
    global _db
    _db = db


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def pretty(name: str) -> str:
    """'HaydenBennett' -> 'Hayden Bennett' (Name List runs first and last together)."""
    name = (name or "").strip()
    if " " in name:
        return name
    return re.sub(r"(?<=[a-z])(?=[A-Z])", " ", name)


def tags_for(section: str, text: str) -> List[str]:
    """Grouped on what was WRITTEN, not the section heading ("Drum and Bearings: chain guard
    missing" is a guard, not a bearing). Serial numbers are an admin job of their own."""
    t = (text or "").lower()
    if "serial" in (section or "").lower() or "serial" in t or (
            "raindancer" in (section or "").lower() and re.search(r"\bno number|unreadable|not readable", t)):
        return ["serial"]
    out = []
    for key, _, _, rx in TAGS:
        if key == "serial":
            continue
        if key == "guard" and ("pto" in out or "chain" in out):
            continue
        if key in ("elec", "frame") and "batt" in out:
            continue
        if re.search(rx, t):
            out.append(key)
    return out or ["other"]


# ---------------------------------------------------------------- people
async def who(employee_number: str, need_workshop=True) -> dict:
    s = await _db.staff.find_one({"employee_number": str(employee_number or "").strip()}, {"_id": 0})
    if not s or s.get("active") is False:
        raise HTTPException(401, "Not signed in")
    ok = (s.get("workshop_control") or "").lower() == "yes" or (s.get("admin_control") or "").lower() == "yes"
    if need_workshop and not ok:
        raise HTTPException(403, "Workshop access is needed for this. Set Workshop Control = yes in the Name List.")
    return {"name": pretty(s.get("name")), "employee_number": s.get("employee_number")}


# ---------------------------------------------------------------- machines
async def active_assets():
    return await _db.assets.find({"retired": {"$ne": True}}, {"_id": 0}).to_list(length=20000)


def group_key(asset: dict) -> str:
    return (asset.get("check_type") or asset.get("make") or "Other").strip()


def _tok(s):
    return [t for t in re.split(r"[\s/,\-]+", (s or "").lower()) if t]


def match_asset(make: str, model: str, assets_by_make: Dict[str, list], common=frozenset()):
    """Tie a check to an asset. Exact name first; then the machine number / serial tokens,
    because older checks were recorded as 'Machine 32' and some as 'A F Machinery 37 15HR082 510'."""
    cands = assets_by_make.get((make or "").strip().lower(), [])
    model_l = (model or "").strip().lower()
    for a in cands:
        if a["name"].strip().lower() == model_l:
            return a
    mt = _tok(model)
    # "510" / "450" are reel sizes shared by dozens of machines — useless for telling them apart
    ident = [t for t in mt if re.search(r"\d", t) and t not in common]
    if not ident:
        return None
    best, best_score, tie = None, 0, False
    for a in cands:
        at = _tok(a["name"])
        shared = [t for t in ident if t in at]
        if not shared:
            continue
        score = len(shared) + (3 if at and at[0] in ident else 0)
        # a long serial-like token is very specific
        score += sum(2 for t in shared if len(t) >= 4)
        if score > best_score:
            best, best_score, tie = a, score, False
        elif score == best_score:
            tie = True
    return None if tie else best


async def current_round(gkey: str) -> dict:
    r = await _db.service_rounds.find({"group_key": gkey}, {"_id": 0}).sort("started_at", -1).to_list(length=1)
    if r:
        return r[0]
    since = (datetime.now(timezone.utc) - timedelta(days=365)).isoformat()
    return {"id": f"default:{gkey}", "group_key": gkey, "name": "Last 12 months", "started_at": since, "default": True}


async def checks_for_group(gkey: str, assets: list, since: str):
    """Pre-service checks since `since`, tied to assets in this group -> {asset_id: [checks]}"""
    makes = list({a.get("make") for a in assets if a.get("make")})
    # Match against EVERY machine of these makes, then keep the ones asked for — matching
    # against a single machine would hand it every check that shares any number with it.
    all_of_make = await _db.assets.find({"retired": {"$ne": True}, "make": {"$in": makes}}, {"_id": 0}).to_list(length=20000)
    by_make = {}
    tokcount = {}
    for a in all_of_make:
        by_make.setdefault((a.get("make") or "").strip().lower(), []).append(a)
        for t in set(_tok(a["name"])):
            tokcount[t] = tokcount.get(t, 0) + 1
    common = frozenset(t for t, n in tokcount.items() if n > 3)
    wanted = {a["id"] for a in assets}
    # completed_at is an ISO STRING on almost every record (a BSON string never compares to a
    # date), with the odd real datetime — so match both.
    since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
    q = {"check_type": "pre_service_check", "machine_make": {"$in": makes},
         "$or": [{"completed_at": {"$gte": since}}, {"completed_at": {"$gte": since_dt}}]}
    proj = {"_id": 0, "checklist_items.photos.data": 0, "workshop_photos.data": 0}
    recs = await _db.checklists.find(q, proj).sort("completed_at", 1).to_list(length=5000)
    out = {}
    for r in recs:
        a = match_asset(r.get("machine_make"), r.get("machine_model"), by_make, common)
        if a and a["id"] in wanted:
            out.setdefault(a["id"], []).append(r)
    return out


def findings_from_checks(checks: list) -> List[dict]:
    """Every problem worth looking at. Includes items ticked OK with a fault written beside them
    (12 of those on the first Perrot round) and the 'other issues' notes."""
    seen = {}
    for c in checks:
        cid = c.get("id")
        by = pretty(c.get("staff_name"))
        at = str(c.get("completed_at") or "")[:10]
        for i, it in enumerate(c.get("checklist_items") or []):
            sec = (it.get("item") or "").strip()
            note = (it.get("notes") or "").strip()
            st = it.get("status")
            if "serial" in sec.lower():
                if not (st == "unsatisfactory" or re.search(r"\b(no|not|unread|unable|missing)", note, re.I)):
                    continue
            elif not (st == "unsatisfactory" or len(note) >= 3):
                continue
            text = note or "Needs work (no description)"
            f = {"key": f"{cid}:{i}", "section": sec, "text": text,
                 "marked_ok": st == "satisfactory", "photos": len(it.get("photos") or []),
                 "check_id": cid, "checked_by": by, "checked_at": at, "tags": tags_for(sec, text)}
            seen[(sec.lower(), text.lower())] = f
        wn = (c.get("workshop_notes") or "").strip()
        if len(wn) >= 3:
            seen[("other issues", wn.lower())] = {
                "key": f"{cid}:notes", "section": "Other issues", "text": wn, "marked_ok": False,
                "photos": len(c.get("workshop_photos") or []), "check_id": cid,
                "checked_by": by, "checked_at": at, "tags": tags_for("", wn)}
        for j, p in enumerate(c.get("parts_required") or []):
            p = (p or "").strip()
            if p:
                seen[("parts listed", p.lower())] = {
                    "key": f"{cid}:part:{j}", "section": "Part listed by checker", "text": p,
                    "marked_ok": False, "photos": 0, "check_id": cid, "checked_by": by,
                    "checked_at": at, "tags": tags_for("", p)}
    return list(seen.values())


def job_status(job: Optional[dict], has_checks: bool) -> str:
    if job and job.get("status") == "signed_off":
        return "signed_off"
    if job and job.get("status") in ("reviewed", "in_progress"):
        if any(p.get("status") not in PARTS_IN for p in job.get("parts", [])):
            return "waiting_parts"
        return "in_progress" if job.get("status") == "in_progress" else "ready"
    if has_checks:
        return "draft" if job else "awaiting_review"
    return "not_checked"


async def jobs_for_round(round_id: str) -> Dict[str, dict]:
    js = await _db.service_jobs.find({"round_id": round_id}, {"_id": 0, "sheet.signature": 0}).to_list(length=5000)
    return {j["asset_id"]: j for j in js}


def merged_findings(found: List[dict], job: Optional[dict]) -> List[dict]:
    """Reviewed jobs keep the findings as they were reviewed; drafts pick up new checks."""
    if job and job.get("status") != "draft":
        return job.get("findings", [])
    if not job:
        return found
    old = {f["key"]: f for f in job.get("findings", [])}
    out = []
    for f in found:
        o = old.get(f["key"], {})
        out.append({**f, "decision": o.get("decision"), "comment": o.get("comment", "")})
    return out


# ---------------------------------------------------------------- read endpoints
@router.get("/overview")
async def overview():
    """Machine-type tiles: only types that have had a pre-service check or a job."""
    assets = await active_assets()
    groups = {}
    for a in assets:
        groups.setdefault(group_key(a), []).append(a)
    makes_checked = set(m.lower() for m in await _db.checklists.distinct("machine_make", {"check_type": "pre_service_check"}) if m)
    job_groups = set(await _db.service_jobs.distinct("group_key"))
    tiles = []
    for gk, al in groups.items():
        if not ({(a.get("make") or "").lower() for a in al} & makes_checked) and gk not in job_groups:
            continue
        rnd = await current_round(gk)
        chk = await checks_for_group(gk, al, rnd["started_at"])
        jobs = await jobs_for_round(rnd["id"])
        counts = {}
        for a in al:
            s = job_status(jobs.get(a["id"]), a["id"] in chk)
            counts[s] = counts.get(s, 0) + 1
        if not chk and not jobs:
            continue
        makes = sorted({a.get("make") for a in al if a.get("make")})
        tiles.append({"key": gk, "label": gk, "makes": makes, "machines": len(al), "round": rnd,
                      "counts": counts, "checked": len(chk)})
    tiles.sort(key=lambda t: -(t["counts"].get("awaiting_review", 0) + t["counts"].get("draft", 0)))
    return {"groups": tiles}


@router.get("/group/{gkey}")
async def group(gkey: str):
    assets = [a for a in await active_assets() if group_key(a) == gkey]
    if not assets:
        raise HTTPException(404, "No machines of that type")
    rnd = await current_round(gkey)
    chk = await checks_for_group(gkey, assets, rnd["started_at"])
    jobs = await jobs_for_round(rnd["id"])
    rows, summary = [], {}
    for a in assets:
        job = jobs.get(a["id"])
        checks = chk.get(a["id"], [])
        fs = merged_findings(findings_from_checks(checks), job)
        real = [f for f in fs if "serial" not in f["tags"]]
        last = checks[-1] if checks else None
        rows.append({
            "asset_id": a["id"], "name": a["name"], "make": a.get("make"),
            "status": job_status(job, bool(checks)), "problems": len(real),
            "tags": sorted({t for f in real for t in f["tags"]}),
            "checked_by": pretty(last.get("staff_name")) if last else None,
            "checked_at": str(last.get("completed_at"))[:10] if last else None,
            "job_no": job.get("job_no") if job else None,
            "assigned_to": (job or {}).get("assigned_to"),
        })
        if not job or job.get("status") == "draft":
            for f in fs:
                for t in f["tags"]:
                    summary.setdefault(t, set()).add(a["id"])
    names = {a["id"]: a["name"] for a in assets}
    summ = [{"tag": t, "label": TAG_LABEL.get(t, "Other"), "part": TAG_PART.get(t),
             "machines": sorted(({"asset_id": i, "name": names[i]} for i in ids), key=lambda m: _natkey(m["name"]))}
            for t, ids in summary.items()]
    summ.sort(key=lambda s: -len(s["machines"]))
    ok_noted = sum(1 for a in assets for f in findings_from_checks(chk.get(a["id"], []))
                   if f["marked_ok"] and "serial" not in f["tags"])
    rows.sort(key=lambda r: _natkey(r["name"]))
    return {"group": gkey, "round": rnd, "machines": rows, "summary": summ, "marked_ok_with_fault": ok_noted}


def _natkey(s):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s or "")]


@router.get("/machine/{asset_id}")
async def machine(asset_id: str):
    a = await _db.assets.find_one({"id": asset_id}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Machine not found")
    gk = group_key(a)
    rnd = await current_round(gk)
    chk = (await checks_for_group(gk, [a], rnd["started_at"])).get(asset_id, [])
    job = await _db.service_jobs.find_one({"round_id": rnd["id"], "asset_id": asset_id}, {"_id": 0})
    open_job = job
    if not job:  # a job from an earlier round that is still open
        open_job = await _db.service_jobs.find_one(
            {"asset_id": asset_id, "status": {"$in": ["reviewed", "in_progress"]}}, {"_id": 0})
    fs = merged_findings(findings_from_checks(chk), open_job if open_job and open_job.get("round_id") == rnd["id"] else None)
    history = await _db.service_jobs.find(
        {"asset_id": asset_id, "status": "signed_off"},
        {"_id": 0, "job_no": 1, "sheet.signed_by": 1, "sheet.signed_at": 1, "sheet.work": 1, "round_name": 1}
    ).sort("sheet.signed_at", -1).to_list(length=20)
    checks_meta = [{"id": c["id"], "by": pretty(c.get("staff_name")), "at": str(c.get("completed_at"))[:10]} for c in chk]
    return {"asset": a, "group": gk, "round": rnd, "checks": checks_meta,
            "findings": fs, "job": open_job, "status": job_status(open_job, bool(chk)), "history": history}


@router.get("/my-jobs")
async def my_jobs(employee_number: str):
    me = await who(employee_number, need_workshop=False)
    js = await _db.service_jobs.find({"status": {"$in": ["reviewed", "in_progress"]}},
                                     {"_id": 0, "findings.text": 1, "findings.decision": 1, "job_no": 1, "id": 1,
                                      "asset_id": 1, "asset_name": 1, "group_key": 1, "assigned_to": 1,
                                      "parts": 1, "status": 1, "reviewed_at": 1, "reviewed_by": 1}).to_list(length=2000)
    out = {"mine": [], "ready": [], "waiting_parts": [], "others": []}
    for j in js:
        j["fix_count"] = sum(1 for f in j.get("findings", []) if f.get("decision") == "fix")
        j.pop("findings", None)
        j["parts_waiting"] = sum(1 for p in j.get("parts", []) if p.get("status") not in PARTS_IN)
        mine = (j.get("assigned_to") or {}).get("employee_number") == me["employee_number"]
        if mine:
            out["mine"].append(j)
        elif j.get("assigned_to"):
            out["others"].append(j)
        elif j["parts_waiting"]:
            out["waiting_parts"].append(j)
        else:
            out["ready"].append(j)
    for k in out:
        out[k].sort(key=lambda j: j.get("reviewed_at") or "")
    return out


@router.get("/parts")
async def parts(group: Optional[str] = None, show_fitted: bool = False):
    q = {"status": {"$in": ["reviewed", "in_progress"] + (["signed_off"] if show_fitted else [])}}
    if group:
        q["group_key"] = group
    js = await _db.service_jobs.find(q, {"_id": 0, "id": 1, "job_no": 1, "asset_id": 1, "asset_name": 1,
                                         "group_key": 1, "parts": 1}).to_list(length=5000)
    lines = {}
    for j in js:
        for p in j.get("parts", []):
            if not show_fitted and p.get("status") == "Fitted":
                continue
            key = f"{(p.get('name') or '').strip().lower()}|{(p.get('part_no') or '').strip().lower()}"
            L = lines.setdefault(key, {"name": p.get("name"), "part_no": p.get("part_no"), "qty": 0, "uses": []})
            L["qty"] += int(p.get("qty") or 1)
            L["uses"].append({"job_id": j["id"], "job_no": j["job_no"], "asset_id": j["asset_id"],
                              "asset_name": j["asset_name"], "group": j["group_key"], "part_id": p["id"],
                              "qty": p.get("qty"), "status": p.get("status")})
    out = list(lines.values())
    order = {s: i for i, s in enumerate(PART_STATUSES)}
    out.sort(key=lambda L: (min(order.get(u["status"], 0) for u in L["uses"]), (L["name"] or "").lower()))
    return {"lines": out, "statuses": PART_STATUSES}


@router.get("/scan")
async def scan(code: str):
    """QR stickers carry MACHINE:<make>:<name>"""
    m = re.match(r"^MACHINE:([^:]*):(.*)$", (code or "").strip())
    if not m:
        raise HTTPException(400, "That QR code isn't a machine code")
    a = await _db.assets.find_one({"make": m.group(1), "name": m.group(2)}, {"_id": 0, "id": 1, "name": 1})
    if not a:
        raise HTTPException(404, f"No machine called {m.group(2)}")
    return {"asset_id": a["id"], "name": a["name"]}


# ---------------------------------------------------------------- write endpoints
class PartIn(BaseModel):
    id: Optional[str] = None
    finding_key: Optional[str] = None
    name: str
    part_no: Optional[str] = ""
    qty: int = 1
    status: Optional[str] = None


class ReviewIn(BaseModel):
    employee_number: str
    asset_id: str
    decisions: Dict[str, Optional[str]] = {}
    comments: Dict[str, str] = {}
    parts: List[PartIn] = []
    action: str = "draft"  # "draft" | "review"
    assign_to: Optional[str] = None  # employee number


async def _next_job_no():
    c = await _db.counters.find_one_and_update({"_id": "service_job"}, {"$inc": {"n": 1}}, upsert=True, return_document=True)
    if not c or "n" not in c:  # older pymongo returns the pre-update doc on upsert
        c = await _db.counters.find_one({"_id": "service_job"})
    return f"JC-{int(c['n']):04d}"


@router.post("/review")
async def save_review(body: ReviewIn):
    me = await who(body.employee_number)
    info = await machine(body.asset_id)
    a, rnd = info["asset"], info["round"]
    job = info["job"]
    if job and job.get("status") != "draft":
        raise HTTPException(409, f"Already reviewed — job card {job.get('job_no')}")
    fs = info["findings"]
    keys = {f["key"] for f in fs}
    for f in fs:
        d = body.decisions.get(f["key"])
        f["decision"] = d if d in DECISIONS else None
        f["comment"] = (body.comments.get(f["key"]) or "").strip()
    parts = []
    for p in body.parts:
        if not p.name.strip():
            continue
        parts.append({"id": p.id or str(uuid.uuid4()), "finding_key": p.finding_key if p.finding_key in keys else None,
                      "name": p.name.strip(), "part_no": (p.part_no or "").strip(), "qty": max(1, int(p.qty or 1)),
                      "status": "Draft", "added_by": me["name"]})
    doc = {
        "asset_id": a["id"], "asset_name": a["name"], "make": a.get("make"), "group_key": info["group"],
        "round_id": rnd["id"], "round_name": rnd["name"], "findings": fs, "parts": parts,
        "check_ids": [c["id"] for c in info["checks"]], "updated_at": now_iso(), "status": "draft",
        "draft_by": me,
    }
    if body.action == "review":
        undecided = [f for f in fs if not f.get("decision")]
        if undecided:
            raise HTTPException(400, f"{len(undecided)} problem(s) still need Fix now / Monitor / No action")
        doc["status"] = "reviewed"
        doc["job_no"] = await _next_job_no()
        doc["reviewed_by"] = me
        doc["reviewed_at"] = now_iso()
        for p in doc["parts"]:
            p["status"] = "To order"
        if body.assign_to:
            doc["assigned_to"] = await who(body.assign_to, need_workshop=False)
            doc["status"] = "in_progress"
    if job:
        await _db.service_jobs.update_one({"id": job["id"]}, {"$set": doc})
        doc["id"] = job["id"]
    else:
        doc["id"] = str(uuid.uuid4())
        doc["created_at"] = now_iso()
        await _db.service_jobs.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


class BulkPartIn(BaseModel):
    employee_number: str
    group_key: str
    tag: str
    name: str
    part_no: Optional[str] = ""
    qty: int = 1


@router.post("/bulk-part")
async def bulk_part(body: BulkPartIn):
    """Fleet summary: put one part against every unreviewed machine that has this kind of problem."""
    me = await who(body.employee_number)
    g = await group(body.group_key)
    added = 0
    for m in g["machines"]:
        if m["status"] not in ("awaiting_review", "draft") or body.tag not in m["tags"]:
            continue
        info = await machine(m["asset_id"])
        job = info["job"]
        fs = info["findings"]
        target = next((f for f in fs if body.tag in f["tags"]), None)
        if not target:
            continue
        existing = (job or {}).get("parts", [])
        if any(p["name"].lower() == body.name.strip().lower() and p.get("finding_key") == target["key"] for p in existing):
            continue
        parts = [PartIn(**p) for p in existing] + [PartIn(finding_key=target["key"], name=body.name, part_no=body.part_no, qty=body.qty)]
        decisions = {f["key"]: f.get("decision") for f in fs}
        if not decisions.get(target["key"]):
            decisions[target["key"]] = "fix"
        await save_review(ReviewIn(employee_number=body.employee_number, asset_id=m["asset_id"],
                                   decisions=decisions, comments={f["key"]: f.get("comment", "") for f in fs},
                                   parts=parts, action="draft"))
        added += 1
    return {"added": added, "by": me["name"]}


class JobAction(BaseModel):
    employee_number: str
    done: Optional[List[str]] = None
    assign_to: Optional[str] = None


async def _job(job_id):
    j = await _db.service_jobs.find_one({"id": job_id}, {"_id": 0})
    if not j:
        raise HTTPException(404, "Job card not found")
    return j


@router.post("/job/{job_id}/take")
async def take(job_id: str, body: JobAction):
    me = await who(body.employee_number)
    j = await _job(job_id)
    if j["status"] not in ("reviewed", "in_progress"):
        raise HTTPException(409, "This job card isn't open")
    target = await who(body.assign_to, need_workshop=False) if body.assign_to else me
    await _db.service_jobs.update_one({"id": job_id}, {"$set": {"assigned_to": target, "status": "in_progress",
                                                                "taken_at": now_iso()}})
    return {"ok": True, "assigned_to": target}


@router.post("/job/{job_id}/progress")
async def progress(job_id: str, body: JobAction):
    await who(body.employee_number)
    j = await _job(job_id)
    if j["status"] == "signed_off":
        raise HTTPException(409, "Signed off — locked")
    await _db.service_jobs.update_one({"id": job_id}, {"$set": {"done": body.done or []}})
    return {"ok": True}


class SignIn(BaseModel):
    employee_number: str
    done: List[str] = []
    work: str = ""
    hours: Optional[float] = None
    next_due: Optional[str] = None
    signature: str  # data URL


@router.post("/job/{job_id}/sign")
async def sign(job_id: str, body: SignIn):
    me = await who(body.employee_number)
    j = await _job(job_id)
    if j["status"] not in ("reviewed", "in_progress"):
        raise HTTPException(409, "This job card isn't open")
    if not (body.signature or "").startswith("data:image"):
        raise HTTPException(400, "Please sign before signing off")
    at = now_iso()
    sheet = {"done": body.done, "work": body.work.strip(), "hours": body.hours, "next_due": body.next_due,
             "signature": body.signature, "signed_by": me, "signed_at": at}
    parts = j.get("parts", [])
    for p in parts:
        p["status"] = "Fitted"
    await _db.service_jobs.update_one({"id": job_id}, {"$set": {"sheet": sheet, "status": "signed_off",
                                                                "parts": parts, "done": body.done}})
    # Write it into the normal records so Service History and the servicing exports see it
    fixes = [f for f in j.get("findings", []) if f.get("decision") == "fix"]
    lines = [f"Job card {j['job_no']} (reviewed by {j.get('reviewed_by', {}).get('name', '')})"]
    for f in fixes:
        lines.append(f"{'Done' if f['key'] in body.done else 'NOT done'} — {f['section']}: {f['text']}")
    if body.work.strip():
        lines.append(f"Work done: {body.work.strip()}")
    if body.hours:
        lines.append(f"Labour: {body.hours} hrs")
    if body.next_due:
        lines.append(f"Next service due: {body.next_due}")
    await _db.checklists.insert_one({
        "id": str(uuid.uuid4()), "employee_number": me["employee_number"], "staff_name": me["name"],
        "machine_make": j.get("make") or "", "machine_model": j["asset_name"], "check_type": "workshop_service",
        "checklist_items": [], "workshop_notes": "\n".join(lines), "workshop_photos": [],
        "parts_required": [f"{p['name']}{' — ' + p['part_no'] if p.get('part_no') else ''} ×{p.get('qty', 1)}" for p in parts],
        "completed_at": at, "status": "completed", "service_job_id": job_id,
    })
    return {"ok": True, "signed_at": at}


class PartStatusIn(BaseModel):
    employee_number: str
    uses: List[Dict[str, str]]  # [{job_id, part_id}]
    status: str


@router.post("/parts/status")
async def parts_status(body: PartStatusIn):
    await who(body.employee_number)
    if body.status not in PART_STATUSES:
        raise HTTPException(400, "Unknown status")
    n = 0
    for u in body.uses:
        r = await _db.service_jobs.update_one(
            {"id": u["job_id"], "status": {"$ne": "signed_off"}, "parts.id": u["part_id"]},
            {"$set": {"parts.$.status": body.status, "parts.$.updated_at": now_iso()}})
        n += r.modified_count
    return {"updated": n}


class RoundIn(BaseModel):
    employee_number: str
    group_key: str
    name: str


@router.post("/rounds")
async def new_round(body: RoundIn):
    me = await who(body.employee_number)
    if not body.name.strip():
        raise HTTPException(400, "Give the round a name")
    r = {"id": str(uuid.uuid4()), "group_key": body.group_key, "name": body.name.strip(),
         "started_at": now_iso(), "started_by": me}
    await _db.service_rounds.insert_one(dict(r))
    return r


@router.get("/rounds/{gkey}")
async def list_rounds(gkey: str):
    return await _db.service_rounds.find({"group_key": gkey}, {"_id": 0}).sort("started_at", -1).to_list(length=50)


@router.get("/job/{job_id}/sheet")
async def get_sheet(job_id: str):
    """The signed sheet including its signature image"""
    return await _job(job_id)


@router.get("/staff")
async def workshop_staff():
    """People who can be given a job card"""
    s = await _db.staff.find({"active": {"$ne": False}, "workshop_control": {"$regex": "^yes$", "$options": "i"}},
                             {"_id": 0, "name": 1, "employee_number": 1}).to_list(length=500)
    out = [{"name": pretty(x["name"]), "employee_number": x["employee_number"]} for x in s
           if x.get("employee_number") and not re.match(r"^admin", x.get("name", ""), re.I)]
    return sorted(out, key=lambda x: x["name"])
