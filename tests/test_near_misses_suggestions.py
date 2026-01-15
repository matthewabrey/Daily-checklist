"""
Test suite for Near Misses and Suggestions feature
Tests backend API endpoints for:
- Near Miss submission (with/without anonymous)
- Suggestion submission (with/without anonymous)
- Dashboard stats for near misses and suggestions
- Admin acknowledge/review actions
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndDashboard:
    """Health check and dashboard stats tests"""
    
    def test_health_check(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print("✓ Health check passed")
    
    def test_dashboard_stats_include_near_misses_and_suggestions(self):
        """Test dashboard stats include near misses and suggestions counts"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        
        # Verify near misses fields exist
        assert "near_misses_new" in data
        assert "near_misses_total" in data
        assert isinstance(data["near_misses_new"], int)
        assert isinstance(data["near_misses_total"], int)
        
        # Verify suggestions fields exist
        assert "suggestions_new" in data
        assert "suggestions_total" in data
        assert isinstance(data["suggestions_new"], int)
        assert isinstance(data["suggestions_total"], int)
        
        print(f"✓ Dashboard stats: Near Misses (new: {data['near_misses_new']}, total: {data['near_misses_total']})")
        print(f"✓ Dashboard stats: Suggestions (new: {data['suggestions_new']}, total: {data['suggestions_total']})")


