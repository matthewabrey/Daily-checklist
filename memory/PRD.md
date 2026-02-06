# Machine Checklist Application - Product Requirements Document

## Original Problem Statement
Build a machine checklist application for managing equipment startup inspections and safety checks. The app allows employees to complete daily checks on machinery, track repairs, and manage work progress.

## Core Features

### Authentication & Roles
- Employee login via employee number
- Admin role: Full access to all features
- Manager role: Access to Work Progress and Historic Data
- Workshop role: Access to workshop-related features

### Equipment Checklist System
- Daily startup checks for tractors and machinery
- Grader startup checks with specific safety requirements
- Workshop service records
- Photo capture for documenting issues
- QR code scanning for quick machine selection

### Admin Features
- Upload staff list from Excel (with Manager/Admin/Workshop columns)
- Upload asset list from Excel
- QR code generation and printing for assets
- Dashboard with statistics

### Manager Features (New - Added Jan 2026)
- Work Progress Tracking
  - Create jobs (e.g., "Carrot Drilling" with total area)
  - Log daily progress (hectares completed)
  - View statistics (area completed, area left, daily average)
- Historic Data viewing

### Compulsory Checks Feature (New - Added Jan 2026)
- Checklist items can be marked as "compulsory" in uploaded Excel templates
- Compulsory items are visually distinguished (red asterisk, "COMPULSORY" label, red border)
- If a compulsory item is marked as failed/unsatisfactory, the user CANNOT sign off on the checklist
- Backend validation rejects checklists with failed compulsory items
- Frontend disables submit button when compulsory items fail

## Technical Stack
- Frontend: React with TailwindCSS, Shadcn/UI components
- Backend: FastAPI (Python)
- Database: MongoDB
- Additional: QR code generation (qrcode + Pillow)

## Data Models

### Staff
```
{
  id: string,
  employee_number: string,
  name: string,
  active: boolean,
  admin_control: "yes" | "no" | null,
  manager_control: "yes" | "no" | null,
  workshop_control: "yes" | "no" | null
}
```

### Asset
```
{
  id: string,
  check_type: string,
  name: string,
  make: string,
  qr_printed: boolean,
  qr_printed_at: string | null
}
```

### ChecklistTemplateItem
```
{
  item: string,
  compulsory: boolean
}
```

### ChecklistItem (in submitted checklist)
```
{
  item: string,
  status: "unchecked" | "satisfactory" | "unsatisfactory" | "n/a",
  notes: string | null,
  photos: array,
  compulsory: boolean
}
```

### Job
```
{
  id: string,
  name: string,
  total_area: float,
  created_at: string,
  status: "active" | "complete"
}
```

### WorkEntry
```
{
  id: string,
  job_id: string,
  hectares_completed: float,
  date_completed: string,
  entered_by: string,
  entered_at: string
}
```

### NearMiss (Updated Feb 2026)
```
{
  id: string,
  description: string,
  location: string | null,
  photos: array,
  is_anonymous: boolean,
  submitted_by: string | null,
  employee_number: string | null,
  created_at: string,
  acknowledged: boolean,
  acknowledged_at: string | null,
  acknowledged_by: string | null,
  // Investigation fields
  severity: "red" | "orange" | "green" | null,
  action_required: string | null,
  progress: "not_started" | "in_progress" | "completed" | null,
  investigation_notes: string | null,
  no_swp_or_not_covered: boolean,
  swp_training_not_received: boolean,
  trained_but_not_following: boolean,
  investigated_by: string | null,
  investigated_at: string | null
}
```

### Suggestion
```
{
  id: string,
  title: string,
  description: string,
  category: "safety" | "efficiency" | "equipment" | "other" | null,
  is_anonymous: boolean,
  submitted_by: string | null,
  employee_number: string | null,
  created_at: string,
  status: "new" | "reviewed" | "implemented" | "declined",
  reviewed_at: string | null,
  reviewed_by: string | null,
  review_notes: string | null
}
```

## API Endpoints

### Authentication
- POST /api/auth/employee-login - Login with employee number

### Assets
- GET /api/assets - Get all assets
- GET /api/assets/makes - Get unique makes
- GET /api/assets/names/{make} - Get names for a make
- POST /api/admin/upload-assets-file - Upload asset list Excel

### Checklists
- GET /api/checklist-templates/{check_type} - Get template with compulsory flags
- POST /api/checklists - Submit checklist (validates compulsory items)
- GET /api/checklists - Get submitted checklists

