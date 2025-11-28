#!/usr/bin/env python3
"""Add MongoDB indexes for performance optimization"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "abrey_checks"

async def add_indexes():
    """Add indexes to improve query performance"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        print("Adding MongoDB indexes for performance optimization...")
        
        # Index on completed_at for date-based queries (descending for recent first)
        await db.checklists.create_index([("completed_at", -1)])
        print("✓ Created index on 'completed_at' (descending)")
        
        # Index on check_type for filtering
        await db.checklists.create_index([("check_type", 1)])
        print("✓ Created index on 'check_type'")
        
        # Compound index for dashboard queries (check_type + completed_at)
        await db.checklists.create_index([("check_type", 1), ("completed_at", -1)])
        print("✓ Created compound index on 'check_type' + 'completed_at'")
        
        # Index on machine_make for filtering
        await db.checklists.create_index([("machine_make", 1)])
        print("✓ Created index on 'machine_make'")
        
        # Index on employee_number for user-specific queries
        await db.checklists.create_index([("employee_number", 1)])
        print("✓ Created index on 'employee_number'")
        
        # Index on id for quick lookups
        await db.checklists.create_index([("id", 1)], unique=True)
        print("✓ Created unique index on 'id'")
        
        # Indexes for staff collection
        await db.staff.create_index([("employee_number", 1)], unique=True, sparse=True)
        print("✓ Created index on staff 'employee_number'")
        
        # Indexes for assets collection
        await db.assets.create_index([("make", 1)])
        print("✓ Created index on assets 'make'")
        
        await db.assets.create_index([("make", 1), ("name", 1)])
        print("✓ Created compound index on assets 'make' + 'name'")
        
        # Index for repair_status lookups
        await db.repair_status.create_index([("repair_id", 1)], unique=True)
        print("✓ Created unique index on repair_status 'repair_id'")
        
        print("\n" + "="*60)
        print("All indexes created successfully!")
        print("="*60)
        
        # Show all indexes
        print("\nIndexes on checklists collection:")
        indexes = await db.checklists.list_indexes().to_list(length=None)
        for idx in indexes:
            print(f"  - {idx['name']}: {idx.get('key', {})}")
            
    except Exception as e:
        print(f"\n✗ Error creating indexes: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(add_indexes())
