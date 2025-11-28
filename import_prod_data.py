#!/usr/bin/env python3
"""Import production data into local MongoDB"""
import asyncio
import json
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

PROD_URL = "https://checklist-capture.emergent.host"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "abrey_checks"

async def fetch_all_assets():
    """Fetch all assets from production"""
    print("Fetching assets from production...")
    makes = requests.get(f"{PROD_URL}/api/assets/makes").json()
    all_assets = []
    
    for make in makes:
        names_response = requests.get(f"{PROD_URL}/api/assets/names/{make}")
        names = names_response.json()
        
        for name in names:
            checktype_response = requests.get(f"{PROD_URL}/api/assets/checktype/{make}/{name}")
            checktype = checktype_response.json()
            
            all_assets.append({
                "make": make,
                "name": name,
                "check_type": checktype
            })
    
    print(f"Fetched {len(all_assets)} assets")
    return all_assets

async def import_data():
    """Import all production data"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Import checklists
        print("\nImporting checklists...")
        with open('/tmp/prod_checklists.json', 'r') as f:
            checklists = json.load(f)
        
        if checklists:
            # Clear existing
            await db.checklists.delete_many({})
            # Remove MongoDB _id fields if present
            for checklist in checklists:
                checklist.pop('_id', None)
            await db.checklists.insert_many(checklists)
            print(f"✓ Imported {len(checklists)} checklists")
        
        # Import staff
        print("\nImporting staff...")
        with open('/tmp/prod_staff.json', 'r') as f:
            staff = json.load(f)
        
        if staff:
            await db.staff.delete_many({})
            for s in staff:
                s.pop('_id', None)
            await db.staff.insert_many(staff)
            print(f"✓ Imported {len(staff)} staff members")
        
        # Import assets
        print("\nImporting assets...")
        assets = await fetch_all_assets()
        
        if assets:
            await db.assets.delete_many({})
            # Add IDs to assets
            import uuid
            for asset in assets:
                asset['id'] = str(uuid.uuid4())
            await db.assets.insert_many(assets)
            print(f"✓ Imported {len(assets)} assets")
        
        # Fetch and import checklist templates
        print("\nImporting checklist templates...")
        templates_response = requests.get(f"{PROD_URL}/api/checklist-templates")
        
        # The endpoint might return a dict of templates or an error
        # Let's try to get templates by fetching known types
        template_types = [
            "Vehicle Checklist",
            "Forklift JCB Checklist", 
            "Drill Planter Checklist",
            "Sprayer Checklist",
            "Combine Checklist",
            "Daily Check Checklist",
            "Workshop Service Tasks"
        ]
        
        templates_imported = 0
        await db.checklist_templates.delete_many({})
        
        for template_type in template_types:
            try:
                response = requests.get(f"{PROD_URL}/api/checklist-templates/{template_type}")
                if response.status_code == 200:
                    template_items = response.json()
                    if template_items:
                        template_doc = {
                            "id": str(uuid.uuid4()),
                            "name": template_type,
                            "items": template_items
                        }
                        await db.checklist_templates.insert_one(template_doc)
                        templates_imported += 1
                        print(f"  ✓ Imported template: {template_type} ({len(template_items)} items)")
            except Exception as e:
                print(f"  ⚠ Could not import {template_type}: {e}")
        
        print(f"✓ Imported {templates_imported} checklist templates")
        
        # Summary
        print("\n" + "="*60)
        print("IMPORT SUMMARY")
        print("="*60)
        checklist_count = await db.checklists.count_documents({})
        staff_count = await db.staff.count_documents({})
        asset_count = await db.assets.count_documents({})
        template_count = await db.checklist_templates.count_documents({})
        
        print(f"✓ Checklists: {checklist_count}")
        print(f"✓ Staff: {staff_count}")
        print(f"✓ Assets: {asset_count}")
        print(f"✓ Templates: {template_count}")
        print("="*60)
        
    except Exception as e:
        print(f"\n✗ Error during import: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(import_data())
