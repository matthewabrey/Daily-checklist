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
        self.redirect_uri = os.environ.get('AZURE_REDIRECT_URI', 'https://startup-verify-1.preview.emergentagent.com/auth/callback')
        
        # SharePoint file URLs (your actual files)
        self.staff_file_url = "https://rgafarms-my.sharepoint.com/:x:/g/personal/matt_abrey-farms_co_uk/EVJlVIDkvf9Po1vj5SmNGGcBeiFhLR4uYeJXH-Jrr9XCeQ?e=XjybDY"
        self.asset_file_url = "https://rgafarms-my.sharepoint.com/:x:/g/personal/matt_abrey-farms_co_uk/EcE60OrrIiZEgesXpn83UPsBDq28FtRkh5eT2BSt4tTqnA?e=OPadb1"
        
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
        """Convert sharing URL to actual SharePoint item ID and drive ID"""
        try:
            site_url, site_path, sharing_item_id = self._parse_sharepoint_sharing_url(sharing_url)
            site_id, drive_id = self._get_site_and_drive_info(site_url, site_path)
            
            # Search for the file in the drive
            # Since we have the sharing URL, we can try to resolve it directly
            sharing_api_url = f"https://graph.microsoft.com/v1.0/shares/{sharing_item_id}"
            
            try:
                share_info = self._make_graph_request(sharing_api_url)
                if 'remoteItem' in share_info:
                    item_id = share_info['remoteItem']['id']
                    drive_id = share_info['remoteItem']['parentReference']['driveId']
                elif 'id' in share_info:
                    item_id = share_info['id']
                else:
                    raise Exception("Could not resolve sharing URL to item ID")
                
                return drive_id, item_id
                
            except Exception as share_error:
                logger.warning(f"Direct sharing resolution failed: {str(share_error)}")
                # Fallback: search for Excel files in the drive
                search_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root/search(q='*.xlsx')"
                search_results = self._make_graph_request(search_url)
                
                if search_results.get('value'):
                    # Return the first Excel file found (this is a fallback)
                    item_id = search_results['value'][0]['id']
                    return drive_id, item_id
                else:
                    raise Exception("No Excel files found in the OneDrive")
                    
        except Exception as e:
            logger.error(f"Failed to resolve sharing URL: {str(e)}")
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
    
    def get_staff_data(self) -> List[str]:
        """Get staff names from SharePoint Excel file"""
        try:
            drive_id, item_id = self._resolve_sharing_url_to_item_id(self.staff_file_url)
            excel_data = self._read_excel_workbook(drive_id, item_id)
            
            # Extract staff names (assuming they're in the first column)
            staff_names = []
            for row in excel_data:
                if row and len(row) > 0 and row[0]:  # Check if first cell has data
                    name = str(row[0]).strip()
                    if name and name.lower() not in ['name', 'staff', 'employee']:  # Skip headers
                        staff_names.append(name)
            
            logger.info(f"Retrieved {len(staff_names)} staff names from SharePoint")
            return staff_names
            
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