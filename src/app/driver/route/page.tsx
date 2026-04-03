'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDriverStore } from '@/lib/store';
import type { RouteWithDetails, RouteStop, Invoice } from '@/types';

type StopWithInvoice = RouteStop & { invoice: Invoice };

const DRIVER_COLORS: Record<string, string> = {
  Erik: '#3b82f6',
  Jose: '#f59e0b',
  Al: '#8b5cf6',
};

function getDriverColor(name: string): string {
  for (const [key, color] of Object.entries(DRIVER_COLORS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return color;
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 60%, 55%)`;
}

export default function DriverRoutePage() {
  const router = useRouter();
  const driver = useDriverStore((s) => s.driver);
  const setDriver = useDriverStore((s) => s.setDriver);
  const [route, setRoute] = useState<RouteWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoute = useCallback(async () => {
    if (!driver) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/routes?driver_id=${driver.id}`);
      if (!res.ok) throw new Error(`Failed to load route (${res.status})`);
      const data = await res.json();
      const routes = Array.isArray(data) ? data : data.routes ? data.routes : [data];
      const today = new Date().toISOString().slice(0, 10);
      const todayRoute = routes.find((r: RouteWithDetails) => r.route_date?.slice(0, 10) === today) || routes[0] || null;
      setRoute(todayRoute);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load route');
    } finally {
      setLoading(false);
    }
  }, [driver]);

  useEffect(() => {
    if (!driver) {
      router.replace('/driver');
      return;
    }
    fetchRoute();
  }, [driver, router, fetchRoute]);

  if (!driver) return null;

  const stops: StopWithInvoice[] = route?.stops ?? [];
  const completedCount = stops.filter((s) => s.status === 'completed').length;
  const totalCount = stops.length;
  const pendingStops = stops.filter((s) => s.status !== 'completed');
  const completedStops = stops.filter((s) => s.status === 'completed');
  const driverColor = getDriverColor(driver.name);
  const driverInitial = driver.name.charAt(0).toUpperCase();

  const handleLogout = () => {
    setDriver(null);
    router.replace('/driver');
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background">
      {/* Driver header card */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-center gap-4 rounded-2xl bg-card p-5" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[22px] font-bold text-white"
            style={{ backgroundColor: driverColor }}
          >
            {driverInitial}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[24px] font-bold tracking-tight text-foreground">{driver.name}</h1>
            <p className="text-[15px] text-muted">{dateStr}</p>
          </div>
          <button
            type="button"
            onClick={fetchRoute}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-background text-muted transition-all duration-150 active:scale-[0.9] active:bg-[#e5e5ea]"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            aria-label="Refresh route"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-[17px] text-muted">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading route...
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-2xl bg-danger/10 px-6 py-5 text-center text-[17px] text-danger">
            {error}
          </div>
        )}

        {/* No route */}
        {!loading && !error && !route && (
          <div className="flex flex-col items-center justify-center py-20 gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted-2/20">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-10 w-10 text-muted">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            </div>
            <p className="text-[20px] font-semibold text-muted">No deliveries today</p>
            <p className="text-[15px] text-muted-2">Pull down or tap refresh to check again</p>
          </div>
        )}

        {/* Route with stops */}
        {!loading && !error && route && (
          <>
            {/* Progress bar */}
            <div className="mb-5 rounded-2xl bg-card p-5" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-[20px] font-bold text-foreground">
                  {completedCount}/{totalCount}
                </span>
                <span className="text-[15px] font-medium text-muted">
                  {totalCount > 0 ? `${Math.round((completedCount / totalCount) * 100)}% complete` : 'No stops'}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-700 ease-out"
                  style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
                />
              </div>
            </div>

            {/* All done celebration */}
            {totalCount > 0 && completedCount === totalCount && (
              <div className="my-8 flex flex-col items-center justify-center gap-4 rounded-2xl bg-accent/8 py-10" style={{ animation: 'spring-in 0.5s ease-out' }}>
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent/15">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-12 w-12 text-accent" style={{ animation: 'checkDraw 0.5s ease-out forwards' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-[24px] font-bold text-accent">All Done!</p>
                <p className="text-[15px] text-muted">Great work today, {driver.name}</p>
              </div>
            )}

            {/* Pending stops */}
            {pendingStops.length > 0 && (
              <div className="mb-5">
                <p className="mb-3 px-1 text-[13px] font-semibold uppercase tracking-wider text-muted">
                  Up Next
                </p>
                <div className="space-y-3">
                  {pendingStops.map((stop, idx) => (
                    <button
                      key={stop.id}
                      onClick={() => router.push(`/driver/deliver/${stop.id}`)}
                      className="flex w-full items-center gap-4 rounded-2xl bg-card p-5 text-left transition-all duration-150 active:scale-[0.98] active:bg-card-hover"
                      style={{
                        WebkitTapHighlightColor: 'transparent',
                        boxShadow: idx === 0
                          ? '0 2px 12px rgba(52,199,89,0.12), 0 1px 4px rgba(0,0,0,0.04)'
                          : '0 1px 8px rgba(0,0,0,0.04)',
                        border: idx === 0 ? '1.5px solid rgba(52,199,89,0.25)' : '1px solid transparent',
                      }}
                    >
                      {/* Stop number */}
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[18px] font-bold text-white"
                        style={{ backgroundColor: idx === 0 ? 'var(--accent)' : 'var(--blue)' }}
                      >
                        {stop.stop_order}
                      </div>
                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[18px] font-semibold text-foreground">
                          {stop.invoice?.customer_name || 'Unknown Customer'}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[14px] font-medium text-muted">
                            INV #{stop.invoice?.invoice_number || '—'}
                          </span>
                          {stop.invoice?.customer_address && (
                            <>
                              <span className="text-muted-2">·</span>
                              <span className="truncate text-[14px] text-muted-2">
                                {stop.invoice.customer_address}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Arrow */}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4 text-muted">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Completed stops */}
            {completedStops.length > 0 && (
              <div className="mb-5">
                <p className="mb-3 px-1 text-[13px] font-semibold uppercase tracking-wider text-muted">
                  Completed
                </p>
                <div className="space-y-2">
                  {completedStops.map((stop) => (
                    <div
                      key={stop.id}
                      className="flex w-full items-center gap-4 rounded-2xl bg-card/60 p-4"
                      style={{ boxShadow: '0 0.5px 4px rgba(0,0,0,0.03)' }}
                    >
                      {/* Checkmark */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/12">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5 text-accent">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </div>
                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-semibold text-foreground/60">
                          {stop.invoice?.customer_name || 'Unknown Customer'}
                        </p>
                        <p className="text-[13px] text-muted-2">
                          INV #{stop.invoice?.invoice_number || '—'}
                        </p>
                      </div>
                      {/* Badge */}
                      <span className="shrink-0 rounded-full bg-accent/10 px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-accent">
                        Done
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Log out button */}
        <div className="mt-10 pb-8">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-2xl bg-card py-4 text-center text-[17px] font-semibold text-danger transition-all duration-150 active:scale-[0.98] active:bg-card-hover"
            style={{ WebkitTapHighlightColor: 'transparent', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
