import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ stopId: string }> }
) {
  const { stopId } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('route_stops')
    .select('*, invoice:invoices(*)')
    .eq('id', stopId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ stopId: string }> }
) {
  const { stopId } = await params;
  const supabase = createServerClient();

  const body = await request.json();

  // Only allow updating known fields
  const allowedFields = [
    'status',
    'signature_storage_path',
    'photo_storage_path',
    'notes',
    'gps_lat',
    'gps_lng',
    'completed_at',
    'pod_pdf_storage_path',
    'google_drive_file_id',
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('route_stops')
    .update(updates)
    .eq('id', stopId)
    .select('*, invoice:invoices(*)')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ stopId: string }> }
) {
  const { stopId } = await params;
  const supabase = createServerClient();

  // Get the stop to find the invoice
  const { data: stop } = await supabase
    .from('route_stops')
    .select('invoice_id, route_id')
    .eq('id', stopId)
    .single();

  if (!stop) {
    return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
  }

  // Delete the stop
  const { error } = await supabase
    .from('route_stops')
    .delete()
    .eq('id', stopId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Set the invoice back to unassigned
  await supabase
    .from('invoices')
    .update({ status: 'unassigned' })
    .eq('id', stop.invoice_id);

  // Re-number remaining stops
  const { data: remainingStops } = await supabase
    .from('route_stops')
    .select('id')
    .eq('route_id', stop.route_id)
    .order('stop_order', { ascending: true });

  if (remainingStops) {
    for (let i = 0; i < remainingStops.length; i++) {
      await supabase
        .from('route_stops')
        .update({ stop_order: i + 1 })
        .eq('id', remainingStops[i].id);
    }
  }

  return NextResponse.json({ ok: true });
}
