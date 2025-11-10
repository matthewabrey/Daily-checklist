#!/usr/bin/env python3
"""
Script to check Workshop Control access for all staff members
Run this to verify which employees can access the Repairs page
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def check_all_workshop_access():
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("=" * 70)
    print("WORKSHOP CONTROL ACCESS CHECK")
    print("=" * 70)
    
    # Get all staff
    staff_list = await db.staff.find({}).to_list(length=None)
    
    if not staff_list:
        print("\n⚠️  No staff members found in database!")
        print("   Please upload staff list in Admin panel first.")
    else:
        print(f"\nTotal Staff Members: {len(staff_list)}\n")
        
        has_access = []
        no_access = []
        
        for staff in staff_list:
            emp_num = staff.get('employee_number', 'N/A')
            name = staff.get('name', 'N/A')
            workshop = staff.get('workshop_control', 'not set')
            active = staff.get('active', False)
            
            if workshop and workshop.lower() == 'yes':
                has_access.append((emp_num, name, active))
            else:
                no_access.append((emp_num, name, workshop, active))
        
        print("✅ EMPLOYEES WITH REPAIRS PAGE ACCESS:")
        print("-" * 70)
        if has_access:
            for emp_num, name, active in has_access:
                status = "Active" if active else "Inactive"
                print(f"   {emp_num:10s} | {name:30s} | {status}")
        else:
            print("   ⚠️  No employees have Workshop Control access!")
            print("   Upload staff list with 'Workshop Control' column set to 'yes'")
        
        print(f"\n❌ EMPLOYEES WITHOUT REPAIRS PAGE ACCESS:")
        print("-" * 70)
        if no_access:
            for emp_num, name, workshop, active in no_access:
                status = "Active" if active else "Inactive"
                ws_status = workshop if workshop else "not set"
                print(f"   {emp_num:10s} | {name:30s} | WS: {ws_status:10s} | {status}")
        else:
            print("   All employees have access!")
    
    print("\n" + "=" * 70)
    print("NOTE: To grant Repairs page access, upload staff Excel with")
    print("      'Workshop Control' column containing 'yes' for each employee")
    print("=" * 70)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_all_workshop_access())
