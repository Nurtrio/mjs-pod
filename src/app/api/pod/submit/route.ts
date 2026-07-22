import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generatePodPdf } from '@/lib/pdf-generate';
import { uploadPodToDrive } from '@/lib/google-drive';
import { logActivity } from '@/lib/activity';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const supabase = createServerClient();

  const formData = await request.formData();
  const stopId = (formData.get('stopId') ?? formData.get('stop_id')) as string | null;
  const signatureDataUrl = (formData.get('signatureDataUrl') ?? formData.get('signature')) as string | null;
  const invoicePhotoFile = formData.get('invoice_photo') as File | null;
  const productPhoto0 = formData.get('product_photo_0') as File | null;
  const productPhoto1 = formData.get('product_photo_1') as File | null;
  const notesInput = formData.get('notes') as string | null;
  const gpsLat = formData.get('gps_lat') as string | null;
  const gpsLng = formData.get('gps_lng') as string | null;

  // Backward compat: accept old single 'photo' field as invoice_photo
  const photoFallback = formData.get('photoFile') ?? formData.get('photo');
  const effectiveInvoicePhoto = invoicePhotoFile || (photoFallback as File | null);

  if (!stopId || !signatureDataUrl || !effectiveInvoicePhoto) {
    return NextResponse.json(
      { error: 'stopId, signatureDataUrl, and invoice_photo are required' },
      { status: 400 }
    );
  }

  // a. Fetch stop + invoice
  const { data: stop, error: stopError } = await supabase
    .from('route_stops')
    .select('*, invoice:invoices(*)')
    .eq('id', stopId)
    .single();

  if (stopError || !stop) {
    return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
  }

  // b. Fetch route + driver
  const { data: route, error: routeError } = await supabase
    .from('routes')
    .select('*, driver:drivers(*)')
    .eq('id', stop.route_id)
    .single();

  if (routeError || !route) {
    return NextResponse.json({ error: 'Route not found' }, { status: 404 });
  }

  const invoice = stop.invoice;
  const driver = route.driver;
  const now = new Date().toISOString();
  const dateStr = now.split('T')[0];

  // c. Upload signature to Supabase Storage
  const sigBase64 = signatureDataUrl.replace(/^data:image\/png;base64,/, '');
  const sigBuffer = Buffer.from(sigBase64, 'base64');
  const sigPath = `${dateStr}/${stopId}_signature.png`;

  const { error: sigUploadError } = await supabase.storage
    .from('signatures')
    .upload(sigPath, sigBuffer, { contentType: 'image/png', upsert: true });

  if (sigUploadError) {
    return NextResponse.json(
      { error: `Signature upload failed: ${sigUploadError.message}` },
      { status: 500 }
    );
  }

  // d. Upload invoice ticket photo
  const invoicePhotoArrayBuffer = await effectiveInvoicePhoto.arrayBuffer();
  const invoicePhotoBuffer = Buffer.from(invoicePhotoArrayBuffer);
  const invoicePhotoExt = effectiveInvoicePhoto.name.split('.').pop() ?? 'jpg';
  const invoicePhotoPath = `${dateStr}/${stopId}_invoice.${invoicePhotoExt}`;

  const { error: invoicePhotoUploadError } = await supabase.storage
    .from('photos')
    .upload(invoicePhotoPath, invoicePhotoBuffer, { contentType: effectiveInvoicePhoto.type || 'image/jpeg', upsert: true });

  if (invoicePhotoUploadError) {
    return NextResponse.json(
      { error: `Invoice photo upload failed: ${invoicePhotoUploadError.message}` },
      { status: 500 }
    );
  }

  // e. Upload product photos
  const productPhotoPaths: string[] = [];
  const productPhotoBuffers: Buffer[] = [];
  const productPhotoFiles = [productPhoto0, productPhoto1].filter((f): f is File => f !== null);

  for (let i = 0; i < productPhotoFiles.length; i++) {
    const file = productPhotoFiles[i];
    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${dateStr}/${stopId}_product_${i}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('photos')
      .upload(path, buf, { contentType: file.type || 'image/jpeg', upsert: true });

    if (uploadErr) {
      return NextResponse.json(
        { error: `Product photo ${i + 1} upload failed: ${uploadErr.message}` },
        { status: 500 }
      );
    }

    productPhotoPaths.push(path);
    productPhotoBuffers.push(buf);
  }

  // f. Download original invoice PDF if it exists
  let invoicePdfBytes: Uint8Array | null = null;
  if (invoice.pdf_storage_path) {
    const { data: pdfBlob, error: pdfDownloadError } = await supabase.storage
      .from('invoices')
      .download(invoice.pdf_storage_path);

    if (!pdfDownloadError && pdfBlob) {
      const ab = await pdfBlob.arrayBuffer();
      invoicePdfBytes = new Uint8Array(ab);
    }
  }

  // g. Generate composite POD PDF
  const podPdfBytes = await generatePodPdf({
    invoicePdf: invoicePdfBytes,
    signatureImage: new Uint8Array(sigBuffer),
    invoicePhotoImage: new Uint8Array(invoicePhotoBuffer),
    productPhotoImages: productPhotoBuffers.map((b) => new Uint8Array(b)),
    invoiceNumber: invoice.invoice_number,
    customerName: invoice.customer_name ?? 'Unknown',
    driverName: driver.name,
    deliveredAt: now,
    gpsLat: gpsLat ? parseFloat(gpsLat) : null,
    gpsLng: gpsLng ? parseFloat(gpsLng) : null,
    notes: notesInput || null,
  });

  // h. Upload POD PDF to Supabase Storage
  const podPath = `${dateStr}/${stopId}_pod.pdf`;
  const podBuffer = Buffer.from(podPdfBytes);

  const { error: podUploadError } = await supabase.storage
    .from('pods')
    .upload(podPath, podBuffer, { contentType: 'application/pdf', upsert: true });

  if (podUploadError) {
    return NextResponse.json(
      { error: `POD PDF upload failed: ${podUploadError.message}` },
      { status: 500 }
    );
  }

  // i. Upload to Google Drive (non-fatal)
  let googleDriveFileId: string | null = null;
  try {
    googleDriveFileId = await uploadPodToDrive(
      podBuffer,
      invoice.invoice_number,
      driver.name,
      dateStr
    );
  } catch (driveErr) {
    const errMsg = driveErr instanceof Error ? driveErr.message : String(driveErr);
    const errStack = driveErr instanceof Error ? driveErr.stack : '';
    console.error('Google Drive upload failed:', errMsg);
    console.error('Drive error details:', errStack);
  }

  // j. Update route_stop record with dwell time calculation
  let dwellSeconds: number | null = null;
  if (stop.arrived_at) {
    dwellSeconds = Math.round((new Date(now).getTime() - new Date(stop.arrived_at).getTime()) / 1000);
  }

  const { error: stopUpdateError } = await supabase
    .from('route_stops')
    .update({
      signature_storage_path: sigPath,
      photo_storage_path: invoicePhotoPath,
      invoice_photo_storage_path: invoicePhotoPath,
      product_photo_storage_paths: productPhotoPaths.length > 0 ? productPhotoPaths : null,
      pod_pdf_storage_path: podPath,
      google_drive_file_id: googleDriveFileId,
      status: 'completed',
      completed_at: now,
      departed_at: now,
      dwell_seconds: dwellSeconds,
      gps_lat: gpsLat ? parseFloat(gpsLat) : null,
      gps_lng: gpsLng ? parseFloat(gpsLng) : null,
    })
    .eq('id', stopId);

  if (stopUpdateError) {
    return NextResponse.json(
      { error: `Stop update failed: ${stopUpdateError.message}` },
      { status: 500 }
    );
  }

  // k. Update invoice status to 'delivered'
  await supabase
    .from('invoices')
    .update({ status: 'delivered' })
    .eq('id', invoice.id);

  // l. Check if all stops in route are completed
  const { data: allStops } = await supabase
    .from('route_stops')
    .select('status')
    .eq('route_id', stop.route_id);

  const allCompleted = allStops?.every(
    (s) => s.status === 'completed' || s.status === 'skipped'
  );

  if (allCompleted) {
    await supabase
      .from('routes')
      .update({ status: 'completed' })
      .eq('id', stop.route_id);
  }

  // m. Log activity events
  const logBase = {
    driver_id: driver.id,
    driver_name: driver.name,
    stop_id: stopId,
    customer_name: invoice.customer_name || undefined,
    invoice_number: invoice.invoice_number || undefined,
  };

  await logActivity({ ...logBase, event_type: 'photo_captured', message: `${driver.name} captured delivery photo at ${invoice.customer_name}` });
  await logActivity({ ...logBase, event_type: 'signature_confirmed', message: `${driver.name} collected signature from ${invoice.customer_name}` });
  await logActivity({ ...logBase, event_type: 'pod_submitted', message: `${driver.name} submitted proof of delivery for INV #${invoice.invoice_number}` });
  await logActivity({ ...logBase, event_type: 'delivery_completed', message: `${driver.name} completed delivery to ${invoice.customer_name}` });

  if (allCompleted) {
    await logActivity({ ...logBase, event_type: 'route_completed', message: `${driver.name} completed all deliveries for today` });
  }

  // n. Return success
  const filename = `${invoice.invoice_number}.pdf`;
  return NextResponse.json({ success: true, googleDriveFileId, filename, driveError: googleDriveFileId ? null : 'Drive upload failed — check logs' });
}
