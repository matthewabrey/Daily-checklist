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

## Pre Service Check — Perrot (June 2026)
- [x] New check type `pre_service_check` (end-of-season service sheet), currently ONLY for make "Perrot" (47 irrigators)
- [x] Backend: `service_check_templates` collection seeded idempotently on startup with Perrot template (7 sections: Gun Carriage General, Gun Carriage Wheels and Axles, Gun, Hydraulic Rams, Drum, Guards, Computer/Computer Box). Endpoints: GET `/api/service-check-templates`, GET `/api/service-check-templates/by-make/{make}` (case-insensitive, 404 if none). `Checklist`/`ChecklistResponse` gained `parts_required: List[str]`; by-machine projection + dashboard stats updated
- [x] Frontend: `/new-checklist` shows a 4th purple "Pre Service Check" button (data-testid `pre-service-check-btn`) only when the selected make has a template. Form = `src/components/PreServiceCheckForm.js`: each section OK / Needs Work / N/A + notes + photos; "Needs Work" reuses the Fault Explanation modal (notes required); "Any other Parts or Issues" card = notes + photos + "Parts required" list. Payload reuses `checklist_items`, `workshop_notes`, `workshop_photos` + new `parts_required`
- [x] Records / All Checks / Dashboard detail modals show "Pre Service Check" label, purple ClipboardCheck icon, "Any other Parts or Issues" notes and "Parts Required" list. "Needs Work" items flow into Repairs Needed like any unsatisfactory item
- [x] React hooks P0 closed: `WorkplanEditor.js` (normalizeRow/normalizeTime → module scope, drag-fill pointerup via `fillTileRef`), `App.js` filterChecklists/filterRepairs → useCallback, mount-only fetches documented with justified disables, `NewChecklist.js` loadChecklistTemplate → module scope. `frontend/.eslintrc.json` now enables `react-hooks` rules in the CRA build — whole `src/` lints clean
- [x] Lint fixes: duplicate `startup_event` renamed `startup_data_init`, bare `except` → `except ValueError`
- Verified by testing agent: backend 11/11, frontend 100% incl. Workplan Editor regression (/app/test_reports/iteration_10.json)
- NEXT (user's stated plan): make templates configurable — "which checks from where" (admin editor to assign service sheets to other makes / check types, add sub-items per section)

## Checks / Servicing tabs on All Checks (June 2026)
- [x] `/all-checks` now has a Checks | Servicing tab toggle (default Checks; deep link `?view=servicing`). Servicing = `pre_service_check` + `workshop_service`; Checks = everything else (GENERAL REPAIR still hidden client-side)
- [x] Title/subtitle, filter card, empty state, Load More label and detail modal header ("Servicing Record") follow the tab; servicing rows show orange Settings (workshop) / purple ClipboardCheck (pre-service) icons, notes snippet or "✓x ✗y of 7 sections · N parts required" summary
- [x] Backend `category` param (`checks` | `servicing` | omitted=all) on GET `/api/checklists`, `/api/checklists/today`, `/api/checklists/export/csv`, `/api/checklists/export/excel` (`category_filter()` in server.py). Exports share `export_row()`; new 13th column **Parts Required**; counts now computed for any record with items (incl. pre-service); filenames `all_servicing.*` vs `all_checks.*`, sheet title "All Servicing"/"All Checks"
- [x] Records list badge/label now uses shared `CHECK_TYPE_LABELS` (fuel & mileage no longer shown as "Workshop Service")
- Verified by testing agent: backend 15/15, frontend all functional flows pass (/app/test_reports/iteration_11.json); the one layout defect (date wrapping on long notes) fixed and self-verified

## Service Manager Excel Report + notes export fix (June 2026)
- [x] BUG: item notes were only exported for daily_check/grader_startup → Pre Service Check notes missing from Excel. Now `export_row()` exports notes for every type as "Section: note" (no truncation), plus new column **Needs Work / Repairs** (14 columns). By-machine export also writes full "Item: note"
- [x] Servicing Excel (`/api/checklists/export/excel?category=servicing`) is now a 3-sheet workbook (`backend/servicing_export.py`): **Action List** (one row per Repair / Order Part / Other Issue / Workshop Service, colour-coded, filterable, "Done?" column), **Parts to Order**, **Service Sheets** (one column per section: OK / NEEDS WORK - note / N/A, red fill on NEEDS WORK)
- [x] Servicing tab shows a hint banner describing the report (data-testid servicing-export-hint); detail modals now match `n/a` status (grey) correctly
- Verified by testing agent: 40/40 backend tests, frontend 100% (/app/test_reports/iteration_12.json)
- NOTE: the user may have seen the bug on the PRODUCTION deployment — remind them to redeploy to get these fixes live

## All Checks filters + filtered exports (June 2026)
- [x] `/all-checks`: new **Check Type** dropdown (static options per tab) beside Make / Model; makes from `/api/assets/makes`, models from `/api/assets/names/{make}` so any machine can be filtered
- [x] List is server-filtered (`GET /api/checklists` now accepts `make`, `model` + existing `check_type`, `category`); Load More pages through filtered results; header shows true total via new `GET /api/checklists/count?<same filters>`; "Showing X of N — exports include all of them"
- [x] Excel / CSV (Fast) / Direct Link export exactly the filtered set: `/export/csv` + `/export/excel` accept `category, check_type, make, model, today`; filenames encode filters (`all_checks_daily_check_JCB_<date>.csv`, `all_servicing_Perrot.xlsx`). Shared `build_checklist_query()` + `export_filename()` in server.py
- [x] `category=checks` now excludes GENERAL REPAIR server-side (was dropped client-side, which broke paging); `clear-filters-btn`, `export-filter-note`, `load-more-btn` test ids added
- Verified by testing agent: backend 53/53, frontend all flows (/app/test_reports/iteration_13.json); the Load More paging bug it found was fixed and self-verified (100 → 200 of 201 JCB rows)

## Deployment readiness pass (June 2026)
- [x] Deployment agent: PASS. Blockers fixed: (a) destructive `delete_many + insert_many` replace pattern in SharePoint daily sync + admin uploads replaced by idempotent `backend/sync_utils.py` (upsert_staff → soft-delete `active=False`; upsert_assets → `retired=True`, keeps ids + QR status; upsert_checklist_templates → replace_one per check type); (b) `.gitignore` no longer ignores `.env` files
- [x] Read endpoints hide soft-deleted records: `GET /api/staff` active only (`?include_inactive=true` for all); `/api/assets*` exclude `retired`. Removed dead destructive endpoints `/api/admin/update-staff`, `/api/admin/update-assets`, `cleanup_duplicate_staff()`
- [x] New admin maintenance endpoint `POST /api/admin/dedupe-records` (manual only) — ran on preview: removed 5 duplicate staff (4444 was x6) and 25 duplicate assets. **Run it once on production after deploying**
- [x] Login/validate/upload endpoints now re-raise HTTPException (401 for inactive employee instead of 400)
- Verified: testing agent iteration_14 (17 idempotency tests + regressions, frontend smoke) + `tests/test_sync_utils.py`; leftover TEST_ data purged

## AssetList-driven Pre Service Sheets + Generic Pre Service Check (June 2026)
- [x] Pre Service Check sheets are now assigned per CHECK TYPE from AssetList.xlsx tabs (user's design): `<Check Type> - Daily Check` = daily list, `<Check Type> - Pre Service Sheet` (also "Service Sheet"/"Pre Service Check") = service sections, plain `<Check Type>` tab = daily list (legacy). Matching is case/punctuation/plural-insensitive (`Irrigators` → `Irrigator`); partial matches never overwrite an exact one (`Tractor Hire` no longer clobbers `Tractor`). Header row optional (service tab is `number | section`)
- [x] Shared parser `backend/asset_excel.py` (`parse_asset_workbook`) used by BOTH admin `POST /api/admin/upload-assets-file` and the SharePoint daily sync (`sharepoint_auto_sync._parse_assets_excel`). Hard-coded Perrot seed + `PERROT_SERVICE_SECTIONS` removed; `sync_utils.upsert_service_check_templates` upserts by check_type and drops sheets no longer in the workbook (incl. legacy make-only ones)
- [x] `ServiceCheckTemplate` now `{check_type, make(legacy), name, sections, sheet_name, updated_at}`. `GET /api/service-check-templates/by-make/{make}` REMOVED → `GET /api/service-check-templates/for-asset?check_type=&make=` (check_type first, legacy make fallback, 404 otherwise). Template diagnostics return `service_templates`; upload response has `service_templates_created` + `processed_sheets`
- [x] Current data (user's AssetList.xlsx uploaded to preview): check type `Irrigator` = 92 machines (Perrot 57, Briggs 33, Bauer 2); 13-section sheet (Gun Carriage General … Intake Pipe Work) + 5-item Irrigator daily check
- [x] GENERIC Pre Service Check: the purple button now shows for EVERY machine. If the check type has no sheet → "General Pre Service Check": user adds their own parts/areas (add-service-section-input, removable custom cards), OK / Needs Work / N/A, photos, "Any other Parts or Issues" notes/photos, Parts required (name + part number). Submit blocked until at least one part, note, photo or part-required exists. Templated sheets also allow adding extra parts
- [x] Admin UI: upload results list "Excel tabs read" (purple = Pre Service Sheet, amber = skipped); Template Diagnostics shows "Pre Service Sheets (n)" with sections + asset counts
- [x] Fault modal test ids (`fault-explanation-textarea`, `fault-record-btn`, `fault-cancel-btn`); machine name list cleared while a new make's names load
- Verified by testing agent: backend 100%, frontend Irrigator + Generic flows end-to-end, regressions pass (/app/test_reports/iteration_16.json). Tests: `backend/tests/test_asset_excel.py`, `test_pre_service_check.py` (updated to 13 sections)
- NOTE for user/live app: after deploying, re-upload AssetList.xlsx in Admin (or wait for the 9 AM SharePoint sync) so the Irrigator sheet exists; until then irrigators get the generic check

## Sub-checks, Service History, Date Range filter (June 2026)
- [x] **Sheet sub-items (option b = guidance bullets)**: a `… - Pre Service Sheet` tab may have a 3rd column of sub-checks; a row with blank section column belongs to the section above; cells may hold several sub-checks split on new lines / semicolons; optional header row. `asset_excel.parse_service_sections()` → template `section_details: [{name, sub_items}]` (+ `sections` names kept). Sub-checks show as small bullets under the section in the Pre Service form (`service-section-{i}-sub-items`) and in record detail modals; only the section is marked. `ChecklistItem.sub_items` stored with the record. Upload log line shows "…13 sections, 5 sub-checks)". Example workbook: `/app/memory/AssetList_subitems_example.xlsx`; user's current file (no sub-items yet): `/app/memory/AssetList_user_latest.xlsx`
- [x] **Service History panel** (`src/components/ServiceHistoryPanel.js`) under the check-type buttons on /new-checklist: `GET /api/checklists/machine-history?make=&model=&limit=` → Pre Service Checks + Workshop Services + any check with an unsatisfactory item (clean daily checks excluded), newest first, `last_service_at`; entries expand to show Needed work + notes, other issues, parts required; newest expanded by default
- [x] **Date range filter + quick picks** on /all-checks (both tabs): From/To date inputs + This week / This month / Last 30 days / Last 12 months; list, header count and ALL exports (Excel, CSV, Excel (Detailed), Direct Link) pass `date_from`/`date_to` (inclusive, YYYY-MM-DD, 400 on bad dates; `today=true` wins); filenames `all_servicing_<from>_to_<to>.xlsx`. `/all-checks?filter=today` shows a "Show all dates" link instead. `build_checklist_query()` + `export_filename()` extended; `excel-by-machine` also honours dates
- Verified by testing agent: backend 72/72, all frontend flows (/app/test_reports/iteration_17.json). Tests: `backend/tests/test_date_range_history.py`
- [x] Fault modal test ids (`fault-explanation-textarea`, `fault-record-btn`, `fault-cancel-btn`); machine name list cleared while a new make's names load

## Pending / Backlog
- [ ] P1: Continue App.js modularization (~6,500 lines remain: Records, AllChecksCompleted, Training, Accidents, etc.)
- [x] ~~P1: Pre Service Check admin editor~~ → superseded: sheets are configured in AssetList.xlsx tabs (June 2026)
- [x] ~~P1: Fix React Hook dependencies~~ (DONE June 2026 — rules now enforced via .eslintrc.json)
- [x] ~~P1: Refactor `upload_assets_file()`~~ (DONE — now 30 lines using `asset_excel.parse_asset_workbook`)
- [ ] P1: Refactor `upload_staff_file()` (124 lines)
- [ ] P1: Replace array index keys with unique IDs (remaining instances)
- [ ] P1: Restore hidden features when ready
- [ ] P2: `test_sync_idempotency.py` test_01 cases flaky when leftover TEST_ rows exist in DB (pre-existing)
- [ ] P2: Trace background HTTP 422 seen in console (non-blocking)
- [x] ~~P2: Date range filter for "All Checks Overview"~~ (DONE June 2026)
- [ ] P2: Add type hints to Python files (currently 32.9% coverage)
- [ ] P2: Mobile-friendliness improvements

## Credentials
- Admin: Employee Number `4444`
- Manager: Employee Number `191` (ChristopherMarsh)
- Regular: `1447` (Abbie Nixon), `1234` (Matthew Abrey)
