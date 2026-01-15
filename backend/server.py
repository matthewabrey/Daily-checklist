from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import os
import io
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
from bson import ObjectId
from dotenv import load_dotenv
from sharepoint_integration import sharepoint_integration
from cached_stats import get_cached_stats, invalidate_cache
import qrcode

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

# MongoDB setup with connection pooling and timeouts
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

# Configure MongoDB client with performance settings
client = AsyncIOMotorClient(
    MONGO_URL,
    maxPoolSize=10,  # Connection pool size
    minPoolSize=1,
    maxIdleTimeMS=30000,  # Close idle connections after 30s
    serverSelectionTimeoutMS=5000,  # Fail fast if can't connect
    connectTimeoutMS=10000,  # Connection timeout
    socketTimeoutMS=30000,  # Socket timeout for queries
)
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
    qr_printed: bool = False  # Whether QR code has been printed for this asset
    qr_printed_at: Optional[str] = None  # ISO timestamp when QR was printed
    
class Staff(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_number: Optional[str] = None
    name: str
    active: bool = True
    workshop_control: Optional[str] = None  # "yes" or "no" from Workshop Control column
    admin_control: Optional[str] = None  # "yes" or "no" from Admin Control column
    manager_control: Optional[str] = None  # "yes" or "no" from Manager Control column
    
class ChecklistItem(BaseModel):
    item: str
    status: str = "unchecked"  # "unchecked", "satisfactory", "unsatisfactory", "n/a"
    notes: Optional[str] = None
    photos: Optional[List[dict]] = []
    compulsory: bool = False  # If True, item cannot be marked unsatisfactory when signing off
    
class ChecklistTemplateItem(BaseModel):
    item: str
    compulsory: bool = False

class ChecklistTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    check_type: str  # "daily_check", "grader_startup", "workshop_service"
    items: List[ChecklistTemplateItem]  # Now includes compulsory flag per item
    
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

# Work Progress Tracking Models
class WorkEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    hectares_completed: float
    date_completed: str  # ISO date string
    entered_by: str  # Employee name
    entered_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Job(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "Carrot Drilling"
    total_area: float  # Total hectares
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    status: str = "active"  # "active" or "complete"

class JobCreate(BaseModel):
    name: str
    total_area: float

class WorkEntryCreate(BaseModel):
    hectares_completed: float
    date_completed: Optional[str] = None  # If not provided, use today
    entered_by: str

# Near Miss and Suggestion Models
class NearMiss(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    description: str
    location: Optional[str] = None
    photos: List[str] = []  # Base64 encoded photos
    is_anonymous: bool = False
    submitted_by: Optional[str] = None  # Name if not anonymous
    employee_number: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    acknowledged: bool = False
    acknowledged_at: Optional[str] = None
    acknowledged_by: Optional[str] = None

class NearMissCreate(BaseModel):
    description: str
    location: Optional[str] = None
    photos: List[str] = []
    is_anonymous: bool = False
    submitted_by: Optional[str] = None

class Suggestion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    category: Optional[str] = None  # Financial, Well Being, Health and Safety
    location: Optional[str] = None  # Farm, Field, Storage, Grading
    photos: List[str] = []  # Base64 encoded photos
    is_anonymous: bool = False
    submitted_by: Optional[str] = None
    employee_number: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    status: str = "new"  # new, reviewed, implemented, declined
    reviewed_at: Optional[str] = None
    reviewed_by: Optional[str] = None
    review_notes: Optional[str] = None

class SuggestionCreate(BaseModel):
    title: str
    description: str
    category: Optional[str] = None
    location: Optional[str] = None
    photos: List[str] = []
    is_anonymous: bool = False
    submitted_by: Optional[str] = None

# Accident Models
class Accident(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date_time: str  # When the accident occurred
    location: str  # Farm, Field, Storage, Grading
    description: str  # What happened
    injured_persons: List[str] = []  # Names of injured people
    injury_type: Optional[str] = None  # Cut, Burn, Fracture, Sprain, etc.
    body_parts_affected: Optional[str] = None
    first_aid_given: bool = False
    first_aid_details: Optional[str] = None
    witnesses: List[str] = []
    equipment_involved: Optional[str] = None
    photos: List[str] = []
    actions_taken: Optional[str] = None
    emergency_services_called: bool = False
    reported_by: str
    employee_number: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    status: str = "new"  # new, investigating, closed
    investigation_notes: Optional[str] = None
    investigated_by: Optional[str] = None
    investigated_at: Optional[str] = None

class AccidentCreate(BaseModel):
    date_time: str
    location: str
    description: str
    injured_persons: List[str] = []
    injury_type: Optional[str] = None
    body_parts_affected: Optional[str] = None
    first_aid_given: bool = False
    first_aid_details: Optional[str] = None
    witnesses: List[str] = []
    equipment_involved: Optional[str] = None
    photos: List[str] = []
    actions_taken: Optional[str] = None
    emergency_services_called: bool = False
    reported_by: str

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
        admin_staff = Staff(employee_number="4444", name="Admin User", admin_control="yes", manager_control="yes")
        admin_dict = admin_staff.dict()
        await db.staff.insert_one(admin_dict)

@app.on_event("startup")
async def startup_event():
    await initialize_data()
    await migrate_existing_checklists()
    await ensure_indexes()

async def ensure_indexes():
    """Ensure all required indexes exist for performance"""
    try:
        print("Ensuring database indexes...")
        
        # Checklists indexes - optimized for common queries
        await db.checklists.create_index([("completed_at", -1)])
        await db.checklists.create_index([("check_type", 1)])
        await db.checklists.create_index([("check_type", 1), ("completed_at", -1)])
        await db.checklists.create_index([("machine_make", 1)])
        await db.checklists.create_index([("machine_make", 1), ("completed_at", -1)])  # For by-machine queries
        await db.checklists.create_index([("machine_make", 1), ("machine_model", 1), ("completed_at", -1)])  # Compound index
        await db.checklists.create_index([("employee_number", 1)])
        await db.checklists.create_index([("id", 1)])
        await db.checklists.create_index([("checklist_items.status", 1)])
        
        # Assets indexes
        await db.assets.create_index([("make", 1)])
        await db.assets.create_index([("make", 1), ("name", 1)])
        
        # Staff indexes
        await db.staff.create_index([("employee_number", 1)])
        await db.staff.create_index([("active", 1)])
        
        # Repair status indexes
        await db.repair_status.create_index([("repair_id", 1)])
        await db.repair_status.create_index([("acknowledged", 1)])
        await db.repair_status.create_index([("completed", 1)])
        
        print("Database indexes ensured successfully")
    except Exception as e:
        print(f"Warning: Could not create some indexes: {e}")

async def migrate_existing_checklists():
    """Add check_type field to existing checklists that don't have it"""
    try:
        # Find checklists without check_type field
        checklists_to_update = await db.checklists.find({"check_type": {"$exists": False}}).to_list(length=5000)
        
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

async def cleanup_duplicate_staff():
    """Remove duplicate staff entries, keeping the one with most permissions"""
    try:
        # Find all employee numbers with duplicates
        pipeline = [
            {"$group": {"_id": "$employee_number", "count": {"$sum": 1}, "ids": {"$push": "$id"}}},
            {"$match": {"count": {"$gt": 1}}}
        ]
        duplicates = await db.staff.aggregate(pipeline).to_list(length=100)
        
        for dup in duplicates:
            emp_num = dup["_id"]
            if not emp_num:
                continue
                
            # Get all records for this employee
            records = await db.staff.find({"employee_number": emp_num}).to_list(length=100)
            
            # Keep the one with admin_control='yes' or workshop_control='yes', or the first one
            best_record = None
            for r in records:
                if r.get("admin_control") == "yes" or r.get("workshop_control") == "yes":
                    best_record = r
                    break
            if not best_record:
                best_record = records[0]
            
            # Delete all except the best one
            for r in records:
                if r["_id"] != best_record["_id"]:
                    await db.staff.delete_one({"_id": r["_id"]})
            
            print(f"Cleaned up duplicates for employee {emp_num}")
    except Exception as e:
        print(f"Duplicate cleanup error: {e}")

# API Routes
@app.get("/api/health")
async def health_check():
    """Health check with database connectivity test"""
    try:
        # Quick database ping
        await db.command("ping")
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

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
                    "admin_control": employee.get("admin_control", None),
                    "manager_control": employee.get("manager_control", None)
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
                "admin_control": employee.get("admin_control", None),
                "manager_control": employee.get("manager_control", None)
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
            {"$set": {"admin_control": "yes", "workshop_control": "yes", "manager_control": "yes"}}
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
        # Get recent checklists with employee info (last 90 days for performance)
        ninety_days_ago = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        checklists = await db.checklists.find(
            {"completed_at": {"$gte": ninety_days_ago}}, 
            {"_id": 0, "employee_number": 1, "staff_name": 1, "completed_at": 1}
        ).to_list(length=10000)
        
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
    staff_list = await db.staff.find({}, {"_id": 0}).to_list(length=1000)  # Max 1000 staff
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
    assets = await db.assets.find({}, {"_id": 0}).to_list(length=1000)  # Max 1000 assets
    return assets

@app.get("/api/assets/qr-labels")
async def get_all_qr_labels():
    """Get list of all assets with QR code URLs and print status for printing page"""
    assets = await db.assets.find({}, {"_id": 0}).to_list(length=10000)
    
    # Add QR code URL to each asset and ensure qr_printed field exists
    for asset in assets:
        asset["qr_url"] = f"/api/assets/qr/{asset.get('make', '')}/{asset.get('name', '')}"
        # Ensure qr_printed field exists (for backward compatibility)
        if 'qr_printed' not in asset:
            asset['qr_printed'] = False
        if 'qr_printed_at' not in asset:
            asset['qr_printed_at'] = None
    
    return assets

@app.get("/api/assets/qr/{make}/{name}")
async def get_asset_qr_code(make: str, name: str):
    """Generate QR code for a machine"""
    # Create QR code data
    qr_data = f"MACHINE:{make}:{name}"
    
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)
    
    # Create image
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save to bytes
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    
    return StreamingResponse(img_bytes, media_type="image/png")

@app.get("/api/assets/{asset_id}")
async def get_asset_by_id(asset_id: str):
    """Get a single asset by ID"""
    asset = await db.assets.find_one({"id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset

@app.post("/api/assets/mark-qr-printed")
async def mark_assets_qr_printed(asset_ids: List[str]):
    """Mark multiple assets as having their QR codes printed"""
    timestamp = datetime.now(timezone.utc).isoformat()
    
    result = await db.assets.update_many(
        {"id": {"$in": asset_ids}},
        {"$set": {"qr_printed": True, "qr_printed_at": timestamp}}
    )
    
    return {
        "success": True,
        "modified_count": result.modified_count,
        "timestamp": timestamp
    }

@app.post("/api/assets/reset-qr-status")
async def reset_asset_qr_status(asset_ids: List[str]):
    """Reset QR printed status for specified assets (useful if labels need reprinting)"""
    result = await db.assets.update_many(
        {"id": {"$in": asset_ids}},
        {"$set": {"qr_printed": False, "qr_printed_at": None}}
    )
    
    return {
        "success": True,
        "modified_count": result.modified_count
    }

@app.post("/api/checklists", response_model=ChecklistResponse)
async def create_checklist(checklist: Checklist):
    # Validate compulsory items - if any compulsory item is marked unsatisfactory, reject the checklist
    if checklist.checklist_items:
        failed_compulsory_items = []
        for item in checklist.checklist_items:
            if item.compulsory and item.status == 'unsatisfactory':
                failed_compulsory_items.append(item.item)
        
        if failed_compulsory_items:
            item_list = ", ".join(failed_compulsory_items[:3])  # Show first 3 items
            if len(failed_compulsory_items) > 3:
                item_list += f" and {len(failed_compulsory_items) - 3} more"
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot sign off: Compulsory check(s) failed: {item_list}. Please resolve these issues before completing the checklist."
            )
    
    checklist_dict = checklist.dict()
    checklist_dict['completed_at'] = checklist_dict['completed_at'].isoformat()
    await db.checklists.insert_one(checklist_dict)
    
    # Invalidate dashboard cache so new machine additions show immediately
    await invalidate_cache()
    
    return ChecklistResponse(**checklist.dict())

@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    """ULTRA-FAST cached dashboard stats - returns in <50ms"""
    return await get_cached_stats(db)

@app.get("/api/checklists", response_model=List[ChecklistResponse])
async def get_checklists(limit: int = 100, skip: int = 0, check_type: str = None):
    """Get checklists with pagination - optimized for speed"""
    # Build query filter
    query = {}
    if check_type:
        if ',' in check_type:
            check_types = [ct.strip() for ct in check_type.split(',')]
            query["check_type"] = {"$in": check_types}
        else:
            query["check_type"] = check_type
    
    # Enforce reasonable limits
    limit = min(limit, 500)  # Max 500 at a time
    
    try:
        checklists = await db.checklists.find(query, {"_id": 0}).sort("completed_at", -1).skip(skip).limit(limit).to_list(length=limit)
        
        # Parse datetime strings - simplified
        for checklist in checklists:
            if checklist.get('completed_at') and isinstance(checklist['completed_at'], str):
                try:
                    checklist['completed_at'] = datetime.fromisoformat(checklist['completed_at'].replace('Z', '+00:00'))
                except:
                    pass  # Keep as string if parsing fails
        
        return checklists
    except Exception as e:
        print(f"Error in get_checklists: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/checklists/today")
async def get_todays_checklists():
    """Get today's checklists - fast dedicated endpoint"""
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Use regex to match today's date regardless of time format
    checklists = await db.checklists.find(
        {"completed_at": {"$regex": f"^{today}"}},
        {"_id": 0}
    ).sort("completed_at", -1).to_list(length=100)
    
    # Parse datetime strings
    for checklist in checklists:
        if checklist.get('completed_at') and isinstance(checklist['completed_at'], str):
            try:
                checklist['completed_at'] = datetime.fromisoformat(checklist['completed_at'].replace('Z', '+00:00'))
            except:
                pass
    
    return checklists

@app.get("/api/checklists/by-machine")
async def get_checklists_by_machine(make: str = None, name: str = None, limit: int = 100, skip: int = 0):
    """Get checklists for a specific machine with pagination for better performance"""
    query = {}
    if make:
        query["machine_make"] = make
    if name:
        query["machine_model"] = name
    
    # Use projection to only get needed fields (faster)
    projection = {
        "_id": 0,
        "id": 1,
        "staff_name": 1,
        "machine_make": 1,
        "machine_model": 1,
        "check_type": 1,
        "completed_at": 1,
        "status": 1,
        "items_satisfactory": 1,
        "items_unsatisfactory": 1,
        "items_total": 1,
        "notes_summary": 1
    }
    
    checklists = await db.checklists.find(query, projection).sort("completed_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    # Get total count for pagination info
    total = await db.checklists.count_documents(query)
    
    return {
        "checklists": checklists,
        "total": total,
        "limit": limit,
        "skip": skip,
        "has_more": skip + len(checklists) < total
    }

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
    
    checklists = await db.checklists.find(query, {"_id": 0}).sort("completed_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
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
        
        # Get headers and find name/employee number/workshop control/admin control/manager control columns
        headers = [str(cell.value).strip().lower() if cell.value else '' for cell in sheet[1]]
        name_col = None
        number_col = None
        workshop_col = None
        admin_col = None
        manager_col = None
        
        for i, header in enumerate(headers):
            if 'name' in header and 'employee' not in header:
                name_col = i
            elif 'number' in header or 'employee' in header or 'emp' in header:
                number_col = i
            elif 'workshop' in header and 'control' in header:
                workshop_col = i
            elif 'admin' in header and 'control' in header:
                admin_col = i
            elif 'manager' in header:  # Accept "Manager" or "Manager Control"
                manager_col = i
        
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
                manager_control = None
                
                if workshop_col is not None and len(row) > workshop_col and row[workshop_col]:
                    workshop_control = str(row[workshop_col]).strip().lower()
                
                if admin_col is not None and len(row) > admin_col and row[admin_col]:
                    admin_control = str(row[admin_col]).strip().lower()
                
                if manager_col is not None and len(row) > manager_col and row[manager_col]:
                    manager_control = str(row[manager_col]).strip().lower()
                
                if name and emp_number and name.lower() not in ['name', 'staff', 'employee']:
                    staff_data.append({
                        "name": name,
                        "employee_number": emp_number,
                        "active": True,
                        "workshop_control": workshop_control,
                        "admin_control": admin_control,
                        "manager_control": manager_control
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
        
        # Get existing assets to preserve QR print status
        existing_assets = await db.assets.find({}, {"_id": 0}).to_list(length=10000)
        existing_qr_status = {}
        for ea in existing_assets:
            # Key by make+name to match assets
            key = f"{ea.get('make', '')}:{ea.get('name', '')}"
            if ea.get('qr_printed'):
                existing_qr_status[key] = {
                    'qr_printed': ea.get('qr_printed', False),
                    'qr_printed_at': ea.get('qr_printed_at')
                }
        
        # Update assets database - preserve QR status for existing machines
        await db.assets.delete_many({})
        new_assets = []
        for asset in assets:
            asset_obj = Asset(**asset)
            asset_dict = asset_obj.dict()
            # Check if this asset had QR printed before
            key = f"{asset_dict['make']}:{asset_dict['name']}"
            if key in existing_qr_status:
                asset_dict['qr_printed'] = existing_qr_status[key]['qr_printed']
                asset_dict['qr_printed_at'] = existing_qr_status[key]['qr_printed_at']
            new_assets.append(asset_dict)
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
            # First, find the header row and locate the "Compulsory" column
            items = []
            compulsory_col = None
            item_col = 0  # Default to first column for item text
            
            # Get headers from first row to find Compulsory column
            header_row = list(sheet.iter_rows(min_row=1, max_row=1, values_only=True))[0]
            if header_row:
                for col_idx, header in enumerate(header_row):
                    if header:
                        header_lower = str(header).strip().lower()
                        if 'compulsory' in header_lower or 'compulsary' in header_lower:  # Handle common misspelling
                            compulsory_col = col_idx
                        elif 'item' in header_lower or 'task' in header_lower or 'check' in header_lower or 'description' in header_lower:
                            item_col = col_idx
            
            for row_num, row in enumerate(sheet.iter_rows(values_only=True), 1):
                if row_num == 1:  # Skip header row
                    continue
                    
                if row and len(row) > item_col and row[item_col]:  # If item column has content
                    item_text = str(row[item_col]).strip()
                    # Skip obvious headers or empty items
                    if (item_text and 
                        item_text.lower() not in ['item', 'check', 'description', 'checklist', 'safety'] and
                        len(item_text) > 3):  # Minimum length filter
                        
                        # Check if item is marked as compulsory
                        is_compulsory = False
                        if compulsory_col is not None and len(row) > compulsory_col and row[compulsory_col]:
                            compulsory_value = str(row[compulsory_col]).strip().lower()
                            is_compulsory = compulsory_value in ['yes', 'y', 'true', '1', 'x', 'compulsory']
                        
                        items.append({"item": item_text, "compulsory": is_compulsory})
            
            if items:
                compulsory_count = sum(1 for item in items if item.get('compulsory', False))
                template = {
                    "id": str(uuid.uuid4()),
                    "check_type": matching_check_type,
                    "items": items
                }
                checklist_templates.append(template)
                processed_sheets.append(f"{sheet_name} -> {matching_check_type} ({len(items)} items, {compulsory_count} compulsory)")
        
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
            # Ensure items have compulsory flag (for backward compatibility)
            if template.get('items'):
                for i, item in enumerate(template['items']):
                    if isinstance(item, str):
                        # Convert old string format to new object format
                        template['items'][i] = {"item": item, "compulsory": False}
                    elif isinstance(item, dict) and 'compulsory' not in item:
                        item['compulsory'] = False
            return template
        else:
            # Return default templates if not found in database
            default_templates = {
                'daily_check': [
                    {"item": "Oil level check - Engine oil at correct level", "compulsory": False},
                    {"item": "Fuel level check - Adequate fuel for operation", "compulsory": False},
                    {"item": "Hydraulic fluid level - Within acceptable range", "compulsory": False},
                    {"item": "Battery condition - Terminals clean, voltage adequate", "compulsory": False},
                    {"item": "Tire/track condition - No visible damage or excessive wear", "compulsory": False},
                    {"item": "Safety guards in place - All protective covers secured", "compulsory": True},
                    {"item": "Emergency stop function - Test emergency stop button", "compulsory": True},
                    {"item": "Warning lights operational - All safety lights working", "compulsory": False},
                    {"item": "Operator seat condition - Seat belt and controls functional", "compulsory": False},
                    {"item": "Air filter condition - Clean and properly sealed", "compulsory": False},
                    {"item": "Cooling system - Radiator clear, coolant level adequate", "compulsory": False},
                    {"item": "Brake system function - Service and parking brakes operational", "compulsory": True},
                    {"item": "Steering operation - Smooth operation, no excessive play", "compulsory": False},
                    {"item": "Lights and signals - All operational lights working", "compulsory": False},
                    {"item": "Fire extinguisher - Present and within service date", "compulsory": True}
                ],
                'grader_startup': [
                    {"item": "Emergency stops working and present - Test all emergency stop buttons", "compulsory": True},
                    {"item": "Walkways clear of debris and gates closed - All access areas safe", "compulsory": True},
                    {"item": "Guards are all in place - All safety guards properly secured", "compulsory": True},
                    {"item": "All personnel accounted for and out of reach of dangers - Safety zone clear", "compulsory": True},
                    {"item": "Oil level check - Engine oil at correct level", "compulsory": False},
                    {"item": "Fuel level check - Adequate fuel for operation", "compulsory": False},
                    {"item": "Hydraulic fluid level - Within acceptable range", "compulsory": False},
                    {"item": "Battery condition - Terminals clean, voltage adequate", "compulsory": False},
                    {"item": "Track/blade condition - No visible damage or excessive wear", "compulsory": False},
                    {"item": "Blade operation - Hydraulic lift and angle functions working", "compulsory": False},
                    {"item": "Warning beacon - Rotating warning light operational", "compulsory": False},
                    {"item": "Backup alarm - Reverse warning signal functional", "compulsory": False}
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
    
    # Limit export to last 10000 records for performance
    checklists = await db.checklists.find({}, {"_id": 0}).sort("completed_at", -1).limit(10000).to_list(length=10000)
    
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
    
    # Limit export to last 10000 records for performance
    checklists = await db.checklists.find({}, {"_id": 0}).sort("completed_at", -1).limit(10000).to_list(length=10000)
    
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

@app.get("/api/checklists/export/excel-by-machine")
async def export_checklists_excel_by_machine(make: str = None, name: str = None):
    """Export checklists to Excel - optimized for large datasets.
    Uses CSV-style approach for speed, then converts to Excel."""
    from fastapi.responses import StreamingResponse
    import io
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.utils import get_column_letter
    
    # Build query
    query = {}
    if make:
        query["machine_make"] = make
    if name:
        query["machine_model"] = name
    
    # Use projection to only get needed fields - MUCH faster
    projection = {
        "_id": 0,
        "id": 1,
        "staff_name": 1,
        "machine_make": 1,
        "machine_model": 1,
        "check_type": 1,
        "completed_at": 1,
        "checklist_items": 1,
        "workshop_notes": 1,
        "notes_summary": 1,
        "items_satisfactory": 1,
        "items_unsatisfactory": 1,
        "items_total": 1
    }
    
    # Stream results in batches for memory efficiency
    checklists = []
    cursor = db.checklists.find(query, projection).sort("completed_at", -1)
    async for doc in cursor:
        checklists.append(doc)
        if len(checklists) >= 10000:  # Cap at 10k for reasonable export time
            break
    
    if not checklists:
        raise HTTPException(status_code=404, detail="No checklists found")
    
    # Group by check_type
    by_type = {}
    for c in checklists:
        ct = c.get('check_type', 'unknown')
        if ct not in by_type:
            by_type[ct] = []
        by_type[ct].append(c)
    
    # Get templates (for question columns)
    templates = {}
    async for t in db.checklist_templates.find({}, {"_id": 0, "check_type": 1, "items": 1}):
        templates[t.get('check_type')] = t.get('items', [])
    
    # Create workbook
    wb = Workbook(write_only=False)  # write_only=True is faster but limited
    
    # Simple styles (apply sparingly for speed)
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)
    
    first_sheet = True
    
    for check_type, type_checklists in sorted(by_type.items()):
        if not type_checklists:
            continue
        
        # Create sheet
        sheet_name = check_type[:31].replace('/', '-').replace('\\', '-')
        if first_sheet:
            ws = wb.active
            ws.title = sheet_name
            first_sheet = False
        else:
            ws = wb.create_sheet(title=sheet_name)
        
        # Get all question items for this type
        all_items = []
        if check_type in templates:
            for item in templates[check_type]:
                if isinstance(item, dict):
                    all_items.append(item.get('item', ''))
                else:
                    all_items.append(str(item))
        
        # Also collect from actual data
        for c in type_checklists[:50]:  # Sample first 50 for speed
            for item in c.get('checklist_items', []):
                item_name = item.get('item', '')
                if item_name and item_name not in all_items:
                    all_items.append(item_name)
        
        # Headers
        if check_type == 'workshop_service' or not all_items:
            headers = ["Date", "Time", "Staff", "Machine Make", "Machine Model", "Notes"]
        else:
            headers = ["Date", "Time", "Staff", "Machine Make", "Machine Model"] + all_items[:50] + ["Notes"]  # Limit columns
        
        # Write header row with styling
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header[:50])  # Truncate long headers
            cell.fill = header_fill
            cell.font = header_font
        
        # Write data rows - minimal styling for speed
        for row_idx, c in enumerate(type_checklists, 2):
            completed = c.get('completed_at', '')
            if isinstance(completed, str) and len(completed) >= 10:
                date_str = completed[:10]
                time_str = completed[11:16] if len(completed) > 16 else ''
            else:
                date_str = str(completed)[:10] if completed else ''
                time_str = ''
            
            row = [
                date_str,
                time_str,
                c.get('staff_name', ''),
                c.get('machine_make', ''),
                c.get('machine_model', '')
            ]
            
            if check_type == 'workshop_service' or not all_items:
                row.append(c.get('workshop_notes', '') or c.get('notes_summary', ''))
            else:
                # Build status map
                status_map = {}
                notes = []
                for item in c.get('checklist_items', []):
                    status_map[item.get('item', '')] = item.get('status', '')
                    if item.get('notes'):
                        notes.append(item['notes'][:30])
                
                # Add status for each question column
                for item_name in all_items[:50]:
                    status = status_map.get(item_name, '')
                    if status == 'satisfactory':
                        row.append('✓')
                    elif status == 'unsatisfactory':
                        row.append('✗')
                    elif status == 'n/a':
                        row.append('N/A')
                    else:
                        row.append('')
                
                row.append('; '.join(notes) if notes else c.get('notes_summary', ''))
            
            # Write row (no cell-by-cell styling for speed)
            for col, value in enumerate(row, 1):
                ws.cell(row=row_idx, column=col, value=value)
        
        # Set column widths (do this once, not per cell)
        ws.column_dimensions['A'].width = 12
        ws.column_dimensions['B'].width = 8
        ws.column_dimensions['C'].width = 15
        ws.column_dimensions['D'].width = 12
        ws.column_dimensions['E'].width = 15
        
        # Freeze first row
        ws.freeze_panes = 'A2'
    
    # Add summary sheet
    summary = wb.create_sheet(title="Summary", index=0)
    summary.append(["Check Type", "Count"])
    summary.cell(row=1, column=1).fill = header_fill
    summary.cell(row=1, column=1).font = header_font
    summary.cell(row=1, column=2).fill = header_fill
    summary.cell(row=1, column=2).font = header_font
    
    for ct, cl in sorted(by_type.items()):
        summary.append([ct, len(cl)])
    
    summary.append([])
    summary.append(["Total", len(checklists)])
    
    # Save to bytes
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={"Content-Disposition": "attachment; filename=checklists_export.xlsx"}
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
    statuses = await db.repair_status.find({}, {"_id": 0}).to_list(length=10000)  # Max 10000 statuses
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
    # Invalidate dashboard cache so counts update immediately
    await invalidate_cache()
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
    # Invalidate dashboard cache so counts update immediately
    await invalidate_cache()
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

# ============================================
# Near Miss and Suggestion Endpoints
# ============================================

@app.post("/api/near-misses")
async def create_near_miss(near_miss: NearMissCreate, employee_number: str = None):
    """Submit a new near miss report"""
    near_miss_doc = {
        "id": str(uuid.uuid4()),
        "description": near_miss.description,
        "location": near_miss.location,
        "photos": near_miss.photos,
        "is_anonymous": near_miss.is_anonymous,
        "submitted_by": near_miss.submitted_by if not near_miss.is_anonymous else None,
        "employee_number": employee_number if not near_miss.is_anonymous else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "acknowledged": False
    }
    await db.near_misses.insert_one(near_miss_doc)
    await invalidate_cache()
    return {"success": True, "message": "Near miss reported successfully", "id": near_miss_doc["id"]}

@app.get("/api/near-misses")
async def get_near_misses(acknowledged: bool = None, limit: int = 100):
    """Get near miss reports"""
    query = {}
    if acknowledged is not None:
        query["acknowledged"] = acknowledged
    
    near_misses = await db.near_misses.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(length=limit)
    return near_misses

@app.get("/api/near-misses/count")
async def get_near_misses_count():
    """Get count of new (unacknowledged) near misses"""
    total = await db.near_misses.count_documents({})
    new_count = await db.near_misses.count_documents({"acknowledged": False})
    return {"total": total, "new": new_count}

@app.post("/api/near-misses/{near_miss_id}/acknowledge")
async def acknowledge_near_miss(near_miss_id: str, acknowledged_by: str = "Admin"):
    """Acknowledge a near miss report"""
    result = await db.near_misses.update_one(
        {"id": near_miss_id},
        {"$set": {
            "acknowledged": True,
            "acknowledged_at": datetime.now(timezone.utc).isoformat(),
            "acknowledged_by": acknowledged_by
        }}
    )
    await invalidate_cache()
    if result.modified_count > 0:
        return {"success": True, "message": "Near miss acknowledged"}
    raise HTTPException(status_code=404, detail="Near miss not found")

@app.post("/api/suggestions")
async def create_suggestion(suggestion: SuggestionCreate, employee_number: str = None):
    """Submit a new suggestion"""
    suggestion_doc = {
        "id": str(uuid.uuid4()),
        "title": suggestion.title,
        "description": suggestion.description,
        "category": suggestion.category,
        "location": suggestion.location,
        "photos": suggestion.photos,
        "is_anonymous": suggestion.is_anonymous,
        "submitted_by": suggestion.submitted_by if not suggestion.is_anonymous else None,
        "employee_number": employee_number if not suggestion.is_anonymous else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "new"
    }
    await db.suggestions.insert_one(suggestion_doc)
    await invalidate_cache()
    return {"success": True, "message": "Suggestion submitted successfully", "id": suggestion_doc["id"]}

@app.get("/api/suggestions")
async def get_suggestions(status: str = None, limit: int = 100):
    """Get suggestions"""
    query = {}
    if status:
        query["status"] = status
    
    suggestions = await db.suggestions.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(length=limit)
    return suggestions

@app.get("/api/suggestions/count")
async def get_suggestions_count():
    """Get count of new suggestions"""
    total = await db.suggestions.count_documents({})
    new_count = await db.suggestions.count_documents({"status": "new"})
    return {"total": total, "new": new_count}

@app.put("/api/suggestions/{suggestion_id}/review")
async def review_suggestion(suggestion_id: str, status: str, reviewed_by: str = "Admin", review_notes: str = None):
    """Review a suggestion - set status to reviewed, implemented, or declined"""
    if status not in ["reviewed", "implemented", "declined"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.suggestions.update_one(
        {"id": suggestion_id},
        {"$set": {
            "status": status,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": reviewed_by,
            "review_notes": review_notes
        }}
    )
    await invalidate_cache()
    if result.modified_count > 0:
        return {"success": True, "message": f"Suggestion marked as {status}"}
    raise HTTPException(status_code=404, detail="Suggestion not found")

# ============================================
# Work Progress Tracking Endpoints
# ============================================

@app.get("/api/jobs")
async def get_all_jobs():
    """Get all jobs with calculated stats for dashboard"""
    jobs = await db.jobs.find({}, {"_id": 0}).to_list(length=1000)
    
    result = []
    for job in jobs:
        # Get all work entries for this job
        entries = await db.work_entries.find(
            {"job_id": job["id"]}, 
            {"_id": 0}
        ).sort("date_completed", 1).to_list(length=10000)
        
        # Calculate total completed
        total_completed = sum(e.get("hectares_completed", 0) for e in entries)
        area_left = max(0, job.get("total_area", 0) - total_completed)
        
        # Calculate Ha/day (average of daily entries)
        ha_per_day = 0
        if entries:
            # Group entries by date and calculate daily totals
            daily_totals = {}
            for entry in entries:
                date = entry.get("date_completed", "")[:10]  # Get just the date part
                if date:
                    daily_totals[date] = daily_totals.get(date, 0) + entry.get("hectares_completed", 0)
            
            if daily_totals:
                ha_per_day = sum(daily_totals.values()) / len(daily_totals)
        
        # Auto-update status to complete if area_left is 0
        if area_left <= 0 and job.get("status") == "active":
            await db.jobs.update_one(
                {"id": job["id"]},
                {"$set": {"status": "complete"}}
            )
            job["status"] = "complete"
        
        result.append({
            **job,
            "total_completed": round(total_completed, 2),
            "area_left": round(area_left, 2),
            "ha_per_day": round(ha_per_day, 2),
            "entries_count": len(entries),
            "last_entry": entries[-1] if entries else None
        })
    
    # Sort: active jobs first, then by name
    result.sort(key=lambda x: (0 if x["status"] == "active" else 1, x["name"]))
    
    return result

@app.post("/api/admin/jobs")
async def create_job(job_data: JobCreate):
    """Create a new job"""
    job = Job(
        name=job_data.name,
        total_area=job_data.total_area
    )
    
    await db.jobs.insert_one(job.dict())
    
    return {
        "success": True,
        "message": f"Job '{job.name}' created successfully",
        "job": job.dict()
    }

@app.get("/api/admin/jobs/{job_id}")
async def get_job_details(job_id: str):
    """Get detailed job info including all work entries"""
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    entries = await db.work_entries.find(
        {"job_id": job_id}, 
        {"_id": 0}
    ).sort("date_completed", -1).to_list(length=10000)
    
    total_completed = sum(e.get("hectares_completed", 0) for e in entries)
    
    return {
        **job,
        "total_completed": round(total_completed, 2),
        "area_left": round(max(0, job.get("total_area", 0) - total_completed), 2),
        "entries": entries
    }

@app.post("/api/admin/jobs/{job_id}/work-entry")
async def add_work_entry(job_id: str, entry_data: WorkEntryCreate):
    """Add a work entry to a job"""
    # Verify job exists
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Use provided date or today
    date_completed = entry_data.date_completed or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    entry = WorkEntry(
        job_id=job_id,
        hectares_completed=entry_data.hectares_completed,
        date_completed=date_completed,
        entered_by=entry_data.entered_by
    )
    
    await db.work_entries.insert_one(entry.dict())
    
    # Check if job should be marked complete
    entries = await db.work_entries.find({"job_id": job_id}, {"_id": 0}).to_list(length=10000)
    total_completed = sum(e.get("hectares_completed", 0) for e in entries)
    area_left = max(0, job.get("total_area", 0) - total_completed)
    
    if area_left <= 0:
        await db.jobs.update_one({"id": job_id}, {"$set": {"status": "complete"}})
    
    return {
        "success": True,
        "message": f"Added {entry_data.hectares_completed} Ha to '{job['name']}'",
        "entry": entry.dict(),
        "total_completed": round(total_completed, 2),
        "area_left": round(area_left, 2)
    }

@app.delete("/api/admin/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job and all its work entries"""
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Delete job and all related entries
    await db.jobs.delete_one({"id": job_id})
    deleted_entries = await db.work_entries.delete_many({"job_id": job_id})
    
    return {
        "success": True,
        "message": f"Job '{job['name']}' deleted",
        "entries_deleted": deleted_entries.deleted_count
    }

@app.put("/api/admin/jobs/{job_id}")
async def update_job(job_id: str, job_data: JobCreate):
    """Update a job's name or total area"""
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    await db.jobs.update_one(
        {"id": job_id},
        {"$set": {"name": job_data.name, "total_area": job_data.total_area}}
    )
    
    return {
        "success": True,
        "message": f"Job updated successfully"
    }

@app.put("/api/admin/jobs/{job_id}/reopen")
async def reopen_job(job_id: str):
    """Reopen a completed job (set status back to active)"""
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    await db.jobs.update_one({"id": job_id}, {"$set": {"status": "active"}})
    
    return {
        "success": True,
        "message": f"Job '{job['name']}' reopened"
    }

@app.delete("/api/admin/work-entries/{entry_id}")
async def delete_work_entry(entry_id: str):
    """Delete a specific work entry"""
    entry = await db.work_entries.find_one({"id": entry_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Work entry not found")
    
    await db.work_entries.delete_one({"id": entry_id})
    
    # Check if parent job should be reopened
    job = await db.jobs.find_one({"id": entry["job_id"]})
    if job and job.get("status") == "complete":
        entries = await db.work_entries.find({"job_id": job["id"]}, {"_id": 0}).to_list(length=10000)
        total_completed = sum(e.get("hectares_completed", 0) for e in entries)
        if total_completed < job.get("total_area", 0):
            await db.jobs.update_one({"id": job["id"]}, {"$set": {"status": "active"}})
    
    return {
        "success": True,
        "message": "Work entry deleted"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)