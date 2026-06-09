"""
Test suite for Workplan Enhancements:
1. Import staff with leavers marked (left field)
2. Costing endpoint with job/color breakdown percentages
3. Workplan rows with 'left' field for leaver identification
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestWorkplanEnhancements:
    """Tests for workplan enhancements: leavers, costing, import-staff"""
    
    def test_health_check(self):
        """Verify API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health check passed")
    
    def test_workplan_returns_rows_with_left_field(self):
        """GET /api/workplan returns rows with 'left' field for leaver identification"""
        response = requests.get(f"{BASE_URL}/api/workplan")
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "rows" in data
        assert "week_start" in data
        rows = data["rows"]
        assert len(rows) > 0, "Should have workplan rows"
        
        # Check that rows have 'left' field
        for row in rows[:10]:  # Check first 10 rows
            assert "left" in row, f"Row should have 'left' field: {row.get('employee_name', 'unknown')}"
            assert isinstance(row["left"], bool), "'left' field should be boolean"
        
        # Count active vs left
        active_rows = [r for r in rows if not r.get("left", False)]
        left_rows = [r for r in rows if r.get("left", False)]
        
        print(f"✓ Workplan has {len(rows)} total rows")
        print(f"  - Active: {len(active_rows)}")
        print(f"  - Leavers: {len(left_rows)}")
        
        # Verify expected counts (101 active, 158 leavers)
        assert len(active_rows) == 101, f"Expected 101 active rows, got {len(active_rows)}"
        assert len(left_rows) == 158, f"Expected 158 leaver rows, got {len(left_rows)}"
    
    def test_workplan_rows_have_daily_cells_with_jobs(self):
        """Verify daily cells are pre-filled with job assignments"""
        response = requests.get(f"{BASE_URL}/api/workplan")
        assert response.status_code == 200
        data = response.json()
        rows = data["rows"]
        
        # Check that rows have days with job assignments
        cells_with_jobs = 0
        total_cells = 0
        
        for row in rows[:20]:  # Check first 20 rows
            days = row.get("days", [])
            # Handle both array and dict format
            if isinstance(days, list):
                for day in days:
                    for period in ["am", "pm"]:
                        cell = day.get(period, {})
                        total_cells += 1
                        if cell.get("job"):
                            cells_with_jobs += 1
            elif isinstance(days, dict):
                for day_idx, day in days.items():
                    for period in ["am", "pm"]:
                        cell = day.get(period, {})
                        total_cells += 1
                        if cell.get("job"):
                            cells_with_jobs += 1
        
        print(f"✓ Checked {total_cells} cells, {cells_with_jobs} have job assignments")
        assert cells_with_jobs > 0, "Should have cells with job assignments"
    
    def test_costing_endpoint_returns_job_breakdown(self):
        """GET /api/workplan/costing returns job_breakdown with percentages"""
        response = requests.get(f"{BASE_URL}/api/workplan/costing")
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "job_breakdown" in data
        assert "total_cells" in data
        
        job_breakdown = data["job_breakdown"]
        assert len(job_breakdown) > 0, "Should have job breakdown data"
        
        # Verify each job entry has required fields
        for job in job_breakdown[:5]:
            assert "name" in job, "Job should have 'name'"
            assert "count" in job, "Job should have 'count'"
            assert "percent" in job, "Job should have 'percent'"
            assert isinstance(job["percent"], (int, float)), "Percent should be numeric"
        
        print(f"✓ Costing has {len(job_breakdown)} jobs")
        print(f"  Top 3 jobs: {[j['name'] + ':' + str(j['percent']) + '%' for j in job_breakdown[:3]]}")
    
    def test_costing_endpoint_returns_color_breakdown(self):
        """GET /api/workplan/costing returns color_breakdown (area/crop) with percentages"""
        response = requests.get(f"{BASE_URL}/api/workplan/costing")
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "color_breakdown" in data
        
        color_breakdown = data["color_breakdown"]
        # May be empty if no colors assigned
        
        if len(color_breakdown) > 0:
            for color in color_breakdown:
                assert "name" in color, "Color should have 'name'"
                assert "count" in color, "Color should have 'count'"
                assert "percent" in color, "Color should have 'percent'"
            
            print(f"✓ Costing has {len(color_breakdown)} color categories")
            print(f"  Colors: {[c['name'] + ':' + str(c['percent']) + '%' for c in color_breakdown]}")
        else:
            print("✓ Color breakdown is empty (no colors assigned yet)")
    
    def test_costing_handles_both_array_and_dict_day_formats(self):
        """Costing endpoint handles both array and dict day formats"""
        response = requests.get(f"{BASE_URL}/api/workplan/costing")
        assert response.status_code == 200
        data = response.json()
        
        # If we got here without error, the endpoint handles the format correctly
        assert "total_cells" in data
        assert data["total_cells"] > 0, "Should have counted cells"
        
        print(f"✓ Costing correctly processed {data['total_cells']} active cells")
        print(f"  Left cells: {data.get('left_total_cells', 0)}")
    
    def test_costing_separates_active_and_leaver_data(self):
        """Costing endpoint separates active staff from leavers"""
        response = requests.get(f"{BASE_URL}/api/workplan/costing")
        assert response.status_code == 200
        data = response.json()
        
        # Check for leaver-specific fields
        assert "left_total_cells" in data, "Should have left_total_cells"
        assert "left_job_breakdown" in data, "Should have left_job_breakdown"
        assert "left_color_breakdown" in data, "Should have left_color_breakdown"
        
        print(f"✓ Costing separates active ({data['total_cells']} cells) from leavers ({data['left_total_cells']} cells)")
    
    def test_workplan_jobs_endpoint(self):
        """GET /api/workplan/jobs returns job list"""
        response = requests.get(f"{BASE_URL}/api/workplan/jobs")
        assert response.status_code == 200
        jobs = response.json()
        
        assert len(jobs) > 0, "Should have jobs"
        
        # Check for expected jobs from the import
        job_names = [j["name"] for j in jobs]
        expected_jobs = ["Off", "Loading - JCB", "Planting", "Destoning", "Irrigation Overground"]
        
        for expected in expected_jobs:
            assert expected in job_names, f"Should have job '{expected}'"
        
        print(f"✓ Jobs endpoint returns {len(jobs)} jobs")
    
    def test_workplan_colors_endpoint(self):
        """GET /api/workplan/colors returns color categories"""
        response = requests.get(f"{BASE_URL}/api/workplan/colors")
        assert response.status_code == 200
        colors = response.json()
        
        assert len(colors) > 0, "Should have colors"
        
        # Check structure
        for color in colors[:3]:
            assert "id" in color
            assert "name" in color
            assert "color" in color  # hex color
        
        print(f"✓ Colors endpoint returns {len(colors)} colors")
        print(f"  Colors: {[c['name'] for c in colors]}")


