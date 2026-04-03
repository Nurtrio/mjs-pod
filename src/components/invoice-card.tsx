'use client';

import type { Invoice } from '@/types';

interface InvoiceCardProps {
  invoice: Invoice;
  stopNumber?: number;
}

export default function InvoiceCard({ invoice, stopNumber }: InvoiceCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', invoice.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        cursor: 'grab',
        background: 'var(--background)',
        borderRadius: 12,
        transition: 'transform 0.15s cubic-bezier(0.32,0.72,0,1), box-shadow 0.15s ease',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
      onMouseDown={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
      }}
    >
      {/* Stop number badge */}
      {stopNumber != null && (
        <span
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: 10,
            background: 'rgba(0,122,255,0.1)',
            color: 'var(--blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {stopNumber}
        </span>
      )}

      {/* Invoice info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--foreground)',
              letterSpacing: '-0.01em',
            }}
          >
            {invoice.invoice_number}
          </span>
        </div>
        <p
          style={{
            margin: '2px 0 0',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {invoice.customer_name || 'No customer name'}
        </p>
      </div>

      {/* Drag handle icon */}
      <div style={{ flexShrink: 0, color: 'var(--muted-2)', opacity: 0.5 }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="13" r="1.5" />
        </svg>
      </div>
    </div>
  );
}
