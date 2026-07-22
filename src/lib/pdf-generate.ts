import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface PodData {
  invoicePdf: Uint8Array | null;
  signatureImage: Uint8Array;
  invoicePhotoImage: Uint8Array;
  productPhotoImages: Uint8Array[];
  invoiceNumber: string;
  customerName: string;
  driverName: string;
  deliveredAt: string;
  gpsLat?: number | null;
  gpsLng?: number | null;
  notes?: string | null;
}

const GREEN = rgb(0.18, 0.55, 0.18);
const DARK = rgb(0.1, 0.1, 0.1);
const LIGHT_GRAY = rgb(0.6, 0.6, 0.6);
const LIGHT_BG = rgb(0.965, 0.969, 0.973);
const BORDER = rgb(0.85, 0.85, 0.85);
const WHITE = rgb(1, 1, 1);
const GRAY = rgb(0.4, 0.4, 0.4);

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      '  ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return iso;
  }
}

function drawBox(
  page: ReturnType<PDFDocument['addPage']>,
  x: number, y: number, w: number, h: number,
  options: { fill?: ReturnType<typeof rgb>; border?: ReturnType<typeof rgb> }
) {
  if (options.fill) {
    page.drawRectangle({ x, y, width: w, height: h, color: options.fill });
  }
  if (options.border) {
    page.drawRectangle({ x, y: y + h - 0.75, width: w, height: 0.75, color: options.border });
    page.drawRectangle({ x, y, width: w, height: 0.75, color: options.border });
    page.drawRectangle({ x, y, width: 0.75, height: h, color: options.border });
    page.drawRectangle({ x: x + w - 0.75, y, width: 0.75, height: h, color: options.border });
  }
}

