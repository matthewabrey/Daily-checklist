"""Backend tests for Pre Service Check feature (service-check-templates, parts_required)"""
import os

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

# Sections come from the "Irrigators - Pre Service Sheet" tab of AssetList.xlsx (check type "Irrigator")
EXPECTED_SECTIONS = [
    "Gun Carriage General",
    "Gun Carriage Wheels and Axles",
    "Gun and Nozel",
    "Hydraulic Rams",
    "Drum and Bearings",
    "Guards",
    "Computer/Computer Box",
    "Pipe",
    "Solar Panel",
    "Raindancer",
    "Raindancer Serial Number",
    "Seals",
    "Intake Pipe Work",
]


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def created_ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(api, created_ids):
    # NOTE: backend exposes no DELETE /api/checklists/{id} endpoint, so test records
    # (all prefixed with TEST_ in notes/parts) cannot be removed via the API.
    yield
    if created_ids:
        print("\nTest checklists left in DB (no DELETE endpoint): " + ", ".join(created_ids))


# --- Module: service check templates (assigned per check type from AssetList tabs) ---
class TestServiceCheckTemplates:
    def test_for_asset_irrigator(self, api):
        r = api.get(f"{BASE_URL}/api/service-check-templates/for-asset", params={"check_type": "Irrigator", "make": "Perrot"}, timeout=30)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["check_type"] == "Irrigator"
        assert d["name"] == "Irrigator Pre Service Check"
        assert d["sections"] == EXPECTED_SECTIONS
        assert len(d["sections"]) == 13

    def test_for_asset_case_insensitive_any_make(self, api):
        for make in ("Perrot", "Briggs", "Bauer"):
            r = api.get(f"{BASE_URL}/api/service-check-templates/for-asset", params={"check_type": "irrigator", "make": make}, timeout=30)
            assert r.status_code == 200, make
            assert r.json()["check_type"] == "Irrigator"

    def test_for_asset_unknown_check_type_404(self, api):
        r = api.get(f"{BASE_URL}/api/service-check-templates/for-asset", params={"check_type": "Tractor", "make": "JCB"}, timeout=30)
        assert r.status_code == 404

    def test_for_asset_missing_params_404(self, api):
        r = api.get(f"{BASE_URL}/api/service-check-templates/for-asset", timeout=30)
        assert r.status_code == 404

    def test_list_templates_contains_irrigator(self, api):
        r = api.get(f"{BASE_URL}/api/service-check-templates", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        assert any(t["check_type"] == "Irrigator" and t["sections"] == EXPECTED_SECTIONS for t in data)
        assert all("_id" not in t for t in data)

    def test_single_template_per_check_type(self, api):
        r = api.get(f"{BASE_URL}/api/service-check-templates", timeout=30)
        irrigators = [t for t in r.json() if t["check_type"] == "Irrigator"]
        assert len(irrigators) == 1, f"Expected exactly 1 Irrigator template, got {len(irrigators)}"
        # legacy make-only Perrot sheet is gone once Excel-driven sheets exist
        assert not [t for t in r.json() if not t.get("check_type")]

    def test_diagnostics_lists_service_templates(self, api):
        r = api.get(f"{BASE_URL}/api/admin/template-diagnostics", timeout=60)
        assert r.status_code == 200
        st = r.json()["service_templates"]
        irr = next(t for t in st if t["check_type"] == "Irrigator")
        assert irr["section_count"] == 13
        assert irr["assets_using_this"] >= 90


# --- Module: pre_service_check checklist submission + persistence ---
class TestPreServiceCheckSubmission:
    payload_parts = ["TEST_Drum bearing", "TEST_Hose repair kit"]

    def test_create_pre_service_check(self, api, created_ids):
        statuses = ["satisfactory"] * 10 + ["unsatisfactory", "satisfactory", "n/a"]
        items = [
            {"item": s, "status": statuses[i], "notes": "TEST notes" if statuses[i] == "unsatisfactory" else ""}
            for i, s in enumerate(EXPECTED_SECTIONS)
        ]
        body = {
            "employee_number": "4444",
            "staff_name": "Admin User",
            "machine_make": "Perrot",
            "machine_model": "Machine 1",
            "check_type": "pre_service_check",
            "checklist_items": items,
            "workshop_notes": "TEST_other issues found",
            "parts_required": self.payload_parts,
        }
        r = api.post(f"{BASE_URL}/api/checklists", json=body, timeout=60)
        assert r.status_code == 200, r.text[:500]
        d = r.json()
        assert d["check_type"] == "pre_service_check"
        assert d["parts_required"] == self.payload_parts
        assert len(d["checklist_items"]) == 13
        assert d["checklist_items"][10]["status"] == "unsatisfactory"
        assert isinstance(d["id"], str)
        created_ids.append(d["id"])

    def test_get_by_id_persisted(self, api, created_ids):
        cid = created_ids[0]
        r = api.get(f"{BASE_URL}/api/checklists/{cid}", timeout=30)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["check_type"] == "pre_service_check"
        assert d["parts_required"] == self.payload_parts
        assert d["workshop_notes"] == "TEST_other issues found"
        assert "_id" not in d

    def test_by_machine_includes_parts_required(self, api, created_ids):
        r = api.get(f"{BASE_URL}/api/checklists/by-machine",
                    params={"make": "Perrot", "name": "Machine 1"}, timeout=60)
        assert r.status_code == 200, r.text[:400]
        payload = r.json()
        assert isinstance(payload, dict) and "checklists" in payload
        data = payload["checklists"]
        rec = next((c for c in data if c["id"] == created_ids[0]), None)
        assert rec is not None, "created record not returned by by-machine"
        assert "parts_required" in rec
        assert rec["parts_required"] == self.payload_parts

    def test_filter_by_check_type(self, api, created_ids):
        r = api.get(f"{BASE_URL}/api/checklists",
                    params={"check_type": "pre_service_check", "limit": 20}, timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert all(c["check_type"] == "pre_service_check" for c in data)
        assert any(c["id"] == created_ids[0] for c in data)


# --- Module: backwards compatibility ---
class TestBackwardsCompatibility:
    def test_daily_check_without_parts_required(self, api, created_ids):
        body = {
            "employee_number": "4444",
            "staff_name": "Admin User",
            "machine_make": "JCB",
            "machine_model": "TEST_Machine",
            "check_type": "daily_check",
            "checklist_items": [{"item": "Oil Level", "status": "satisfactory", "notes": ""}],
        }
        r = api.post(f"{BASE_URL}/api/checklists", json=body, timeout=60)
        assert r.status_code == 200, r.text[:500]
        d = r.json()
        assert d["parts_required"] == []
        created_ids.append(d["id"])
        g = api.get(f"{BASE_URL}/api/checklists/{d['id']}", timeout=30)
        assert g.status_code == 200
        assert g.json()["check_type"] == "daily_check"


# --- Module: dashboard stats ---
class TestDashboardStats:
    def test_stats_ok(self, api):
        r = api.get(f"{BASE_URL}/api/dashboard/stats", timeout=60)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert "total_completed" in d
        assert isinstance(d["total_completed"], int)
        assert d["total_completed"] > 0
