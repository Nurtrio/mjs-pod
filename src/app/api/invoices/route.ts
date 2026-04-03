import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const status = request.nextUrl.searchParams.get('status');

  let query = supabase.from('invoices').select('*').order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();

  const body = await request.json();
  const { invoice_number, customer_name, customer_address, pdf_storage_path } = body;

  if (!invoice_number) {
    return NextResponse.json({ error: 'invoice_number is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      invoice_number,
      customer_name: customer_name ?? null,
      customer_address: customer_address ?? null,
      pdf_storage_path: pdf_storage_path ?? null,
      status: 'unassigned',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
