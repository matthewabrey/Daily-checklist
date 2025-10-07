#!/usr/bin/env python3
import asyncio
import os
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def create_checklist_templates():
    # MongoDB setup
    MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    DB_NAME = os.environ.get("DB_NAME", "test_database")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Clear existing templates
    await db.checklist_templates.delete_many({})
    
    # Define templates for each check type from AssetList.xlsx
    templates = [
        {
            "check_type": "Vehicle",
            "items": [
                "Tire condition and pressure - No visible damage, correct pressure",
                "Lights operational - All lights working (headlights, taillights, indicators)",
                "Brake function - Brakes respond properly",
                "Steering - No excessive play, responds correctly",
                "Mirrors clean and adjusted - All mirrors clean and properly positioned",
                "Seat belts functional - Belts secure and operate correctly",
                "Engine oil level - Oil at correct level on dipstick",
                "Fuel level adequate - Sufficient fuel for operation",
                "Coolant level - Coolant at proper level",
                "Warning lights check - No warning lights on dashboard",
                "Horn operational - Horn sounds clearly",
                "Windshield wipers - Wipers operate correctly",
                "Emergency brake - Parking brake engages properly",
                "Battery terminals clean - No corrosion on terminals",
                "General exterior condition - No visible damage to body"
            ]
        },
        {
            "check_type": "Harvester",
            "items": [
                "Cutting platform condition - No damaged blades or guards",
                "Header height adjustment - Hydraulic lift operates smoothly",
                "Conveyor belts - Belts properly tensioned and aligned", 
                "Threshing cylinder - No damaged teeth or excessive wear",
                "Concave clearance - Proper gap between cylinder and concave",
                "Cleaning fan - Fan blades undamaged and balanced",
                "Chaffer and sieve - Screens clean and undamaged",
                "Grain tank condition - Tank clean and auger operational",
                "Unloading auger - Extends and retracts properly",
                "Engine oil and filters - Oil level correct, filters clean",
                "Hydraulic fluid level - Fluid at proper level",
                "Tire condition - No cuts, proper inflation",
                "Safety shields - All guards in place and secure",
                "Warning beacons - Rotating lights operational",
                "Crop loss monitors - Sensors clean and operational"
            ]
        },
        {
            "check_type": "Drill/Planter",
            "items": [
                "Seed metering units - Plates/discs appropriate for seed type",
                "Seed tubes clean - No blockages in delivery tubes",
                "Depth control wheels - Wheels roll freely and adjust properly",
                "Closing wheels - Wheels clean and properly positioned",
                "Furrow openers - Sharp and properly aligned",
                "Seed hopper condition - Clean and no cracks",
                "Drive chains/gears - Properly lubricated and tensioned",
                "Hydraulic markers - Extend and retract smoothly",
                "Coulter discs - Sharp and no excessive wear",
                "Frame condition - No cracks or loose bolts",
                "Three-point hitch - Pins secure and grease fittings lubricated",
                "Tire pressure - Correct pressure for soil conditions",
                "Fertilizer system - Tubes clear and meters calibrated",
                "Trash clearance - Adequate clearance for residue",
                "Row spacing - Consistent spacing across width"
            ]
        },
        {
            "check_type": "Forklift/JCB",
            "items": [
                "Fork condition - No cracks or excessive wear on forks",
                "Hydraulic lift operation - Smooth up/down movement",
                "Tilt function - Mast tilts forward/back properly",
                "Steering response - No excessive play in steering",
                "Brake operation - Service and parking brakes functional",
                "Load capacity - Operating within rated capacity",
                "Visibility - Mirrors clean, lights operational",
                "Engine oil level - Oil at correct level",
                "Hydraulic fluid level - Fluid level within range",
                "Tire condition - No damage, proper inflation",
                "Backup alarm - Audible when in reverse",
                "Seatbelt operation - Seatbelt secures properly",
                "ROPS/FOPS condition - Roll/fall protection intact",
                "Warning lights - All dashboard warnings checked",
                "Attachment security - Forks or attachments properly secured"
            ]
        },
        {
            "check_type": "Grader",
            "items": [
                "Blade condition - Sharp edge, no excessive wear",
                "Blade positioning - Hydraulic angle and lift operational",
                "Circle rotation - Circle turns smoothly through full range",
                "Wheel lean function - Front wheels lean properly",
                "Scarifier operation - Scarifier raises/lowers correctly",
                "Engine oil level - Oil at proper level on dipstick",
                "Hydraulic fluid level - Fluid within acceptable range",
                "Tire condition - No cuts, proper tire pressure",
                "Articulation joint - Joint moves freely, no excessive wear",
                "ROPS condition - Roll-over protection intact",
                "Warning beacon - Rotating light operational",
                "Backup alarm - Sounds when in reverse",
                "Cab condition - Windows clean, seat adjusted",
                "Control response - All joysticks/controls respond properly",
                "General condition - No loose bolts or damaged components"
            ]
        },
        {
            "check_type": "Irrigator",
            "items": [
                "Pipe connections - No leaks at joints",
                "Sprinkler heads - All nozzles clear and operational",
                "Water pressure - Pressure gauge within normal range",
                "Pump operation - Pump starts and runs smoothly",
                "Drive mechanism - Wheels or tracks move freely",
                "Control panel - All switches and indicators functional",
                "Hose condition - No kinks, cuts, or excessive wear",
                "Water source connection - Secure connection to supply",
                "Spray pattern - Even distribution across coverage area",
                "Engine condition - Oil level adequate, no unusual sounds",
                "Fuel level - Sufficient fuel for operation",
                "Safety systems - Emergency stops operational",
                "Filters clean - Water and fuel filters not clogged",
                "Electrical connections - All connections secure and dry",
                "General condition - No damaged or missing components"
            ]
        },
        {
            "check_type": "Trailed Implement", 
            "items": [
                "Hitch connection - Properly connected to tractor",
                "Safety chains - Chains attached and adequate length",
                "PTO shield - Power take-off guard in place",
                "Hydraulic connections - Hoses connected without leaks",
                "Tire condition - No damage, correct inflation pressure",
                "Working components - Discs/tines/shanks in good condition",
                "Frame integrity - No cracks or excessive wear",
                "Grease fittings - All fittings lubricated as required",
                "Adjustment mechanisms - Depth/angle controls operational",
                "Transport locks - Locking mechanisms secure for transport",
                "Lighting - Tail lights and indicators operational",
                "Reflectors clean - All reflective markers visible",
                "Guards and shields - All safety covers in place",
                "Bolts and pins - All fasteners tight and secure",
                "General condition - Overall implement ready for operation"
            ]
        }
    ]
    
    # Insert templates
    for template_data in templates:
        template = {
            "id": str(uuid.uuid4()),
            "check_type": template_data["check_type"],
            "items": [{"item": item, "critical": False} for item in template_data["items"]]
        }
        
        await db.checklist_templates.insert_one(template)
        print(f"✅ Created template for: {template_data['check_type']} ({len(template_data['items'])} items)")
    
    print(f"\n🎯 Created {len(templates)} checklist templates successfully!")
    print("Templates created for: Vehicle, Harvester, Drill/Planter, Forklift/JCB, Grader, Irrigator, Trailed Implement")

if __name__ == "__main__":
    asyncio.run(create_checklist_templates())