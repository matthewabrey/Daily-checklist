#!/usr/bin/env python3
"""
Script to sync data from production to local MongoDB
"""
import asyncio
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
import json
from datetime import datetime

PROD_URL = "https://checklist-capture.emergent.host"
LOCAL_MONGO = "mongodb://localhost:27017"
DB_NAME = "abrey_checks"

async def fetch_all_paginated(client, endpoint, limit=100):
    """Fetch all data from a paginated endpoint"""
    all_data = []
    skip = 0
    
    while True:
        url = f"{PROD_URL}{endpoint}?limit={limit}&skip={skip}"
        print(f"  Fetching {url}...")
        response = await client.get(url, timeout=60.0)
        data = response.json()
        
        if isinstance(data, list):
            if not data:
                break
            all_data.extend(data)
            if len(data) < limit:
                break
            skip += limit
        else:
            # Not paginated, return as-is
            return data if data else []
    
    return all_data

async def fetch_simple(client, endpoint):
    """Fetch data from a simple endpoint"""
    url = f"{PROD_URL}{endpoint}"
    print(f"  Fetching {url}...")
    response = await client.get(url, timeout=60.0)
    return response.json()

async def main():
    print("=" * 60)
    print("Production Data Sync Script")
    print("=" * 60)
    
    # Connect to local MongoDB
    mongo_client = AsyncIOMotorClient(LOCAL_MONGO)
    db = mongo_client[DB_NAME]
    
    async with httpx.AsyncClient() as http_client:
        # 1. Fetch and import staff
        print("\n[1/5] Syncing STAFF...")
        try:
            staff_data = await fetch_simple(http_client, "/api/staff")
            if staff_data:
                await db.staff.delete_many({})
                # Ensure admin user has proper permissions
                for s in staff_data:
                    if s.get('employee_number') == '4444':
                        s['admin_control'] = 'yes'
                        s['workshop_control'] = 'yes'
                await db.staff.insert_many(staff_data)
                print(f"  ✓ Imported {len(staff_data)} staff members")
        except Exception as e:
            print(f"  ✗ Error syncing staff: {e}")
        
        # 2. Fetch and import assets
        print("\n[2/5] Syncing ASSETS...")
        try:
            assets_data = await fetch_simple(http_client, "/api/assets")
            if assets_data:
                await db.assets.delete_many({})
                await db.assets.insert_many(assets_data)
                print(f"  ✓ Imported {len(assets_data)} assets")
        except Exception as e:
            print(f"  ✗ Error syncing assets: {e}")
        
        # 3. Fetch and import checklists (paginated - this is the big one)
        print("\n[3/5] Syncing CHECKLISTS (this may take a while)...")
        try:
            checklists_data = await fetch_all_paginated(http_client, "/api/checklists", limit=200)
            if checklists_data:
                await db.checklists.delete_many({})
                # Insert in batches to avoid memory issues
                batch_size = 100
                for i in range(0, len(checklists_data), batch_size):
                    batch = checklists_data[i:i+batch_size]
                    await db.checklists.insert_many(batch)
                    print(f"  ... inserted {min(i+batch_size, len(checklists_data))}/{len(checklists_data)}")
                print(f"  ✓ Imported {len(checklists_data)} checklists")
        except Exception as e:
            print(f"  ✗ Error syncing checklists: {e}")
        
        # 4. Fetch and import repair_status
        print("\n[4/5] Syncing REPAIR STATUS...")
        try:
            # Try to get repair statuses
            repair_data = await fetch_simple(http_client, "/api/repair-status/bulk")
            if repair_data and isinstance(repair_data, dict):
                # Convert dict to list format for storage
                repair_list = [{"repair_id": k, **v} if isinstance(v, dict) else {"repair_id": k, "status": v} 
                              for k, v in repair_data.items()]
                if repair_list:
                    await db.repair_status.delete_many({})
                    await db.repair_status.insert_many(repair_list)
                    print(f"  ✓ Imported {len(repair_list)} repair statuses")
            elif repair_data and isinstance(repair_data, list):
                await db.repair_status.delete_many({})
                await db.repair_status.insert_many(repair_data)
                print(f"  ✓ Imported {len(repair_data)} repair statuses")
        except Exception as e:
            print(f"  ✗ Error syncing repair status: {e}")
        
        # 5. Fetch and import checklist_templates
        print("\n[5/5] Syncing CHECKLIST TEMPLATES...")
        try:
            templates_data = await fetch_simple(http_client, "/api/checklist-templates")
            if templates_data:
                await db.checklist_templates.delete_many({})
                await db.checklist_templates.insert_many(templates_data)
                print(f"  ✓ Imported {len(templates_data)} templates")
        except Exception as e:
            print(f"  ✗ Error syncing templates: {e}")
    
    # Verify counts
    print("\n" + "=" * 60)
    print("VERIFICATION - Local Database Counts:")
    print("=" * 60)
    for coll in ['staff', 'assets', 'checklists', 'repair_status', 'checklist_templates']:
        count = await db[coll].count_documents({})
        print(f"  {coll}: {count} documents")
    
    # Ensure indexes exist
    print("\nCreating indexes...")
    await db.checklists.create_index([("completed_at", -1)])
    await db.checklists.create_index([("check_type", 1)])
    await db.checklists.create_index([("check_type", 1), ("completed_at", -1)])
    await db.checklists.create_index([("machine_make", 1)])
    await db.checklists.create_index([("employee_number", 1)])
    await db.checklists.create_index([("id", 1)])
    await db.assets.create_index([("make", 1)])
    await db.assets.create_index([("make", 1), ("name", 1)])
    await db.staff.create_index([("employee_number", 1)])
    await db.repair_status.create_index([("repair_id", 1)])
    print("  ✓ Indexes created")
    
    print("\n✅ SYNC COMPLETE!")
    print("=" * 60)
    
    mongo_client.close()

if __name__ == "__main__":
    asyncio.run(main())
