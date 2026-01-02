#!/usr/bin/env python3
"""
Import data into production Atlas MongoDB
Usage: python import_to_production.py <mongodb_atlas_url>
"""
import asyncio
import json
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

EXPORT_DIR = "/app/data_export"

async def import_collection(db, collection_name):
    """Import a single collection from JSON"""
    filename = f"{EXPORT_DIR}/{collection_name}.json"
    
    try:
        print(f"Importing {collection_name}...")
        
        with open(filename, 'r') as f:
            documents = json.load(f)
        
        if not documents:
            print(f"  ⚠ No documents to import for {collection_name}")
            return 0
        
        # Convert ISO datetime strings back to datetime objects
        for doc in documents:
            for key, value in doc.items():
                if isinstance(value, str) and 'T' in value and ('Z' in value or '+' in value):
                    try:
                        doc[key] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    except:
                        pass  # Keep as string if conversion fails
        
        # Drop existing collection and insert all documents
        await db[collection_name].delete_many({})
        await db[collection_name].insert_many(documents)
        
        print(f"  ✓ Imported {len(documents)} documents")
        return len(documents)
        
    except FileNotFoundError:
        print(f"  ⚠ File not found: {filename}")
        return 0
    except Exception as e:
        print(f"  ✗ Error importing {collection_name}: {e}")
        return 0

async def create_indexes(db):
    """Create all necessary indexes for performance"""
    print("\nCreating indexes...")
    
    try:
        # Checklists indexes
        await db.checklists.create_index([("completed_at", -1)])
        await db.checklists.create_index([("check_type", 1)])
        await db.checklists.create_index([("check_type", 1), ("completed_at", -1)])
        await db.checklists.create_index([("machine_make", 1)])
        await db.checklists.create_index([("employee_number", 1)])
        await db.checklists.create_index([("id", 1)], unique=True)
        await db.checklists.create_index([("checklist_items.status", 1)])
        
        # Staff indexes
        await db.staff.create_index([("employee_number", 1)], unique=True, sparse=True)
        
        # Assets indexes
        await db.assets.create_index([("make", 1)])
        await db.assets.create_index([("make", 1), ("name", 1)])
        await db.assets.create_index([("id", 1)], unique=True)
        
        # Repair status indexes
        await db.repair_status.create_index([("repair_id", 1)], unique=True)
        
        print("  ✓ All indexes created")
        
    except Exception as e:
        print(f"  ⚠ Error creating indexes: {e}")

async def import_all_data(mongo_url, db_name):
    """Import all collections"""
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        print("="*60)
        print("PRODUCTION DATA IMPORT STARTING")
        print("="*60)
        print(f"MongoDB URL: {mongo_url[:50]}...")
        print(f"Database: {db_name}")
        print()
        
        # Test connection
        await client.admin.command('ping')
        print("✓ Successfully connected to MongoDB\n")
        
        # Import collections in order
        collections = ['staff', 'assets', 'checklist_templates', 'checklists', 'repair_status']
        
        total_docs = 0
        for collection in collections:
            count = await import_collection(db, collection)
            total_docs += count
        
        # Create indexes
        await create_indexes(db)
        
        print()
        print("="*60)
        print(f"IMPORT COMPLETE - {total_docs} total documents imported")
        print("="*60)
        print("\n✓ Production database is ready!")
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_to_production.py <mongodb_atlas_url> [db_name]")
        print("\nExample:")
        print("  python import_to_production.py 'mongodb+srv://user:pass@cluster.mongodb.net' checklist_capture_db")
        sys.exit(1)
    
    mongo_url = sys.argv[1]
    db_name = sys.argv[2] if len(sys.argv) > 2 else "checklist_capture_db"
    
    asyncio.run(import_all_data(mongo_url, db_name))
