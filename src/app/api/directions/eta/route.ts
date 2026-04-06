import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

interface RouteMatrixEntry {
  originIndex: number;
  destinationIndex: number;
  duration?: string; // e.g. "1234s"
  distanceMeters?: number;
  condition?: string;
  error?: { code: number; message: string };
}

export async function POST(request: NextRequest) {
  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });
  }

  const { origin_lat, origin_lng, destinations } = await request.json();

  if (!origin_lat || !origin_lng || !destinations || !Array.isArray(destinations) || destinations.length === 0) {
    return NextResponse.json({ error: 'Missing origin coordinates or destinations' }, { status: 400 });
  }

  // Build destination waypoints — prefer address for accuracy
  const destWaypoints = destinations.map((d: { address?: string; lat?: number; lng?: number }) => {
    if (d.address) {
      return { waypoint: { address: d.address } };
    }
    if (d.lat && d.lng) {
      return { waypoint: { location: { latLng: { latitude: d.lat, longitude: d.lng } } } };
    }
    return null;
  }).filter(Boolean);

  if (destWaypoints.length === 0) {
    return NextResponse.json({ error: 'No valid destinations' }, { status: 400 });
  }

  // Google Routes API: Compute Route Matrix
  // Max 25 origins × destinations per request
  const body = {
    origins: [
      {
        waypoint: {
          location: {
            latLng: { latitude: origin_lat, longitude: origin_lng },
          },
        },
      },
    ],
    destinations: destWaypoints,
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
  };

  const res = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,condition',
    },
    body: JSON.stringify(body),
  });

  const entries: RouteMatrixEntry[] = await res.json();

  if (!Array.isArray(entries)) {
    const errData = entries as unknown as { error?: { message?: string } };
    return NextResponse.json(
      { error: errData?.error?.message || 'Routes API error' },
      { status: 502 }
    );
  }

  // Sort by destinationIndex and build results
  const sorted = [...entries].sort((a, b) => a.destinationIndex - b.destinationIndex);

  const etas = sorted.map((entry) => {
    if (entry.error || !entry.duration) {
      return { duration_minutes: null, duration_text: null, distance_text: null };
    }

    // Duration comes as "1234s" string
    const durationSec = parseInt(entry.duration.replace('s', ''), 10);
    const minutes = Math.round(durationSec / 60);

    // Distance in meters → miles
    const distMiles = entry.distanceMeters ? (entry.distanceMeters / 1609.344) : null;
    const distText = distMiles !== null ? `${distMiles.toFixed(1)} mi` : null;

    // Human-readable duration
    let durationText: string;
    if (minutes < 60) {
      durationText = `${minutes} min`;
    } else {
      const hrs = Math.floor(minutes / 60);
      const mins = minutes % 60;
      durationText = mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
    }

    return {
      duration_minutes: minutes,
      duration_text: durationText,
      distance_text: distText,
    };
  });

  return NextResponse.json({ etas });
}
