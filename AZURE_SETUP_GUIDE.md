# Azure App Registration Setup Guide for SharePoint Excel Integration

## Step 1: Access Azure Portal
1. Go to https://portal.azure.com
2. Sign in with your Microsoft 365 account (matt@abrey-farms.co.uk)
3. If you don't see "Azure Active Directory", search for it in the search bar

## Step 2: Create App Registration
1. Click on **Azure Active Directory** (or **Microsoft Entra ID**)
2. In the left menu, click **App registrations**
3. Click **+ New registration**

## Step 3: Configure the App
**Fill out these details:**
- **Name**: `Abreys Machine Checklist App`
- **Supported account types**: Select "Accounts in this organizational directory only"
- **Redirect URI**: Select "Web" and enter: `https://checklist-capture.preview.emergentagent.com/auth/callback`

Click **Register**

## Step 4: Get Important IDs (Save These!)
After registration, you'll see:
- **Application (client) ID**: Copy this - we need it!
- **Directory (tenant) ID**: Copy this too!

## Step 5: Create Client Secret
1. In the left menu, click **Certificates & secrets**
2. Click **+ New client secret**
3. Description: `Machine Checklist Secret`
4. Expires: Choose "12 months" or "24 months"
5. Click **Add**
6. **IMPORTANT**: Copy the secret VALUE immediately (it won't show again!)

## Step 6: Set API Permissions
1. In the left menu, click **API permissions**
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Find and check these permissions:
   - `Files.Read`
   - `Files.ReadWrite`
   - `Sites.Read.All`
   - `User.Read`
6. Click **Add permissions**
7. Click **Grant admin consent for [your organization]** (if available)

## What You Need to Send Me:
After completing the above steps, please share:
1. **Application (client) ID**: (looks like: 12345678-1234-1234-1234-123456789012)
2. **Directory (tenant) ID**: (looks like: 87654321-4321-4321-4321-210987654321)  
3. **Client Secret**: (the secret value you copied)

**Keep these safe and secure!**

## Next Steps:
Once you provide these credentials, I'll:
1. Implement the SharePoint integration
2. Set up automatic syncing with your Excel files
3. Add a "Sync Data" button to your app
4. Test the connection with your actual files

The integration will allow your machine checklist app to automatically pull staff names and machine data from your SharePoint Excel files!