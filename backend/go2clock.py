"""Go2Clock weekly timesheet import.

The export is NOT a flat table — it's one block per employee, seventeen-odd
rows each, with the headings repeated every time. So it's parsed by walking
the rows and watching for the markers that start and end a block.

The matching problem, found on the 21–27 Sep file and worth remembering:
twelve people are in Go2Clock under a DIFFERENT number from the one the app
holds (Edis Daud is 1240 here and 1350 there — returning seasonal staff given
a fresh clock number). Joining on number alone lost 988 hours in one week, and
those people would have shown up as "not booking their jobs" through no fault
of their own. So it matches on number first, then falls back to the name.
"""

import csv
import io
import logging
import re

logger = logging.getLogger(__name__)

DAY_RE = re.compile(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{2})/(\d{2})/(\d{4})\s*$", re.I)


def _cell(row, i):
    return row[i].strip() if row and i < len(row) and row[i] is not None else ""


def _num(v):
    try:
        return float(str(v).strip())
    except (TypeError, ValueError):
        return None


def _labelled(row, label):
    """Value in the cell after a given label, wherever it sits on the row."""
    for i, v in enumerate(row):
        if (v or "").strip().rstrip(":").lower() == label.lower().rstrip(":"):
            return _cell(row, i + 1)
    return ""


def parse_timesheet(content: bytes):
    """-> (people, week_start, week_end). One entry per employee block."""
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    rows = list(csv.reader(io.StringIO(text)))
    people, cur = [], None
    all_dates = []

    for r in rows:
        if not r:
            continue
        c0 = _cell(r, 0)

        if c0.lower().startswith("employee id:"):
            cur = {
                "clock_id": _cell(r, 1),
                "name": _labelled(r, "Name"),
                "payroll_no": "",
                "dept": "",
                "days": [],
                "total_hours": None,
                "contract_hours": None,
                "overtime": {},
                "absence": {},
                "approved": False,
            }
            people.append(cur)
            continue

        if cur is None:
            continue

        if c0.lower().startswith("payroll no:"):
            cur["payroll_no"] = _cell(r, 1)
            cur["dept"] = _labelled(r, "Dept")
            continue

        m = DAY_RE.match(c0)
        if m:
            iso = f"{m.group(4)}-{m.group(3)}-{m.group(2)}"
            all_dates.append(iso)
            ins = [_cell(r, i) for i in (1, 3, 5, 7)]
            outs = [_cell(r, i) for i in (2, 4, 6, 8)]
            cur["days"].append({
                "date": iso,
                "dow": m.group(1).title(),
                "pairs": [{"in": a, "out": b} for a, b in zip(ins, outs) if a or b],
                "hours": _num(_cell(r, 9)) or 0.0,
                "schedule": _cell(r, 10),
                "tardy": _cell(r, 11),
            })
            continue

        if any((v or "").strip() == "Total:" for v in r):
            cur["total_hours"] = _num(_labelled(r, "Total"))
            for v in r:
                mm = re.search(r"Expected Contract:\s*([\d.]+)", v or "")
                if mm:
                    cur["contract_hours"] = float(mm.group(1))
            continue

        if c0.lower().startswith("break:"):
            for i in range(0, len(r) - 1, 2):
                k = _cell(r, i).rstrip(":")
                if k:
                    cur["absence"][k] = _cell(r, i + 1)
            continue

        if c0.lower().startswith("contract hours:"):
            for i in range(0, len(r) - 1, 2):
                k = _cell(r, i).rstrip(":")
                if k.upper().startswith("OT"):
                    cur["overtime"][k] = _cell(r, i + 1)
            continue

        if "payroll approved" in c0.lower():
            cur["approved"] = True

    # only keep blocks that are actually a person
    people = [p for p in people if p.get("payroll_no") or p.get("name")]
    week_start = min(all_dates) if all_dates else None
    week_end = max(all_dates) if all_dates else None
    return people, week_start, week_end


# --- matching a Go2Clock person to a member of staff ------------------------

def clean_name(s):
    """Go2Clock decorates names: 'Cristinel-Valentin Susma **',
    'Jack Beard (Beard)'. The app has 'CristinelSusma'. Strip the
    decoration and the punctuation and compare what's left."""
    s = s or ""
    s = re.sub(r"\*+", "", s)            # the ** marker
    s = re.sub(r"\([^)]*\)", "", s)      # (Beard), (Magee), (Garrod)
    return re.sub(r"[^a-z]", "", s.lower())


def build_staff_index(staff):
    """staff: [{employee_number, name}] -> lookups by number and by name."""
    by_num, by_name = {}, {}
    for s in staff:
        num = str(s.get("employee_number") or "").strip()
        nm = s.get("name") or ""
        if num:
            by_num[num] = {"employee_number": num, "name": nm}
        key = clean_name(nm)
        if key:
            by_name.setdefault(key, []).append({"employee_number": num, "name": nm})
    return {"num": by_num, "name": by_name}


def match_person(payroll_no, name, index):
    """Number first, then name. Never guesses between two people of the
    same name — that gets reported instead."""
    num = str(payroll_no or "").strip()
    if num and num in index["num"]:
        hit = index["num"][num]
        return {"employee_number": hit["employee_number"], "staff_name": hit["name"],
                "matched_by": "payroll number", "confidence": "high"}

    hits = index["name"].get(clean_name(name)) or []
    if len(hits) == 1:
        return {"employee_number": hits[0]["employee_number"], "staff_name": hits[0]["name"],
                "matched_by": "name", "confidence": "medium",
                "note": f"Go2Clock has them as {num or 'no number'}, "
                        f"the app as {hits[0]['employee_number']}"}
    if len(hits) > 1:
        return {"employee_number": None, "staff_name": None,
                "matched_by": "name", "confidence": "ambiguous",
                "note": f"{len(hits)} people in the app share that name"}
    return {"employee_number": None, "staff_name": None,
            "matched_by": None, "confidence": "none",
            "note": "Not on the Name List"}
