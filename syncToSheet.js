// syncToSheet.js - Enhanced Google Sheets sync with better error handling
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
require('dotenv').config();

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

// Cache the authenticated document to avoid re-authentication
let cachedDoc = null;
let cachedSheet = null;

async function getAuthenticatedSheet() {
    if (cachedDoc && cachedSheet) {
        return cachedSheet;
    }

    // Validate environment variables
    if (!SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
        throw new Error('Missing Google Sheets configuration. Check GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_PRIVATE_KEY environment variables.');
    }

    try {
        // Create JWT auth
        const serviceAccountAuth = new JWT({
            email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: GOOGLE_PRIVATE_KEY,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        cachedDoc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);
        await cachedDoc.loadInfo();
        
        cachedSheet = cachedDoc.sheetsByIndex[0];
        
        if (!cachedSheet) {
            throw new Error('No worksheets found in the Google Sheet');
        }

        console.log(`📊 Connected to sheet: "${cachedDoc.title}" (Worksheet: "${cachedSheet.title}")`);
        return cachedSheet;

    } catch (error) {
        // Clear cache on error
        cachedDoc = null;
        cachedSheet = null;
        throw error;
    }
}

async function ensureHeaders(sheet) {
    const expectedHeaders = [
        'sourceId', 'title', 'sourceUrl', 'subreddit', 'author', 
        'timestamp', 'upvotes', 'comments', 'links', 'codes', 
        'percent_off', 'flat_discount', 'confidence', 'status'
    ];

    try {
        // Load header row
        await sheet.loadHeaderRow();
        const existingHeaders = sheet.headerValues;

        // Check if we need to add headers
        const missingHeaders = expectedHeaders.filter(header => !existingHeaders.includes(header));
        
        if (missingHeaders.length > 0) {
            console.log(`📋 Adding missing headers: ${missingHeaders.join(', ')}`);
            
            // Set headers if sheet is empty or missing headers
            const allHeaders = [...new Set([...existingHeaders, ...expectedHeaders])];
            await sheet.setHeaderRow(allHeaders);
        }

    } catch (error) {
        console.log('📋 Setting up sheet headers...');
        await sheet.setHeaderRow(expectedHeaders);
    }
}

module.exports = async function syncToSheet(postData) {
    // Skip if Google Sheets not configured
    if (!SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
        console.log('⚠️ Google Sheets not configured, skipping sync');
        return false;
    }

    try {
        // Input validation
        if (!postData || !postData.sourceId) {
            throw new Error('Invalid postData: missing sourceId');
        }

        const sheet = await getAuthenticatedSheet();
        
        // Ensure headers are set up correctly
        await ensureHeaders(sheet);
        
        // Get existing rows to check for duplicates
        const rows = await sheet.getRows();
        
        // FIXED: Check for duplicates using 'sourceId' (not 'videoId')
        const alreadyExists = rows.some(row => row.get('sourceId') === postData.sourceId);

        if (alreadyExists) {
            console.log(`⏩ Skipping duplicate sourceId: ${postData.sourceId}`);
            return false;
        }

        // Prepare row data with safe array/value handling
        const rowData = {
            sourceId: postData.sourceId,
            title: postData.title || 'N/A',
            sourceUrl: postData.sourceUrl || '',
            subreddit: postData.subreddit || '',
            author: postData.author || '',
            timestamp: postData.timestamp || new Date().toISOString(),
            upvotes: postData.upvotes || 0,
            comments: postData.comments || 0,
            links: Array.isArray(postData.links) ? postData.links.join(' | ') : (postData.links || ''),
            codes: Array.isArray(postData.codes) ? postData.codes.join(' | ') : (postData.codes || ''),
            percent_off: Array.isArray(postData.percent_off) ? postData.percent_off.join(', ') : (postData.percent_off || ''),
            flat_discount: Array.isArray(postData.flat_discount) ? postData.flat_discount.join(', ') : (postData.flat_discount || ''),
            confidence: postData.confidence || 0,
            status: 'active'
        };

        // Add the row
        await sheet.addRow(rowData);
        
        console.log(`✅ Synced to Google Sheet: ${postData.sourceId} (${postData.codes?.length || 0} codes)`);
        return true;

    } catch (error) {
        console.error(`❌ Google Sheets Sync Error for ${postData?.sourceId || 'unknown'}:`, error.message);
        
        // Clear cache on authentication errors
        if (error.message.includes('authentication') || error.message.includes('access') || error.message.includes('permission')) {
            cachedDoc = null;
            cachedSheet = null;
            
            console.error('🔐 Authentication issue detected. Clearing cache.');
            console.error('Troubleshooting tips:');
            console.error('1. Check your GOOGLE_SERVICE_ACCOUNT_EMAIL');
            console.error('2. Verify GOOGLE_PRIVATE_KEY is properly formatted');
            console.error('3. Ensure the service account has edit access to the sheet');
            console.error('4. Confirm GOOGLE_SHEET_ID is correct');
        }
        
        // Re-throw to let calling code handle the error
        throw error;
    }
};

// Helper function to test the Google Sheets connection
async function testConnection() {
    console.log('🧪 Testing Google Sheets connection...');
    
    try {
        const sheet = await getAuthenticatedSheet();
        await ensureHeaders(sheet);
        
        console.log('✅ Google Sheets connection successful!');
        console.log(`📊 Sheet: "${cachedDoc.title}"`);
        console.log(`📋 Worksheet: "${sheet.title}"`);
        console.log(`📏 Rows: ${sheet.rowCount}, Columns: ${sheet.columnCount}`);
        
        return true;
    } catch (error) {
        console.error('❌ Google Sheets connection failed:', error.message);
        return false;
    }
}

// Export the test function for debugging
module.exports.testConnection = testConnection;

// Allow running this file directly to test the connection
if (require.main === module) {
    testConnection();
}