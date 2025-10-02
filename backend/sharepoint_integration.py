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
        """Convert sharing URL to actual SharePoint item ID and drive ID using sharing token"""
        try:
            # Extract the sharing token from the URL
            # Format: https://domain/:x:/g/personal/user/TOKEN?e=ACCESS_KEY
            import base64
            from urllib.parse import quote
            
            # Create sharing token for Graph API
            # The sharing URL needs to be base64 encoded
            sharing_token = base64.urlsafe_b64encode(sharing_url.encode()).decode().rstrip('=')
            
            # Use the shares API to get file information
            shares_url = f"https://graph.microsoft.com/v1.0/shares/u!{sharing_token}"
            
            try:
                share_info = self._make_graph_request(shares_url)
                logger.info(f"Share info received: {share_info}")
                
                if 'remoteItem' in share_info:
                    # File is shared from another location
                    item_id = share_info['remoteItem']['id']
                    if 'parentReference' in share_info['remoteItem'] and 'driveId' in share_info['remoteItem']['parentReference']:
                        drive_id = share_info['remoteItem']['parentReference']['driveId']
                    else:
                        # Try to get drive ID from the share info
                        drive_id = share_info.get('remoteItem', {}).get('parentReference', {}).get('driveId')
                        if not drive_id:
                            raise Exception("Could not extract drive ID from share info")
                elif 'id' in share_info:
                    # Direct file share
                    item_id = share_info['id']
                    if 'parentReference' in share_info and 'driveId' in share_info['parentReference']:
                        drive_id = share_info['parentReference']['driveId']
                    else:
                        raise Exception("Could not extract drive ID from direct share")
                else:
                    raise Exception("Could not find file information in share response")
                
                logger.info(f"Successfully resolved: drive_id={drive_id}, item_id={item_id}")
                return drive_id, item_id
                
            except Exception as shares_error:
                logger.error(f"Shares API failed: {str(shares_error)}")
                
                # Alternative approach: try to extract IDs from the sharing URL path
                # SharePoint sharing URLs contain encoded information
                try:
                    # Parse the URL to extract the file identifier
                    from urllib.parse import urlparse, parse_qs
                    parsed_url = urlparse(sharing_url)
                    
                    # Extract the file ID from the path (after /g/)
                    path_parts = parsed_url.path.split('/g/')
                    if len(path_parts) > 1:
                        file_part = path_parts[1].split('/')[0]  # Get the part before any additional path
                        
                        # Try different encoding approaches for the file ID
                        try:
                            # Method 1: Direct base64 decode of the file part
                            decoded_bytes = base64.urlsafe_b64decode(file_part + '==')  # Add padding
                            # This might contain the actual file/drive IDs
                            logger.info(f"Decoded file part: {decoded_bytes}")
                        except Exception:
                            pass
                    
                    # If we can't resolve the sharing URL, we need to search the user's OneDrive
                    # Get the user's personal site and search for the files by name
                    user_info_url = "https://graph.microsoft.com/v1.0/me"
                    user_info = self._make_graph_request(user_info_url)
                    logger.info(f"User info: {user_info}")
                    
                    # Get user's OneDrive
                    drive_url = "https://graph.microsoft.com/v1.0/me/drive"
                    drive_info = self._make_graph_request(drive_url)
                    drive_id = drive_info['id']
                    logger.info(f"User's drive ID: {drive_id}")
                    
                    # Search for Excel files in the user's OneDrive
                    # Use a more specific search query
                    if 'name' in sharing_url.lower() or 'name%20list' in sharing_url.lower():
                        search_query = "Name List.xlsx"
                    elif 'asset' in sharing_url.lower():
                        search_query = "AssetList.xlsx"
                    else:
                        search_query = "*.xlsx"
                    
                    search_url = f"https://graph.microsoft.com/v1.0/me/drive/root/search(q='{search_query}')"
                    search_results = self._make_graph_request(search_url)
                    
                    if search_results.get('value'):
                        # Find the most likely file based on the sharing URL
                        for file_item in search_results['value']:
                            file_name = file_item.get('name', '').lower()
                            if ('name' in sharing_url.lower() and 'name' in file_name) or \
                               ('asset' in sharing_url.lower() and 'asset' in file_name):
                                item_id = file_item['id']
                                logger.info(f"Found matching file: {file_item['name']} with ID: {item_id}")
                                return drive_id, item_id
                        
                        # If no specific match, return the first Excel file
                        item_id = search_results['value'][0]['id']
                        logger.info(f"Using first Excel file: {search_results['value'][0]['name']}")
                        return drive_id, item_id
                    else:
                        raise Exception("No Excel files found in user's OneDrive")
                        
                except Exception as fallback_error:
                    logger.error(f"Fallback method failed: {str(fallback_error)}")
                    raise Exception(f"Could not resolve sharing URL using any method: {str(fallback_error)}")
                    
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