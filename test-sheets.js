// test-sheets.js - Diagnostic test

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
require('dotenv').config();

async function testSheetAccess() {
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;
    const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    console.log('🔍 Testing Google Sheets connection...');
    console.log('📋 Sheet ID:', SHEET_ID);
    console.log('📧 Service Account:', GOOGLE_SERVICE_ACCOUNT_EMAIL);
    console.log('🔑 Private Key starts with:', GOOGLE_PRIVATE_KEY ? GOOGLE_PRIVATE_KEY.substring(0, 50) + '...' : 'Not found');

    if (!SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
        console.error('❌ Missing required environment variables');
        return;
    }

    try {
        const serviceAccountAuth = new JWT({
            email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: GOOGLE_PRIVATE_KEY,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        console.log('🔗 Creating connection...');
        const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);

        console.log('📊 Loading sheet info...');
        await doc.loadInfo();

        console.log('✅ SUCCESS! Connected to sheet:', doc.title);
        console.log('📄 Number of sheets:', doc.sheetCount);
        console.log('📋 First sheet title:', doc.sheetsByIndex[0].title);

    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.error('🔍 Full error:', error);
        
        if (error.message.includes('404')) {
            console.error('💡 SOLUTION: Sheet not found or service account lacks access');
            console.error('   1. Check if Sheet ID is correct');
            console.error('   2. Make sure you shared the sheet with your service account');
        } else if (error.message.includes('403')) {
            console.error('💡 SOLUTION: Access denied');
            console.error('   1. Share the sheet with your service account email');
            console.error('   2. Give it Editor permissions');
        }
    }
}

testSheetAccess();
