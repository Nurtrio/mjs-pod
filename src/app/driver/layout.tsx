'use client';

import { useDriverStore } from '@/lib/store';

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const driver = useDriverStore((s) => s.driver);

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-5 py-2.5"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div className="flex items-center gap-3">
          <img
            src="/mjs-logo.png"
            alt="MJS Logo"
            style={{ height: 40, width: 'auto', objectFit: 'contain' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--foreground)' }}>
              Mobile Janitorial Supply
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
              Delivery System
            </span>
          </div>
        </div>
        {driver && (
          <span className="text-[16px] font-semibold text-muted">{driver.name}</span>
        )}
      </header>
      <main>{children}</main>
    </div>
  );
}
