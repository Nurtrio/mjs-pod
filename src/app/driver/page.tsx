'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDriverStore } from '@/lib/store';
import type { Driver } from '@/types';

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

export default function DriverSelectPage() {
  const router = useRouter();
  const setDriver = useDriverStore((s) => s.setDriver);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pinDriver, setPinDriver] = useState<Driver | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);

  useEffect(() => {
    fetch('/api/drivers')
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load drivers (${r.status})`);
        return r.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : data.drivers ?? [];
        setDrivers(list.filter((d: Driver) => d.active));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const selectDriver = (driver: Driver) => {
    if (driver.pin) {
      setPinDriver(driver);
      setPin('');
      setPinError(false);
    } else {
      setDriver(driver);
      router.push('/driver/route');
    }
  };

  const pressDigit = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setPinError(false);
    if (next.length === 4 && pinDriver) {
      setTimeout(() => {
        if (next === pinDriver.pin) {
          setDriver(pinDriver);
          router.push('/driver/route');
        } else {
          setPinError(true);
          setPin('');
        }
      }, 150);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-72px)] flex-col items-center justify-center bg-background px-8 py-12">
      {/* Logo area */}
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl" style={{ background: '#f5c518' }}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#1a1a1a" className="h-10 w-10">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
        </svg>
      </div>
      <h1 className="mb-1.5 text-[34px] font-bold tracking-tight text-foreground">
        MJS Deliveries
      </h1>
      <p className="mb-12 text-[19px] text-muted">Select your name to start</p>

      {loading && (
        <div className="flex items-center gap-3 text-[17px] text-muted">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-danger/10 px-6 py-4 text-center text-[17px] text-danger">
          {error}
        </div>
      )}

      {!loading && !error && drivers.length === 0 && (
        <p className="text-[17px] text-muted">No active drivers found.</p>
      )}

      <div className="grid w-full max-w-2xl grid-cols-1 gap-5">
        {drivers.map((driver) => {
          const color = getDriverColor(driver.name);
          const initial = driver.name.charAt(0).toUpperCase();
          return (
            <button
              key={driver.id}
              onClick={() => selectDriver(driver)}
              className="flex items-center gap-6 rounded-2xl bg-card p-6 text-left transition-all duration-150 active:scale-[0.97] active:bg-card-hover"
              style={{
                WebkitTapHighlightColor: 'transparent',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                minHeight: 88,
                borderLeft: '4px solid #f5c518',
              }}
            >
              <div
                className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full text-[28px] font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {initial}
              </div>
              <div className="flex-1">
                <span className="text-[24px] font-bold text-foreground">{driver.name}</span>
                {driver.pin && (
                  <p className="mt-1 text-[15px] text-muted">PIN protected</p>
                )}
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-6 w-6 text-muted-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          );
        })}
      </div>

      {/* PIN Overlay */}
      {pinDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-xl">
          <div
            className="w-full max-w-md rounded-[28px] bg-card p-10"
            style={{ animation: 'spring-in 0.35s ease-out', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}
          >
            <div className="mb-10 flex flex-col items-center gap-4">
              <div
                className="flex h-[84px] w-[84px] items-center justify-center rounded-full text-[28px] font-bold text-white"
                style={{ backgroundColor: getDriverColor(pinDriver.name) }}
              >
                {pinDriver.name.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-[26px] font-bold text-foreground">{pinDriver.name}</h2>
              <p className="text-[17px] text-muted">Enter your 4-digit PIN</p>
            </div>

            {/* PIN dots */}
            <div className="mb-10 flex justify-center gap-6">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-[18px] w-[18px] rounded-full transition-all duration-200 ${
                    i < pin.length
                      ? pinError
                        ? 'bg-danger scale-110'
                        : 'bg-accent scale-110'
                      : 'border-2 border-[#d1d1d6] bg-transparent'
                  }`}
                />
              ))}
            </div>

            {pinError && (
              <p className="mb-5 text-center text-[17px] font-medium text-danger">
                Wrong PIN. Try again.
              </p>
            )}

            {/* Number pad */}
            <div className="grid grid-cols-3 gap-4 px-6">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace'].map((key) => {
                if (key === '') return <div key="empty" />;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (key === 'backspace') {
                        setPin((p) => p.slice(0, -1));
                        setPinError(false);
                      } else {
                        pressDigit(key);
                      }
                    }}
                    className="flex h-[72px] w-[72px] items-center justify-center justify-self-center rounded-full bg-background text-[28px] font-medium text-foreground transition-all duration-100 active:bg-[#d1d1d6] active:scale-[0.92]"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    {key === 'backspace' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-7 w-7">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.374-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.21-.211.497-.33.795-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.795-.33z" />
                      </svg>
                    ) : (
                      key
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setPinDriver(null)}
              className="mt-10 w-full py-3 text-center text-[19px] font-medium text-ios-blue transition-opacity active:opacity-60"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
