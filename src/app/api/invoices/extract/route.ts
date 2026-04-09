import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Extract the invoice number and customer information from this invoice/ticket PDF.

Context: This is from Mobile Janitorial Supply (MJS). The document is either:
A) A DELIVERY invoice — the customer is who goods are being SHIPPED TO / DELIVERED TO
B) A PICKUP ticket — the customer is the location/company where goods are being PICKED UP FROM

Rules:
- The invoice number is typically a 5-7 digit number (e.g. 350601). It may appear after "Invoice #", "Invoice No.", "Ticket #", or similar labels.
- The customer name is the DESTINATION business — who the goods are going to (delivery) or being collected from (pickup). It is NOT "Mobile Janitorial Supply" — that is always the issuing company, never the customer.
- If you see "Ship To", "Deliver To", "Sold To", "Pick Up From", "Location", or similar — that is the customer.
- If the only company name you see is "Mobile Janitorial Supply", look harder for a different business name on the document (recipient, location, pickup site, etc.).
- If you can find an address for the customer, include it.
- Return ONLY valid JSON, no markdown, no explanation.

Return format:
{"invoice_number": "350601", "customer_name": "ABC Company", "customer_address": "123 Main St, City, CA 90210"}

If you cannot find a field, use null for its value.`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    // Parse the JSON from Claude's response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ invoice_number: null, customer_name: null, customer_address: null });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({
      invoice_number: parsed.invoice_number || null,
      customer_name: parsed.customer_name || null,
      customer_address: parsed.customer_address || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed';
    return NextResponse.json({ error: message, invoice_number: null, customer_name: null, customer_address: null });
  }
}
