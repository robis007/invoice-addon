# InvoiceFly — Setup Guide

## Step 1: Create Google Cloud Project

1. Go to https://console.cloud.google.com
2. Click "Select Project" → "New Project"
3. Name: `InvoiceFly` (or whatever you prefer)
4. Click "Create"

## Step 2: Enable APIs

In the Google Cloud Console, go to **APIs & Services → Library** and enable:

- ✅ Gmail API
- ✅ Google Docs API
- ✅ Google Drive API
- ✅ Google Sheets API
- ✅ Apps Script API

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Choose **External** (for marketplace distribution)
3. Fill in:
   - App name: `InvoiceFly`
   - User support email: your email
   - Developer contact: your email
4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.labels`
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/documents`
   - `https://www.googleapis.com/auth/drive.file`
5. Save

## Step 4: Create Apps Script Project

1. Go to https://script.google.com
2. Click "New Project"
3. Name it "InvoiceFly"
4. Copy the `.gs` files from `src/addon/` into the Apps Script editor:
   - `Main.gs`
   - `Parser.gs`
   - `Invoice.gs`
   - `Settings.gs`
5. Copy `config/appsscript.json` → click ⚙️ gear icon → check "Show appsscript.json" → replace content

## Step 5: Link to GCP Project

1. In Apps Script editor, go to **Project Settings** (⚙️)
2. Under "Google Cloud Platform (GCP) Project", click "Change project"
3. Enter your GCP project number (found in GCP Console → Dashboard)

## Step 6: Test Deploy

1. In Apps Script, click **Deploy → Test deployments**
2. Select "Gmail Add-on"
3. Click "Execute"
4. Open Gmail — you should see InvoiceFly in the sidebar

## Step 7: Backend (Cloud Run) — Coming Soon

The AI parsing backend will be deployed to Cloud Run.
Configuration will be added to Settings within the add-on.

## Step 8: Marketplace Publishing — Coming Later

After testing, we'll submit to the Google Workspace Marketplace.
