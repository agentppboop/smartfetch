const { GoogleSpreadsheet } = require('google-spreadsheet');
require('dotenv').config();

const doc = new GoogleSpreadsheet(process.env.SHEET_ID);

async function syncToSheet(videoData) {
  try {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });

    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0]; // First sheet

    await sheet.addRow({
      videoId: videoData.videoId,
      videoTitle: videoData.videoTitle,
      timestamp: videoData.timestamp,
      links: videoData.links.join(' | '),
      codes: videoData.codes.join(' | ')
    });

    console.log("🟢 Synced to Google Sheet.");
  } catch (err) {
    console.error("❌ Google Sheets Sync Failed:", err.message);
  }
}

module.exports = syncToSheet;
