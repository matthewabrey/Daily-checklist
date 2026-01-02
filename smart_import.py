#!/usr/bin/env python3
"""
Smart import - tries to get data from old production or uses local export
"""
import asyncio
import json
import os
import requests
from motor.motor_asyncio import AsyncIOMotorClient

# Try to get MongoDB URL from environment (what Emergent sets)
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'checklist_capture_db')

OLD_PRODUCTION = "https://checklist-capture.emergent.host"
EXPORT_DIR = "/app/data_export"

async def fetch_from_old_production():
    """Try to fetch data from old production API"""
    print("Attempting to fetch data from old production...")
    
    data = {}
    
    try:
        # Try to get checklists
        response = requests.get(f"{OLD_PRODUCTION}/api/checklists?limit=0", timeout=30)
        if response.status_code == 200:
            data['checklists'] = response.json()
            print(f"  ✓ Fetched {len(data['checklists'])} checklists from old production")
        
        # Try to get assets
        response = requests.get(f"{OLD_PRODUCTION}/api/assets/makes", timeout=30)
        if response.status_code == 200:
            makes = response.json()
            assets = []
            for make in makes:
                names_resp = requests.get(f"{OLD_PRODUCTION}/api/assets/names/{make}")
                if names_resp.status_code == 200:
                    for name in names_resp.json():
                        checktype_resp = requests.get(f"{OLD_PRODUCTION}/api/assets/checktype/{make}/{name}")
                        if checktype_resp.status_code == 200:
                            ct_data = checktype_resp.json()
                            assets.append({
                                "make": make,
                                "name": name,
                                "check_type": ct_data.get("check_type")
                            })
            if assets:
                data['assets'] = assets
                print(f"  ✓ Fetched {len(assets)} assets from old production")
        
        # Try to get staff
        response = requests.get(f"{OLD_PRODUCTION}/api/staff", timeout=30)
        if response.status_code == 200:
            data['staff'] = response.json()
            print(f"  ✓ Fetched {len(data['staff'])} staff from old production")
        
        return data if data else None
        
    except Exception as e:
        print(f"  ✗ Could not fetch from old production: {e}")
        return None

def load_from_export_files():
    """Load data from local export files"""
    print("Loading data from export files...")
    
    data = {}
    
    files = ['checklists', 'assets', 'staff', 'repair_status', 'checklist_templates']
    
    for filename in files:
        filepath = f"{EXPORT_DIR}/{filename}.json"
        try:
            with open(filepath, 'r') as f:
                data[filename] = json.load(f)
                print(f"  ✓ Loaded {len(data[filename])} {filename} from file")
        except FileNotFoundError:
            print(f"  ⚠ File not found: {filepath}")
        except Exception as e:
            print(f"  ✗ Error loading {filename}: {e}")
    
    return data if data else None

async def import_data_to_current_db(data):
    """Import data into current database"""
    print(f"\nConnecting to database...")
    print(f"  MongoDB URL: {MONGO_URL[:50]}...")
    print(f"  Database: {DB_NAME}")
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Test connection
        await client.admin.command('ping')
        print("  ✓ Connected successfully\n")
        
        total_imported = 0
        
        # Import each collection
        for collection_name, documents in data.items():
            if not documents:
                continue
                
            print(f"Importing {collection_name}...")
            
            # Add IDs if missing
            import uuid
            for doc in documents:
                if 'id' not in doc and collection_name in ['assets', 'staff']:
                    doc['id'] = str(uuid.uuid4())
                doc.pop('_id', None)  # Remove MongoDB _id
            
            # Clear and insert
            await db[collection_name].delete_many({})
            if documents:
                await db[collection_name].insert_many(documents)
            
            print(f"  ✓ Imported {len(documents)} documents")
            total_imported += len(documents)
        
        # Create indexes
        print("\nCreating performance indexes...")
        await db.checklists.create_index([("completed_at", -1)])
        await db.checklists.create_index([("check_type", 1)])
        await db.checklists.create_index([("id", 1)], unique=True)
        await db.assets.create_index([("make", 1)])
        await db.assets.create_index([("id", 1)], unique=True)
        await db.staff.create_index([("employee_number", 1)], unique=True, sparse=True)
        print("  ✓ Indexes created")
        
        print(f"\n{'='*60}")
        print(f"SUCCESS! Imported {total_imported} total documents")
        print(f"{'='*60}\n")
        
        return True
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        client.close()

async def main():
    print("="*60)
    print("SMART DATA IMPORT")
    print("="*60)
    print()
    
    # Try fetching from old production first
    data = await fetch_from_old_production()
    
    # If that fails, use local export files
    if not data:
        print("\nOld production not accessible, using local export files...")
        data = load_from_export_files()
    
    if not data:
        print("\n✗ No data source available!")
        print("Make sure export files exist in /app/data_export/")
        return
    
    # Import to current database
    success = await import_data_to_current_db(data)
    
    if success:
        print("✓ Your data is now in the current database!")
        print("✓ Refresh your app to see the data")
    else:
        print("✗ Import failed - please check errors above")

if __name__ == "__main__":
    asyncio.run(main())
