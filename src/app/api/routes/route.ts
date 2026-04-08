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
  const routeEntries: {
    driver_id: string;
    route_date?: string;
    stops: { invoice_id: string; stop_order: number; stop_type?: string }[];
  }[] = [];

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

    // Check for existing route for this driver+date
    const { data: existing } = await supabase
      .from('routes')
      .select('id')
      .eq('driver_id', driver_id)
      .eq('route_date', routeDate)
      .limit(1);

    let routeId: string;

    if (existing && existing.length > 0) {
      routeId = existing[0].id;

      // Get existing stops — preserve completed/skipped ones
      const { data: existingStops } = await supabase
        .from('route_stops')
        .select('id, invoice_id, status')
        .eq('route_id', routeId);

      const completedStopInvoiceIds = new Set(
        (existingStops ?? [])
          .filter((s) => s.status === 'completed' || s.status === 'skipped')
          .map((s) => s.invoice_id)
      );

      // Only delete PENDING stops that are no longer in the new list
      const newInvoiceIds = new Set(stops.map((s) => s.invoice_id));
      const pendingToDelete = (existingStops ?? []).filter(
        (s) => s.status === 'pending' && !newInvoiceIds.has(s.invoice_id)
      );

      if (pendingToDelete.length > 0) {
        const deleteIds = pendingToDelete.map((s) => s.id);
        // Reset removed invoices back to unassigned
        const removedInvoiceIds = pendingToDelete.map((s) => s.invoice_id);
        await supabase.from('invoices').update({ status: 'unassigned' }).in('id', removedInvoiceIds);
        await supabase.from('route_stops').delete().in('id', deleteIds);
      }

      // Figure out which new stops to add (not already existing as completed or pending)
      const allExistingInvoiceIds = new Set((existingStops ?? []).map((s) => s.invoice_id));

      const stopsToAdd = stops.filter(
        (s) => !allExistingInvoiceIds.has(s.invoice_id)
      );

      // Update stop_order for existing pending stops that are still in the list
      for (const stop of stops) {
        if (allExistingInvoiceIds.has(stop.invoice_id) && !completedStopInvoiceIds.has(stop.invoice_id)) {
          const existingStop = (existingStops ?? []).find((s) => s.invoice_id === stop.invoice_id);
          if (existingStop) {
            await supabase
              .from('route_stops')
              .update({ stop_order: stop.stop_order })
              .eq('id', existingStop.id);
          }
        }
      }

      // Insert new stops
      if (stopsToAdd.length > 0) {
        const stopRows = stopsToAdd.map((s) => ({
          route_id: routeId,
          invoice_id: s.invoice_id,
          stop_order: s.stop_order,
          stop_type: s.stop_type || 'delivery',
          status: 'pending',
        }));

        await supabase.from('route_stops').insert(stopRows);
        await supabase.from('invoices').update({ status: 'assigned' }).in('id', stopsToAdd.map((s) => s.invoice_id));
      }

      // Update route status back to in_progress if it was completed and we added new stops
      if (stopsToAdd.length > 0) {
        const { data: routeData } = await supabase
          .from('routes')
          .select('status')
          .eq('id', routeId)
          .single();

        if (routeData?.status === 'completed') {
          await supabase.from('routes').update({ status: 'in_progress' }).eq('id', routeId);
        }
      }
    } else {
      // No existing route — create fresh
      const { data: route, error: routeError } = await supabase
        .from('routes')
        .insert({ driver_id, route_date: routeDate, status: 'pending' })
        .select()
        .single();

      if (routeError) {
        results.push({ driver_id, error: routeError.message });
        continue;
      }

      routeId = route.id;

      const stopRows = stops.map((s) => ({
        route_id: routeId,
        invoice_id: s.invoice_id,
        stop_order: s.stop_order,
        stop_type: s.stop_type || 'delivery',
        status: 'pending',
      }));

      const { error: stopsError } = await supabase.from('route_stops').insert(stopRows);
      if (stopsError) {
        results.push({ driver_id, error: stopsError.message });
        continue;
      }

      await supabase.from('invoices').update({ status: 'assigned' }).in('id', stops.map((s) => s.invoice_id));
    }

    // Fetch complete route
    const { data: fullRoute } = await supabase
      .from('routes')
      .select('*, driver:drivers(*), stops:route_stops(*, invoice:invoices(*))')
      .eq('id', routeId)
      .single();

    results.push(fullRoute);
  }

  return NextResponse.json(results, { status: 201 });
}
