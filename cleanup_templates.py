#!/usr/bin/env python3
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def cleanup_templates():
    # MongoDB setup
    MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    DB_NAME = os.environ.get("DB_NAME", "test_database")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Remove old templates (ones without "Checklist" in the name)
    old_templates = [
        "Forklift/JCB",
        "Drill/Planter", 
        "Vehicle",
        "Grader",
        "Harvester",
        "Irrigator",
        "Trailed Implement"
    ]
    
    print("🧹 Cleaning up old templates...")
    for template_name in old_templates:
        result = await db.checklist_templates.delete_many({"check_type": template_name})
        if result.deleted_count > 0:
            print(f"  ✅ Removed {result.deleted_count} old '{template_name}' template(s)")
    
    # Show remaining templates
    print("\n📋 Remaining Templates:")
    templates = await db.checklist_templates.find({}).to_list(length=None)
    for template in templates:
        check_type = template.get('check_type', 'Unknown')
        item_count = len(template.get('items', []))
        print(f"  - {check_type}: {item_count} items")
    
    print(f"\nTotal templates: {len(templates)}")

if __name__ == "__main__":
    asyncio.run(cleanup_templates())