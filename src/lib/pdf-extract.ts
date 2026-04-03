import { PDFParse } from 'pdf-parse';

interface ExtractedInvoice {
  invoiceNumber: string | null;
  customerName: string | null;
  customerAddress: string | null;
}

export async function extractInvoiceData(pdfBuffer: Buffer): Promise<ExtractedInvoice> {
  const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
  const result = await parser.getText();
  const text = result.text;

  // Extract invoice number — look for common QuickBooks patterns
  const invoicePatterns = [
    /Invoice\s*#?\s*:?\s*(\d{3,10})/i,
    /INV[_\-\s]?(\d{3,10})/i,
    /Invoice\s+Number\s*:?\s*(\d{3,10})/i,
    /No\.\s*(\d{3,10})/i,
    /(?:^|\s)(\d{5,7})(?:\s|$)/m,  // standalone 5-7 digit number on its own line
  ];

  let invoiceNumber: string | null = null;
  for (const pattern of invoicePatterns) {
    const match = text.match(pattern);
    if (match) {
      invoiceNumber = match[1];
      break;
    }
  }

  // Extract customer name — look for Ship To or Bill To sections
  let customerName: string | null = null;
  const namePatterns = [
    /(?:Ship\s*To|Deliver\s*To|Customer)\s*:?\s*\n?\s*([A-Z][^\n]{2,50})/i,
    /Bill\s*To\s*:?\s*\n?\s*([A-Z][^\n]{2,50})/i,
  ];
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      customerName = match[1].trim();
      break;
    }
  }

  // Extract address — look for lines with address patterns
  let customerAddress: string | null = null;
  const addressPattern = /(\d+\s+[A-Za-z].*(?:St|Ave|Blvd|Dr|Rd|Ln|Way|Ct|Pl|Cir)\.?.*\n.*(?:CA|California)\s+\d{5})/i;
  const addrMatch = text.match(addressPattern);
  if (addrMatch) {
    customerAddress = addrMatch[1].trim();
  }

  return { invoiceNumber, customerName, customerAddress };
}
