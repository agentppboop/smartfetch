import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/googleSheets';

export async function GET() {
  try {
    const data = await getSheetData();
    return NextResponse.json({ data });
  } catch (err) {
    console.error('Error fetching sheet data:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