export async function generatePodPdf(data: PodData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([612, 792]);
  const { height } = page.getSize();
  const m = 40;
  const cw = 612 - m * 2;
  let y = height - m;

  // ═══ GREEN HEADER BAR ═══
  const hdrH = 38;
  page.drawRectangle({ x: m, y: y - hdrH, width: cw, height: hdrH, color: GREEN });
  page.drawText('PROOF OF DELIVERY', { x: m + 14, y: y - hdrH + 12, size: 17, font: fontBold, color: WHITE });
  const invLabel = `#${data.invoiceNumber}`;
  const invLabelW = fontBold.widthOfTextAtSize(invLabel, 14);
  page.drawRectangle({ x: m + cw - invLabelW - 28, y: y - hdrH + 7, width: invLabelW + 20, height: 24, color: rgb(0.12, 0.42, 0.12) });
  page.drawText(invLabel, { x: m + cw - invLabelW - 18, y: y - hdrH + 13, size: 14, font: fontBold, color: WHITE });
  y -= hdrH + 14;

  // ═══ INFO CARDS ROW ═══
  const cardH = 48;
  const gap = 8;
  const cardW = (cw - gap * 2) / 3;
  const iconSize = 18;
  const iconPad = 10;
  const textOffX = iconPad + iconSize + 8; // text starts after icon

  // Card: Customer (person icon)
  drawBox(page, m, y - cardH, cardW, cardH, { fill: LIGHT_BG, border: BORDER });
  const c1IconX = m + iconPad;
  const c1IconY = y - cardH / 2;
  // Person head
  page.drawCircle({ x: c1IconX + 9, y: c1IconY + 5, size: 4.5, color: GREEN });
  // Person body (shoulders)
  page.drawEllipse({ x: c1IconX + 9, y: c1IconY - 5, xScale: 7, yScale: 4.5, color: GREEN });
  page.drawText('CUSTOMER', { x: m + textOffX, y: y - 14, size: 7, font: fontBold, color: LIGHT_GRAY });
  const custName = data.customerName.length > 20 ? data.customerName.slice(0, 18) + '...' : data.customerName;
  page.drawText(custName, { x: m + textOffX, y: y - 32, size: 10, font: fontBold, color: DARK });

  // Card: Driver (steering wheel / truck icon)
  const c2x = m + cardW + gap;
  drawBox(page, c2x, y - cardH, cardW, cardH, { fill: LIGHT_BG, border: BORDER });
  const c2IconX = c2x + iconPad;
  const c2IconY = y - cardH / 2;
  // Truck body
  page.drawRectangle({ x: c2IconX, y: c2IconY - 5, width: 14, height: 10, color: GREEN });
  // Truck cab
  page.drawRectangle({ x: c2IconX + 11, y: c2IconY - 5, width: 7, height: 7, color: rgb(0.14, 0.45, 0.14) });
  // Wheels
  page.drawCircle({ x: c2IconX + 4, y: c2IconY - 6, size: 2.5, color: DARK });
  page.drawCircle({ x: c2IconX + 15, y: c2IconY - 6, size: 2.5, color: DARK });
  page.drawText('DRIVER', { x: c2x + textOffX, y: y - 14, size: 7, font: fontBold, color: LIGHT_GRAY });
  page.drawText(data.driverName, { x: c2x + textOffX, y: y - 32, size: 10, font: fontBold, color: DARK });

  // Card: Delivered (clock icon)
  const c3x = m + (cardW + gap) * 2;
  drawBox(page, c3x, y - cardH, cardW, cardH, { fill: LIGHT_BG, border: BORDER });
  const c3IconX = c3x + iconPad;
  const c3IconY = y - cardH / 2;
  // Clock circle
  page.drawCircle({ x: c3IconX + 9, y: c3IconY, size: 8, color: WHITE, borderColor: GREEN, borderWidth: 1.5 });
  // Clock hands (hour hand)
  page.drawRectangle({ x: c3IconX + 8.5, y: c3IconY, width: 1.2, height: 5, color: GREEN });
  // Clock hands (minute hand)
  page.drawRectangle({ x: c3IconX + 9, y: c3IconY - 0.5, width: 4, height: 1.2, color: GREEN });
  // Center dot
  page.drawCircle({ x: c3IconX + 9, y: c3IconY, size: 1.2, color: GREEN });
  page.drawText('DELIVERED', { x: c3x + textOffX, y: y - 14, size: 7, font: fontBold, color: LIGHT_GRAY });
  const dtText = formatDate(data.deliveredAt);
  const dtSize = dtText.length > 20 ? 7 : 8.5;
  page.drawText(dtText, { x: c3x + textOffX, y: y - 31, size: dtSize, font, color: DARK });

  y -= cardH + 10;

  // ═══ GPS BAR ═══
  if (data.gpsLat && data.gpsLng) {
    const gpsH = 28;
    drawBox(page, m, y - gpsH, cw, gpsH, { fill: rgb(0.94, 0.97, 0.94), border: rgb(0.8, 0.9, 0.8) });
    // Pin icon
    const gpx = m + 12;
    const gpy = y - gpsH / 2;
    page.drawCircle({ x: gpx + 4, y: gpy + 3, size: 4, color: GREEN });
    // Pin point (triangle via small rects)
    page.drawRectangle({ x: gpx + 3, y: gpy - 4, width: 2.5, height: 5, color: GREEN });
    page.drawCircle({ x: gpx + 4, y: gpy + 3, size: 2, color: rgb(0.94, 0.97, 0.94) }); // hollow center
    page.drawText('GPS COORDINATES', { x: m + 28, y: y - 12, size: 7, font: fontBold, color: GREEN });
    page.drawText(`${data.gpsLat.toFixed(6)}, ${data.gpsLng.toFixed(6)}`, { x: m + 28, y: y - 22, size: 9, font, color: DARK });
    y -= gpsH + 6;
  }

  // ═══ NOTES BAR ═══
  if (data.notes) {
    const noteH = 28;
    const noteColor = rgb(0.6, 0.45, 0.1);
    drawBox(page, m, y - noteH, cw, noteH, { fill: rgb(0.99, 0.97, 0.92), border: rgb(0.92, 0.88, 0.78) });
    // Note icon (paper with lines)
    const nx = m + 11;
    const ny = y - noteH / 2;
    page.drawRectangle({ x: nx, y: ny - 5, width: 10, height: 13, color: noteColor });
    page.drawRectangle({ x: nx + 2, y: ny + 4, width: 6, height: 1, color: rgb(0.99, 0.97, 0.92) });
    page.drawRectangle({ x: nx + 2, y: ny + 1, width: 6, height: 1, color: rgb(0.99, 0.97, 0.92) });
    page.drawRectangle({ x: nx + 2, y: ny - 2, width: 4, height: 1, color: rgb(0.99, 0.97, 0.92) });
    page.drawText('NOTES', { x: m + 28, y: y - 12, size: 7, font: fontBold, color: noteColor });
    const nt = data.notes.length > 90 ? data.notes.slice(0, 87) + '...' : data.notes;
    page.drawText(nt, { x: m + 28, y: y - 22, size: 8, font, color: DARK });
    y -= noteH + 6;
  }

  y -= 6;

  // ═══ SIGNATURE BOX ═══ (left-aligned, above product photos)
  const sigW = 240;
  const sigH = 100;
  const sigX = m;
  const sigY = y - sigH;

  drawBox(page, sigX, sigY, sigW, sigH, { fill: WHITE, border: BORDER });
  page.drawRectangle({ x: sigX, y: sigY + sigH - 18, width: sigW, height: 18, color: LIGHT_BG });
  page.drawRectangle({ x: sigX, y: sigY + sigH - 19, width: sigW, height: 0.75, color: BORDER });
  // Pen icon in signature header
  const penX = sigX + 8;
  const penY = sigY + sigH - 13;
  page.drawRectangle({ x: penX, y: penY - 1, width: 8, height: 2, color: LIGHT_GRAY });
  page.drawRectangle({ x: penX + 7, y: penY - 2, width: 3, height: 4, color: LIGHT_GRAY });
  page.drawText('CUSTOMER SIGNATURE', { x: sigX + 22, y: sigY + sigH - 14, size: 6.5, font: fontBold, color: LIGHT_GRAY });

  try {
    const sig = await doc.embedPng(data.signatureImage);
    const sigScale = Math.min((sigW - 16) / sig.width, (sigH - 24) / sig.height);
    const sw = sig.width * sigScale;
    const sh = sig.height * sigScale;
    page.drawImage(sig, { x: sigX + (sigW - sw) / 2, y: sigY + (sigH - 16 - sh) / 2, width: sw, height: sh });
  } catch {
    page.drawText('[Signature error]', { x: sigX + 10, y: sigY + 25, size: 9, font, color: GRAY });
  }

  y = sigY - 16;

  // ═══ PRODUCT PHOTOS ═══ (main visual content)
  if (data.productPhotoImages.length > 0) {
    // Camera icon
    const camY = y - 10;
    page.drawRectangle({ x: m, y: camY - 4, width: 14, height: 10, color: LIGHT_GRAY });
    page.drawRectangle({ x: m + 4, y: camY + 5, width: 6, height: 3, color: LIGHT_GRAY });
    page.drawCircle({ x: m + 7, y: camY + 1, size: 3, color: LIGHT_BG });
    page.drawText('PRODUCT PHOTOS', { x: m + 18, y: y - 12, size: 7, font: fontBold, color: LIGHT_GRAY });
    y -= 20;

    const availH = y - 50;

    if (data.productPhotoImages.length === 1) {
      try {
        let photo;
        try { photo = await doc.embedJpg(data.productPhotoImages[0]); } catch { photo = await doc.embedPng(data.productPhotoImages[0]); }
        const scale = Math.min(cw / photo.width, Math.min(availH, 350) / photo.height);
        const w = photo.width * scale;
        const h = photo.height * scale;
        drawBox(page, m, y - h - 8, w + 8, h + 8, { fill: WHITE, border: BORDER });
        page.drawImage(photo, { x: m + 4, y: y - h - 4, width: w, height: h });
      } catch {
        page.drawText('[Product photo error]', { x: m, y: y - 15, size: 10, font, color: GRAY });
      }
    } else {
      const halfW = (cw - 10) / 2;
      for (let i = 0; i < 2; i++) {
        try {
          let photo;
          try { photo = await doc.embedJpg(data.productPhotoImages[i]); } catch { photo = await doc.embedPng(data.productPhotoImages[i]); }
          const scale = Math.min((halfW - 8) / photo.width, Math.min(availH, 300) / photo.height);
          const w = photo.width * scale;
          const h = photo.height * scale;
          const xPos = m + i * (halfW + 10);
          drawBox(page, xPos, y - h - 8, w + 8, h + 8, { fill: WHITE, border: BORDER });
          page.drawImage(photo, { x: xPos + 4, y: y - h - 4, width: w, height: h });
        } catch {
          const xPos = m + i * (halfW + 10);
          page.drawText(`[Photo ${i + 1} error]`, { x: xPos, y: y - 15, size: 10, font, color: GRAY });
        }
      }
    }
  }

  // ═══ FOOTER ═══
  page.drawRectangle({ x: m, y: 30, width: cw, height: 0.75, color: BORDER });
  page.drawText('Mobile Janitorial Supply', { x: m, y: 18, size: 7.5, font, color: LIGHT_GRAY });
  page.drawText('Proof of Delivery Document', { x: m + cw - 130, y: 18, size: 7.5, font, color: LIGHT_GRAY });

  return doc.save();
}
