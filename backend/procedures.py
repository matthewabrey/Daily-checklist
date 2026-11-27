"""Procedures (v7.8): a tile per job with an ordered list of steps.

e.g. "Carrot Drilling" -> 1. Check the seed rate is set  2. Check the depth wheels ...

Managers (and admins) open Manager -> Procedures, add a tile, or open one to view,
edit, re-order, rename, copy onto a new tile, or delete.

Collection: procedures
  { id, title, department, steps: [{id, text}], created_by, updated_by,
    created_at, updated_at, deleted }
Deleting only marks `deleted: true`, so a procedure removed by mistake can be
put back from the database.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/procedures")
_db = None

MAX_STEPS = 200
MAX_STEP_LEN = 1000
MAX_TITLE_LEN = 120


def init(db):
    global _db
    _db = db


class Step(BaseModel):
    id: Optional[str] = None
    text: str = ""


class ProcedureIn(BaseModel):
    title: str = ""
    department: Optional[str] = ""
    steps: List[Step] = []
    by: Optional[str] = None


class CopyIn(BaseModel):
    title: Optional[str] = None
    by: Optional[str] = None


def _now():
    return datetime.now(timezone.utc).isoformat()


def _clean(payload: ProcedureIn):
    title = (payload.title or "").strip()[:MAX_TITLE_LEN]
    if not title:
        raise HTTPException(status_code=400, detail="Give the procedure a name first.")
    steps = []
    for s in payload.steps[:MAX_STEPS]:
        text = (s.text or "").strip()[:MAX_STEP_LEN]
        if text:
            steps.append({"id": s.id or uuid.uuid4().hex[:10], "text": text})
    return title, (payload.department or "").strip()[:80], steps


async def _get(pid: str):
    doc = await _db.procedures.find_one({"id": pid, "deleted": {"$ne": True}}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="That procedure isn't there any more.")
    return doc


@router.get("")
async def list_procedures():
    docs = await _db.procedures.find({"deleted": {"$ne": True}}, {"_id": 0}).to_list(2000)
    docs.sort(key=lambda d: (d.get("title") or "").lower())
    return {"procedures": docs}


@router.get("/{pid}")
async def get_procedure(pid: str):
    return await _get(pid)


@router.post("")
async def create_procedure(payload: ProcedureIn):
    title, dept, steps = _clean(payload)
    now = _now()
    doc = {
        "id": uuid.uuid4().hex,
        "title": title,
        "department": dept,
        "steps": steps,
        "created_by": payload.by,
        "updated_by": payload.by,
        "created_at": now,
        "updated_at": now,
    }
    await _db.procedures.insert_one(dict(doc))
    return doc


@router.put("/{pid}")
async def update_procedure(pid: str, payload: ProcedureIn):
    await _get(pid)
    title, dept, steps = _clean(payload)
    patch = {"title": title, "department": dept, "steps": steps,
             "updated_by": payload.by, "updated_at": _now()}
    await _db.procedures.update_one({"id": pid}, {"$set": patch})
    return await _get(pid)


@router.post("/{pid}/copy")
async def copy_procedure(pid: str, payload: CopyIn):
    src = await _get(pid)
    now = _now()
    title = (payload.title or "").strip()[:MAX_TITLE_LEN] or f"{src['title']} (copy)"
    doc = {
        "id": uuid.uuid4().hex,
        "title": title,
        "department": src.get("department", ""),
        "steps": [{"id": uuid.uuid4().hex[:10], "text": s["text"]} for s in src.get("steps", [])],
        "copied_from": src["id"],
        "created_by": payload.by,
        "updated_by": payload.by,
        "created_at": now,
        "updated_at": now,
    }
    await _db.procedures.insert_one(dict(doc))
    return doc


@router.delete("/{pid}")
async def delete_procedure(pid: str, by: Optional[str] = None):
    await _get(pid)
    await _db.procedures.update_one(
        {"id": pid}, {"$set": {"deleted": True, "deleted_by": by, "deleted_at": _now()}})
    return {"ok": True}
