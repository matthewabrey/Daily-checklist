# Machine Checklist & Work Management App — PRD

## Original Problem Statement
QR code-based machine checklist application with health, safety, and work management features.

## Core Features (Production)
1. **QR Code Machine Checks** — Scan QR to access checklists (Daily, Workshop Service, Fuel & Mileage)
2. **Breakdown/Repair Reporting** — Report and track equipment repairs
3. **Work Progress Tracking** — Track hectare-based work progress jobs
4. **Staff Management** — Upload staff list via Excel, login by employee number
5. **Asset Management** — Upload asset list with check types and templates
6. **Manager Dashboard** — View checks, repairs, acknowledge issues
7. **Admin Panel** — Staff upload, asset upload, QR label printing, SharePoint sync

## Hidden Features (HIDDEN FOR DEPLOYMENT)
- Near Misses, Suggestions, Accidents, Whistleblowing, Training — commented out in `App.js`

## Daily Workplan Feature
- **Manager Editor** at `/workplan` (admin/manager only): 7-day grid with AM/PM cells per day
- Excel-like editing: click select, multi-select, copy/paste, drag-fill handle
- **Drag & Drop Row Reordering**: Drag rows to group people by manager
- **Multi-User Presence Warning**: Shows who else is editing the workplan
- 90 job types from original Excel (includes Wet Day Jobs)
- 7 colour categories (Onions, Carrots, Potatoes, Larkshall, Snetterton, Off/Holiday, Servicing)
- **Excel Import**: `/api/admin/workplan/import-staff` imports 259 staff from original Excel
- **Leavers**: People below JCBs marked as `left:true`, hidden by default, toggle to show
- **Costing**: % breakdown by job and area/crop, separate active vs leaver data
- **Publish to Home** pushes snapshot to dashboard
- **Fast datalist**: Filtered to max 30 options for performance

## Dashboard Features
- **Auto-Rotating Carousel**: Stats, Work Plan, and Work Progress rotate every 20s with play/pause
- **Cropping Map Link**: "Map" button in navigation header opens external cropping sheet (users click Map tab)

## SharePoint Auto-Sync
- Daily 9 AM sync via Microsoft Graph API (Client Credentials flow)
- Template matching bug FIXED
- Compulsory field support added

## Data Model
- `workplan`: {key:'current', week_start, draft_rows, published_rows, published_week_start, published_at}
- `workplan_jobs`: {id, name, order} — 90 jobs
- `workplan_colors`: {id, name, color, order} — 7 categories

## Completed Work (Dec 2025)
- [x] QR Code Machine Checks, Repairs, Work Progress, Staff/Asset Management
- [x] SharePoint Auto-Sync (Staff + Assets) + template matching fix
- [x] Daily Workplan Feature (editor, board, publish)
- [x] Workplan Excel import (259 staff, daily assignments, fuzzy job matching)
- [x] Leavers management (mark left, show/hide toggle, dimmed display)
- [x] Costing section (% by job, % by area/crop, active vs leavers)
- [x] Performance fix (datalist filtered to 30 max)
- [x] Template Diagnostics Panel
- [x] Dashboard Carousel (auto-rotate 20s, play/pause)
- [x] Rolling day window (Yesterday + Today + 5 future days)
- [x] Split table layout with synced scrolling (fixed left columns)
- [x] Auto-expanding notes textarea with synced row heights
- [x] Day-to-day copying (click header to copy entire day)
- [x] **Cropping Map Button** — Opens external FieldPlan.html?view=map
- [x] **Cell Editing Bug Fix** — Fixed row index mismatch when displayRows differs from rows
- [x] **Drag & Drop Row Reordering** — Reorder staff rows by dragging
- [x] **Multi-User Presence Tracking** — Warning when others are editing
- [x] **XSS Security Fix** — HTML-escaped QR print output and workplan print
- [x] **Print Workplan** — Print button generates print-ready landscape workplan
- [x] **Mobile Workplan View** — Personal schedule + teammates display for employees
- [x] **Column Auto-fit** — Wider columns for Manager names, text wrapping in cells

