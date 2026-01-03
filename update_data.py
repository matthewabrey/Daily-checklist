#!/usr/bin/env python3
"""
Data Update Script for Abreys Machine Checklist App

This script helps you update staff names and machine assets in the database.
Usage examples:

1. Update staff from a text file (one name per line):
   python update_data.py --staff staff_names.txt

2. Update assets from a CSV file (make,model format):
   python update_data.py --assets assets.csv

3. Update both:
   python update_data.py --staff staff_names.txt --assets assets.csv

4. Interactive mode:
   python update_data.py --interactive
"""

import argparse
import requests
import csv
import json
import sys
import os

# Backend URL
BASE_URL = "https://machinehealth-2.preview.emergentagent.com/api"

def read_staff_file(filename):
    """Read staff names from a text file (one name per line)"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            staff_names = [line.strip() for line in f if line.strip()]
        return staff_names
    except Exception as e:
        print(f"Error reading staff file: {e}")
        return None

def read_assets_file(filename):
    """Read assets from a CSV file (make,model format)"""
    try:
        assets = []
        with open(filename, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            # Skip header if it exists
            first_row = next(reader, None)
            if first_row and (first_row[0].lower() == 'make' or first_row[0].lower() == 'makecolumn'):
                pass  # Skip header
            else:
                if first_row:
                    assets.append({"make": first_row[0].strip(), "model": first_row[1].strip()})
            
            for row in reader:
                if len(row) >= 2 and row[0].strip() and row[1].strip():
                    assets.append({"make": row[0].strip(), "model": row[1].strip()})
        return assets
    except Exception as e:
        print(f"Error reading assets file: {e}")
        return None

def update_staff(staff_names):
    """Update staff list via API"""
    try:
        response = requests.post(f"{BASE_URL}/admin/update-staff", json=staff_names)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Successfully updated {result['count']} staff members")
            return True
        else:
            print(f"❌ Failed to update staff: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error updating staff: {e}")
        return False

def update_assets(assets):
    """Update asset list via API"""
    try:
        response = requests.post(f"{BASE_URL}/admin/update-assets", json=assets)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Successfully updated {result['count']} assets")
            return True
        else:
            print(f"❌ Failed to update assets: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error updating assets: {e}")
        return False

def interactive_mode():
    """Interactive mode for updating data"""
    print("\n🔧 Abreys Machine Checklist - Data Update Tool")
    print("=" * 50)
    
    while True:
        print("\nWhat would you like to update?")
        print("1. Staff names")
        print("2. Machine assets")
        print("3. Both")
        print("4. View current counts")
        print("5. Exit")
        
        choice = input("\nEnter your choice (1-5): ").strip()
        
        if choice == '1':
            filename = input("Enter staff file path (one name per line): ").strip()
            if os.path.exists(filename):
                staff_names = read_staff_file(filename)
                if staff_names:
                    print(f"Found {len(staff_names)} staff members")
                    if input("Proceed with update? (y/n): ").lower() == 'y':
                        update_staff(staff_names)
            else:
                print("File not found!")
                
        elif choice == '2':
            filename = input("Enter assets CSV file path (make,model format): ").strip()
            if os.path.exists(filename):
                assets = read_assets_file(filename)
                if assets:
                    print(f"Found {len(assets)} assets")
                    if input("Proceed with update? (y/n): ").lower() == 'y':
                        update_assets(assets)
            else:
                print("File not found!")
                
        elif choice == '3':
            staff_file = input("Enter staff file path: ").strip()
            assets_file = input("Enter assets CSV file path: ").strip()
            
            if os.path.exists(staff_file) and os.path.exists(assets_file):
                staff_names = read_staff_file(staff_file)
                assets = read_assets_file(assets_file)
                
                if staff_names and assets:
                    print(f"Found {len(staff_names)} staff members and {len(assets)} assets")
                    if input("Proceed with update? (y/n): ").lower() == 'y':
                        update_staff(staff_names)
                        update_assets(assets)
            else:
                print("One or both files not found!")
                
        elif choice == '4':
            try:
                staff_response = requests.get(f"{BASE_URL}/staff")
                assets_response = requests.get(f"{BASE_URL}/assets")
                
                if staff_response.status_code == 200 and assets_response.status_code == 200:
                    staff_count = len(staff_response.json())
                    assets_count = len(assets_response.json())
                    print(f"\nCurrent counts:")
                    print(f"📝 Staff members: {staff_count}")
                    print(f"🚜 Machine assets: {assets_count}")
                else:
                    print("Failed to fetch current counts")
            except Exception as e:
                print(f"Error fetching counts: {e}")
                
        elif choice == '5':
            print("Goodbye!")
            break
        else:
            print("Invalid choice!")

def main():
    parser = argparse.ArgumentParser(description='Update Abreys Machine Checklist data')
    parser.add_argument('--staff', help='Staff names file (one name per line)')
    parser.add_argument('--assets', help='Assets CSV file (make,model format)')
    parser.add_argument('--interactive', action='store_true', help='Run in interactive mode')
    
    args = parser.parse_args()
    
    if args.interactive:
        interactive_mode()
        return
    
    if not args.staff and not args.assets:
        print("No files specified. Use --interactive for interactive mode or --help for usage.")
        return
    
    success = True
    
    if args.staff:
        if os.path.exists(args.staff):
            staff_names = read_staff_file(args.staff)
            if staff_names:
                print(f"📝 Updating {len(staff_names)} staff members...")
                if not update_staff(staff_names):
                    success = False
            else:
                print("❌ Failed to read staff file")
                success = False
        else:
            print(f"❌ Staff file not found: {args.staff}")
            success = False
    
    if args.assets:
        if os.path.exists(args.assets):
            assets = read_assets_file(args.assets)
            if assets:
                print(f"🚜 Updating {len(assets)} assets...")
                if not update_assets(assets):
                    success = False
            else:
                print("❌ Failed to read assets file")
                success = False
        else:
            print(f"❌ Assets file not found: {args.assets}")
            success = False
    
    if success:
        print("\n✅ All updates completed successfully!")
    else:
        print("\n❌ Some updates failed!")

if __name__ == "__main__":
    main()