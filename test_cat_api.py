#!/usr/bin/env python3
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def test_cat_api():
    # MongoDB setup
    MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    DB_NAME = os.environ.get("DB_NAME", "test_database")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Test the exact lookup that the API should do
    make = "Cat"
    name = "DP30NTD 6m 25214 s/n CT14F04273"
    
    print(f"Looking for: make='{make}', name='{name}'")
    
    asset = await db.assets.find_one({"make": make, "name": name}, {"_id": 0})
    if asset:
        print(f"✅ Found asset:")
        print(f"   Make: {asset.get('make')}")
        print(f"   Name: {asset.get('name')}")
        print(f"   Check Type: {asset.get('check_type')}")
    else:
        print("❌ Asset not found")
        
        # Try to find partial matches
        print("\n🔍 Searching for partial matches...")
        similar = await db.assets.find({"make": make, "name": {"$regex": "DP30NTD.*25214", "$options": "i"}}).to_list(length=5)
        for s in similar:
            print(f"   Similar: '{s.get('name')}'")

if __name__ == "__main__":
    asyncio.run(test_cat_api())