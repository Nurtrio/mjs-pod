import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';
import { geocodeAddress, haversineMeters, ARRIVAL_RADIUS_METERS } from '@/lib/geocode';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stopId: string }> },
) {
  const { stopId } = await params;
  const supabase = createServerClient();

  // Parse driver GPS from request body
  let driverLat: number | null = null;
  let driverLng: number | null = null;
  try {
    const body = await request.json();
    if (body.gps_lat != null) driverLat = parseFloat(body.gps_lat);
    if (body.gps_lng != null) driverLng = parseFloat(body.gps_lng);
  } catch {
    // No body or invalid JSON — that's fine, we'll reject below
  }

  // Require GPS coordinates
  if (driverLat == null || driverLng == null || isNaN(driverLat) || isNaN(driverLng)) {
    return NextResponse.json({ ok: false, reason: 'no_gps' });
  }

  // Fetch stop with invoice address and route/driver info
  const { data: stop } = await supabase
    .from('route_stops')
    .select('arrived_at, route_id, invoice_id, invoices(customer_name, invoice_number, customer_address), routes(driver_id, drivers(name))')
    .eq('id', stopId)
    .single();

  if (!stop) {
    return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 });
  }

  // Already arrived
  if (stop.arrived_at) {
    return NextResponse.json({ ok: true, already: true });
  }

  const invoice = stop.invoices as unknown as { customer_name: string; invoice_number: string; customer_address: string | null } | null;
  const customerAddress = invoice?.customer_address;

  if (!customerAddress) {
    // No address to check against — skip proximity check, allow arrival
    await supabase
      .from('route_stops')
      .update({ arrived_at: new Date().toISOString() })
      .eq('id', stopId);
    return NextResponse.json({ ok: true, reason: 'no_address' });
  }

  // Geocode customer address
  const dest = await geocodeAddress(customerAddress);
  if (!dest) {
    // Geocoding failed — allow arrival as fallback
    await supabase
      .from('route_stops')
      .update({ arrived_at: new Date().toISOString() })
      .eq('id', stopId);
    return NextResponse.json({ ok: true, reason: 'geocode_failed' });
  }

  // Check distance
  const distanceMeters = haversineMeters(driverLat, driverLng, dest.lat, dest.lng);

  if (distanceMeters > ARRIVAL_RADIUS_METERS) {
    return NextResponse.json({
      ok: false,
      reason: 'too_far',
      distance_meters: Math.round(distanceMeters),
      threshold_meters: ARRIVAL_RADIUS_METERS,
    });
  }

  // Driver is near — mark arrived
  await supabase
    .from('route_stops')
    .update({ arrived_at: new Date().toISOString() })
    .eq('id', stopId);

  // Log arrival event
  const route = stop.routes as unknown as { driver_id: string; drivers: { name: string } } | null;
  if (route && invoice) {
    await logActivity({
      driver_id: route.driver_id,
      driver_name: route.drivers?.name || 'Driver',
      event_type: 'arrived',
      stop_id: stopId,
      customer_name: invoice.customer_name,
      invoice_number: invoice.invoice_number,
      message: `${route.drivers?.name} arrived at ${invoice.customer_name}`,
    });
  }

  return NextResponse.json({ ok: true, distance_meters: Math.round(distanceMeters) });
}
