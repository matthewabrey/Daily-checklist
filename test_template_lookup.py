#!/usr/bin/env python3
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def test_lookup():
    # MongoDB setup
    MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    DB_NAME = os.environ.get("DB_NAME", "test_database")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Test different search patterns
    test_types = [
        "Forklift/JCB",
        "Drill/Planter", 
        "Vehicle",
        "Grader"
    ]
    
    for check_type in test_types:
        template = await db.checklist_templates.find_one({"check_type": check_type})
        if template:
            item_count = len(template.get('items', []))
            print(f"✅ Found '{check_type}': {item_count} items")
        else:
            print(f"❌ Not found: '{check_type}'")
            
        # Also try to find partial matches
        templates = await db.checklist_templates.find({"check_type": {"$regex": check_type.replace("/", ".*"), "$options": "i"}}).to_list(length=10)
        if templates:
            for t in templates:
                print(f"   Similar: '{t.get('check_type')}'")

if __name__ == "__main__":
    asyncio.run(test_lookup())