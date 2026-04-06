'use client';

import { useDriverStore } from '@/lib/store';
import { useGpsBeacon } from '@/lib/useGpsBeacon';
import { useRouter, usePathname } from 'next/navigation';

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const driver = useDriverStore((s) => s.driver);
  const router = useRouter();
  const pathname = usePathname();

  // Send GPS position to server every 30s while driver is logged in
  useGpsBeacon(driver?.id ?? null);

  const isOnRoute = pathname === '/driver/route';

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
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/driver/route')}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[15px] font-semibold transition-all duration-150 active:scale-[0.95]"
              style={{
                WebkitTapHighlightColor: 'transparent',
                background: isOnRoute ? 'var(--accent)' : 'rgba(0,122,255,0.1)',
                color: isOnRoute ? '#fff' : 'var(--blue)',
                boxShadow: isOnRoute ? '0 2px 8px rgba(52,199,89,0.3)' : 'none',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-[18px] w-[18px]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              Route Sheet
            </button>
            <span className="text-[17px] font-semibold text-muted">{driver.name}</span>
          </div>
        )}
      </header>
      <main>{children}</main>
    </div>
  );
}
