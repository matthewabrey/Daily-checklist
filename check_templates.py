#!/usr/bin/env python3
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def check_templates():
    # MongoDB setup
    MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    DB_NAME = os.environ.get("DB_NAME", "test_database")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get all templates
    templates = await db.checklist_templates.find({}, {"_id": 0}).to_list(length=None)
    
    print("📋 Available Checklist Templates:")
    for template in templates:
        check_type = template.get('check_type', 'Unknown')
        item_count = len(template.get('items', []))
        print(f"  - {check_type}: {item_count} items")
        
    print(f"\nTotal: {len(templates)} templates")

if __name__ == "__main__":
    asyncio.run(check_templates())