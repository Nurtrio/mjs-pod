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
    <div className="driver-theme min-h-screen text-foreground" style={{ paddingTop: 'env(safe-area-inset-top)', background: 'var(--background)' }}>
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-3"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          background: 'linear-gradient(135deg, #f5c518 0%, #e6b800 100%)',
          boxShadow: '0 2px 12px rgba(245,197,24,0.35)',
        }}
      >
        <div className="flex items-center gap-4">
          <img
            src="/mjs-logo.png"
            alt="MJS Logo"
            style={{ height: 48, width: 'auto', objectFit: 'contain' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
            <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em', color: '#1a1a1a' }}>
              Mobile Janitorial Supply
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(0,0,0,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
              Delivery System
            </span>
          </div>
        </div>
        {driver && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/driver/route')}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[15px] font-bold transition-all duration-150 active:scale-[0.95]"
              style={{
                WebkitTapHighlightColor: 'transparent',
                background: isOnRoute ? '#1a1a1a' : 'rgba(0,0,0,0.1)',
                color: isOnRoute ? '#f5c518' : '#1a1a1a',
                boxShadow: isOnRoute ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-[18px] w-[18px]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              Route Sheet
            </button>
            <span
              className="rounded-lg px-3 py-1.5 text-[15px] font-bold"
              style={{ background: 'rgba(0,0,0,0.1)', color: '#1a1a1a' }}
            >
              {driver.name}
            </span>
          </div>
        )}
      </header>
      <main>{children}</main>
    </div>
  );
}
