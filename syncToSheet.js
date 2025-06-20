// syncToSheet.js - UPDATED FOR LATEST google-spreadsheet VERSION

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
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

        console.log('🔗 Connecting to Google Sheets...');

        // Create JWT auth
        const serviceAccountAuth = new JWT({
            email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: GOOGLE_PRIVATE_KEY,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);

        await doc.loadInfo();
        console.log(`📊 Connected to sheet: ${doc.title}`);
        
        const sheet = doc.sheetsByIndex[0];
        
        // Get existing rows
        const rows = await sheet.getRows();

        // Check for duplicates
        const alreadyExists = rows.some(row => row.get('videoId') === videoData.videoId);

        if (alreadyExists) {
            console.log(`⏩ Skipping duplicate videoId in Google Sheet: ${videoData.videoId}`);
            return;
        }

        // Add new row
        await sheet.addRow({
            videoId: videoData.videoId,
            videoTitle: videoData.videoTitle || 'N/A',
            timestamp: videoData.timestamp || new Date().toISOString(),
            links: Array.isArray(videoData.links) ? videoData.links.join(' | ') : '',
            codes: Array.isArray(videoData.codes) ? videoData.codes.join(' | ') : '',
            percent_off: Array.isArray(videoData.percent_off) ? videoData.percent_off.join(', ') : '',
            flat_discount: Array.isArray(videoData.flat_discount) ? videoData.flat_discount.join(', ') : '',
            confidence: videoData.confidence || 0
        });

        console.log(`✅ Synced to Google Sheet: ${videoData.videoId}`);

    } catch (err) {
        console.error("❌ Google Sheets Sync Error:", err.message);
        
        // Handle specific error types
        if (err.message.includes('No access')) {
            console.error('Authentication failed. Check your service account credentials.');
        } else if (err.message.includes('not found')) {
            console.error('Sheet not found. Check your GOOGLE_SHEET_ID.');
        } else if (err.message.includes('permission')) {
            console.error('Permission denied. Make sure the service account has access to the sheet.');
        }
        
        throw err;
    }
};
