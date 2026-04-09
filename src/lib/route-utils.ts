import type { Invoice, RouteStop } from '@/types';

type StopWithInvoice = RouteStop & { invoice: Invoice };

/**
 * Group stops by customer address (or name if no address).
 * Each group = 1 physical delivery stop, even if it has multiple invoices.
 */
export function groupStopsByCustomer(stops: StopWithInvoice[]) {
  const groups: Record<string, StopWithInvoice[]> = {};
  for (const s of stops) {
    const addr = (s.invoice?.customer_address || '').trim().toLowerCase();
    const name = (s.invoice?.customer_name || '').trim().toLowerCase();
    const key = addr || name || s.id;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  return Object.values(groups);
}

/**
 * Count the number of unique delivery stops (grouped by customer).
 */
export function countDeliveryStops(stops: StopWithInvoice[]): number {
  return groupStopsByCustomer(stops).length;
}

/**
 * Count completed delivery stops (a group is complete when ALL its invoices are completed).
 */
export function countCompletedDeliveryStops(stops: StopWithInvoice[]): number {
  const groups = groupStopsByCustomer(stops);
  return groups.filter((g) => g.every((s) => s.status === 'completed')).length;
}
