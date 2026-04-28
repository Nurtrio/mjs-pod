'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const DRIVER_COLORS: Record<string, string> = {
  Erik: '#3b82f6',
  Jose: '#f59e0b',
  Al: '#8b5cf6',
};

const HOME_BASE = { lat: 33.8507, lng: -117.8582 }; // 3066 E La Palma Ave, Anaheim, CA 92806

const STATUS_DOTS: Record<string, { color: string; label: string }> = {
  at_stop: { color: '#34c759', label: 'At Stop' },
  en_route: { color: '#007aff', label: 'En Route' },
  stationary: { color: '#ff9500', label: 'Stationary' },
  idle: { color: '#8e8e93', label: 'Idle' },
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
  heading: number | null;
  speed: number | null;
  recorded_at: string;
  driver?: { name: string };
  activity?: DriverActivity;
}

interface CompletedStop {
  id: string;
  gps_lat: number | null;
  gps_lng: number | null;
  completed_at: string | null;
  arrived_at: string | null;
  dwell_seconds: number | null;
  pod_pdf_storage_path: string | null;
  invoice?: {
    customer_name?: string;
    invoice_number?: string;
  };
}

interface RouteData {
  id: string;
  driver_id: string;
  stops: CompletedStop[];
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

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

export default function LiveMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const deliveryMarkersRef = useRef<L.Marker[]>([]);
  const legendRef = useRef<L.Control | null>(null);
  const hasFitBoundsRef = useRef(false);

  const [locations, setLocations] = useState<DriverLoc[]>([]);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [podViewer, setPodViewer] = useState<{ url: string; customer: string; invoice: string } | null>(null);


  const today = new Date().toISOString().split('T')[0];

