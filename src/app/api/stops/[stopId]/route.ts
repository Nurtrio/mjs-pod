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
