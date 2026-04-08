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
  const photoFile = (formData.get('photoFile') ?? formData.get('photo')) as File | null;
  const notesInput = formData.get('notes') as string | null;
  const backorderNotes = formData.get('backorder_notes') as string | null;
  const gpsLat = formData.get('gps_lat') as string | null;
  const gpsLng = formData.get('gps_lng') as string | null;

  if (!stopId || !signatureDataUrl || !photoFile) {
    return NextResponse.json(
      { error: 'stopId, signatureDataUrl, and photoFile are required' },
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
    .upload(sigPath, sigBuffer, { contentType: 'image/png' });

  if (sigUploadError) {
    return NextResponse.json(
      { error: `Signature upload failed: ${sigUploadError.message}` },
      { status: 500 }
    );
  }

  // d. Upload photo to Supabase Storage
  const photoArrayBuffer = await photoFile.arrayBuffer();
  const photoBuffer = Buffer.from(photoArrayBuffer);
  const photoExt = photoFile.name.split('.').pop() ?? 'jpg';
  const photoPath = `${dateStr}/${stopId}_photo.${photoExt}`;

  const { error: photoUploadError } = await supabase.storage
    .from('photos')
    .upload(photoPath, photoBuffer, { contentType: photoFile.type || 'image/jpeg' });

  if (photoUploadError) {
    return NextResponse.json(
      { error: `Photo upload failed: ${photoUploadError.message}` },
      { status: 500 }
    );
  }

  // e. Download original invoice PDF if it exists
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

  // f. Generate composite POD PDF
  const podPdfBytes = await generatePodPdf({
    invoicePdf: invoicePdfBytes,
    signatureImage: new Uint8Array(sigBuffer),
    photoImage: new Uint8Array(photoBuffer),
    invoiceNumber: invoice.invoice_number,
    customerName: invoice.customer_name ?? 'Unknown',
    driverName: driver.name,
    deliveredAt: now,
    gpsLat: gpsLat ? parseFloat(gpsLat) : null,
    gpsLng: gpsLng ? parseFloat(gpsLng) : null,
    notes: notesInput || null,
  });

  // g. Upload POD PDF to Supabase Storage
  const podPath = `${dateStr}/${stopId}_pod.pdf`;
  const podBuffer = Buffer.from(podPdfBytes);

  const { error: podUploadError } = await supabase.storage
    .from('pods')
    .upload(podPath, podBuffer, { contentType: 'application/pdf' });

  if (podUploadError) {
    return NextResponse.json(
      { error: `POD PDF upload failed: ${podUploadError.message}` },
      { status: 500 }
    );
  }

  // h. Upload to Google Drive (non-fatal)
  let googleDriveFileId: string | null = null;
  try {
    googleDriveFileId = await uploadPodToDrive(
      podBuffer,
      invoice.invoice_number,
      driver.name,
      dateStr
    );
  } catch (driveErr) {
    console.error('Google Drive upload failed:', driveErr instanceof Error ? driveErr.message : driveErr);
  }

  // i. Update route_stop record with dwell time calculation
  let dwellSeconds: number | null = null;
  if (stop.arrived_at) {
    dwellSeconds = Math.round((new Date(now).getTime() - new Date(stop.arrived_at).getTime()) / 1000);
  }

  const { error: stopUpdateError } = await supabase
    .from('route_stops')
    .update({
      signature_storage_path: sigPath,
      photo_storage_path: photoPath,
      pod_pdf_storage_path: podPath,
      google_drive_file_id: googleDriveFileId,
      status: 'completed',
      completed_at: now,
      departed_at: now,
      dwell_seconds: dwellSeconds,
      gps_lat: gpsLat ? parseFloat(gpsLat) : null,
      gps_lng: gpsLng ? parseFloat(gpsLng) : null,
      backorder_notes: backorderNotes || null,
    })
    .eq('id', stopId);

  if (stopUpdateError) {
    return NextResponse.json(
      { error: `Stop update failed: ${stopUpdateError.message}` },
      { status: 500 }
    );
  }

  // j. Update invoice status to 'delivered'
  await supabase
    .from('invoices')
    .update({ status: 'delivered' })
    .eq('id', invoice.id);

  // k. Check if all stops in route are completed
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

  // l. Log activity events
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

  // m. Return success
  const filename = `${invoice.invoice_number}.pdf`;
  return NextResponse.json({ success: true, googleDriveFileId, filename, driveError: googleDriveFileId ? null : 'Drive upload failed — check logs' });
}
