import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';

/**
 * Lightweight pickup completion — no photo, no signature, no PDF, no Google Drive.
 * Just marks the pickup stop as completed.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json();
  const { stop_id, driver_id, gps_lat, gps_lng } = body;

  if (!stop_id || !driver_id) {
    return NextResponse.json({ error: 'stop_id and driver_id are required' }, { status: 400 });
  }

  // Fetch stop + invoice
  const { data: stop, error: stopError } = await supabase
    .from('route_stops')
    .select('*, invoice:invoices(*)')
    .eq('id', stop_id)
    .single();

  if (stopError || !stop) {
    return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
  }

  // Fetch driver
  const { data: driver } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', driver_id)
    .single();

  const now = new Date().toISOString();
  const invoice = stop.invoice;

  // Calculate dwell time if arrived_at was recorded
  let dwellSeconds: number | null = null;
  if (stop.arrived_at) {
    dwellSeconds = Math.round((new Date(now).getTime() - new Date(stop.arrived_at).getTime()) / 1000);
  }

  // Mark stop as completed
  const { error: updateError } = await supabase
    .from('route_stops')
    .update({
      status: 'completed',
      completed_at: now,
      departed_at: now,
      dwell_seconds: dwellSeconds,
      gps_lat: gps_lat ? parseFloat(gps_lat) : null,
      gps_lng: gps_lng ? parseFloat(gps_lng) : null,
    })
    .eq('id', stop_id);

  if (updateError) {
    return NextResponse.json({ error: `Update failed: ${updateError.message}` }, { status: 500 });
  }

  // Update invoice status to 'picked_up'
  await supabase
    .from('invoices')
    .update({ status: 'picked_up' })
    .eq('id', invoice.id);

  // Check if all stops in route are completed
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

  // Log activity
  const driverName = driver?.name || 'Driver';
  const logBase = {
    driver_id,
    driver_name: driverName,
    stop_id,
    customer_name: invoice?.customer_name || undefined,
    invoice_number: invoice?.invoice_number || undefined,
  };

  await logActivity({ ...logBase, event_type: 'pickup_completed', message: `${driverName} completed pickup at ${invoice?.customer_name || 'Unknown'}` });

  if (allCompleted) {
    await logActivity({ ...logBase, event_type: 'route_completed', message: `${driverName} completed all stops for today` });
  }

  return NextResponse.json({ success: true });
}
