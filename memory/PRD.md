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
- [x] **Cropping Map Modal** — iframe to external FieldPlan.html
- [x] **Cell Editing Bug Fix** — Fixed row index mismatch when displayRows differs from rows
- [x] **Drag & Drop Row Reordering** — Reorder staff rows by dragging
- [x] **Multi-User Presence Tracking** — Warning when others are editing
- [x] **XSS Security Fix** — HTML-escaped QR print output

## Pending / Backlog
- [ ] P0: Frontend Refactoring (`App.js` ~11,400 lines)
- [ ] P1: Fix lint errors in `App.js`
- [ ] P1: Restore hidden features when ready
- [ ] P2: Date range filter for "All Checks Overview"
- [ ] P2: Mobile-friendliness improvements

## Credentials
- Admin: Employee Number `4444`
- Manager: Employee Number `191` (ChristopherMarsh)
- Regular: `1447` (Abbie Nixon), `1234` (Matthew Abrey)
