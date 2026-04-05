'use client';

import { useEffect, useRef } from 'react';

const BEACON_INTERVAL = 12000; // 12 seconds

export function useGpsBeacon(driverId: string | null) {
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!driverId) return;
    if (!('geolocation' in navigator)) return;

    const sendPosition = async (position: GeolocationPosition) => {
      try {
        await fetch('/api/drivers/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driver_id: driverId,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            heading: position.coords.heading,
            speed: position.coords.speed,
            accuracy: position.coords.accuracy,
          }),
        });
      } catch {
        // Silently fail — GPS beacon is best-effort
      }
    };

    // Use watchPosition for automatic updates when moving
    watchIdRef.current = navigator.geolocation.watchPosition(
      sendPosition,
      () => {}, // Ignore errors silently
      {
        enableHighAccuracy: true,
        maximumAge: 15000,
        timeout: 10000,
      },
    );

    // Also send on a fixed interval as fallback (iPad may not fire watch when stationary)
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        sendPosition,
        () => {},
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 },
      );
    }, BEACON_INTERVAL);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [driverId]);
}
