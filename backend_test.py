#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
from typing import Dict, List, Any

class MachineChecklistAPITester:
    def __init__(self, base_url="https://checklist-capture.preview.emergentagent.com"):
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
                
                # Verify expected makes count (should be 41 according to requirements)
                if makes_count != 41:
                    success = False
                    details += f" (Expected 41 machine makes)"
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
            
            # Should return 401 for invalid employee number
            success = response.status_code == 401
            details = f"Status: {response.status_code}"
            
            if success:
                try:
                    result = response.json()
                    details += f", Error: {result.get('detail', 'No error message')}"
                except:
                    details += ", No JSON response"
            else:
                details += f" (Expected 401), Response: {response.text[:100]}"
                
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

    def run_all_tests(self):
        """Run comprehensive API tests"""
        print("🚀 Starting Machine Checklist API Tests")
        print(f"📍 Testing endpoint: {self.base_url}")
        print("=" * 60)
        
        # Test 1: Health check
        if not self.test_health_check():
            print("❌ Health check failed - stopping tests")
            return self.generate_report()
        
        # Test 2: Get staff
        staff_success, staff_data = self.test_get_staff()
        if not staff_success:
            print("❌ Staff endpoint failed")
        
        # Test 3: Get makes
        makes_success, makes_data = self.test_get_makes()
        if not makes_success:
            print("❌ Makes endpoint failed")
        
        # Test 4: Get models for a specific make
        if makes_success and makes_data:
            test_make = makes_data[0]  # Use first make for testing
            self.test_get_models_by_make(test_make)
        
        # AUTHENTICATION TESTS - Priority focus as per review request
        print("\n🔐 AUTHENTICATION TESTS")
        print("-" * 40)
        
        # Find staff with employee numbers for testing
        valid_employee_number = None
        valid_staff_name = None
        
        if staff_success and staff_data:
            # Look for staff with employee_number field
            for staff in staff_data:
                if staff.get('employee_number'):  # Check if employee_number exists and is not None/empty
                    valid_employee_number = staff['employee_number']
                    valid_staff_name = staff['name']
                    break
        
        if valid_employee_number:
            # Test 5a: Valid employee login
            login_success, employee_data = self.test_employee_login_valid(valid_employee_number)
            
            # Test 5b: Valid employee validation
            self.test_employee_validate_valid(valid_employee_number)
            
            # Test 5c: Create checklist with employee number
            if login_success and makes_success and makes_data:
                test_make = makes_data[0]
                models_success, models_data = self.test_get_models_by_make(test_make)
                if models_success and models_data:
                    test_model = models_data[0]
                    self.test_checklist_with_employee_number(valid_employee_number, valid_staff_name, test_make, test_model)
        else:
            print("⚠️  No staff with employee numbers found - testing with sample data")
            # Test with sample employee numbers
            sample_employee_number = "EMP001"
            self.test_employee_login_valid(sample_employee_number)
            self.test_employee_validate_valid(sample_employee_number)
        
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
        
        # Test 10: Create a test checklist (legacy format)
        checklist_id = ""
        if staff_success and makes_success and staff_data and makes_data:
            test_staff = staff_data[0]['name']
            test_make = makes_data[0]
            
            # Get models for the test make
            models_success, models_data = self.test_get_models_by_make(test_make)
            if models_success and models_data:
                test_model = models_data[0]
                create_success, checklist_id = self.test_create_checklist(test_staff, test_make, test_model)
        
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

def main():
    """Main test execution"""
    tester = MachineChecklistAPITester()
    report = tester.run_all_tests()
    
    # Return appropriate exit code
    return 0 if report['failed_tests'] == 0 else 1

if __name__ == "__main__":
    sys.exit(main())