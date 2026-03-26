# InvoiceFly — Gmail Add-on for Small Business Invoicing

Turn emails into invoices with one click. AI-powered parsing extracts client info, items, prices, and generates professional invoices — all from your Gmail sidebar.

## Features (Planned)

- 📧 AI-powered email parsing (orders, quotes, conversations)
- 🧾 One-click invoice generation (PDF + Google Docs)
- 📊 Simple income tracking dashboard
- 🏷️ Auto-labeling of Gmail threads
- 🔁 Recurring invoice detection
- 🌍 Multi-currency + tax support

## Tech Stack

- Google Workspace Add-on (Gmail sidebar)
- Google Apps Script (add-on UI + triggers)
- Cloud Run backend (Node.js — AI parsing + PDF generation)
- Gemini API (email content extraction)
- Google Docs (invoice templates)

## Project Structure

```
invoice-addon/
├── src/
│   ├── addon/        # Apps Script code (sidebar UI, triggers)
│   ├── parser/       # AI email parsing logic
│   ├── templates/    # Invoice templates
│   └── utils/        # Shared utilities
├── config/           # OAuth, manifest, deployment configs
├── docs/             # Documentation
├── test/             # Tests
└── README.md
```

## Setup

See docs/SETUP.md for Google Cloud project configuration.
