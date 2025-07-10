# SmartFetch 🎯

SmartFetch is an AI-powered dashboard that extracts and visualizes promo codes from YouTube videos.

---

## 🧠 Components

- `smartfetch/`: CLI scripts to:
  - Fetch video transcripts
  - Extract promo codes (AI post-processing)
  - Push results to Google Sheets
- `smartfetch-dashboard/`: Next.js frontend to:
  - Read from Google Sheet
  - Filter codes by confidence, recency, and availability
  - Show them in a responsive layout

---

## ⚙️ Environment Setup

Create `.env.local` in `smartfetch-dashboard/`:

```env
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
OPENAI_API_KEY=sk-...

🚀 Run Locally
Backend (Data Generation)
bash
node index.js      # or node syncToSheet.js
Frontend (Dashboard)
bash
cd smartfetch-dashboard
npm install
npm run dev