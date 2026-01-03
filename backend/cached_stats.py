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
    
    # For repairs due - just count repair_status entries
    total_repair_records = await db.repair_status.count_documents({})
    acknowledged_repairs = await db.repair_status.count_documents({"acknowledged": True, "completed": {"$ne": True}})
    completed_repairs = await db.repair_status.count_documents({"completed": True})
    new_repairs = total_repair_records - acknowledged_repairs - completed_repairs
    
    machine_additions = await db.checklists.count_documents({
        "check_type": {"$in": ["MACHINE ADD", "NEW MACHINE"]}
    })
    
    return {
        "total_completed": total_completed,
        "today_by_type": {},  # Simplified - skip breakdown for speed
        "today_total": today_total,
        "new_repairs": max(0, new_repairs),
        "repairs_due": acknowledged_repairs,
        "repairs_completed": repairs_completed,
        "machine_additions_count": machine_additions
    }

async def invalidate_cache():
    """Call this when data changes to force refresh"""
    global _stats_cache
    _stats_cache["data"] = None
    _stats_cache["expires_at"] = None
