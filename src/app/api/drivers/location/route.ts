import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { geocodeAddress, haversineMeters } from '@/lib/geocode';

const STATIONARY_SPEED_THRESHOLD = 0.9; // m/s (~2 mph)
const STOP_PROXIMITY_METERS = 250; // within 250m of a stop = "at stop"


// POST: Driver sends GPS position
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json();

  const { driver_id, lat, lng, heading, speed, accuracy } = body;

  if (!driver_id || lat == null || lng == null) {
    return NextResponse.json({ error: 'driver_id, lat, lng required' }, { status: 400 });
  }

  const isStationary = speed != null && Math.abs(speed) < STATIONARY_SPEED_THRESHOLD;

  // 1. Upsert current location (latest position)
  await supabase
    .from('driver_locations')
    .upsert(
      {
        driver_id,
        lat,
        lng,
        heading: heading ?? null,
        speed: speed ?? null,
        accuracy: accuracy ?? null,
        recorded_at: new Date().toISOString(),
      },
      { onConflict: 'driver_id' },
    );

  // 2. Store in history
  await supabase.from('driver_location_history').insert({
    driver_id,
    lat,
    lng,
    heading: heading ?? null,
    speed: speed ?? null,
    accuracy: accuracy ?? null,
    is_stationary: isStationary,
    recorded_at: new Date().toISOString(),
  });

  // 3. Detect if driver is at a delivery stop (check today's route)
  if (isStationary) {
    const today = new Date().toISOString().split('T')[0];

    const { data: routes } = await supabase
      .from('routes')
      .select('id')
      .eq('driver_id', driver_id)
      .eq('route_date', today);

    if (routes && routes.length > 0) {
      const routeIds = routes.map((r) => r.id);

      const { data: stops } = await supabase
        .from('route_stops')
        .select('id, status, gps_lat, gps_lng, arrived_at, invoice:invoices(customer_address)')
        .in('route_id', routeIds)
        .eq('status', 'pending');

      if (stops) {
        for (const stop of stops) {
          if (stop.arrived_at) continue;

          let stopLat: number | null = null;
          let stopLng: number | null = null;

          // Use existing GPS coords if available (from a prior delivery at same address)
          if (stop.gps_lat && stop.gps_lng) {
            stopLat = Number(stop.gps_lat);
            stopLng = Number(stop.gps_lng);
          } else {
            // Geocode the customer address for proximity check
            const addr = (stop.invoice as unknown as { customer_address?: string })?.customer_address;
            if (addr) {
              const geo = await geocodeAddress(addr);
              if (geo) {
                stopLat = geo.lat;
                stopLng = geo.lng;
              }
            }
          }

          if (stopLat != null && stopLng != null) {
            const dist = haversineMeters(lat, lng, stopLat, stopLng);
            if (dist < STOP_PROXIMITY_METERS) {
              await supabase
                .from('route_stops')
                .update({ arrived_at: new Date().toISOString() })
                .eq('id', stop.id);
            }
          }
        }
      }
    }
  }

  // 4. Periodically clean old history (delete > 48h, do it 1% of the time to avoid overhead)
  if (Math.random() < 0.01) {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    await supabase.from('driver_location_history').delete().lt('recorded_at', cutoff);
  }

  return NextResponse.json({ ok: true, stationary: isStationary });
}

// GET: Fetch all current driver locations with activity status
export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const withActivity = request.nextUrl.searchParams.get('activity') === 'true';

  const { data: locations, error } = await supabase
    .from('driver_locations')
    .select('*, driver:drivers(name)')
    .order('recorded_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!withActivity || !locations) {
    return NextResponse.json(locations ?? []);
  }

  // Enrich with activity status
  const today = new Date().toISOString().split('T')[0];
  const enriched = await Promise.all(
    locations.map(async (loc) => {
      // Get recent history to determine activity
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentPings } = await supabase
        .from('driver_location_history')
        .select('lat, lng, speed, is_stationary, recorded_at')
        .eq('driver_id', loc.driver_id)
        .gte('recorded_at', fiveMinAgo)
        .order('recorded_at', { ascending: false })
        .limit(30);

      const stationaryCount = recentPings?.filter((p) => p.is_stationary).length ?? 0;
      const totalCount = recentPings?.length ?? 0;
      const stationaryPct = totalCount > 0 ? stationaryCount / totalCount : 0;

      // Check if at a stop
      const { data: activeStops } = await supabase
        .from('routes')
        .select('stops:route_stops(id, stop_order, arrived_at, status, invoice:invoices(customer_name, invoice_number))')
        .eq('driver_id', loc.driver_id)
        .eq('route_date', today);

      let activity: {
        status: 'en_route' | 'at_stop' | 'stationary' | 'idle';
        stop_name?: string;
        stop_number?: number;
        dwell_minutes?: number;
      } = { status: 'idle' };

      if (activeStops && activeStops.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allStops = activeStops.flatMap((r: any) => r.stops || []);
        const atStop = allStops.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (s: any) => s.arrived_at && s.status === 'pending',
        );

        if (atStop) {
          const dwellMs = Date.now() - new Date(atStop.arrived_at).getTime();
          activity = {
            status: 'at_stop',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            stop_name: (atStop.invoice as any)?.customer_name || 'Unknown',
            stop_number: atStop.stop_order,
            dwell_minutes: Math.round(dwellMs / 60000),
          };
        } else if (stationaryPct > 0.7) {
          // Stationary but not near a known stop
          const firstStationary = recentPings
            ?.filter((p) => p.is_stationary)
            .slice(-1)[0];
          const dwellMs = firstStationary
            ? Date.now() - new Date(firstStationary.recorded_at).getTime()
            : 0;
          activity = {
            status: 'stationary',
            dwell_minutes: Math.round(dwellMs / 60000),
          };
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const nextStop = allStops.find((s: any) => s.status === 'pending' && !s.arrived_at);
          activity = {
            status: 'en_route',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            stop_name: nextStop ? (nextStop.invoice as any)?.customer_name : undefined,
            stop_number: nextStop?.stop_order,
          };
        }
      }

      return { ...loc, activity };
    }),
  );

  return NextResponse.json(enriched);
}
