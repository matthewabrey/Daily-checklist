"""
SharePoint Excel Integration for Abreys Machine Checklist App

This module handles authentication and data extraction from SharePoint Excel files
for staff names and machine assets using Microsoft Graph API.
"""

import os
import requests
import re
from typing import List, Dict, Optional, Tuple
from urllib.parse import unquote, urlparse
import msal
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class SharePointExcelIntegration:
    def __init__(self):
        # These will be set from environment variables after Azure setup
        self.client_id = os.environ.get('AZURE_CLIENT_ID')
        self.client_secret = os.environ.get('AZURE_CLIENT_SECRET') 
        self.tenant_id = os.environ.get('AZURE_TENANT_ID')
        self.redirect_uri = os.environ.get('AZURE_REDIRECT_URI', 'https://repairflow-20.preview.emergentagent.com/auth/callback')
        
        # SharePoint file URLs (your actual files)
        self.staff_file_url = "https://rgafarms-my.sharepoint.com/:x:/g/personal/matt_abrey-farms_co_uk/EVJlVIDkvf9Po1vj5SmNGGcBeiFhLR4uYeJXH-Jrr9XCeQ?e=XjybDY"
        self.asset_file_url = "https://rgafarms-my.sharepoint.com/:x:/g/personal/matt_abrey-farms_co_uk/EcE60OrrIiZEgesXpn83UPsBDq28FtRkh5eT2BSt4tTqnA?e=OPadb1"
        
        # Checklist template URLs (you'll need to upload these to SharePoint and provide URLs)
        self.daily_checklist_url = None  # URL to Daily_Check_Checklist.xlsx
        self.grader_checklist_url = None  # URL to Grader_Startup_Checklist.xlsx  
        self.workshop_tasks_url = None  # URL to Workshop_Service_Tasks.xlsx
        
        # MSAL configuration
        self.authority = f"https://login.microsoftonline.com/{self.tenant_id}"
        self.scopes = [
            "https://graph.microsoft.com/Files.Read",
            "https://graph.microsoft.com/Files.ReadWrite", 
            "https://graph.microsoft.com/Sites.Read.All",
            "https://graph.microsoft.com/User.Read"
        ]
        
        self.app = None
        self.access_token = None
        
    def initialize_msal_app(self):
        """Initialize MSAL confidential client application"""
        if not all([self.client_id, self.client_secret, self.tenant_id]):
            raise ValueError("Missing Azure credentials. Please set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and AZURE_TENANT_ID environment variables.")
        
        self.app = msal.ConfidentialClientApplication(
            client_id=self.client_id,
            client_credential=self.client_secret,
            authority=self.authority
        )
        
    def get_auth_url(self) -> str:
        """Generate authorization URL for user authentication"""
        if not self.app:
            self.initialize_msal_app()
            
        auth_url = self.app.get_authorization_request_url(
            scopes=self.scopes,
            redirect_uri=self.redirect_uri
        )
        return auth_url
        
    def acquire_token_by_auth_code(self, auth_code: str) -> Dict:
        """Acquire access token using authorization code"""
        if not self.app:
            self.initialize_msal_app()
            
        result = self.app.acquire_token_by_authorization_code(
            code=auth_code,
            scopes=self.scopes,
            redirect_uri=self.redirect_uri
        )
        
        if "access_token" in result:
            self.access_token = result["access_token"]
            logger.info("Successfully acquired access token")
            return result
        else:
            logger.error(f"Failed to acquire token: {result.get('error_description', 'Unknown error')}")
            raise Exception(f"Authentication failed: {result.get('error_description', 'Unknown error')}")
    
    def _parse_sharepoint_sharing_url(self, sharing_url: str) -> Tuple[str, str, str]:
        """
        Parse SharePoint sharing URL to extract site, drive, and item information
        
        URL format: https://rgafarms-my.sharepoint.com/:x:/g/personal/matt_abrey-farms_co_uk/ITEM_ID?e=ACCESS_KEY
        """
        try:
            # Extract the base SharePoint site URL
            parsed = urlparse(sharing_url)
            site_url = f"{parsed.scheme}://{parsed.netloc}"
            
            # Extract the personal site path
            path_parts = parsed.path.split('/')
            if 'personal' in path_parts:
                personal_idx = path_parts.index('personal')
                if personal_idx + 1 < len(path_parts):
                    user_path = path_parts[personal_idx + 1]
                    site_path = f"/personal/{user_path}"
                else:
                    raise ValueError("Invalid SharePoint URL format")
            else:
                raise ValueError("Personal OneDrive URL expected")
            
            # Extract item ID from the URL path (the part after /g/)
            if '/g/' in parsed.path:
                item_part = parsed.path.split('/g/')[-1]
                # Remove any additional path segments and get the item ID
                item_id = item_part.split('/')[0] if '/' in item_part else item_part
            else:
                raise ValueError("Could not extract item ID from sharing URL")
                
            return site_url, site_path, item_id
            
        except Exception as e:
            logger.error(f"Failed to parse SharePoint URL {sharing_url}: {str(e)}")
            raise ValueError(f"Invalid SharePoint sharing URL: {str(e)}")
    
    def _make_graph_request(self, url: str, method: str = "GET", data: Dict = None) -> Dict:
        """Make authenticated request to Microsoft Graph API"""
        if not self.access_token:
            raise Exception("No access token available. Please authenticate first.")
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, headers=headers, json=data, timeout=30)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Graph API request failed: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response status: {e.response.status_code}")
                logger.error(f"Response content: {e.response.text}")
            raise Exception(f"Microsoft Graph API request failed: {str(e)}")
    
    def _get_site_and_drive_info(self, site_url: str, site_path: str) -> Tuple[str, str]:
        """Get SharePoint site ID and drive ID"""
        # Get site information
        hostname = urlparse(site_url).netloc
        site_api_url = f"https://graph.microsoft.com/v1.0/sites/{hostname}:{site_path}"
        
        site_info = self._make_graph_request(site_api_url)
        site_id = site_info['id']
        
        # Get default drive for the site
        drives_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives"
        drives_info = self._make_graph_request(drives_url)
        
        # Find the default drive (usually the first one for personal OneDrive)
        if drives_info.get('value'):
            drive_id = drives_info['value'][0]['id']
            return site_id, drive_id
        else:
            raise Exception("No drives found for the SharePoint site")
    
    def _resolve_sharing_url_to_item_id(self, sharing_url: str) -> Tuple[str, str]:
        """Convert sharing URL to actual SharePoint item ID and drive ID using sharing token"""
        try:
            import base64
            
            # Create sharing token for Graph API
            sharing_token = base64.urlsafe_b64encode(sharing_url.encode()).decode().rstrip('=')
            
            # Method 1: Try the shares API with the encoded URL
            shares_url = f"https://graph.microsoft.com/v1.0/shares/u!{sharing_token}"
            
            try:
                share_info = self._make_graph_request(shares_url)
                logger.info(f"Share info received successfully")
                
                # Extract drive and item IDs from the response
                if 'remoteItem' in share_info:
                    item_id = share_info['remoteItem']['id']
                    drive_id = share_info['remoteItem']['parentReference']['driveId']
                elif 'driveItem' in share_info:
                    item_id = share_info['driveItem']['id'] 
                    drive_id = share_info['driveItem']['parentReference']['driveId']
                else:
                    item_id = share_info['id']
                    drive_id = share_info['parentReference']['driveId']
                
                logger.info(f"Successfully resolved sharing URL: drive_id={drive_id[:20]}..., item_id={item_id[:20]}...")
                return drive_id, item_id
                
            except Exception as shares_error:
                logger.warning(f"Shares API failed: {str(shares_error)}")
                
                # Method 2: Try to access the user's OneDrive directly  
                try:
                    # Get current user info
                    user_info = self._make_graph_request("https://graph.microsoft.com/v1.0/me")
                    logger.info(f"User authenticated: {user_info.get('displayName', 'Unknown')}")
                    
                    # Get user's OneDrive root
                    drive_info = self._make_graph_request("https://graph.microsoft.com/v1.0/me/drive")
                    drive_id = drive_info['id']
                    
                    # List files in OneDrive root instead of searching
                    files_url = "https://graph.microsoft.com/v1.0/me/drive/root/children"
                    files_response = self._make_graph_request(files_url)
                    
                    # Look for Excel files by name
                    target_name = None
                    if 'name' in sharing_url.lower() or 'EVJlVID' in sharing_url:  # Part of your staff file URL
                        target_name = "Name List.xlsx"
                    elif 'asset' in sharing_url.lower() or 'EcE60Or' in sharing_url:  # Part of your asset file URL
                        target_name = "AssetList.xlsx"
                    
                    for file_item in files_response.get('value', []):
                        file_name = file_item.get('name', '')
                        if target_name and target_name.lower() in file_name.lower():
                            item_id = file_item['id']
                            logger.info(f"Found target file: {file_name}")
                            return drive_id, item_id
                        elif file_name.endswith('.xlsx'):
                            # Fallback to any Excel file
                            item_id = file_item['id']
                            logger.info(f"Using Excel file: {file_name}")
                            return drive_id, item_id
                    
                    raise Exception("No suitable Excel files found in OneDrive root")
                    
                except Exception as onedrive_error:
                    logger.error(f"OneDrive access failed: {str(onedrive_error)}")
                    raise Exception(f"Cannot access OneDrive files: {str(onedrive_error)}")
                    
        except Exception as e:
            logger.error(f"All methods failed to resolve sharing URL: {str(e)}")
            raise Exception(f"Could not access SharePoint file: {str(e)}")
    
    def _read_excel_workbook(self, drive_id: str, item_id: str, sheet_name: str = None) -> List[List]:
        """Read Excel workbook data from SharePoint"""
        try:
            # Get workbook worksheets
            worksheets_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/items/{item_id}/workbook/worksheets"
            worksheets = self._make_graph_request(worksheets_url)
            
            # Use specified sheet name or first sheet
            if sheet_name:
                sheet_id = sheet_name
            else:
                if worksheets.get('value'):
                    sheet_id = worksheets['value'][0]['name']
                else:
                    raise Exception("No worksheets found in the workbook")
            
            # Get used range from the worksheet
            used_range_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/items/{item_id}/workbook/worksheets/{sheet_id}/usedRange"
            range_data = self._make_graph_request(used_range_url)
            
            if 'values' in range_data:
                return range_data['values']
            else:
                logger.warning("No data found in the worksheet")
                return []
                
        except Exception as e:
            logger.error(f"Failed to read Excel workbook: {str(e)}")
            raise Exception(f"Could not read Excel data: {str(e)}")
    
    def get_staff_data(self) -> List[Dict[str, str]]:
        """Get staff data with employee numbers from SharePoint Excel file"""
        try:
            drive_id, item_id = self._resolve_sharing_url_to_item_id(self.staff_file_url)
            excel_data = self._read_excel_workbook(drive_id, item_id)
            
            if not excel_data or len(excel_data) < 2:
                raise Exception("Staff file must have at least a header row and one data row")
            
            # Assume first row contains headers
            headers = [str(cell).strip().lower() if cell else '' for cell in excel_data[0]]
            
            # Find name and employee number columns
            name_col = None
            number_col = None
            
            for i, header in enumerate(headers):
                if 'name' in header and 'employee' not in header:
                    name_col = i
                elif 'number' in header or 'employee' in header or 'emp' in header:
                    number_col = i
            
            # Fallback: assume first column is names, second is numbers
            if name_col is None:
                name_col = 0
            if number_col is None and len(headers) > 1:
                number_col = 1
            
            if number_col is None:
                raise Exception("Could not find Employee Number column in staff file")
            
            # Extract staff data
            staff_data = []
            for row in excel_data[1:]:  # Skip header row
                if row and len(row) > max(name_col, number_col):
                    name = str(row[name_col]).strip() if row[name_col] else ''
                    emp_number = str(row[number_col]).strip() if row[number_col] else ''
                    
                    if name and emp_number:
                        staff_data.append({
                            'name': name,
                            'employee_number': emp_number
                        })
            
            logger.info(f"Retrieved {len(staff_data)} staff members from SharePoint")
            return staff_data
            
        except Exception as e:
            logger.error(f"Failed to get staff data: {str(e)}")
            raise Exception(f"Could not retrieve staff data from SharePoint: {str(e)}")
    
    def get_asset_data(self) -> List[Dict[str, str]]:
        """Get machine asset data from SharePoint Excel file"""
        try:
            drive_id, item_id = self._resolve_sharing_url_to_item_id(self.asset_file_url)
            excel_data = self._read_excel_workbook(drive_id, item_id)
            
            if not excel_data or len(excel_data) < 2:
                raise Exception("Asset file must have at least a header row and one data row")
            
            # Assume first row contains headers
            headers = [str(cell).strip().lower() if cell else '' for cell in excel_data[0]]
            
            # Find make and model columns
            make_col = None
            model_col = None
            
            for i, header in enumerate(headers):
                if 'make' in header:
                    make_col = i
                elif 'model' in header or 'name' in header:
                    model_col = i
            
            if make_col is None or model_col is None:
                raise Exception("Could not find Make and Model/Name columns in asset file")
            
            # Extract asset data
            assets = []
            for row in excel_data[1:]:  # Skip header row
                if row and len(row) > max(make_col, model_col):
                    make = str(row[make_col]).strip() if row[make_col] else ''
                    model = str(row[model_col]).strip() if row[model_col] else ''
                    
                    if make and model:  # Only include rows with both make and model
                        assets.append({
                            'make': make,
                            'model': model
                        })
            
            logger.info(f"Retrieved {len(assets)} assets from SharePoint")
            return assets
            
        except Exception as e:
            logger.error(f"Failed to get asset data: {str(e)}")
            raise Exception(f"Could not retrieve asset data from SharePoint: {str(e)}")

    def get_checklist_data(self, checklist_type: str) -> List[Dict[str, str]]:
        """Get checklist items from SharePoint Excel file based on type"""
        try:
            # Map checklist type to file name to search for
            file_mapping = {
                'daily_check': 'Daily_Check_Checklist.xlsx',
                'grader_startup': 'Grader_Startup_Checklist.xlsx', 
                'workshop_service': 'Workshop_Service_Tasks.xlsx'
            }
            
            if checklist_type not in file_mapping:
                raise Exception(f"Unknown checklist type: {checklist_type}")
            
            target_filename = file_mapping[checklist_type]
            
            # Search for the checklist file in OneDrive
            user_info = self._make_graph_request("https://graph.microsoft.com/v1.0/me")
            drive_info = self._make_graph_request("https://graph.microsoft.com/v1.0/me/drive")
            drive_id = drive_info['id']
            
            # List files in OneDrive root to find checklist files
            files_url = "https://graph.microsoft.com/v1.0/me/drive/root/children"
            files_response = self._make_graph_request(files_url)
            
            # Find the specific checklist file
            item_id = None
            for file_item in files_response.get('value', []):
                if target_filename.lower() in file_item.get('name', '').lower():
                    item_id = file_item['id']
                    logger.info(f"Found checklist file: {file_item['name']}")
                    break
            
            if not item_id:
                raise Exception(f"Checklist file '{target_filename}' not found in OneDrive")
            
            # Read the Excel file
            excel_data = self._read_excel_workbook(drive_id, item_id)
            
            if not excel_data or len(excel_data) < 2:
                raise Exception("Checklist file must have at least a header row and one data row")
            
            # Assume first row contains headers
            headers = [str(cell).strip().lower() if cell else '' for cell in excel_data[0]]
            
            # Find required columns
            item_col = None
            category_col = None
            critical_col = None
            
            for i, header in enumerate(headers):
                if 'item' in header or 'task' in header:
                    item_col = i
                elif 'category' in header:
                    category_col = i
                elif 'critical' in header or 'common' in header:
                    critical_col = i
            
            if item_col is None:
                raise Exception("Could not find Item/Task column in checklist file")
            
            # Extract checklist items
            items = []
            for row in excel_data[1:]:  # Skip header row
                if row and len(row) > item_col and row[item_col]:
                    item_text = str(row[item_col]).strip()
                    category = str(row[category_col]).strip() if category_col is not None and len(row) > category_col and row[category_col] else 'General'
                    is_critical = str(row[critical_col]).strip().lower() in ['yes', 'true', '1'] if critical_col is not None and len(row) > critical_col and row[critical_col] else False
                    
                    if item_text:
                        items.append({
                            'item': item_text,
                            'category': category,
                            'critical': is_critical
                        })
            
            logger.info(f"Retrieved {len(items)} checklist items for {checklist_type} from SharePoint")
            return items
            
        except Exception as e:
            logger.error(f"Failed to get checklist data for {checklist_type}: {str(e)}")
            raise Exception(f"Could not retrieve checklist data from SharePoint: {str(e)}")
    
    def test_connection(self) -> Dict[str, str]:
        """Test connection to SharePoint and return file information"""
        try:
            results = {}
            
            # Test staff file
            try:
                drive_id, item_id = self._resolve_sharing_url_to_item_id(self.staff_file_url)
                # Get file info
                file_info_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/items/{item_id}"
                file_info = self._make_graph_request(file_info_url)
                
                results['staff_file'] = {
                    'name': file_info.get('name', 'Unknown'),
                    'size': file_info.get('size', 0),
                    'last_modified': file_info.get('lastModifiedDateTime', 'Unknown'),
                    'status': 'accessible'
                }
            except Exception as e:
                results['staff_file'] = {'status': 'error', 'message': str(e)}
            
            # Test asset file
            try:
                drive_id, item_id = self._resolve_sharing_url_to_item_id(self.asset_file_url)
                # Get file info
                file_info_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/items/{item_id}"
                file_info = self._make_graph_request(file_info_url)
                
                results['asset_file'] = {
                    'name': file_info.get('name', 'Unknown'),
                    'size': file_info.get('size', 0),
                    'last_modified': file_info.get('lastModifiedDateTime', 'Unknown'),
                    'status': 'accessible'
                }
            except Exception as e:
                results['asset_file'] = {'status': 'error', 'message': str(e)}
            
            return results
            
        except Exception as e:
            logger.error(f"Connection test failed: {str(e)}")
            return {'error': str(e)}

# Global instance
sharepoint_integration = SharePointExcelIntegration()