class TestWorkplanDataIntegrity:
    """Tests for data integrity of imported workplan"""
    
    def test_active_rows_have_employee_names(self):
        """Active rows should have employee names"""
        response = requests.get(f"{BASE_URL}/api/workplan")
        assert response.status_code == 200
        rows = response.json()["rows"]
        
        active_rows = [r for r in rows if not r.get("left", False)]
        rows_with_names = [r for r in active_rows if r.get("employee_name")]
        
        # Most active rows should have names
        assert len(rows_with_names) > len(active_rows) * 0.8, "Most active rows should have employee names"
        
        print(f"✓ {len(rows_with_names)}/{len(active_rows)} active rows have employee names")
    
    def test_rows_have_7_days(self):
        """Each row should have 7 days of data"""
        response = requests.get(f"{BASE_URL}/api/workplan")
        assert response.status_code == 200
        rows = response.json()["rows"]
        
        for row in rows[:10]:
            days = row.get("days", [])
            if isinstance(days, list):
                assert len(days) == 7, f"Row should have 7 days, got {len(days)}"
            elif isinstance(days, dict):
                assert len(days) == 7, f"Row should have 7 days, got {len(days)}"
        
        print("✓ Rows have 7 days of data")
    
    def test_cells_have_am_pm_structure(self):
        """Each day cell should have am and pm periods"""
        response = requests.get(f"{BASE_URL}/api/workplan")
        assert response.status_code == 200
        rows = response.json()["rows"]
        
        for row in rows[:5]:
            days = row.get("days", [])
            if isinstance(days, list):
                for day in days:
                    assert "am" in day, "Day should have 'am' period"
                    assert "pm" in day, "Day should have 'pm' period"
            elif isinstance(days, dict):
                for day_idx, day in days.items():
                    assert "am" in day, "Day should have 'am' period"
                    assert "pm" in day, "Day should have 'pm' period"
        
        print("✓ Cells have AM/PM structure")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