## Code Quality Fixes (Applied)
- [x] Removed 92 console.log statements from frontend (kept console.error for error tracking)
- [x] Added safety comments to document.write usage (content is HTML-escaped)

## Refactor + Self-Hosted Field Map (June 2026)
- [x] MAJOR REFACTOR: App.js reduced 11,444 → 6,442 lines. Extracted:
  - `src/pages/Dashboard.js`, `src/pages/NewChecklist.js`, `src/pages/RepairsNeeded.js`
  - `src/components/QRScanner.js`, `src/components/FieldMapBoard.js`
  - `src/context/AuthContext.js` (AuthProvider/useAuth — WorkplanEditor/WorkplanBoard imports updated)
  - `src/lib/api.js` (API_BASE_URL)
- [x] Self-hosted cropping map: backend downloads FieldPlan.html from matthewabrey.github.io daily (5AM UK cron + startup if missing), injects CSS to permanently hide the "changes pending review" banner + `?estate=` param support (`backend/fieldplan_sync.py`). NOTE: injection must go before the LAST `</body>` (page JS contains `</body>` in strings).
- [x] Endpoints: GET `/api/fieldplan` (serves map), POST `/api/fieldplan/refresh` (manual re-download)
- [x] Header "Map" button now opens our self-hosted copy (`/api/fieldplan?view=map`) — banner-free
- [x] Dashboard: new 4th rotating section "Field Maps" with 8 estate tabs (Wretham, Beard, Rackham Farms, Pickenham, Gooderham, Euston, Chandler, Blakeney); estate switches inside iframe without reload; auto-cycles estates every 15s while rotation active
- Verified by testing agent: 100% backend + frontend incl. full regression (/app/test_reports/iteration_9.json)

## Dashboard Refresh/Rotation Stability Fix (June 2026)
- [x] Section auto-rotation slowed 20s → 60s; rotation tick skipped while user is scrolled down (>150px) so screen never jumps mid-reading
- [x] Background data refresh 10s → 30s and made silent (Loading pill only on initial load)
- [x] Updated labels: "Auto-rotating every 60s", "Auto-updates every 30sec"
- Verified by testing agent on desktop + mobile: 0px scroll drift across refresh (/app/test_reports/iteration_8.json)

## Workplan Editor Stability Fix (June 2026)
- [x] Removed live "user rows first" auto-sort that re-sorted rows on every keystroke (caused jumping while typing)
- [x] Manual "Sort by Manager" only: toolbar button + new sort icon in Mgr column header (data-testid="sort-manager-header-btn")
- [x] Row-height sync now scroll-preserving and only runs on row count/visibility changes, not every keystroke
- [x] Deduped staff datalist options (fixed duplicate React key warnings from 4x 'ADMIN' staff names)
- [x] Normalized legacy '6:30 Am' start times to 'HH:mm' for <input type="time">
- Verified by testing agent: 8/8 frontend tests passed (/app/test_reports/iteration_7.json)

## Pending / Backlog
- [ ] P1: Continue App.js modularization (~6,442 lines remain: Records, AllChecksCompleted, Training, Accidents, etc.)
- [ ] P1: Fix React Hook dependencies (remaining missing deps across files)
- [ ] P1: Refactor `upload_assets_file()` (175 lines, complexity 63) and `upload_staff_file()` (124 lines)
- [ ] P1: Replace array index keys with unique IDs (remaining instances)
- [ ] P1: Restore hidden features when ready
- [ ] P2: Trace background HTTP 422 seen in console (non-blocking)
- [ ] P2: Date range filter for "All Checks Overview"
- [ ] P2: Add type hints to Python files (currently 32.9% coverage)
- [ ] P2: Mobile-friendliness improvements

## Credentials
- Admin: Employee Number `4444`
- Manager: Employee Number `191` (ChristopherMarsh)
- Regular: `1447` (Abbie Nixon), `1234` (Matthew Abrey)
