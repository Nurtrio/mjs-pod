import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { invoice_ids } = await request.json();

  if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
    return NextResponse.json({ error: 'No invoice IDs provided' }, { status: 400 });
  }

  // Find any route_stops linked to these invoices
  const { data: stops } = await supabase
    .from('route_stops')
    .select('id, route_id')
    .in('invoice_id', invoice_ids);

  if (stops && stops.length > 0) {
    const stopIds = stops.map((s) => s.id);
    const routeIds = [...new Set(stops.map((s) => s.route_id))];

    // Delete the stops
    await supabase.from('route_stops').delete().in('id', stopIds);

    // Delete any routes that now have zero stops
    for (const routeId of routeIds) {
      const { count } = await supabase
        .from('route_stops')
        .select('id', { count: 'exact', head: true })
        .eq('route_id', routeId);

      if (count === 0) {
        await supabase.from('routes').delete().eq('id', routeId);
      }
    }
  }

  // Delete the invoices themselves
  await supabase.from('invoices').delete().in('id', invoice_ids);

  return NextResponse.json({ ok: true, deleted: invoice_ids.length });
}
