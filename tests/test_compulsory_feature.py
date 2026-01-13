"""
Test suite for Machine Checklist Application
Testing: Compulsory items feature, Delete Job, Manager role access
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndAuth:
    """Basic health and authentication tests"""
    
    def test_health_check(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print(f"✓ Health check passed: {data}")
    
    def test_employee_login_admin(self):
        """Test admin employee login with employee number 4444"""
        response = requests.post(f"{BASE_URL}/api/auth/employee-login", json={
            "employee_number": "4444"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["employee"]["employee_number"] == "4444"
        assert data["employee"]["admin_control"] == "yes"
        assert data["employee"]["manager_control"] == "yes"
        print(f"✓ Admin login successful: {data['employee']['name']}")
    
    def test_employee_login_invalid(self):
        """Test login with invalid employee number"""
        response = requests.post(f"{BASE_URL}/api/auth/employee-login", json={
            "employee_number": "99999"
        })
        # Backend returns 400 for invalid login (wrapped in HTTPException)
        assert response.status_code in [400, 401], f"Expected 400 or 401, got {response.status_code}"
        print("✓ Invalid login correctly rejected")


class TestChecklistTemplates:
    """Test checklist templates with compulsory items"""
    
    def test_get_daily_check_template(self):
        """Test GET /api/checklist-templates/daily_check returns items with compulsory field"""
        response = requests.get(f"{BASE_URL}/api/checklist-templates/daily_check")
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        assert len(data["items"]) > 0
        
        # Check that items have compulsory field
        compulsory_items = []
        for item in data["items"]:
            assert "item" in item
            assert "compulsory" in item
            if item["compulsory"]:
                compulsory_items.append(item["item"])
        
        # daily_check should have 4 compulsory items: Safety guards, Emergency stop, Brake system, Fire extinguisher
        assert len(compulsory_items) >= 4, f"Expected at least 4 compulsory items, got {len(compulsory_items)}"
        print(f"✓ daily_check template has {len(compulsory_items)} compulsory items: {compulsory_items[:3]}...")
    
    def test_get_grader_startup_template(self):
        """Test grader_startup template has compulsory items"""
        response = requests.get(f"{BASE_URL}/api/checklist-templates/grader_startup")
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        compulsory_count = sum(1 for item in data["items"] if item.get("compulsory"))
        assert compulsory_count >= 4, f"Expected at least 4 compulsory items in grader_startup"
        print(f"✓ grader_startup template has {compulsory_count} compulsory items")


class TestCompulsoryItemValidation:
    """Test compulsory item validation on checklist submission"""
    
    def test_reject_checklist_with_failed_compulsory_item(self):
        """Test POST /api/checklists rejects checklist if compulsory items are marked unsatisfactory"""
        # Create a checklist with a compulsory item marked as unsatisfactory
        checklist_data = {
            "employee_number": "4444",
            "staff_name": "Admin User",
            "machine_make": "TEST_Make",
            "machine_model": "TEST_Model",
            "check_type": "daily_check",
            "checklist_items": [
                {"item": "Oil level check", "status": "satisfactory", "compulsory": False},
                {"item": "Safety guards in place", "status": "unsatisfactory", "compulsory": True, "notes": "Guards missing"},
                {"item": "Emergency stop function", "status": "satisfactory", "compulsory": True}
            ],
            "workshop_notes": None
        }
        
        response = requests.post(f"{BASE_URL}/api/checklists", json=checklist_data)
        
        # Should be rejected with 400 status
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        assert "compulsory" in data["detail"].lower() or "Compulsory" in data["detail"]
        print(f"✓ Checklist with failed compulsory item correctly rejected: {data['detail'][:80]}...")
    
    def test_accept_checklist_with_satisfactory_compulsory_items(self):
        """Test POST /api/checklists accepts checklist if compulsory items are satisfactory"""
        unique_id = str(uuid.uuid4())[:8]
        checklist_data = {
            "employee_number": "4444",
            "staff_name": "Admin User",
            "machine_make": f"TEST_Make_{unique_id}",
            "machine_model": f"TEST_Model_{unique_id}",
            "check_type": "daily_check",
            "checklist_items": [
                {"item": "Oil level check", "status": "satisfactory", "compulsory": False},
                {"item": "Safety guards in place", "status": "satisfactory", "compulsory": True},
                {"item": "Emergency stop function", "status": "satisfactory", "compulsory": True},
                {"item": "Brake system function", "status": "satisfactory", "compulsory": True},
                {"item": "Fire extinguisher", "status": "satisfactory", "compulsory": True}
            ],
            "workshop_notes": None
        }
        
        response = requests.post(f"{BASE_URL}/api/checklists", json=checklist_data)
        
        # Should be accepted with 200 status
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"✓ Checklist with satisfactory compulsory items accepted, ID: {data['id'][:8]}...")
    
    def test_accept_checklist_with_non_compulsory_unsatisfactory(self):
        """Test checklist is accepted when non-compulsory items are unsatisfactory"""
        unique_id = str(uuid.uuid4())[:8]
        checklist_data = {
            "employee_number": "4444",
            "staff_name": "Admin User",
            "machine_make": f"TEST_Make_{unique_id}",
            "machine_model": f"TEST_Model_{unique_id}",
            "check_type": "daily_check",
            "checklist_items": [
                {"item": "Oil level check", "status": "unsatisfactory", "compulsory": False, "notes": "Low oil"},
                {"item": "Safety guards in place", "status": "satisfactory", "compulsory": True},
                {"item": "Emergency stop function", "status": "satisfactory", "compulsory": True}
            ],
            "workshop_notes": None
        }
        
        response = requests.post(f"{BASE_URL}/api/checklists", json=checklist_data)
        
        # Should be accepted - non-compulsory items can be unsatisfactory
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"✓ Checklist with non-compulsory unsatisfactory item accepted")
    
    def test_reject_multiple_failed_compulsory_items(self):
        """Test rejection message includes multiple failed compulsory items"""
        checklist_data = {
            "employee_number": "4444",
            "staff_name": "Admin User",
            "machine_make": "TEST_Make",
            "machine_model": "TEST_Model",
            "check_type": "daily_check",
            "checklist_items": [
                {"item": "Safety guards in place", "status": "unsatisfactory", "compulsory": True, "notes": "Missing"},
                {"item": "Emergency stop function", "status": "unsatisfactory", "compulsory": True, "notes": "Broken"},
                {"item": "Brake system function", "status": "unsatisfactory", "compulsory": True, "notes": "Faulty"},
                {"item": "Fire extinguisher", "status": "unsatisfactory", "compulsory": True, "notes": "Expired"}
            ],
            "workshop_notes": None
        }
        
        response = requests.post(f"{BASE_URL}/api/checklists", json=checklist_data)
        
        assert response.status_code == 400
        data = response.json()
        # Should mention multiple items
        assert "and" in data["detail"] or "more" in data["detail"] or "," in data["detail"]
        print(f"✓ Multiple failed compulsory items correctly reported: {data['detail'][:100]}...")


class TestJobManagement:
    """Test job creation and deletion"""
    
    @pytest.fixture
    def created_job(self):
        """Create a test job and return its ID"""
        unique_id = str(uuid.uuid4())[:8]
        job_data = {
            "name": f"TEST_Job_{unique_id}",
            "total_area": 100.0
        }
        response = requests.post(f"{BASE_URL}/api/admin/jobs", json=job_data)
        assert response.status_code == 200
        data = response.json()
        yield data["job"]["id"]
        # Cleanup - try to delete if still exists
        requests.delete(f"{BASE_URL}/api/admin/jobs/{data['job']['id']}")
    
    def test_create_job(self):
        """Test POST /api/admin/jobs creates a job successfully"""
        unique_id = str(uuid.uuid4())[:8]
        job_data = {
            "name": f"TEST_Job_{unique_id}",
            "total_area": 150.5
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/jobs", json=job_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "job" in data
        assert data["job"]["name"] == job_data["name"]
        assert data["job"]["total_area"] == job_data["total_area"]
        assert data["job"]["status"] == "active"
        
        # Cleanup
        job_id = data["job"]["id"]
        requests.delete(f"{BASE_URL}/api/admin/jobs/{job_id}")
        print(f"✓ Job created successfully: {job_data['name']}")
    
    def test_delete_job(self, created_job):
        """Test DELETE /api/admin/jobs/{job_id} deletes a job"""
        job_id = created_job
        
        # Verify job exists first
        jobs_response = requests.get(f"{BASE_URL}/api/jobs")
        assert jobs_response.status_code == 200
        jobs = jobs_response.json()
        job_exists = any(j["id"] == job_id for j in jobs)
        assert job_exists, "Test job should exist before deletion"
        
        # Delete the job
        response = requests.delete(f"{BASE_URL}/api/admin/jobs/{job_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "deleted" in data["message"].lower()
        
        # Verify job no longer exists
        jobs_response = requests.get(f"{BASE_URL}/api/jobs")
        jobs = jobs_response.json()
        job_exists = any(j["id"] == job_id for j in jobs)
        assert not job_exists, "Job should not exist after deletion"
        print(f"✓ Job deleted successfully")
    
    def test_delete_nonexistent_job(self):
        """Test deleting a non-existent job returns 404"""
        fake_job_id = "nonexistent-job-id-12345"
        response = requests.delete(f"{BASE_URL}/api/admin/jobs/{fake_job_id}")
        assert response.status_code == 404
        print("✓ Delete non-existent job correctly returns 404")


class TestManagerAccess:
    """Test manager role access"""
    
    def test_manager_role_in_login_response(self):
        """Test that manager_control is returned in login response"""
        response = requests.post(f"{BASE_URL}/api/auth/employee-login", json={
            "employee_number": "4444"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "employee" in data
        assert "manager_control" in data["employee"]
        assert data["employee"]["manager_control"] == "yes"
        print(f"✓ Manager role correctly returned in login: manager_control={data['employee']['manager_control']}")
    
    def test_validate_employee_returns_manager_control(self):
        """Test validate endpoint returns manager_control field"""
        response = requests.get(f"{BASE_URL}/api/auth/validate/4444")
        assert response.status_code == 200
        data = response.json()
        
        assert data["valid"] == True
        assert "manager_control" in data
        assert data["manager_control"] == "yes"
        print(f"✓ Validate endpoint returns manager_control field")


class TestAssetEndpoints:
    """Test asset-related endpoints"""
    
    def test_get_makes(self):
        """Test GET /api/assets/makes returns list of makes"""
        response = requests.get(f"{BASE_URL}/api/assets/makes")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} machine makes")
    
    def test_get_names_by_make(self):
        """Test GET /api/assets/names/{make} returns names"""
        # First get a make
        makes_response = requests.get(f"{BASE_URL}/api/assets/makes")
        makes = makes_response.json()
        
        if makes:
            make = makes[0]
            response = requests.get(f"{BASE_URL}/api/assets/names/{make}")
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            print(f"✓ Got {len(data)} names for make '{make}'")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
