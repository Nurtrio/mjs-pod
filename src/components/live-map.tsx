'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const DRIVER_COLORS: Record<string, string> = {
  Erik: '#3b82f6',
  Jose: '#f59e0b',
  Al: '#8b5cf6',
};

const HOME_BASE = { lat: 33.8461, lng: -117.8819 }; // 3066 E La Palma Ave, Anaheim

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
  heading: number | null;
  speed: number | null;
  recorded_at: string;
  driver?: { name: string };
  activity?: DriverActivity;
}

function getDriverColor(name: string): string {
  for (const [key, color] of Object.entries(DRIVER_COLORS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return '#8b5cf6';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function activityLabel(activity?: DriverActivity): { text: string; color: string; bgColor: string } {
  if (!activity) return { text: 'Offline', color: 'var(--muted)', bgColor: 'rgba(60,60,67,0.06)' };

  switch (activity.status) {
    case 'at_stop':
      return {
        text: `At Stop #${activity.stop_number}${activity.dwell_minutes ? ` · ${activity.dwell_minutes}m` : ''}`,
        color: '#34c759',
        bgColor: 'rgba(52,199,89,0.1)',
      };
    case 'en_route':
      return {
        text: activity.stop_name ? `En route to ${activity.stop_name}` : 'En route',
        color: '#007aff',
        bgColor: 'rgba(0,122,255,0.1)',
      };
    case 'stationary':
      return {
        text: `Stopped${activity.dwell_minutes ? ` · ${activity.dwell_minutes}m` : ''}`,
        color: '#ff9500',
        bgColor: 'rgba(255,149,0,0.1)',
      };
    case 'idle':
    default:
      return { text: 'Idle', color: 'var(--muted)', bgColor: 'rgba(60,60,67,0.06)' };
  }
}

export default function LiveMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const [locations, setLocations] = useState<DriverLoc[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // Fetch initial locations with activity
  useEffect(() => {
    const fetchLocations = () => {
      fetch('/api/drivers/location?activity=true')
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setLocations(data);
        })
        .catch(() => {});
    };

    fetchLocations();
    // Refresh activity data every 15 seconds
    const interval = setInterval(fetchLocations, 15000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to Supabase Realtime for position updates
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    const supabase = createClient(url, key);
    const channel = supabase
      .channel('driver-locations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations' },
        (payload) => {
          const newLoc = payload.new as DriverLoc;
          if (newLoc && newLoc.driver_id) {
            setLocations((prev) => {
              const exists = prev.findIndex((l) => l.driver_id === newLoc.driver_id);
              if (exists >= 0) {
                const updated = [...prev];
                updated[exists] = { ...updated[exists], lat: newLoc.lat, lng: newLoc.lng, speed: newLoc.speed, heading: newLoc.heading, recorded_at: newLoc.recorded_at };
                return updated;
              }
              return [...prev, newLoc];
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    import('leaflet').then((L) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {
        center: [HOME_BASE.lat, HOME_BASE.lng],
        zoom: 11,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '',
        maxZoom: 18,
      }).addTo(map);

      // Home base marker
      const homeIcon = L.divIcon({
        className: '',
        html: `<div style="
          width: 36px; height: 36px; border-radius: 50%;
          background: #34c759; border: 3px solid #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 16px; font-weight: 700;
        ">H</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      L.marker([HOME_BASE.lat, HOME_BASE.lng], { icon: homeIcon })
        .bindPopup('<b>MJS Home Base</b><br/>3066 E La Palma Ave<br/>Anaheim, CA 92806')
        .addTo(map);

      leafletMapRef.current = map;
      setMapReady(true);
    });
  }, []);

  // Update markers when locations change
  useEffect(() => {
    if (!mapReady || !leafletMapRef.current) return;

    import('leaflet').then((L) => {
      const map = leafletMapRef.current!;

      for (const loc of locations) {
        const name = (loc.driver as unknown as { name: string })?.name || 'Driver';
        const color = getDriverColor(name);
        const initial = name.charAt(0).toUpperCase();
        const actInfo = activityLabel(loc.activity);

        const isAtStop = loc.activity?.status === 'at_stop';
        const isStationary = loc.activity?.status === 'stationary';
        const pulseColor = isAtStop ? '#34c759' : isStationary ? '#ff9500' : color;

        const icon = L.divIcon({
          className: '',
          html: `<div style="position:relative;">
            <div style="
              width: 42px; height: 42px; border-radius: 50%;
              background: ${color}; border: 3px solid #fff;
              box-shadow: 0 2px 12px ${color}66;
              display: flex; align-items: center; justify-content: center;
              color: #fff; font-size: 18px; font-weight: 700;
            ">${initial}</div>
            <div style="
              position: absolute; top: -3px; left: -3px; right: -3px; bottom: -3px;
              border-radius: 50%; border: 2px solid ${pulseColor}40;
              animation: pulse-ring 2s ease-out infinite;
            "></div>
            ${isAtStop || isStationary ? `<div style="
              position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%);
              background: ${actInfo.color}; color: #fff;
              font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 4px;
              white-space: nowrap; box-shadow: 0 1px 4px rgba(0,0,0,0.2);
            ">${loc.activity?.dwell_minutes || 0}m</div>` : ''}
          </div>`,
          iconSize: [42, 42],
          iconAnchor: [21, 21],
        });

        const popupContent = `
          <div style="font-family: -apple-system, sans-serif; min-width: 160px;">
            <div style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">${name}</div>
            <div style="
              display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;
              background: ${actInfo.bgColor}; color: ${actInfo.color}; margin-bottom: 6px;
            ">${actInfo.text}</div>
            <div style="font-size: 12px; color: #666; margin-top: 4px;">
              ${loc.speed != null && loc.speed > 0 ? `Speed: ${Math.round(loc.speed * 2.237)} mph<br/>` : ''}
              Updated: ${timeAgo(loc.recorded_at)}
            </div>
          </div>
        `;

        if (markersRef.current[loc.driver_id]) {
          markersRef.current[loc.driver_id].setLatLng([loc.lat, loc.lng]);
          markersRef.current[loc.driver_id].setIcon(icon);
          markersRef.current[loc.driver_id].setPopupContent(popupContent);
        } else {
          const marker = L.marker([loc.lat, loc.lng], { icon })
            .bindPopup(popupContent)
            .addTo(map);
          markersRef.current[loc.driver_id] = marker;
        }
      }
    });
  }, [locations, mapReady]);

  return (
    <div
      style={{
        background: 'var(--card)',
        borderRadius: 22,
        overflow: 'hidden',
        boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'rgba(52,199,89,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="10" r="3" />
              <path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.05 11.5 7.35 11.76a1 1 0 0 0 1.3 0C12.95 21.5 20 15.4 20 10a8 8 0 0 0-8-8z" />
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
              Live Tracking
            </h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, marginTop: 2 }}>
              {locations.length} driver{locations.length !== 1 ? 's' : ''} active
            </p>
          </div>
        </div>
      </div>

      {/* Driver activity cards */}
      {locations.length > 0 && (
        <div style={{ display: 'flex', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
          {locations.map((loc) => {
            const name = (loc.driver as unknown as { name: string })?.name || 'Driver';
            const color = getDriverColor(name);
            const act = activityLabel(loc.activity);
            return (
              <div
                key={loc.driver_id}
                style={{
                  flex: '1 0 auto',
                  minWidth: 180,
                  background: 'var(--background)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 16, fontWeight: 700, flexShrink: 0,
                }}>
                  {name.charAt(0)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                    {name}
                  </p>
                  <div style={{
                    display: 'inline-block',
                    marginTop: 3,
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    background: act.bgColor,
                    color: act.color,
                    whiteSpace: 'nowrap',
                  }}>
                    {act.text}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0, marginTop: 3 }}>
                    {timeAgo(loc.recorded_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Map */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} style={{ height: 380, width: '100%' }} />

      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
