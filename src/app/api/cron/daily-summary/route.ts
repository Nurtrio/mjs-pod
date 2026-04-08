import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
import { buildBackorderSummaryHtml } from '@/lib/email-templates';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Verify cron secret in production (Vercel sets this header automatically)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

  // Fetch all routes for today with stops, invoices, drivers
  const { data: routes, error } = await supabase
    .from('routes')
    .select('*, driver:drivers(*), stops:route_stops(*, invoice:invoices(*))')
    .eq('route_date', today);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build summary data
  const backorders: { customerName: string; invoiceNumber: string; driverName: string; backorderNotes: string }[] = [];
  const deliveries: { customerName: string; invoiceNumber: string; driverName: string; completedAt: string | null; dwellSeconds: number | null; hasBackorder: boolean }[] = [];
  const driverMap = new Map<string, { name: string; totalStops: number; completedStops: number; completedAt: string | null }>();
  let totalDelivered = 0;

  for (const route of routes ?? []) {
    const driverName = route.driver?.name || 'Unknown';
    const stops = route.stops ?? [];
    let latestCompleted: string | null = null;
    let completedCount = 0;

    for (const stop of stops) {
      const hasBO = !!(stop.backorder_notes && stop.backorder_notes.trim());

      if (stop.status === 'completed') {
        totalDelivered++;
        completedCount++;
        if (!latestCompleted || (stop.completed_at && stop.completed_at > latestCompleted)) {
          latestCompleted = stop.completed_at;
        }

        deliveries.push({
          customerName: stop.invoice?.customer_name || 'Unknown',
          invoiceNumber: stop.invoice?.invoice_number || 'N/A',
          driverName,
          completedAt: stop.completed_at,
          dwellSeconds: stop.dwell_seconds,
          hasBackorder: hasBO,
        });
      }

      if (hasBO) {
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
      completedStops: completedCount,
      completedAt: latestCompleted,
    });
  }

  // Skip email if no routes/deliveries today
  if ((routes ?? []).length === 0) {
    return NextResponse.json({ skipped: true, reason: 'No routes today' });
  }

  const summaryData = {
    date: today,
    totalDelivered,
    totalBackorders: backorders.length,
    totalDrivers: driverMap.size,
    backorders,
    drivers: Array.from(driverMap.values()),
    deliveries,
  };

  const html = buildBackorderSummaryHtml(summaryData);
  const subject = `MJS Daily Delivery Report — ${new Date(today + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`;

  const recipient = process.env.BACKORDER_SUMMARY_EMAIL || 'Nick@mobilejanitorialsupply.com';

  try {
    await sendEmail({ to: recipient, subject, html });
    return NextResponse.json({
      success: true,
      sent_to: recipient,
      date: today,
      delivered: totalDelivered,
      backorders: backorders.length,
      drivers: driverMap.size,
    });
  } catch (emailErr) {
    return NextResponse.json(
      { error: `Email failed: ${emailErr instanceof Error ? emailErr.message : emailErr}` },
      { status: 500 },
    );
  }
}
