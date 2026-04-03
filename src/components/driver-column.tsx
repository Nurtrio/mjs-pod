'use client';

import { useState } from 'react';
import InvoiceCard from './invoice-card';
import type { Invoice, RouteStop } from '@/types';

interface DriverColumnProps {
  driverId: string;
  driverName: string;
  stops: (RouteStop & { invoice: Invoice })[];
  onDrop: (invoiceId: string, driverId: string) => void;
}

export default function DriverColumn({ driverId, driverName, stops, onDrop }: DriverColumnProps) {
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      style={{
        width: 320,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 16,
        background: isOver ? 'rgba(52,199,89,0.06)' : 'var(--secondary-bg)',
        border: isOver ? '0.5px solid rgba(52,199,89,0.3)' : '0.5px solid var(--border)',
        transition: 'background 0.2s ease, border-color 0.2s ease',
        overflow: 'hidden',
        animation: 'fade-up 0.3s cubic-bezier(0.32,0.72,0,1)',
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        const invoiceId = e.dataTransfer.getData('text/plain');
        if (invoiceId) {
          onDrop(invoiceId, driverId);
        }
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '0.5px solid var(--separator)',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--foreground)',
            letterSpacing: '-0.01em',
          }}
        >
          {driverName}
        </h3>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--accent)',
            background: 'rgba(52,199,89,0.12)',
            padding: '3px 10px',
            borderRadius: 12,
          }}
        >
          {stops.length} stop{stops.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Invoice list */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 120, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {stops.map((stop, idx) => (
          <InvoiceCard key={stop.invoice_id} invoice={stop.invoice} stopNumber={idx + 1} />
        ))}
        {stops.length === 0 && (
          <p
            style={{
              padding: '40px 16px',
              textAlign: 'center',
              fontSize: 15,
              color: 'var(--muted-2)',
              margin: 0,
            }}
          >
            Drag invoices here
          </p>
        )}
      </div>
    </div>
  );
}
