'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Nav from '@/components/nav';

const DRIVER_COLORS: Record<string, string> = {
  Erik: '#3b82f6',
  Jose: '#f59e0b',
  Al: '#8b5cf6',
};

const HOME_BASE = { lat: 33.8507, lng: -117.8582 };

interface DeliveryPin {
  id: string;
  gps_lat: number;
  gps_lng: number;
  completed_at: string;
  dwell_seconds: number | null;
  backorder_notes: string | null;
  customer_name: string;
  invoice_number: string;
  driver_name: string;
  route_date: string;
}

function getDriverColor(name: string): string {
  for (const [key, color] of Object.entries(DRIVER_COLORS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return '#8b5cf6';
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function CoveragePage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [pins, setPins] = useState<DeliveryPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [mapReady, setMapReady] = useState(false);

  // Fetch all completed deliveries with GPS
  useEffect(() => {
    fetch('/api/coverage')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPins(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    import('leaflet').then((L) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      const map = L.map(mapRef.current!, {
        center: [HOME_BASE.lat, HOME_BASE.lng],
        zoom: 10,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      // Home base marker
      const homeIcon = L.divIcon({
        className: '',
        html: `<div style="
          width: 36px; height: 36px; border-radius: 50%;
          background: #007aff; border: 3px solid #fff;
          box-shadow: 0 2px 8px rgba(0,122,255,0.4);
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

  // Draw pins when data or filter changes
  useEffect(() => {
    if (!mapReady || !leafletMapRef.current) return;

    import('leaflet').then((L) => {
      const map = leafletMapRef.current!;

      // Clear old markers
      for (const m of markersRef.current) {
        map.removeLayer(m);
      }
      markersRef.current = [];

      const filtered = filter === 'all' ? pins : pins.filter((p) => p.driver_name === filter);

      for (const pin of filtered) {
        const color = getDriverColor(pin.driver_name);
        const dwellMin = pin.dwell_seconds != null ? Math.round(pin.dwell_seconds / 60) : null;
        const hasBO = !!pin.backorder_notes;

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width: 14px; height: 14px; border-radius: 50%;
            background: ${color}; border: 2px solid #fff;
            box-shadow: 0 1px 4px rgba(0,0,0,0.25);
            ${hasBO ? 'outline: 2px solid #ef4444; outline-offset: 1px;' : ''}
          "></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        const popup = `
          <div style="font-family: -apple-system, sans-serif; min-width: 180px;">
            <div style="font-size: 14px; font-weight: 700; margin-bottom: 4px;">${pin.customer_name}</div>
            <div style="font-size: 12px; color: #555; margin-bottom: 6px;">INV #${pin.invoice_number}</div>
            <div style="display: flex; gap: 12px; font-size: 11px; color: #666; margin-bottom: 4px;">
              <span style="display:inline-flex;align-items:center;gap:4px;">
                <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;"></span>
                ${pin.driver_name}
              </span>
              <span>${formatDate(pin.route_date)}</span>
              <span>${formatTime(pin.completed_at)}</span>
            </div>
            ${dwellMin != null ? `<div style="font-size: 11px; color: #666;">Dwell: ${dwellMin} min</div>` : ''}
            ${hasBO ? `<div style="font-size: 11px; color: #ef4444; font-weight: 600; margin-top: 4px;">Backorder</div>` : ''}
          </div>
        `;

        const marker = L.marker([pin.gps_lat, pin.gps_lng], { icon }).bindPopup(popup).addTo(map);
        markersRef.current.push(marker);
      }

      // Fit bounds
      if (filtered.length > 0) {
        const points: [number, number][] = [[HOME_BASE.lat, HOME_BASE.lng]];
        for (const p of filtered) {
          points.push([p.gps_lat, p.gps_lng]);
        }
        const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      }
    });
  }, [pins, filter, mapReady]);

  const filtered = filter === 'all' ? pins : pins.filter((p) => p.driver_name === filter);
  const drivers = [...new Set(pins.map((p) => p.driver_name))].sort();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <Nav />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

      <div style={{ padding: '24px 32px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
              Delivery Coverage
            </h1>
            <p style={{ fontSize: 14, color: 'var(--muted)', margin: '4px 0 0' }}>
              {loading ? 'Loading...' : `${filtered.length} deliveries with GPS data`}
            </p>
          </div>

          {/* Filter buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setFilter('all')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                background: filter === 'all' ? '#1a1a1a' : 'rgba(60,60,67,0.06)',
                color: filter === 'all' ? '#fff' : 'var(--muted)',
              }}
            >
              All
            </button>
            {drivers.map((d) => (
              <button
                key={d}
                onClick={() => setFilter(d)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: filter === d ? getDriverColor(d) : 'rgba(60,60,67,0.06)',
                  color: filter === d ? '#fff' : 'var(--muted)',
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div style={{
          display: 'flex', gap: 16, marginBottom: 20,
        }}>
          {drivers.map((d) => {
            const count = pins.filter((p) => p.driver_name === d).length;
            const color = getDriverColor(d);
            return (
              <div
                key={d}
                style={{
                  flex: 1,
                  background: '#fff',
                  borderRadius: 14,
                  padding: '14px 18px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', background: color,
                  boxShadow: `0 0 0 3px ${color}22`,
                }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{d}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{count} deliveries</div>
                </div>
              </div>
            );
          })}
          <div
            style={{
              flex: 1,
              background: '#fff',
              borderRadius: 14,
              padding: '14px 18px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{
              width: 10, height: 10, borderRadius: '50%', background: '#ef4444',
              boxShadow: '0 0 0 3px rgba(239,68,68,0.15)',
            }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Backorders</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {pins.filter((p) => p.backorder_notes).length} total
              </div>
            </div>
          </div>
        </div>

        {/* Map */}
        <div style={{
          borderRadius: 22,
          overflow: 'hidden',
          boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
          background: '#fff',
        }}>
          <div ref={mapRef} style={{ height: 650, width: '100%' }} />
        </div>
      </div>
    </div>
  );
}
