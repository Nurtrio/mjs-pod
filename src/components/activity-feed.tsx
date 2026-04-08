'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const DRIVER_COLORS: Record<string, string> = {
  Erik: '#3b82f6',
  Jose: '#f59e0b',
  Al: '#8b5cf6',
};

function getDriverColor(name: string): string {
  for (const [key, color] of Object.entries(DRIVER_COLORS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return '#8b5cf6';
}

const EVENT_CONFIG: Record<string, { icon: string; color: string; bgColor: string }> = {
  arrived: {
    icon: '📍',
    color: '#007aff',
    bgColor: 'rgba(0,122,255,0.08)',
  },
  photo_captured: {
    icon: '📸',
    color: '#ff9500',
    bgColor: 'rgba(255,149,0,0.08)',
  },
  signature_confirmed: {
    icon: '✍️',
    color: '#8b5cf6',
    bgColor: 'rgba(139,92,246,0.08)',
  },
  pod_submitted: {
    icon: '📄',
    color: '#34c759',
    bgColor: 'rgba(52,199,89,0.08)',
  },
  delivery_completed: {
    icon: '✅',
    color: '#34c759',
    bgColor: 'rgba(52,199,89,0.08)',
  },
  route_completed: {
    icon: '🏁',
    color: '#34c759',
    bgColor: 'rgba(52,199,89,0.12)',
  },
};

interface ActivityEvent {
  id: string;
  driver_id: string;
  driver_name: string;
  event_type: string;
  customer_name: string | null;
  invoice_number: string | null;
  message: string;
  created_at: string;
}

function formatFeedTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function timeAgoShort(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h`;
}

export default function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const newEventRef = useRef(false);

  // Fetch initial events
  useEffect(() => {
    fetch('/api/activity?limit=50')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setEvents(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Subscribe to realtime inserts
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    const supabase = createClient(url, key);
    const channel = supabase
      .channel('activity-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        (payload) => {
          const newEvent = payload.new as ActivityEvent;
          if (newEvent) {
            newEventRef.current = true;
            setEvents((prev) => [newEvent, ...prev].slice(0, 100));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-scroll to top on new event
  useEffect(() => {
    if (newEventRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
      newEventRef.current = false;
    }
  }, [events]);

  return (
    <div style={{
      background: 'var(--card)',
      borderRadius: 20,
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      display: 'flex',
      flexDirection: 'column',
      height: 500,
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#34c759',
            boxShadow: '0 0 0 3px rgba(52,199,89,0.2)',
            animation: 'feedPulse 2s ease-in-out infinite',
          }} />
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.01em' }}>
            Live Activity
          </h3>
        </div>
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {events.length} events
        </span>
      </div>

      {/* Event list */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 24, height: 24, border: '2px solid var(--muted-2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}

        {!loading && events.length === 0 && (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, marginBottom: 4 }}>No activity yet</p>
            <p style={{ fontSize: 12, color: 'var(--muted-2)', margin: 0 }}>Events will appear here as drivers make deliveries</p>
          </div>
        )}

        {events.map((event, i) => {
          const config = EVENT_CONFIG[event.event_type] || { icon: '📋', color: 'var(--muted)', bgColor: 'rgba(60,60,67,0.06)' };
          const driverColor = getDriverColor(event.driver_name);
          const isNew = i === 0;

          return (
            <div
              key={event.id}
              style={{
                padding: '12px 20px',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                borderBottom: '1px solid rgba(0,0,0,0.03)',
                background: isNew ? 'rgba(52,199,89,0.02)' : 'transparent',
                animation: isNew ? 'feedSlideIn 0.3s ease-out' : 'none',
                transition: 'background 0.3s ease',
              }}
            >
              {/* Timeline line + icon */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 32 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: config.bgColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15,
                }}>
                  {config.icon}
                </div>
                {i < events.length - 1 && (
                  <div style={{ width: 1, flex: 1, minHeight: 8, background: 'var(--border)', marginTop: 4 }} />
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <p style={{ fontSize: 13, color: 'var(--foreground)', margin: 0, lineHeight: 1.45, fontWeight: 500 }}>
                    <span style={{ fontWeight: 700, color: driverColor }}>{event.driver_name}</span>
                    {' '}
                    {event.message.replace(event.driver_name + ' ', '')}
                  </p>
                  <span style={{
                    fontSize: 11, color: 'var(--muted-2)', fontWeight: 500,
                    whiteSpace: 'nowrap', flexShrink: 0, fontVariantNumeric: 'tabular-nums',
                  }}>
                    {timeAgoShort(event.created_at)}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--muted-2)', margin: 0, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                  {formatFeedTime(event.created_at)}
                  {event.invoice_number && <span> · INV #{event.invoice_number}</span>}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes feedPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes feedSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
