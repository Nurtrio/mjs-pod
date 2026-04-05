import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ stopId: string }> },
) {
  const { stopId } = await params;
  const supabase = createServerClient();

  // Only set arrived_at if not already set
  const { data: stop } = await supabase
    .from('route_stops')
    .select('arrived_at')
    .eq('id', stopId)
    .single();

  if (stop && !stop.arrived_at) {
    await supabase
      .from('route_stops')
      .update({ arrived_at: new Date().toISOString() })
      .eq('id', stopId);
  }

  return NextResponse.json({ ok: true });
}
