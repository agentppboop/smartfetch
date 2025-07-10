import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Validate required environment variables
function validateEnvVars() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!sheetId) {
    throw new Error('GOOGLE_SHEET_ID environment variable is required');
  }

  if (!clientEmail) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL environment variable is required');
  }

  if (!privateKey) {
    throw new Error('GOOGLE_PRIVATE_KEY environment variable is required');
  }

  return { sheetId, clientEmail, privateKey };
}

export async function getSheetData() {
  try {
    // Validate and get environment variables
    const { sheetId, clientEmail, privateKey } = validateEnvVars();

    // Clean the private key - remove quotes and ensure proper formatting
    const cleanPrivateKey = privateKey
      .replace(/\\n/g, '\n')
      .replace(/"/g, '')
      .trim();

    // Ensure the key has proper headers
    const formattedKey = cleanPrivateKey.startsWith('-----BEGIN PRIVATE KEY-----') 
      ? cleanPrivateKey 
      : `-----BEGIN PRIVATE KEY-----\n${cleanPrivateKey}\n-----END PRIVATE KEY-----`;

    // Create JWT auth object
    const serviceAccountAuth = new JWT({
      email: clientEmail,
      key: formattedKey,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ],
    });

    // Initialize Google Spreadsheet with auth
    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);

    await doc.loadInfo(); // loads doc properties + sheet metadata
    const sheet = doc.sheetsByIndex[0]; // use your desired sheet index or name
    
    if (!sheet) {
      throw new Error('No sheets found in the Google Spreadsheet');
    }

    const rows = await sheet.getRows(); // read all rows

    return rows.map((row) => row.toObject()); // convert to plain JSON
  } catch (error) {
    console.error('❌ Error fetching sheet data:', error);
    
    // Only log private key preview if it exists (for debugging)
    if (process.env.GOOGLE_PRIVATE_KEY) {
      console.error('Private key preview:', process.env.GOOGLE_PRIVATE_KEY.substring(0, 50) + '...');
    }
    
    throw error;
  }
}