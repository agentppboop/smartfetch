// syncToSheet.js - COMPLETE CORRECTED VERSION

const { GoogleSpreadsheet } = require('google-spreadsheet');
require('dotenv').config();

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

module.exports = async function syncToSheet(videoData) {
    // Skip if Google Sheets not configured
    if (!SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
        console.log('⚠️ Google Sheets not configured, skipping sync');
        return;
    }

    try {
        // Input validation
        if (!videoData || !videoData.videoId) {
            throw new Error('Invalid videoData: missing videoId');
        }

        const doc = new GoogleSpreadsheet(SHEET_ID);

        await doc.useServiceAccountAuth({
            client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: GOOGLE_PRIVATE_KEY
        });

        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();

        // Check for duplicates
        const alreadyExists = rows.some(row => row.videoId === videoData.videoId);

        if (alreadyExists) {
            console.log(`⏩ Skipping duplicate videoId in Google Sheet: ${videoData.videoId}`);
            return;
        } // ← ADD THIS MISSING CLOSING BRACE

        // Add new row
        await sheet.addRow({
            videoId: videoData.videoId,
            videoTitle: videoData.videoTitle || 'N/A',
            timestamp: videoData.timestamp || new Date().toISOString(),
            links: Array.isArray(videoData.links) ? videoData.links.join(' | ') : '',
            codes: Array.isArray(videoData.codes) ? videoData.codes.join(' | ') : ''
        });

        console.log(`✅ Synced to Google Sheet: ${videoData.videoId}`);

    } catch (err) {
        console.error("❌ Google Sheets Sync Error:", err.message);
        throw err;
    }
};
