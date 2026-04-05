import { NextRequest, NextResponse } from 'next/server';
import { optimizeRouteOrder } from '@/lib/territories';

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Expect: { stops: [{ index, address, invoice_number }] }
  const stops: { index: number; address: string; invoice_number: string }[] = body.stops;

  if (!stops || stops.length === 0) {
    return NextResponse.json({ error: 'No stops provided' }, { status: 400 });
  }

  try {
    const optimizedOrder = await optimizeRouteOrder(stops);
    return NextResponse.json({ order: optimizedOrder });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Optimization failed';
    // Fallback: return original order
    return NextResponse.json({ order: stops.map((s) => s.index), warning: message });
  }
}
