# InvoiceFly — Complete Setup Guide

## Step 1: Create Google Cloud Project

1. Go to https://console.cloud.google.com
2. Click **Select Project** → **New Project**
3. Name: `InvoiceFly` (or whatever you prefer)
4. Click **Create**
5. Note the **Project Number** (shown on the dashboard) — you'll need it later

## Step 2: Enable APIs

In the Google Cloud Console, go to **APIs & Services → Library** and enable these:

- ✅ Gmail API
- ✅ Google Docs API
- ✅ Google Drive API
- ✅ Google Sheets API
- ✅ Apps Script API

Search for each one and click **Enable**.

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Choose **External** (required for marketplace distribution later)
3. Fill in:
   - **App name:** `InvoiceFly`
   - **User support email:** your email
   - **App logo:** optional for now
   - **Developer contact:** your email
4. Click **Save and Continue**
5. On the **Scopes** page, click **Add or Remove Scopes** and add:
   ```
   https://www.googleapis.com/auth/gmail.addons.execute
   https://www.googleapis.com/auth/gmail.addons.current.message.readonly
   https://www.googleapis.com/auth/gmail.readonly
   https://www.googleapis.com/auth/gmail.labels
   https://www.googleapis.com/auth/gmail.modify
   https://www.googleapis.com/auth/gmail.send
   https://www.googleapis.com/auth/documents
   https://www.googleapis.com/auth/drive
   https://www.googleapis.com/auth/drive.file
   https://www.googleapis.com/auth/spreadsheets
   ```
