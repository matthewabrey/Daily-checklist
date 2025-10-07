#!/usr/bin/env python3
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def debug_cat_assets():
    # MongoDB setup
    MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    DB_NAME = os.environ.get("DB_NAME", "test_database")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Find all Cat assets
    cat_assets = await db.assets.find({"make": "Cat"}).to_list(length=None)
    
    print("🔍 Cat Assets Analysis:")
    for asset in cat_assets:
        check_type = asset.get('check_type', 'NO CHECK TYPE')
        name = asset.get('name', 'NO NAME')
        make = asset.get('make', 'NO MAKE')
        print(f"  - Make: {make}")
        print(f"    Name: {name}")
        print(f"    Check Type: {check_type}")
        print()
    
    # Check available templates
    print("📋 Available Templates:")
    templates = await db.checklist_templates.find({}).to_list(length=None)
    for template in templates:
        check_type = template.get('check_type', 'Unknown')
        item_count = len(template.get('items', []))
        print(f"  - {check_type}: {item_count} items")
    
    print(f"\nTotal Cat assets: {len(cat_assets)}")
    print(f"Total templates: {len(templates)}")

if __name__ == "__main__":
    asyncio.run(debug_cat_assets())