### Jobs (Work Progress)
- GET /api/jobs - Get all jobs with stats
- POST /api/admin/jobs - Create new job
- DELETE /api/admin/jobs/{job_id} - Delete job
- POST /api/admin/jobs/{job_id}/work-entry - Add work entry
- PUT /api/admin/jobs/{job_id}/reopen - Reopen completed job

### Near Misses
- POST /api/near-misses - Submit near miss report
- GET /api/near-misses - Get list of near misses
- GET /api/near-misses/count - Get counts (new, total)
- POST /api/near-misses/{id}/acknowledge - Acknowledge a near miss (admin)
- PUT /api/near-misses/{id}/investigate - Add/update investigation details (admin/manager)

### Suggestions
- POST /api/suggestions - Submit suggestion
- GET /api/suggestions - Get list of suggestions
- GET /api/suggestions/count - Get counts (new, total)
- PUT /api/suggestions/{id}/review - Review suggestion (set status, add notes)

## What's Been Implemented

### January 15, 2026
- **Near Misses & Suggestions Feature** (COMPLETE)
  - Backend: NearMiss and Suggestion models with anonymous submission support
  - Backend: POST/GET /api/near-misses endpoints with acknowledge action
  - Backend: POST/GET/PUT /api/suggestions endpoints with review actions (reviewed, implemented, declined)
  - Backend: Dashboard stats include near_misses_new, near_misses_total, suggestions_new, suggestions_total
  - Frontend: Dashboard cards showing Near Misses and Suggestions counts
  - Frontend: "Report Near Miss" button with modal (name, location, description, photo upload, anonymous option)
  - Frontend: "Submit Suggestion" button with modal (name, title, category, description, anonymous option)
  - Frontend: /near-misses page with filter and detail modal (admin can acknowledge)
  - Frontend: /suggestions page with filter and detail modal (admin can review)
  - Testing: 18/18 backend tests passed, all frontend features verified

### February 6, 2026
- **Near Miss Investigation Feature** (COMPLETE)
  - Backend: Added investigation fields to NearMiss model (severity, progress, action_required, investigation_notes, SWP checkboxes)
  - Backend: PUT /api/near-misses/{id}/investigate endpoint to update investigation details
  - Frontend: Investigation section in near miss detail modal
  - Frontend: Admin/Manager can add/edit investigation with:
    - Severity buttons (Red=High, Orange=Medium, Green=Low) with color coding
    - Progress dropdown (Not Started, In Progress, Completed)
    - Action to be Taken textarea
    - Investigation Notes textarea
    - 3 SWP checkboxes (No SWP in place, Training not received, Not following SWP)
  - Frontend: List view shows severity color dot and progress badge
  - Frontend: Regular users can view but not edit investigations
  - Testing: 100% backend and frontend tests passed

- **Frontend Refactoring Progress** (IN PROGRESS)
  - Created directory structure: /pages, /components/common, /contexts, /services
  - Extracted AuthContext to /contexts/AuthContext.js
  - Extracted API service to /services/api.js
  - Extracted QRScanner component to /components/common/QRScanner.jsx
  - Extracted NearMissesPage to /pages/NearMissesPage.jsx
  - Main App.js still needs further extraction (11,000+ lines)

### January 13, 2026
- **Compulsory Checks Feature** (COMPLETE)
  - Backend: Added `compulsory` field to ChecklistTemplateItem and ChecklistItem models
  - Backend: Updated asset file upload to parse "Compulsory" column
  - Backend: Added validation to reject checklists with failed compulsory items
  - Frontend: Visual indicators (red asterisk, COMPULSORY label, red border)
  - Frontend: Submit button disabled when compulsory items fail
  - Frontend: Error messages when trying to submit with failed compulsory items
  - Default templates (daily_check, grader_startup) have compulsory items
  - Testing: 16/16 backend tests passed

- **Delete Job Fix** (VERIFIED)
  - DELETE /api/admin/jobs/{job_id} working correctly
  - Frontend delete button on Manager page working

- **Manager Role Access** (VERIFIED)
  - Staff upload recognizes "Manager" column
  - Manager page accessible to managers and admins

## Upcoming Tasks
1. Fix pre-existing lint errors in frontend
2. Frontend refactoring (App.js is 8000+ lines - needs breakdown into components)

## How to Use Compulsory Feature
1. In your AssetList.xlsx, add a "Compulsory" column to the checklist sheets
2. Mark items as compulsory with values: yes, y, true, 1, or x
3. Upload the file via Admin Panel > Upload Asset List
4. When employees complete checklists, compulsory items will show visual indicators
5. Users cannot sign off if any compulsory item is marked as failed

## Test Credentials
- Admin/Manager: Employee Number `4444`
