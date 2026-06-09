"""
Test suite for Daily Workplan feature
Tests: Jobs, Colors, Draft Workplan, Publish Workplan
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://core-checks-only.preview.emergentagent.com').rstrip('/')

class TestWorkplanJobs:
    """Tests for /api/workplan/jobs endpoints"""
    
    def test_get_jobs_returns_seeded_data(self):
        """GET /api/workplan/jobs should return ~70 seeded jobs"""
        response = requests.get(f"{BASE_URL}/api/workplan/jobs")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        jobs = response.json()
        assert isinstance(jobs, list), "Jobs should be a list"
        assert len(jobs) >= 50, f"Expected at least 50 seeded jobs, got {len(jobs)}"
        
        # Verify job structure
        if jobs:
            job = jobs[0]
            assert "id" in job, "Job should have 'id' field"
            assert "name" in job, "Job should have 'name' field"
            assert "order" in job, "Job should have 'order' field"
        
        print(f"✓ GET /api/workplan/jobs returned {len(jobs)} jobs")
    
    def test_add_job(self):
        """POST /api/workplan/jobs should add a new job"""
        job_name = f"TEST_JOB_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/workplan/jobs",
            json={"name": job_name}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        job = response.json()
        assert job["name"] == job_name, f"Job name mismatch: {job['name']} != {job_name}"
        assert "id" in job, "Created job should have 'id'"
        
        # Verify job appears in list
        list_response = requests.get(f"{BASE_URL}/api/workplan/jobs")
        jobs = list_response.json()
        job_names = [j["name"] for j in jobs]
        assert job_name in job_names, "Created job should appear in jobs list"
        
        print(f"✓ POST /api/workplan/jobs created job: {job_name}")
        return job["id"]
    
    def test_delete_job(self):
        """DELETE /api/workplan/jobs/{id} should remove a job"""
        # First create a job to delete
        job_name = f"TEST_DELETE_JOB_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/workplan/jobs",
            json={"name": job_name}
        )
        job_id = create_response.json()["id"]
        
        # Delete the job
        delete_response = requests.delete(f"{BASE_URL}/api/workplan/jobs/{job_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        # Verify job is removed
        list_response = requests.get(f"{BASE_URL}/api/workplan/jobs")
        jobs = list_response.json()
        job_ids = [j["id"] for j in jobs]
        assert job_id not in job_ids, "Deleted job should not appear in jobs list"
        
        print(f"✓ DELETE /api/workplan/jobs/{job_id} removed job successfully")


class TestWorkplanColors:
    """Tests for /api/workplan/colors endpoints"""
    
    def test_get_colors_returns_seeded_data(self):
        """GET /api/workplan/colors should return 7 seeded colors"""
        response = requests.get(f"{BASE_URL}/api/workplan/colors")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        colors = response.json()
        assert isinstance(colors, list), "Colors should be a list"
        assert len(colors) >= 7, f"Expected at least 7 seeded colors, got {len(colors)}"
        
        # Verify color structure
        if colors:
            color = colors[0]
            assert "id" in color, "Color should have 'id' field"
            assert "name" in color, "Color should have 'name' field"
            assert "color" in color, "Color should have 'color' field (hex)"
            assert "order" in color, "Color should have 'order' field"
        
        # Check for expected seeded colors
        color_names = [c["name"] for c in colors]
        expected_colors = ["Onions", "Carrots", "Potatoes"]
        for expected in expected_colors:
            assert expected in color_names, f"Expected seeded color '{expected}' not found"
        
        print(f"✓ GET /api/workplan/colors returned {len(colors)} colors")
    
    def test_add_color(self):
        """POST /api/workplan/colors should add a new color"""
        color_name = f"TEST_COLOR_{uuid.uuid4().hex[:8]}"
        color_hex = "#ff5733"
        
        response = requests.post(
            f"{BASE_URL}/api/workplan/colors",
            json={"name": color_name, "color": color_hex}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        color = response.json()
        assert color["name"] == color_name, f"Color name mismatch"
        assert color["color"] == color_hex, f"Color hex mismatch"
        assert "id" in color, "Created color should have 'id'"
        
        print(f"✓ POST /api/workplan/colors created color: {color_name}")
        return color["id"]
    
    def test_update_color(self):
        """PUT /api/workplan/colors/{id} should update a color"""
        # First create a color to update
        color_name = f"TEST_UPDATE_COLOR_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/workplan/colors",
            json={"name": color_name, "color": "#000000"}
        )
        color_id = create_response.json()["id"]
        
        # Update the color
        new_name = f"UPDATED_{color_name}"
        new_hex = "#ffffff"
        update_response = requests.put(
            f"{BASE_URL}/api/workplan/colors/{color_id}",
            json={"name": new_name, "color": new_hex}
        )
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        
        # Verify update
        list_response = requests.get(f"{BASE_URL}/api/workplan/colors")
        colors = list_response.json()
        updated_color = next((c for c in colors if c["id"] == color_id), None)
        assert updated_color is not None, "Updated color should exist"
        assert updated_color["name"] == new_name, "Color name should be updated"
        assert updated_color["color"] == new_hex, "Color hex should be updated"
        
        print(f"✓ PUT /api/workplan/colors/{color_id} updated color successfully")
    
    def test_delete_color(self):
        """DELETE /api/workplan/colors/{id} should remove a color"""
        # First create a color to delete
        color_name = f"TEST_DELETE_COLOR_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/workplan/colors",
            json={"name": color_name, "color": "#123456"}
        )
        color_id = create_response.json()["id"]
        
        # Delete the color
        delete_response = requests.delete(f"{BASE_URL}/api/workplan/colors/{color_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        # Verify color is removed
        list_response = requests.get(f"{BASE_URL}/api/workplan/colors")
        colors = list_response.json()
        color_ids = [c["id"] for c in colors]
        assert color_id not in color_ids, "Deleted color should not appear in colors list"
        
        print(f"✓ DELETE /api/workplan/colors/{color_id} removed color successfully")


class TestWorkplanDraft:
    """Tests for draft workplan endpoints"""
    
    def test_get_workplan_returns_structure(self):
        """GET /api/workplan should return draft workplan structure"""
        response = requests.get(f"{BASE_URL}/api/workplan")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Should have these fields even if empty
        assert "rows" in data, "Workplan should have 'rows' field"
        assert isinstance(data["rows"], list), "rows should be a list"
        
        print(f"✓ GET /api/workplan returned workplan with {len(data.get('rows', []))} rows")
    
    def test_save_workplan(self):
        """PUT /api/workplan should save a draft workplan"""
        # Create a test workplan
        test_row = {
            "id": str(uuid.uuid4()),
            "vehicle": "Test Tractor",
            "implement": "Test Plough",
            "employee_name": "Test Employee",
            "manager": "Test Manager",
            "start_time": "07:00",
            "notes": "Test notes for workplan",
            "group_color": None,
            "days": [
                {"am": {"job": "Drilling", "color_id": None}, "pm": {"job": "Spraying", "color_id": None}}
                for _ in range(7)
            ]
        }
        
        week_start = "2026-01-06"  # A Monday
        
        response = requests.put(
            f"{BASE_URL}/api/workplan",
            json={"week_start": week_start, "rows": [test_row]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert result.get("success") == True, "Save should return success: true"
        
        # Verify the save by fetching
        get_response = requests.get(f"{BASE_URL}/api/workplan")
        saved_data = get_response.json()
        assert saved_data.get("week_start") == week_start, "Week start should be saved"
        assert len(saved_data.get("rows", [])) >= 1, "Should have at least 1 row saved"
        
        print(f"✓ PUT /api/workplan saved draft workplan successfully")


class TestWorkplanPublish:
    """Tests for workplan publish functionality"""
    
    def test_publish_workplan(self):
        """POST /api/workplan/publish should publish the draft"""
        # First save a draft
        test_row = {
            "id": str(uuid.uuid4()),
            "vehicle": "Publish Test Tractor",
            "implement": "Publish Test Implement",
            "employee_name": "Publish Test Employee",
            "manager": "Publish Test Manager",
            "start_time": "06:30",
            "notes": "Published workplan test",
            "group_color": None,
            "days": [
                {"am": {"job": "Harvesting", "color_id": None}, "pm": {"job": "Carting", "color_id": None}}
                for _ in range(7)
            ]
        }
        
        week_start = "2026-01-13"  # A Monday
        
        # Save draft
        save_response = requests.put(
            f"{BASE_URL}/api/workplan",
            json={"week_start": week_start, "rows": [test_row]}
        )
        assert save_response.status_code == 200, "Draft save should succeed"
        
        # Publish
        publish_response = requests.post(f"{BASE_URL}/api/workplan/publish")
        assert publish_response.status_code == 200, f"Expected 200, got {publish_response.status_code}: {publish_response.text}"
        
        result = publish_response.json()
        assert result.get("success") == True, "Publish should return success: true"
        assert "published_at" in result, "Publish should return published_at timestamp"
        
        print(f"✓ POST /api/workplan/publish published workplan at {result.get('published_at')}")
    
    def test_get_published_workplan(self):
        """GET /api/workplan/published should return published data"""
        response = requests.get(f"{BASE_URL}/api/workplan/published")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Should have these fields
        assert "rows" in data, "Published workplan should have 'rows' field"
        assert isinstance(data["rows"], list), "rows should be a list"
        
        # If there's published data, verify structure
        if data.get("rows"):
            assert "week_start" in data, "Published workplan should have 'week_start'"
            assert "published_at" in data, "Published workplan should have 'published_at'"
            
            row = data["rows"][0]
            assert "employee_name" in row or "vehicle" in row, "Row should have employee or vehicle data"
        
        print(f"✓ GET /api/workplan/published returned published workplan with {len(data.get('rows', []))} rows")


class TestWorkplanIntegration:
    """Integration tests for complete workplan workflow"""
    
    def test_full_workplan_workflow(self):
        """Test complete workflow: create draft -> save -> publish -> verify published"""
        # Get colors for use in cells
        colors_response = requests.get(f"{BASE_URL}/api/workplan/colors")
        colors = colors_response.json()
        color_id = colors[0]["id"] if colors else None
        
        # Get jobs for use in cells
        jobs_response = requests.get(f"{BASE_URL}/api/workplan/jobs")
        jobs = jobs_response.json()
        job_name = jobs[0]["name"] if jobs else "Drilling"
        
        # Create a comprehensive test row
        test_row = {
            "id": str(uuid.uuid4()),
            "vehicle": "Integration Test Tractor",
            "implement": "Integration Test Plough",
            "employee_name": "Integration Test Employee",
            "manager": "Integration Test Manager",
            "start_time": "05:30",
            "notes": "Full integration test",
            "group_color": "#16a34a",
            "days": [
                {"am": {"job": job_name, "color_id": color_id}, "pm": {"job": "Spraying", "color_id": None}}
                for _ in range(7)
            ]
        }
        
        week_start = "2026-01-20"
        
        # Step 1: Save draft
        save_response = requests.put(
            f"{BASE_URL}/api/workplan",
            json={"week_start": week_start, "rows": [test_row]}
        )
        assert save_response.status_code == 200, "Draft save failed"
        print("  Step 1: Draft saved")
        
        # Step 2: Verify draft
        draft_response = requests.get(f"{BASE_URL}/api/workplan")
        draft_data = draft_response.json()
        assert draft_data.get("week_start") == week_start, "Draft week_start mismatch"
        print("  Step 2: Draft verified")
        
        # Step 3: Publish
        publish_response = requests.post(f"{BASE_URL}/api/workplan/publish")
        assert publish_response.status_code == 200, "Publish failed"
        print("  Step 3: Published")
        
        # Step 4: Verify published
        published_response = requests.get(f"{BASE_URL}/api/workplan/published")
        published_data = published_response.json()
        assert published_data.get("week_start") == week_start, "Published week_start mismatch"
        assert len(published_data.get("rows", [])) >= 1, "Published should have rows"
        assert published_data.get("published_at") is not None, "Should have published_at"
        print("  Step 4: Published data verified")
        
        print(f"✓ Full workplan workflow completed successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
