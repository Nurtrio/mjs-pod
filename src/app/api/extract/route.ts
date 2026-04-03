import { NextRequest, NextResponse } from 'next/server';
import { extractInvoiceData } from '@/lib/pdf-extract';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const extracted = await extractInvoiceData(buffer);
    return NextResponse.json(extracted);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to extract invoice data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
