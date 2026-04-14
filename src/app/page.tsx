'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Nav from '@/components/nav';
import type { RouteWithDetails } from '@/types';
import { countDeliveryStops, countCompletedDeliveryStops, groupStopsByCustomer } from '@/lib/route-utils';

const LiveMap = dynamic(() => import('@/components/live-map'), { ssr: false });
const ActivityFeed = dynamic(() => import('@/components/activity-feed'), { ssr: false });

const DRIVER_COLORS: Record<string, string> = {
  Erik: '#3b82f6',
  Jose: '#f59e0b',
  Al: '#8b5cf6',
};

interface DriverActivity {
  status: 'en_route' | 'at_stop' | 'stationary' | 'idle';
  stop_name?: string;
  stop_number?: number;
  dwell_minutes?: number;
}

interface DriverLoc {
  driver_id: string;
  lat: number;
  lng: number;
  speed: number | null;
  recorded_at: string;
  driver?: { name: string };
  activity?: DriverActivity;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const [routes, setRoutes] = useState<RouteWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState(new Date());
  const [driverActivity, setDriverActivity] = useState<Record<string, DriverActivity | undefined>>({});
  const [driverLocations, setDriverLocations] = useState<Record<string, { lat: number; lng: number }>>({});
  const [driverEtas, setDriverEtas] = useState<Record<string, { minutes: number; distance: string } | null>>({});

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  useEffect(() => {
    const todayISO = new Date().toISOString().split('T')[0];
    fetch(`/api/routes?date=${todayISO}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load routes');
        return r.json();
      })
      .then((data) => setRoutes(data.routes ?? data ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Fetch driver activity for live status on progress bars
  useEffect(() => {
    const fetchActivity = () => {
      fetch('/api/drivers/location?activity=true')
        .then((r) => r.json())
        .then((data: DriverLoc[]) => {
          if (!Array.isArray(data)) return;
          const actMap: Record<string, DriverActivity | undefined> = {};
          const locMap: Record<string, { lat: number; lng: number }> = {};
          for (const loc of data) {
            actMap[loc.driver_id] = loc.activity;
            locMap[loc.driver_id] = { lat: loc.lat, lng: loc.lng };
          }
          setDriverActivity(actMap);
          setDriverLocations(locMap);
        })
        .catch(() => {});
    };
    fetchActivity();
    const interval = setInterval(fetchActivity, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch ETAs from driver position to their next stop
  useEffect(() => {
    if (routes.length === 0 || Object.keys(driverLocations).length === 0) return;

    const fetchEtas = async () => {
      const newEtas: Record<string, { minutes: number; distance: string } | null> = {};
      for (const route of routes) {
        const loc = driverLocations[route.driver_id];
        if (!loc) continue;
        const pendingStops = (route.stops ?? []).filter((s) => s.status !== 'completed');
        const nextStop = pendingStops[0];
        if (!nextStop?.invoice?.customer_address) continue;

        try {
          const res = await fetch('/api/directions/eta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              origin_lat: loc.lat,
              origin_lng: loc.lng,
              destinations: [{ address: nextStop.invoice.customer_address }],
            }),
          });
          if (!res.ok) continue;
          const data = await res.json();
          const eta = data.etas?.[0];
          if (eta?.duration_minutes != null) {
            newEtas[route.driver_id] = { minutes: eta.duration_minutes, distance: eta.distance_text || '' };
          }
        } catch { /* skip */ }
      }
      setDriverEtas(newEtas);
    };

    fetchEtas();
    const interval = setInterval(fetchEtas, 60000); // every 60s for live feel
    return () => clearInterval(interval);
  }, [routes, driverLocations]);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // Use grouped counts — multi-invoice customers = 1 delivery stop
  const totalStops = routes.reduce((sum, r) => sum + countDeliveryStops(r.stops ?? []), 0);
  const completedStops = routes.reduce(
    (sum, r) => sum + countCompletedDeliveryStops(r.stops ?? []),
    0,
  );
  const pendingStops = totalStops - completedStops;
  const backorderStops = routes.reduce(
    (sum, r) => sum + (r.stops?.filter((s) => s.backorder_notes && s.backorder_notes.trim()).length ?? 0),
    0,
  );
  const completionPct = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

  // Average dwell time across all completed stops
  const allDwellSeconds = routes.flatMap((r) =>
    (r.stops ?? []).filter((s) => s.status === 'completed' && s.dwell_seconds != null).map((s) => s.dwell_seconds as number)
  );
  const avgDwellMinutes = allDwellSeconds.length > 0
    ? Math.round(allDwellSeconds.reduce((a, b) => a + b, 0) / allDwellSeconds.length / 60)
    : 0;

  const stats = [
    {
      label: 'Total Deliveries',
      value: totalStops,
      color: '#3b82f6',
      bg: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.02) 100%)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="2" />
          <path d="M16 8h4l3 3v5h-7V8z" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      ),
    },
    {
      label: 'Completed',
      value: completedStops,
      color: '#34c759',
      bg: 'linear-gradient(135deg, rgba(52,199,89,0.08) 0%, rgba(52,199,89,0.02) 100%)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ),
    },
    {
      label: 'Pending',
      value: pendingStops,
      color: '#ff9500',
      bg: 'linear-gradient(135deg, rgba(255,149,0,0.08) 0%, rgba(255,149,0,0.02) 100%)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff9500" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      label: 'Completion',
      value: `${completionPct}%`,
      color: completionPct === 100 ? '#34c759' : '#8b5cf6',
      bg: completionPct === 100
        ? 'linear-gradient(135deg, rgba(52,199,89,0.08) 0%, rgba(52,199,89,0.02) 100%)'
        : 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(139,92,246,0.02) 100%)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={completionPct === 100 ? '#34c759' : '#8b5cf6'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 20V10" />
          <path d="M12 20V4" />
          <path d="M6 20v-6" />
        </svg>
      ),
    },
    {
      label: 'Avg Dwell',
      value: allDwellSeconds.length > 0 ? `${avgDwellMinutes}m` : '—',
      color: '#a78bfa',
      bg: 'linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(167,139,250,0.02) 100%)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
          <path d="M22 12h-2" /><path d="M4 12H2" />
        </svg>
      ),
    },
  ];

  const clockStr = time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  // Get activity label for a driver
  function getActivityInfo(driverId: string, stops: RouteWithDetails['stops']): { text: string; color: string; bgColor: string; eta?: string } {
    const activity = driverActivity[driverId];
    const eta = driverEtas[driverId];
    const etaStr = eta ? `${eta.minutes} min · ${eta.distance}` : undefined;

    if (!activity) return { text: '', color: 'var(--muted)', bgColor: 'rgba(60,60,67,0.06)' };

    const pendingStops = stops.filter((s) => s.status !== 'completed');
    const nextStop = pendingStops[0];

    switch (activity.status) {
      case 'at_stop': {
        const stopName = activity.stop_name || nextStop?.invoice?.customer_name || `Stop #${activity.stop_number}`;
        return {
          text: `At ${stopName}${activity.dwell_minutes ? ` · ${activity.dwell_minutes}m` : ''}`,
          color: '#34c759',
          bgColor: 'rgba(52,199,89,0.1)',
        };
      }
      case 'en_route': {
        const destName = activity.stop_name || nextStop?.invoice?.customer_name || 'next stop';
        return {
          text: `En route to ${destName}`,
          color: '#007aff',
          bgColor: 'rgba(0,122,255,0.1)',
          eta: etaStr,
        };
      }
      case 'stationary':
        return {
          text: `Stopped${activity.dwell_minutes ? ` · ${activity.dwell_minutes}m` : ''}`,
          color: '#ff9500',
          bgColor: 'rgba(255,149,0,0.1)',
          eta: etaStr,
        };
      case 'idle':
      default:
        return { text: 'Idle', color: 'var(--muted)', bgColor: 'rgba(60,60,67,0.06)' };
    }
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--background)' }}>
      <Nav />
      <main style={{ flex: 1, padding: '28px 32px 48px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--foreground)', margin: 0 }}>
                {getGreeting()}
              </h1>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted-2)' }}>{clockStr}</span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, marginTop: 4 }}>{today}</p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Link
              href="/upload"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', fontSize: 13, fontWeight: 600,
                color: 'var(--foreground)', background: 'var(--card)',
                borderRadius: 12, textDecoration: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload Invoices
            </Link>
            <Link
              href="/routes"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', fontSize: 13, fontWeight: 600,
                color: '#fff', background: 'linear-gradient(135deg, #34c759 0%, #28a745 100%)',
                borderRadius: 12, textDecoration: 'none',
                boxShadow: '0 2px 12px rgba(52,199,89,0.3)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="10" r="3" />
                <path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.05 11.5 7.35 11.76a1 1 0 0 0 1.3 0C12.95 21.5 20 15.4 20 10a8 8 0 0 0-8-8z" />
              </svg>
              Build Routes
            </Link>
          </div>
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--muted-2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(255,69,58,0.08)', borderRadius: 14, padding: '14px 18px', fontSize: 14, color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: stat.bg,
                    borderRadius: 16,
                    padding: '18px 20px',
                    border: `1px solid ${stat.color}12`,
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    cursor: 'default',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${stat.color}15`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {stat.icon}
                    </div>
                    {stat.label === 'Completion' && totalStops > 0 && (
                      <div style={{ width: 38, height: 38 }}>
                        <svg viewBox="0 0 36 36" style={{ width: 38, height: 38, transform: 'rotate(-90deg)' }}>
                          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={`${stat.color}20`} strokeWidth="3" />
                          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={stat.color} strokeWidth="3" strokeDasharray={`${completionPct}, 100`} strokeLinecap="round" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: 30, fontWeight: 700, color: 'var(--foreground)', margin: 0, lineHeight: 1, letterSpacing: '-0.03em' }}>
                    {stat.value}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0, marginTop: 5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Driver Progress — full width horizontal cards */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, padding: '0 2px' }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.01em' }}>
                  Driver Progress
                </h2>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {routes.length} route{routes.length !== 1 ? 's' : ''} today
                </span>
              </div>

              {routes.length === 0 ? (
                <div style={{ background: 'var(--card)', borderRadius: 18, padding: '48px 28px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid var(--border)' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(52,199,89,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="3" width="15" height="13" rx="2" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
                    </svg>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', margin: 0, marginBottom: 6 }}>No routes today</p>
                  <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, marginBottom: 20, lineHeight: 1.4 }}>Upload invoices and build routes to get started.</p>
                  <Link href="/routes" style={{ fontSize: 13, fontWeight: 600, color: '#34c759', textDecoration: 'none' }}>
                    Go to Route Builder →
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {routes.map((route) => {
                    const stops = route.stops ?? [];
                    const done = countCompletedDeliveryStops(stops);
                    const total = countDeliveryStops(stops);
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    const driverName = route.driver?.name ?? 'Unknown';
                    const driverColor = DRIVER_COLORS[driverName] ?? '#8b5cf6';
                    const allDone = pct === 100;
                    const actInfo = getActivityInfo(route.driver_id, stops);
                    const driverDwells = stops.filter((s) => s.status === 'completed' && s.dwell_seconds != null).map((s) => s.dwell_seconds as number);
                    const driverAvgDwell = driverDwells.length > 0 ? Math.round(driverDwells.reduce((a, b) => a + b, 0) / driverDwells.length / 60) : null;

                    return (
                      <div
                        key={route.id}
                        style={{
                          background: 'var(--card)',
                          borderRadius: 20,
                          padding: 0,
                          overflow: 'hidden',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 30px ${driverColor}12`;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                        }}
                      >
                        {/* Top bar with driver info */}
                        <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 14,
                            background: allDone ? '#34c759' : driverColor,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: 19, fontWeight: 700, flexShrink: 0,
                          }}>
                            {allDone ? (
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                            ) : driverName.charAt(0).toUpperCase()}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.02em' }}>
                                {driverName}
                              </h3>
                              {actInfo.text && (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 6,
                                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                  background: actInfo.bgColor, color: actInfo.color,
                                }}>
                                  <span style={{
                                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                                    background: actInfo.color,
                                    boxShadow: actInfo.color !== 'var(--muted)' ? `0 0 0 3px ${actInfo.color}30` : 'none',
                                    animation: (actInfo.color === '#007aff' || actInfo.color === '#34c759') ? 'statusPulse 2s ease-in-out infinite' : 'none',
                                  }} />
                                  {actInfo.text}
                                </span>
                              )}
                              {actInfo.eta && (() => {
                                const [timePart, distPart] = actInfo.eta.split(' · ');
                                return (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                                    background: 'rgba(0,122,255,0.06)',
                                  }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    <span style={{ color: '#007aff' }}>{timePart}</span>
                                    {distPart && (
                                      <>
                                        <span style={{ color: 'var(--muted-2)', fontWeight: 400 }}>·</span>
                                        <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{distPart}</span>
                                      </>
                                    )}
                                  </span>
                                );
                              })()}
                            </div>
                            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, marginTop: 4 }}>
                              {done} of {total} stops completed
                              {driverAvgDwell != null && (
                                <span style={{ marginLeft: 10, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>
                                  Avg {driverAvgDwell}m dwell
                                </span>
                              )}
                            </p>
                          </div>

                          <span style={{
                            fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', flexShrink: 0,
                            color: allDone ? '#34c759' : driverColor,
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {pct}%
                          </span>
                        </div>

                        {/* Progress bar — full width flush */}
                        <div style={{ padding: '0 24px', marginBottom: 16 }}>
                          <div style={{ height: 6, borderRadius: 100, background: 'rgba(60,60,67,0.05)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${pct}%`, borderRadius: 100,
                              background: allDone
                                ? 'linear-gradient(90deg, #34c759, #30d158)'
                                : `linear-gradient(90deg, ${driverColor}, ${driverColor}bb)`,
                              transition: 'width 0.8s cubic-bezier(0.32,0.72,0,1)',
                            }} />
                          </div>
                        </div>

                        {/* Full customer stop list — grouped by customer */}
                        {total > 0 && (() => {
                          const groups = groupStopsByCustomer(stops);
                          return (
                            <div style={{ padding: '0 24px 20px' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px' }}>
                                {groups.map((group, gi) => {
                                  const allCompleted = group.every((s) => s.status === 'completed');
                                  const hasBackorder = group.some((s) => !!(s.backorder_notes && s.backorder_notes.trim()));
                                  const custName = group[0].invoice?.customer_name || `Stop ${gi + 1}`;
                                  const invoiceCount = group.length;
                                  const boNotes = group.map((s) => s.backorder_notes).filter(Boolean).join('; ');
                                  return (
                                    <div
                                      key={`group-${gi}`}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        padding: '5px 12px', borderRadius: 8,
                                        fontSize: 12, fontWeight: allCompleted ? 600 : 500,
                                        background: hasBackorder
                                          ? 'rgba(255,59,48,0.06)'
                                          : allCompleted ? 'rgba(52,199,89,0.08)' : 'rgba(0,0,0,0.025)',
                                        color: hasBackorder
                                          ? '#ff3b30'
                                          : allCompleted ? '#34c759' : 'var(--muted)',
                                        textDecoration: allCompleted && !hasBackorder ? 'line-through' : 'none',
                                        textDecorationColor: allCompleted ? 'rgba(52,199,89,0.3)' : 'transparent',
                                        transition: 'all 0.3s ease',
                                        border: hasBackorder ? '1px solid rgba(255,59,48,0.15)' : '1px solid transparent',
                                      }}
                                      title={hasBackorder ? `B/O: ${boNotes}` : undefined}
                                    >
                                      {hasBackorder ? (
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                        </svg>
                                      ) : allCompleted ? (
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                                      ) : (
                                        <span style={{
                                          width: 18, height: 18, borderRadius: 5, fontSize: 10, fontWeight: 700,
                                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                          background: `${driverColor}12`, color: driverColor,
                                        }}>{gi + 1}</span>
                                      )}
                                      {custName}
                                      {invoiceCount > 1 && (
                                        <span style={{ fontSize: 10, fontWeight: 700, color: '#ff9500' }}>×{invoiceCount}</span>
                                      )}
                                      {hasBackorder && (
                                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>B/O</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Backorder Alert */}
            {backorderStops > 0 && (
              <div style={{
                marginBottom: 24, padding: '16px 20px', borderRadius: 16,
                background: 'rgba(255,59,48,0.05)', border: '1px solid rgba(255,59,48,0.12)',
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                  background: 'rgba(255,59,48,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#ff3b30', margin: 0 }}>
                    {backorderStops} Backorder{backorderStops !== 1 ? 's' : ''} Today
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {routes.flatMap((r) =>
                      (r.stops ?? [])
                        .filter((s) => s.backorder_notes && s.backorder_notes.trim())
                        .map((s) => (
                          <span key={s.id} style={{
                            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                            background: 'rgba(255,59,48,0.08)', color: '#ff3b30',
                          }}>
                            {s.invoice?.customer_name || 'Unknown'}: {s.backorder_notes}
                          </span>
                        ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Live Map + Activity Feed */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
              <LiveMap />
              <ActivityFeed />
            </div>
          </>
        )}
      </main>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes statusPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 currentColor; }
          50% { opacity: 0.6; box-shadow: 0 0 0 4px transparent; }
        }
      `}</style>
    </div>
  );
}
