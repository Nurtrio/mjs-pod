import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const driverId = request.nextUrl.searchParams.get('driver_id');
  const date = request.nextUrl.searchParams.get('date') ?? new Date().toISOString().split('T')[0];

  let query = supabase
    .from('routes')
    .select('*, driver:drivers(*), stops:route_stops(*, invoice:invoices(*))')
    .eq('route_date', date)
    .order('created_at', { ascending: false });

  if (driverId) {
    query = query.eq('driver_id', driverId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sorted = (data ?? []).map((route) => ({
    ...route,
    stops: (route.stops ?? []).sort(
      (a: { stop_order: number }, b: { stop_order: number }) => a.stop_order - b.stop_order
    ),
  }));

  return NextResponse.json(sorted);
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json();

  // Support both single route { driver_id, stops } and batch { routes: [...] }
  const routeEntries: { driver_id: string; route_date?: string; stops: { invoice_id: string; stop_order: number }[] }[] = [];

  if (body.routes && Array.isArray(body.routes)) {
    routeEntries.push(...body.routes);
  } else if (body.driver_id && body.stops) {
    routeEntries.push(body);
  } else {
    return NextResponse.json({ error: 'Provide { driver_id, stops } or { routes: [...] }' }, { status: 400 });
  }

  const results = [];

  for (const entry of routeEntries) {
    const { driver_id, stops } = entry;
    if (!driver_id || !stops || stops.length === 0) continue;

    const routeDate = entry.route_date ?? new Date().toISOString().split('T')[0];

    // Delete existing route for this driver+date
    const { data: existing } = await supabase
      .from('routes')
      .select('id')
      .eq('driver_id', driver_id)
      .eq('route_date', routeDate);

    if (existing && existing.length > 0) {
      const existingIds = existing.map((r) => r.id);
      const { data: oldStops } = await supabase
        .from('route_stops')
        .select('invoice_id')
        .in('route_id', existingIds);

      if (oldStops && oldStops.length > 0) {
        await supabase.from('invoices').update({ status: 'unassigned' }).in('id', oldStops.map((s) => s.invoice_id));
      }

      await supabase.from('route_stops').delete().in('route_id', existingIds);
      await supabase.from('routes').delete().in('id', existingIds);
    }

    // Create route
    const { data: route, error: routeError } = await supabase
      .from('routes')
      .insert({ driver_id, route_date: routeDate, status: 'pending' })
      .select()
      .single();

    if (routeError) {
      results.push({ driver_id, error: routeError.message });
      continue;
    }

    // Create stops
    const stopRows = stops.map((s) => ({
      route_id: route.id,
      invoice_id: s.invoice_id,
      stop_order: s.stop_order,
      status: 'pending',
    }));

    const { error: stopsError } = await supabase.from('route_stops').insert(stopRows);
    if (stopsError) {
      results.push({ driver_id, error: stopsError.message });
      continue;
    }

    // Update invoice statuses
    await supabase.from('invoices').update({ status: 'assigned' }).in('id', stops.map((s) => s.invoice_id));

    // Fetch complete route
    const { data: fullRoute } = await supabase
      .from('routes')
      .select('*, driver:drivers(*), stops:route_stops(*, invoice:invoices(*))')
      .eq('id', route.id)
      .single();

    results.push(fullRoute);
  }

  return NextResponse.json(results, { status: 201 });
}
