'use client';

import { useState } from 'react';
import InvoiceCard from './invoice-card';
import type { Invoice, RouteStop } from '@/types';
import { countDeliveryStops } from '@/lib/route-utils';

interface DriverColumnProps {
  driverId: string;
  driverName: string;
  stops: (RouteStop & { invoice: Invoice })[];
  dirty: boolean;
  statusInfo: { label: string; color: string; bg: string } | null;
  onDrop: (invoiceId: string, driverId: string) => void;
  onRemoveStop: (driverId: string, invoiceId: string) => void;
}

export default function DriverColumn({ driverId, driverName, stops, dirty, statusInfo, onDrop, onRemoveStop }: DriverColumnProps) {
  const [isOver, setIsOver] = useState(false);

  const pendingStops = stops.filter((s) => s.status !== 'completed');
  const completedStops = stops.filter((s) => s.status === 'completed');

  return (
    <div
      style={{
        width: 320,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 16,
        background: isOver ? 'rgba(52,199,89,0.06)' : 'var(--secondary-bg)',
        border: dirty
          ? '1.5px solid rgba(255,149,0,0.5)'
          : isOver
            ? '0.5px solid rgba(52,199,89,0.3)'
            : '0.5px solid var(--border)',
        transition: 'background 0.2s ease, border-color 0.2s ease',
        overflow: 'hidden',
        animation: 'fade-up 0.3s cubic-bezier(0.32,0.72,0,1)',
      }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setIsOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsOver(false); }}
      onDrop={(e) => {
        e.preventDefault(); setIsOver(false);
        const invoiceId = e.dataTransfer.getData('text/plain');
        if (invoiceId) onDrop(invoiceId, driverId);
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '0.5px solid var(--separator)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
            {driverName}
          </h3>
          {dirty && (
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ff9500', flexShrink: 0 }} title="Unsaved changes" />
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {statusInfo && (
            <span style={{ fontSize: 12, fontWeight: 600, color: statusInfo.color, background: statusInfo.bg, padding: '3px 10px', borderRadius: 12 }}>
              {statusInfo.label}
            </span>
          )}
        </div>
      </div>

      {/* Completed stops (locked, shown first) */}
      {completedStops.length > 0 && (
        <div style={{ padding: '8px 8px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 8px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="#34c759"><path d="M8 0a8 8 0 110 16A8 8 0 018 0zm3.5 5.3a.75.75 0 00-1.06-1.06L7 7.69 5.56 6.25a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l4-4z"/></svg>
            Completed ({countDeliveryStops(completedStops)} stops)
          </div>
          {completedStops.map((stop, idx) => (
            <div key={stop.invoice_id} style={{ opacity: 0.55, pointerEvents: 'none', marginBottom: 6 }}>
              <InvoiceCard invoice={stop.invoice} stopNumber={idx + 1} />
            </div>
          ))}
        </div>
      )}

      {/* Pending stops */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 120, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {completedStops.length > 0 && pendingStops.length > 0 && (
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 8px 2px' }}>
            Pending ({countDeliveryStops(pendingStops)} stops)
          </div>
        )}
        {pendingStops.map((stop, idx) => (
          <div key={stop.invoice_id} style={{ position: 'relative' }}>
            <InvoiceCard invoice={stop.invoice} stopNumber={completedStops.length + idx + 1} stopType={stop.stop_type} />
            {/* Remove button */}
            <button
              onClick={() => onRemoveStop(driverId, stop.invoice_id)}
              style={{
                position: 'absolute', top: 6, right: 6,
                width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(255,59,48,0.1)', border: 'none',
                color: '#ff3b30', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0.6, transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; }}
              title="Remove from route"
            >
              &times;
            </button>
          </div>
        ))}
        {stops.length === 0 && (
          <p style={{ padding: '40px 16px', textAlign: 'center', fontSize: 15, color: 'var(--muted-2)', margin: 0 }}>
            Drag invoices here
          </p>
        )}
      </div>
    </div>
  );
}
