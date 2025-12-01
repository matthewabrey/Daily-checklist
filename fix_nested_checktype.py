#!/usr/bin/env python3
"""Fix nested check_type fields in assets collection"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "abrey_checks"

async def fix_check_types():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        print("Fixing nested check_type fields...")
        
        # Find all assets with nested check_type
        assets = await db.assets.find({}).to_list(length=None)
        
        fixed_count = 0
        for asset in assets:
            check_type = asset.get('check_type')
            
            # Check if check_type is a nested object
            if isinstance(check_type, dict) and 'check_type' in check_type:
                print(f"Fixing asset: {asset.get('make')} - {asset.get('name')}")
                print(f"  Before: {check_type}")
                
                # Flatten the check_type
                flattened = check_type['check_type']
                
                # Update in database
                await db.assets.update_one(
                    {"_id": asset['_id']},
                    {"$set": {"check_type": flattened}}
                )
                
                print(f"  After: {flattened}")
                fixed_count += 1
        
        print(f"\n✓ Fixed {fixed_count} assets with nested check_type")
        
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(fix_check_types())
