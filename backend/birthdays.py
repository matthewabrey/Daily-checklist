"""Birthdays, off the Name List's Date of Birth column.

Two deliberate decisions live in here:

1. **The year is thrown away.** Only the day and month are ever stored, as
   "MM-DD". The app therefore cannot work out anybody's age, now or later,
   however it is asked. A birthday greeting needs the day; it does not need
   the year, and 103 people's dates of birth sitting in a database is a
   liability nobody asked for.
2. **Nothing is ever guessed.** A date that can't be read is skipped and
   reported, not interpreted. Twenty-two people on the sheet have no date at
   all, and they simply never trigger anything.

Shared by both routes into the staff list — the hourly SharePoint sync and the
Upload Staff List button — so the two can't drift apart.
"""

import re
from datetime import date, datetime

# Name List spells names run together: "AdamJudd", "Adelin-GabrielIovu".
# These prefixes must stay joined to what follows them.
_STUCK = {"mc", "mac", "o", "d", "de", "del", "della", "du", "da", "di",
          "la", "le", "van", "von", "der", "den", "st", "fitz"}


def pretty_name(s):
    """'AdamJudd' -> 'Adam Judd', 'ConorMcShane' -> 'Conor McShane'.

    Splits where a lower-case letter meets a capital, then puts back together
    anything that was only ever a prefix. A name already written with spaces
    is left exactly as it is.
    """
    s = str(s or "").strip()
    if not s or " " in s:
        return s
    if not re.search(r"[a-z]", s):
        return s          # ALL CAPS — nothing to split on, leave it alone
    parts = re.findall(r"[A-Z][^A-Z]*|[^A-Z]+", s)
    parts = [p for p in parts if p]
    out = []
    for p in parts:
        # 'Mc' + 'Shane', and never break a hyphenated name:
        # 'Adelin-' + 'Gabriel' must stay 'Adelin-Gabriel'
        if out and (re.sub(r"[^a-z]", "", out[-1].lower()) in _STUCK
                    or out[-1].endswith(("-", "'"))):
            out[-1] = out[-1] + p
        else:
            out.append(p)
    return " ".join(out).strip() or s


def first_name(s):
    return pretty_name(s).split(" ")[0]


def from_cell(v, this_year=None):
    """A Date of Birth cell -> 'MM-DD', or None if it can't be read.

    Takes a real Excel date or text in d.m.yy / d/m/yyyy / d-m-yy form. The
    year is only used to check the date exists at all (29 Feb 1996 is real,
    31 Feb is not) and is then discarded.
    """
    if v is None:
        return None
    if isinstance(v, (datetime, date)):
        d = v.date() if isinstance(v, datetime) else v
        return f"{d.month:02d}-{d.day:02d}"
    s = str(v).strip()
    if not s:
        return None
    m = re.match(r"^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2}|\d{4})$", s)
    if not m:
        return None
    dd, mm, yy = int(m.group(1)), int(m.group(2)), m.group(3)
    # Two-digit years: anything up to this year is 20xx, the rest 19xx. Only
    # used to validate the date; it is not kept.
    year = int(yy) if len(yy) == 4 else (
        2000 + int(yy) if int(yy) <= (this_year or date.today().year) % 100 else 1900 + int(yy))
    try:
        date(year, mm, dd)
    except ValueError:
        return None
    return f"{mm:02d}-{dd:02d}"


def find_dob_column(headers):
    """Which column is the date of birth, by its heading. None if absent —
    the column is optional and its absence must not break the staff sync."""
    for i, h in enumerate(headers):
        k = re.sub(r"[^a-z]", "", str(h or "").lower())
        if k in ("dateofbirth", "dob", "birthday", "birthdate", "dateofbirthday"):
            return i
    return None


def keys_for(today):
    """The 'MM-DD' keys that count as today.

    29 February is celebrated on the 28th in a normal year, so nobody born on
    a leap day gets skipped three years in four.
    """
    keys = [f"{today.month:02d}-{today.day:02d}"]
    if (today.month, today.day) == (2, 28):
        try:
            date(today.year, 2, 29)
        except ValueError:
            keys.append("02-29")
    return keys


def whose_birthday(staff, today):
    """[{employee_number, name, first_name}] for everyone whose birthday is
    today. Only active people, and only those with a birthday stored."""
    keys = set(keys_for(today))
    out = []
    for s in staff or []:
        if s.get("active") is False:
            continue
        b = (s.get("birthday") or "").strip()
        if b and b in keys:
            nm = pretty_name(s.get("name"))
            out.append({"employee_number": str(s.get("employee_number") or "").strip(),
                        "name": nm, "first_name": nm.split(" ")[0]})
    # Same name twice on the sheet (there are two Nick Snellings) shouldn't
    # read as two birthdays.
    seen, unique = set(), []
    for p in out:
        if p["name"].lower() in seen:
            continue
        seen.add(p["name"].lower())
        unique.append(p)
    unique.sort(key=lambda p: p["name"])
    return unique


def name_list(names):
    """'Adam Judd', 'Adam Judd and Mark Belton', 'A, B and C'."""
    names = [n for n in names if n]
    if not names:
        return ""
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f"{names[0]} and {names[1]}"
    return ", ".join(names[:-1]) + f" and {names[-1]}"


def banner_text(names):
    """What rolls along the ticker. No age, no date — just the name."""
    if not names:
        return None
    return f"🎉 Happy Birthday {name_list(names)} — from everyone at Abreys"


def sharing_line(others):
    """The line on someone's own page when they share the day."""
    if not others:
        return None
    who = "both of you" if len(others) == 1 else f"all {len(others) + 1} of you"
    return (f"You're sharing today with {name_list(others)} — "
            f"happy birthday to {who}.")


async def save(db, pairs):
    """Write the day-and-month against each person.

    `pairs` is [(employee_number, 'MM-DD' or None)]. Done as its own pass
    rather than through upsert_staff, so it works whichever route the staff
    list came in by. A date removed from the sheet is removed here too.
    """
    set_n = clear_n = 0
    for number, key in pairs:
        number = str(number or "").strip()
        if not number:
            continue
        if key:
            r = await db.staff.update_one({"employee_number": number},
                                          {"$set": {"birthday": key}})
            set_n += 1 if r.matched_count else 0
        else:
            r = await db.staff.update_one({"employee_number": number},
                                          {"$unset": {"birthday": ""}})
            clear_n += 1 if r.modified_count else 0
    return {"birthdays_stored": set_n, "birthdays_cleared": clear_n}
