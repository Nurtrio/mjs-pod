'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Dashboard', icon: (active: boolean) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent)' : 'var(--muted)'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )},
  { href: '/upload', label: 'Upload', icon: (active: boolean) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent)' : 'var(--muted)'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )},
  { href: '/routes', label: 'Routes', icon: (active: boolean) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent)' : 'var(--muted)'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="3" />
      <path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.05 11.5 7.35 11.76a1 1 0 0 0 1.3 0C12.95 21.5 20 15.4 20 10a8 8 0 0 0-8-8z" />
    </svg>
  )},
  { href: '/archive', label: 'Archive', icon: (active: boolean) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent)' : 'var(--muted)'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
      <path d="M3 3h18v4H3z" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7" />
    </svg>
  )},
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 64,
        padding: '0 32px',
        background: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* Left: Logo */}
      <Link
        href="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          textDecoration: 'none',
          color: 'var(--foreground)',
        }}
      >
        <img
          src="/mjs-logo.png"
          alt="MJS Logo"
          style={{
            height: 48,
            width: 'auto',
            objectFit: 'contain',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--foreground)' }}>
            Mobile Janitorial Supply
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Delivery System
          </span>
        </div>
      </Link>

      {/* Right: Nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {links.map((link) => {
          const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--foreground)' : 'var(--muted)',
                textDecoration: 'none',
                borderRadius: 10,
                background: isActive ? 'rgba(52,199,89,0.06)' : 'transparent',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(60,60,67,0.04)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--foreground)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--muted)';
                }
              }}
            >
              {link.icon(isActive)}
              <span>{link.label}</span>
              {/* Active bottom indicator */}
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: -1,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 20,
                    height: 2.5,
                    borderRadius: 2,
                    background: 'var(--accent)',
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
