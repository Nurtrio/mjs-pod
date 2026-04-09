'use client';

import { useEffect, useState, useCallback } from 'react';
import Nav from '@/components/nav';
import InvoiceCard from '@/components/invoice-card';
import DriverColumn from '@/components/driver-column';
import type { Driver, Invoice, RouteStop, Route } from '@/types';
import { countDeliveryStops, countCompletedDeliveryStops } from '@/lib/route-utils';

interface DriverRoute {
  route: Route;
  stops: (RouteStop & { invoice: Invoice })[];
  dirty: boolean;
}

export default function RoutesPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [unassigned, setUnassigned] = useState<Invoice[]>([]);
  const [routes, setRoutes] = useState<Record<string, DriverRoute>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isOverUnassigned, setIsOverUnassigned] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const todayISO = new Date().toISOString().split('T')[0];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [driversRes, routesRes, invoicesRes] = await Promise.all([
        fetch('/api/drivers'),
        fetch(`/api/routes?date=${todayISO}`),
        fetch('/api/invoices?status=unassigned'),
      ]);

      const driversData = await driversRes.json();
      const routesData = await routesRes.json();
      const invoicesData = await invoicesRes.json();

      const driverList: Driver[] = driversData.drivers ?? driversData ?? [];
      setDrivers(driverList);

      const routeList = routesData.routes ?? routesData ?? [];
      const invoiceList: Invoice[] = invoicesData.invoices ?? invoicesData ?? [];

      const routeMap: Record<string, DriverRoute> = {};
      for (const d of driverList) {
        const existingRoute = routeList.find((r: Route) => r.driver_id === d.id);
        routeMap[d.id] = {
          route: existingRoute ?? {
            id: `new-${d.id}`,
            driver_id: d.id,
            route_date: todayISO,
            status: 'pending' as const,
            created_at: new Date().toISOString(),
          },
          stops: existingRoute?.stops ?? [],
          dirty: false,
        };
      }
      setRoutes(routeMap);
      setUnassigned(invoiceList);
    } catch {
      showToast('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [todayISO]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const findAndRemoveInvoice = (invoiceId: string): Invoice | null => {
    const uIdx = unassigned.findIndex((i) => i.id === invoiceId);
    if (uIdx !== -1) {
      const invoice = unassigned[uIdx];
      setUnassigned((prev) => prev.filter((i) => i.id !== invoiceId));
      return invoice;
    }
    for (const dId of Object.keys(routes)) {
      const sIdx = routes[dId].stops.findIndex((s) => s.invoice_id === invoiceId);
      if (sIdx !== -1) {
        const stop = routes[dId].stops[sIdx];
        // Don't allow removing completed stops
        if (stop.status === 'completed') return null;
        const invoice = stop.invoice;
        setRoutes((prev) => ({
          ...prev,
          [dId]: {
            ...prev[dId],
            stops: prev[dId].stops.filter((s) => s.invoice_id !== invoiceId),
            dirty: true,
          },
        }));
        return invoice;
      }
    }
    return null;
  };

  const handleDropOnDriver = (invoiceId: string, driverId: string) => {
    const invoice = findAndRemoveInvoice(invoiceId);
    if (!invoice) return;

    setRoutes((prev) => {
      const driverRoute = prev[driverId];
      if (!driverRoute) return prev;

      const newStop: RouteStop & { invoice: Invoice } = {
        id: `temp-${invoiceId}-${Date.now()}`,
        route_id: driverRoute.route.id,
        invoice_id: invoiceId,
        stop_order: driverRoute.stops.length + 1,
        status: 'pending',
        stop_type: invoice.ticket_type || 'delivery',
        signature_storage_path: null,
        photo_storage_path: null,
        pod_pdf_storage_path: null,
        google_drive_file_id: null,
        completed_at: null,
        arrived_at: null,
        departed_at: null,
        dwell_seconds: null,
        gps_lat: null,
        gps_lng: null,
        notes: null,
        invoice,
      };

      return {
        ...prev,
        [driverId]: {
          ...driverRoute,
          stops: [...driverRoute.stops, newStop],
          dirty: true,
        },
      };
    });
  };

  const handleDropOnUnassigned = (invoiceId: string) => {
    const invoice = findAndRemoveInvoice(invoiceId);
    if (!invoice) return;
    setUnassigned((prev) => [...prev, invoice]);
  };

  const handleRemoveStop = (driverId: string, invoiceId: string) => {
    const driverRoute = routes[driverId];
    if (!driverRoute) return;
    const stop = driverRoute.stops.find((s) => s.invoice_id === invoiceId);
    if (!stop || stop.status === 'completed') return;

    setRoutes((prev) => ({
      ...prev,
      [driverId]: {
        ...prev[driverId],
        stops: prev[driverId].stops.filter((s) => s.invoice_id !== invoiceId),
        dirty: true,
      },
    }));
    setUnassigned((prev) => [...prev, stop.invoice]);
  };

  const dirtyCount = Object.values(routes).filter((r) => r.dirty).length;

  const saveRoutes = async () => {
    setSaving(true);
    try {
      // Only save routes that were modified
      const dirtyRoutes = Object.entries(routes).filter(([, val]) => val.dirty);

      if (dirtyRoutes.length === 0) {
        showToast('No changes to save');
        setSaving(false);
        return;
      }

      const payload = dirtyRoutes
        .filter(([, val]) => val.stops.length > 0)
        .map(([driverId, val]) => ({
          driver_id: driverId,
          route_date: todayISO,
          stops: val.stops.map((s, i) => ({
            invoice_id: s.invoice_id,
            stop_order: i + 1,
            stop_type: s.stop_type || 'delivery',
          })),
        }));

      if (payload.length === 0) {
        showToast('No routes to save — assign invoices to drivers first');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routes: payload }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Save failed');
      }

      // Mark saved routes as clean
      setRoutes((prev) => {
        const updated = { ...prev };
        for (const [dId] of dirtyRoutes) {
          if (updated[dId]) {
            updated[dId] = { ...updated[dId], dirty: false };
          }
        }
        return updated;
      });

      showToast(`Saved ${dirtyRoutes.length} route${dirtyRoutes.length > 1 ? 's' : ''}`);
      // Refresh to get real IDs from server
      await fetchData();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to save routes');
    } finally {
      setSaving(false);
    }
  };

  const clearAll = () => {
    const allInvoices = [...unassigned];
    for (const dId of Object.keys(routes)) {
      for (const stop of routes[dId].stops) {
        // Only clear pending stops
        if (stop.status !== 'completed') {
          allInvoices.push(stop.invoice);
        }
      }
    }
    setUnassigned(allInvoices);
    setRoutes((prev) => {
      const updated = { ...prev };
      for (const dId of Object.keys(updated)) {
        const completedStops = updated[dId].stops.filter((s) => s.status === 'completed');
        const hadPending = updated[dId].stops.length > completedStops.length;
        updated[dId] = {
          ...updated[dId],
          stops: completedStops,
          dirty: hadPending ? true : updated[dId].dirty,
        };
      }
      return updated;
    });
    setConfirmClear(false);
    showToast('Pending assignments cleared');
  };

  const getRouteStatusLabel = (driverRoute: DriverRoute) => {
    const routeStatus = driverRoute.route.status;
    // Use grouped counts — multi-invoice customers = 1 delivery stop
    const totalStops = countDeliveryStops(driverRoute.stops);
    const completedStops = countCompletedDeliveryStops(driverRoute.stops);

    if (totalStops === 0) return null;
    if (routeStatus === 'completed' || (completedStops === totalStops && totalStops > 0)) {
      return { label: 'Complete', color: '#34c759', bg: 'rgba(52,199,89,0.1)' };
    }
    if (routeStatus === 'in_progress' || completedStops > 0) {
      return { label: `${completedStops}/${totalStops} done`, color: '#007aff', bg: 'rgba(0,122,255,0.1)' };
    }
    return { label: `${totalStops} stops`, color: '#8e8e93', bg: 'rgba(142,142,147,0.1)' };
  };

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--background)' }}>
      <Nav />

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 72,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'saturate(180%) blur(20px)',
            WebkitBackdropFilter: 'saturate(180%) blur(20px)',
            borderRadius: 14,
            padding: '12px 22px',
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--accent)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            border: '0.5px solid rgba(52,199,89,0.2)',
            animation: 'slideDown 0.35s cubic-bezier(0.32,0.72,0,1)',
            whiteSpace: 'nowrap',
          }}
        >
          {toast}
        </div>
      )}

      {/* Confirm Clear Dialog */}
      {confirmClear && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.25)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 320,
              background: 'var(--card)',
              borderRadius: 22,
              overflow: 'hidden',
              animation: 'spring-in 0.3s cubic-bezier(0.32,0.72,0,1)',
            }}
          >
            <div style={{ padding: '24px 24px 20px', textAlign: 'center' }}>
              <h3 style={{ fontSize: 17, fontWeight: 600, color: 'var(--foreground)', margin: 0, marginBottom: 6 }}>
                Clear Pending Assignments?
              </h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.45 }}>
                This will move pending invoices back to Unassigned. Completed deliveries will not be affected.
              </p>
            </div>
            <div style={{ display: 'flex', borderTop: '0.5px solid var(--separator)' }}>
              <button
                onClick={() => setConfirmClear(false)}
                style={{
                  flex: 1, padding: '14px 0', background: 'transparent', border: 'none',
                  borderRight: '0.5px solid var(--separator)', fontSize: 17, fontWeight: 400,
                  color: 'var(--blue)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={clearAll}
                style={{
                  flex: 1, padding: '14px 0', background: 'transparent', border: 'none',
                  fontSize: 17, fontWeight: 600, color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Clear Pending
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 px-5 pb-10 pt-6">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: 0.37, color: 'var(--foreground)', lineHeight: 1.2, margin: 0 }}>
            Route Builder
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={() => setConfirmClear(true)}
              disabled={saving}
              style={{
                background: 'transparent', border: 'none', fontSize: 17, fontWeight: 400,
                color: 'var(--danger)', cursor: 'pointer', padding: 0,
                opacity: saving ? 0.4 : 1, fontFamily: 'inherit',
              }}
            >
              Clear All
            </button>
            <button
              onClick={saveRoutes}
              disabled={saving || dirtyCount === 0}
              className="ios-button"
              style={{
                background: dirtyCount > 0 ? 'var(--accent)' : 'var(--muted-2)',
                color: '#ffffff', border: 'none', borderRadius: 12, padding: '10px 22px',
                fontSize: 15, fontWeight: 600, cursor: saving || dirtyCount === 0 ? 'default' : 'pointer',
                opacity: saving ? 0.5 : 1, fontFamily: 'inherit',
                transition: 'background 0.2s ease',
              }}
            >
              {saving ? 'Saving...' : dirtyCount > 0 ? `Save ${dirtyCount} Route${dirtyCount > 1 ? 's' : ''}` : 'Saved'}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
            <div
              style={{
                width: 28, height: 28, border: '2.5px solid var(--muted-2)',
                borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              }}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
            {/* Unassigned Column */}
            <div
              style={{
                width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column',
                background: isOverUnassigned ? 'rgba(52,199,89,0.04)' : 'var(--card)',
                borderRadius: 16,
                border: isOverUnassigned ? '1px solid rgba(52,199,89,0.35)' : '0.5px solid var(--border)',
                transition: 'all 0.2s ease',
                boxShadow: isOverUnassigned ? '0 0 20px rgba(52,199,89,0.08)' : 'none',
              }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setIsOverUnassigned(true); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsOverUnassigned(false); }}
              onDrop={(e) => {
                e.preventDefault(); setIsOverUnassigned(false);
                const invoiceId = e.dataTransfer.getData('text/plain');
                if (invoiceId) handleDropOnUnassigned(invoiceId);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '0.5px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Unassigned</h3>
                  <span style={{ background: 'rgba(60,60,67,0.08)', color: 'var(--muted)', fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 100 }}>
                    {unassigned.length}
                  </span>
                </div>
                {unassigned.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ids = unassigned.map((inv) => inv.id);
                      try {
                        await fetch('/api/invoices/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoice_ids: ids }) });
                      } catch { /* best effort */ }
                      setUnassigned([]);
                      showToast('Unassigned invoices cleared');
                    }}
                    style={{
                      padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      background: 'rgba(255,59,48,0.08)', color: '#ff3b30',
                    }}
                  >
                    Clear All
                  </button>
                )}
              </div>
              <div style={{ flex: 1, padding: 8, overflowY: 'auto', minHeight: 120, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {unassigned.map((invoice) => (
                  <InvoiceCard key={invoice.id} invoice={invoice} />
                ))}
                {unassigned.length === 0 && (
                  <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted-2)', padding: '32px 0', margin: 0 }}>
                    All invoices assigned
                  </p>
                )}
              </div>
            </div>

            {/* Driver Columns */}
            {drivers
              .filter((d) => d.active)
              .map((driver) => {
                const driverRoute = routes[driver.id];
                const statusInfo = driverRoute ? getRouteStatusLabel(driverRoute) : null;
                return (
                  <DriverColumn
                    key={driver.id}
                    driverId={driver.id}
                    driverName={driver.name}
                    stops={driverRoute?.stops ?? []}
                    dirty={driverRoute?.dirty ?? false}
                    statusInfo={statusInfo}
                    onDrop={handleDropOnDriver}
                    onRemoveStop={handleRemoveStop}
                  />
                );
              })}
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideDown {
          0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