  // Fetch locations with activity
  const fetchLocations = useCallback(() => {
    fetch('/api/drivers/location?activity=true')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setLocations(data);
      })
      .catch(() => {});
  }, []);

  // Fetch routes for completed stop markers
  const fetchRoutes = useCallback(() => {
    fetch(`/api/routes?date=${today}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRoutes(data);
      })
      .catch(() => {});
  }, [today]);

  // Initial fetch + polling every 8 seconds
  useEffect(() => {
    fetchLocations();
    fetchRoutes();
    const interval = setInterval(fetchLocations, 8000);
    // Refresh routes less frequently (every 30s)
    const routeInterval = setInterval(fetchRoutes, 30000);
    return () => {
      clearInterval(interval);
      clearInterval(routeInterval);
    };
  }, [fetchLocations, fetchRoutes]);

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
                updated[exists] = {
                  ...updated[exists],
                  lat: newLoc.lat,
                  lng: newLoc.lng,
                  speed: newLoc.speed,
                  heading: newLoc.heading,
                  recorded_at: newLoc.recorded_at,
                };
                return updated;
              }
              return [...prev, newLoc];
            });
          }
        }
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

      // CartoDB Positron tiles for clean look
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

      // Legend control
      const LegendControl = L.Control.extend({
        onAdd: function () {
          const div = L.DomUtil.create('div');
          div.style.cssText =
            'background: rgba(255,255,255,0.95); padding: 10px 14px; border-radius: 10px; ' +
            'box-shadow: 0 1px 6px rgba(0,0,0,0.12); font-family: -apple-system, sans-serif; ' +
            'font-size: 11px; line-height: 20px; color: #333; backdrop-filter: blur(8px);';
          div.innerHTML = `
            <div style="font-weight:700;margin-bottom:4px;font-size:12px;">Legend</div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="width:10px;height:10px;border-radius:50%;background:#007aff;display:inline-block;border:1.5px solid #fff;box-shadow:0 0 0 1px #007aff;"></span>
              Home Base
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <img src="/truck-pin.png" style="width:16px;height:24px;object-fit:contain;" />
              Erik
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <img src="/truck-pin.png" style="width:16px;height:24px;object-fit:contain;" />
              Jose
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <img src="/truck-pin.png" style="width:16px;height:24px;object-fit:contain;" />
              Al
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="width:10px;height:10px;border-radius:50%;background:#22c55e;display:inline-block;border:1.5px solid #fff;box-shadow:0 0 0 1px #22c55e;"></span>
              Completed Delivery
            </div>
          `;
          return div;
        },
      });

      const legend = new LegendControl({ position: 'bottomleft' });
      legend.addTo(map);
      legendRef.current = legend;

      leafletMapRef.current = map;
      setMapReady(true);
    });
  }, []);

  // Check if a driver should be shown at the warehouse
  // True when: no route today, OR all stops completed/skipped
  const isDriverAtWarehouse = useCallback(
    (driverId: string): boolean => {
      const driverRoute = routes.find((r) => r.driver_id === driverId);
      // No route today — driver is at base
      if (!driverRoute || !driverRoute.stops || driverRoute.stops.length === 0) return true;
      // All stops done — driver returned to base
      return driverRoute.stops.every(
        (s: CompletedStop & { status?: string }) =>
          s.status === 'completed' || s.status === 'skipped'
      );
    },
    [routes]
  );

  // Update driver markers when locations change
  useEffect(() => {
    if (!mapReady || !leafletMapRef.current) return;

    import('leaflet').then((L) => {
      const map = leafletMapRef.current!;

      for (const loc of locations) {
        const name = (loc.driver as unknown as { name: string })?.name || 'Driver';
        const color = getDriverColor(name);
        const initial = name.charAt(0).toUpperCase();
        const routeDone = isDriverAtWarehouse(loc.driver_id);
        const actInfo = routeDone
          ? { text: 'Route Complete', color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)' }
          : activityLabel(loc.activity);

        // Override position to warehouse if route is completed
        const markerLat = routeDone ? HOME_BASE.lat : loc.lat;
        const markerLng = routeDone ? HOME_BASE.lng : loc.lng;

        const isAtStop = !routeDone && loc.activity?.status === 'at_stop';
        const isStationary = !routeDone && loc.activity?.status === 'stationary';
        const pulseColor = routeDone ? '#22c55e' : isAtStop ? '#34c759' : isStationary ? '#ff9500' : color;

        const icon = L.divIcon({
          className: '',
          html: `<div style="position:relative; display:flex; flex-direction:column; align-items:center;">
            <div style="
              width: 50px; height: 80px;
              background: url('/truck-pin.png') center/contain no-repeat;
              filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35));
            "></div>
            <div style="
              margin-top: 2px; background: ${color}; color: #fff;
              font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 6px;
              white-space: nowrap; box-shadow: 0 1px 4px rgba(0,0,0,0.25);
              text-align: center;
            ">${name}${isAtStop || isStationary ? ` · ${loc.activity?.dwell_minutes || 0}m` : ''}</div>
          </div>`,
          iconSize: [50, 90],
          iconAnchor: [25, 45],
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
          markersRef.current[loc.driver_id].setLatLng([markerLat, markerLng]);
          markersRef.current[loc.driver_id].setIcon(icon);
          markersRef.current[loc.driver_id].setPopupContent(popupContent);
        } else {
          const marker = L.marker([markerLat, markerLng], { icon }).bindPopup(popupContent).addTo(map);
          markersRef.current[loc.driver_id] = marker;
        }
      }

      // Auto-fit bounds once when data first loads
      if (!hasFitBoundsRef.current && locations.length > 0) {
        const allPoints: [number, number][] = [[HOME_BASE.lat, HOME_BASE.lng]];
        for (const loc of locations) {
          allPoints.push([loc.lat, loc.lng]);
        }
        if (allPoints.length > 1) {
          const bounds = L.latLngBounds(allPoints.map((p) => L.latLng(p[0], p[1])));
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
          hasFitBoundsRef.current = true;
        }
      }
    });
  }, [locations, routes, mapReady, isDriverAtWarehouse]);

  // Draw completed delivery markers
  useEffect(() => {
    if (!mapReady || !leafletMapRef.current) return;

    import('leaflet').then((L) => {
      const map = leafletMapRef.current!;

      // Clear old delivery markers
      for (const m of deliveryMarkersRef.current) {
        map.removeLayer(m);
      }
      deliveryMarkersRef.current = [];

      for (const route of routes) {
        for (const stop of route.stops) {
          if (stop.gps_lat == null || stop.gps_lng == null) continue;
          if (!stop.completed_at) continue;

          const customerName = stop.invoice?.customer_name || 'Unknown';
          const invoiceNumber = stop.invoice?.invoice_number || 'N/A';
          const dwellMinutes =
            stop.dwell_seconds != null ? Math.round(stop.dwell_seconds / 60) : null;
          const deliveryTime = stop.completed_at ? formatTime(stop.completed_at) : '—';

          const deliveryIcon = L.divIcon({
            className: '',
            html: `<div style="
              width: 24px; height: 24px; border-radius: 50%;
              background: #22c55e; border: 2px solid #fff;
              box-shadow: 0 1px 5px rgba(0,0,0,0.2);
              display: flex; align-items: center; justify-content: center;
              color: #fff; font-size: 13px; font-weight: 700; line-height: 1;
            ">&#10003;</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });

          const hasPod = !!stop.pod_pdf_storage_path;
          const podPdfUrl = hasPod
            ? `${SUPABASE_URL}/storage/v1/object/public/pods/${stop.pod_pdf_storage_path}`
            : '';

          // Build popup as real DOM so event listeners work (inline onclick blocked by CSP)
          const container = document.createElement('div');
          container.style.cssText = 'font-family: -apple-system, sans-serif; min-width: 180px;';

          const nameEl = document.createElement('div');
          nameEl.style.cssText = 'font-size: 14px; font-weight: 700; margin-bottom: 4px; color: #1a1a1a;';
          nameEl.textContent = customerName;
          container.appendChild(nameEl);

          const invEl = document.createElement('div');
          invEl.style.cssText = 'font-size: 12px; color: #555; margin-bottom: 6px;';
          invEl.textContent = `INV #${invoiceNumber}`;
          container.appendChild(invEl);

          const metaEl = document.createElement('div');
          metaEl.style.cssText = 'display: flex; gap: 12px; font-size: 11px; color: #666; margin-bottom: 6px;';
          if (dwellMinutes != null) {
            const dwellSpan = document.createElement('span');
            dwellSpan.innerHTML = `Dwell: <b>${dwellMinutes} min</b>`;
            metaEl.appendChild(dwellSpan);
          }
          const timeSpan = document.createElement('span');
          timeSpan.innerHTML = `Delivered: <b>${deliveryTime}</b>`;
          metaEl.appendChild(timeSpan);
          container.appendChild(metaEl);

          if (hasPod) {
            const btn = document.createElement('button');
            btn.textContent = 'View POD →';
            btn.style.cssText = 'font-size: 12px; font-weight: 600; color: #007aff; background: rgba(0,122,255,0.08); border: none; padding: 6px 14px; border-radius: 8px; cursor: pointer; margin-top: 2px;';
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              setPodViewer({ url: podPdfUrl, customer: customerName, invoice: invoiceNumber });
            });
            container.appendChild(btn);
          }

          const marker = L.marker([stop.gps_lat, stop.gps_lng], { icon: deliveryIcon })
            .bindPopup(container, { maxWidth: 240 })
            .addTo(map);

          deliveryMarkersRef.current.push(marker);
        }
      }
    });
  }, [routes, mapReady]);

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
      {/* Map */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} style={{ height: 500, width: '100%' }} />

      {/* POD Viewer Modal */}
      {podViewer && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'podFadeIn 0.2s ease-out',
          }}
          onClick={() => setPodViewer(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 20, overflow: 'hidden',
              width: '90%', maxWidth: 800, height: '85vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
              animation: 'podSlideUp 0.25s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #eee',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
                  Proof of Delivery
                </p>
                <p style={{ fontSize: 13, color: '#666', margin: 0, marginTop: 2 }}>
                  {podViewer.customer} · INV #{podViewer.invoice}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a
                  href={podViewer.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                    color: '#007aff', background: 'rgba(0,122,255,0.08)',
                    textDecoration: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download
                </a>
                <button
                  onClick={() => setPodViewer(null)}
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: 'none',
                    background: 'rgba(0,0,0,0.05)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, color: '#666',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            {/* PDF */}
            <div style={{ flex: 1, background: '#f5f5f5' }}>
              <iframe
                src={podViewer.url}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="Proof of Delivery PDF"
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes podFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes podSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
