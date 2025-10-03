#!/usr/bin/env python3
import asyncio
import os
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def add_admin_employee():
    # MongoDB setup
    MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    DB_NAME = os.environ.get("DB_NAME", "test_database")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Check if admin already exists
    existing_admin = await db.staff.find_one({"employee_number": "4444"})
    if existing_admin:
        print("Admin employee 4444 already exists!")
        print(f"Name: {existing_admin['name']}")
        return
    
    # Add admin employee
    admin_staff = {
        "id": str(uuid.uuid4()),
        "employee_number": "4444",
        "name": "Admin User",
        "active": True
    }
    
    result = await db.staff.insert_one(admin_staff)
    print(f"✅ Added admin employee 4444 successfully!")
    print(f"ID: {result.inserted_id}")
    
    # Verify it was added
    verify = await db.staff.find_one({"employee_number": "4444"})
    if verify:
        print(f"✅ Verified: Admin employee exists with name '{verify['name']}'")
    else:
        print("❌ Error: Admin employee not found after insertion")

if __name__ == "__main__":
    asyncio.run(add_admin_employee())