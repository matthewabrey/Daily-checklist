"""
SharePoint Auto-Sync Service for Staff List
Uses client credentials flow (app-only authentication) for scheduled background sync.
"""

import os
import asyncio
import requests
import logging
from typing import List, Dict, Tuple
from io import BytesIO
import openpyxl
from datetime import datetime
from dotenv import load_dotenv
from sync_utils import upsert_staff, upsert_assets, upsert_checklist_templates, upsert_service_check_templates
from asset_excel import parse_asset_workbook
import birthdays as bd

load_dotenv()
logger = logging.getLogger(__name__)

class SharePointAutoSync:
    def __init__(self):
        self.client_id = os.environ.get('AZURE_CLIENT_ID')
        self.client_secret = os.environ.get('AZURE_CLIENT_SECRET')
        self.tenant_id = os.environ.get('AZURE_TENANT_ID')
        self.site_url = os.environ.get('SHAREPOINT_SITE_URL', 'https://rgafarms.sharepoint.com/sites/Crops')
        self.staff_filename = os.environ.get('SHAREPOINT_STAFF_FILENAME', 'Name List.xlsx')
        self.assets_filename = os.environ.get('SHAREPOINT_ASSETS_FILENAME', 'AssetList.xlsx')
        # Folder path within the document library (override if IT put the
        # files somewhere else, e.g. SHAREPOINT_FOLDER_PATH=Shared/Apps)
        self.folder_path = os.environ.get('SHAREPOINT_FOLDER_PATH', 'General/Apps/Checklist App')
        
        self.token_url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        self.graph_url = "https://graph.microsoft.com/v1.0"
        self.access_token = None
        self.last_lists = {"jobs": [], "departments": []}
        
    def _get_access_token(self) -> str:
        """Get access token using client credentials flow (app-only)"""
        if not self.client_id:
            raise ValueError("Missing AZURE_CLIENT_ID environment variable")
        if not self.client_secret:
            raise ValueError("Missing AZURE_CLIENT_SECRET environment variable")
        if not self.tenant_id:
            raise ValueError("Missing AZURE_TENANT_ID environment variable")
        
        logger.info(f"Attempting to get access token with client_id length: {len(self.client_id)}, tenant_id length: {len(self.tenant_id)}")
        
        data = {
            'grant_type': 'client_credentials',
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'scope': 'https://graph.microsoft.com/.default'
        }
        
        response = requests.post(self.token_url, data=data, timeout=30)
        
        if response.status_code != 200:
            logger.error(f"Token request failed: {response.status_code} - {response.text}")
            raise Exception(f"Failed to get access token: {response.text}")
        
        token_data = response.json()
        self.access_token = token_data['access_token']
        logger.info("Successfully acquired access token via client credentials")
        return self.access_token
    
    def _make_graph_request(self, url: str, stream: bool = False):
        """Make authenticated request to Microsoft Graph API"""
        if not self.access_token:
            self._get_access_token()
        
        headers = {
            'Authorization': f'Bearer {self.access_token}',
            'Accept': 'application/json'
        }
        
        response = requests.get(url, headers=headers, timeout=60, stream=stream)
        
        if response.status_code == 401:
            # Token might be expired, try to refresh
            self._get_access_token()
            headers['Authorization'] = f'Bearer {self.access_token}'
            response = requests.get(url, headers=headers, timeout=60, stream=stream)
        
        if response.status_code != 200:
            logger.error(f"Graph API request failed: {response.status_code} - {response.text}")
            raise Exception(f"Graph API request failed: {response.status_code}")
        
        if stream:
            return response.content
        return response.json()
    
    def _get_site_id(self) -> str:
        """Get the SharePoint site ID"""
        # Parse site URL to get hostname and site path
        # URL format: https://rgafarms.sharepoint.com/sites/Crops
        from urllib.parse import urlparse
        parsed = urlparse(self.site_url)
        hostname = parsed.netloc
        site_path = parsed.path
        
        # Get site by path
        url = f"{self.graph_url}/sites/{hostname}:{site_path}"
        site_info = self._make_graph_request(url)
        site_id = site_info['id']
        logger.info(f"Found site ID: {site_id}")
        return site_id
    
    def _get_drive_id(self, site_id: str) -> str:
        """Get the document library holding the three spreadsheets. A Teams-
        connected site often has several libraries and Graph doesn't promise
        any particular order, so pick by NAME rather than taking whatever
        comes back first — otherwise we can end up confidently searching the
        wrong library and reporting the files missing."""
        wanted = os.environ.get('SHAREPOINT_LIBRARY_NAME', '').strip().lower()
        try:
            drives = self._make_graph_request(f"{self.graph_url}/sites/{site_id}/drives")
            values = drives.get('value') or []
        except Exception as e:
            logger.warning(f"Could not list document libraries: {e}")
            values = []

        names = [d.get('name') for d in values]
        if names:
            logger.info(f"Document libraries on this site: {names}")

        candidates = [wanted] if wanted else ['documents', 'shared documents']
        for want in candidates:
            for d in values:
                if (d.get('name') or '').strip().lower() == want:
                    logger.info(f"Using document library '{d.get('name')}' ({d['id']})")
                    return d['id']

        if wanted:
            raise Exception(
                f"No document library called '{wanted}' on this site. "
                f"Libraries found: {names or 'none'}"
            )

        # Fall back to the site's default library, then to the first listed
        try:
            default_drive = self._make_graph_request(f"{self.graph_url}/sites/{site_id}/drive")
            if default_drive.get('id'):
                logger.info(f"Using the site's default library '{default_drive.get('name')}'")
                return default_drive['id']
        except Exception as e:
            logger.warning(f"Could not get the site's default library: {e}")

        if not values:
            raise Exception("No document libraries found in the site")
        logger.warning(f"Falling back to the first library listed: '{names[0]}'")
        return values[0]['id']
    
    def _find_file(self, drive_id: str, filename: str) -> str:
        """Find a file in the drive by name, checking specific folder first"""
        
        folder_contents = None

        # First try the specific folder path (Shared Documents/General/...)
        try:
            folder_url = f"{self.graph_url}/drives/{drive_id}/root:/{self.folder_path}:/children"
            items = self._make_graph_request(folder_url)
            folder_contents = [i.get('name') for i in items.get('value', [])]

            for item in items.get('value', []):
                if item['name'].lower() == filename.lower():
                    logger.info(f"Found file in {self.folder_path}: {item['name']} (ID: {item['id']})")
                    return item['id']
        except Exception as e:
            logger.warning(f"Could not access folder {self.folder_path}: {e}")
        
        # Try root folder
        try:
            url = f"{self.graph_url}/drives/{drive_id}/root/children"
            items = self._make_graph_request(url)
            
            for item in items.get('value', []):
                if item['name'].lower() == filename.lower():
                    logger.info(f"Found file in root: {item['name']} (ID: {item['id']})")
                    return item['id']
        except Exception as e:
            logger.warning(f"Could not access root folder: {e}")
        
        # Search recursively as fallback
        try:
            url = f"{self.graph_url}/drives/{drive_id}/root/search(q='{filename}')"
            search_results = self._make_graph_request(url)
            
            for item in search_results.get('value', []):
                if item['name'].lower() == filename.lower():
                    logger.info(f"Found file via search: {item['name']} (ID: {item['id']})")
                    return item['id']
        except Exception as e:
            logger.warning(f"Search failed: {e}")
        
        # Say what we could actually see — far quicker to diagnose than
        # "not found" on its own (usually a renamed file or a spelling slip)
        if folder_contents is None:
            raise Exception(
                f"File '{filename}' not found, and the folder "
                f"'{self.folder_path}' couldn't be opened at all — check "
                "SHAREPOINT_FOLDER_PATH and the app's permission on this site."
            )
        raise Exception(
            f"File '{filename}' not found. '{self.folder_path}' contains: "
            + (", ".join(folder_contents) if folder_contents else "nothing")
        )
    
    def list_folder(self, folder_path: str):
        """Everything sitting in a folder, newest last. Used for the
        Telematics Inbox that Power Automate drops John Deere emails into."""
        site_id = self._get_site_id()
        drive_id = self._get_drive_id(site_id)
        url = f"{self.graph_url}/drives/{drive_id}/root:/{folder_path}:/children"
        items = self._make_graph_request(url)
        out = []
        for it in items.get("value", []):
            if "folder" in it:
                continue
            out.append({
                "id": it.get("id"),
                "name": it.get("name"),
                "size": it.get("size"),
                "modified": it.get("lastModifiedDateTime"),
            })
        out.sort(key=lambda x: x.get("modified") or "")
        return drive_id, out

    def upload_file(self, folder_path: str, filename: str, content: bytes):
        """Put a file into a SharePoint folder. Used for the nightly backup.

        Needs the Azure app registration to hold **Files.ReadWrite.All**, not
        just read. If it only has read, Graph answers 403 and that is said
        plainly rather than swallowed — a backup you think is running and
        isn't is worse than none.

        Files up to 4MB go in one request; anything larger goes through an
        upload session in 10MB slices, which is Graph's own rule.
        """
        import math
        site_id = self._get_site_id()
        drive_id = self._get_drive_id(site_id)
        safe = filename.replace("'", "")
        base = f"{self.graph_url}/drives/{drive_id}/root:/{folder_path}/{safe}"

        if not self.access_token:
            self._get_access_token()
        headers = {"Authorization": f"Bearer {self.access_token}"}

        SMALL = 4 * 1024 * 1024
        if len(content) <= SMALL:
            r = requests.put(base + ":/content", headers=headers,
                             data=content, timeout=180)
            # A token is minted with whatever permissions existed at the time,
            # and this class holds onto it. So the first attempt after someone
            # grants Files.ReadWrite.All in Azure can still be refused by an
            # old token. Throw the token away and try once more before
            # believing the refusal — otherwise it looks like the Azure change
            # didn't work when it did.
            if r.status_code in (401, 403):
                self.access_token = None
                self._get_access_token()
                headers["Authorization"] = f"Bearer {self.access_token}"
                r = requests.put(base + ":/content", headers=headers,
                                 data=content, timeout=180)
            if r.status_code == 403:
                raise PermissionError(
                    "SharePoint refused the write, twice, with a fresh token. "
                    "The Azure app registration needs Files.ReadWrite.All as an "
                    "APPLICATION permission (not delegated), and someone has to "
                    "press Grant admin consent — read alone cannot save a backup.")
            r.raise_for_status()
            return r.json()

        # large file: an upload session, 10MB at a time
        r = requests.post(base + ":/createUploadSession", headers=headers,
                          json={"item": {"@microsoft.graph.conflictBehavior": "replace"}},
                          timeout=60)
        if r.status_code in (401, 403):
            self.access_token = None
            self._get_access_token()
            headers["Authorization"] = f"Bearer {self.access_token}"
            r = requests.post(base + ":/createUploadSession", headers=headers,
                              json={"item": {"@microsoft.graph.conflictBehavior": "replace"}},
                              timeout=60)
        if r.status_code == 403:
            raise PermissionError(
                "SharePoint refused to start an upload session. The Azure app "
                "registration needs Files.ReadWrite.All with admin consent.")
        r.raise_for_status()
        url = r.json()["uploadUrl"]

        CHUNK = 10 * 1024 * 1024
        total = len(content)
        for i in range(math.ceil(total / CHUNK)):
            lo = i * CHUNK
            hi = min(lo + CHUNK, total) - 1
            cr = requests.put(url, timeout=300, data=content[lo:hi + 1], headers={
                "Content-Length": str(hi - lo + 1),
                "Content-Range": f"bytes {lo}-{hi}/{total}",
            })
            if cr.status_code not in (200, 201, 202):
                cr.raise_for_status()
            last = cr
        return last.json() if last.content else {"name": safe, "size": total}

    def read_file(self, drive_id: str, item_id: str) -> bytes:
        """Public wrapper so callers don't reach into the private one."""
        return self._download_file(drive_id, item_id)

    def _download_file(self, drive_id: str, item_id: str) -> bytes:
        """Download file content from SharePoint"""
        url = f"{self.graph_url}/drives/{drive_id}/items/{item_id}/content"
        content = self._make_graph_request(url, stream=True)
        logger.info(f"Downloaded file: {len(content)} bytes")
        return content
    
    def _parse_staff_excel(self, file_content: bytes) -> List[Dict]:
        """Parse staff Excel file and extract employee data"""
        workbook = openpyxl.load_workbook(BytesIO(file_content))
        sheet = workbook[workbook.sheetnames[0]]
        
        # Get headers
        headers = [str(cell.value).strip().lower() if cell.value else '' for cell in sheet[1]]
        logger.info(f"Excel headers: {headers}")
        
        # Find column indices - prioritize 'employee number' column
        name_col = None
        number_col = None
        workshop_col = None
        admin_col = None
        manager_col = None
        # Optional, added Oct 2026. Only the day and month are ever kept.
        dob_col = bd.find_dob_column(headers)
        
        for i, header in enumerate(headers):
            # Check for employee number column FIRST (more specific match)
            if ('employee' in header and 'number' in header) or header == 'emp no' or header == 'employee_number':
                number_col = i
            elif 'name' in header and 'employee' not in header:
                name_col = i
            elif 'workshop' in header and 'control' in header:
                workshop_col = i
            elif 'admin' in header and 'control' in header:
                admin_col = i
            elif 'manager' in header:
                manager_col = i
        
        # If we didn't find employee number yet, look for other patterns (but NOT phone number)
        if number_col is None:
            for i, header in enumerate(headers):
                if ('number' in header or 'emp' in header) and 'phone' not in header and 'tel' not in header:
                    number_col = i
                    break
        
        # Fallback
        if name_col is None:
            name_col = 0
        if number_col is None and len(headers) > 1:
            number_col = 1
        
        logger.info(f"Column mapping - name: {name_col}, number: {number_col}, workshop: {workshop_col}, admin: {admin_col}, manager: {manager_col}")
        
        if number_col is None:
            raise Exception("Could not find Employee Number column")
        
        # Extract staff data
        staff_data = []
        for row in sheet.iter_rows(min_row=2, values_only=True):
            if row and len(row) > max(name_col, number_col):
                name = str(row[name_col]).strip() if row[name_col] else ''
                emp_number = str(row[number_col]).strip() if row[number_col] else ''
                
                workshop_control = None
                admin_control = None
                manager_control = None
                
                if workshop_col is not None and len(row) > workshop_col and row[workshop_col]:
                    workshop_control = str(row[workshop_col]).strip().lower()
                
                if admin_col is not None and len(row) > admin_col and row[admin_col]:
                    admin_control = str(row[admin_col]).strip().lower()
                
                if manager_col is not None and len(row) > manager_col and row[manager_col]:
                    manager_control = str(row[manager_col]).strip().lower()
                
                birthday = None
                if dob_col is not None and len(row) > dob_col:
                    birthday = bd.from_cell(row[dob_col])

                if name and emp_number and name.lower() not in ['name', 'staff', 'employee']:
                    staff_data.append({
                        'name': name,
                        'employee_number': emp_number,
                        'active': True,
                        'workshop_control': workshop_control,
                        'admin_control': admin_control,
                        'manager_control': manager_control,
                        'birthday': birthday
                    })
        
        logger.info(f"Parsed {len(staff_data)} staff members from Excel")
        return staff_data
    
    def _parse_departments_sheet(self, file_content: bytes) -> Dict:
        """The 'Departments' tab of Name List.xlsx holds two lists side by
        side — Job and Crop/Department. Columns are found by their HEADING,
        not their position, because the work plan taught us that a sheet
        which moves silently is worse than one that breaks loudly.
        Returns empty lists if the tab isn't there; it's optional."""
        import re as _re

        def norm(v):
            return _re.sub(r"[^a-z]", "", str(v or "").lower())

        try:
            wb = openpyxl.load_workbook(BytesIO(file_content), data_only=True)
        except Exception as e:
            logger.warning(f"Couldn't open the workbook for departments: {e}")
            return {"jobs": [], "departments": []}

        sheet = None
        for name in wb.sheetnames:
            if norm(name) in ("departments", "department"):
                sheet = wb[name]
                break
        if sheet is None:
            logger.info("No Departments tab in Name List.xlsx — lists left as they were")
            return {"jobs": [], "departments": []}

        job_col = dept_col = header_row = None
        for r in range(1, min(sheet.max_row, 10) + 1):
            for c in range(1, min(sheet.max_column, 12) + 1):
                key = norm(sheet.cell(r, c).value)
                if key == "job":
                    job_col, header_row = c, r
                elif key in ("cropdepartment", "crop", "department", "cropdept"):
                    dept_col, header_row = c, r
            if job_col or dept_col:
                break

        if not header_row:
            logger.warning("Departments tab found but no 'Job' / 'Crop/Department' headings")
            return {"jobs": [], "departments": []}

        def column(col):
            if not col:
                return []
            seen, out = set(), []
            for r in range(header_row + 1, sheet.max_row + 1):
                v = sheet.cell(r, col).value
                if v in (None, ""):
                    continue
                v = str(v).strip()
                # the sheet has 'Band Spraying' twice — keep the first only
                if v.lower() in seen:
                    continue
                seen.add(v.lower())
                out.append(v)
            return out

        jobs, depts = column(job_col), column(dept_col)
        logger.info(f"Departments tab: {len(jobs)} jobs, {len(depts)} crop/departments")
        return {"jobs": jobs, "departments": depts}

    def _fetch_and_parse_staff(self) -> List[Dict]:
        """Blocking half of the staff sync — network and Excel parsing only, so
        it can be run off the event loop."""
        site_id = self._get_site_id()
        drive_id = self._get_drive_id(site_id)
        item_id = self._find_file(drive_id, self.staff_filename)
        file_content = self._download_file(drive_id, item_id)
        return self._parse_staff_excel(file_content), self._parse_departments_sheet(file_content)

    async def sync_staff_list(self, db) -> Dict:
        """Main sync function - downloads staff list from SharePoint and updates database"""
        try:
            logger.info(f"Starting SharePoint staff sync at {datetime.now()}")

            # Download and parse in a worker thread — this runs hourly now, and
            # blocking the event loop for it would freeze the app for everyone
            staff_data, self.last_lists = await asyncio.to_thread(self._fetch_and_parse_staff)

            if not staff_data:
                raise Exception("No valid staff data found in Excel file")
            
            # Idempotent upsert - never hard-deletes; staff missing from SharePoint are marked inactive
            sync_stats = await upsert_staff(db, staff_data)

            # Birthdays are written as their own pass rather than through
            # upsert_staff, so both routes into the staff list (this sync and
            # the Upload Staff List button) behave identically.
            bd_stats = await bd.save(
                db, [(s.get('employee_number'), s.get('birthday')) for s in staff_data])

            result = {
                'success': True,
                'message': f"Successfully synced {len(staff_data)} staff members from SharePoint ({sync_stats['added']} added, {sync_stats['updated']} updated, {sync_stats['deactivated']} deactivated)",
                'count': len(staff_data),
                **sync_stats,
                **bd_stats,
                'synced_at': datetime.now().isoformat(),
                'preview': staff_data[:5]
            }
            
            logger.info(f"SharePoint sync completed: {result['message']}")
            return result
            
        except Exception as e:
            logger.error(f"SharePoint sync failed: {str(e)}")
            return {
                'success': False,
                'message': f'Sync failed: {str(e)}',
                'synced_at': datetime.now().isoformat()
            }
    
    def _parse_assets_excel(self, file_content: bytes) -> Dict:
        """Parse AssetList.xlsx: assets + Daily Check / Pre Service Sheet templates (shared with admin upload)"""
        parsed = parse_asset_workbook(file_content)
        logger.info(f"Parsed {len(parsed['assets'])} assets from Excel")
        for line in parsed['processed_sheets']:
            logger.info(f"Template sheet: {line}")
        return parsed
    
    def _fetch_and_parse_assets(self) -> Dict:
        """Blocking half of the asset sync — network and Excel parsing only."""
        site_id = self._get_site_id()
        drive_id = self._get_drive_id(site_id)
        item_id = self._find_file(drive_id, self.assets_filename)
        file_content = self._download_file(drive_id, item_id)
        return self._parse_assets_excel(file_content)

    async def sync_assets_list(self, db) -> Dict:
        """Sync assets and checklist templates from SharePoint"""
        try:
            logger.info(f"Starting SharePoint assets sync at {datetime.now()}")

            # Off the event loop — AssetList is the big one, with every
            # Pre Service Sheet tab in it
            parsed = await asyncio.to_thread(self._fetch_and_parse_assets)
            assets = parsed['assets']

            if not assets:
                raise Exception("No valid asset data found in Excel file")
            
            # Idempotent upserts - keeps asset ids + QR print status, retires assets missing from SharePoint
            asset_stats = await upsert_assets(db, assets)
            templates_count = await upsert_checklist_templates(db, parsed['checklist_templates']) if parsed['checklist_templates'] else 0
            service_count = await upsert_service_check_templates(db, parsed['service_templates'])
            
            result = {
                'success': True,
                'message': f"Successfully synced {len(assets)} assets ({asset_stats['added']} added, {asset_stats['updated']} updated, {asset_stats['retired']} retired), {templates_count} daily check lists and {service_count} pre service sheets",
                'assets_count': len(assets),
                **asset_stats,
                'templates_count': templates_count,
                'service_templates_count': service_count,
                'processed_sheets': parsed['processed_sheets'],
                'synced_at': datetime.now().isoformat(),
                'preview': assets[:5]
            }
            
            logger.info(f"Assets sync completed: {result['message']}")
            return result
            
        except Exception as e:
            logger.error(f"Assets sync failed: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'message': f'Sync failed: {str(e)}',
                'synced_at': datetime.now().isoformat()
            }
    
    async def sync_all(self, db) -> Dict:
        """Sync both staff and assets from SharePoint"""
        staff_result = await self.sync_staff_list(db)
        assets_result = await self.sync_assets_list(db)
        
        return {
            'success': staff_result.get('success', False) and assets_result.get('success', False),
            'staff': staff_result,
            'assets': assets_result,
            'synced_at': datetime.now().isoformat()
        }
    
    def test_connection(self) -> Dict:
        """Test the SharePoint connection for both files"""
        # Always include credentials info for debugging
        credentials_info = {
            'client_id_prefix': self.client_id[:8] if self.client_id else 'NONE',
            'tenant_id_prefix': self.tenant_id[:8] if self.tenant_id else 'NONE',
            'secret_length': len(self.client_secret) if self.client_secret else 0,
            'secret_prefix': self.client_secret[:4] if self.client_secret else 'NONE'
        }
        
        try:
            # Log credential info (not the actual values)
            logger.info(f"Testing connection with client_id starting with: {self.client_id[:8] if self.client_id else 'NONE'}...")
            logger.info(f"Tenant ID starting with: {self.tenant_id[:8] if self.tenant_id else 'NONE'}...")
            logger.info(f"Secret length: {len(self.client_secret) if self.client_secret else 0}")
            
            self._get_access_token()
            site_id = self._get_site_id()
            drive_id = self._get_drive_id(site_id)
            
            result = {
                'success': True,
                'message': 'SharePoint connection successful',
                'site_id': site_id,
                'drive_id': drive_id,
                'files': {},
                'credentials_info': credentials_info
            }
            
            # Check staff file
            try:
                staff_item_id = self._find_file(drive_id, self.staff_filename)
                url = f"{self.graph_url}/drives/{drive_id}/items/{staff_item_id}"
                staff_info = self._make_graph_request(url)
                result['files']['staff'] = {
                    'file_name': staff_info.get('name'),
                    'file_size': staff_info.get('size'),
                    'last_modified': staff_info.get('lastModifiedDateTime'),
                    'status': 'found'
                }
            except Exception as e:
                result['files']['staff'] = {'status': 'not_found', 'error': str(e)}
            
            # Check assets file
            try:
                assets_item_id = self._find_file(drive_id, self.assets_filename)
                url = f"{self.graph_url}/drives/{drive_id}/items/{assets_item_id}"
                assets_info = self._make_graph_request(url)
                result['files']['assets'] = {
                    'file_name': assets_info.get('name'),
                    'file_size': assets_info.get('size'),
                    'last_modified': assets_info.get('lastModifiedDateTime'),
                    'status': 'found'
                }
            except Exception as e:
                result['files']['assets'] = {'status': 'not_found', 'error': str(e)}

            # Check the workplan file too — it lives in the same folder and is
            # the third of the three the app relies on
            workplan_filename = os.environ.get('SHAREPOINT_WORKPLAN_FILENAME', 'DailyWorkPlanApp.xlsx')
            try:
                wp_item_id = self._find_file(drive_id, workplan_filename)
                url = f"{self.graph_url}/drives/{drive_id}/items/{wp_item_id}"
                wp_info = self._make_graph_request(url)
                result['files']['workplan'] = {
                    'file_name': wp_info.get('name'),
                    'file_size': wp_info.get('size'),
                    'last_modified': wp_info.get('lastModifiedDateTime'),
                    'status': 'found'
                }
            except Exception as e:
                result['files']['workplan'] = {'status': 'not_found', 'error': str(e)}

            result['all_three_found'] = all(
                f.get('status') == 'found' for f in result['files'].values()
            )
            return result
        except Exception as e:
            return {
                'success': False,
                'message': f'Connection failed: {str(e)}',
                'credentials_info': credentials_info
            }


# Global instance
sharepoint_auto_sync = SharePointAutoSync()
