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
- Near Misses, Suggestions, Accidents, Whistleblowing, Training — commented out in `App.js` with `HIDDEN FOR DEPLOYMENT` markers

## Daily Workplan Feature (NEW — June 2026)
- **Manager Editor** at `/workplan` (admin only): 7-day grid with AM/PM cells per day
- Excel-like editing: click select, multi-select, copy/paste, drag-fill handle
- Vehicle/Implement from Asset list, Employee/Manager from Staff list via datalist
- Colour categories (crop/area) for cost tracking
- Past days hidden in editor (kept in DB for costing)
- Rows tinted by manager, manual group colour bands, Sort by Manager
- **Publish to Home** pushes snapshot to dashboard
- **Staff dashboard board**: published plan with day tabs, grouped by manager

## SharePoint Auto-Sync
- Daily 9 AM sync via Microsoft Graph API (Client Credentials flow)
- Syncs Staff (`Name List.xlsx`) and Assets (`AssetList.xlsx`) from OneDrive
- Admin UI for connection testing, manual sync, and status monitoring

## Tech Stack
- **Backend**: FastAPI, Motor (MongoDB async), APScheduler, Microsoft Graph API
- **Frontend**: React, TailwindCSS, Shadcn/UI, Recharts
- **Database**: MongoDB

## Data Model
- `staff`: {employee_number, name, active, admin_control, workshop_control}
- `assets`: {id, check_type, name, make, model}
- `checklists`: {id, check_type, machine_make, machine_name, completed_at, ...}
- `workplan`: {key:'current', week_start, draft_rows, published_rows, published_week_start, published_at}
- `workplan_jobs`: {id, name, order}
- `workplan_colors`: {id, name, color, order}

## Architecture
```
/app/
├── backend/
│   ├── server.py                 # FastAPI app (endpoints, scheduler, workplan)
│   ├── cached_stats.py           # Dashboard stats cache
│   ├── sharepoint_auto_sync.py   # MS Graph API sync logic
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.js                # Main React app (~11,300 lines)
│   │   ├── pages/WorkplanEditor.js   # NEW: Workplan editor page
│   │   ├── components/WorkplanBoard.js # NEW: Dashboard workplan board
│   │   ├── components/common/
│   │   ├── contexts/
│   │   ├── pages/
│   │   └── services/
│   └── package.json
└── memory/
    └── PRD.md
```

## Completed Work
- [x] QR Code Machine Checks
- [x] Breakdown/Repair Reporting
- [x] Work Progress Tracking
- [x] Staff Management
- [x] Asset Management with Templates
- [x] Manager Dashboard
- [x] Admin Panel
- [x] SharePoint Auto-Sync (Staff + Assets)
- [x] Near Miss Investigation (hidden)
- [x] Export Timeout Fix
- [x] Template Diagnostics Panel
- [x] Daily Workplan Feature (June 2026)
- [x] SharePoint sync template matching bug fix (June 2026)

## Pending / Backlog
- [ ] P0: Frontend Refactoring (`App.js` ~11,300 lines → break into components)
- [ ] P1: Fix lint errors in `App.js`
- [ ] P1: Restore hidden features when ready for full rollout
- [ ] P2: Date range filter for "All Checks Overview"
- [ ] P2: Enhance mobile-friendliness

## Credentials
- Admin: Employee Number `4444`
- Regular: `1447` (Abbie Nixon), `1234` (Matthew Abrey)
