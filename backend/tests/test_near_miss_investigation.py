"""
Test Near Miss Investigation Feature
Tests the investigation functionality including:
- Severity (Red/Orange/Green)
- Progress tracking (not_started/in_progress/completed)
- Action plans
- Investigation notes
- SWP checkboxes
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestNearMissInvestigation:
    """Test Near Miss Investigation endpoints"""
    
    def test_health_check(self):
        """Test API health"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health check passed")
    
    def test_admin_login(self):
        """Test admin login with employee 4444"""
        response = requests.post(f"{BASE_URL}/api/auth/employee-login", json={
            "employee_number": "4444"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["employee"]["admin_control"] == "yes"
        # Note: manager_control may be null for admin user
        print(f"✓ Admin login successful: {data['employee']['name']}")
        print(f"  admin_control: {data['employee']['admin_control']}")
        print(f"  manager_control: {data['employee'].get('manager_control')}")
    
    def test_create_near_miss_for_investigation(self):
        """Create a test near miss to investigate"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(f"{BASE_URL}/api/near-misses", json={
            "description": f"TEST_INVESTIGATION_{unique_id} - Near miss for investigation testing",
            "location": "Farm",
            "is_anonymous": False,
            "submitted_by": "Test User"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "id" in data
        print(f"✓ Created near miss: {data['id']}")
        return data["id"]
    
    def test_investigate_near_miss_with_severity_red(self):
        """Test adding investigation with RED severity"""
        # First create a near miss
        near_miss_id = self.test_create_near_miss_for_investigation()
        
        # Add investigation with RED severity
        params = {
            "severity": "red",
            "action_required": "Immediate action required - safety hazard",
            "progress": "not_started",
            "investigation_notes": "High priority investigation",
            "no_swp_or_not_covered": "true",
            "swp_training_not_received": "false",
            "trained_but_not_following": "false",
            "investigated_by": "Admin User"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/near-misses/{near_miss_id}/investigate",
            params=params
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print(f"✓ Investigation added with RED severity")
        
        # Verify the investigation was saved
        get_response = requests.get(f"{BASE_URL}/api/near-misses?limit=200")
        assert get_response.status_code == 200
        near_misses = get_response.json()
        
        updated_nm = next((nm for nm in near_misses if nm["id"] == near_miss_id), None)
        assert updated_nm is not None
        assert updated_nm["severity"] == "red"
        assert updated_nm["action_required"] == "Immediate action required - safety hazard"
        assert updated_nm["progress"] == "not_started"
        assert updated_nm["investigated_by"] == "Admin User"
        print(f"✓ Investigation data persisted correctly")
        
        return near_miss_id
    
    def test_investigate_near_miss_with_severity_orange(self):
        """Test adding investigation with ORANGE severity"""
        near_miss_id = self.test_create_near_miss_for_investigation()
        
        params = {
            "severity": "orange",
            "action_required": "Medium priority - review procedures",
            "progress": "in_progress",
            "investigation_notes": "Medium priority investigation",
            "no_swp_or_not_covered": "false",
            "swp_training_not_received": "true",
            "trained_but_not_following": "false",
            "investigated_by": "Manager User"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/near-misses/{near_miss_id}/investigate",
            params=params
        )
        assert response.status_code == 200
        
        # Verify
        get_response = requests.get(f"{BASE_URL}/api/near-misses?limit=200")
        near_misses = get_response.json()
        updated_nm = next((nm for nm in near_misses if nm["id"] == near_miss_id), None)
        
        assert updated_nm["severity"] == "orange"
        assert updated_nm["progress"] == "in_progress"
        print(f"✓ Investigation with ORANGE severity saved correctly")
        
        return near_miss_id
    
    def test_investigate_near_miss_with_severity_green(self):
        """Test adding investigation with GREEN severity"""
        near_miss_id = self.test_create_near_miss_for_investigation()
        
        params = {
            "severity": "green",
            "action_required": "Low priority - monitor situation",
            "progress": "completed",
            "investigation_notes": "Low priority - resolved",
            "no_swp_or_not_covered": "false",
            "swp_training_not_received": "false",
            "trained_but_not_following": "true",
            "investigated_by": "Admin User"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/near-misses/{near_miss_id}/investigate",
            params=params
        )
        assert response.status_code == 200
        
        # Verify
        get_response = requests.get(f"{BASE_URL}/api/near-misses?limit=200")
        near_misses = get_response.json()
        updated_nm = next((nm for nm in near_misses if nm["id"] == near_miss_id), None)
        
        assert updated_nm["severity"] == "green"
        assert updated_nm["progress"] == "completed"
        print(f"✓ Investigation with GREEN severity saved correctly")
        
        return near_miss_id
    
    def test_update_investigation_progress(self):
        """Test updating investigation progress from not_started to completed"""
        near_miss_id = self.test_create_near_miss_for_investigation()
        
        # First add investigation with not_started
        params = {
            "severity": "orange",
            "action_required": "Review required",
            "progress": "not_started",
            "investigation_notes": "Initial investigation",
            "investigated_by": "Admin User"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/near-misses/{near_miss_id}/investigate",
            params=params
        )
        assert response.status_code == 200
        
        # Update to in_progress
        params["progress"] = "in_progress"
        params["investigation_notes"] = "Investigation ongoing"
        
        response = requests.put(
            f"{BASE_URL}/api/near-misses/{near_miss_id}/investigate",
            params=params
        )
        assert response.status_code == 200
        
        # Verify progress updated
        get_response = requests.get(f"{BASE_URL}/api/near-misses?limit=200")
        near_misses = get_response.json()
        updated_nm = next((nm for nm in near_misses if nm["id"] == near_miss_id), None)
        
        assert updated_nm["progress"] == "in_progress"
        print(f"✓ Progress updated to in_progress")
        
        # Update to completed
        params["progress"] = "completed"
        params["investigation_notes"] = "Investigation completed"
        
        response = requests.put(
            f"{BASE_URL}/api/near-misses/{near_miss_id}/investigate",
            params=params
        )
        assert response.status_code == 200
        
        # Verify final progress
        get_response = requests.get(f"{BASE_URL}/api/near-misses?limit=200")
        near_misses = get_response.json()
        updated_nm = next((nm for nm in near_misses if nm["id"] == near_miss_id), None)
        
        assert updated_nm["progress"] == "completed"
        print(f"✓ Progress updated to completed")
        
        return near_miss_id
    
    def test_investigate_nonexistent_near_miss(self):
        """Test investigating a non-existent near miss returns 404"""
        fake_id = "nonexistent-id-12345"
        
        params = {
            "severity": "red",
            "action_required": "Test",
            "progress": "not_started",
            "investigated_by": "Admin"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/near-misses/{fake_id}/investigate",
            params=params
        )
        assert response.status_code == 404
        print(f"✓ 404 returned for non-existent near miss")
    
    def test_near_miss_list_shows_severity_and_progress(self):
        """Test that near miss list includes severity and progress fields"""
        # Create a near miss with investigation
        near_miss_id = self.test_investigate_near_miss_with_severity_red()
        
        # Get the list
        response = requests.get(f"{BASE_URL}/api/near-misses?limit=200")
        assert response.status_code == 200
        near_misses = response.json()
        
        # Find our test near miss
        test_nm = next((nm for nm in near_misses if nm["id"] == near_miss_id), None)
        assert test_nm is not None
        
        # Verify fields are present
        assert "severity" in test_nm
        assert "progress" in test_nm
        assert "action_required" in test_nm
        assert "investigation_notes" in test_nm
        assert "investigated_by" in test_nm
        assert "investigated_at" in test_nm
        
        print(f"✓ Near miss list includes all investigation fields")
    
    def test_all_swp_checkboxes(self):
        """Test all three SWP checkboxes can be set"""
        near_miss_id = self.test_create_near_miss_for_investigation()
        
        # Set all three checkboxes to True
        params = {
            "severity": "red",
            "action_required": "Full SWP review needed",
            "progress": "not_started",
            "investigation_notes": "All SWP issues identified",
            "no_swp_or_not_covered": "true",
            "swp_training_not_received": "true",
            "trained_but_not_following": "true",
            "investigated_by": "Admin User"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/near-misses/{near_miss_id}/investigate",
            params=params
        )
        assert response.status_code == 200
        
        # Verify all checkboxes are True
        get_response = requests.get(f"{BASE_URL}/api/near-misses?limit=200")
        near_misses = get_response.json()
        updated_nm = next((nm for nm in near_misses if nm["id"] == near_miss_id), None)
        
        # Note: The API may return string "true" or boolean True
        assert updated_nm["no_swp_or_not_covered"] in [True, "true"]
        assert updated_nm["swp_training_not_received"] in [True, "true"]
        assert updated_nm["trained_but_not_following"] in [True, "true"]
        print(f"✓ All SWP checkboxes set correctly")


class TestNearMissInvestigationCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_data(self):
        """Clean up TEST_ prefixed near misses"""
        response = requests.get(f"{BASE_URL}/api/near-misses?limit=500")
        if response.status_code == 200:
            near_misses = response.json()
            test_count = sum(1 for nm in near_misses if nm.get("description", "").startswith("TEST_INVESTIGATION_"))
            print(f"Found {test_count} test near misses (TEST_INVESTIGATION_ prefix)")
            # Note: No delete endpoint available, so just report
        print("✓ Cleanup check completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
