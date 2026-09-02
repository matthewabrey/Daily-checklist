"""Unit tests for the idempotent sync helpers (run against a scratch database)."""
import os
import sys

import asyncio

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from sync_utils import upsert_assets, upsert_checklist_templates, upsert_staff  # noqa: E402

SCRATCH_DB = "scratch_sync_utils_test"


def run(coro_fn):
    """Run an async test body against a fresh scratch database (no pytest-asyncio needed)."""
    async def wrapper():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        await client.drop_database(SCRATCH_DB)
        try:
            await coro_fn(client[SCRATCH_DB])
        finally:
            await client.drop_database(SCRATCH_DB)
            client.close()
    asyncio.run(wrapper())


def test_staff_upsert_soft_deletes_and_keeps_admin():
    async def body(db):
        await db.staff.insert_many([
            {"employee_number": "4444", "name": "Admin", "active": True},
            {"employee_number": "1", "name": "Old Name", "active": True, "admin_control": "yes"},
            {"employee_number": "2", "name": "Leaver", "active": True},
        ])
        stats = await upsert_staff(db, [
            {"employee_number": "1", "name": "New Name", "workshop_control": "yes"},
            {"employee_number": "3", "name": "Joiner"},
        ])
        assert stats == {"added": 1, "updated": 1, "deactivated": 1}
        staff = {d["employee_number"]: d async for d in db.staff.find({}, {"_id": 0})}
        assert staff["4444"]["active"] is True
        assert staff["1"]["name"] == "New Name" and staff["1"]["active"] is True
        assert staff["2"]["active"] is False  # soft-deleted, record still present
        assert staff["3"]["active"] is True and staff["3"]["id"]
        # idempotent re-run
        assert await upsert_staff(db, [{"employee_number": "1", "name": "New Name", "workshop_control": "yes"}, {"employee_number": "3", "name": "Joiner"}]) == {"added": 0, "updated": 0, "deactivated": 0}


    run(body)

def test_assets_upsert_keeps_ids_qr_and_retires_missing():
    async def body(db):
        await db.assets.insert_many([
            {"id": "a1", "make": "Perrot", "name": "M1", "check_type": "Trailed Implement", "qr_printed": True, "qr_printed_at": "2026-01-01"},
            {"id": "a2", "make": "JCB", "name": "Sold", "check_type": "Loader"},
        ])
        source = [{"make": "Perrot", "name": "M1", "check_type": "Trailed Implement"}, {"make": "Perrot", "name": "M2", "check_type": "Trailed Implement"}]
        stats = await upsert_assets(db, source)
        assert stats == {"added": 1, "updated": 1, "retired": 1}
        assets = {(d["make"], d["name"]): d async for d in db.assets.find({}, {"_id": 0})}
        assert assets[("Perrot", "M1")]["id"] == "a1" and assets[("Perrot", "M1")]["qr_printed"] is True
        assert assets[("JCB", "Sold")]["retired"] is True
        assert assets[("Perrot", "M2")]["qr_printed"] is False and assets[("Perrot", "M2")]["retired"] is False
        assert await upsert_assets(db, source) == {"added": 0, "updated": 0, "retired": 0}
        # machine reappears in the source -> un-retired, same id
        await upsert_assets(db, source + [{"make": "JCB", "name": "Sold", "check_type": "Loader"}])
        sold = await db.assets.find_one({"name": "Sold"}, {"_id": 0})
        assert sold["retired"] is False and sold["id"] == "a2"


    run(body)

def test_templates_upsert_replaces_per_check_type_only():
    async def body(db):
        await db.checklist_templates.insert_one({"check_type": "Custom", "items": [{"item": "keep me"}]})
        await upsert_checklist_templates(db, [{"check_type": "Loader", "items": [{"item": "x"}]}])
        await upsert_checklist_templates(db, [{"check_type": "Loader", "items": [{"item": "y"}]}])
        assert await db.checklist_templates.count_documents({}) == 2
        loader = await db.checklist_templates.find_one({"check_type": "Loader"}, {"_id": 0})
        assert loader["items"][0]["item"] == "y" and loader["updated_at"]
        assert await db.checklist_templates.find_one({"check_type": "Custom"}) is not None

    run(body)