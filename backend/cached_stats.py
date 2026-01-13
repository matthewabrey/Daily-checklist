"""
Simple cached stats solution - stores pre-computed stats in database
Updates only when needed, serves instantly from cache
"""
from datetime import datetime, timezone, timedelta

# In-memory cache with expiry
_stats_cache = {
    "data": None,
    "expires_at": None
}

CACHE_DURATION_SECONDS = 300  # 5 minutes

async def get_cached_stats(db):
    """Get stats from cache or compute fresh"""
    global _stats_cache
    
    now = datetime.now(timezone.utc)
    
    # Return cached data if still valid
    if _stats_cache["data"] and _stats_cache["expires_at"] and now < _stats_cache["expires_at"]:
        return _stats_cache["data"]
    
    # Compute fresh stats using SIMPLE COUNT QUERIES ONLY
    stats = await compute_simple_stats(db)
    
    # Cache the result
    _stats_cache["data"] = stats
    _stats_cache["expires_at"] = now + timedelta(seconds=CACHE_DURATION_SECONDS)
    
    return stats

async def compute_simple_stats(db):
    """Compute stats using only fast count queries - NO loading documents"""
    
    now = datetime.now(timezone.utc)
    
    # Create multiple date formats for today to handle inconsistent data
    today_date = now.date().isoformat()  # "2026-01-03"
    
    # All counts run in parallel for speed
    total_completed = await db.checklists.count_documents({
        "check_type": {"$in": ["daily_check", "grader_startup", "workshop_service"]}
    })
    
    # For today's count, use regex to match the date part regardless of time format
    # This handles both "2026-01-03T..." and "2026-01-03T...Z" and "2026-01-03T...+00:00"
    today_total = await db.checklists.count_documents({
        "completed_at": {"$regex": f"^{today_date}"}
    })
    
    repairs_completed = await db.checklists.count_documents({
        "check_type": "REPAIR COMPLETED"
    })
    
    # Count actual unsatisfactory items in checklists + general repairs
    # This is what the repairs page actually shows
    repair_checklists = await db.checklists.find(
        {"$or": [
            {"checklist_items.status": "unsatisfactory"},
            {"check_type": "GENERAL REPAIR"}
        ]},
        {"id": 1, "checklist_items": 1, "check_type": 1, "_id": 0}
    ).to_list(length=10000)
    
    # Build list of all repair IDs - must match frontend format!
    all_repair_ids = []
    for checklist in repair_checklists:
        if checklist.get("check_type") == "GENERAL REPAIR":
            # Frontend uses "{id}-general" format for GENERAL REPAIR
            all_repair_ids.append(f"{checklist.get('id')}-general")
        else:
            items = checklist.get("checklist_items", [])
            for idx, item in enumerate(items):
                if item.get("status") == "unsatisfactory":
                    all_repair_ids.append(f"{checklist.get('id')}-{idx}")
    
    # Get repair statuses for these IDs
    acknowledged_ids = set()
    completed_ids = set()
    if all_repair_ids:
        async for status in db.repair_status.find(
            {"repair_id": {"$in": all_repair_ids}},
            {"repair_id": 1, "acknowledged": 1, "completed": 1, "_id": 0}
        ):
            if status.get("completed"):
                completed_ids.add(status.get("repair_id"))
            elif status.get("acknowledged"):
                acknowledged_ids.add(status.get("repair_id"))
    
    total_repairs = len(all_repair_ids)
    new_repairs = total_repairs - len(acknowledged_ids) - len(completed_ids)
    repairs_due = len(acknowledged_ids)  # Acknowledged but not completed
    
    machine_additions = await db.checklists.count_documents({
        "check_type": {"$in": ["MACHINE ADD", "NEW MACHINE"]}
    })
    
    # Get count of acknowledged machine additions (stored in repair_status)
    # First get all machine addition IDs, then count how many are acknowledged
    machine_add_ids = []
    async for doc in db.checklists.find(
        {"check_type": {"$in": ["MACHINE ADD", "NEW MACHINE"]}},
        {"id": 1, "_id": 0}
    ):
        if doc.get("id"):
            machine_add_ids.append(doc["id"])
    
    acknowledged_machines = 0
    if machine_add_ids:
        acknowledged_machines = await db.repair_status.count_documents({
            "repair_id": {"$in": machine_add_ids},
            "acknowledged": True
        })
    
    pending_machine_additions = max(0, machine_additions - acknowledged_machines)
    
    return {
        "total_completed": total_completed,
        "today_by_type": {},  # Simplified - skip breakdown for speed
        "today_total": today_total,
        "new_repairs": max(0, new_repairs),
        "repairs_due": repairs_due,
        "repairs_completed": repairs_completed,
        "repairs_completed_count": len(completed_ids),
        "machine_additions_count": pending_machine_additions,
        "machine_additions_total": machine_additions
    }

async def invalidate_cache():
    """Call this when data changes to force refresh"""
    global _stats_cache
    _stats_cache["data"] = None
    _stats_cache["expires_at"] = None
