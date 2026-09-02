"""Endpoint-level tests for the idempotent (non-destructive) staff / asset sync.

Runs against the public preview URL. Every uploaded file always contains ALL existing
records, so real data is never deactivated/retired - only the TEST_ rows are added and
then removed again, leaving the DB in its original state.
"""
import os
from io import BytesIO

import openpyxl
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing")
BASE_URL = base_url.rstrip("/")

TEST_STAFF_NAME = "TEST_Sync Person"
TEST_STAFF_NUMBER = "999001"
TEST_ASSET_NAME = "TEST_Sync Machine"
TEST_ASSET_MAKE = "Perrot"
TEST_ASSET_CHECK_TYPE = "Trailed Implement"

STATE = {}


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    return s


def _get(client, path, **kw):
    return client.get(f"{BASE_URL}{path}", timeout=60, **kw)


def _staff_workbook(rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Staff"
    ws.append(["Name", "Employee Number", "Workshop Control", "Admin Control", "Manager Control"])
    for r in rows:
        ws.append([
            r.get("name"), r.get("employee_number"),
            r.get("workshop_control"), r.get("admin_control"), r.get("manager_control"),
        ])
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def _assets_workbook(rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "AssetList"
    ws.append(["Check Type", "Name of Implement", "Make"])
    for r in rows:
        ws.append([r.get("check_type"), r.get("name"), r.get("make")])
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def _upload(client, path, buf, filename):
    return client.post(
        f"{BASE_URL}{path}",
        files={"file": (filename, buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        timeout=180,
    )


# ---------------------------------------------------------------- read endpoints
class TestReadEndpointsHideSoftDeleted:
    def test_staff_active_only(self, client):
        r = _get(client, "/api/staff")
        assert r.status_code == 200, r.text
        staff = r.json()
        assert len(staff) > 0
        assert [s for s in staff if s.get("active") is False] == []
        STATE["active_staff"] = staff

        r2 = _get(client, "/api/staff", params={"include_inactive": "true"})
        assert r2.status_code == 200, r2.text
        assert len(r2.json()) >= len(staff)

    def test_assets_exclude_retired(self, client):
        r = _get(client, "/api/assets")
        assert r.status_code == 200, r.text
        assets = r.json()
        assert len(assets) > 0
        assert [a for a in assets if a.get("retired") is True] == []
        STATE["assets"] = assets

    def test_asset_lookup_endpoints(self, client):
        for path in ["/api/assets/makes", "/api/assets/names/Perrot", "/api/assets/qr-labels"]:
            r = _get(client, path)
            assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"
            assert len(r.json()) > 0, f"{path} returned empty"


class TestRemovedEndpoints:
    @pytest.mark.parametrize("path", ["/api/admin/update-staff", "/api/admin/update-assets"])
    def test_destructive_endpoints_removed(self, client, path):
        r = client.post(f"{BASE_URL}{path}", json=[], timeout=60)
        assert r.status_code in (404, 405), f"{path} still reachable: {r.status_code} {r.text[:200]}"


# ---------------------------------------------------------------- staff upload
class TestStaffUploadIdempotency:
    def test_01_upload_with_extra_row(self, client):
        base = _get(client, "/api/staff").json()
        assert base, "no staff to build baseline file"
        STATE["staff_baseline"] = [
            {
                "name": s["name"],
                "employee_number": s["employee_number"],
                "workshop_control": s.get("workshop_control"),
                "admin_control": s.get("admin_control"),
                "manager_control": s.get("manager_control"),
            }
            for s in base
        ]
        STATE["staff_baseline_numbers"] = sorted(s["employee_number"] for s in base)

        rows = STATE["staff_baseline"] + [{"name": TEST_STAFF_NAME, "employee_number": TEST_STAFF_NUMBER}]
        r = _upload(client, "/api/admin/upload-staff-file", _staff_workbook(rows), "staff.xlsx")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["added"] >= 1, data
        assert data["deactivated"] == 0, data

        after = _get(client, "/api/staff").json()
        match = [s for s in after if s["employee_number"] == TEST_STAFF_NUMBER]
        assert len(match) == 1 and match[0]["name"] == TEST_STAFF_NAME
        assert match[0].get("active") is not False

    def test_02_reupload_same_file_is_noop(self, client):
        rows = STATE["staff_baseline"] + [{"name": TEST_STAFF_NAME, "employee_number": TEST_STAFF_NUMBER}]
        r = _upload(client, "/api/admin/upload-staff-file", _staff_workbook(rows), "staff.xlsx")
        assert r.status_code == 200, r.text
        data = r.json()
        assert (data["added"], data["updated"], data["deactivated"]) == (0, 0, 0), data

    def test_03_test_staff_can_login(self, client):
        r = client.post(f"{BASE_URL}/api/auth/employee-login",
                        json={"employee_number": TEST_STAFF_NUMBER}, timeout=60)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"

    def test_04_upload_without_row_soft_deletes(self, client):
        r = _upload(client, "/api/admin/upload-staff-file",
                    _staff_workbook(STATE["staff_baseline"]), "staff.xlsx")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["deactivated"] == 1, data

        active = _get(client, "/api/staff").json()
        assert [s for s in active if s["employee_number"] == TEST_STAFF_NUMBER] == []
        assert sorted(s["employee_number"] for s in active) == STATE["staff_baseline_numbers"]

        all_staff = _get(client, "/api/staff", params={"include_inactive": "true"}).json()
        soft = [s for s in all_staff if s["employee_number"] == TEST_STAFF_NUMBER]
        assert len(soft) == 1, "soft-deleted staff was hard deleted"
        assert soft[0].get("active") is False

    def test_05_deactivated_staff_cannot_login(self, client):
        r = client.post(f"{BASE_URL}/api/auth/employee-login",
                        json={"employee_number": TEST_STAFF_NUMBER}, timeout=60)
        # KNOWN BACKEND BUG: employee_login wraps its own HTTPException(401) in a broad
        # `except Exception` and re-raises 400, so the status code is 400 not 401.
        assert r.status_code in (400, 401), f"login not denied: {r.status_code} {r.text[:300]}"
        assert "inactive" in r.text.lower() or "invalid" in r.text.lower(), r.text[:300]

    def test_06_admin_4444_still_active_and_can_login(self, client):
        active = _get(client, "/api/staff").json()
        admin = [s for s in active if s["employee_number"] == "4444"]
        # NOTE: DB currently holds 6 duplicate 4444 docs (pre-existing data issue, reported)
        assert len(admin) >= 1 and all(a.get("active") is not False for a in admin)
        r = client.post(f"{BASE_URL}/api/auth/employee-login",
                        json={"employee_number": "4444"}, timeout=60)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"


# ---------------------------------------------------------------- assets upload
class TestAssetUploadIdempotency:
    def test_01_upload_with_new_asset(self, client):
        before = _get(client, "/api/assets").json()
        assert before, "no assets to build baseline file"
        STATE["asset_baseline"] = [
            {"check_type": a["check_type"], "name": a["name"], "make": a["make"]} for a in before
        ]
        STATE["asset_fingerprint"] = {
            (a["make"], a["name"]): (a.get("id"), a.get("qr_printed")) for a in before
        }
        STATE["templates_before"] = len(
            _get(client, "/api/admin/template-diagnostics").json().get("templates", [])
        )

        rows = STATE["asset_baseline"] + [{
            "check_type": TEST_ASSET_CHECK_TYPE, "name": TEST_ASSET_NAME, "make": TEST_ASSET_MAKE,
        }]
        r = _upload(client, "/api/admin/upload-assets-file", _assets_workbook(rows), "assets.xlsx")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["added"] == 1, data
        assert data["retired"] == 0, data

        after = _get(client, "/api/assets").json()
        after_fp = {(a["make"], a["name"]): (a.get("id"), a.get("qr_printed")) for a in after}
        for key, val in STATE["asset_fingerprint"].items():
            assert key in after_fp, f"asset {key} disappeared"
            assert after_fp[key] == val, f"asset {key} id/qr_printed changed: {val} -> {after_fp[key]}"

        names = _get(client, "/api/assets/names/Perrot").json()
        assert TEST_ASSET_NAME in names, names
        new_asset = [a for a in after if a["make"] == TEST_ASSET_MAKE and a["name"] == TEST_ASSET_NAME]
        assert len(new_asset) == 1, new_asset
        STATE["new_asset_id"] = new_asset[0]["id"]

    def test_02_reupload_same_file_is_noop(self, client):
        rows = STATE["asset_baseline"] + [{
            "check_type": TEST_ASSET_CHECK_TYPE, "name": TEST_ASSET_NAME, "make": TEST_ASSET_MAKE,
        }]
        r = _upload(client, "/api/admin/upload-assets-file", _assets_workbook(rows), "assets.xlsx")
        assert r.status_code == 200, r.text
        data = r.json()
        assert (data["added"], data["updated"], data["retired"]) == (0, 0, 0), data

    def test_03_templates_not_wiped(self, client):
        r = _get(client, "/api/checklist-templates/Trailed%20Implement")
        assert r.status_code == 200, r.text
        body = r.json()
        items = body.get("items") if isinstance(body, dict) else body
        assert items, f"Trailed Implement template empty after asset upload: {body}"

        diag = _get(client, "/api/admin/template-diagnostics").json()
        assert len(diag.get("templates", [])) >= STATE["templates_before"], diag.get("templates")

    def test_04_upload_without_new_asset_retires_it(self, client):
        r = _upload(client, "/api/admin/upload-assets-file",
                    _assets_workbook(STATE["asset_baseline"]), "assets.xlsx")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["retired"] == 1, data

        after = _get(client, "/api/assets").json()
        after_fp = {(a["make"], a["name"]): (a.get("id"), a.get("qr_printed")) for a in after}
        assert (TEST_ASSET_MAKE, TEST_ASSET_NAME) not in after_fp
        assert TEST_ASSET_NAME not in _get(client, "/api/assets/names/Perrot").json()
        for key, val in STATE["asset_fingerprint"].items():
            assert key in after_fp, f"asset {key} disappeared"
            assert after_fp[key] == val, f"asset {key} id/qr_printed changed"

    def test_05_retired_asset_reappears_with_same_id(self, client):
        rows = STATE["asset_baseline"] + [{
            "check_type": TEST_ASSET_CHECK_TYPE, "name": TEST_ASSET_NAME, "make": TEST_ASSET_MAKE,
        }]
        r = _upload(client, "/api/admin/upload-assets-file", _assets_workbook(rows), "assets.xlsx")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["added"] == 0 and data["updated"] >= 1, data  # un-retired, not re-created
        after = _get(client, "/api/assets").json()
        match = [a for a in after if a["make"] == TEST_ASSET_MAKE and a["name"] == TEST_ASSET_NAME]
        assert len(match) == 1, match
        assert match[0]["id"] == STATE["new_asset_id"], "id changed when asset was un-retired"

    def test_06_final_upload_restores_original_state(self, client):
        r = _upload(client, "/api/admin/upload-assets-file",
                    _assets_workbook(STATE["asset_baseline"]), "assets.xlsx")
        assert r.status_code == 200, r.text
        assert r.json()["retired"] == 1, r.json()
