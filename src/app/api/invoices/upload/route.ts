import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { extractInvoiceData } from '@/lib/pdf-extract';

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const formData = await request.formData();

  // Support both 'file' (single) and 'files' (batch) field names
  let files = formData.getAll('files') as File[];
  if (!files || files.length === 0) {
    const single = formData.get('file') as File | null;
    if (single) files = [single];
  }

  // Use manually provided fields if present
  const manualInvoiceNumber = formData.get('invoice_number') as string | null;
  const manualCustomerName = formData.get('customer_name') as string | null;
  const manualCustomerAddress = formData.get('customer_address') as string | null;

  if (!files || files.length === 0) {
    return NextResponse.json({ error: 'No PDF files provided' }, { status: 400 });
  }

  const results: Array<{
    fileName: string;
    invoice?: Record<string, unknown>;
    error?: string;
  }> = [];

  for (const file of files) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload to Supabase Storage
      const storagePath = `uploads/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(storagePath, buffer, { contentType: 'application/pdf' });

      if (uploadError) {
        results.push({ fileName: file.name, error: `Upload failed: ${uploadError.message}` });
        continue;
      }

      // Attempt text extraction
      let invoiceNumber: string | null = null;
      let customerName: string | null = null;
      let customerAddress: string | null = null;

      try {
        const extracted = await extractInvoiceData(buffer);
        invoiceNumber = extracted.invoiceNumber;
        customerName = extracted.customerName;
        customerAddress = extracted.customerAddress;
      } catch {
        // Extraction failed — use filename as fallback invoice number
      }

      // Use manual values if provided, then extraction, then filename fallback
      if (manualInvoiceNumber) invoiceNumber = manualInvoiceNumber;
      if (manualCustomerName) customerName = manualCustomerName;
      if (manualCustomerAddress) customerAddress = manualCustomerAddress;
      if (!invoiceNumber) {
        // Try to extract a 5-7 digit number from the filename (e.g. "Inv_350601_from_...")
        const fnMatch = file.name.match(/(\d{5,7})/);
        invoiceNumber = fnMatch ? fnMatch[1] : file.name.replace(/\.pdf$/i, '');
      }

      // Create invoice record
      const { data: invoice, error: insertError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          customer_name: customerName,
          customer_address: customerAddress,
          pdf_storage_path: storagePath,
          status: 'unassigned',
        })
        .select()
        .single();

      if (insertError) {
        results.push({ fileName: file.name, error: `DB insert failed: ${insertError.message}` });
        continue;
      }

      results.push({ fileName: file.name, invoice });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      results.push({ fileName: file.name, error: message });
    }
  }

  // For single file uploads, also include top-level invoice for convenience
  if (results.length === 1 && results[0].invoice) {
    return NextResponse.json({ invoices: results, invoice: results[0].invoice, id: (results[0].invoice as { id: string }).id }, { status: 201 });
  }

  return NextResponse.json({ invoices: results }, { status: 201 });
}
