import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
import { buildBackorderSummaryHtml } from '@/lib/email-templates';

export async function POST(request: NextRequest) {
  const supabase = createServerClient();

  // Optional: pass a date, default to today
  let date: string;
  try {
    const body = await request.json();
    date = body.date || new Date().toISOString().split('T')[0];
  } catch {
    date = new Date().toISOString().split('T')[0];
  }

  // Fetch all routes for the date with stops, invoices, drivers
  const { data: routes, error } = await supabase
    .from('routes')
    .select('*, driver:drivers(*), stops:route_stops(*, invoice:invoices(*))')
    .eq('route_date', date);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build summary data
  const backorders: { customerName: string; invoiceNumber: string; driverName: string; backorderNotes: string }[] = [];
  const driverMap = new Map<string, { name: string; totalStops: number; completedAt: string | null }>();
  let totalDelivered = 0;

  for (const route of routes ?? []) {
    const driverName = route.driver?.name || 'Unknown';
    const stops = route.stops ?? [];
    let latestCompleted: string | null = null;

    for (const stop of stops) {
      if (stop.status === 'completed') {
        totalDelivered++;
        if (!latestCompleted || (stop.completed_at && stop.completed_at > latestCompleted)) {
          latestCompleted = stop.completed_at;
        }
      }

      if (stop.backorder_notes && stop.backorder_notes.trim()) {
        backorders.push({
          customerName: stop.invoice?.customer_name || 'Unknown',
          invoiceNumber: stop.invoice?.invoice_number || 'N/A',
          driverName,
          backorderNotes: stop.backorder_notes.trim(),
        });
      }
    }

    driverMap.set(route.driver_id, {
      name: driverName,
      totalStops: stops.length,
      completedAt: latestCompleted,
    });
  }

  const summaryData = {
    date,
    totalDelivered,
    totalBackorders: backorders.length,
    totalDrivers: driverMap.size,
    backorders,
    drivers: Array.from(driverMap.values()),
  };

  const html = buildBackorderSummaryHtml(summaryData);
  const subject = `MJS Daily Backorder Summary — ${new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`;

  // Send to configured recipient(s)
  const recipient = process.env.BACKORDER_SUMMARY_EMAIL || 'Zack@mobilejanitorialsupply.com';

  try {
    await sendEmail({ to: recipient, subject, html });
    return NextResponse.json({ success: true, sent_to: recipient, backorders: backorders.length });
  } catch (emailErr) {
    return NextResponse.json(
      { error: `Email failed: ${emailErr instanceof Error ? emailErr.message : emailErr}` },
      { status: 500 },
    );
  }
}
