'use client';

import { useEffect, useState, useCallback } from 'react';
import Nav from '@/components/nav';

interface ArchiveRow {
  id: string;
  invoice_number: string;
  customer_name: string | null;
  driver_name: string | null;
  completed_at: string | null;
  pod_pdf_storage_path: string | null;
  signature_storage_path: string | null;
  photo_storage_path: string | null;
  backorder_notes: string | null;
  dwell_seconds: number | null;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ArchivePage() {
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [podViewer, setPodViewer] = useState<{ url: string; customer: string; invoice: string } | null>(null);

  const fetchArchive = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/archive?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load archive');
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [search, dateFrom, dateTo]);

  useEffect(() => {
    fetchArchive();
  }, [fetchArchive]);

  const hasDateFilters = dateFrom || dateTo;

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--background)' }}>
      <Nav />

      <main style={{ flex: 1, padding: '32px 24px 48px', maxWidth: 960, margin: '0 auto', width: '100%' }}>
        {/* Page header */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--foreground)',
              lineHeight: 1.2,
              margin: 0,
              marginBottom: 6,
            }}
          >
            Delivery Archive
          </h1>
          <p style={{ fontSize: 15, color: 'var(--muted)', margin: 0 }}>
            Browse and retrieve proof-of-delivery records
          </p>
        </div>

        {/* Stats badge */}
        {!loading && !error && rows.length > 0 && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(52,199,89,0.1)',
              borderRadius: 100,
              padding: '6px 16px',
              marginBottom: 24,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--accent)',
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>
              {rows.length} {rows.length === 1 ? 'delivery' : 'deliveries'}
            </span>
          </div>
        )}

        {/* Search header card */}
        <div
          style={{
            background: 'var(--card)',
            borderRadius: 20,
            padding: '20px 20px 16px',
            marginBottom: 24,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
            border: '0.5px solid var(--border)',
          }}
        >
          {/* Search input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'var(--background)',
              borderRadius: 16,
              padding: '14px 18px',
              transition: 'box-shadow 0.25s ease, border-color 0.25s ease',
              boxShadow: searchFocused
                ? '0 0 0 3px rgba(0,122,255,0.15)'
                : '0 1px 2px rgba(0,0,0,0.04)',
              border: searchFocused
                ? '1.5px solid var(--blue)'
                : '1px solid var(--border)',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={searchFocused ? 'var(--blue)' : 'var(--muted-2)'}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, transition: 'stroke 0.2s ease' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by invoice, customer, or driver..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') fetchArchive();
              }}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 16,
                color: 'var(--foreground)',
                fontFamily: 'inherit',
                letterSpacing: '-0.01em',
              }}
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                }}
                style={{
                  background: 'rgba(60,60,67,0.12)',
                  border: 'none',
                  borderRadius: 100,
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--foreground)" strokeWidth={3} strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter toggle + Search button row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 14,
              gap: 12,
            }}
          >
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: filtersOpen || hasDateFilters ? 'rgba(0,122,255,0.08)' : 'transparent',
                border: 'none',
                borderRadius: 10,
                padding: '8px 14px',
                fontSize: 14,
                fontWeight: 500,
                color: hasDateFilters ? 'var(--blue)' : 'var(--muted)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.2s ease',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Date Filters
              {hasDateFilters && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--blue)',
                  }}
                />
              )}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transition: 'transform 0.25s ease',
                  transform: filtersOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            <button
              onClick={fetchArchive}
              style={{
                background: 'var(--blue)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 12,
                padding: '10px 24px',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '-0.01em',
                transition: 'transform 0.15s ease, opacity 0.15s ease',
              }}
              onMouseDown={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)';
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
              }}
            >
              Search
            </button>
          </div>

          {/* Collapsible date filters */}
          <div
            style={{
              overflow: 'hidden',
              maxHeight: filtersOpen ? 80 : 0,
              opacity: filtersOpen ? 1 : 0,
              transition: 'max-height 0.3s ease, opacity 0.25s ease, margin 0.3s ease',
              marginTop: filtersOpen ? 14 : 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--background)',
                  borderRadius: 12,
                  padding: '8px 14px',
                  border: '1px solid var(--border)',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  From
                </span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: 14,
                    color: 'var(--foreground)',
                    fontFamily: 'inherit',
                    colorScheme: 'light',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--background)',
                  borderRadius: 12,
                  padding: '8px 14px',
                  border: '1px solid var(--border)',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  To
                </span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: 14,
                    color: 'var(--foreground)',
                    fontFamily: 'inherit',
                    colorScheme: 'light',
                  }}
                />
              </div>
              {hasDateFilters && (
                <button
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--danger)',
                    cursor: 'pointer',
                    padding: '8px 10px',
                    fontFamily: 'inherit',
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 16 }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: '3px solid var(--border)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>Loading deliveries...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              background: 'rgba(255,69,58,0.08)',
              borderRadius: 16,
              padding: '16px 20px',
              fontSize: 15,
              color: 'var(--danger)',
              border: '1px solid rgba(255,59,48,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
        )}

        {/* Results */}
        {!loading && !error && (
          <>
            {rows.length === 0 ? (
              /* Empty state */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '80px 24px',
                }}
              >
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 24,
                    background: 'rgba(118,118,128,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
                  }}
                >
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--muted-2)"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 16l2 2 4-4" />
                    <path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14" />
                    <path d="M7.5 4.27l9 5.15" />
                    <polyline points="3.29 7 12 12 20.71 7" />
                    <line x1="12" y1="22" x2="12" y2="12" />
                  </svg>
                </div>
                <p
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: 'var(--foreground)',
                    margin: 0,
                    marginBottom: 6,
                    letterSpacing: '-0.02em',
                  }}
                >
                  No deliveries found
                </p>
                <p
                  style={{
                    fontSize: 15,
                    color: 'var(--muted)',
                    margin: 0,
                    textAlign: 'center',
                    maxWidth: 280,
                    lineHeight: 1.5,
                  }}
                >
                  Try adjusting your search or date filters to find completed deliveries.
                </p>
              </div>
            ) : (
              /* Result cards */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {rows.map((row) => (
                  <div
                    key={row.id}
                    style={{
                      background: 'var(--card)',
                      borderRadius: 20,
                      padding: '18px 20px',
                      border: '0.5px solid var(--border)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 2px 8px rgba(0,0,0,0.02)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      transition: 'box-shadow 0.2s ease',
                    }}
                  >
                    {/* Green checkmark badge */}
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        background: 'rgba(52,199,89,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>

                    {/* Invoice + Customer */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 17,
                          fontWeight: 600,
                          color: 'var(--foreground)',
                          margin: 0,
                          fontVariantNumeric: 'tabular-nums',
                          letterSpacing: '-0.01em',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.invoice_number}
                      </p>
                      <p
                        style={{
                          fontSize: 14,
                          color: 'var(--muted)',
                          margin: 0,
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.customer_name || 'No customer name'}
                      </p>
                    </div>

                    {/* Driver + Date */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: 'var(--foreground)',
                          margin: 0,
                        }}
                      >
                        {row.driver_name || '--'}
                      </p>
                      <p
                        style={{
                          fontSize: 13,
                          color: 'var(--muted)',
                          margin: 0,
                          marginTop: 2,
                        }}
                      >
                        {row.completed_at ? formatDate(row.completed_at) : '--'}
                      </p>
                    </div>

                    {/* View POD button */}
                    <div style={{ flexShrink: 0 }}>
                      {row.pod_pdf_storage_path ? (
                        <button
                          onClick={() => setPodViewer({
                            url: `${SUPABASE_URL}/storage/v1/object/public/pods/${row.pod_pdf_storage_path}`,
                            customer: row.customer_name || 'Unknown',
                            invoice: row.invoice_number,
                          })}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            background: 'rgba(0,122,255,0.1)',
                            color: 'var(--blue)',
                            fontSize: 14,
                            fontWeight: 600,
                            padding: '8px 16px',
                            borderRadius: 100,
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            transition: 'background 0.2s ease',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          View POD
                        </button>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 13,
                            color: 'var(--muted-2)',
                            padding: '8px 12px',
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                          </svg>
                          No POD
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

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
        @keyframes spin {
          to { transform: rotate(360deg); }
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