6. Click **Save and Continue**
7. On the **Test users** page, click **+ Add Users**
8. Add your Gmail address (the account you'll test with)
9. Click **Save and Continue**

> ⚠️ Without adding yourself as a test user, you'll get a `403 access_denied` error.

## Step 4: Create Apps Script Project

1. Go to https://script.google.com
2. Click **New Project**
3. Rename it to `InvoiceFly` (click "Untitled project" at the top)

### 4a. Add the source files

Create each file in the Apps Script editor (click **+** next to Files → **Script**):

| File name | Source |
|-----------|--------|
| `Main` | `src/addon/Main.gs` |
| `Parser` | `src/addon/Parser.gs` |
| `Invoice` | `src/addon/Invoice.gs` |
| `Settings` | `src/addon/Settings.gs` |
| `Tracker` | `src/addon/Tracker.gs` |
| `Dashboard` | `src/addon/Dashboard.gs` |
| `Recurring` | `src/addon/Recurring.gs` |
| `Labels` | `src/addon/Labels.gs` |

Delete the default `Code.gs` file after adding the others.

### 4b. Update the manifest

1. Click ⚙️ **Project Settings** (gear icon)
2. Check **"Show appsscript.json manifest file in editor"**
3. Go back to the editor — you'll see `appsscript.json`
4. Replace its entire contents with the file from `config/appsscript.json`
5. Save (Ctrl+S)

## Step 5: Link to GCP Project

1. In Apps Script, go to ⚙️ **Project Settings**
2. Scroll to **Google Cloud Platform (GCP) Project**
3. Click **Change project**
4. Enter your **GCP project number** (from Step 1)
5. Click **Set project**

> This links the add-on to your Cloud project so it can use the enabled APIs.

## Step 6: Create the Invoice Template

The add-on generates invoices by copying a Google Docs template and filling in placeholders.

### 6a. Create the template document

1. Open [Google Docs](https://docs.google.com) and create a new document
2. Name it `InvoiceFly — Invoice Template`
3. Design your invoice layout with these **placeholders** (the add-on replaces them):

```
                        INVOICE

Invoice #: {{INVOICE_NUMBER}}
Date: {{DATE}}

FROM:
{{BUSINESS_NAME}}
{{BUSINESS_EMAIL}}
{{BUSINESS_ADDRESS}}
VAT: {{TAX_ID}}

BILL TO:
{{CLIENT_NAME}}
{{CLIENT_EMAIL}}
{{CLIENT_ADDRESS}}

─────────────────────────────────────────

ITEMS:
{{ITEMS}}

─────────────────────────────────────────

Subtotal:    {{CURRENCY}} {{SUBTOTAL}}
Tax:         {{CURRENCY}} {{TAX}}
TOTAL:       {{CURRENCY}} {{TOTAL}}

─────────────────────────────────────────

{{NOTES}}
```

4. Style it however you like — fonts, colors, logo, etc. The placeholders will be replaced with real data.
5. Save the document

### 6b. Get the template Doc ID

The Doc ID is in the URL of your template document:
```
https://docs.google.com/document/d/THIS_IS_THE_DOC_ID/edit
```
Copy everything between `/d/` and `/edit`.

### 6c. Create an invoice folder (optional but recommended)

1. Open [Google Drive](https://drive.google.com)
2. Create a new folder called `InvoiceFly Invoices`
3. Open the folder
4. Copy the **Folder ID** from the URL:
```
https://drive.google.com/drive/folders/THIS_IS_THE_FOLDER_ID
```

## Step 7: Configure Settings in the Add-on

After the test deployment (Step 8), open the add-on in Gmail and go to **Settings** (⚙️). Fill in:

### Business Info
| Setting | Example |
|---------|---------|
| Business Name | `Your Business Name` |
| Business Email | `info@yourbusiness.com` |
| Business Address | `123 Street, Vilnius, Lithuania` |
| Tax / VAT ID | `LT123456789` |

### Invoice Defaults
| Setting | Example |
|---------|---------|
| Default Currency | `EUR` |
| Default Tax Rate | `21` (for Lithuania VAT) |
| Payment Terms | `14` (days) |

### Connections
| Setting | Value |
|---------|-------|
| Backend URL | Leave empty for now (uses fallback parser) |
| Invoice Template | Paste the **Doc ID** from Step 6b |
| Invoice Folder | Paste the **Folder ID** from Step 6c |
| Invoice Tracker | Leave empty — auto-created on first invoice |

> 💡 The tracker spreadsheet is auto-created when you generate your first invoice. You can also create one manually and paste its Sheet ID here.

## Step 8: Test Deploy

1. In Apps Script, click **Deploy → Test deployments**
2. Click **Install** next to "Gmail Add-on"
3. A consent screen will appear:
   - Click **Advanced** → **Go to InvoiceFly (unsafe)**
   - Review and **Allow** all permissions
4. Open Gmail (or refresh if already open)
5. Look for the InvoiceFly icon in the **right sidebar**
6. Open any email — the contextual trigger will show parsing options

### Troubleshooting

| Problem | Solution |
|---------|----------|
| `403 access_denied` | Add yourself as a test user (Step 3, point 7-8) |
| `gmail.addons.execute` error | Make sure `appsscript.json` has all the scopes listed in Step 3 |
| Add-on not visible in Gmail | Uninstall and reinstall the test deployment |
| "This app isn't verified" | Normal for test mode — click Advanced → Go to InvoiceFly |
| Blank sidebar | Check Apps Script Executions log for errors |

## Step 9: Deploy Backend to Cloud Run (Optional)

The AI-powered email parser runs on Cloud Run. Without it, the add-on uses a basic regex fallback parser.

### 9a. Install Google Cloud CLI

```bash
# If not already installed
curl https://sdk.cloud.google.com | bash
gcloud init
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### 9b. Enable Cloud Run

```bash
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### 9c. Deploy

```bash
cd backend/

# Build and deploy in one step
gcloud run deploy invoicefly-backend \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars "GCP_PROJECT_ID=YOUR_PROJECT_ID,GCP_LOCATION=europe-west1"
```

### 9d. Connect to add-on

1. Copy the Cloud Run URL from the deploy output (e.g. `https://invoicefly-backend-xxxxx-ew.a.run.app`)
2. In Gmail → InvoiceFly → Settings → **Backend URL** → paste the URL
3. Save

Now email parsing will use Gemini AI instead of the basic regex fallback.

## Step 10: Marketplace Publishing (Later)

Once the add-on is tested and stable:

1. Go to **Google Cloud Console → APIs & Services → OAuth consent screen**
2. Click **Publish App** to move from Testing to Production
3. Submit for Google verification (required for sensitive scopes)
4. Go to https://console.cloud.google.com/apis/api/appsmarket-component.googleapis.com
5. Enable **Google Workspace Marketplace SDK**
6. Configure listing: description, screenshots, pricing
7. Submit for review

> Google verification can take days to weeks. Plan accordingly.

---

## File Structure Reference

```
invoice-addon/
├── config/
│   └── appsscript.json          ← Manifest (copy to Apps Script)
├── src/
│   ├── addon/
│   │   ├── Main.gs              ← Entry points, homepage, contextual trigger
│   │   ├── Parser.gs            ← Email parsing UI + backend calls
│   │   ├── Invoice.gs           ← Invoice generation from templates
│   │   ├── Settings.gs          ← Configuration UI
│   │   ├── Tracker.gs           ← Invoice tracking spreadsheet
│   │   ├── Dashboard.gs         ← Revenue dashboard + stats
│   │   ├── Recurring.gs         ← Recurring pattern detection
│   │   └── Labels.gs            ← Gmail auto-labeling
│   └── templates/
│       └── invoice-template.html ← HTML template for PDF/preview
├── backend/
│   ├── src/
│   │   ├── index.js             ← Express server
│   │   ├── routes/
│   │   │   ├── health.js        ← Health check endpoint
│   │   │   ├── parse.js         ← AI email parsing
│   │   │   ├── pdf.js           ← PDF generation
│   │   │   └── preview.js       ← HTML invoice preview
│   │   └── services/
│   │       ├── aiParser.js      ← Gemini AI + fallback parser
│   │       ├── pdfGenerator.js  ← PDFKit invoice generation
│   │       └── templateRenderer.js ← HTML template rendering
│   ├── test/
│   │   └── parse.test.js        ← Parser tests
│   ├── Dockerfile               ← Cloud Run container
│   ├── package.json
│   └── .env.example
├── sample-invoice.html          ← Sample rendered invoice
├── docs/
│   └── SETUP.md                 ← This file
├── .gitignore
└── README.md
```
