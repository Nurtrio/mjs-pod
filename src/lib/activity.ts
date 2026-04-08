import { createServerClient } from '@/lib/supabase/server';

interface LogEventParams {
  driver_id: string;
  driver_name: string;
  event_type: string;
  stop_id?: string;
  customer_name?: string;
  invoice_number?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity(params: LogEventParams) {
  try {
    const supabase = createServerClient();
    await supabase.from('activity_log').insert({
      driver_id: params.driver_id,
      driver_name: params.driver_name,
      event_type: params.event_type,
      stop_id: params.stop_id || null,
      customer_name: params.customer_name || null,
      invoice_number: params.invoice_number || null,
      message: params.message,
      metadata: params.metadata || {},
    });
  } catch {
    // Never let logging break the main flow
  }
}
