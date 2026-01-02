#!/usr/bin/env python3
"""
Export all data from preview MongoDB to JSON files
These can then be imported into production Atlas MongoDB
"""
import asyncio
import json
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "abrey_checks"
EXPORT_DIR = "/app/data_export"

async def export_collection(db, collection_name):
    """Export a single collection to JSON"""
    print(f"Exporting {collection_name}...")
    
    # Get all documents
    cursor = db[collection_name].find({}, {"_id": 0})
    documents = await cursor.to_list(length=None)
    
    # Convert datetime objects to strings
    for doc in documents:
        for key, value in doc.items():
            if isinstance(value, datetime):
                doc[key] = value.isoformat()
    
    # Save to file
    filename = f"{EXPORT_DIR}/{collection_name}.json"
    with open(filename, 'w') as f:
        json.dump(documents, f, indent=2)
    
    print(f"✓ Exported {len(documents)} documents to {filename}")
    return len(documents)

async def export_all_data():
    """Export all collections"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Create export directory
        import os
        os.makedirs(EXPORT_DIR, exist_ok=True)
        
        print("="*60)
        print("DATA EXPORT STARTING")
        print("="*60)
        print()
        
        # Get all collection names
        collections = await db.list_collection_names()
        
        total_docs = 0
        for collection in collections:
            count = await export_collection(db, collection)
            total_docs += count
        
        print()
        print("="*60)
        print(f"EXPORT COMPLETE - {total_docs} total documents")
        print(f"Files saved to: {EXPORT_DIR}")
        print("="*60)
        print()
        print("To import into production:")
        print("1. Copy the JSON files to your production environment")
        print("2. Run the import script with production MongoDB URL")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(export_all_data())
