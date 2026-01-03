from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
import os
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
from bson import ObjectId
from dotenv import load_dotenv
from sharepoint_integration import sharepoint_integration

# Load environment variables
load_dotenv()

app = FastAPI(title="Machine Checklist API")

# CORS setup
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB setup
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Collections
# db.checklists - checklist records
# db.assets - machine/asset data
# db.staff - staff data
# db.repair_status - tracks acknowledged/completed status of repairs (NEW)

# Pydantic models
class Asset(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    check_type: str
    name: str  # Name of Implement
    make: str
    
class Staff(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_number: Optional[str] = None
    name: str
    active: bool = True
    workshop_control: Optional[str] = None  # "yes" or "no" from Workshop Control column
    admin_control: Optional[str] = None  # "yes" or "no" from Admin Control column
    
class ChecklistItem(BaseModel):
    item: str
    status: str = "unchecked"  # "unchecked", "satisfactory", "unsatisfactory"
    notes: Optional[str] = None
    photos: Optional[List[dict]] = []
    
class ChecklistTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    check_type: str  # "daily_check", "grader_startup", "workshop_service"
    items: List[str]
    
class Checklist(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_number: str
    staff_name: str
    machine_make: str
    machine_model: str
    check_type: str  # "daily_check", "grader_startup", or "workshop_service"
    checklist_items: List[ChecklistItem] = []
    workshop_notes: Optional[str] = None
    workshop_photos: Optional[List[dict]] = []
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "completed"
    
class ChecklistResponse(BaseModel):
    id: str
    employee_number: Optional[str] = None
    staff_name: str
    machine_make: str
    machine_model: str
    check_type: str
    checklist_items: List[ChecklistItem]
    workshop_notes: Optional[str] = None
    workshop_photos: Optional[List[dict]] = []
    completed_at: datetime
    status: str

# Initialize data
async def initialize_data():
    # Check if data already exists
    asset_count = await db.assets.count_documents({})
    staff_count = await db.staff.count_documents({})
    
    # Skip asset initialization - assets should be uploaded via Admin Panel
    # using AssetList.xlsx with proper format (Check Type | Name | Make)
    if asset_count == 0:
        print("No assets found. Please upload AssetList.xlsx via Admin Panel.")
    
    if staff_count == 0:
        # Staff data from Excel
        staff_names = [
            "Abbie Nixon", "Adrian-Stefan Iovu", "Alan Day", "Andrew Rose", "Andy Browning",
            "Angele Ganitauskiene", "Angele Samuliene", "Armen Saakov", "Audrius Ambramavicius",
            "Biser Aleksiev", "Biser Borisov", "Bonnie Oakley", "Caitlin Barnes",
            "Christopher Marsh", "Clive Bowman", "Cristinel Susma", "Dimitar Boev",
            "Dumitru Verdes", "Edis Daud", "Florin Iovu", "Gary Harrowing",
            "Gheorghe Caraman", "Gina Caraman", "Ginka Koleva", "Hayden Bennett",
            "Hazel Cassinelli", "Hristo Samardzhiev", "Ion Dascal", "Iurii Cujba",
            "Jake Murfitt", "James Butler", "James Rogerson", "Jerry Langridge",
            "Jon Pearson", "Julian Ingleson", "Kasim Yusein", "Kieran Button",
            "Kieran Rushbrook", "Kostadin Stoyanov", "Lilyana Babakova", "Lina Barkauskyte",
            "Maclafan Mugova", "Marcus Patience", "Mark Belton", "Mike Cameron",
            "Milka Nankova", "Nilyay Yovu-Saami", "Nurten Yusein", "Paul Churchyard",
            "Paul Dye", "Rafal Trela", "Razvan Laszlo", "Rhys Le-Gallez",
            "Richard Stennett", "Robert Northwood", "Samuel Watkins", "Shevked Halibryam",
            "Simon Denton", "Stephen Tortice", "Stoyan Stoyanov", "Stuart Hatch",
            "Tamas Kishajdu", "Tanta Laszlo", "Terry Davidson", "Tomas Urbutis",
            "Tommy Kefford", "Victoria Dascal", "Violeta Stoyanova", "Zander Britton"
        ]
        
        for staff_name in staff_names:
            staff = Staff(name=staff_name)
            staff_dict = staff.dict()
            await db.staff.insert_one(staff_dict)
            
        # Add admin employee 
        admin_staff = Staff(employee_number="4444", name="Admin User", admin_control="yes")
        admin_dict = admin_staff.dict()
        await db.staff.insert_one(admin_dict)

@app.on_event("startup")
async def startup_event():
    await initialize_data()
    await migrate_existing_checklists()

async def migrate_existing_checklists():
    """Add check_type field to existing checklists that don't have it"""
    try:
        # Find checklists without check_type field
        checklists_to_update = await db.checklists.find({"check_type": {"$exists": False}}).to_list(length=None)
        
        if checklists_to_update:
            print(f"Migrating {len(checklists_to_update)} existing checklists...")
            
            # Update each checklist to add check_type as "daily_check" (assuming old records were daily checks)
            for checklist in checklists_to_update:
                # Convert old "checked" boolean to new "status" format
                if checklist.get('checklist_items'):
                    for item in checklist['checklist_items']:
                        if 'checked' in item and 'status' not in item:
                            item['status'] = 'satisfactory' if item['checked'] else 'unchecked'
                            item.pop('checked', None)  # Remove old field
                
                await db.checklists.update_one(
                    {"_id": checklist["_id"]}, 
                    {"$set": {
                        "check_type": "daily_check",
                        "workshop_notes": None,
                        "checklist_items": checklist.get('checklist_items', [])
                    }}
                )
            print(f"Successfully migrated {len(checklists_to_update)} checklists")
    except Exception as e:
        print(f"Migration error: {e}")

# API Routes
@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

class EmployeeLoginRequest(BaseModel):
    employee_number: str

@app.post("/api/auth/employee-login")
async def employee_login(request: EmployeeLoginRequest):
    """Authenticate employee by number"""
    try:
        # Find employee by number
        employee = await db.staff.find_one({
            "employee_number": request.employee_number,
            "active": True
        }, {"_id": 0})
        
        print(f"[DEBUG] employee_login: Looking up {request.employee_number}")
        print(f"[DEBUG] employee_login: Found employee: {employee}")
        
        if employee:
            result = {
                "success": True,
                "employee": {
                    "employee_number": employee["employee_number"],
                    "name": employee["name"],
                    "workshop_control": employee.get("workshop_control", None),
                    "admin_control": employee.get("admin_control", None)
                }
            }
            print(f"[DEBUG] employee_login: Returning: {result}")
            return result
        else:
            raise HTTPException(status_code=401, detail="Invalid employee number or account inactive")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Login failed: {str(e)}")

@app.get("/api/auth/validate/{employee_number}")
async def validate_employee(employee_number: str):
    """Validate if employee number is active"""
    try:
        employee = await db.staff.find_one({
            "employee_number": employee_number,
            "active": True
        }, {"_id": 0})
        
        if employee:
            return {
                "valid": True, 
                "name": employee["name"],
                "workshop_control": employee.get("workshop_control", None),
                "admin_control": employee.get("admin_control", None)
            }
        else:
            return {"valid": False}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Validation failed: {str(e)}")

@app.get("/api/debug/check-admin")
async def debug_check_admin():
    """Debug endpoint to check admin account workshop_control - REMOVE IN PRODUCTION"""
    try:
        admin = await db.staff.find_one({"employee_number": "4444"}, {"_id": 0})
        db_name = os.environ.get("DB_NAME", "not_set")
        return {
            "db_name": db_name,
            "admin_found": admin is not None,
            "admin_data": admin if admin else None,
            "code_version": "2024-11-11-v3-navigation-buttons"
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/admin/deactivate-employee/{employee_number}")
async def deactivate_employee(employee_number: str):
    """Deactivate employee (block access)"""
    try:
        result = await db.staff.update_one(
            {"employee_number": employee_number},
            {"$set": {"active": False}}
        )
        
        if result.modified_count > 0:
            return {"message": f"Employee {employee_number} deactivated successfully"}
        else:
            raise HTTPException(status_code=404, detail="Employee not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to deactivate employee: {str(e)}")

@app.post("/api/admin/activate-employee/{employee_number}")
async def activate_employee(employee_number: str):
    """Reactivate employee"""
    try:
        result = await db.staff.update_one(
            {"employee_number": employee_number},
            {"$set": {"active": True}}
        )
        
        if result.modified_count > 0:
            return {"message": f"Employee {employee_number} activated successfully"}
        else:
            raise HTTPException(status_code=404, detail="Employee not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to activate employee: {str(e)}")

@app.post("/api/admin/grant-admin/{employee_number}")
async def grant_admin_access(employee_number: str):
    """Grant admin and workshop control to an employee"""
    try:
        # Update ALL documents with this employee number
        result = await db.staff.update_many(
            {"employee_number": employee_number},
            {"$set": {"admin_control": "yes", "workshop_control": "yes"}}
        )
        
        if result.modified_count > 0:
            return {"message": f"Admin access granted to {employee_number}", "modified": result.modified_count}
        else:
            raise HTTPException(status_code=404, detail="Employee not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to grant admin access: {str(e)}")

@app.get("/api/admin/employee-activity")
async def get_employee_activity():
    """Get employee usage statistics"""
    try:
        # Get all checklists with employee info
        checklists = await db.checklists.find({}, {"_id": 0}).to_list(length=None)
        
        # Count activity by employee
        activity = {}
        for checklist in checklists:
            emp_num = checklist.get('employee_number', 'Unknown')
            if emp_num not in activity:
                activity[emp_num] = {
                    "employee_number": emp_num,
                    "staff_name": checklist.get('staff_name', 'Unknown'),
                    "total_checks": 0,
                    "last_activity": None
                }
            
            activity[emp_num]["total_checks"] += 1
            
            # Update last activity
            completed_at = checklist.get('completed_at')
            if completed_at and (not activity[emp_num]["last_activity"] or completed_at > activity[emp_num]["last_activity"]):
                activity[emp_num]["last_activity"] = completed_at
        
        return list(activity.values())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get employee activity: {str(e)}")

@app.get("/api/staff", response_model=List[Staff])
async def get_staff():
    staff_list = await db.staff.find({}, {"_id": 0}).to_list(length=None)
    return staff_list

@app.get("/api/assets/makes", response_model=List[str])
async def get_makes():
    makes = await db.assets.distinct("make")
    return sorted(makes)

@app.get("/api/assets/names/{make}", response_model=List[str])
async def get_names_by_make(make: str):
    names = await db.assets.distinct("name", {"make": make})
    return sorted(names)

@app.get("/api/assets/checktype/{make}/{name:path}")
async def get_checktype_by_make_and_name(make: str, name: str):
    asset = await db.assets.find_one({"make": make, "name": name}, {"_id": 0})
    if asset:
        check_type = asset["check_type"]
        # Handle nested check_type objects (from old data format)
        if isinstance(check_type, dict) and "check_type" in check_type:
            check_type = check_type["check_type"]
        return {"check_type": check_type}
    else:
        raise HTTPException(status_code=404, detail="Asset not found")

@app.get("/api/assets", response_model=List[Asset])
async def get_all_assets():
    assets = await db.assets.find({}, {"_id": 0}).to_list(length=None)
    return assets

@app.post("/api/checklists", response_model=ChecklistResponse)
async def create_checklist(checklist: Checklist):
    checklist_dict = checklist.dict()
    checklist_dict['completed_at'] = checklist_dict['completed_at'].isoformat()
    await db.checklists.insert_one(checklist_dict)
    return ChecklistResponse(**checklist.dict())

@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    """Optimized endpoint for dashboard statistics - ALL records"""
    from datetime import datetime, timedelta
    
    # Get today's date and 7 days ago
    now = datetime.now()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    seven_days_ago = today - timedelta(days=7)
    seven_days_ago_str = seven_days_ago.isoformat()
    
    # Use 90 days for repair tracking to limit data loaded
    ninety_days_ago = today - timedelta(days=90)
    ninety_days_ago_str = ninety_days_ago.isoformat()
    
    # Total checks completed - ALL TIME (only actual equipment checks, not repairs or machine additions)
    total_completed = await db.checklists.count_documents({
        "check_type": {"$in": ["daily_check", "grader_startup", "workshop_service"]}
    })
    
    # Today's checks by type - limited to today only (small result set)
    today_str = today.date().isoformat()
    today_checklists = await db.checklists.find({
        "completed_at": {"$regex": f"^{today_str}"},
        "check_type": {"$nin": ["GENERAL REPAIR"]}
    }, {"_id": 0, "check_type": 1, "machine_make": 1}).to_list(length=100)  # Max 100 per day
    
    # Group today's checks by type
    today_by_type = {}
    for checklist in today_checklists:
        check_type = checklist.get('check_type', '')
        machine_make = checklist.get('machine_make', '').lower()
        
        if check_type in ['daily_check', 'grader_startup']:
            if 'cat' in machine_make:
                type_name = 'Mounted machines'
            elif 'john deere' in machine_make:
                type_name = 'Vehicles'
            else:
                type_name = 'Other equipment'
        elif check_type == 'workshop_service':
            type_name = 'Workshop service'
        elif check_type in ['NEW MACHINE', 'MACHINE ADD']:
            type_name = 'Machine add'
        elif check_type == 'REPAIR COMPLETED':
            type_name = 'Repairs completed'
        else:
            type_name = 'Other'
        
        today_by_type[type_name] = today_by_type.get(type_name, 0) + 1
    
    # Get repair IDs and their status from database - LAST 90 DAYS only for performance
    repair_ids = []
    
    # Count unsatisfactory items - LAST 90 DAYS for performance
    checklists_with_items = await db.checklists.find({
        "checklist_items": {"$exists": True, "$ne": []},
        "completed_at": {"$gte": ninety_days_ago_str}
    }, {"_id": 0, "id": 1, "checklist_items": 1}).to_list(length=5000)  # Limit to 5000
    
    for checklist in checklists_with_items:
        for index, item in enumerate(checklist.get('checklist_items', [])):
            if item.get('status') == 'unsatisfactory':
                repair_ids.append(f"{checklist['id']}-{index}")
    
    # Count GENERAL REPAIR records - LAST 90 DAYS
    general_repairs = await db.checklists.find({
        "check_type": "GENERAL REPAIR",
        "completed_at": {"$gte": ninety_days_ago_str}
    }, {"_id": 0, "id": 1}).to_list(length=2000)  # Limit to 2000
    
    for checklist in general_repairs:
        repair_ids.append(f"{checklist['id']}-general")
    
    # Get status of all repairs from database
    repair_statuses = await db.repair_status.find({
        "repair_id": {"$in": repair_ids}
    }, {"_id": 0, "repair_id": 1, "acknowledged": 1, "completed": 1}).to_list(length=10000)
    
    # Create status lookup
    status_lookup = {s["repair_id"]: s for s in repair_statuses}
    
    # Count new, acknowledged, and completed repairs
    new_repairs_count = 0
    repairs_due_count = 0
    
    for repair_id in repair_ids:
        status = status_lookup.get(repair_id, {})
        is_acknowledged = status.get("acknowledged", False)
        is_completed = status.get("completed", False)
        
        if is_completed:
            continue  # Don't count completed repairs
        elif is_acknowledged:
            repairs_due_count += 1
        else:
            new_repairs_count += 1
    
    # Repairs completed - ALL TIME (just a count, very fast)
    repairs_completed_all_time = await db.checklists.count_documents({
        "check_type": "REPAIR COMPLETED"
    })
    
    # Machine additions pending (LAST 7 DAYS)
    machine_additions_count = await db.checklists.count_documents({
        "check_type": {"$in": ["MACHINE ADD", "NEW MACHINE"]},
        "completed_at": {"$gte": seven_days_ago_str}
    })
    
    # Machine additions - check which are acknowledged - LAST 90 DAYS
    machine_additions_list = await db.checklists.find({
        "check_type": {"$in": ["MACHINE ADD", "NEW MACHINE"]},
        "completed_at": {"$gte": ninety_days_ago_str}
    }, {"_id": 0, "id": 1}).to_list(length=500)  # Limit to 500
    
    machine_ids = [m["id"] for m in machine_additions_list]
    machine_statuses = await db.repair_status.find({
        "repair_id": {"$in": machine_ids}
    }, {"_id": 0, "repair_id": 1, "acknowledged": 1}).to_list(length=500)
    
    machine_status_lookup = {s["repair_id"]: s for s in machine_statuses}
    pending_machine_additions = sum(1 for mid in machine_ids if not machine_status_lookup.get(mid, {}).get("acknowledged", False))
    
    return {
        "total_completed": total_completed,
        "today_by_type": today_by_type,
        "today_total": len(today_checklists),
        "new_repairs": new_repairs_count,
        "repairs_due": repairs_due_count,
        "repairs_completed": repairs_completed_all_time,
        "machine_additions_count": pending_machine_additions
    }

@app.get("/api/checklists", response_model=List[ChecklistResponse])
async def get_checklists(limit: int = None, skip: int = 0, check_type: str = None):
    # Build query filter
    query = {}
    if check_type:
        # Support multiple check types separated by comma
        if ',' in check_type:
            check_types = [ct.strip() for ct in check_type.split(',')]
            query["check_type"] = {"$in": check_types}
        else:
            query["check_type"] = check_type
    
    # Always enforce a maximum limit for safety (prevent memory exhaustion)
    max_limit = 10000
    if limit is None or limit == 0:
        limit = max_limit
    else:
        limit = min(limit, max_limit)
    
    checklists = await db.checklists.find(query, {"_id": 0}).sort("completed_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    print(f"[DEBUG] get_checklists: Found {len(checklists)} checklists from DB (filter: {query})")
    
    # Parse datetime strings back to datetime objects
    for checklist in checklists:
        if isinstance(checklist['completed_at'], str):
            checklist['completed_at'] = datetime.fromisoformat(checklist['completed_at'])
    
    print(f"[DEBUG] get_checklists: Returning {len(checklists)} checklists after datetime parsing")
    return checklists

@app.get("/api/checklists/{checklist_id}", response_model=ChecklistResponse)
async def get_checklist(checklist_id: str):
    checklist = await db.checklists.find_one({"id": checklist_id}, {"_id": 0})
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")
    
    # Parse datetime string back to datetime object
    if isinstance(checklist['completed_at'], str):
        checklist['completed_at'] = datetime.fromisoformat(checklist['completed_at'])
    
    return ChecklistResponse(**checklist)

@app.get("/api/checklists-with-repairs")
async def get_checklists_with_repairs(limit: int = 50, skip: int = 0):
    """Get checklists that have unsatisfactory items OR are GENERAL REPAIR records"""
    # Build query to get checklists with unsatisfactory items or GENERAL REPAIR
    query = {
        "$or": [
            {"check_type": "GENERAL REPAIR"},
            {"checklist_items.status": "unsatisfactory"}
        ]
    }
    
    checklists = await db.checklists.find(query, {"_id": 0}).sort("completed_at", -1).skip(skip).limit(limit).to_list(length=None)
    
    # Parse datetime strings
    for checklist in checklists:
        if isinstance(checklist.get('completed_at'), str):
            checklist['completed_at'] = datetime.fromisoformat(checklist['completed_at'])
    
    return checklists

@app.post("/api/admin/update-staff")
async def update_staff_list(staff_names: List[str]):
    """Update the staff list by replacing all existing staff with new list"""
    try:
        # Clear existing staff except admin (4444)
        await db.staff.delete_many({"employee_number": {"$ne": "4444"}})
        
        # Add new staff
        new_staff = []
        for staff_name in staff_names:
            staff = Staff(name=staff_name.strip())
            new_staff.append(staff.dict())
        
        if new_staff:
            await db.staff.insert_many(new_staff)
        
        return {"message": f"Successfully updated {len(new_staff)} staff members", "count": len(new_staff)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update staff list: {str(e)}")

class AssetUpdate(BaseModel):
    make: str
    model: str

@app.post("/api/admin/update-assets")
async def update_asset_list(assets: List[AssetUpdate]):
    """Update the asset list by replacing all existing assets with new list"""
    try:
        # Clear existing assets
        await db.assets.delete_many({})
        
        # Add new assets
        new_assets = []
        for asset_data in assets:
            asset = Asset(make=asset_data.make.strip(), model=asset_data.model.strip())
            new_assets.append(asset.dict())
        
        if new_assets:
            await db.assets.insert_many(new_assets)
        
        return {"message": f"Successfully updated {len(new_assets)} assets", "count": len(new_assets)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update asset list: {str(e)}")

@app.get("/api/admin/sharepoint/auth-url")
async def get_sharepoint_auth_url():
    """Get SharePoint authentication URL for user login"""
    try:
        auth_url = sharepoint_integration.get_auth_url()
        return {"auth_url": auth_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get auth URL: {str(e)}")

class AuthCallbackRequest(BaseModel):
    auth_code: str

@app.post("/api/admin/sharepoint/callback")
async def sharepoint_auth_callback(request: AuthCallbackRequest):
    """Handle SharePoint authentication callback"""
    try:
        result = sharepoint_integration.acquire_token_by_auth_code(request.auth_code)
        return {"message": "Authentication successful", "user": result.get("account", {})}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Authentication failed: {str(e)}")

@app.get("/api/admin/sharepoint/test")
async def test_sharepoint_connection():
    """Test SharePoint connection and file access"""
    try:
        results = sharepoint_integration.test_connection()
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Connection test failed: {str(e)}")

@app.post("/api/admin/sharepoint/sync-staff")
async def sync_staff_from_sharepoint():
    """Sync staff data from SharePoint Excel file"""
    try:
        # Get staff data from SharePoint
        staff_names = sharepoint_integration.get_staff_data()
        
        if not staff_names:
            raise HTTPException(status_code=400, detail="No staff data found in SharePoint file")
        
        # Clear existing staff except admin (4444)
        await db.staff.delete_many({"employee_number": {"$ne": "4444"}})
        
        # Add new staff from SharePoint
        new_staff = []
        for staff_name in staff_names:
            staff = Staff(name=staff_name.strip())
            new_staff.append(staff.dict())
        
        if new_staff:
            await db.staff.insert_many(new_staff)
        
        return {
            "message": f"Successfully synced {len(new_staff)} staff members from SharePoint",
            "count": len(new_staff),
            "staff_names": staff_names[:10]  # Show first 10 names as preview
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync staff data: {str(e)}")

@app.post("/api/admin/sharepoint/sync-assets")
async def sync_assets_from_sharepoint():
    """Sync asset data from SharePoint Excel file"""
    try:
        # Get asset data from SharePoint
        assets_data = sharepoint_integration.get_asset_data()
        
        if not assets_data:
            raise HTTPException(status_code=400, detail="No asset data found in SharePoint file")
        
        # Clear existing assets
        await db.assets.delete_many({})
        
        # Add new assets from SharePoint
        new_assets = []
        for asset_data in assets_data:
            asset = Asset(make=asset_data['make'], model=asset_data['model'])
            new_assets.append(asset.dict())
        
        if new_assets:
            await db.assets.insert_many(new_assets)
        
        return {
            "message": f"Successfully synced {len(new_assets)} assets from SharePoint",
            "count": len(new_assets),
            "sample_assets": assets_data[:5]  # Show first 5 assets as preview
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync asset data: {str(e)}")

@app.post("/api/admin/upload-staff-file")
async def upload_staff_file(file: UploadFile = File(...)):
    """Upload and process staff with employee numbers from Excel file"""
    try:
        import openpyxl
        from io import BytesIO
        
        # Read file content
        file_content = await file.read()
        
        # Load the Excel file
        workbook = openpyxl.load_workbook(BytesIO(file_content))
        sheet = workbook[workbook.sheetnames[0]]  # Use first sheet, not active
        
        # Get headers and find name/employee number/workshop control/admin control columns
        headers = [str(cell.value).strip().lower() if cell.value else '' for cell in sheet[1]]
        name_col = None
        number_col = None
        workshop_col = None
        admin_col = None
        
        for i, header in enumerate(headers):
            if 'name' in header and 'employee' not in header:
                name_col = i
            elif 'number' in header or 'employee' in header or 'emp' in header:
                number_col = i
            elif 'workshop' in header and 'control' in header:
                workshop_col = i
            elif 'admin' in header and 'control' in header:
                admin_col = i
        
        # Fallback: assume first column is names, second is numbers
        if name_col is None:
            name_col = 0
        if number_col is None and len(headers) > 1:
            number_col = 1
        
        if number_col is None:
            raise HTTPException(status_code=400, detail="Could not find Employee Number column. Please ensure your Excel has both Name and Employee Number columns.")
        
        # Extract staff data
        staff_data = []
        for row in sheet.iter_rows(min_row=2, values_only=True):  # Skip header
            if row and len(row) > max(name_col, number_col):
                name = str(row[name_col]).strip() if row[name_col] else ''
                emp_number = str(row[number_col]).strip() if row[number_col] else ''
                workshop_control = None
                admin_control = None
                
                if workshop_col is not None and len(row) > workshop_col and row[workshop_col]:
                    workshop_control = str(row[workshop_col]).strip().lower()
                
                if admin_col is not None and len(row) > admin_col and row[admin_col]:
                    admin_control = str(row[admin_col]).strip().lower()
                
                if name and emp_number and name.lower() not in ['name', 'staff', 'employee']:
                    staff_data.append({
                        "name": name,
                        "employee_number": emp_number,
                        "active": True,
                        "workshop_control": workshop_control,
                        "admin_control": admin_control
                    })
        
        if not staff_data:
            raise HTTPException(status_code=400, detail="No valid staff data found. Please ensure your Excel has Name and Employee Number columns with data.")
        
        # Update database - preserve admin account (4444)
        await db.staff.delete_many({"employee_number": {"$ne": "4444"}})  # Delete all except admin
        new_staff = [Staff(**data).dict() for data in staff_data]
        await db.staff.insert_many(new_staff)
        
        return {
            "message": f"Successfully uploaded {len(staff_data)} staff members with employee numbers",
            "count": len(staff_data),
            "preview": staff_data[:5]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process staff file: {str(e)}")

@app.post("/api/admin/upload-assets-file") 
async def upload_assets_file(file: UploadFile = File(...)):
    """Upload and process assets from Excel file"""
    try:
        import openpyxl
        from io import BytesIO
        
        # Read file content
        file_content = await file.read()
        
        # Load the Excel file
        workbook = openpyxl.load_workbook(BytesIO(file_content))
        sheet = workbook[workbook.sheetnames[0]]  # Use first sheet, not active
        
        # Get headers and find check_type, name, make columns
        headers = [str(cell.value).strip().lower() if cell.value else '' for cell in sheet[1]]
        check_type_col = None
        name_col = None
        make_col = None
        
        for i, header in enumerate(headers):
            if header == 'check type' or 'checktype' in header:
                check_type_col = i
            elif header == 'namecolumn' or 'name' in header:
                name_col = i
            elif header == 'makecolumn' or 'make' in header:
                make_col = i
        
        if check_type_col is None or name_col is None or make_col is None:
            raise HTTPException(status_code=400, detail="Could not find Check Type, Name of Implement, and Make columns in the file")
        
        # Extract asset data
        assets = []
        for row in sheet.iter_rows(min_row=2, values_only=True):  # Skip header
            if row and len(row) > max(check_type_col, name_col, make_col):
                check_type = str(row[check_type_col]).strip() if row[check_type_col] else ''
                name = str(row[name_col]).strip() if row[name_col] else ''
                make = str(row[make_col]).strip() if row[make_col] else ''
                
                if check_type and name and make:
                    assets.append({
                        "check_type": check_type,
                        "name": name, 
                        "make": make
                    })
        
        if not assets:
            raise HTTPException(status_code=400, detail="No asset data found in the uploaded file")
        
        # Update assets database
        await db.assets.delete_many({})
        new_assets = [Asset(**asset).dict() for asset in assets]
        await db.assets.insert_many(new_assets)
        
        # Process checklist sheets
        checklist_templates = []
        processed_sheets = []
        
        # Get all unique check types from assets
        unique_check_types = set(asset['check_type'] for asset in assets)
        
        # Process each sheet in the workbook
        for sheet_name in workbook.sheetnames:
            sheet = workbook[sheet_name]
            
            # Skip the main asset sheet (first sheet)
            if sheet_name == workbook.sheetnames[0]:
                continue
            
            # Try to match sheet name with check types - improved matching
            matching_check_type = None
            sheet_name_clean = sheet_name.lower().replace('/', '').replace(' ', '').replace('_', '').replace('-', '').replace('checklist', '')
            
            # First try exact matches
            for check_type in unique_check_types:
                check_type_clean = check_type.lower().replace('/', '').replace(' ', '').replace('_', '').replace('-', '').replace('checklist', '')
                if sheet_name_clean == check_type_clean or check_type.lower() == sheet_name.lower():
                    matching_check_type = check_type
                    break
            
            # If no exact match, try partial matches
            if not matching_check_type:
                for check_type in unique_check_types:
                    check_type_clean = check_type.lower().replace('/', '').replace(' ', '').replace('_', '').replace('-', '').replace('checklist', '')
                    if sheet_name_clean in check_type_clean or check_type_clean in sheet_name_clean:
                        matching_check_type = check_type
                        break
            
            # If still no match, use sheet name as check type
            if not matching_check_type:
                matching_check_type = sheet_name
            
            # Extract checklist items from this sheet
            items = []
            for row_num, row in enumerate(sheet.iter_rows(values_only=True), 1):
                if row_num == 1:  # Skip header row
                    continue
                    
                if row and row[0]:  # If first column has content
                    item_text = str(row[0]).strip()
                    # Skip obvious headers or empty items
                    if (item_text and 
                        item_text.lower() not in ['item', 'check', 'description', 'checklist', 'safety'] and
                        len(item_text) > 3):  # Minimum length filter
                        items.append({"item": item_text, "critical": False})
            
            if items:
                template = {
                    "id": str(uuid.uuid4()),
                    "check_type": matching_check_type,
                    "items": items
                }
                checklist_templates.append(template)
                processed_sheets.append(f"{sheet_name} -> {matching_check_type} ({len(items)} items)")
        
        # Update checklist templates in database
        if checklist_templates:
            # Clear ALL existing templates and insert new ones for complete refresh
            await db.checklist_templates.delete_many({})
            
            # Insert new templates
            await db.checklist_templates.insert_many(checklist_templates)
        
        return {
            "message": f"Successfully uploaded {len(assets)} assets and {len(checklist_templates)} checklist templates", 
            "count": len(assets),
            "templates_created": len(checklist_templates),
            "processed_sheets": processed_sheets,
            "preview": assets[:5] if assets else []
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process assets file: {str(e)}")

@app.post("/api/admin/upload-checklist-file/{check_type}")
async def upload_checklist_file(check_type: str, file: UploadFile = File(...)):
    """Upload and process checklist template from Excel file"""
    try:
        import openpyxl
        from io import BytesIO
        
        # Validate check type
        valid_types = ['daily_check', 'grader_startup', 'workshop_service']
        if check_type not in valid_types:
            raise HTTPException(status_code=400, detail=f"Invalid check type. Must be one of: {valid_types}")
        
        # Read file content
        file_content = await file.read()
        
        # Load the Excel file
        workbook = openpyxl.load_workbook(BytesIO(file_content))
        sheet = workbook[workbook.sheetnames[0]]  # Use first sheet, not active
        
        # Get headers and find required columns
        headers = [str(cell.value).strip().lower() if cell.value else '' for cell in sheet[1]]
        item_col = None
        category_col = None
        critical_col = None
        
        for i, header in enumerate(headers):
            if 'item' in header or 'task' in header:
                item_col = i
            elif 'category' in header:
                category_col = i
            elif 'critical' in header or 'common' in header:
                critical_col = i
        
        if item_col is None:
            raise HTTPException(status_code=400, detail="Could not find Item or Task column in the file")
        
        # Extract checklist items
        items = []
        for row in sheet.iter_rows(min_row=2, values_only=True):  # Skip header
            if row and len(row) > item_col and row[item_col]:
                item_text = str(row[item_col]).strip()
                if item_text:
                    items.append(item_text)
        
        if not items:
            raise HTTPException(status_code=400, detail="No checklist items found in the uploaded file")
        
        # Update database
        await db.checklist_templates.delete_many({"check_type": check_type})
        
        template = ChecklistTemplate(
            check_type=check_type,
            items=items
        )
        await db.checklist_templates.insert_one(template.dict())
        
        return {
            "message": f"Successfully uploaded {len(items)} items for {check_type}",
            "count": len(items),
            "check_type": check_type,
            "preview": items[:5]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process checklist file: {str(e)}")

@app.post("/api/admin/sharepoint/sync-checklists")
async def sync_checklists_from_sharepoint():
    """Sync checklist templates from SharePoint Excel files"""
    try:
        results = {}
        
        # Sync each checklist type
        for checklist_type in ['daily_check', 'grader_startup', 'workshop_service']:
            try:
                checklist_data = sharepoint_integration.get_checklist_data(checklist_type)
                
                # Clear existing checklist template for this type
                await db.checklist_templates.delete_many({"check_type": checklist_type})
                
                # Store checklist items with all metadata
                template = {
                    "check_type": checklist_type,
                    "items": checklist_data  # Full item data with photo_required, critical, etc.
                }
                
                await db.checklist_templates.insert_one(template)
                
                results[checklist_type] = {
                    "success": True,
                    "count": len(items),
                    "message": f"Synced {len(items)} items for {checklist_type}"
                }
            except Exception as e:
                results[checklist_type] = {"success": False, "error": str(e)}
        
        # Overall success
        overall_success = all(r.get('success', False) for r in results.values())
        
        return {
            "message": "Checklist sync completed",
            "success": overall_success,
            "results": results
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync checklists: {str(e)}")

@app.get("/api/checklist-templates/{check_type:path}")
async def get_checklist_template(check_type: str):
    """Get checklist template for a specific check type"""
    try:
        template = await db.checklist_templates.find_one({"check_type": check_type}, {"_id": 0})
        if template:
            return template
        else:
            # Return default templates if not found in database
            default_templates = {
                'daily_check': [
                    "Oil level check - Engine oil at correct level",
                    "Fuel level check - Adequate fuel for operation", 
                    "Hydraulic fluid level - Within acceptable range",
                    "Battery condition - Terminals clean, voltage adequate",
                    "Tire/track condition - No visible damage or excessive wear",
                    "Safety guards in place - All protective covers secured",
                    "Emergency stop function - Test emergency stop button",
                    "Warning lights operational - All safety lights working",
                    "Operator seat condition - Seat belt and controls functional",
                    "Air filter condition - Clean and properly sealed",
                    "Cooling system - Radiator clear, coolant level adequate",
                    "Brake system function - Service and parking brakes operational",
                    "Steering operation - Smooth operation, no excessive play",
                    "Lights and signals - All operational lights working",
                    "Fire extinguisher - Present and within service date"
                ],
                'grader_startup': [
                    "Emergency stops working and present - Test all emergency stop buttons",
                    "Walkways clear of debris and gates closed - All access areas safe",
                    "Guards are all in place - All safety guards properly secured",
                    "All personnel accounted for and out of reach of dangers - Safety zone clear",
                    "Oil level check - Engine oil at correct level",
                    "Fuel level check - Adequate fuel for operation",
                    "Hydraulic fluid level - Within acceptable range",
                    "Battery condition - Terminals clean, voltage adequate",
                    "Track/blade condition - No visible damage or excessive wear",
                    "Blade operation - Hydraulic lift and angle functions working",
                    "Warning beacon - Rotating warning light operational",
                    "Backup alarm - Reverse warning signal functional"
                ],
                'workshop_service': []
            }
            
            items = default_templates.get(check_type, [])
            return {
                "check_type": check_type,
                "items": items,
                "source": "default"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get checklist template: {str(e)}")

@app.post("/api/admin/sharepoint/sync-all")
async def sync_all_from_sharepoint():
    """Sync both staff and asset data from SharePoint Excel files"""
    try:
        results = {}
        
        # Sync staff data
        try:
            staff_data = sharepoint_integration.get_staff_data()
            await db.staff.delete_many({"employee_number": {"$ne": "4444"}})
            
            new_staff = []
            for staff_info in staff_data:
                staff = Staff(
                    name=staff_info['name'],
                    employee_number=staff_info['employee_number'],
                    active=True
                )
                new_staff.append(staff.dict())
            
            if new_staff:
                await db.staff.insert_many(new_staff)
            
            results['staff'] = {
                "success": True,
                "count": len(new_staff),
                "message": f"Synced {len(new_staff)} staff members with employee numbers"
            }
        except Exception as e:
            results['staff'] = {"success": False, "error": str(e)}
        
        # Sync asset data
        try:
            assets_data = sharepoint_integration.get_asset_data()
            await db.assets.delete_many({})
            
            new_assets = []
            for asset_data in assets_data:
                asset = Asset(make=asset_data['make'], model=asset_data['model'])
                new_assets.append(asset.dict())
            
            if new_assets:
                await db.assets.insert_many(new_assets)
            
            results['assets'] = {
                "success": True,
                "count": len(new_assets),
                "message": f"Synced {len(new_assets)} assets"
            }
        except Exception as e:
            results['assets'] = {"success": False, "error": str(e)}
        
        # Sync checklist templates
        try:
            checklist_results = {}
            for checklist_type in ['daily_check', 'grader_startup', 'workshop_service']:
                try:
                    checklist_data = sharepoint_integration.get_checklist_data(checklist_type)
                    await db.checklist_templates.delete_many({"check_type": checklist_type})
                    
                    items = [item['item'] for item in checklist_data]
                    template = ChecklistTemplate(check_type=checklist_type, items=items)
                    await db.checklist_templates.insert_one(template.dict())
                    
                    checklist_results[checklist_type] = {
                        "success": True,
                        "count": len(items)
                    }
                except Exception as e:
                    checklist_results[checklist_type] = {"success": False, "error": str(e)}
            
            results['checklists'] = {
                "success": all(r.get('success', False) for r in checklist_results.values()),
                "details": checklist_results,
                "message": "Synced checklist templates"
            }
        except Exception as e:
            results['checklists'] = {"success": False, "error": str(e)}
        
        # Overall success
        overall_success = (results['staff'].get('success', False) and 
                          results['assets'].get('success', False) and
                          results['checklists'].get('success', False))
        
        return {
            "message": "Sync completed",
            "success": overall_success,
            "results": results
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync data: {str(e)}")

@app.get("/api/checklists/export/csv")
async def export_checklists_csv():
    from fastapi.responses import StreamingResponse
    import io
    import csv
    
    checklists = await db.checklists.find({}, {"_id": 0}).sort("completed_at", -1).to_list(length=None)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow(["ID", "Staff Name", "Machine Make", "Machine Model", "Check Type", "Completed At", "Status", "Items Satisfactory", "Items Unsatisfactory", "Items Total", "Notes", "Workshop Details"])
    
    # Write data
    for checklist in checklists:
        if checklist['check_type'] in ['daily_check', 'grader_startup']:
            items_satisfactory = sum(1 for item in checklist['checklist_items'] if item['status'] == 'satisfactory')
            items_unsatisfactory = sum(1 for item in checklist['checklist_items'] if item['status'] == 'unsatisfactory')
            items_total = len(checklist['checklist_items'])
            notes = "; ".join([item['notes'] for item in checklist['checklist_items'] if item.get('notes')])
            workshop_details = ""
        else:
            items_satisfactory = 0
            items_unsatisfactory = 0
            items_total = 0
            notes = ""
            workshop_details = checklist.get('workshop_notes', '')
        
        writer.writerow([
            checklist['id'],
            checklist['staff_name'],
            checklist['machine_make'],
            checklist['machine_model'],
            checklist['check_type'],
            checklist['completed_at'],
            checklist['status'],
            items_satisfactory,
            items_unsatisfactory,
            items_total,
            notes,
            workshop_details
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type='text/csv',
        headers={"Content-Disposition": "attachment; filename=machine_checklists.csv"}
    )

@app.get("/api/checklists/export/excel")
async def export_checklists_excel():
    from fastapi.responses import StreamingResponse
    import io
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    
    checklists = await db.checklists.find({}, {"_id": 0}).sort("completed_at", -1).to_list(length=None)
    
    # Create workbook and worksheet
    wb = Workbook()
    ws = wb.active
    ws.title = "All Checks"
    
    # Write header with formatting
    headers = ["ID", "Staff Name", "Machine Make", "Machine Model", "Check Type", "Completed At", "Status", "Items Satisfactory", "Items Unsatisfactory", "Items Total", "Notes", "Workshop Details"]
    ws.append(headers)
    
    # Format header row
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)
    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = header_font
    
    # Write data
    for checklist in checklists:
        if checklist['check_type'] in ['daily_check', 'grader_startup']:
            items_satisfactory = sum(1 for item in checklist['checklist_items'] if item['status'] == 'satisfactory')
            items_unsatisfactory = sum(1 for item in checklist['checklist_items'] if item['status'] == 'unsatisfactory')
            items_total = len(checklist['checklist_items'])
            notes = "; ".join([item['notes'] for item in checklist['checklist_items'] if item.get('notes')])
            workshop_details = ""
        else:
            items_satisfactory = 0
            items_unsatisfactory = 0
            items_total = 0
            notes = ""
            workshop_details = checklist.get('workshop_notes', '')
        
        ws.append([
            checklist['id'],
            checklist['staff_name'],
            checklist['machine_make'],
            checklist['machine_model'],
            checklist['check_type'],
            str(checklist['completed_at']),
            checklist['status'],
            items_satisfactory,
            items_unsatisfactory,
            items_total,
            notes,
            workshop_details
        ])
    
    # Auto-adjust column widths
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column_letter].width = adjusted_width
    
    # Save to BytesIO
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={"Content-Disposition": "attachment; filename=all_checks.xlsx"}
    )

# Repair Status Management Endpoints
class RepairStatusUpdate(BaseModel):
    repair_id: str
    acknowledged: Optional[bool] = None
    completed: Optional[bool] = None
    progress_notes: Optional[List[dict]] = None

@app.get("/api/repair-status/bulk")
async def get_bulk_repair_status():
    """Get status for all repairs"""
    statuses = await db.repair_status.find({}, {"_id": 0}).to_list(length=None)
    # Return as a dictionary keyed by repair_id for easy lookup
    return {status["repair_id"]: status for status in statuses}

@app.get("/api/repair-status/{repair_id}")
async def get_repair_status(repair_id: str):
    """Get status of a specific repair"""
    status = await db.repair_status.find_one({"repair_id": repair_id}, {"_id": 0})
    if not status:
        return {"repair_id": repair_id, "acknowledged": False, "completed": False, "progress_notes": []}
    return status

@app.post("/api/repair-status/acknowledge")
async def acknowledge_repair(repair_id: str):
    """Mark a repair as acknowledged"""
    await db.repair_status.update_one(
        {"repair_id": repair_id},
        {"$set": {
            "repair_id": repair_id,
            "acknowledged": True,
            "acknowledged_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"success": True, "message": "Repair acknowledged"}

@app.post("/api/repair-status/complete")
async def complete_repair(repair_id: str):
    """Mark a repair as completed"""
    await db.repair_status.update_one(
        {"repair_id": repair_id},
        {"$set": {
            "completed": True,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"success": True, "message": "Repair marked as complete"}

@app.post("/api/repair-status/add-note")
async def add_progress_note(repair_id: str, note_text: str, author: str):
    """Add a progress note to a repair"""
    note = {
        "text": note_text,
        "author": author,
        "date": datetime.now(timezone.utc).isoformat()
    }
    
    await db.repair_status.update_one(
        {"repair_id": repair_id},
        {
            "$push": {"progress_notes": note},
            "$setOnInsert": {"repair_id": repair_id, "acknowledged": False, "completed": False}
        },
        upsert=True
    )
    return {"success": True, "message": "Progress note added", "note": note}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)