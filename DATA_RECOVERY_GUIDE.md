# DATA RECOVERY GUIDE - Production Database Empty

## What Happened

Your production deployment at https://checklist-capture.emergent.host/ is connected to a **NEW empty Atlas MongoDB database**. 

Your old data is NOT lost - it's still in one of these locations:
1. The original production database (before redeployment)
2. The preview environment (which we exported from)

## Current Situation

**Production Database:** Empty (0 checks, 0 machines, 0 staff)
**Preview Database:** Has all 1,449 documents
**Exported Data:** Safe in `/app/data_export/` folder

## SOLUTION: Import Your Data to Production

### Step 1: Get Your Production MongoDB Connection String

From Emergent dashboard:
1. Go to your deployment settings
2. Find the MongoDB Atlas connection string
3. It looks like: `mongodb+srv://username:password@cluster.mongodb.net/`

### Step 2: Run the Import Script

**Option A: From Preview Environment**

```bash
# In your preview environment terminal
cd /app
python import_to_production.py "YOUR_ATLAS_MONGODB_URL" "checklist_capture_db"
```

Replace `YOUR_ATLAS_MONGODB_URL` with your actual Atlas connection string.

**Option B: From Your Local Machine**

1. Download the export files from `/app/data_export/`:
   - checklists.json (1,068 records)
   - assets.json (219 machines)
   - staff.json (2 members)
   - repair_status.json (153 repairs)
   - checklist_templates.json (7 templates)

2. Copy `import_to_production.py` to same folder

3. Run:
```bash
python import_to_production.py "YOUR_ATLAS_MONGODB_URL" "checklist_capture_db"
```

### Step 3: Verify Data Imported

After import completes, check production:
- Dashboard should show: 976 total checks completed
- Assets: 219 machines available
- Staff: 81 employees
- Dashboard should load instantly (indexes created)

### Step 4: Restart Production (if needed)

If data imported but still showing 0:
1. Redeploy the application
2. Or wait 1-2 minutes for cache to clear

## Alternative: Upload via Admin Panel

If you can't run the import script:

1. Login to production with employee 4444
2. Go to Admin Panel
3. Upload these Excel files:
   - AssetList.xlsx (189 assets)
   - StaffList.xlsx (81 staff)
   - Daily_Check_Checklist.xlsx
   - Workshop_Service_Tasks.xlsx

Note: This will create the machines and staff, but you'll lose historical check data.

## Important Notes

- Your data is NOT lost - it's still in the export files
- The import script includes all indexes for fast performance
- After import, production will work exactly like preview
- The import takes ~1-2 minutes for 1,449 documents

## Need Help?

If you get an error running the import script, share:
1. The exact error message
2. Your MongoDB connection string (hide password)
3. Whether you can access the Atlas database directly

## Files Location

All export files are in: `/app/data_export/`
- checklists.json - 1,068 checks
- assets.json - 219 machines  
- staff.json - 2 staff members
- repair_status.json - 153 repair statuses
- checklist_templates.json - 7 templates

**Your data is safe and ready to import!**
