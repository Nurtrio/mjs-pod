import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('route_stops')
    .select('id, completed_at, dwell_seconds, gps_lat, gps_lng, backorder_notes, invoice:invoices(customer_name, invoice_number), route:routes(route_date, driver:drivers(name))')
    .eq('status', 'completed')
    .not('gps_lat', 'is', null)
    .not('gps_lng', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(5000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten the nested joins for the frontend
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pins = (data ?? []).map((s: any) => ({
    id: s.id,
    gps_lat: s.gps_lat,
    gps_lng: s.gps_lng,
    completed_at: s.completed_at,
    dwell_seconds: s.dwell_seconds,
    backorder_notes: s.backorder_notes,
    customer_name: s.invoice?.customer_name || 'Unknown',
    invoice_number: s.invoice?.invoice_number || 'N/A',
    driver_name: s.route?.driver?.name || 'Unknown',
    route_date: s.route?.route_date || '',
  }));

  return NextResponse.json(pins);
}
