from fastapi import FastAPI, HTTPException
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

# Pydantic models
class Asset(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    make: str
    model: str
    
class Staff(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    
class ChecklistItem(BaseModel):
    item: str
    status: str = "unchecked"  # "unchecked", "satisfactory", "unsatisfactory"
    notes: Optional[str] = None
    
class Checklist(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    staff_name: str
    machine_make: str
    machine_model: str
    check_type: str  # "daily_check" or "workshop_service"
    checklist_items: List[ChecklistItem] = []
    workshop_notes: Optional[str] = None
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "completed"
    
class ChecklistResponse(BaseModel):
    id: str
    staff_name: str
    machine_make: str
    machine_model: str
    check_type: str
    checklist_items: List[ChecklistItem]
    workshop_notes: Optional[str] = None
    completed_at: datetime
    status: str

# Initialize data
async def initialize_data():
    # Check if data already exists
    asset_count = await db.assets.count_documents({})
    staff_count = await db.staff.count_documents({})
    
    if asset_count == 0:
        # Asset data from Excel
        assets_data = [
            {"make": "Cat", "model": "DP30NTD"},
            {"make": "Cat", "model": "EP25N"},
            {"make": "Cat", "model": "DP40N"},
            {"make": "John Deere", "model": "6145R"},
            {"make": "John Deere", "model": "6145R AFM"},
            {"make": "John Deere", "model": "6155R AFM"},
            {"make": "John Deere", "model": "6155R"},
            {"make": "John Deere", "model": "9470RX"},
            {"make": "John Deere", "model": "9RX 470"},
            {"make": "John Deere", "model": "9870CTS combine"},
            {"make": "John Deere", "model": "6140R"},
            {"make": "John Deere", "model": "6R 145"},
            {"make": "John Deere", "model": "7R 330"},
            {"make": "John Deere", "model": "7R Carrots"},
            {"make": "John Deere", "model": "8RT 370"},
            {"make": "John Deere", "model": "8RT"},
            {"make": "John Deere", "model": "9RX 640"},
            {"make": "Bateman", "model": "RB35 self propelled sprayer"},
            {"make": "Bateman", "model": "RB55 self propelled sprayer"},
            {"make": "Class", "model": "Lexion 750TT combine"},
            {"make": "Daewoo", "model": "B18T-2CH00190"},
            {"make": "JCB", "model": "520S Loadall"},
            {"make": "JCB", "model": "530-70 Loadall"},
            {"make": "JCB", "model": "541-70 Loadall"},
            {"make": "JCB", "model": "542-70 Loadall"},
            {"make": "JCB", "model": "560-80 Loadall"},
            {"make": "Toyota", "model": "ZK 31281"},
            {"make": "Asa-Lift", "model": "T4000D 4 row trailed carrot harvester"},
            {"make": "Bailey", "model": "14t twin axle dump trailer"},
            {"make": "Bailey", "model": "18t twin axle rootcrop tipping trailer"},
            {"make": "Bailey", "model": "Beeteaper 18t twin axle tipping trailer"},
            {"make": "Bailey", "model": "Tri axle 12 box trailer"},
            {"make": "Grimme", "model": "GT170S potato harvester"},
            {"make": "Grimme", "model": "GZ1700 DLS onion harvester"},
            {"make": "Grimme", "model": "Varitron 270 potato harvester"},
            {"make": "Grimme", "model": "CS150 multiweb destoner"},
            {"make": "Grimme", "model": "CS150 Multiweb destoner"},
            {"make": "Brian James", "model": "Tri axle tilbed 16ft trailer"},
            {"make": "Brian Legg", "model": "Single axle low loader trailer"},
            {"make": "Bye", "model": "Twin axle double drive Power Dolly"},
            {"make": "Chiefian", "model": "Twin axle low loader"},
            {"make": "Delta", "model": "4 row onion set planter"},
            {"make": "Don Bur", "model": "Tri axle 40ft skelly trailer"},
            {"make": "Downs", "model": "Freestanding flat belt conveyor 33ft long 1000mm wide"},
            {"make": "Downs", "model": "Freestanding flat belt conveyor 20ft long 1000mm wide"},
            {"make": "Downs", "model": "Wolfhound telescopic elevator 17m 900mm wide"},
            {"make": "Downs", "model": "Telescopic elevator with power transmission wheels"},
            {"make": "Gardiner", "model": "10 box twin axle trailer"},
            {"make": "Herbert", "model": "Elevator with square hopper"},
            {"make": "Herbert", "model": "Mobile grader 1800 6ft wide"},
            {"make": "Ifor Williams", "model": "LM105GHD 10ft twin axle drop side trailer"},
            {"make": "Jones", "model": "Single bed windrower"},
            {"make": "Logic", "model": "Trailed slug pelleter/fertiliser spreader"},
            {"make": "Miedema", "model": "Structural PM20 potato planter"},
            {"make": "Richard Western", "model": "6t single axle dump trailer"},
            {"make": "Richard Western", "model": "14t twin axle root crop tipping trailer"},
            {"make": "Richard Western", "model": "Twin axle 8 box trailer"},
            {"make": "Richard Western", "model": "Single axle low loader trailer"},
            {"make": "Samon", "model": "Favourite single bed windrower"},
            {"make": "Samon", "model": "SU2LS onion loader"},
            {"make": "Samon", "model": "Triple bed windrower"},
            {"make": "SDC", "model": "Tri axle curtain side trailer"},
            {"make": "SDC", "model": "Tri axle 40ft skelly trailer"},
            {"make": "Horsch", "model": "Sprinter 6ST 6m tine coulter drill"},
            {"make": "Simba", "model": "Pronto 6DC 6m disc coulter drill"},
            {"make": "Simon", "model": "2RGS 2 row carrot top lifter"},
            {"make": "Simon", "model": "T2R 2 row carrot top lifter"},
            {"make": "Standen", "model": "T2 onion harvester"},
            {"make": "Standen", "model": "SP244 potato planter"},
            {"make": "Pearson", "model": "Uniweb destoner"},
            {"make": "Stanhay", "model": "5 row single bed onion drill"},
            {"make": "Stanhay", "model": "12 row triple bed rigid onion drill"},
            {"make": "Stronga", "model": "Hookloada twin axle trailer"},
            {"make": "Tong", "model": "Destoner 1502005"},
            {"make": "Underhaug", "model": "Destoner 1512005"},
            {"make": "Wilcox", "model": "Tri axle bulker"},
            {"make": "Kuhn", "model": "36m twin disc fertiliser spreader"},
            {"make": "Kverneland", "model": "Exacta TL 24m fertiliser spreader"},
            {"make": "Team/Bye", "model": "3 bed front mounted band sprayer"},
            {"make": "Team/Bye", "model": "Stainless steel front tank"},
            {"make": "Dewulf", "model": "Structural DS30 P40-50 trailed planter"},
            {"make": "KRM Bredal", "model": "F4 4000 36m fertiliser spreader"}
        ]
        
        for asset_data in assets_data:
            asset = Asset(**asset_data)
            asset_dict = asset.dict()
            await db.assets.insert_one(asset_dict)
    
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

@app.get("/api/staff", response_model=List[Staff])
async def get_staff():
    staff_list = await db.staff.find({}, {"_id": 0}).to_list(length=None)
    return staff_list

@app.get("/api/assets/makes", response_model=List[str])
async def get_makes():
    makes = await db.assets.distinct("make")
    return sorted(makes)

@app.get("/api/assets/models/{make}", response_model=List[str])
async def get_models_by_make(make: str):
    models = await db.assets.distinct("model", {"make": make})
    return sorted(models)

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

@app.get("/api/checklists", response_model=List[ChecklistResponse])
async def get_checklists(limit: int = 50, skip: int = 0):
    checklists = await db.checklists.find({}, {"_id": 0}).sort("completed_at", -1).skip(skip).limit(limit).to_list(length=None)
    
    # Parse datetime strings back to datetime objects
    for checklist in checklists:
        if isinstance(checklist['completed_at'], str):
            checklist['completed_at'] = datetime.fromisoformat(checklist['completed_at'])
    
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

@app.post("/api/admin/update-staff")
async def update_staff_list(staff_names: List[str]):
    """Update the staff list by replacing all existing staff with new list"""
    try:
        # Clear existing staff
        await db.staff.delete_many({})
        
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

@app.post("/api/admin/sharepoint/callback")
async def sharepoint_auth_callback(auth_code: str):
    """Handle SharePoint authentication callback"""
    try:
        result = sharepoint_integration.acquire_token_by_auth_code(auth_code)
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
        
        # Clear existing staff
        await db.staff.delete_many({})
        
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

@app.post("/api/admin/sharepoint/sync-all")
async def sync_all_from_sharepoint():
    """Sync both staff and asset data from SharePoint Excel files"""
    try:
        results = {}
        
        # Sync staff data
        try:
            staff_names = sharepoint_integration.get_staff_data()
            await db.staff.delete_many({})
            
            new_staff = []
            for staff_name in staff_names:
                staff = Staff(name=staff_name.strip())
                new_staff.append(staff.dict())
            
            if new_staff:
                await db.staff.insert_many(new_staff)
            
            results['staff'] = {
                "success": True,
                "count": len(new_staff),
                "message": f"Synced {len(new_staff)} staff members"
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
        
        # Overall success
        overall_success = results['staff'].get('success', False) and results['assets'].get('success', False)
        
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
        if checklist['check_type'] == 'daily_check':
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)