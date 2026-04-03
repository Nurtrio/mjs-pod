'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Nav from '@/components/nav';
import type { RouteWithDetails } from '@/types';

const DRIVER_COLORS: Record<string, string> = {
  Erik: '#3b82f6',
  Jose: '#f59e0b',
  Al: '#8b5cf6',
};

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

  const totalStops = routes.reduce((sum, r) => sum + (r.stops?.length ?? 0), 0);
  const completedStops = routes.reduce(
    (sum, r) => sum + (r.stops?.filter((s) => s.status === 'completed').length ?? 0),
    0,
  );
  const pendingStops = totalStops - completedStops;
  const completionPct = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

  const stats = [
    {
      label: 'Total Deliveries',
      value: totalStops,
      color: '#3b82f6',
      bgColor: 'rgba(59,130,246,0.1)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
          <path d="M16 3h5v5" />
          <path d="M8 3H3v5" />
          <path d="M21 16v5h-5" />
          <path d="M3 16v5h5" />
        </svg>
      ),
    },
    {
      label: 'Completed',
      value: completedStops,
      color: '#34c759',
      bgColor: 'rgba(52,199,89,0.1)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ),
    },
    {
      label: 'Pending',
      value: pendingStops,
      color: '#ff9500',
      bgColor: 'rgba(255,149,0,0.1)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff9500" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      label: 'Completion',
      value: `${completionPct}%`,
      color: '#8b5cf6',
      bgColor: 'rgba(139,92,246,0.1)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 20V10" />
          <path d="M12 20V4" />
          <path d="M6 20v-6" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--background)' }}>
      <Nav />
      <main style={{ flex: 1, padding: '32px 40px 48px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--foreground)',
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              {getGreeting()}
            </h1>
            <p
              style={{
                fontSize: 15,
                color: 'var(--muted)',
                marginTop: 6,
                margin: 0,
                marginBlockStart: 6,
                fontWeight: 400,
              }}
            >
              {today}
            </p>
          </div>

          {/* Quick action pills */}
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <Link
              href="/upload"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 18px',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--foreground)',
                background: 'var(--card)',
                borderRadius: 20,
                textDecoration: 'none',
                boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload Invoices
            </Link>
            <Link
              href="/routes"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 18px',
                fontSize: 13,
                fontWeight: 600,
                color: '#ffffff',
                background: 'linear-gradient(135deg, #34c759 0%, #28a745 100%)',
                borderRadius: 20,
                textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(52,199,89,0.25)',
                transition: 'all 0.2s ease',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="10" r="3" />
                <path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.05 11.5 7.35 11.76a1 1 0 0 0 1.3 0C12.95 21.5 20 15.4 20 10a8 8 0 0 0-8-8z" />
              </svg>
              Build Routes
            </Link>
          </div>
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: '3px solid var(--muted-2)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          </div>
        )}

        {error && (
          <div
            style={{
              background: 'rgba(255,69,58,0.08)',
              borderRadius: 14,
              padding: '14px 18px',
              fontSize: 14,
              color: 'var(--danger)',
              boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Stats Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 16,
                marginBottom: 36,
              }}
            >
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: 'var(--card)',
                    borderRadius: 18,
                    padding: '24px 22px',
                    boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 8px rgba(0,0,0,0.04)';
                  }}
                >
                  {/* Icon badge */}
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 13,
                      background: stat.bgColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 16,
                    }}
                  >
                    {stat.icon}
                  </div>
                  <p
                    style={{
                      fontSize: 36,
                      fontWeight: 700,
                      color: 'var(--foreground)',
                      margin: 0,
                      lineHeight: 1.1,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {stat.value}
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      color: 'var(--muted)',
                      margin: 0,
                      marginTop: 6,
                      fontWeight: 500,
                      letterSpacing: '0.01em',
                    }}
                  >
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Driver Progress Section */}
            {routes.length === 0 ? (
              <div
                style={{
                  background: 'var(--card)',
                  borderRadius: 22,
                  padding: '64px 40px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
                }}
              >
                {/* Illustration-style truck */}
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 24,
                    background: 'rgba(52,199,89,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 24,
                  }}
                >
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 3h15v13H1z" />
                    <path d="M16 8h4l3 3v5h-7V8z" />
                    <circle cx="5.5" cy="18.5" r="2.5" />
                    <circle cx="18.5" cy="18.5" r="2.5" />
                  </svg>
                </div>
                <h2
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: 'var(--foreground)',
                    margin: 0,
                    marginBottom: 8,
                    letterSpacing: '-0.02em',
                  }}
                >
                  No routes for today
                </h2>
                <p
                  style={{
                    fontSize: 15,
                    color: 'var(--muted)',
                    margin: 0,
                    marginBottom: 28,
                    maxWidth: 340,
                    lineHeight: 1.5,
                  }}
                >
                  Upload invoices and build routes to assign deliveries to your drivers.
                </p>
                <Link
                  href="/routes"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'linear-gradient(135deg, #34c759 0%, #28a745 100%)',
                    color: '#ffffff',
                    padding: '14px 32px',
                    borderRadius: 16,
                    fontSize: 16,
                    fontWeight: 600,
                    textDecoration: 'none',
                    boxShadow: '0 4px 16px rgba(52,199,89,0.25)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="10" r="3" />
                    <path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.05 11.5 7.35 11.76a1 1 0 0 0 1.3 0C12.95 21.5 20 15.4 20 10a8 8 0 0 0-8-8z" />
                  </svg>
                  Go to Route Builder
                </Link>
              </div>
            ) : (
              <div>
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: 'var(--foreground)',
                    margin: 0,
                    marginBottom: 16,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Driver Progress
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {routes.map((route) => {
                    const stops = route.stops ?? [];
                    const done = stops.filter((s) => s.status === 'completed').length;
                    const total = stops.length;
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    const driverName = route.driver?.name ?? 'Unknown';
                    const driverColor = DRIVER_COLORS[driverName] ?? 'var(--muted)';

                    let statusLabel = 'Pending';
                    let statusColor = 'var(--muted)';
                    let statusBg = 'rgba(60,60,67,0.06)';
                    if (route.status === 'completed') {
                      statusLabel = 'Completed';
                      statusColor = '#34c759';
                      statusBg = 'rgba(52,199,89,0.1)';
                    } else if (route.status === 'in_progress') {
                      statusLabel = 'In Progress';
                      statusColor = '#ff9500';
                      statusBg = 'rgba(255,149,0,0.1)';
                    }

                    return (
                      <div
                        key={route.id}
                        style={{
                          background: 'var(--card)',
                          borderRadius: 18,
                          padding: '22px 26px',
                          boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                          (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                          (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 8px rgba(0,0,0,0.04)';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                          {/* Driver avatar */}
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 14,
                              background: driverColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                              fontSize: 18,
                              fontWeight: 700,
                              flexShrink: 0,
                              boxShadow: `0 3px 12px ${driverColor}33`,
                            }}
                          >
                            {driverName.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <h3
                                style={{
                                  fontSize: 17,
                                  fontWeight: 600,
                                  color: 'var(--foreground)',
                                  margin: 0,
                                  letterSpacing: '-0.01em',
                                }}
                              >
                                {driverName}
                              </h3>
                              <span
                                style={{
                                  background: statusBg,
                                  color: statusColor,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  padding: '4px 12px',
                                  borderRadius: 100,
                                }}
                              >
                                {statusLabel}
                              </span>
                            </div>
                            <p
                              style={{
                                fontSize: 14,
                                color: 'var(--muted)',
                                margin: 0,
                                marginTop: 3,
                              }}
                            >
                              {done} of {total} stops completed
                            </p>
                          </div>
                        </div>
                        {/* Thick progress bar with glow */}
                        <div
                          style={{
                            height: 10,
                            borderRadius: 100,
                            background: 'rgba(60,60,67,0.06)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${pct}%`,
                              borderRadius: 100,
                              background: `linear-gradient(90deg, ${driverColor}, ${driverColor}cc)`,
                              boxShadow: `0 0 12px ${driverColor}40`,
                              transition: 'width 0.5s cubic-bezier(0.32,0.72,0,1)',
                            }}
                          />
                        </div>
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: driverColor,
                            margin: 0,
                            marginTop: 8,
                            textAlign: 'right',
                          }}
                        >
                          {pct}%
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
