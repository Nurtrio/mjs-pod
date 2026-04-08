'use client';

import type { Invoice } from '@/types';

interface InvoiceCardProps {
  invoice: Invoice;
  stopNumber?: number;
  stopType?: 'delivery' | 'pickup';
}

export default function InvoiceCard({ invoice, stopNumber, stopType }: InvoiceCardProps) {
  const isPickup = stopType === 'pickup' || invoice.ticket_type === 'pickup';

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
        background: isPickup ? 'rgba(255,149,0,0.06)' : 'var(--background)',
        borderRadius: 12,
        transition: 'transform 0.15s cubic-bezier(0.32,0.72,0,1), box-shadow 0.15s ease',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        borderLeft: isPickup ? '3px solid #ff9500' : 'none',
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
            background: isPickup ? 'rgba(255,149,0,0.15)' : 'rgba(0,122,255,0.1)',
            color: isPickup ? '#ff9500' : 'var(--blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {isPickup ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a1 1 0 011 1v5h5a1 1 0 110 2H9v5a1 1 0 11-2 0V9H2a1 1 0 010-2h5V2a1 1 0 011-1z"/>
            </svg>
          ) : (
            stopNumber
          )}
        </span>
      )}

      {/* Invoice info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
            {invoice.invoice_number}
          </span>
          {isPickup && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#ff9500',
              background: 'rgba(255,149,0,0.12)', padding: '2px 6px',
              borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              Pickup
            </span>
          )}
        </div>
        <p style={{
          margin: '2px 0 0', fontSize: 14, fontWeight: 500, color: 'var(--muted)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
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
