import { NextResponse } from 'next/server';
import { getSheetData } from '@/app/api/utils/googleSheets';

export async function GET() {
  try {
    const data = await getSheetData();
    return NextResponse.json({ data });
  } catch (err) {
    console.error('Error fetching sheet data:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
console.log('EMAIL:', process.env.GOOGLE_CLIENT_EMAIL);
console.log('KEY:', process.env.GOOGLE_PRIVATE_KEY);
console.log('SHEET_ID:', process.env.SHEET_ID);
