# How to Update Staff and Machine Data

## Overview
Your Abreys Machine Checklist app includes an easy way to update staff names and machine assets. Here are three methods:

## Method 1: Using the Python Script (Recommended)

### Interactive Mode (Easiest)
```bash
cd /app
python update_data.py --interactive
```
This will guide you through the process step by step.

### Command Line Mode
```bash
# Update staff only
python update_data.py --staff your_staff_file.txt

# Update machines only  
python update_data.py --assets your_assets_file.csv

# Update both at once
python update_data.py --staff your_staff_file.txt --assets your_assets_file.csv
```

## Method 2: File Formats

### Staff File Format
Create a text file with one staff member name per line:
```
Abbie Nixon
Adrian-Stefan Iovu
Alan Day
Andy Browning
[... more names ...]
```

### Assets File Format
Create a CSV file with make and model columns:
```csv
Make,Model
John Deere,6145R
Cat,DP30NTD
JCB,520S Loadall
[... more machines ...]
```

## Method 3: Direct API Calls

If you prefer to use the API directly:

### Update Staff
```bash
curl -X POST https://equipcheck-5.preview.emergentagent.com/api/admin/update-staff \
  -H "Content-Type: application/json" \
  -d '["Staff Name 1", "Staff Name 2", "Staff Name 3"]'
```

### Update Assets
```bash
curl -X POST https://equipcheck-5.preview.emergentagent.com/api/admin/update-assets \
  -H "Content-Type: application/json" \
  -d '[{"make": "John Deere", "model": "6145R"}, {"make": "Cat", "model": "DP30NTD"}]'
```

## What You Added Recently

You mentioned you've added more data. To add your new entries:

1. **Export your updated Excel files** with the new staff names and machine assets
2. **Save staff names as a text file** (one per line) or keep in Excel format
3. **Save machine data as CSV** with Make and Model columns
4. **Run the update script** using one of the methods above

## Important Notes

⚠️ **Warning**: The update process replaces ALL existing data. Make sure your files include both old and new entries.

✅ **Backup**: The system automatically keeps your checklist history - only staff and machine lists are updated.

🔄 **Live Updates**: Changes take effect immediately. Staff can start using new machines/names right away.

## Need Help?

The interactive mode (`python update_data.py --interactive`) will guide you through the process and show you exactly what will be updated before making changes.