"""John Deere telematics ingestion.

Power Automate drops each morning's "App Report - Utilization" email into
SharePoint as an .html file. The email carries a DOWNLOAD LINK, not an
attachment — so this module pulls the link out, fetches the CSV and turns it
into one record per machine per day.

Two things learned the hard way and worth keeping in mind:

* The file is named for the day AFTER the data. An email on the 27th carries
  the 26th's work, so records are filed by **Report Start Date**, never by the
  filename or the day it arrived.
* Machines are keyed on **Machine Serial Number**, never the nickname. The
  nickname has the driver's name in it ("AFM 26 Kieren") and changes whenever
  someone swaps tractor, which broke 12 of 29 matches when tested.
"""

import csv
import io
import logging
import re
from datetime import datetime, timezone
from html import unescape
from urllib.parse import unquote, urlparse, parse_qs

import requests

logger = logging.getLogger(__name__)

TELEMATICS_FOLDER = "General/Apps/Checklist App/Telematics Inbox"

# "Sep 26, 2026"
_DATE_FMT = "%b %d, %Y"


def extract_csv_url(html: str):
    """Find the CSV download link in the saved email.

    Prefers a link whose text is literally "CSV" — that's how John Deere
    writes it. Falls back to any link that looks like a report download.
    Outlook Safe Links wrapping is unwound, otherwise we'd fetch a Microsoft
    redirector page instead of the file.
    """
    if not html:
        return None

    candidates = []
    for m in re.finditer(r'<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',
                         html, re.I | re.S):
        href = unescape(m.group(1)).strip()
        text = re.sub(r"<[^>]+>", "", m.group(2)).strip().lower()
        candidates.append((href, text))

    def unwrap(url: str) -> str:
        try:
            parsed = urlparse(url)
            if "safelinks.protection.outlook.com" in (parsed.netloc or "").lower():
                inner = parse_qs(parsed.query).get("url", [None])[0]
                if inner:
                    return unquote(inner)
        except Exception:
            pass
        return url

    # 1. the anchor that literally says CSV
    for href, text in candidates:
        if text == "csv":
            return unwrap(href)
    # 2. anything pointing at a .csv
    for href, text in candidates:
        if ".csv" in href.lower():
            return unwrap(href)
    # 3. a download-looking link that isn't one of the footer links
    SKIP = ("unsubscribe", "legal", "privacy", "notifications center",
            "machine reports", "view in")
    for href, text in candidates:
        if any(s in text for s in SKIP):
            continue
        if "download" in href.lower() or "report" in href.lower():
            return unwrap(href)
    return None


def fetch_csv(url: str, timeout: int = 60) -> str:
    """Download the CSV. The link is self-authenticating and expires after
    7 days — confirmed by opening it in a signed-out browser."""
    res = requests.get(url, timeout=timeout, allow_redirects=True)
    res.raise_for_status()
    text = res.text
    # A sign-in page would come back as HTML, not a CSV. Say so plainly
    # rather than storing nonsense.
    head = text.lstrip()[:400].lower()
    if head.startswith("<!doctype html") or head.startswith("<html"):
        raise ValueError(
            "That link returned a web page rather than a CSV — it has probably "
            "expired (they last 7 days) or now wants a sign-in."
        )
    return text


def _num(v):
    """A number, or None. '---' means the machine never moved that day —
    which is not the same as zero and must not be stored as zero."""
    if v is None:
        return None
    s = str(v).strip().strip('"')
    if s in ("", "---", "-"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _date(v):
    """'Sep 26, 2026' -> '2026-09-26'."""
    s = (v or "").strip().strip('"')
    if not s:
        return None
    try:
        return datetime.strptime(s, _DATE_FMT).date().isoformat()
    except ValueError:
        pass
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%m/%d/%Y", "%d %b %Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def parse_utilization_csv(text: str):
    """One record per machine per day out of the Utilization export.

    Returns (rows, report_date). Machines that never moved are skipped —
    they'd otherwise look like a full day of zero work.
    """
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    report_date = None
    skipped_idle = 0

    for r in reader:
        serial = (r.get("Machine Serial Number") or "").strip()
        nickname = (r.get("Nickname") or "").strip()
        if not serial and not nickname:
            continue

        start = _date(r.get("Report Start Date"))
        if start and not report_date:
            report_date = start

        idle_h = _num(r.get("Idle (h)"))
        work_h = _num(r.get("Working (h)"))
        trans_h = _num(r.get("Transport (h)"))
        total_h = _num(r.get("Total Hours"))
        idle_l = _num(r.get("Idle (l)"))
        work_l = _num(r.get("Working (l)"))
        trans_l = _num(r.get("Transport (l)"))
        total_l = _num(r.get("Total Fuel (l)"))

        if total_h is None and (idle_h or work_h or trans_h):
            total_h = round((idle_h or 0) + (work_h or 0) + (trans_h or 0), 2)
        if total_l is None and (idle_l or work_l or trans_l):
            total_l = round((idle_l or 0) + (work_l or 0) + (trans_l or 0), 2)

        if not total_h and not total_l:
            skipped_idle += 1
            continue  # stood still all day

        rows.append({
            "serial": serial,
            "nickname": nickname,
            "make": (r.get("Make") or "").strip(),
            "type": (r.get("Type") or "").strip(),
            "model": (r.get("Model") or "").strip(),
            "date": start,
            "idle_h": idle_h, "working_h": work_h, "transport_h": trans_h,
            "total_h": total_h,
            "idle_l": idle_l, "working_l": work_l, "transport_l": trans_l,
            "total_l": total_l,
            "l_per_h": round(total_l / total_h, 2) if (total_l and total_h) else None,
            "idle_pct": round((idle_h or 0) / total_h * 100) if total_h else None,
            "working_pct": round((work_h or 0) / total_h * 100) if total_h else None,
            "lat": _num(r.get("Last Known Latitude")),
            "lon": _num(r.get("Last Known Longitude")),
        })

    return rows, report_date, skipped_idle
