"""Tests for photo stripping in list endpoints and full detail endpoint."""
import os
import time
import requests
import pytest
from pathlib import Path

def _load_frontend_env():
    envp = Path('/app/frontend/.env')
    if envp.exists():
        for line in envp.read_text().splitlines():
            if line.startswith('REACT_APP_BACKEND_URL='):
                return line.split('=', 1)[1].strip()
    return None

BASE_URL = (os.environ.get('REACT_APP_BACKEND_URL') or _load_frontend_env()).rstrip('/')
API = f"{BASE_URL}/api"

BIG_RECORD_ID = "82bef03c-47fa-451a-a02b-d7e89cf89c8f"
BIG_MAKE = "AD Plant Enviromental Record"


def _assert_no_photo_data(records):
    for rec in records:
        for it in (rec.get("checklist_items") or []):
            for p in (it.get("photos") or []):
                assert "id" in p, f"photo missing id in checklist {rec.get('id')}"
                assert "data" not in p, f"photo has data in list resp for {rec.get('id')}"
        for p in (rec.get("workshop_photos") or []):
            assert "data" not in p, f"workshop_photo has data in list resp for {rec.get('id')}"


def _time_get(url, **kwargs):
    t0 = time.time()
    r = requests.get(url, timeout=60, **kwargs)
    return r, time.time() - t0, len(r.content)


def test_list_checklists_stripped_and_small():
    r, dt, size = _time_get(f"{API}/checklists?limit=100")
    assert r.status_code == 200, r.text[:300]
    assert size < 1_000_000, f"payload {size} bytes >= 1MB"
    assert dt < 5, f"took {dt:.1f}s"
    data = r.json()
    _assert_no_photo_data(data if isinstance(data, list) else data.get("items", []))


def test_list_today():
    r, dt, size = _time_get(f"{API}/checklists/today")
    assert r.status_code == 200
    assert size < 1_000_000
    assert dt < 5
    data = r.json()
    _assert_no_photo_data(data if isinstance(data, list) else data.get("items", []))


def test_list_with_repairs():
    r, dt, size = _time_get(f"{API}/checklists-with-repairs?limit=50")
    assert r.status_code == 200
    assert size < 1_000_000
    data = r.json()
    _assert_no_photo_data(data if isinstance(data, list) else data.get("items", []))


def test_list_by_machine_ad_plant():
    r, dt, size = _time_get(
        f"{API}/checklists/by-machine",
        params={"make": BIG_MAKE, "limit": 50},
    )
    assert r.status_code == 200, r.text[:300]
    assert size < 1_000_000, f"payload {size} bytes"
    data = r.json()
    _assert_no_photo_data(data if isinstance(data, list) else data.get("items", []))


def test_detail_big_record_has_photos():
    r, dt, size = _time_get(f"{API}/checklists/{BIG_RECORD_ID}")
    assert r.status_code == 200, r.text[:300]
    rec = r.json()
    found_data = False
    for it in (rec.get("checklist_items") or []):
        for p in (it.get("photos") or []):
            if isinstance(p.get("data"), str) and p["data"].startswith("data:image"):
                found_data = True
                break
        if found_data:
            break
    if not found_data:
        for p in (rec.get("workshop_photos") or []):
            if isinstance(p.get("data"), str) and p["data"].startswith("data:image"):
                found_data = True
                break
    assert found_data, "detail endpoint did not return any photo data"


def test_export_excel_by_machine_perrot():
    r = requests.get(f"{API}/checklists/export/excel-by-machine",
                     params={"make": "Perrot"}, timeout=30)
    assert r.status_code == 200
    cd = r.headers.get("Content-Disposition", "")
    assert "Perrot" in cd and ".xlsx" in cd and "detailed_checks" in cd, cd


def test_export_excel_by_machine_servicing_perrot():
    r = requests.get(f"{API}/checklists/export/excel-by-machine",
                     params={"category": "servicing", "make": "Perrot"}, timeout=30)
    assert r.status_code == 200


def test_export_excel_by_machine_no_filters():
    t0 = time.time()
    r = requests.get(f"{API}/checklists/export/excel-by-machine", timeout=30)
    assert r.status_code == 200
    assert time.time() - t0 < 20


def test_export_csv_checks_columns():
    r = requests.get(f"{API}/checklists/export/csv",
                     params={"category": "checks"}, timeout=30)
    assert r.status_code == 200
    first_line = r.text.splitlines()[0]
    cols = first_line.split(",")
    assert len(cols) == 14, f"expected 14 cols got {len(cols)}: {first_line}"
