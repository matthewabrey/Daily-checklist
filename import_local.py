#!/usr/bin/env python3
"""
Import data from JSON exports into local MongoDB
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import json
from pathlib import Path

DATA_DIR = Path("/app/data_export")
LOCAL_MONGO = "mongodb://localhost:27017"
DB_NAME = "abrey_checks"

async def main():
    print("=" * 60)
    print("Importing Production Data to Local MongoDB")
    print("=" * 60)
    
    client = AsyncIOMotorClient(LOCAL_MONGO)
    db = client[DB_NAME]
    
    # 1. Import staff
    print("\n[1/5] Importing STAFF...")
    staff_file = DATA_DIR / "staff.json"
    if staff_file.exists():
        with open(staff_file) as f:
            staff_data = json.load(f)
        await db.staff.delete_many({})
        
        # Ensure admin user 4444 has proper permissions
        for s in staff_data:
            if s.get('employee_number') == '4444':
                s['admin_control'] = 'yes'
                s['workshop_control'] = 'yes'
            # Remove _id if present
            s.pop('_id', None)
        
        if staff_data:
            await db.staff.insert_many(staff_data)
        print(f"  ✓ Imported {len(staff_data)} staff members")
    
    # 2. Import assets  
    print("\n[2/5] Importing ASSETS...")
    assets_file = DATA_DIR / "assets.json"
    if assets_file.exists():
        with open(assets_file) as f:
            assets_data = json.load(f)
        await db.assets.delete_many({})
        for a in assets_data:
            a.pop('_id', None)
        if assets_data:
            await db.assets.insert_many(assets_data)
        print(f"  ✓ Imported {len(assets_data)} assets")
    
    # 3. Import checklists (large file)
    print("\n[3/5] Importing CHECKLISTS (large file, please wait)...")
    checklists_file = DATA_DIR / "checklists.json"
    if checklists_file.exists():
        with open(checklists_file) as f:
            checklists_data = json.load(f)
        await db.checklists.delete_many({})
        
        # Remove _id and insert in batches
        for c in checklists_data:
            c.pop('_id', None)
        
        batch_size = 500
        for i in range(0, len(checklists_data), batch_size):
            batch = checklists_data[i:i+batch_size]
            await db.checklists.insert_many(batch)
            print(f"  ... inserted {min(i+batch_size, len(checklists_data))}/{len(checklists_data)}")
        
        print(f"  ✓ Imported {len(checklists_data)} checklists")
    
    # 4. Import repair_status
    print("\n[4/5] Importing REPAIR STATUS...")
    repair_file = DATA_DIR / "repair_status.json"
    if repair_file.exists():
        with open(repair_file) as f:
            repair_data = json.load(f)
        await db.repair_status.delete_many({})
        for r in repair_data:
            r.pop('_id', None)
        if repair_data:
            await db.repair_status.insert_many(repair_data)
        print(f"  ✓ Imported {len(repair_data)} repair statuses")
    
    # 5. Import checklist_templates
    print("\n[5/5] Importing CHECKLIST TEMPLATES...")
    templates_file = DATA_DIR / "checklist_templates.json"
    if templates_file.exists():
        with open(templates_file) as f:
            templates_data = json.load(f)
        await db.checklist_templates.delete_many({})
        for t in templates_data:
            t.pop('_id', None)
        if templates_data:
            await db.checklist_templates.insert_many(templates_data)
        print(f"  ✓ Imported {len(templates_data)} templates")
    
    # Create indexes
    print("\n[6/6] Creating indexes...")
    try:
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
    except Exception as e:
        print(f"  Index creation note: {e}")
    
    # Final verification
    print("\n" + "=" * 60)
    print("VERIFICATION - Database Counts:")
    print("=" * 60)
    for coll in ['staff', 'assets', 'checklists', 'repair_status', 'checklist_templates']:
        count = await db[coll].count_documents({})
        print(f"  {coll}: {count} documents")
    
    # Verify admin user
    admin_user = await db.staff.find_one({"employee_number": "4444"}, {"_id": 0})
    print(f"\n  Admin user (4444): {admin_user}")
    
    print("\n✅ IMPORT COMPLETE!")
    print("=" * 60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
