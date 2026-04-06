'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDriverStore } from '@/lib/store';
import type { RouteWithDetails, RouteStop, Invoice } from '@/types';

type StopWithInvoice = RouteStop & { invoice: Invoice };

function StopDetailSheet({ stops, onClose, onDeliver }: { stops: StopWithInvoice[]; onClose: () => void; onDeliver: (stop: StopWithInvoice) => void }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const isMulti = stops.length > 1;
  const [activeIdx, setActiveIdx] = useState(0);
  const stop = stops[activeIdx];
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  const pdfPath = stop.invoice?.pdf_storage_path;
  const pdfUrl = pdfPath ? `${supabaseUrl}/storage/v1/object/public/invoices/${pdfPath}` : null;
  const isCompleted = stop.status === 'completed';
  const [showTab, setShowTab] = useState<'invoice' | 'pod'>(isCompleted ? 'pod' : 'invoice');

  // POD document URLs for completed stops
  const podPdfUrl = stop.pod_pdf_storage_path
    ? `${supabaseUrl}/storage/v1/object/public/pods/${stop.pod_pdf_storage_path}`
    : null;
  const signatureUrl = stop.signature_storage_path
    ? `${supabaseUrl}/storage/v1/object/public/signatures/${stop.signature_storage_path}`
    : null;
  const photoUrl = stop.photo_storage_path
    ? `${supabaseUrl}/storage/v1/object/public/photos/${stop.photo_storage_path}`
    : null;

  const completedTime = stop.completed_at
    ? new Date(stop.completed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;

  // Swipe handling for multi-invoice navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const handleTouchEnd = () => {
    if (!isMulti) return;
    if (touchDeltaX.current < -60 && activeIdx < stops.length - 1) {
      setActiveIdx(activeIdx + 1);
      setShowTab(stops[activeIdx + 1].status === 'completed' ? 'pod' : 'invoice');
    } else if (touchDeltaX.current > 60 && activeIdx > 0) {
      setActiveIdx(activeIdx - 1);
      setShowTab(stops[activeIdx - 1].status === 'completed' ? 'pod' : 'invoice');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-t-[28px] bg-card"
        style={{ maxHeight: '90vh', animation: 'slide-up 0.3s cubic-bezier(0.32,0.72,0,1)', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-[5px] w-10 rounded-full bg-muted-2/40" />
        </div>

        <div
          className="overflow-y-auto px-6 pb-4"
          style={{ maxHeight: 'calc(90vh - 60px)' }}
          onTouchStart={isMulti ? handleTouchStart : undefined}
          onTouchMove={isMulti ? handleTouchMove : undefined}
          onTouchEnd={isMulti ? handleTouchEnd : undefined}
        >
          {/* Multi-invoice switcher */}
          {isMulti && (
            <div className="mb-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => { if (activeIdx > 0) { setActiveIdx(activeIdx - 1); setShowTab(stops[activeIdx - 1].status === 'completed' ? 'pod' : 'invoice'); } }}
                disabled={activeIdx === 0}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-background transition-all active:scale-90 disabled:opacity-30"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <div className="flex flex-1 items-center justify-center gap-2">
                {stops.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setActiveIdx(i); setShowTab(stops[i].status === 'completed' ? 'pod' : 'invoice'); }}
                    className="flex items-center justify-center rounded-full text-[13px] font-bold transition-all"
                    style={{
                      width: activeIdx === i ? 32 : 10,
                      height: activeIdx === i ? 32 : 10,
                      background: activeIdx === i ? '#ff9500' : 'rgba(142,142,147,0.2)',
                      color: activeIdx === i ? '#fff' : 'transparent',
                    }}
                  >
                    {activeIdx === i ? i + 1 : ''}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => { if (activeIdx < stops.length - 1) { setActiveIdx(activeIdx + 1); setShowTab(stops[activeIdx + 1].status === 'completed' ? 'pod' : 'invoice'); } }}
                disabled={activeIdx === stops.length - 1}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-background transition-all active:scale-90 disabled:opacity-30"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          )}
          {isMulti && (
            <div className="mb-3 rounded-xl bg-[#ff9500]/8 px-4 py-2.5 text-center">
              <p className="text-[14px] font-semibold text-[#ff9500]">
                Invoice {activeIdx + 1} of {stops.length} for this customer
                <span className="ml-2 text-[12px] font-normal text-[#ff9500]/70">Swipe or tap arrows</span>
              </p>
            </div>
          )}

          {/* Customer & Address */}
          <div className="mb-4">
            <p className="text-[14px] font-semibold uppercase tracking-wider text-muted">Stop {stop.stop_order}</p>
            <h2 className="mt-1 text-[28px] font-bold leading-tight text-foreground">{stop.invoice?.customer_name || 'Unknown'}</h2>
            {stop.invoice?.customer_address && (
              <div className="mt-3 flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ios-blue/10">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 text-ios-blue">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                </div>
                <p className="text-[20px] font-semibold leading-snug text-foreground">{stop.invoice.customer_address}</p>
              </div>
            )}
            <div className="mt-3 flex items-center gap-3">
              <p className="text-[17px] font-medium text-ios-blue">INV #{stop.invoice?.invoice_number || '—'}</p>
              {completedTime && (
                <span className="rounded-full bg-accent/10 px-3 py-1 text-[13px] font-semibold text-accent">
                  Delivered at {completedTime}
                </span>
              )}
            </div>
          </div>

          {/* Tab switcher for completed stops */}
          {isCompleted && (
            <div className="mb-5 flex gap-2 rounded-xl bg-background p-1.5">
              <button
                type="button"
                onClick={() => setShowTab('pod')}
                className="flex-1 rounded-lg py-3 text-[15px] font-semibold transition-all duration-200"
                style={{
                  background: showTab === 'pod' ? 'var(--card)' : 'transparent',
                  color: showTab === 'pod' ? 'var(--accent)' : 'var(--muted)',
                  boxShadow: showTab === 'pod' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Signed POD
              </button>
              <button
                type="button"
                onClick={() => setShowTab('invoice')}
                className="flex-1 rounded-lg py-3 text-[15px] font-semibold transition-all duration-200"
                style={{
                  background: showTab === 'invoice' ? 'var(--card)' : 'transparent',
                  color: showTab === 'invoice' ? 'var(--ios-blue)' : 'var(--muted)',
                  boxShadow: showTab === 'invoice' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Original Invoice
              </button>
            </div>
          )}

          {/* POD Tab — signed paperwork */}
          {isCompleted && showTab === 'pod' && (
            <div className="space-y-5 mb-5">
              {/* POD PDF */}
              {podPdfUrl && (
                <div className="overflow-hidden rounded-2xl border border-border">
                  <div className="flex items-center gap-3 border-b border-border bg-background px-5 py-3">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 text-danger">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <span className="text-[15px] font-semibold text-foreground">Signed POD Document</span>
                  </div>
                  <iframe
                    src={`${podPdfUrl}#toolbar=0&navpanes=0&view=FitH`}
                    className="h-[350px] w-full border-0"
                    title="POD PDF"
                  />
                </div>
              )}

              {/* Signature */}
              {signatureUrl && (
                <div className="rounded-2xl border border-border overflow-hidden">
                  <div className="flex items-center gap-3 border-b border-border bg-background px-5 py-3">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 text-ios-blue">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                    </svg>
                    <span className="text-[15px] font-semibold text-foreground">Customer Signature</span>
                  </div>
                  <div className="bg-white p-4">
                    <img src={signatureUrl} alt="Signature" className="h-[120px] w-full object-contain" />
                  </div>
                </div>
              )}

              {/* Photo */}
              {photoUrl && (
                <div className="rounded-2xl border border-border overflow-hidden">
                  <div className="flex items-center gap-3 border-b border-border bg-background px-5 py-3">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 text-accent">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                    <span className="text-[15px] font-semibold text-foreground">Delivery Photo</span>
                  </div>
                  <img src={photoUrl} alt="Delivery" className="w-full object-contain" style={{ maxHeight: 300, background: '#000' }} />
                </div>
              )}

              {/* Dwell time & notes */}
              {(stop.dwell_seconds || stop.notes) && (
                <div className="rounded-2xl bg-background p-5">
                  {stop.dwell_seconds != null && (
                    <p className="text-[15px] text-muted">
                      <span className="font-semibold text-foreground">Dwell time:</span> {Math.floor(stop.dwell_seconds / 60)}m {stop.dwell_seconds % 60}s
                    </p>
                  )}
                  {stop.notes && (
                    <p className="mt-2 text-[15px] text-muted">
                      <span className="font-semibold text-foreground">Notes:</span> {stop.notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Invoice Tab or non-completed view */}
          {(!isCompleted || showTab === 'invoice') && (
            <>
              {pdfUrl && (
                <div className="mb-5 overflow-hidden rounded-2xl border border-border">
                  <iframe
                    src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
                    className="h-[400px] w-full border-0"
                    title="Invoice preview"
                  />
                </div>
              )}

              {!pdfUrl && (
                <div className="mb-5 flex items-center justify-center rounded-2xl bg-background py-10">
                  <p className="text-[16px] text-muted">No PDF attached</p>
                </div>
              )}
            </>
          )}

          {/* Action button */}
          {!isCompleted && (
            <button
              type="button"
              onClick={() => onDeliver(stop)}
              className="w-full rounded-2xl bg-accent py-[18px] text-[20px] font-bold text-white shadow-[0_4px_16px_rgba(52,199,89,0.3)] transition-all duration-150 active:scale-[0.97]"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              Begin Delivery
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

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
  const [selectedGroup, setSelectedGroup] = useState<StopWithInvoice[] | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [removingStopId, setRemovingStopId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<StopWithInvoice | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const handleLongPressStart = (stop: StopWithInvoice) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setEditMode(true);
      // Haptic feedback on supported devices
      if (navigator.vibrate) navigator.vibrate(50);
    }, 800);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleRemoveStop = async (stop: StopWithInvoice) => {
    setRemovingStopId(stop.id);
    try {
      const res = await fetch(`/api/stops/${stop.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove');
      await fetchRoute();
      setConfirmRemove(null);
      // Exit edit mode if no more pending stops
      const remaining = (route?.stops ?? []).filter(s => s.id !== stop.id && s.status !== 'completed');
      if (remaining.length === 0) setEditMode(false);
    } catch {
      // Stay in edit mode
    } finally {
      setRemovingStopId(null);
    }
  };

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

  // Group stops by customer address for multi-invoice display
  type StopGroup = { key: string; stops: StopWithInvoice[]; customerName: string; address: string };
  const groupStops = (stopsToGroup: StopWithInvoice[]): StopGroup[] => {
    const groups: Record<string, StopWithInvoice[]> = {};
    for (const s of stopsToGroup) {
      const addr = (s.invoice?.customer_address || '').trim().toLowerCase();
      const name = (s.invoice?.customer_name || '').trim().toLowerCase();
      // Group by address if available, else by customer name
      const key = addr || name || s.id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return Object.entries(groups).map(([key, grpStops]) => ({
      key,
      stops: grpStops,
      customerName: grpStops[0].invoice?.customer_name || 'Unknown',
      address: grpStops[0].invoice?.customer_address || '',
    }));
  };

  const pendingGroups = groupStops(pendingStops);
  const completedGroups = groupStops(completedStops);
  const driverColor = getDriverColor(driver.name);
  const driverInitial = driver.name.charAt(0).toUpperCase();

  const handleLogout = () => {
    setDriver(null);
    router.replace('/driver');
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-[calc(100vh-72px)] bg-background">
      {/* Compact driver header with integrated progress */}
      <div className="px-5 pt-5 pb-2">
        <div className="rounded-2xl bg-card" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          {/* Top row: avatar, name, date, count, refresh */}
          <div className="flex items-center gap-4 px-5 pt-4 pb-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[17px] font-bold text-white"
              style={{ backgroundColor: driverColor }}
            >
              {driverInitial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[20px] font-bold tracking-tight text-foreground">{driver.name}</h1>
                <span className="text-[13px] font-medium text-muted">{dateStr}</span>
              </div>
            </div>
            {route && totalCount > 0 && (
              <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: completedCount === totalCount ? 'rgba(52,199,89,0.12)' : 'var(--background)' }}>
                <span className="text-[18px] font-bold" style={{ color: completedCount === totalCount ? 'var(--accent)' : 'var(--foreground)' }}>
                  {completedCount}/{totalCount}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={fetchRoute}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background text-muted transition-all duration-150 active:scale-[0.9]"
              style={{ WebkitTapHighlightColor: 'transparent' }}
              aria-label="Refresh route"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4.5 w-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
            </button>
          </div>
          {/* Thin progress bar at bottom of header */}
          {route && totalCount > 0 && (
            <div className="px-5 pb-4">
              <div className="h-[6px] w-full overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${(completedCount / totalCount) * 100}%`,
                    background: completedCount === totalCount
                      ? 'linear-gradient(90deg, #34c759, #30d158)'
                      : `linear-gradient(90deg, ${driverColor}, ${driverColor}dd)`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-5">
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
            {/* Progress bar is now integrated in the header above */}

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
              <div className="mb-6">
                <div className="mb-4 flex items-center justify-between px-1">
                  <p className="text-[14px] font-semibold uppercase tracking-wider text-muted">
                    {editMode ? 'Editing Route' : 'Up Next'}
                  </p>
                  {editMode && (
                    <button
                      type="button"
                      onClick={() => setEditMode(false)}
                      className="rounded-lg bg-accent px-4 py-2 text-[14px] font-bold text-white transition-all duration-150 active:scale-95"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      Done
                    </button>
                  )}
                  {!editMode && pendingStops.length > 0 && (
                    <p className="text-[12px] text-muted-2">Hold to edit</p>
                  )}
                </div>
                <div className="space-y-4">
                  {pendingGroups.map((group, gIdx) => {
                    const firstStop = group.stops[0];
                    const isMulti = group.stops.length > 1;
                    return (
                      <div key={group.key} className="relative">
                        {/* Red X remove button — visible in edit mode (removes first stop or all in group) */}
                        {editMode && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setConfirmRemove(firstStop); }}
                            className="absolute -left-2 -top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-danger text-white shadow-lg transition-transform duration-150 active:scale-90"
                            style={{ animation: 'spring-in 0.25s ease-out', WebkitTapHighlightColor: 'transparent' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="h-4 w-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => { if (!longPressTriggered.current && !editMode) setSelectedGroup(group.stops); }}
                          onTouchStart={() => handleLongPressStart(firstStop)}
                          onTouchEnd={handleLongPressEnd}
                          onTouchCancel={handleLongPressEnd}
                          onMouseDown={() => handleLongPressStart(firstStop)}
                          onMouseUp={handleLongPressEnd}
                          onMouseLeave={handleLongPressEnd}
                          className="flex w-full items-start gap-5 rounded-2xl bg-card p-6 text-left transition-all duration-150 active:scale-[0.98] active:bg-card-hover"
                          style={{
                            WebkitTapHighlightColor: 'transparent',
                            minHeight: 100,
                            boxShadow: gIdx === 0
                              ? '0 2px 12px rgba(52,199,89,0.12), 0 1px 4px rgba(0,0,0,0.04)'
                              : '0 1px 8px rgba(0,0,0,0.04)',
                            border: gIdx === 0 ? '2px solid rgba(52,199,89,0.25)' : '1px solid transparent',
                            animation: editMode ? 'wiggle 0.3s ease-in-out infinite alternate' : 'none',
                          }}
                        >
                          {/* Stop number */}
                          <div
                            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[20px] font-bold text-white"
                            style={{ backgroundColor: gIdx === 0 ? 'var(--accent)' : 'var(--blue)' }}
                          >
                            {firstStop.stop_order}
                          </div>
                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3">
                              <p className="text-[24px] font-bold text-foreground">
                                {group.customerName || 'Unknown Customer'}
                              </p>
                              {isMulti && (
                                <span
                                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold"
                                  style={{ background: '#ff9500', color: '#fff', animation: 'spring-in 0.3s ease-out' }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-3.5 w-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                  </svg>
                                  {group.stops.length} invoices
                                </span>
                              )}
                            </div>
                            {group.address && (
                              <p className="mt-1.5 text-[19px] font-semibold leading-snug text-foreground/80">
                                {group.address}
                              </p>
                            )}
                            {isMulti ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {group.stops.map((s) => (
                                  <span key={s.id} className="rounded-lg bg-background px-2.5 py-1 text-[13px] font-semibold text-muted">
                                    INV #{s.invoice?.invoice_number || '—'}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-2 text-[15px] font-medium text-muted">
                                INV #{firstStop.invoice?.invoice_number || '—'}
                              </p>
                            )}
                          </div>
                          {/* Arrow */}
                          {!editMode && (
                            <div className="mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5 text-muted">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                              </svg>
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Completed stops */}
            {completedGroups.length > 0 && (
              <div className="mb-6">
                <p className="mb-4 px-1 text-[14px] font-semibold uppercase tracking-wider text-muted">
                  Completed
                </p>
                <div className="space-y-3">
                  {completedGroups.map((group) => {
                    const firstStop = group.stops[0];
                    const isMulti = group.stops.length > 1;
                    return (
                      <button
                        key={group.key}
                        onClick={() => setSelectedGroup(group.stops)}
                        className="flex w-full items-center gap-5 rounded-2xl bg-card/60 p-5 text-left transition-all duration-150 active:scale-[0.98]"
                        style={{ boxShadow: '0 0.5px 4px rgba(0,0,0,0.03)', WebkitTapHighlightColor: 'transparent' }}
                      >
                        {/* Checkmark */}
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/12">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-6 w-6 text-accent">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        </div>
                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-[20px] font-semibold text-foreground/60">
                              {group.customerName || 'Unknown Customer'}
                            </p>
                            {isMulti && (
                              <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[12px] font-bold text-accent">
                                {group.stops.length} inv
                              </span>
                            )}
                          </div>
                          {isMulti ? (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {group.stops.map((s) => (
                                <span key={s.id} className="text-[13px] text-muted-2">
                                  #{s.invoice?.invoice_number || '—'}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[14px] text-muted-2">
                              INV #{firstStop.invoice?.invoice_number || '—'}
                            </p>
                          )}
                        </div>
                        {/* Arrow */}
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5 shrink-0 text-muted-2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Log out button */}
        <div className="mt-12 pb-10">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-2xl bg-card py-5 text-center text-[18px] font-semibold text-danger transition-all duration-150 active:scale-[0.98] active:bg-card-hover"
            style={{ WebkitTapHighlightColor: 'transparent', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}
          >
            Log Out
          </button>
        </div>
      </div>

      {/* Stop Detail Sheet */}
      {selectedGroup && (
        <StopDetailSheet
          stops={selectedGroup}
          onClose={() => setSelectedGroup(null)}
          onDeliver={(stop) => {
            setSelectedGroup(null);
            router.push(`/driver/deliver/${stop.id}`);
          }}
        />
      )}

      {/* Confirm Remove Dialog */}
      {confirmRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          onClick={() => setConfirmRemove(null)}
        >
          <div
            className="mx-6 w-full max-w-sm overflow-hidden rounded-[22px] bg-card"
            style={{ animation: 'spring-in 0.3s cubic-bezier(0.32,0.72,0,1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-danger/10">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-8 w-8 text-danger">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </div>
              <h3 className="text-[20px] font-bold text-foreground">Remove Stop?</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                Remove <span className="font-semibold text-foreground">{confirmRemove.invoice?.customer_name}</span> from your route? The invoice will go back to unassigned.
              </p>
            </div>
            <div className="flex border-t border-separator">
              <button
                type="button"
                onClick={() => setConfirmRemove(null)}
                className="flex-1 border-r border-separator py-4 text-[17px] font-normal text-ios-blue"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRemoveStop(confirmRemove)}
                disabled={removingStopId === confirmRemove.id}
                className="flex-1 py-4 text-[17px] font-semibold text-danger disabled:opacity-50"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {removingStopId === confirmRemove.id ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes wiggle {
          0% { transform: rotate(-0.5deg); }
          100% { transform: rotate(0.5deg); }
        }
        @keyframes spring-in {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
