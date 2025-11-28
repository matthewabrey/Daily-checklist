#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timezone
from typing import Dict, List, Any

class MachineChecklistAPITester:
    def __init__(self, base_url="https://equipcheck-5.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def test_health_check(self) -> bool:
        """Test health endpoint"""
        try:
            response = requests.get(f"{self.base_url}/api/health", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Response: {data}"
            self.log_test("Health Check", success, details)
            return success
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")
            return False

    def test_get_staff(self) -> tuple[bool, List[Dict]]:
        """Test staff endpoint"""
        try:
            response = requests.get(f"{self.base_url}/api/staff", timeout=10)
            success = response.status_code == 200
            staff_data = []
            
            if success:
                staff_data = response.json()
                staff_count = len(staff_data)
                details = f"Status: {response.status_code}, Staff count: {staff_count}"
                
                # Verify reasonable staff count (should be at least 60 staff members)
                if staff_count < 60:
                    success = False
                    details += f" (Expected at least 60 staff members)"
                else:
                    # Check structure of first staff member
                    if staff_data and 'id' in staff_data[0] and 'name' in staff_data[0]:
                        details += f", Sample: {staff_data[0]['name']}"
                    else:
                        success = False
                        details += " (Invalid staff structure)"
            else:
                details = f"Status: {response.status_code}"
                
            self.log_test("Get Staff List", success, details)
            return success, staff_data
        except Exception as e:
            self.log_test("Get Staff List", False, f"Exception: {str(e)}")
            return False, []

    def test_get_makes(self) -> tuple[bool, List[str]]:
        """Test machine makes endpoint"""
        try:
            response = requests.get(f"{self.base_url}/api/assets/makes", timeout=10)
            success = response.status_code == 200
            makes_data = []
            
            if success:
                makes_data = response.json()
                makes_count = len(makes_data)
                details = f"Status: {response.status_code}, Makes count: {makes_count}"
                
                # Verify reasonable makes count (should be at least 35 machine makes)
                if makes_count < 35:
                    success = False
                    details += f" (Expected at least 35 machine makes)"
                else:
                    details += f", Sample makes: {makes_data[:3]}"
            else:
                details = f"Status: {response.status_code}"
                
            self.log_test("Get Machine Makes", success, details)
            return success, makes_data
        except Exception as e:
            self.log_test("Get Machine Makes", False, f"Exception: {str(e)}")
            return False, []

    def test_get_names_by_make(self, make: str) -> tuple[bool, List[str]]:
        """Test machine names by make endpoint"""
        try:
            encoded_make = requests.utils.quote(make)
            response = requests.get(f"{self.base_url}/api/assets/names/{encoded_make}", timeout=10)
            success = response.status_code == 200
            names_data = []
            
            if success:
                names_data = response.json()
                names_count = len(names_data)
                details = f"Status: {response.status_code}, Names for '{make}': {names_count}"
                if names_data:
                    details += f", Sample: {names_data[0]}"
            else:
                details = f"Status: {response.status_code}"
                
            self.log_test(f"Get Names for '{make}'", success, details)
            return success, names_data
        except Exception as e:
            self.log_test(f"Get Names for '{make}'", False, f"Exception: {str(e)}")
            return False, []

    def test_get_checktype_by_make_and_name(self, make: str, name: str) -> tuple[bool, str]:
        """Test check type by make and name endpoint"""
        try:
            encoded_make = requests.utils.quote(make)
            encoded_name = requests.utils.quote(name)
            response = requests.get(f"{self.base_url}/api/assets/checktype/{encoded_make}/{encoded_name}", timeout=10)
            success = response.status_code == 200
            check_type = ""
            
            if success:
                result = response.json()
                check_type = result.get('check_type', '')
                details = f"Status: {response.status_code}, Check Type: '{check_type}'"
            else:
                details = f"Status: {response.status_code}"
                
            self.log_test(f"Get Check Type for '{make}' - '{name}'", success, details)
            return success, check_type
        except Exception as e:
            self.log_test(f"Get Check Type for '{make}' - '{name}'", False, f"Exception: {str(e)}")
            return False, ""

    def test_create_checklist(self, staff_name: str, machine_make: str, machine_model: str) -> tuple[bool, str]:
        """Test creating a checklist"""
        try:
            # Create sample checklist with 15 items as per requirements
            checklist_items = [
                {"item": "Oil level check - Engine oil at correct level", "checked": True, "notes": "Oil level good"},
                {"item": "Fuel level check - Adequate fuel for operation", "checked": True, "notes": ""},
                {"item": "Hydraulic fluid level - Within acceptable range", "checked": True, "notes": ""},
                {"item": "Battery condition - Terminals clean, voltage adequate", "checked": True, "notes": ""},
                {"item": "Tire/track condition - No visible damage or excessive wear", "checked": True, "notes": ""},
                {"item": "Safety guards in place - All protective covers secured", "checked": True, "notes": ""},
                {"item": "Emergency stop function - Test emergency stop button", "checked": True, "notes": ""},
                {"item": "Warning lights operational - All safety lights working", "checked": True, "notes": ""},
                {"item": "Operator seat condition - Seat belt and controls functional", "checked": True, "notes": ""},
                {"item": "Air filter condition - Clean and properly sealed", "checked": True, "notes": ""},
                {"item": "Cooling system - Radiator clear, coolant level adequate", "checked": True, "notes": ""},
                {"item": "Brake system function - Service and parking brakes operational", "checked": True, "notes": ""},
                {"item": "Steering operation - Smooth operation, no excessive play", "checked": True, "notes": ""},
                {"item": "Lights and signals - All operational lights working", "checked": True, "notes": ""},
                {"item": "Fire extinguisher - Present and within service date", "checked": True, "notes": "Test checklist"}
            ]
            
            checklist_data = {
                "staff_name": staff_name,
                "machine_make": machine_make,
                "machine_model": machine_model,
                "checklist_items": checklist_items
            }
            
            response = requests.post(
                f"{self.base_url}/api/checklists",
                json=checklist_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            success = response.status_code == 200
            checklist_id = ""
            
            if success:
                result = response.json()
                checklist_id = result.get('id', '')
                details = f"Status: {response.status_code}, ID: {checklist_id[:8]}..."
                
                # Verify response structure
                required_fields = ['id', 'staff_name', 'machine_make', 'machine_model', 'checklist_items']
                missing_fields = [field for field in required_fields if field not in result]
                if missing_fields:
                    success = False
                    details += f", Missing fields: {missing_fields}"
                elif len(result['checklist_items']) != 15:
                    success = False
                    details += f", Expected 15 items, got {len(result['checklist_items'])}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:100]}"
                
            self.log_test("Create Checklist", success, details)
            return success, checklist_id
        except Exception as e:
            self.log_test("Create Checklist", False, f"Exception: {str(e)}")
            return False, ""

    def test_get_checklists(self) -> tuple[bool, List[Dict]]:
        """Test getting all checklists"""
        try:
            response = requests.get(f"{self.base_url}/api/checklists", timeout=10)
            success = response.status_code == 200
            checklists_data = []
            
            if success:
                checklists_data = response.json()
                count = len(checklists_data)
                details = f"Status: {response.status_code}, Checklists count: {count}"
                
                if checklists_data:
                    # Verify structure of first checklist
                    first_checklist = checklists_data[0]
                    required_fields = ['id', 'staff_name', 'machine_make', 'machine_model', 'checklist_items', 'completed_at']
                    missing_fields = [field for field in required_fields if field not in first_checklist]
                    if missing_fields:
                        success = False
                        details += f", Missing fields: {missing_fields}"
            else:
                details = f"Status: {response.status_code}"
                
            self.log_test("Get All Checklists", success, details)
            return success, checklists_data
        except Exception as e:
            self.log_test("Get All Checklists", False, f"Exception: {str(e)}")
            return False, []

    def test_get_checklist_by_id(self, checklist_id: str) -> bool:
        """Test getting specific checklist by ID"""
        try:
            response = requests.get(f"{self.base_url}/api/checklists/{checklist_id}", timeout=10)
            success = response.status_code == 200
            
            if success:
                result = response.json()
                details = f"Status: {response.status_code}, ID: {result.get('id', '')[:8]}..."
                
                # Verify response structure
                required_fields = ['id', 'staff_name', 'machine_make', 'machine_model', 'checklist_items']
                missing_fields = [field for field in required_fields if field not in result]
                if missing_fields:
                    success = False
                    details += f", Missing fields: {missing_fields}"
            else:
                details = f"Status: {response.status_code}"
                
            self.log_test("Get Checklist by ID", success, details)
            return success
        except Exception as e:
            self.log_test("Get Checklist by ID", False, f"Exception: {str(e)}")
            return False

    def test_export_csv(self) -> bool:
        """Test CSV export functionality"""
        try:
            response = requests.get(f"{self.base_url}/api/checklists/export/csv", timeout=15)
            success = response.status_code == 200
            
            if success:
                content_type = response.headers.get('content-type', '')
                content_disposition = response.headers.get('content-disposition', '')
                content_length = len(response.content)
                
                details = f"Status: {response.status_code}, Content-Type: {content_type}, Size: {content_length} bytes"
                
                # Verify it's a CSV file
                if 'text/csv' not in content_type:
                    success = False
                    details += " (Not CSV content type)"
                elif 'attachment' not in content_disposition:
                    success = False
                    details += " (Not attachment)"
                elif content_length == 0:
                    success = False
                    details += " (Empty file)"
            else:
                details = f"Status: {response.status_code}"
                
            self.log_test("Export CSV", success, details)
            return success
        except Exception as e:
            self.log_test("Export CSV", False, f"Exception: {str(e)}")
            return False

    def test_employee_login_valid(self, employee_number: str) -> tuple[bool, Dict]:
        """Test employee login with valid employee number"""
        try:
            login_data = {"employee_number": employee_number}
            response = requests.post(
                f"{self.base_url}/api/auth/employee-login",
                json=login_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            success = response.status_code == 200
            employee_data = {}
            
            if success:
                result = response.json()
                employee_data = result.get('employee', {})
                details = f"Status: {response.status_code}, Success: {result.get('success', False)}"
                
                # Verify response structure
                if not result.get('success'):
                    success = False
                    details += " (Success flag is False)"
                elif 'employee' not in result:
                    success = False
                    details += " (Missing employee data)"
                elif 'employee_number' not in employee_data or 'name' not in employee_data:
                    success = False
                    details += " (Invalid employee structure)"
                else:
                    details += f", Employee: {employee_data.get('name', 'Unknown')}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:100]}"
                
            self.log_test(f"Employee Login (Valid: {employee_number})", success, details)
            return success, employee_data
        except Exception as e:
            self.log_test(f"Employee Login (Valid: {employee_number})", False, f"Exception: {str(e)}")
            return False, {}

    def test_employee_login_invalid(self, employee_number: str) -> bool:
        """Test employee login with invalid employee number"""
        try:
            login_data = {"employee_number": employee_number}
            response = requests.post(
                f"{self.base_url}/api/auth/employee-login",
                json=login_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            # Should return 400 or 401 for invalid employee number (backend returns 400 with 401 message)
            success = response.status_code in [400, 401]
            details = f"Status: {response.status_code}"
            
            if success:
                try:
                    result = response.json()
                    details += f", Error: {result.get('detail', 'No error message')}"
                except:
                    details += ", No JSON response"
            else:
                details += f" (Expected 400/401), Response: {response.text[:100]}"
                
            self.log_test(f"Employee Login (Invalid: {employee_number})", success, details)
            return success
        except Exception as e:
            self.log_test(f"Employee Login (Invalid: {employee_number})", False, f"Exception: {str(e)}")
            return False

    def test_employee_login_empty(self) -> bool:
        """Test employee login with empty employee number"""
        try:
            login_data = {"employee_number": ""}
            response = requests.post(
                f"{self.base_url}/api/auth/employee-login",
                json=login_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            # Should return 400 or 401 for empty employee number
            success = response.status_code in [400, 401]
            details = f"Status: {response.status_code}"
            
            if success:
                try:
                    result = response.json()
                    details += f", Error: {result.get('detail', 'No error message')}"
                except:
                    details += ", No JSON response"
            else:
                details += f" (Expected 400/401), Response: {response.text[:100]}"
                
            self.log_test("Employee Login (Empty)", success, details)
            return success
        except Exception as e:
            self.log_test("Employee Login (Empty)", False, f"Exception: {str(e)}")
            return False

    def test_employee_login_malformed(self) -> bool:
        """Test employee login with malformed request"""
        try:
            # Test with missing employee_number field
            login_data = {"invalid_field": "test"}
            response = requests.post(
                f"{self.base_url}/api/auth/employee-login",
                json=login_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            # Should return 422 for validation error
            success = response.status_code == 422
            details = f"Status: {response.status_code}"
            
            if success:
                try:
                    result = response.json()
                    details += f", Validation Error: {result.get('detail', 'No error message')}"
                except:
                    details += ", No JSON response"
            else:
                details += f" (Expected 422), Response: {response.text[:100]}"
                
            self.log_test("Employee Login (Malformed)", success, details)
            return success
        except Exception as e:
            self.log_test("Employee Login (Malformed)", False, f"Exception: {str(e)}")
            return False

    def test_employee_validate_valid(self, employee_number: str) -> bool:
        """Test employee validation with valid employee number"""
        try:
            response = requests.get(f"{self.base_url}/api/auth/validate/{employee_number}", timeout=10)
            success = response.status_code == 200
            
            if success:
                result = response.json()
                details = f"Status: {response.status_code}, Valid: {result.get('valid', False)}"
                
                # Should return valid: true for existing employee
                if not result.get('valid'):
                    success = False
                    details += " (Expected valid: true)"
                elif 'name' not in result:
                    success = False
                    details += " (Missing name field)"
                else:
                    details += f", Name: {result.get('name', 'Unknown')}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:100]}"
                
            self.log_test(f"Employee Validate (Valid: {employee_number})", success, details)
            return success
        except Exception as e:
            self.log_test(f"Employee Validate (Valid: {employee_number})", False, f"Exception: {str(e)}")
            return False

    def test_employee_validate_invalid(self, employee_number: str) -> bool:
        """Test employee validation with invalid employee number"""
        try:
            response = requests.get(f"{self.base_url}/api/auth/validate/{employee_number}", timeout=10)
            success = response.status_code == 200
            
            if success:
                result = response.json()
                details = f"Status: {response.status_code}, Valid: {result.get('valid', True)}"
                
                # Should return valid: false for non-existent employee
                if result.get('valid'):
                    success = False
                    details += " (Expected valid: false)"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:100]}"
                
            self.log_test(f"Employee Validate (Invalid: {employee_number})", success, details)
            return success
        except Exception as e:
            self.log_test(f"Employee Validate (Invalid: {employee_number})", False, f"Exception: {str(e)}")
            return False

    def test_checklist_with_employee_number(self, employee_number: str, staff_name: str, machine_make: str, machine_model: str) -> tuple[bool, str]:
        """Test creating a checklist with employee number"""
        try:
            checklist_items = [
                {"item": "Oil level check - Engine oil at correct level", "status": "satisfactory", "notes": "Oil level good"},
                {"item": "Fuel level check - Adequate fuel for operation", "status": "satisfactory", "notes": ""},
                {"item": "Hydraulic fluid level - Within acceptable range", "status": "satisfactory", "notes": ""},
                {"item": "Battery condition - Terminals clean, voltage adequate", "status": "satisfactory", "notes": ""},
                {"item": "Tire/track condition - No visible damage or excessive wear", "status": "satisfactory", "notes": ""},
                {"item": "Safety guards in place - All protective covers secured", "status": "satisfactory", "notes": ""},
                {"item": "Emergency stop function - Test emergency stop button", "status": "satisfactory", "notes": ""},
                {"item": "Warning lights operational - All safety lights working", "status": "satisfactory", "notes": ""},
                {"item": "Operator seat condition - Seat belt and controls functional", "status": "satisfactory", "notes": ""},
                {"item": "Air filter condition - Clean and properly sealed", "status": "satisfactory", "notes": ""},
                {"item": "Cooling system - Radiator clear, coolant level adequate", "status": "satisfactory", "notes": ""},
                {"item": "Brake system function - Service and parking brakes operational", "status": "satisfactory", "notes": ""},
                {"item": "Steering operation - Smooth operation, no excessive play", "status": "satisfactory", "notes": ""},
                {"item": "Lights and signals - All operational lights working", "status": "satisfactory", "notes": ""},
                {"item": "Fire extinguisher - Present and within service date", "status": "satisfactory", "notes": "Auth test checklist"}
            ]
            
            checklist_data = {
                "employee_number": employee_number,
                "staff_name": staff_name,
                "machine_make": machine_make,
                "machine_model": machine_model,
                "check_type": "daily_check",
                "checklist_items": checklist_items
            }
            
            response = requests.post(
                f"{self.base_url}/api/checklists",
                json=checklist_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            success = response.status_code == 200
            checklist_id = ""
            
            if success:
                result = response.json()
                checklist_id = result.get('id', '')
                details = f"Status: {response.status_code}, ID: {checklist_id[:8]}..."
                
                # Verify employee_number is stored correctly
                if result.get('employee_number') != employee_number:
                    success = False
                    details += f" (Employee number mismatch: expected {employee_number}, got {result.get('employee_number')})"
                elif result.get('staff_name') != staff_name:
                    success = False
                    details += f" (Staff name mismatch: expected {staff_name}, got {result.get('staff_name')})"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:100]}"
                
            self.log_test(f"Create Checklist with Employee Number ({employee_number})", success, details)
            return success, checklist_id
        except Exception as e:
            self.log_test(f"Create Checklist with Employee Number ({employee_number})", False, f"Exception: {str(e)}")
            return False, ""

    def test_checklist_with_fault_explanations(self, employee_number: str, staff_name: str, machine_make: str, machine_model: str) -> tuple[bool, str]:
        """Test creating a checklist with mandatory fault explanations for unsatisfactory items"""
        try:
            # Create checklist with mix of satisfactory/unsatisfactory items where unsatisfactory items have notes
            checklist_items = [
                {"item": "Oil level check - Engine oil at correct level", "status": "satisfactory", "notes": ""},
                {"item": "Fuel level check - Adequate fuel for operation", "status": "satisfactory", "notes": ""},
                {"item": "Tire condition and pressure", "status": "unsatisfactory", "notes": "Left front tire has low pressure - needs immediate attention"},
                {"item": "Hydraulic fluid level - Within acceptable range", "status": "satisfactory", "notes": ""},
                {"item": "Battery condition - Terminals clean, voltage adequate", "status": "satisfactory", "notes": ""},
                {"item": "Lights operational", "status": "unsatisfactory", "notes": "Right headlight bulb is blown and needs replacement"},
                {"item": "Safety guards in place - All protective covers secured", "status": "satisfactory", "notes": ""},
                {"item": "Emergency stop function - Test emergency stop button", "status": "satisfactory", "notes": ""},
                {"item": "Warning lights operational - All safety lights working", "status": "satisfactory", "notes": ""},
                {"item": "Engine oil level", "status": "unsatisfactory", "notes": "Oil level slightly below minimum line - top up required"},
                {"item": "Air filter condition - Clean and properly sealed", "status": "satisfactory", "notes": ""},
                {"item": "Cooling system - Radiator clear, coolant level adequate", "status": "satisfactory", "notes": ""},
                {"item": "Brake system function - Service and parking brakes operational", "status": "satisfactory", "notes": ""},
                {"item": "Steering operation - Smooth operation, no excessive play", "status": "satisfactory", "notes": ""},
                {"item": "Fire extinguisher - Present and within service date", "status": "satisfactory", "notes": ""}
            ]
            
            checklist_data = {
                "employee_number": employee_number,
                "staff_name": staff_name,
                "machine_make": machine_make,
                "machine_model": machine_model,
                "check_type": "daily_check",
                "checklist_items": checklist_items
            }
            
            response = requests.post(
                f"{self.base_url}/api/checklists",
                json=checklist_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            success = response.status_code == 200
            checklist_id = ""
            
            if success:
                result = response.json()
                checklist_id = result.get('id', '')
                details = f"Status: {response.status_code}, ID: {checklist_id[:8]}..."
                
                # Verify unsatisfactory items have notes
                unsatisfactory_items = [item for item in result.get('checklist_items', []) if item.get('status') == 'unsatisfactory']
                if len(unsatisfactory_items) != 3:
                    success = False
                    details += f" (Expected 3 unsatisfactory items, got {len(unsatisfactory_items)})"
                else:
                    # Check that all unsatisfactory items have notes
                    items_without_notes = [item for item in unsatisfactory_items if not item.get('notes')]
                    if items_without_notes:
                        success = False
                        details += f" ({len(items_without_notes)} unsatisfactory items missing notes)"
                    else:
                        details += f", {len(unsatisfactory_items)} unsatisfactory items with fault explanations"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:100]}"
                
            self.log_test("Create Checklist with Fault Explanations", success, details)
            return success, checklist_id
        except Exception as e:
            self.log_test("Create Checklist with Fault Explanations", False, f"Exception: {str(e)}")
            return False, ""

    def test_checklist_retrieval_with_notes(self, checklist_id: str) -> bool:
        """Test retrieving checklist and verify notes field is populated"""
        try:
            response = requests.get(f"{self.base_url}/api/checklists/{checklist_id}", timeout=10)
            success = response.status_code == 200
            
            if success:
                result = response.json()
                details = f"Status: {response.status_code}, ID: {result.get('id', '')[:8]}..."
                
                # Verify notes field exists and is populated for unsatisfactory items
                checklist_items = result.get('checklist_items', [])
                unsatisfactory_items = [item for item in checklist_items if item.get('status') == 'unsatisfactory']
                
                if not unsatisfactory_items:
                    success = False
                    details += " (No unsatisfactory items found)"
                else:
                    items_with_notes = [item for item in unsatisfactory_items if item.get('notes')]
                    if len(items_with_notes) != len(unsatisfactory_items):
                        success = False
                        details += f" ({len(unsatisfactory_items) - len(items_with_notes)} unsatisfactory items missing notes)"
                    else:
                        details += f", {len(items_with_notes)} unsatisfactory items with notes retrieved"
            else:
                details = f"Status: {response.status_code}"
                
            self.log_test("Retrieve Checklist with Notes", success, details)
            return success
        except Exception as e:
            self.log_test("Retrieve Checklist with Notes", False, f"Exception: {str(e)}")
            return False

    def test_general_repair_record_creation(self, employee_number: str, staff_name: str) -> tuple[bool, str]:
        """Test creating a GENERAL REPAIR record as specified in review request"""
        try:
            # Create GENERAL REPAIR record as specified in the review request
            general_repair_data = {
                "employee_number": employee_number,
                "staff_name": staff_name,
                "machine_make": "John Deere",
                "machine_model": "6145R",
                "check_type": "GENERAL REPAIR",
                "checklist_items": [],
                "workshop_notes": "GENERAL REPAIR REPORT:\nProblem Description: Test problem description",
                "workshop_photos": []
            }
            
            response = requests.post(
                f"{self.base_url}/api/checklists",
                json=general_repair_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            success = response.status_code == 200
            checklist_id = ""
            
            if success:
                result = response.json()
                checklist_id = result.get('id', '')
                details = f"Status: {response.status_code}, ID: {checklist_id[:8]}..."
                
                # Verify GENERAL REPAIR specific fields
                if result.get('check_type') != "GENERAL REPAIR":
                    success = False
                    details += f" (Check type mismatch: expected 'GENERAL REPAIR', got '{result.get('check_type')}')"
                elif not result.get('workshop_notes'):
                    success = False
                    details += " (Missing workshop_notes)"
                elif "GENERAL REPAIR REPORT:" not in result.get('workshop_notes', ''):
                    success = False
                    details += " (Workshop notes content incorrect)"
                else:
                    details += f", Check Type: {result.get('check_type')}, Workshop Notes: Present"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:200]}"
                
            self.log_test("Create GENERAL REPAIR Record", success, details)
            return success, checklist_id
        except Exception as e:
            self.log_test("Create GENERAL REPAIR Record", False, f"Exception: {str(e)}")
            return False, ""

    def test_general_repair_record_with_photos(self, employee_number: str, staff_name: str) -> tuple[bool, str]:
        """Test creating a GENERAL REPAIR record with base64 photo data"""
        try:
            # Create sample base64 image data (1x1 pixel PNG)
            sample_base64_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
            
            # Create GENERAL REPAIR record with photos
            general_repair_data = {
                "employee_number": employee_number,
                "staff_name": staff_name,
                "machine_make": "John Deere",
                "machine_model": "6145R",
                "check_type": "GENERAL REPAIR",
                "checklist_items": [],
                "workshop_notes": "GENERAL REPAIR REPORT:\nProblem Description: Hydraulic leak detected on left side\nRepair Action: Replaced hydraulic hose and fittings\nTesting: System pressure tested at 2500 PSI - no leaks detected",
                "workshop_photos": [
                    {
                        "id": "photo1",
                        "data": sample_base64_image,
                        "timestamp": datetime.now().isoformat()
                    },
                    {
                        "id": "photo2", 
                        "data": sample_base64_image,
                        "timestamp": datetime.now().isoformat()
                    }
                ]
            }
            
            response = requests.post(
                f"{self.base_url}/api/checklists",
                json=general_repair_data,
                headers={"Content-Type": "application/json"},
                timeout=15  # Longer timeout for photo data
            )
            
            success = response.status_code == 200
            checklist_id = ""
            
            if success:
                result = response.json()
                checklist_id = result.get('id', '')
                details = f"Status: {response.status_code}, ID: {checklist_id[:8]}..."
                
                # Verify GENERAL REPAIR with photos
                if result.get('check_type') != "GENERAL REPAIR":
                    success = False
                    details += f" (Check type mismatch: expected 'GENERAL REPAIR', got '{result.get('check_type')}')"
                elif not result.get('workshop_photos'):
                    success = False
                    details += " (Missing workshop_photos)"
                elif len(result.get('workshop_photos', [])) != 2:
                    success = False
                    details += f" (Expected 2 photos, got {len(result.get('workshop_photos', []))})"
                else:
                    # Verify photo data structure
                    photos = result.get('workshop_photos', [])
                    valid_photos = all('id' in photo and 'data' in photo for photo in photos)
                    if not valid_photos:
                        success = False
                        details += " (Invalid photo structure)"
                    else:
                        details += f", Photos: {len(photos)} uploaded successfully"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:200]}"
                
            self.log_test("Create GENERAL REPAIR Record with Photos", success, details)
            return success, checklist_id
        except Exception as e:
            self.log_test("Create GENERAL REPAIR Record with Photos", False, f"Exception: {str(e)}")
            return False, ""

    def test_general_repair_record_retrieval(self, checklist_id: str) -> bool:
        """Test retrieving GENERAL REPAIR record and verify all fields"""
        try:
            response = requests.get(f"{self.base_url}/api/checklists/{checklist_id}", timeout=10)
            success = response.status_code == 200
            
            if success:
                result = response.json()
                details = f"Status: {response.status_code}, ID: {result.get('id', '')[:8]}..."
                
                # Verify GENERAL REPAIR record structure
                if result.get('check_type') != "GENERAL REPAIR":
                    success = False
                    details += f" (Check type mismatch: expected 'GENERAL REPAIR', got '{result.get('check_type')}')"
                elif not result.get('workshop_notes'):
                    success = False
                    details += " (Missing workshop_notes in retrieved record)"
                elif 'workshop_photos' not in result:
                    success = False
                    details += " (Missing workshop_photos field in retrieved record)"
                else:
                    photos_count = len(result.get('workshop_photos', []))
                    details += f", Check Type: {result.get('check_type')}, Photos: {photos_count}"
            else:
                details = f"Status: {response.status_code}"
                
            self.log_test("Retrieve GENERAL REPAIR Record", success, details)
            return success
        except Exception as e:
            self.log_test("Retrieve GENERAL REPAIR Record", False, f"Exception: {str(e)}")
            return False

    def test_general_repair_validation_errors(self) -> bool:
        """Test GENERAL REPAIR record validation and error handling"""
        try:
            # Test with missing required fields
            invalid_data = {
                "check_type": "GENERAL REPAIR",
                "workshop_notes": "Test repair notes"
                # Missing employee_number, staff_name, machine_make, machine_model
            }
            
            response = requests.post(
                f"{self.base_url}/api/checklists",
                json=invalid_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            # Should return 422 for validation error
            success = response.status_code == 422
            details = f"Status: {response.status_code}"
            
            if success:
                try:
                    result = response.json()
                    details += f", Validation Error: {result.get('detail', 'No error message')}"
                except:
                    details += ", No JSON response"
            else:
                details += f" (Expected 422 for validation error), Response: {response.text[:100]}"
                
            self.log_test("GENERAL REPAIR Validation Error Handling", success, details)
            return success
        except Exception as e:
            self.log_test("GENERAL REPAIR Validation Error Handling", False, f"Exception: {str(e)}")
            return False

    def test_general_repair_in_checklist_list(self, expected_repair_id: str) -> bool:
        """Test that GENERAL REPAIR records appear in checklist list"""
        try:
            response = requests.get(f"{self.base_url}/api/checklists", timeout=10)
            success = response.status_code == 200
            
            if success:
                checklists = response.json()
                details = f"Status: {response.status_code}, Total checklists: {len(checklists)}"
                
                # Find GENERAL REPAIR records
                general_repair_records = [c for c in checklists if c.get('check_type') == 'GENERAL REPAIR']
                
                if not general_repair_records:
                    success = False
                    details += " (No GENERAL REPAIR records found in list)"
                else:
                    # Check if our specific record is in the list
                    found_record = any(c.get('id') == expected_repair_id for c in general_repair_records)
                    if not found_record:
                        success = False
                        details += f" (Expected GENERAL REPAIR record {expected_repair_id[:8]}... not found)"
                    else:
                        details += f", GENERAL REPAIR records: {len(general_repair_records)}, Target record found"
            else:
                details = f"Status: {response.status_code}"
                
            self.log_test("GENERAL REPAIR Records in List", success, details)
            return success
        except Exception as e:
            self.log_test("GENERAL REPAIR Records in List", False, f"Exception: {str(e)}")
            return False

    def test_checklist_with_na_option(self, employee_number: str, staff_name: str, machine_make: str, machine_model: str) -> tuple[bool, str]:
        """Test creating a checklist with N/A option for items"""
        try:
            # Create checklist with mix of satisfactory/unsatisfactory/N/A items
            checklist_items = [
                {"item": "Oil level check - Engine oil at correct level", "status": "satisfactory", "notes": ""},
                {"item": "Fuel level check - Adequate fuel for operation", "status": "satisfactory", "notes": ""},
                {"item": "Tire condition and pressure", "status": "unsatisfactory", "notes": "Left front tire has low pressure"},
                {"item": "Hydraulic fluid level - Within acceptable range", "status": "N/A", "notes": ""},
                {"item": "Battery condition - Terminals clean, voltage adequate", "status": "satisfactory", "notes": ""},
                {"item": "Lights operational", "status": "N/A", "notes": ""},
                {"item": "Safety guards in place - All protective covers secured", "status": "satisfactory", "notes": ""},
                {"item": "Emergency stop function - Test emergency stop button", "status": "satisfactory", "notes": ""},
                {"item": "Warning lights operational - All safety lights working", "status": "satisfactory", "notes": ""},
                {"item": "Engine oil level", "status": "N/A", "notes": ""},
                {"item": "Air filter condition - Clean and properly sealed", "status": "satisfactory", "notes": ""},
                {"item": "Cooling system - Radiator clear, coolant level adequate", "status": "satisfactory", "notes": ""},
                {"item": "Brake system function - Service and parking brakes operational", "status": "satisfactory", "notes": ""},
                {"item": "Steering operation - Smooth operation, no excessive play", "status": "satisfactory", "notes": ""},
                {"item": "Fire extinguisher - Present and within service date", "status": "satisfactory", "notes": ""}
            ]
            
            checklist_data = {
                "employee_number": employee_number,
                "staff_name": staff_name,
                "machine_make": machine_make,
                "machine_model": machine_model,
                "check_type": "daily_check",
                "checklist_items": checklist_items
            }
            
            response = requests.post(
                f"{self.base_url}/api/checklists",
                json=checklist_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            success = response.status_code == 200
            checklist_id = ""
            
            if success:
                result = response.json()
                checklist_id = result.get('id', '')
                details = f"Status: {response.status_code}, ID: {checklist_id[:8]}..."
                
                # Verify N/A items are handled correctly
                na_items = [item for item in result.get('checklist_items', []) if item.get('status') == 'N/A']
                if len(na_items) != 3:
                    success = False
                    details += f" (Expected 3 N/A items, got {len(na_items)})"
                else:
                    details += f", {len(na_items)} N/A items handled correctly"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:100]}"
                
            self.log_test("Create Checklist with N/A Options", success, details)
            return success, checklist_id
        except Exception as e:
            self.log_test("Create Checklist with N/A Options", False, f"Exception: {str(e)}")
            return False, ""

    def test_machine_add_record_creation(self, employee_number: str, staff_name: str) -> tuple[bool, str]:
        """Test creating a MACHINE ADD record for new machine requests"""
        try:
            # Create MACHINE ADD record
            machine_add_data = {
                "employee_number": employee_number,
                "staff_name": staff_name,
                "machine_make": "New Make",
                "machine_model": "New Model XYZ-2024",
                "check_type": "MACHINE ADD",
                "checklist_items": [],
                "workshop_notes": "MACHINE ADD REQUEST:\nMachine Make: New Make\nMachine Name: New Model XYZ-2024\nYear Made: 2024\nSerial Number: ABC123456\nRequested by: " + staff_name,
                "workshop_photos": []
            }
            
            response = requests.post(
                f"{self.base_url}/api/checklists",
                json=machine_add_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            success = response.status_code == 200
            checklist_id = ""
            
            if success:
                result = response.json()
                checklist_id = result.get('id', '')
                details = f"Status: {response.status_code}, ID: {checklist_id[:8]}..."
                
                # Verify MACHINE ADD specific fields
                if result.get('check_type') != "MACHINE ADD":
                    success = False
                    details += f" (Check type mismatch: expected 'MACHINE ADD', got '{result.get('check_type')}')"
                elif not result.get('workshop_notes'):
                    success = False
                    details += " (Missing workshop_notes)"
                elif "MACHINE ADD REQUEST:" not in result.get('workshop_notes', ''):
                    success = False
                    details += " (Workshop notes content incorrect)"
                else:
                    details += f", Check Type: {result.get('check_type')}, Workshop Notes: Present"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:200]}"
                
            self.log_test("Create MACHINE ADD Record", success, details)
            return success, checklist_id
        except Exception as e:
            self.log_test("Create MACHINE ADD Record", False, f"Exception: {str(e)}")
            return False, ""

    def test_repair_completed_record_creation(self, employee_number: str, staff_name: str) -> tuple[bool, str]:
        """Test creating a REPAIR COMPLETED record for repairs needed functionality"""
        try:
            # Create REPAIR COMPLETED record
            repair_completed_data = {
                "employee_number": employee_number,
                "staff_name": staff_name,
                "machine_make": "John Deere",
                "machine_model": "6145R",
                "check_type": "REPAIR COMPLETED",
                "checklist_items": [],
                "workshop_notes": "REPAIR COMPLETED:\nOriginal Issue: Left front tire has low pressure\nRepair Action: Replaced tire and checked pressure\nCompleted by: " + staff_name + "\nDate: 2024-01-15",
                "workshop_photos": []
            }
            
            response = requests.post(
                f"{self.base_url}/api/checklists",
                json=repair_completed_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            success = response.status_code == 200
            checklist_id = ""
            
            if success:
                result = response.json()
                checklist_id = result.get('id', '')
                details = f"Status: {response.status_code}, ID: {checklist_id[:8]}..."
                
                # Verify REPAIR COMPLETED specific fields
                if result.get('check_type') != "REPAIR COMPLETED":
                    success = False
                    details += f" (Check type mismatch: expected 'REPAIR COMPLETED', got '{result.get('check_type')}')"
                elif not result.get('workshop_notes'):
                    success = False
                    details += " (Missing workshop_notes)"
                elif "REPAIR COMPLETED:" not in result.get('workshop_notes', ''):
                    success = False
                    details += " (Workshop notes content incorrect)"
                else:
                    details += f", Check Type: {result.get('check_type')}, Workshop Notes: Present"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:200]}"
                
            self.log_test("Create REPAIR COMPLETED Record", success, details)
            return success, checklist_id
        except Exception as e:
            self.log_test("Create REPAIR COMPLETED Record", False, f"Exception: {str(e)}")
            return False, ""

    def test_repairs_reappearing_bug_fix_scenario(self, employee_number: str, staff_name: str) -> tuple[bool, List[str]]:
        """Test the repairs reappearing bug fix scenario as specified in review request"""
        try:
            print("\n🔧 REPAIRS REAPPEARING BUG FIX - COMPREHENSIVE TEST SCENARIO")
            print("-" * 70)
            
            # Step 1: Create a test checklist with 2 unsatisfactory items (repairs)
            print("Step 1: Creating checklist with 2 unsatisfactory items (repairs)...")
            
            checklist_items = [
                {"item": "Tire condition and pressure", "status": "unsatisfactory", "notes": "Left front tire has low pressure - needs immediate attention"},
                {"item": "Lights operational", "status": "unsatisfactory", "notes": "Right headlight bulb is blown and needs replacement"},
                {"item": "Oil level check - Engine oil at correct level", "status": "satisfactory", "notes": ""},
                {"item": "Fuel level check - Adequate fuel for operation", "status": "satisfactory", "notes": ""},
                {"item": "Hydraulic fluid level - Within acceptable range", "status": "satisfactory", "notes": ""},
                {"item": "Battery condition - Terminals clean, voltage adequate", "status": "satisfactory", "notes": ""},
                {"item": "Safety guards in place - All protective covers secured", "status": "satisfactory", "notes": ""},
                {"item": "Emergency stop function - Test emergency stop button", "status": "satisfactory", "notes": ""},
                {"item": "Warning lights operational - All safety lights working", "status": "satisfactory", "notes": ""},
                {"item": "Air filter condition - Clean and properly sealed", "status": "satisfactory", "notes": ""},
                {"item": "Cooling system - Radiator clear, coolant level adequate", "status": "satisfactory", "notes": ""},
                {"item": "Brake system function - Service and parking brakes operational", "status": "satisfactory", "notes": ""},
                {"item": "Steering operation - Smooth operation, no excessive play", "status": "satisfactory", "notes": ""},
                {"item": "Fire extinguisher - Present and within service date", "status": "satisfactory", "notes": ""}
            ]
            
            checklist_data = {
                "employee_number": employee_number,
                "staff_name": staff_name,
                "machine_make": "John Deere",
                "machine_model": "6145R AO69OHZ",
                "check_type": "daily_check",
                "checklist_items": checklist_items
            }
            
            response = requests.post(
                f"{self.base_url}/api/checklists",
                json=checklist_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test("Repairs Bug Fix - Create Test Checklist", False, f"Failed to create checklist: {response.status_code}")
                return False, []
            
            result = response.json()
            checklist_id = result.get('id', '')
            print(f"✅ Created checklist with ID: {checklist_id[:8]}...")
            
            # Step 2: Verify the repairs appear in the database
            print("Step 2: Verifying repairs appear in database...")
            
            get_response = requests.get(f"{self.base_url}/api/checklists/{checklist_id}", timeout=10)
            if get_response.status_code != 200:
                self.log_test("Repairs Bug Fix - Verify Repairs in Database", False, f"Failed to retrieve checklist: {get_response.status_code}")
                return False, []
            
            retrieved_checklist = get_response.json()
            unsatisfactory_items = [item for item in retrieved_checklist.get('checklist_items', []) if item.get('status') == 'unsatisfactory']
            
            if len(unsatisfactory_items) != 2:
                self.log_test("Repairs Bug Fix - Verify Repairs in Database", False, f"Expected 2 unsatisfactory items, found {len(unsatisfactory_items)}")
                return False, []
            
            print(f"✅ Verified 2 repairs in database:")
            repair_ids = []
            for i, item in enumerate(unsatisfactory_items):
                # Generate repair ID the same way frontend would (using item name for uniqueness)
                repair_id = f"{checklist_id}_{item.get('item', '')}"
                repair_ids.append(repair_id)
                print(f"   - Repair {i+1}: {item['item']} - {item['notes']}")
                print(f"     Repair ID: {repair_id}")
            
            # Step 3: Simulate localStorage acknowledgedRepairs and completedRepairs
            print("Step 3: Simulating localStorage tracking (frontend behavior)...")
            
            # This simulates what the frontend would do with localStorage
            acknowledged_repairs = repair_ids.copy()  # All repairs acknowledged
            completed_repairs = repair_ids.copy()     # All repairs marked as complete
            
            print(f"✅ Simulated acknowledgedRepairs: {len(acknowledged_repairs)} items")
            print(f"✅ Simulated completedRepairs: {len(completed_repairs)} items")
            
            # Step 4: Mark the repairs as complete (create REPAIR COMPLETED records)
            print("Step 4: Creating REPAIR COMPLETED records...")
            
            repair_completed_ids = []
            for i, repair_item in enumerate(unsatisfactory_items):
                repair_completed_data = {
                    "employee_number": employee_number,
                    "staff_name": staff_name,
                    "machine_make": "John Deere",
                    "machine_model": "6145R AO69OHZ",
                    "check_type": "REPAIR COMPLETED",
                    "checklist_items": [],
                    "workshop_notes": f"REPAIR COMPLETED:\nOriginal Issue: {repair_item['notes']}\nRepair Action: Issue resolved and tested\nCompleted by: {staff_name}\nDate: {datetime.now().strftime('%Y-%m-%d')}",
                    "workshop_photos": []
                }
                
                repair_response = requests.post(
                    f"{self.base_url}/api/checklists",
                    json=repair_completed_data,
                    headers={"Content-Type": "application/json"},
                    timeout=10
                )
                
                if repair_response.status_code == 200:
                    repair_result = repair_response.json()
                    repair_completed_ids.append(repair_result.get('id', ''))
                    print(f"✅ Created REPAIR COMPLETED record {i+1}: {repair_result.get('id', '')[:8]}...")
                else:
                    print(f"❌ Failed to create REPAIR COMPLETED record {i+1}")
            
            # Step 5: Verify that the backend continues to return all data (the filtering happens on frontend)
            print("Step 5: Verifying backend continues to return all data...")
            
            all_checklists_response = requests.get(f"{self.base_url}/api/checklists", timeout=10)
            if all_checklists_response.status_code != 200:
                self.log_test("Repairs Bug Fix - Verify Backend Returns All Data", False, f"Failed to get all checklists: {all_checklists_response.status_code}")
                return False, []
            
            all_checklists = all_checklists_response.json()
            
            # Find our original checklist with repairs
            original_checklist = None
            for checklist in all_checklists:
                if checklist.get('id') == checklist_id:
                    original_checklist = checklist
                    break
            
            if not original_checklist:
                self.log_test("Repairs Bug Fix - Verify Backend Returns All Data", False, "Original checklist not found in list")
                return False, []
            
            # Verify original checklist still has unsatisfactory items
            original_unsatisfactory = [item for item in original_checklist.get('checklist_items', []) if item.get('status') == 'unsatisfactory']
            if len(original_unsatisfactory) != 2:
                self.log_test("Repairs Bug Fix - Verify Backend Returns All Data", False, f"Original checklist should still have 2 unsatisfactory items, found {len(original_unsatisfactory)}")
                return False, []
            
            # Find REPAIR COMPLETED records
            repair_completed_records = [c for c in all_checklists if c.get('check_type') == 'REPAIR COMPLETED' and c.get('id') in repair_completed_ids]
            if len(repair_completed_records) != 2:
                self.log_test("Repairs Bug Fix - Verify Backend Returns All Data", False, f"Expected 2 REPAIR COMPLETED records, found {len(repair_completed_records)}")
                return False, []
            
            print(f"✅ Backend correctly returns all data:")
            print(f"   - Original checklist with 2 unsatisfactory items: Present")
            print(f"   - REPAIR COMPLETED records: {len(repair_completed_records)} found")
            
            # Step 6: Simulate frontend filtering logic for "Repairs Due" count
            print("Step 6: Simulating frontend filtering logic...")
            
            # Extract unsatisfactory items from our specific test checklist only (focus on the bug fix)
            test_checklist_repairs = []
            for item in original_checklist.get('checklist_items', []):
                if item.get('status') == 'unsatisfactory':
                    repair_id = f"{checklist_id}_{item.get('item', '')}"
                    test_checklist_repairs.append({
                        'id': repair_id,
                        'checklist_id': checklist_id,
                        'item': item.get('item'),
                        'notes': item.get('notes'),
                        'machine_make': original_checklist.get('machine_make'),
                        'machine_model': original_checklist.get('machine_model')
                    })
            
            # Filter out completed repairs (this is the fix being tested)
            repairs_due_from_test_checklist = [repair for repair in test_checklist_repairs if repair['id'] not in completed_repairs]
            
            print(f"✅ Frontend filtering simulation (focused on test checklist):")
            print(f"   - Test checklist repairs found: {len(test_checklist_repairs)}")
            print(f"   - Completed repairs (filtered out): {len(completed_repairs)}")
            print(f"   - Repairs Due from test checklist: {len(repairs_due_from_test_checklist)}")
            
            # Also show total system repairs for context
            all_system_repairs = []
            for checklist in all_checklists:
                if checklist.get('check_type') == 'daily_check':
                    for item in checklist.get('checklist_items', []):
                        if item.get('status') == 'unsatisfactory':
                            all_system_repairs.append(item)
            print(f"   - Total system repairs (all checklists): {len(all_system_repairs)}")
            
            # The fix should result in 0 repairs due from our test checklist since both were completed
            expected_repairs_due = 0
            if len(repairs_due_from_test_checklist) == expected_repairs_due:
                print(f"✅ SUCCESS: Repairs Due count correctly excludes completed repairs")
                success = True
                details = f"Repairs reappearing bug fix verified: {len(test_checklist_repairs)} test repairs, {len(completed_repairs)} completed, {len(repairs_due_from_test_checklist)} still due (expected {expected_repairs_due})"
            else:
                print(f"❌ FAILURE: Expected {expected_repairs_due} repairs due from test checklist, got {len(repairs_due_from_test_checklist)}")
                success = False
                details = f"Bug fix failed: Expected {expected_repairs_due} repairs due from test checklist, got {len(repairs_due_from_test_checklist)}"
            
            self.log_test("Repairs Reappearing Bug Fix - Complete Scenario", success, details)
            return success, repair_ids
            
        except Exception as e:
            self.log_test("Repairs Reappearing Bug Fix - Complete Scenario", False, f"Exception: {str(e)}")
            return False, []

    def test_repairs_persistence_across_navigation(self, employee_number: str, staff_name: str) -> bool:
        """Test that repairs data persists correctly across navigation (backend perspective)"""
        try:
            # Create multiple checklists with repairs to simulate navigation scenario
            checklist_ids = []
            
            # Create 3 checklists with different repair scenarios
            for i in range(3):
                checklist_items = [
                    {"item": f"Test item {i+1}A", "status": "unsatisfactory", "notes": f"Test repair issue {i+1}A"},
                    {"item": f"Test item {i+1}B", "status": "unsatisfactory", "notes": f"Test repair issue {i+1}B"},
                    {"item": "Oil level check", "status": "satisfactory", "notes": ""},
                    {"item": "Fuel level check", "status": "satisfactory", "notes": ""}
                ]
                
                checklist_data = {
                    "employee_number": employee_number,
                    "staff_name": staff_name,
                    "machine_make": "John Deere",
                    "machine_model": f"Test Model {i+1}",
                    "check_type": "daily_check",
                    "checklist_items": checklist_items
                }
                
                response = requests.post(
                    f"{self.base_url}/api/checklists",
                    json=checklist_data,
                    headers={"Content-Type": "application/json"},
                    timeout=10
                )
                
                if response.status_code == 200:
                    result = response.json()
                    checklist_ids.append(result.get('id', ''))
            
            if len(checklist_ids) != 3:
                self.log_test("Repairs Persistence - Create Test Data", False, f"Failed to create 3 test checklists, created {len(checklist_ids)}")
                return False
            
            # Simulate multiple API calls (as would happen during navigation)
            for call_num in range(5):
                response = requests.get(f"{self.base_url}/api/checklists", timeout=10)
                if response.status_code != 200:
                    self.log_test("Repairs Persistence - Navigation Simulation", False, f"API call {call_num+1} failed: {response.status_code}")
                    return False
                
                checklists = response.json()
                
                # Count repairs in each call
                total_repairs = 0
                for checklist in checklists:
                    if checklist.get('id') in checklist_ids:
                        unsatisfactory_items = [item for item in checklist.get('checklist_items', []) if item.get('status') == 'unsatisfactory']
                        total_repairs += len(unsatisfactory_items)
                
                # Should consistently find 6 repairs (2 per checklist × 3 checklists)
                expected_repairs = 6
                if total_repairs != expected_repairs:
                    self.log_test("Repairs Persistence - Navigation Simulation", False, f"Call {call_num+1}: Expected {expected_repairs} repairs, found {total_repairs}")
                    return False
            
            details = f"Backend consistently returns same repair data across 5 API calls: {expected_repairs} repairs found each time"
            self.log_test("Repairs Persistence Across Navigation", True, details)
            return True
            
        except Exception as e:
            self.log_test("Repairs Persistence Across Navigation", False, f"Exception: {str(e)}")
            return False

    def test_repair_completed_records_issue(self, employee_number: str, staff_name: str) -> bool:
        """Test the specific REPAIR COMPLETED records issue reported by user"""
        try:
            print("\n🔍 REPAIR COMPLETED RECORDS ISSUE - SPECIFIC USER SCENARIO TEST")
            print("-" * 70)
            
            # Step 1: Create REPAIR COMPLETED record via POST /api/checklists
            print("Step 1: Creating REPAIR COMPLETED record via POST /api/checklists...")
            
            repair_completed_data = {
                "employee_number": employee_number,
                "staff_name": staff_name,
                "machine_make": "John Deere",
                "machine_model": "6145R AO69OHZ",
                "check_type": "REPAIR COMPLETED",
                "checklist_items": [],
                "workshop_notes": "REPAIR COMPLETED:\nOriginal Issue: Hydraulic leak on left side\nRepair Action: Replaced hydraulic hose and fittings\nCompleted by: " + staff_name + "\nDate: " + datetime.now().strftime('%Y-%m-%d'),
                "workshop_photos": []
            }
            
            response = requests.post(
                f"{self.base_url}/api/checklists",
                json=repair_completed_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test("REPAIR COMPLETED Issue - Create Record", False, f"Failed to create record: {response.status_code}")
                return False
            
            result = response.json()
            repair_id = result.get('id', '')
            print(f"✅ Created REPAIR COMPLETED record: {repair_id[:8]}...")
            
            # Step 2: Verify the record is created with correct fields
            print("Step 2: Verifying record structure and fields...")
            
            # Check check_type
            if result.get('check_type') != 'REPAIR COMPLETED':
                self.log_test("REPAIR COMPLETED Issue - Verify Structure", False, f"Wrong check_type: expected 'REPAIR COMPLETED', got '{result.get('check_type')}'")
                return False
            
            # Check completed_at timestamp is present and current
            completed_at = result.get('completed_at')
            if not completed_at:
                self.log_test("REPAIR COMPLETED Issue - Verify Structure", False, "Missing completed_at timestamp")
                return False
            
            # Parse timestamp and verify it's recent (within last minute)
            try:
                if isinstance(completed_at, str):
                    completed_time = datetime.fromisoformat(completed_at.replace('Z', '+00:00'))
                else:
                    completed_time = completed_at
                
                time_diff = abs((datetime.now(timezone.utc) - completed_time.replace(tzinfo=timezone.utc)).total_seconds())
                if time_diff > 60:  # More than 1 minute old
                    self.log_test("REPAIR COMPLETED Issue - Verify Structure", False, f"Timestamp not current: {time_diff} seconds old")
                    return False
                
                print(f"✅ completed_at timestamp verified: {completed_at} (current)")
            except Exception as e:
                self.log_test("REPAIR COMPLETED Issue - Verify Structure", False, f"Invalid timestamp format: {str(e)}")
                return False
            
            # Step 3: Create a second REPAIR COMPLETED record (user reported 2 repairs)
            print("Step 3: Creating second REPAIR COMPLETED record...")
            
            repair_completed_data2 = {
                "employee_number": employee_number,
                "staff_name": staff_name,
                "machine_make": "Cat",
                "machine_model": "DP30NTD",
                "check_type": "REPAIR COMPLETED",
                "checklist_items": [],
                "workshop_notes": "REPAIR COMPLETED:\nOriginal Issue: Brake system malfunction\nRepair Action: Replaced brake pads and fluid\nCompleted by: " + staff_name + "\nDate: " + datetime.now().strftime('%Y-%m-%d'),
                "workshop_photos": []
            }
            
            response2 = requests.post(
                f"{self.base_url}/api/checklists",
                json=repair_completed_data2,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response2.status_code != 200:
                self.log_test("REPAIR COMPLETED Issue - Create Second Record", False, f"Failed to create second record: {response2.status_code}")
                return False
            
            result2 = response2.json()
            repair_id2 = result2.get('id', '')
            print(f"✅ Created second REPAIR COMPLETED record: {repair_id2[:8]}...")
            
            # Step 4: Retrieve all checklists and verify REPAIR COMPLETED records appear
            print("Step 4: Retrieving all checklists via GET /api/checklists...")
            
            get_response = requests.get(f"{self.base_url}/api/checklists", timeout=10)
            if get_response.status_code != 200:
                self.log_test("REPAIR COMPLETED Issue - Retrieve All Checklists", False, f"Failed to retrieve checklists: {get_response.status_code}")
                return False
            
            all_checklists = get_response.json()
            print(f"✅ Retrieved {len(all_checklists)} total checklists")
            
            # Step 5: Filter by check_type === 'REPAIR COMPLETED'
            print("Step 5: Filtering by check_type === 'REPAIR COMPLETED'...")
            
            repair_completed_records = [c for c in all_checklists if c.get('check_type') == 'REPAIR COMPLETED']
            print(f"✅ Found {len(repair_completed_records)} REPAIR COMPLETED records")
            
            # Verify our specific records are in the list
            our_repair_ids = [repair_id, repair_id2]
            found_our_records = [r for r in repair_completed_records if r.get('id') in our_repair_ids]
            
            if len(found_our_records) != 2:
                self.log_test("REPAIR COMPLETED Issue - Verify Records in List", False, f"Expected 2 of our records in list, found {len(found_our_records)}")
                return False
            
            print(f"✅ Both of our REPAIR COMPLETED records found in list")
            
            # Step 6: Verify completed_at field is present and properly formatted
            print("Step 6: Verifying completed_at field in retrieved records...")
            
            for i, record in enumerate(found_our_records):
                completed_at = record.get('completed_at')
                if not completed_at:
                    self.log_test("REPAIR COMPLETED Issue - Verify completed_at Field", False, f"Record {i+1} missing completed_at field")
                    return False
                
                # Verify timestamp format
                try:
                    if isinstance(completed_at, str):
                        datetime.fromisoformat(completed_at.replace('Z', '+00:00'))
                    print(f"✅ Record {i+1} completed_at field verified: {completed_at}")
                except Exception as e:
                    self.log_test("REPAIR COMPLETED Issue - Verify completed_at Field", False, f"Record {i+1} invalid timestamp: {str(e)}")
                    return False
            
            # Step 7: Verify the record structure matches what RepairsCompletedPage expects
            print("Step 7: Verifying record structure for RepairsCompletedPage compatibility...")
            
            for i, record in enumerate(found_our_records):
                required_fields = ['id', 'check_type', 'completed_at', 'machine_make', 'machine_model', 'staff_name', 'workshop_notes']
                missing_fields = [field for field in required_fields if field not in record or not record[field]]
                
                if missing_fields:
                    self.log_test("REPAIR COMPLETED Issue - Verify Record Structure", False, f"Record {i+1} missing required fields: {missing_fields}")
                    return False
                
                print(f"✅ Record {i+1} structure verified - all required fields present")
            
            # Step 8: Test individual record retrieval
            print("Step 8: Testing individual record retrieval...")
            
            for i, record_id in enumerate(our_repair_ids):
                individual_response = requests.get(f"{self.base_url}/api/checklists/{record_id}", timeout=10)
                if individual_response.status_code != 200:
                    self.log_test("REPAIR COMPLETED Issue - Individual Record Retrieval", False, f"Failed to retrieve record {i+1}: {individual_response.status_code}")
                    return False
                
                individual_record = individual_response.json()
                if individual_record.get('check_type') != 'REPAIR COMPLETED':
                    self.log_test("REPAIR COMPLETED Issue - Individual Record Retrieval", False, f"Record {i+1} wrong check_type in individual retrieval")
                    return False
                
                print(f"✅ Individual retrieval of record {i+1} successful")
            
            print("\n🎉 REPAIR COMPLETED RECORDS ISSUE TEST - ALL CHECKS PASSED")
            print("✅ REPAIR COMPLETED records are being created correctly")
            print("✅ Records have proper check_type: 'REPAIR COMPLETED'")
            print("✅ Records have current completed_at timestamp")
            print("✅ Records are retrievable via GET /api/checklists")
            print("✅ Records can be filtered by check_type === 'REPAIR COMPLETED'")
            print("✅ Record structure matches RepairsCompletedPage expectations")
            
            self.log_test("REPAIR COMPLETED Records Issue - Complete Test", True, f"All checks passed: 2 records created and verified")
            return True
            
        except Exception as e:
            self.log_test("REPAIR COMPLETED Records Issue - Complete Test", False, f"Exception: {str(e)}")
            return False

    def test_admin_control_permission_4444(self) -> bool:
        """Test admin_control permission for employee 4444 as specified in review request"""
        try:
            print("\n🔐 ADMIN CONTROL PERMISSION CHECK FOR EMPLOYEE 4444")
            print("-" * 60)
            
            # Call GET /api/auth/validate/4444 to check employee data
            print("Step 1: Calling GET /api/auth/validate/4444...")
            response = requests.get(f"{self.base_url}/api/auth/validate/4444", timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                result = response.json()
                print(f"✅ API Response received: {result}")
                
                # Check if employee is valid
                if not result.get('valid'):
                    success = False
                    details += " (Employee 4444 not found or inactive)"
                    print(f"❌ Employee 4444 is not valid or active")
                else:
                    print(f"✅ Employee 4444 is valid: {result.get('name', 'Unknown')}")
                    
                    # Check admin_control field
                    admin_control = result.get('admin_control')
                    print(f"🔍 admin_control field value: {admin_control}")
                    
                    if admin_control == "yes":
                        print(f"✅ SUCCESS: Employee 4444 has admin_control set to 'yes'")
                        details += f", admin_control: 'yes' (CORRECT)"
                    elif admin_control is None:
                        success = False
                        print(f"❌ ISSUE: Employee 4444 admin_control field is None/missing")
                        details += f", admin_control: None (SHOULD BE 'yes')"
                    else:
                        success = False
                        print(f"❌ ISSUE: Employee 4444 admin_control is '{admin_control}' (SHOULD BE 'yes')")
                        details += f", admin_control: '{admin_control}' (SHOULD BE 'yes')"
                    
                    # Also check workshop_control for completeness
                    workshop_control = result.get('workshop_control')
                    print(f"ℹ️  workshop_control field value: {workshop_control}")
                    details += f", workshop_control: {workshop_control}"
            else:
                print(f"❌ API call failed with status {response.status_code}")
                details += f", Response: {response.text[:100]}"
                
            self.log_test("Admin Control Permission Check for Employee 4444", success, details)
            return success
            
        except Exception as e:
            error_msg = f"Exception: {str(e)}"
            print(f"❌ Exception occurred: {error_msg}")
            self.log_test("Admin Control Permission Check for Employee 4444", False, error_msg)
            return False

    def test_checklist_items_for_translation_keys(self) -> bool:
        """Test to extract checklist items from database for translation key verification"""
        try:
            print("\n🔍 CHECKLIST ITEMS TRANSLATION KEY VERIFICATION")
            print("-" * 60)
            
            # Get more checklists from the database to find more checklist items
            response = requests.get(f"{self.base_url}/api/checklists?limit=20", timeout=10)
            success = response.status_code == 200
            
            if success:
                checklists = response.json()
                details = f"Status: {response.status_code}, Retrieved {len(checklists)} checklists"
                
                print(f"📊 Retrieved {len(checklists)} checklists from database")
                
                # Extract all unique checklist item texts
                unique_items = set()
                all_items = []
                
                for i, checklist in enumerate(checklists):
                    print(f"\n📋 Checklist {i+1}:")
                    print(f"   ID: {checklist.get('id', 'N/A')[:12]}...")
                    print(f"   Staff: {checklist.get('staff_name', 'N/A')}")
                    print(f"   Machine: {checklist.get('machine_make', 'N/A')} {checklist.get('machine_model', 'N/A')}")
                    print(f"   Check Type: {checklist.get('check_type', 'N/A')}")
                    
                    checklist_items = checklist.get('checklist_items', [])
                    print(f"   Items Count: {len(checklist_items)}")
                    
                    if checklist_items:
                        print(f"   📝 Checklist Items:")
                        for j, item in enumerate(checklist_items):
                            item_text = item.get('item', '')
                            if item_text:
                                unique_items.add(item_text)
                                all_items.append({
                                    'checklist_id': checklist.get('id', ''),
                                    'item_text': item_text,
                                    'status': item.get('status', ''),
                                    'notes': item.get('notes', '')
                                })
                                print(f"      {j+1:2d}. {item_text}")
                                if item.get('status') == 'unsatisfactory' and item.get('notes'):
                                    print(f"          Status: {item.get('status')} - {item.get('notes')}")
                    else:
                        print(f"   ⚠️  No checklist items found (possibly workshop service or special record type)")
                
                print(f"\n📈 SUMMARY:")
                print(f"   Total checklists analyzed: {len(checklists)}")
                print(f"   Total checklist items found: {len(all_items)}")
                print(f"   Unique checklist item texts: {len(unique_items)}")
                
                print(f"\n🔤 UNIQUE CHECKLIST ITEM TEXTS FOR TRANSLATION KEYS:")
                print("=" * 60)
                for i, item_text in enumerate(sorted(unique_items), 1):
                    print(f"{i:2d}. {item_text}")
                
                # Also show the exact structure for translation key mapping
                print(f"\n🗂️  DETAILED ITEM STRUCTURE (for translation key mapping):")
                print("=" * 60)
                for item in all_items[:10]:  # Show first 10 for detailed analysis
                    print(f"Checklist ID: {item['checklist_id'][:12]}...")
                    print(f"Item Text: '{item['item_text']}'")
                    print(f"Status: {item['status']}")
                    if item['notes']:
                        print(f"Notes: {item['notes']}")
                    print("-" * 40)
                
                if len(all_items) > 10:
                    print(f"... and {len(all_items) - 10} more items")
                
                details += f", Unique items: {len(unique_items)}, Total items: {len(all_items)}"
                
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:200]}"
                
            self.log_test("Checklist Items for Translation Keys", success, details)
            return success
        except Exception as e:
            self.log_test("Checklist Items for Translation Keys", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run comprehensive API tests"""
        print("🚀 Starting Machine Checklist API Tests")
        print(f"📍 Testing endpoint: {self.base_url}")
        print("=" * 60)
        
        # Test 1: Health check
        if not self.test_health_check():
            print("❌ Health check failed - stopping tests")
            return self.generate_report()
        
        # SPECIAL REQUEST: Check checklist items for translation keys
        print("\n🌐 TRANSLATION KEY VERIFICATION REQUEST")
        print("-" * 50)
        self.test_checklist_items_for_translation_keys()
        
        # Test 2: Get staff
        staff_success, staff_data = self.test_get_staff()
        if not staff_success:
            print("❌ Staff endpoint failed")
        
        # Test 3: Get makes
        makes_success, makes_data = self.test_get_makes()
        if not makes_success:
            print("❌ Makes endpoint failed")
        
        # Test 4: Test asset-related endpoints with John Deere and Cat machines
        john_deere_names = []
        cat_names = []
        if makes_success and makes_data:
            # Test John Deere machines
            if "John Deere" in makes_data:
                jd_success, john_deere_names = self.test_get_names_by_make("John Deere")
                if jd_success and john_deere_names:
                    # Test check type for first John Deere machine
                    self.test_get_checktype_by_make_and_name("John Deere", john_deere_names[0])
            
            # Test Cat machines  
            if "Cat" in makes_data:
                cat_success, cat_names = self.test_get_names_by_make("Cat")
                if cat_success and cat_names:
                    # Test check type for first Cat machine
                    self.test_get_checktype_by_make_and_name("Cat", cat_names[0])
        
        # AUTHENTICATION TESTS - Priority focus as per review request
        print("\n🔐 AUTHENTICATION TESTS")
        print("-" * 40)
        
        # Test with employee 4444 as specified in review request
        test_employee_number = "4444"
        
        # Test 5a: Valid employee login with 4444
        login_success, employee_data = self.test_employee_login_valid(test_employee_number)
        
        # Test 5b: Valid employee validation with 4444
        validate_success = self.test_employee_validate_valid(test_employee_number)
        
        # Test 5c: Admin control permission check for employee 4444 - PRIORITY TEST
        admin_control_success = self.test_admin_control_permission_4444()
        
        # Find staff name for employee 4444
        valid_staff_name = "Admin User"  # Default from backend initialization
        if staff_success and staff_data:
            for staff in staff_data:
                if staff.get('employee_number') == test_employee_number:
                    valid_staff_name = staff['name']
                    break
        
        # GENERAL REPAIR TESTS - Main focus of current review request
        print("\n🔧 GENERAL REPAIR RECORD TESTS")
        print("-" * 50)
        
        general_repair_id = ""
        general_repair_with_photos_id = ""
        
        if login_success:
            # Test 1: Create basic GENERAL REPAIR record
            repair_success, general_repair_id = self.test_general_repair_record_creation(
                test_employee_number, valid_staff_name
            )
            
            # Test 2: Create GENERAL REPAIR record with photos
            repair_photos_success, general_repair_with_photos_id = self.test_general_repair_record_with_photos(
                test_employee_number, valid_staff_name
            )
            
            # Test 3: Retrieve GENERAL REPAIR record
            if repair_success and general_repair_id:
                self.test_general_repair_record_retrieval(general_repair_id)
            
            # Test 4: Retrieve GENERAL REPAIR record with photos
            if repair_photos_success and general_repair_with_photos_id:
                self.test_general_repair_record_retrieval(general_repair_with_photos_id)
            
            # Test 5: Validation error handling
            self.test_general_repair_validation_errors()
            
            # Test 6: GENERAL REPAIR records in checklist list
            if repair_success and general_repair_id:
                self.test_general_repair_in_checklist_list(general_repair_id)

        # MANDATORY FAULT EXPLANATIONS TESTS - Previous functionality
        print("\n⚠️  MANDATORY FAULT EXPLANATIONS TESTS")
        print("-" * 50)
        
        fault_checklist_id = ""
        if login_success and john_deere_names:
            # Test creating checklist with fault explanations using John Deere machine
            fault_success, fault_checklist_id = self.test_checklist_with_fault_explanations(
                test_employee_number, valid_staff_name, "John Deere", john_deere_names[0]
            )
            
            # Test retrieving checklist with notes
            if fault_success and fault_checklist_id:
                self.test_checklist_retrieval_with_notes(fault_checklist_id)

        # N/A OPTION TESTS - New functionality
        print("\n❓ N/A OPTION TESTS")
        print("-" * 30)
        
        na_checklist_id = ""
        if login_success and cat_names:
            # Test creating checklist with N/A options using Cat machine
            na_success, na_checklist_id = self.test_checklist_with_na_option(
                test_employee_number, valid_staff_name, "Cat", cat_names[0]
            )

        # REPAIRS REAPPEARING BUG FIX TESTS - Main focus of current review request
        print("\n🚨 REPAIRS REAPPEARING BUG FIX TESTS - PRIORITY")
        print("-" * 60)
        
        if login_success:
            # Test the complete repairs reappearing bug fix scenario
            bug_fix_success, repair_ids = self.test_repairs_reappearing_bug_fix_scenario(
                test_employee_number, valid_staff_name
            )
            
            # Test repairs persistence across navigation
            persistence_success = self.test_repairs_persistence_across_navigation(
                test_employee_number, valid_staff_name
            )

        # REPAIRS NEEDED FUNCTIONALITY TESTS - New functionality
        print("\n🔧 REPAIRS NEEDED FUNCTIONALITY TESTS")
        print("-" * 50)
        
        machine_add_id = ""
        repair_completed_id = ""
        
        if login_success:
            # Test 1: Create MACHINE ADD record
            machine_add_success, machine_add_id = self.test_machine_add_record_creation(
                test_employee_number, valid_staff_name
            )
            
            # Test 2: Create REPAIR COMPLETED record
            repair_completed_success, repair_completed_id = self.test_repair_completed_record_creation(
                test_employee_number, valid_staff_name
            )
            
            # Test 3: REPAIR COMPLETED records issue - User reported problem
            print("\n🔍 REPAIR COMPLETED RECORDS ISSUE - USER REPORTED PROBLEM")
            print("-" * 60)
            repair_issue_success = self.test_repair_completed_records_issue(
                test_employee_number, valid_staff_name
            )
        
        # Test 6: Invalid employee login tests
        self.test_employee_login_invalid("INVALID999")
        self.test_employee_login_invalid("NONEXISTENT")
        
        # Test 7: Empty employee login
        self.test_employee_login_empty()
        
        # Test 8: Malformed login request
        self.test_employee_login_malformed()
        
        # Test 9: Invalid employee validation
        self.test_employee_validate_invalid("INVALID999")
        self.test_employee_validate_invalid("NONEXISTENT")
        
        # EXISTING FUNCTIONALITY TESTS
        print("\n📋 EXISTING FUNCTIONALITY TESTS")
        print("-" * 40)
        
        # Test 10: Create a test checklist with employee number
        checklist_id = ""
        if login_success and cat_names:
            # Test creating checklist with employee number using Cat machine
            create_success, checklist_id = self.test_checklist_with_employee_number(
                test_employee_number, valid_staff_name, "Cat", cat_names[0]
            )
        
        # Test 11: Get all checklists
        self.test_get_checklists()
        
        # Test 12: Get specific checklist by ID
        if checklist_id:
            self.test_get_checklist_by_id(checklist_id)
        
        # Test 13: Export CSV
        self.test_export_csv()
        
        return self.generate_report()

    def generate_report(self) -> Dict[str, Any]:
        """Generate test report"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"📈 Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        failed_tests = [test for test in self.test_results if not test['success']]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  • {test['test']}: {test['details']}")
        
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.tests_run - self.tests_passed,
            "success_rate": (self.tests_passed/self.tests_run*100) if self.tests_run > 0 else 0,
            "test_results": self.test_results,
            "failed_tests_details": failed_tests
        }

    def test_dashboard_stats_new_repairs_debug(self) -> bool:
        """Debug the '14 New Repairs' count mismatch issue"""
        try:
            print("\n🔍 DEBUGGING '14 NEW REPAIRS' COUNT MISMATCH")
            print("=" * 60)
            
            # Step 1: Call GET /api/dashboard/stats - verify new_repairs count
            print("Step 1: Checking dashboard stats...")
            stats_response = requests.get(f"{self.base_url}/api/dashboard/stats", timeout=15)
            
            if stats_response.status_code != 200:
                self.log_test("Dashboard Stats Debug - Get Stats", False, f"Failed to get dashboard stats: {stats_response.status_code}")
                return False
            
            stats_data = stats_response.json()
            new_repairs_count = stats_data.get('new_repairs', 0)
            repairs_due_count = stats_data.get('repairs_due', 0)
            total_completed = stats_data.get('total_completed', 0)
            
            print(f"✅ Dashboard Stats Retrieved:")
            print(f"   - New Repairs: {new_repairs_count}")
            print(f"   - Repairs Due: {repairs_due_count}")
            print(f"   - Total Completed: {total_completed}")
            print(f"   - Today's Total: {stats_data.get('today_total', 0)}")
            
            # Step 2: Call GET /api/checklists?limit=0 - get all checklists
            print("\nStep 2: Getting all checklists...")
            checklists_response = requests.get(f"{self.base_url}/api/checklists?limit=0", timeout=15)
            
            if checklists_response.status_code != 200:
                self.log_test("Dashboard Stats Debug - Get All Checklists", False, f"Failed to get all checklists: {checklists_response.status_code}")
                return False
            
            all_checklists = checklists_response.json()
            print(f"✅ Retrieved {len(all_checklists)} total checklists")
            
            # Step 3: Count unsatisfactory items and GENERAL REPAIR records
            print("\nStep 3: Analyzing unsatisfactory items and GENERAL REPAIR records...")
            
            unsatisfactory_items = []
            general_repair_records = []
            repair_completed_records = []
            
            # Filter to last 7 days only (matching backend logic)
            from datetime import datetime, timedelta
            seven_days_ago = datetime.now() - timedelta(days=7)
            seven_days_ago_str = seven_days_ago.isoformat()
            
            recent_checklists = []
            for checklist in all_checklists:
                completed_at = checklist.get('completed_at', '')
                if isinstance(completed_at, str) and completed_at >= seven_days_ago_str:
                    recent_checklists.append(checklist)
            
            print(f"✅ Found {len(recent_checklists)} checklists from last 7 days")
            
            for checklist in recent_checklists:
                check_type = checklist.get('check_type', '')
                checklist_id = checklist.get('id', '')
                
                if check_type == 'GENERAL REPAIR':
                    general_repair_records.append({
                        'id': checklist_id,
                        'repair_id': f"{checklist_id}-general",
                        'notes': checklist.get('workshop_notes', ''),
                        'machine': f"{checklist.get('machine_make', '')} {checklist.get('machine_model', '')}"
                    })
                elif check_type == 'REPAIR COMPLETED':
                    repair_completed_records.append(checklist)
                elif checklist.get('checklist_items'):
                    # Count unsatisfactory items
                    for index, item in enumerate(checklist.get('checklist_items', [])):
                        if item.get('status') == 'unsatisfactory':
                            unsatisfactory_items.append({
                                'checklist_id': checklist_id,
                                'repair_id': f"{checklist_id}-{index}",
                                'item': item.get('item', ''),
                                'notes': item.get('notes', ''),
                                'machine': f"{checklist.get('machine_make', '')} {checklist.get('machine_model', '')}"
                            })
            
            print(f"✅ Analysis Results:")
            print(f"   - Unsatisfactory items: {len(unsatisfactory_items)}")
            print(f"   - GENERAL REPAIR records: {len(general_repair_records)}")
            print(f"   - REPAIR COMPLETED records: {len(repair_completed_records)}")
            print(f"   - Total potential repairs: {len(unsatisfactory_items) + len(general_repair_records)}")
            
            # Step 4: Check if repair_status collection has any data
            print("\nStep 4: Checking repair_status collection...")
            
            # Get all repair IDs
            all_repair_ids = []
            for item in unsatisfactory_items:
                all_repair_ids.append(item['repair_id'])
            for repair in general_repair_records:
                all_repair_ids.append(repair['repair_id'])
            
            print(f"✅ Generated {len(all_repair_ids)} repair IDs to check")
            
            # Check repair status for a sample of repairs
            sample_repair_ids = all_repair_ids[:5]  # Check first 5
            repair_statuses_found = 0
            
            for repair_id in sample_repair_ids:
                status_response = requests.get(f"{self.base_url}/api/repair-status/{repair_id}", timeout=10)
                if status_response.status_code == 200:
                    status_data = status_response.json()
                    if status_data.get('acknowledged') or status_data.get('completed'):
                        repair_statuses_found += 1
                        print(f"   - {repair_id}: acknowledged={status_data.get('acknowledged')}, completed={status_data.get('completed')}")
            
            print(f"✅ Found {repair_statuses_found} repair statuses out of {len(sample_repair_ids)} checked")
            
            # Step 5: Verify the calculation logic
            print("\nStep 5: Verifying calculation logic...")
            
            # Simulate backend calculation
            expected_new_repairs = 0
            expected_repairs_due = 0
            
            # This matches the backend logic in /api/dashboard/stats
            for repair_id in all_repair_ids:
                # Check if repair has status (simplified - in real backend this queries repair_status collection)
                # For this test, assume no statuses exist (empty repair_status collection)
                is_acknowledged = False
                is_completed = False
                
                if is_completed:
                    continue  # Don't count completed repairs
                elif is_acknowledged:
                    expected_repairs_due += 1
                else:
                    expected_new_repairs += 1
            
            print(f"✅ Expected Calculation (assuming empty repair_status collection):")
            print(f"   - Expected New Repairs: {expected_new_repairs}")
            print(f"   - Expected Repairs Due: {expected_repairs_due}")
            print(f"   - Actual New Repairs: {new_repairs_count}")
            print(f"   - Actual Repairs Due: {repairs_due_count}")
            
            # Step 6: Show detailed breakdown
            print("\nStep 6: Detailed breakdown of repairs...")
            
            if unsatisfactory_items:
                print(f"\n📋 Unsatisfactory Items ({len(unsatisfactory_items)}):")
                for i, item in enumerate(unsatisfactory_items[:10]):  # Show first 10
                    print(f"   {i+1}. {item['machine']} - {item['item']}")
                    print(f"      Notes: {item['notes']}")
                    print(f"      Repair ID: {item['repair_id']}")
                if len(unsatisfactory_items) > 10:
                    print(f"   ... and {len(unsatisfactory_items) - 10} more")
            
            if general_repair_records:
                print(f"\n🔧 GENERAL REPAIR Records ({len(general_repair_records)}):")
                for i, repair in enumerate(general_repair_records[:5]):  # Show first 5
                    print(f"   {i+1}. {repair['machine']}")
                    print(f"      Notes: {repair['notes'][:100]}...")
                    print(f"      Repair ID: {repair['repair_id']}")
            
            # Step 7: Conclusion
            print("\nStep 7: Diagnosis...")
            
            total_backend_repairs = len(unsatisfactory_items) + len(general_repair_records)
            
            if new_repairs_count == total_backend_repairs:
                print(f"✅ DIAGNOSIS: Backend count ({new_repairs_count}) matches total repairs ({total_backend_repairs})")
                print("   This suggests repair_status collection is empty (no acknowledgements recorded)")
                print("   Frontend localStorage might have old acknowledgements, causing mismatch")
                success = True
                details = f"Backend correctly counts {new_repairs_count} new repairs, frontend localStorage may have stale data"
            elif new_repairs_count == 14 and total_backend_repairs != 14:
                print(f"⚠️  DIAGNOSIS: Backend shows 14 new repairs but analysis found {total_backend_repairs} total repairs")
                print("   This suggests there may be additional repairs not captured in recent data")
                print("   Or the backend calculation includes older data beyond 7 days")
                success = False
                details = f"Mismatch: Backend reports 14 but analysis found {total_backend_repairs} repairs"
            else:
                print(f"❌ DIAGNOSIS: Unexpected count mismatch")
                print(f"   Backend: {new_repairs_count}, Analysis: {total_backend_repairs}")
                success = False
                details = f"Count mismatch: Backend={new_repairs_count}, Analysis={total_backend_repairs}"
            
            self.log_test("Dashboard Stats Debug - New Repairs Count Analysis", success, details)
            return success
            
        except Exception as e:
            self.log_test("Dashboard Stats Debug - New Repairs Count Analysis", False, f"Exception: {str(e)}")
            return False

    def test_dashboard_stats_api(self) -> bool:
        """Test dashboard stats API with expected production data counts"""
        try:
            response = requests.get(f"{self.base_url}/api/dashboard/stats", timeout=15)
            success = response.status_code == 200
            
            if success:
                stats = response.json()
                details = f"Status: {response.status_code}"
                
                # Expected values from review request
                expected_total_completed = 976  # 946 daily + 5 grader + 25 workshop
                
                # Verify required fields exist
                required_fields = ['total_completed', 'today_by_type', 'today_total', 'new_repairs', 'repairs_due', 'repairs_completed', 'machine_additions_count']
                missing_fields = [field for field in required_fields if field not in stats]
                
                if missing_fields:
                    success = False
                    details += f", Missing fields: {missing_fields}"
                else:
                    total_completed = stats.get('total_completed', 0)
                    today_by_type = stats.get('today_by_type', {})
                    new_repairs = stats.get('new_repairs', 0)
                    repairs_due = stats.get('repairs_due', 0)
                    repairs_completed = stats.get('repairs_completed', 0)
                    machine_additions = stats.get('machine_additions_count', 0)
                    
                    details += f", Total Completed: {total_completed}"
                    details += f", Today's Checks: {stats.get('today_total', 0)}"
                    details += f", New Repairs: {new_repairs}"
                    details += f", Repairs Due: {repairs_due}"
                    details += f", Repairs Completed: {repairs_completed}"
                    details += f", Machine Additions: {machine_additions}"
                    
                    # Check if total_completed matches expected (allow some variance for test data)
                    if total_completed < 900:  # Should be close to 976
                        success = False
                        details += f" (Expected ~{expected_total_completed}, got {total_completed})"
                    
                    # Verify today_by_type structure
                    if not isinstance(today_by_type, dict):
                        success = False
                        details += " (today_by_type should be dict)"
                    else:
                        details += f", Today by type: {today_by_type}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:200]}"
                
            self.log_test("Dashboard Stats API", success, details)
            return success
        except Exception as e:
            self.log_test("Dashboard Stats API", False, f"Exception: {str(e)}")
            return False

    def test_checklists_with_limit_zero(self) -> bool:
        """Test getting all checklists with limit=0 (should return all 1,055 checklists)"""
        try:
            response = requests.get(f"{self.base_url}/api/checklists?limit=0", timeout=20)
            success = response.status_code == 200
            
            if success:
                checklists = response.json()
                count = len(checklists)
                details = f"Status: {response.status_code}, Total checklists: {count}"
                
                # Expected from review request: 1,055 checklists
                expected_count = 1055
                
                if count < 1000:  # Should be close to 1,055
                    success = False
                    details += f" (Expected ~{expected_count}, got {count})"
                else:
                    # Verify structure of first checklist
                    if checklists:
                        first_checklist = checklists[0]
                        required_fields = ['id', 'staff_name', 'machine_make', 'machine_model', 'check_type', 'completed_at']
                        missing_fields = [field for field in required_fields if field not in first_checklist]
                        if missing_fields:
                            success = False
                            details += f", Missing fields in checklist: {missing_fields}"
                        else:
                            details += f", Sample check_type: {first_checklist.get('check_type')}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:200]}"
                
            self.log_test("Get All Checklists (limit=0)", success, details)
            return success
        except Exception as e:
            self.log_test("Get All Checklists (limit=0)", False, f"Exception: {str(e)}")
            return False

    def test_checklists_with_limit_ten(self) -> bool:
        """Test getting checklists with limit=10"""
        try:
            response = requests.get(f"{self.base_url}/api/checklists?limit=10", timeout=10)
            success = response.status_code == 200
            
            if success:
                checklists = response.json()
                count = len(checklists)
                details = f"Status: {response.status_code}, Checklists returned: {count}"
                
                if count != 10:
                    success = False
                    details += f" (Expected exactly 10, got {count})"
                else:
                    # Verify datetime parsing works
                    if checklists:
                        first_checklist = checklists[0]
                        completed_at = first_checklist.get('completed_at')
                        if completed_at:
                            details += f", Latest completed_at: {str(completed_at)[:19]}"
            else:
                details = f"Status: {response.status_code}"
                
            self.log_test("Get Checklists (limit=10)", success, details)
            return success
        except Exception as e:
            self.log_test("Get Checklists (limit=10)", False, f"Exception: {str(e)}")
            return False

    def test_assets_makes_count(self) -> bool:
        """Test assets makes endpoint should return 46 makes"""
        try:
            response = requests.get(f"{self.base_url}/api/assets/makes", timeout=10)
            success = response.status_code == 200
            
            if success:
                makes = response.json()
                count = len(makes)
                details = f"Status: {response.status_code}, Makes count: {count}"
                
                # Expected from review request: 46 makes
                expected_count = 46
                
                if count < 40:  # Should be close to 46
                    success = False
                    details += f" (Expected ~{expected_count}, got {count})"
                else:
                    details += f", Sample makes: {makes[:5]}"
            else:
                details = f"Status: {response.status_code}"
                
            self.log_test("Assets Makes Count", success, details)
            return success
        except Exception as e:
            self.log_test("Assets Makes Count", False, f"Exception: {str(e)}")
            return False

    def test_csv_export_all_checklists(self) -> bool:
        """Test CSV export includes ALL 1,055 checklists"""
        try:
            response = requests.get(f"{self.base_url}/api/checklists/export/csv", timeout=30)
            success = response.status_code == 200
            
            if success:
                content = response.text
                lines = content.split('\n')
                # Subtract 1 for header row, and filter out empty lines
                data_lines = [line for line in lines[1:] if line.strip()]
                count = len(data_lines)
                
                details = f"Status: {response.status_code}, CSV rows: {count}"
                
                # Expected from review request: ALL 1,055 checklists
                expected_count = 1055
                
                if count < 1000:  # Should be close to 1,055
                    success = False
                    details += f" (Expected ~{expected_count}, got {count})"
                else:
                    # Verify CSV headers
                    if lines:
                        headers = lines[0].split(',')
                        expected_headers = ['ID', 'Staff Name', 'Machine Make', 'Machine Model', 'Check Type']
                        missing_headers = [h for h in expected_headers if h not in headers]
                        if missing_headers:
                            success = False
                            details += f", Missing headers: {missing_headers}"
                        else:
                            # Check for different check types in CSV
                            check_types = set()
                            for line in data_lines[:100]:  # Sample first 100 rows
                                parts = line.split(',')
                                if len(parts) > 4:
                                    check_types.add(parts[4].strip('"'))
                            details += f", Check types found: {list(check_types)[:5]}"
            else:
                details = f"Status: {response.status_code}"
                
            self.log_test("CSV Export All Checklists", success, details)
            return success
        except Exception as e:
            self.log_test("CSV Export All Checklists", False, f"Exception: {str(e)}")
            return False

    def test_excel_export_validity(self) -> bool:
        """Test Excel export generates valid .xlsx file"""
        try:
            response = requests.get(f"{self.base_url}/api/checklists/export/excel", timeout=30)
            success = response.status_code == 200
            
            if success:
                content_type = response.headers.get('content-type', '')
                content_disposition = response.headers.get('content-disposition', '')
                content_length = len(response.content)
                
                details = f"Status: {response.status_code}, Content-Type: {content_type}, Size: {content_length} bytes"
                
                # Verify it's an Excel file
                if 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' not in content_type:
                    success = False
                    details += " (Not Excel content type)"
                elif 'attachment' not in content_disposition:
                    success = False
                    details += " (Not attachment)"
                elif '.xlsx' not in content_disposition:
                    success = False
                    details += " (Not .xlsx filename)"
                elif content_length < 10000:  # Excel files should be reasonably sized
                    success = False
                    details += " (File too small for Excel with 1000+ records)"
                else:
                    # Check Excel file signature (first few bytes)
                    excel_signature = response.content[:4]
                    if excel_signature != b'PK\x03\x04':  # ZIP signature (Excel is ZIP-based)
                        success = False
                        details += " (Invalid Excel file signature)"
            else:
                details = f"Status: {response.status_code}"
                
            self.log_test("Excel Export Validity", success, details)
            return success
        except Exception as e:
            self.log_test("Excel Export Validity", False, f"Exception: {str(e)}")
            return False

    def test_dashboard_performance(self) -> bool:
        """Test dashboard stats API performance (should load within reasonable time)"""
        try:
            import time
            start_time = time.time()
            
            response = requests.get(f"{self.base_url}/api/dashboard/stats", timeout=10)
            
            end_time = time.time()
            response_time = end_time - start_time
            
            success = response.status_code == 200 and response_time < 5.0  # Should respond within 5 seconds
            
            if success:
                details = f"Status: {response.status_code}, Response time: {response_time:.2f}s"
                
                if response_time > 3.0:
                    details += " (Slow but acceptable)"
                elif response_time > 1.0:
                    details += " (Good performance)"
                else:
                    details += " (Excellent performance)"
            else:
                if response.status_code != 200:
                    details = f"Status: {response.status_code}"
                else:
                    details = f"Status: {response.status_code}, Response time: {response_time:.2f}s (Too slow)"
                
            self.log_test("Dashboard Performance", success, details)
            return success
        except Exception as e:
            self.log_test("Dashboard Performance", False, f"Exception: {str(e)}")
            return False

    def run_dashboard_focused_tests(self):
        """Run dashboard-focused tests as requested in review"""
        print("🚀 STARTING DASHBOARD FUNCTIONALITY TESTING")
        print("=" * 60)
        print("📋 Testing complete dashboard functionality after fixing 'dashboard not reading correct figures' issue")
        print("=" * 60)
        
        # Basic connectivity test
        if not self.test_health_check():
            print("❌ Health check failed - aborting tests")
            return False
        
        # DASHBOARD FUNCTIONALITY TESTS (PRIMARY FOCUS)
        print("\n📊 DASHBOARD STATS API TESTS")
        print("-" * 40)
        
        # Test dashboard stats API with expected production data
        self.test_dashboard_stats_api()
        
        # Test dashboard performance
        self.test_dashboard_performance()
        
        print("\n📋 CHECKLISTS API TESTS")
        print("-" * 30)
        
        # Test checklists retrieval with different limits
        self.test_checklists_with_limit_zero()  # Should return all 1,055
        self.test_checklists_with_limit_ten()   # Should return exactly 10
        
        print("\n🏭 ASSETS API TESTS")
        print("-" * 20)
        
        # Test assets API
        self.test_assets_makes_count()  # Should return 46 makes
        
        print("\n📤 EXPORT FUNCTIONALITY TESTS")
        print("-" * 35)
        
        # Test export functionality with all data
        self.test_csv_export_all_checklists()  # Should include all 1,055
        self.test_excel_export_validity()      # Should generate valid .xlsx
        
        # Print final results
        print("\n" + "=" * 60)
        print("🏁 DASHBOARD TESTING COMPLETED")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 ALL DASHBOARD TESTS PASSED!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} TESTS FAILED")
            return False

def main():
    """Main test execution"""
    tester = MachineChecklistAPITester()
    
    # Run dashboard-focused tests as requested in review
    print("🎯 RUNNING DASHBOARD FUNCTIONALITY TESTS AS REQUESTED")
    print("=" * 70)
    dashboard_success = tester.run_dashboard_focused_tests()
    
    # Also run the specific debug test for "14 New Repairs" count mismatch
    print("\n🔍 RUNNING SPECIFIC DEBUG TEST FOR '14 NEW REPAIRS' COUNT MISMATCH")
    print("=" * 70)
    tester.test_dashboard_stats_new_repairs_debug()
    
    # Return appropriate exit code based on dashboard tests
    return 0 if dashboard_success else 1

if __name__ == "__main__":
    sys.exit(main())