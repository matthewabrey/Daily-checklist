#!/usr/bin/env python3
from openpyxl import load_workbook

def debug_backend_logic():
    file_path = "/tmp/AssetList_updated.xlsx"
    workbook = load_workbook(file_path)
    sheet = workbook.active
    
    # Simulate backend logic
    headers = [str(cell.value).strip().lower() if cell.value else '' for cell in sheet[1]]
    
    check_type_col = None
    name_col = None
    make_col = None
    
    print("Headers processing:")
    for i, header in enumerate(headers):
        print(f"  {i}: '{header}'")
        
        if header == 'check type' or 'checktype' in header:
            check_type_col = i
            print(f"    -> Found check_type_col at {i}")
        elif header == 'namecolumn' or 'name' in header:
            name_col = i
            print(f"    -> Found name_col at {i}")
        elif header == 'makecolumn' or 'make' in header:
            make_col = i
            print(f"    -> Found make_col at {i}")
    
    print(f"\nResults:")
    print(f"check_type_col: {check_type_col}")
    print(f"name_col: {name_col}")
    print(f"make_col: {make_col}")
    
    if check_type_col is None or name_col is None or make_col is None:
        print("❌ Missing required columns!")
    else:
        print("✅ All columns found!")

if __name__ == "__main__":
    debug_backend_logic()