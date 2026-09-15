"""Backend tests: date range filter on checklists/exports + machine service history + sub_items"""
import os
from datetime import date, timedelta

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
TODAY = date.today().isoformat()
MACHINE = {"machine_make": "Perrot", "machine_model": "1 A F Machinery 12541 450"}


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def created(api):
    """One pre-service record (with sub_items) + one daily check with a fault + one clean daily check"""
    ids = {}
    r = api.post(f"{BASE_URL}/api/checklists", json={
        "employee_number": "4444", "staff_name": "Admin User", **MACHINE, "check_type": "pre_service_check",
        "checklist_items": [
            {"item": "Gun Carriage General", "status": "satisfactory", "notes": "", "sub_items": ["Check frame", "Check paint"]},
            {"item": "Pipe", "status": "unsatisfactory", "notes": "TEST_split pipe"},
        ],
        "workshop_notes": "TEST_history other issues", "parts_required": ["TEST_Pipe seal 44-1"],
    }, timeout=60)
    assert r.status_code == 200, r.text[:300]
    ids["service"] = r.json()["id"]
    r = api.post(f"{BASE_URL}/api/checklists", json={
        "employee_number": "4444", "staff_name": "Admin User", **MACHINE, "check_type": "daily_check",
        "checklist_items": [{"item": "Check all Lights are Working", "status": "unsatisfactory", "notes": "TEST_bulb gone"}],
    }, timeout=60)
    assert r.status_code == 200
    ids["faulty_daily"] = r.json()["id"]
    r = api.post(f"{BASE_URL}/api/checklists", json={
        "employee_number": "4444", "staff_name": "Admin User", **MACHINE, "check_type": "daily_check",
        "checklist_items": [{"item": "Check all Lights are Working", "status": "satisfactory", "notes": ""}],
    }, timeout=60)
    assert r.status_code == 200
    ids["clean_daily"] = r.json()["id"]
    return ids


class TestSubItems:
    def test_sub_items_round_trip(self, api, created):
        d = api.get(f"{BASE_URL}/api/checklists/{created['service']}", timeout=30).json()
        assert d["checklist_items"][0]["sub_items"] == ["Check frame", "Check paint"]
        assert d["checklist_items"][1]["sub_items"] == []

    def test_template_has_section_details(self, api):
        d = api.get(f"{BASE_URL}/api/service-check-templates/for-asset", params={"check_type": "Irrigator"}, timeout=30).json()
        assert len(d["section_details"]) == len(d["sections"]) == 13
        assert [s["name"] for s in d["section_details"]] == d["sections"]
        assert all(isinstance(s["sub_items"], list) for s in d["section_details"])


class TestMachineHistory:
    def test_history_contains_service_and_faults_only(self, api, created):
        r = api.get(f"{BASE_URL}/api/checklists/machine-history", params={"make": MACHINE["machine_make"], "model": MACHINE["machine_model"]}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        ids = [rec["id"] for rec in d["records"]]
        assert created["service"] in ids
        assert created["faulty_daily"] in ids
        assert created["clean_daily"] not in ids
        assert d["total"] >= 2
        assert d["last_service_at"] is not None
        assert d["records"] == sorted(d["records"], key=lambda x: x["completed_at"], reverse=True)

    def test_history_no_photo_binaries(self, api, created):
        d = api.get(f"{BASE_URL}/api/checklists/machine-history", params={"make": MACHINE["machine_make"], "model": MACHINE["machine_model"]}, timeout=30).json()
        for rec in d["records"]:
            for item in rec.get("checklist_items") or []:
                for p in item.get("photos") or []:
                    assert "data" not in p

    def test_history_unknown_machine_empty(self, api):
        d = api.get(f"{BASE_URL}/api/checklists/machine-history", params={"make": "Nope", "model": "Nothing"}, timeout=30).json()
        assert d == {"records": [], "total": 0, "last_service_at": None}

    def test_history_requires_params(self, api):
        assert api.get(f"{BASE_URL}/api/checklists/machine-history", timeout=30).status_code == 422


class TestDateRange:
    def test_today_range_includes_new_record(self, api, created):
        r = api.get(f"{BASE_URL}/api/checklists", params={"category": "servicing", "date_from": TODAY, "date_to": TODAY, "limit": 200}, timeout=60)
        assert r.status_code == 200
        assert created["service"] in [c["id"] for c in r.json()]
        for c in r.json():
            assert str(c["completed_at"])[:10] == TODAY

    def test_count_matches_list_and_old_range_empty(self, api):
        params = {"category": "servicing", "date_from": TODAY, "date_to": TODAY}
        count = api.get(f"{BASE_URL}/api/checklists/count", params=params, timeout=30).json()["count"]
        listed = api.get(f"{BASE_URL}/api/checklists", params={**params, "limit": 500}, timeout=60).json()
        assert count == len(listed) >= 1
        assert api.get(f"{BASE_URL}/api/checklists/count", params={"category": "servicing", "date_from": "2001-01-01", "date_to": "2001-01-02"}, timeout=30).json()["count"] == 0

    def test_open_ended_ranges(self, api, created):
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        only_from = api.get(f"{BASE_URL}/api/checklists/count", params={"category": "servicing", "date_from": yesterday}, timeout=30).json()["count"]
        only_to = api.get(f"{BASE_URL}/api/checklists/count", params={"category": "servicing", "date_to": tomorrow}, timeout=30).json()["count"]
        total = api.get(f"{BASE_URL}/api/checklists/count", params={"category": "servicing"}, timeout=30).json()["count"]
        assert 1 <= only_from <= total
        assert only_to == total
        # to-date before today excludes today's record
        assert created["service"] not in [c["id"] for c in api.get(f"{BASE_URL}/api/checklists", params={"category": "servicing", "date_to": yesterday, "limit": 500}, timeout=60).json()]

    def test_bad_date_400(self, api):
        assert api.get(f"{BASE_URL}/api/checklists", params={"date_from": "15/09/2026"}, timeout=30).status_code == 400
        assert api.get(f"{BASE_URL}/api/checklists/count", params={"date_to": "nope"}, timeout=30).status_code == 400

    def test_exports_honour_range_and_filename(self, api):
        params = {"category": "servicing", "date_from": TODAY, "date_to": TODAY}
        r = api.get(f"{BASE_URL}/api/checklists/export/csv", params=params, timeout=60)
        assert r.status_code == 200
        assert f"all_servicing_{TODAY}_to_{TODAY}.csv" in r.headers["content-disposition"]
        rows = [line for line in r.text.splitlines() if line.strip()]
        count = api.get(f"{BASE_URL}/api/checklists/count", params=params, timeout=30).json()["count"]
        assert len(rows) - 1 >= count  # multi-line notes may add lines; never fewer rows than records
        r = api.get(f"{BASE_URL}/api/checklists/export/excel", params={"category": "checks", "date_from": "2001-01-01", "date_to": "2001-01-02"}, timeout=60)
        assert r.status_code == 200
        assert "all_checks_2001-01-01_to_2001-01-02.xlsx" in r.headers["content-disposition"]
        assert r.content[:2] == b"PK"
        r = api.get(f"{BASE_URL}/api/checklists/export/excel-by-machine", params={"category": "checks", "date_from": TODAY, "date_to": TODAY}, timeout=60)
        assert r.status_code == 200 and r.content[:2] == b"PK"
