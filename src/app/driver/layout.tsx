'use client';

import { useDriverStore } from '@/lib/store';
import { useGpsBeacon } from '@/lib/useGpsBeacon';

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const driver = useDriverStore((s) => s.driver);

  // Send GPS position to server every 30s while driver is logged in
  useGpsBeacon(driver?.id ?? null);

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-3"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div className="flex items-center gap-4">
          <img
            src="/mjs-logo.png"
            alt="MJS Logo"
            style={{ height: 48, width: 'auto', objectFit: 'contain' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--foreground)' }}>
              Mobile Janitorial Supply
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
              Delivery System
            </span>
          </div>
        </div>
        {driver && (
          <span className="text-[17px] font-semibold text-muted">{driver.name}</span>
        )}
      </header>
      <main>{children}</main>
    </div>
  );
}