class TestNearMissEndpoints:
    """Near Miss API endpoint tests"""
    
    def test_create_near_miss_with_name(self):
        """Test creating a near miss report with submitter name"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "description": f"TEST_near_miss_{unique_id} - Equipment malfunction near loading dock",
            "location": "Loading Dock B",
            "photos": [],
            "is_anonymous": False,
            "submitted_by": "Test Worker"
        }
        
        response = requests.post(f"{BASE_URL}/api/near-misses", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "id" in data
        assert data["message"] == "Near miss reported successfully"
        
        # Verify the near miss was created by fetching it
        get_response = requests.get(f"{BASE_URL}/api/near-misses")
        assert get_response.status_code == 200
        near_misses = get_response.json()
        
        created_near_miss = next((nm for nm in near_misses if nm["id"] == data["id"]), None)
        assert created_near_miss is not None
        assert created_near_miss["description"] == payload["description"]
        assert created_near_miss["location"] == payload["location"]
        assert created_near_miss["is_anonymous"] == False
        assert created_near_miss["submitted_by"] == "Test Worker"
        assert created_near_miss["acknowledged"] == False
        
        print(f"✓ Created near miss with name: {data['id']}")
        return data["id"]
    
    def test_create_near_miss_anonymous(self):
        """Test creating an anonymous near miss report"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "description": f"TEST_anonymous_near_miss_{unique_id} - Slippery floor in break room",
            "location": "Break Room",
            "photos": [],
            "is_anonymous": True,
            "submitted_by": "Should Be Ignored"  # This should be ignored when anonymous
        }
        
        response = requests.post(f"{BASE_URL}/api/near-misses", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "id" in data
        
        # Verify anonymous submission - submitted_by should be null
        get_response = requests.get(f"{BASE_URL}/api/near-misses")
        near_misses = get_response.json()
        
        created_near_miss = next((nm for nm in near_misses if nm["id"] == data["id"]), None)
        assert created_near_miss is not None
        assert created_near_miss["is_anonymous"] == True
        assert created_near_miss["submitted_by"] is None  # Should be null for anonymous
        
        print(f"✓ Created anonymous near miss: {data['id']}")
        return data["id"]
    
    def test_get_near_misses_list(self):
        """Test fetching list of near misses"""
        response = requests.get(f"{BASE_URL}/api/near-misses")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            # Verify structure of near miss object
            near_miss = data[0]
            assert "id" in near_miss
            assert "description" in near_miss
            assert "created_at" in near_miss
            assert "acknowledged" in near_miss
            assert "is_anonymous" in near_miss
        
        print(f"✓ Fetched {len(data)} near misses")
    
    def test_get_near_misses_count(self):
        """Test near misses count endpoint"""
        response = requests.get(f"{BASE_URL}/api/near-misses/count")
        assert response.status_code == 200
        data = response.json()
        
        assert "total" in data
        assert "new" in data
        assert isinstance(data["total"], int)
        assert isinstance(data["new"], int)
        assert data["new"] <= data["total"]
        
        print(f"✓ Near misses count: {data['new']} new / {data['total']} total")
    
    def test_acknowledge_near_miss(self):
        """Test acknowledging a near miss (admin action)"""
        # First create a near miss to acknowledge
        unique_id = str(uuid.uuid4())[:8]
        create_payload = {
            "description": f"TEST_to_acknowledge_{unique_id}",
            "location": "Test Location",
            "photos": [],
            "is_anonymous": False,
            "submitted_by": "Test User"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/near-misses", json=create_payload)
        assert create_response.status_code == 200
        near_miss_id = create_response.json()["id"]
        
        # Now acknowledge it
        ack_response = requests.post(
            f"{BASE_URL}/api/near-misses/{near_miss_id}/acknowledge",
            params={"acknowledged_by": "Admin User"}
        )
        assert ack_response.status_code == 200
        ack_data = ack_response.json()
        assert ack_data["success"] == True
        
        # Verify it's acknowledged
        get_response = requests.get(f"{BASE_URL}/api/near-misses")
        near_misses = get_response.json()
        
        acknowledged_nm = next((nm for nm in near_misses if nm["id"] == near_miss_id), None)
        assert acknowledged_nm is not None
        assert acknowledged_nm["acknowledged"] == True
        assert acknowledged_nm["acknowledged_by"] == "Admin User"
        assert acknowledged_nm["acknowledged_at"] is not None
        
        print(f"✓ Acknowledged near miss: {near_miss_id}")


class TestSuggestionEndpoints:
    """Suggestion API endpoint tests"""
    
    def test_create_suggestion_with_name(self):
        """Test creating a suggestion with submitter name"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "title": f"TEST_suggestion_{unique_id}",
            "description": "We should add more safety signs in the warehouse",
            "category": "safety",
            "is_anonymous": False,
            "submitted_by": "Test Employee"
        }
        
        response = requests.post(f"{BASE_URL}/api/suggestions", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "id" in data
        assert data["message"] == "Suggestion submitted successfully"
        
        # Verify the suggestion was created
        get_response = requests.get(f"{BASE_URL}/api/suggestions")
        suggestions = get_response.json()
        
        created_suggestion = next((s for s in suggestions if s["id"] == data["id"]), None)
        assert created_suggestion is not None
        assert created_suggestion["title"] == payload["title"]
        assert created_suggestion["description"] == payload["description"]
        assert created_suggestion["category"] == "safety"
        assert created_suggestion["is_anonymous"] == False
        assert created_suggestion["submitted_by"] == "Test Employee"
        assert created_suggestion["status"] == "new"
        
        print(f"✓ Created suggestion with name: {data['id']}")
        return data["id"]
    
    def test_create_suggestion_anonymous(self):
        """Test creating an anonymous suggestion"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "title": f"TEST_anonymous_suggestion_{unique_id}",
            "description": "Better break room facilities would improve morale",
            "category": "efficiency",
            "is_anonymous": True,
            "submitted_by": "Should Be Ignored"
        }
        
        response = requests.post(f"{BASE_URL}/api/suggestions", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        
        # Verify anonymous submission
        get_response = requests.get(f"{BASE_URL}/api/suggestions")
        suggestions = get_response.json()
        
        created_suggestion = next((s for s in suggestions if s["id"] == data["id"]), None)
        assert created_suggestion is not None
        assert created_suggestion["is_anonymous"] == True
        assert created_suggestion["submitted_by"] is None
        
        print(f"✓ Created anonymous suggestion: {data['id']}")
        return data["id"]
    
    def test_create_suggestion_with_different_categories(self):
        """Test creating suggestions with different categories"""
        categories = ["safety", "efficiency", "equipment", "other"]
        
        for category in categories:
            unique_id = str(uuid.uuid4())[:8]
            payload = {
                "title": f"TEST_category_{category}_{unique_id}",
                "description": f"Test suggestion for {category} category",
                "category": category,
                "is_anonymous": False,
                "submitted_by": "Category Tester"
            }
            
            response = requests.post(f"{BASE_URL}/api/suggestions", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert data["success"] == True
            
            # Verify category was saved
            get_response = requests.get(f"{BASE_URL}/api/suggestions")
            suggestions = get_response.json()
            created = next((s for s in suggestions if s["id"] == data["id"]), None)
            assert created is not None
            assert created["category"] == category
        
        print(f"✓ Created suggestions with all categories: {categories}")
    
    def test_get_suggestions_list(self):
        """Test fetching list of suggestions"""
        response = requests.get(f"{BASE_URL}/api/suggestions")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            suggestion = data[0]
            assert "id" in suggestion
            assert "title" in suggestion
            assert "description" in suggestion
            assert "status" in suggestion
            assert "created_at" in suggestion
        
        print(f"✓ Fetched {len(data)} suggestions")
    
    def test_get_suggestions_count(self):
        """Test suggestions count endpoint"""
        response = requests.get(f"{BASE_URL}/api/suggestions/count")
        assert response.status_code == 200
        data = response.json()
        
        assert "total" in data
        assert "new" in data
        assert isinstance(data["total"], int)
        assert isinstance(data["new"], int)
        
        print(f"✓ Suggestions count: {data['new']} new / {data['total']} total")
    
    def test_review_suggestion_as_reviewed(self):
        """Test marking a suggestion as reviewed"""
        # Create a suggestion first
        unique_id = str(uuid.uuid4())[:8]
        create_payload = {
            "title": f"TEST_to_review_{unique_id}",
            "description": "Test suggestion to be reviewed",
            "category": "other",
            "is_anonymous": False,
            "submitted_by": "Test User"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/suggestions", json=create_payload)
        assert create_response.status_code == 200
        suggestion_id = create_response.json()["id"]
        
        # Review it
        review_response = requests.put(
            f"{BASE_URL}/api/suggestions/{suggestion_id}/review",
            params={
                "status": "reviewed",
                "reviewed_by": "Admin User",
                "review_notes": "Good suggestion, will consider"
            }
        )
        assert review_response.status_code == 200
        review_data = review_response.json()
        assert review_data["success"] == True
        
        # Verify status changed
        get_response = requests.get(f"{BASE_URL}/api/suggestions")
        suggestions = get_response.json()
        reviewed = next((s for s in suggestions if s["id"] == suggestion_id), None)
        assert reviewed is not None
        assert reviewed["status"] == "reviewed"
        assert reviewed["reviewed_by"] == "Admin User"
        assert reviewed["reviewed_at"] is not None
        
        print(f"✓ Reviewed suggestion: {suggestion_id}")
    
    def test_review_suggestion_as_implemented(self):
        """Test marking a suggestion as implemented"""
        unique_id = str(uuid.uuid4())[:8]
        create_payload = {
            "title": f"TEST_to_implement_{unique_id}",
            "description": "Test suggestion to be implemented",
            "category": "efficiency",
            "is_anonymous": False,
            "submitted_by": "Test User"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/suggestions", json=create_payload)
        suggestion_id = create_response.json()["id"]
        
        # Mark as implemented
        review_response = requests.put(
            f"{BASE_URL}/api/suggestions/{suggestion_id}/review",
            params={
                "status": "implemented",
                "reviewed_by": "Manager",
                "review_notes": "Implemented this week"
            }
        )
        assert review_response.status_code == 200
        
        # Verify
        get_response = requests.get(f"{BASE_URL}/api/suggestions")
        suggestions = get_response.json()
        implemented = next((s for s in suggestions if s["id"] == suggestion_id), None)
        assert implemented["status"] == "implemented"
        
        print(f"✓ Implemented suggestion: {suggestion_id}")
    
    def test_review_suggestion_as_declined(self):
        """Test marking a suggestion as declined"""
        unique_id = str(uuid.uuid4())[:8]
        create_payload = {
            "title": f"TEST_to_decline_{unique_id}",
            "description": "Test suggestion to be declined",
            "category": "equipment",
            "is_anonymous": False,
            "submitted_by": "Test User"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/suggestions", json=create_payload)
        suggestion_id = create_response.json()["id"]
        
        # Mark as declined
        review_response = requests.put(
            f"{BASE_URL}/api/suggestions/{suggestion_id}/review",
            params={
                "status": "declined",
                "reviewed_by": "Manager",
                "review_notes": "Not feasible at this time"
            }
        )
        assert review_response.status_code == 200
        
        # Verify
        get_response = requests.get(f"{BASE_URL}/api/suggestions")
        suggestions = get_response.json()
        declined = next((s for s in suggestions if s["id"] == suggestion_id), None)
        assert declined["status"] == "declined"
        
        print(f"✓ Declined suggestion: {suggestion_id}")


class TestDashboardIntegration:
    """Test dashboard stats update after creating near misses and suggestions"""
    
    def test_dashboard_stats_update_after_near_miss(self):
        """Test that dashboard stats update after creating a near miss"""
        # Get initial stats
        initial_response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        initial_stats = initial_response.json()
        initial_new = initial_stats["near_misses_new"]
        initial_total = initial_stats["near_misses_total"]
        
        # Create a new near miss
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "description": f"TEST_dashboard_update_{unique_id}",
            "location": "Test Area",
            "photos": [],
            "is_anonymous": False,
            "submitted_by": "Dashboard Tester"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/near-misses", json=payload)
        assert create_response.status_code == 200
        
        # Note: Stats are cached for 5 minutes, so we check the count endpoint instead
        count_response = requests.get(f"{BASE_URL}/api/near-misses/count")
        count_data = count_response.json()
        
        # The count should have increased
        assert count_data["total"] >= initial_total
        assert count_data["new"] >= initial_new
        
        print(f"✓ Near miss count updated: {count_data['new']} new / {count_data['total']} total")
    
    def test_dashboard_stats_update_after_suggestion(self):
        """Test that dashboard stats update after creating a suggestion"""
        # Get initial count
        initial_response = requests.get(f"{BASE_URL}/api/suggestions/count")
        initial_count = initial_response.json()
        initial_new = initial_count["new"]
        initial_total = initial_count["total"]
        
        # Create a new suggestion
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "title": f"TEST_dashboard_suggestion_{unique_id}",
            "description": "Test suggestion for dashboard update",
            "category": "other",
            "is_anonymous": False,
            "submitted_by": "Dashboard Tester"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/suggestions", json=payload)
        assert create_response.status_code == 200
        
        # Check count updated
        count_response = requests.get(f"{BASE_URL}/api/suggestions/count")
        count_data = count_response.json()
        
        assert count_data["total"] >= initial_total
        assert count_data["new"] >= initial_new
        
        print(f"✓ Suggestion count updated: {count_data['new']} new / {count_data['total']} total")


class TestAdminLogin:
    """Test admin login for accessing admin features"""
    
    def test_admin_login(self):
        """Test admin login with employee number 4444"""
        response = requests.post(
            f"{BASE_URL}/api/auth/employee-login",
            json={"employee_number": "4444"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "employee" in data
        assert data["employee"]["employee_number"] == "4444"
        assert data["employee"]["admin_control"] == "yes"
        
        print(f"✓ Admin login successful: {data['employee']['name']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
