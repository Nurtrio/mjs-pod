import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface PodData {
  invoicePdf: Uint8Array | null;
  signatureImage: Uint8Array;
  photoImage: Uint8Array;
  invoiceNumber: string;
  customerName: string;
  driverName: string;
  deliveredAt: string;
  gpsLat?: number | null;
  gpsLng?: number | null;
  notes?: string | null;
  backorderNotes?: string | null;
}

export async function generatePodPdf(data: PodData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Page 1: If we have the original invoice, include it
  if (data.invoicePdf) {
    try {
      const invoiceDoc = await PDFDocument.load(data.invoicePdf);
      const pages = await doc.copyPages(invoiceDoc, invoiceDoc.getPageIndices());
      pages.forEach((p) => doc.addPage(p));
    } catch {
      // If invoice PDF can't be loaded, add a placeholder page
      const page = doc.addPage([612, 792]);
      page.drawText(`Invoice #${data.invoiceNumber}`, { x: 50, y: 700, size: 24, font: fontBold });
      page.drawText(`Customer: ${data.customerName}`, { x: 50, y: 660, size: 16, font });
    }
  }

  // POD Summary Page
  const page = doc.addPage([612, 792]);
  const { height } = page.getSize();
  let y = height - 50;

  // Header
  page.drawText('PROOF OF DELIVERY', { x: 50, y, size: 28, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  y -= 10;
  page.drawRectangle({ x: 50, y, width: 512, height: 2, color: rgb(0.2, 0.5, 0.2) });
  y -= 35;

  // Details
  const details = [
    ['Invoice #:', data.invoiceNumber],
    ['Customer:', data.customerName],
    ['Driver:', data.driverName],
    ['Delivered:', data.deliveredAt],
  ];
  if (data.gpsLat && data.gpsLng) {
    details.push(['GPS:', `${data.gpsLat.toFixed(6)}, ${data.gpsLng.toFixed(6)}`]);
  }

  for (const [label, value] of details) {
    page.drawText(label, { x: 50, y, size: 12, font: fontBold });
    page.drawText(value, { x: 160, y, size: 12, font });
    y -= 22;
  }

  y -= 10;

  // Driver Notes section
  if (data.notes) {
    page.drawText('DRIVER NOTES', { x: 50, y, size: 12, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    y -= 4;
    page.drawRectangle({ x: 50, y, width: 512, height: 1, color: rgb(0.75, 0.75, 0.75) });
    y -= 16;

    // Word-wrap notes text to fit page width
    const maxLineWidth = 490;
    const words = data.notes.split(' ');
    let line = '';
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, 11);
      if (testWidth > maxLineWidth && line) {
        page.drawText(line, { x: 58, y, size: 11, font, color: rgb(0.25, 0.25, 0.25) });
        y -= 16;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(line, { x: 58, y, size: 11, font, color: rgb(0.25, 0.25, 0.25) });
      y -= 16;
    }
    y -= 10;
  }

  // Backorder Table
  if (data.backorderNotes) {
    // Section header with amber accent
    page.drawRectangle({ x: 50, y: y + 2, width: 512, height: 22, color: rgb(0.98, 0.92, 0.75) });
    page.drawText('BACKORDERED ITEMS', { x: 58, y: y + 6, size: 11, font: fontBold, color: rgb(0.6, 0.35, 0.0) });
    y -= 26;

    // Table header
    page.drawRectangle({ x: 50, y: y - 2, width: 512, height: 20, color: rgb(0.94, 0.94, 0.94) });
    page.drawText('#', { x: 58, y: y + 2, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('Item Description', { x: 85, y: y + 2, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
    y -= 22;

    // Parse backorder items — split by newlines or commas
    const items = data.backorderNotes
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (let i = 0; i < items.length; i++) {
      // Alternating row background
      if (i % 2 === 0) {
        page.drawRectangle({ x: 50, y: y - 4, width: 512, height: 20, color: rgb(0.98, 0.98, 0.98) });
      }
      page.drawText(`${i + 1}`, { x: 58, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });

      // Word-wrap long item descriptions
      const itemMaxWidth = 460;
      const itemWords = items[i].split(' ');
      let itemLine = '';
      let firstLine = true;
      for (const word of itemWords) {
        const testLine = itemLine ? `${itemLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, 10);
        if (testWidth > itemMaxWidth && itemLine) {
          page.drawText(itemLine, { x: 85, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
          y -= 16;
          itemLine = word;
          firstLine = false;
        } else {
          itemLine = testLine;
        }
      }
      if (itemLine) {
        if (!firstLine) {
          // continuation line — no row number
        }
        page.drawText(itemLine, { x: 85, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
        y -= 20;
      }
    }

    // Bottom border
    page.drawRectangle({ x: 50, y: y + 14, width: 512, height: 1, color: rgb(0.75, 0.75, 0.75) });
    y -= 10;
  }

  y -= 10;

  // Delivery Photo
  page.drawText('Delivery Photo:', { x: 50, y, size: 14, font: fontBold });
  y -= 10;

  try {
    let photo;
    // Try embedding as JPEG first, fall back to PNG
    try {
      photo = await doc.embedJpg(data.photoImage);
    } catch {
      photo = await doc.embedPng(data.photoImage);
    }
    const photoScale = Math.min(300 / photo.width, 250 / photo.height);
    const photoW = photo.width * photoScale;
    const photoH = photo.height * photoScale;
    page.drawImage(photo, { x: 50, y: y - photoH, width: photoW, height: photoH });
    y -= photoH + 20;
  } catch {
    page.drawText('[Photo could not be embedded]', { x: 50, y: y - 20, size: 10, font });
    y -= 40;
  }

  // Signature
  page.drawText('Customer Signature:', { x: 50, y, size: 14, font: fontBold });
  y -= 10;

  try {
    const sig = await doc.embedPng(data.signatureImage);
    const sigScale = Math.min(250 / sig.width, 80 / sig.height);
    const sigW = sig.width * sigScale;
    const sigH = sig.height * sigScale;
    page.drawImage(sig, { x: 50, y: y - sigH, width: sigW, height: sigH });
  } catch {
    page.drawText('[Signature could not be embedded]', { x: 50, y: y - 20, size: 10, font });
  }

  return doc.save();
}
