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
              text: `Extract the invoice number and customer name from this invoice PDF.

Rules:
- The invoice number is typically a 5-7 digit number (e.g. 350601). It may appear after "Invoice #", "Invoice No.", or similar labels.
- The customer name is the business or person being billed / shipped to. NOT the company issuing the invoice.
- If you can find a delivery address, include it.
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
