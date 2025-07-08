import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const sheetId = process.env.GOOGLE_SHEET_ID!;
const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, '')!;

export async function getSheetData() {
  try {
    // Clean the private key - remove quotes and ensure proper formatting
    const cleanPrivateKey = privateKey
      .replace(/\\n/g, '\n')
      .replace(/"/g, '')
      .trim();

    // Ensure the key has proper headers
    const formattedKey = cleanPrivateKey.startsWith('-----BEGIN PRIVATE KEY-----') 
      ? cleanPrivateKey 
      : `-----BEGIN PRIVATE KEY-----\n${cleanPrivateKey}\n-----END PRIVATE KEY-----`;

    // Create JWT auth object - this is the correct way for v4.1.4
    const serviceAccountAuth = new JWT({
      email: clientEmail,
      key: formattedKey,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ],
    });

    // Pass auth directly to constructor - NO useServiceAccountAuth method needed
    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);

    await doc.loadInfo(); // loads doc properties + sheet metadata
    const sheet = doc.sheetsByIndex[0]; // use your desired sheet index or name
    const rows = await sheet.getRows(); // read all rows

    return rows.map((row) => row.toObject()); // convert to plain JSON
  } catch (error) {
    console.error('❌ Error fetching sheet data:', error);
    console.error('Private key preview:', privateKey.substring(0, 50) + '...');
    throw error;
  }
}