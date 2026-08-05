"""
One-time script: load the data_export/*.json files into a MongoDB database.

Usage:
    MONGO_URL="mongodb+srv://..." DB_NAME="test_database" python3 seed_database.py

It clears each collection first, so it's safe to re-run.
"""
import json
import os
import sys

import pymongo

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "test_database")

if not MONGO_URL:
    sys.exit("Set the MONGO_URL environment variable to your database connection string.")

client = pymongo.MongoClient(MONGO_URL)
db = client[DB_NAME]

FILES = {
    "assets": "data_export/assets.json",
    "checklist_templates": "data_export/checklist_templates.json",
    "staff": "data_export/staff.json",
    "repair_status": "data_export/repair_status.json",
    "checklists": "data_export/checklists.json",
}

for collection, path in FILES.items():
    with open(path) as f:
        docs = json.load(f)
    db[collection].delete_many({})
    total = 0
    batch = []
    for doc in docs:
        batch.append(doc)
        if len(batch) >= 200:
            db[collection].insert_many(batch)
            total += len(batch)
            batch = []
    if batch:
        db[collection].insert_many(batch)
        total += len(batch)
    print(f"{collection}: {total} records loaded")

print("Done. Your data is in the new database.")
