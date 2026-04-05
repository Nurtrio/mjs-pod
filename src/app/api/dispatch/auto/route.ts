import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { classifyByZip, classifyWithAI, optimizeRouteOrder } from '@/lib/territories';
import type { TerritoryAssignment } from '@/types';

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json();

  // Expect: { invoice_ids: string[] } — IDs of uploaded invoices to dispatch
  const invoiceIds: string[] = body.invoice_ids;

  if (!invoiceIds || invoiceIds.length === 0) {
    return NextResponse.json({ error: 'No invoice IDs provided' }, { status: 400 });
  }

  // 1. Fetch invoice data
  const { data: invoices, error: invErr } = await supabase
    .from('invoices')
    .select('*')
    .in('id', invoiceIds);

  if (invErr || !invoices) {
    return NextResponse.json({ error: invErr?.message ?? 'Failed to fetch invoices' }, { status: 500 });
  }

  // 2. Fetch territories
  const { data: territories, error: tErr } = await supabase
    .from('driver_territories')
    .select('*, driver:drivers(name)')
    .order('priority', { ascending: false });

  if (tErr || !territories || territories.length === 0) {
    return NextResponse.json({ error: 'No territories configured' }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enrichedTerritories = territories.map((t: any) => ({
    ...t,
    driver_name: t.driver?.name ?? 'Unknown',
  }));

  // 3. Classify each invoice to a territory
  const addressItems = invoices.map((inv, i) => ({
    index: i,
    address: inv.customer_address || '',
  }));

  const { classified, unclassified } = classifyByZip(addressItems, enrichedTerritories);

  let aiClassified: TerritoryAssignment[] = [];
  if (unclassified.length > 0) {
    try {
      aiClassified = await classifyWithAI(unclassified, enrichedTerritories);
    } catch {
      // Load-balance fallback
      const driverIds = [...new Set(enrichedTerritories.map((t) => t.driver_id))];
      aiClassified = unclassified.map((item, idx) => {
        const targetIdx = idx % driverIds.length;
        const target = enrichedTerritories.find((t) => t.driver_id === driverIds[targetIdx]);
        return {
          invoice_index: item.index,
          driver_id: target?.driver_id ?? driverIds[0],
          driver_name: target?.driver_name ?? 'Unknown',
          confidence: 'low' as const,
          reasoning: 'AI unavailable, assigned by round-robin',
        };
      });
    }
  }

  const allAssignments = [...classified, ...aiClassified];

  // 4. Group by driver
  const grouped: Record<string, { invoice: typeof invoices[0]; assignment: TerritoryAssignment }[]> = {};
  for (const assignment of allAssignments) {
    const invoice = invoices[assignment.invoice_index];
    if (!invoice) continue;
    if (!grouped[assignment.driver_id]) grouped[assignment.driver_id] = [];
    grouped[assignment.driver_id].push({ invoice, assignment });
  }

  // 5. Optimize route order for each driver
  const routeDate = new Date().toISOString().split('T')[0];
  const createdRoutes = [];

  for (const [driverId, items] of Object.entries(grouped)) {
    // Prepare stops for optimization
    const stopsForOpt = items.map((item, i) => ({
      index: i,
      address: item.invoice.customer_address || '',
      invoice_number: item.invoice.invoice_number,
    }));

    let optimizedOrder: number[];
    try {
      optimizedOrder = await optimizeRouteOrder(stopsForOpt);
    } catch {
      optimizedOrder = stopsForOpt.map((s) => s.index);
    }

    // Delete existing route for this driver+date
    const { data: existing } = await supabase
      .from('routes')
      .select('id')
      .eq('driver_id', driverId)
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
      .insert({ driver_id: driverId, route_date: routeDate, status: 'pending' })
      .select()
      .single();

    if (routeError) {
      createdRoutes.push({ driver_id: driverId, error: routeError.message });
      continue;
    }

    // Create stops in optimized order
    const stopRows = optimizedOrder.map((origIdx, stopOrder) => ({
      route_id: route.id,
      invoice_id: items[origIdx].invoice.id,
      stop_order: stopOrder + 1,
      status: 'pending',
    }));

    await supabase.from('route_stops').insert(stopRows);

    // Update invoice statuses
    await supabase.from('invoices').update({ status: 'assigned' }).in('id', items.map((it) => it.invoice.id));

    // Fetch complete route
    const { data: fullRoute } = await supabase
      .from('routes')
      .select('*, driver:drivers(*), stops:route_stops(*, invoice:invoices(*))')
      .eq('id', route.id)
      .single();

    if (fullRoute) {
      fullRoute.stops = (fullRoute.stops ?? []).sort(
        (a: { stop_order: number }, b: { stop_order: number }) => a.stop_order - b.stop_order,
      );
    }

    createdRoutes.push(fullRoute);
  }

  return NextResponse.json({
    assignments: allAssignments,
    routes: createdRoutes,
  }, { status: 201 });
}
