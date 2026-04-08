import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const search = request.nextUrl.searchParams.get('search') || '';
  const dateFrom = request.nextUrl.searchParams.get('date_from') || '';
  const dateTo = request.nextUrl.searchParams.get('date_to') || '';

  // Query completed route_stops joined with invoices and drivers
  let query = supabase
    .from('route_stops')
    .select(`
      id,
      status,
      completed_at,
      pod_pdf_storage_path,
      signature_storage_path,
      photo_storage_path,
      dwell_seconds,
      backorder_notes,
      invoice:invoices(id, invoice_number, customer_name, customer_address),
      route:routes(id, route_date, driver:drivers(id, name))
    `)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });

  if (dateFrom) {
    query = query.gte('completed_at', `${dateFrom}T00:00:00`);
  }
  if (dateTo) {
    query = query.lte('completed_at', `${dateTo}T23:59:59`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten for the frontend
  const rows = (data ?? [])
    .map((stop) => {
      const inv = stop.invoice as unknown as {
        id: string;
        invoice_number: string;
        customer_name: string | null;
        customer_address: string | null;
      } | null;
      const rt = stop.route as unknown as {
        id: string;
        route_date: string;
        driver: { id: string; name: string } | null;
      } | null;

      return {
        id: stop.id,
        invoice_number: inv?.invoice_number || 'N/A',
        customer_name: inv?.customer_name || null,
        driver_name: rt?.driver?.name || null,
        completed_at: stop.completed_at,
        pod_pdf_storage_path: stop.pod_pdf_storage_path,
        signature_storage_path: stop.signature_storage_path,
        photo_storage_path: stop.photo_storage_path,
        backorder_notes: stop.backorder_notes,
        dwell_seconds: stop.dwell_seconds,
      };
    })
    .filter((row) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        row.invoice_number.toLowerCase().includes(s) ||
        (row.customer_name?.toLowerCase().includes(s) ?? false) ||
        (row.driver_name?.toLowerCase().includes(s) ?? false)
      );
    });

  return NextResponse.json(rows);
}
