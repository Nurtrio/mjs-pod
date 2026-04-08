'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Nav from '@/components/nav';
import type { TerritoryAssignment } from '@/types';

const DRIVER_COLORS: Record<string, string> = {
  Erik: '#3b82f6',
  Jose: '#f59e0b',
};

function getDriverColor(name: string): string {
  for (const [key, color] of Object.entries(DRIVER_COLORS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return '#8b5cf6';
}

interface FileEntry {
  file: File;
  invoiceNumber: string;
  customerName: string;
  customerAddress: string;
  ticketType: 'delivery' | 'pickup';
  uploaded: boolean;
  uploadedId?: string; // Supabase invoice ID after upload
  error: string | null;
  previewUrl?: string;
  extracting?: boolean;
  // Dispatch fields
  assignedDriverId?: string;
  assignedDriverName?: string;
  confidence?: 'high' | 'medium' | 'low';
  reasoning?: string;
}

type Mode = 'upload' | 'dispatch';

export default function UploadPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [mode, setMode] = useState<Mode>('dispatch');
  const inputRef = useRef<HTMLInputElement>(null);

  // Dispatch state
  const [classifying, setClassifying] = useState(false);
  const [classified, setClassified] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [dispatchRoutes, setDispatchRoutes] = useState<{ driver_name: string; stop_count: number; stops: { customer_name: string; invoice_number: string; address: string }[] }[]>([]);
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<{ id: string; name: string }[]>([]);
  const [showRouteBuilder, setShowRouteBuilder] = useState(false);

  // Fetch drivers on mount
  useEffect(() => {
    fetch('/api/drivers')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setDrivers(data); })
      .catch(() => {});
  }, []);

  const extractWithClaude = useCallback(async (file: File, startIndex: number) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/invoices/extract', { method: 'POST', body: formData });
      if (!res.ok) return;
      const data = await res.json();
      setFiles((prev) =>
        prev.map((f, i) => {
          if (i !== startIndex || f.file !== file) return f;
          return {
            ...f,
            invoiceNumber: data.invoice_number || f.invoiceNumber,
            customerName: data.customer_name || f.customerName,
            customerAddress: data.customer_address || f.customerAddress,
            extracting: false,
          };
        }),
      );
    } catch {
      setFiles((prev) => prev.map((f, i) => (i === startIndex && f.file === file ? { ...f, extracting: false } : f)));
    }
  }, []);

  const processFiles = useCallback((fileList: FileList | File[]) => {
    const pdfs = Array.from(fileList).filter(
      (f) => f.type === 'application/pdf' || f.name.endsWith('.pdf'),
    );

    setFiles((prev) => {
      const startIdx = prev.length;
      const entries: FileEntry[] = pdfs.map((file) => {
        const nameWithoutExt = file.name.replace(/\.pdf$/i, '');
        const numMatch = nameWithoutExt.match(/(\d{5,7})/);
        const invoiceNumber = numMatch ? numMatch[1] : '';
        let customerName = '';
        const fromMatch = nameWithoutExt.match(/from[_\s]+(.+)/i);
        if (fromMatch) customerName = fromMatch[1].replace(/[_]+/g, ' ').trim();
        return {
          file, invoiceNumber, customerName, customerAddress: '', ticketType: 'delivery' as const,
          uploaded: false, error: null,
          previewUrl: URL.createObjectURL(file), extracting: true,
        };
      });

      entries.forEach((entry, i) => {
        extractWithClaude(entry.file, startIdx + i);
      });

      return [...prev, ...entries];
    });
    setAllDone(false);
    setClassified(false);
    setDispatched(false);
  }, [extractWithClaude]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
    },
    [processFiles],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) processFiles(e.target.files);
    },
    [processFiles],
  );

  const toggleTicketType = (idx: number) => {
    setFiles((prev) => prev.map((f, i) => i === idx ? { ...f, ticketType: f.ticketType === 'delivery' ? 'pickup' : 'delivery' } : f));
  };

  const updateField = (idx: number, field: 'invoiceNumber' | 'customerName' | 'customerAddress', value: string) => {
    setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, [field]: value } : f)));
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setClassified(false);
  };

  // Upload all files to Supabase and then auto-dispatch
  const uploadAndDispatch = async () => {
    setUploading(true);
    const updated = [...files];

    // Step 1: Upload all files
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].uploaded) continue;

      const formData = new FormData();
      formData.append('file', updated[i].file);
      formData.append('invoice_number', updated[i].invoiceNumber);
      formData.append('customer_name', updated[i].customerName);
      if (updated[i].customerAddress) {
        formData.append('customer_address', updated[i].customerAddress);
      }
      formData.append('ticket_type', updated[i].ticketType || 'delivery');

      try {
        const res = await fetch('/api/invoices/upload', { method: 'POST', body: formData });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Upload failed');
        }
        const result = await res.json();
        updated[i] = { ...updated[i], uploaded: true, error: null, uploadedId: result.invoice?.id || result.id };
      } catch (e: unknown) {
        updated[i] = { ...updated[i], error: e instanceof Error ? e.message : 'Upload failed' };
      }
      setFiles([...updated]);
    }

    setUploading(false);

    if (mode === 'upload') {
      if (updated.every((f) => f.uploaded)) {
        setAllDone(true);
        setShowRouteBuilder(true);
      }
      return;
    }

    // Step 2: Classify territories
    const uploadedFiles = updated.filter((f) => f.uploaded);
    if (uploadedFiles.length === 0) return;

    setClassifying(true);
    try {
      const classifyRes = await fetch('/api/dispatch/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoices: uploadedFiles.map((f, i) => ({
            index: i,
            address: f.customerAddress,
            invoice_number: f.invoiceNumber,
            customer_name: f.customerName,
          })),
        }),
      });

      if (!classifyRes.ok) throw new Error('Classification failed');
      const classifyData = await classifyRes.json();
      const assignments: TerritoryAssignment[] = classifyData.assignments || [];

      // Map assignments back to files
      const newUpdated = [...updated];
      for (const assignment of assignments) {
        const uploadedIdx = uploadedFiles[assignment.invoice_index];
        if (!uploadedIdx) continue;
        const fileIdx = newUpdated.findIndex((f) => f.file === uploadedIdx.file);
        if (fileIdx >= 0) {
          newUpdated[fileIdx] = {
            ...newUpdated[fileIdx],
            assignedDriverId: assignment.driver_id,
            assignedDriverName: assignment.driver_name,
            confidence: assignment.confidence,
            reasoning: assignment.reasoning,
          };
        }
      }

      setFiles(newUpdated);
      setClassified(true);
    } catch (e) {
      console.error('Classification error:', e);
    } finally {
      setClassifying(false);
    }
  };

  // Dispatch: Create optimized routes for each driver (only assigned invoices)
  const dispatchAll = async () => {
    setDispatching(true);
    try {
      // Only dispatch invoices assigned to a driver
      const assignedFiles = files.filter((f) => f.uploaded && f.uploadedId && f.assignedDriverName);
      const assignedIds = assignedFiles.map((f) => f.uploadedId!);

      if (assignedIds.length === 0) {
        setDispatching(false);
        return;
      }

      const res = await fetch('/api/dispatch/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_ids: assignedIds }),
      });

      if (!res.ok) throw new Error('Dispatch failed');
      const data = await res.json();

      // Clean up unassigned invoices from DB
      const unassignedIds = files
        .filter((f) => f.uploaded && f.uploadedId && !f.assignedDriverName)
        .map((f) => f.uploadedId!);
      if (unassignedIds.length > 0) {
        try {
          await fetch('/api/invoices/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoice_ids: unassignedIds }),
          });
        } catch { /* best effort */ }
      }

      const routeSummary = (data.routes || [])
        .filter((r: Record<string, unknown>) => r && !r.error)
        .map((r: Record<string, unknown>) => ({
          driver_name: (r.driver as { name: string })?.name || 'Unknown',
          stop_count: (r.stops as unknown[])?.length || 0,
          stops: ((r.stops as { invoice?: { customer_name?: string; invoice_number?: string; customer_address?: string } }[] | undefined) || []).map((s) => ({
            customer_name: s.invoice?.customer_name || 'Unknown',
            invoice_number: s.invoice?.invoice_number || '—',
            address: s.invoice?.customer_address || '',
          })),
        }));

      setDispatchRoutes(routeSummary);
      setDispatched(true);
      // Clear unassigned files from local state
      setFiles((prev) => prev.filter((f) => f.assignedDriverName));
    } catch (e) {
      console.error('Dispatch error:', e);
    } finally {
      setDispatching(false);
    }
  };

  // Drag and drop between driver columns
  const [dragFileIdx, setDragFileIdx] = useState<number | null>(null);
  const [dragOverDriver, setDragOverDriver] = useState<string | null>(null);

  const handleDragStartFile = (idx: number) => {
    setDragFileIdx(idx);
  };

  const handleDropOnDriverCol = (driverName: string) => {
    if (dragFileIdx === null) return;
    const isUnassigned = driverName === 'Unassigned';
    const driver = drivers.find((d) => d.name === driverName);
    setFiles((prev) =>
      prev.map((f, i) => {
        if (i !== dragFileIdx) return f;
        return {
          ...f,
          assignedDriverId: isUnassigned ? undefined : (driver?.id || f.assignedDriverId),
          assignedDriverName: isUnassigned ? undefined : driverName,
          confidence: isUnassigned ? undefined : 'medium' as const,
          reasoning: isUnassigned ? undefined : 'Manually reassigned by dispatcher',
        };
      }),
    );
    setDragFileIdx(null);
    setDragOverDriver(null);
  };

  const anyExtracting = files.some((f) => f.extracting);
  const allUploaded = files.length > 0 && files.every((f) => f.uploaded);

  // Group files by driver for route builder — always include driver columns + Unassigned
  const driverGroups: Record<string, FileEntry[]> = {};
  const routeBuilderVisible = classified || showRouteBuilder;
  if (routeBuilderVisible) {
    // Always create columns for known drivers
    for (const d of drivers) {
      driverGroups[d.name] = [];
    }
    driverGroups['Unassigned'] = [];
    for (const f of files) {
      const key = f.assignedDriverName || 'Unassigned';
      if (!driverGroups[key]) driverGroups[key] = [];
      driverGroups[key].push(f);
    }
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--background)' }}>
      <Nav />
      <main style={{ flex: 1, padding: '32px 40px 48px', maxWidth: 960, margin: '0 auto', width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1
              style={{
                fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em',
                color: 'var(--foreground)', lineHeight: 1.2, margin: 0,
              }}
            >
              {mode === 'dispatch' ? 'Auto-Dispatch' : 'Upload Invoices'}
            </h1>
            <p style={{ fontSize: 15, color: 'var(--muted)', marginTop: 6, margin: 0, marginBlockStart: 6 }}>
              {mode === 'dispatch'
                ? 'Drop all PDFs — AI classifies territories and optimizes routes'
                : 'Add PDF invoices to assign to driver routes'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {files.length > 0 && (
              <button
                onClick={async () => {
                  // Delete uploaded invoices and their routes from Supabase
                  const uploadedIds = files.filter((f) => f.uploaded && f.uploadedId).map((f) => f.uploadedId!);
                  if (uploadedIds.length > 0) {
                    try {
                      await fetch('/api/invoices/clear', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ invoice_ids: uploadedIds }),
                      });
                    } catch { /* best effort */ }
                  }
                  setFiles([]); setClassified(false); setDispatched(false); setAllDone(false); setDispatchRoutes([]); setExpandedDriver(null); setShowRouteBuilder(false);
                }}
                style={{
                  padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: 'rgba(255,59,48,0.08)', color: '#ff3b30',
                  transition: 'all 0.2s ease',
                }}
              >
                Clear All
              </button>
            )}

            {/* Mode toggle */}
            <div
            style={{
              display: 'flex',
              background: 'var(--card)',
              borderRadius: 12,
              padding: 4,
              boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => setMode('dispatch')}
              style={{
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: mode === 'dispatch' ? 'linear-gradient(135deg, #34c759, #28a745)' : 'transparent',
                color: mode === 'dispatch' ? '#fff' : 'var(--muted)',
                transition: 'all 0.2s ease',
              }}
            >
              Auto-Dispatch
            </button>
            <button
              onClick={() => setMode('upload')}
              style={{
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: mode === 'upload' ? 'var(--foreground)' : 'transparent',
                color: mode === 'upload' ? '#fff' : 'var(--muted)',
                transition: 'all 0.2s ease',
              }}
            >
              Upload Only
            </button>
            </div>
          </div>
        </div>

        {/* Dispatch Success — simple confirmation, redirects to Route Builder */}
        {dispatched && (
          <div
            style={{
              background: 'rgba(52,199,89,0.08)',
              borderRadius: 16,
              padding: '20px 24px',
              marginBottom: 28,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              animation: 'scale-in 0.3s ease-out',
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(52,199,89,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#34c759', margin: 0 }}>Routes are live</p>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, marginTop: 2 }}>Invoices uploaded and routes dispatched to drivers.</p>
            </div>
            <a
              href="/routes"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', fontSize: 13, fontWeight: 600,
                color: '#34c759', background: 'rgba(52,199,89,0.1)',
                borderRadius: 10, textDecoration: 'none', flexShrink: 0,
              }}
            >
              View Routes →
            </a>
          </div>
        )}

        {/* Upload-only success hint */}
        {allDone && mode === 'upload' && !dispatched && (
          <div
            style={{
              background: 'rgba(52,199,89,0.08)',
              borderRadius: 16,
              padding: '14px 22px',
              fontSize: 15,
              fontWeight: 600,
              color: '#34c759',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Uploaded — drag invoices to assign drivers, then Save Routes
          </div>
        )}

        {/* Drop Zone */}
        {!dispatched && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              background: dragOver ? 'rgba(52,199,89,0.04)' : 'var(--card)',
              borderRadius: 22,
              border: 'none',
              padding: '48px 32px',
              textAlign: 'center',
              cursor: 'pointer',
              marginBottom: 28,
              transition: 'all 0.25s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxShadow: dragOver
                ? '0 0 0 2px rgba(52,199,89,0.4), 0 4px 24px rgba(52,199,89,0.12)'
                : '0 1px 8px rgba(0,0,0,0.04)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {dragOver && (
              <div
                style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(135deg, rgba(52,199,89,0.04) 0%, rgba(52,199,89,0.08) 100%)',
                  borderRadius: 22, pointerEvents: 'none',
                }}
              />
            )}
            <div
              style={{
                width: 72, height: 72, borderRadius: 22,
                background: dragOver ? 'rgba(52,199,89,0.12)' : 'rgba(52,199,89,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20, transition: 'all 0.25s ease',
              }}
            >
              {mode === 'dispatch' ? (
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={dragOver ? '#34c759' : 'var(--accent)'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.25s ease' }}>
                  <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
                </svg>
              ) : (
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={dragOver ? '#34c759' : 'var(--accent)'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.25s ease' }}>
                  <path d="M12 16.5V9.75m0 0 3 3m-3-3-3 3" />
                  <path d="M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                </svg>
              )}
            </div>
            <p style={{ fontSize: 17, fontWeight: 600, color: dragOver ? '#34c759' : 'var(--foreground)', margin: 0, transition: 'color 0.25s ease' }}>
              {dragOver ? 'Drop your files here' : mode === 'dispatch' ? 'Drop ALL invoices to auto-dispatch' : 'Drag & drop PDF invoices'}
            </p>
            <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, marginTop: 8 }}>
              {mode === 'dispatch' ? 'AI will classify territories and optimize routes' : 'or click to browse your files'}
            </p>
            <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 100, background: 'rgba(60,60,67,0.04)', fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              PDF files only
            </div>
            <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={handleChange} />
          </div>
        )}

        {/* Route Builder */}
        {routeBuilderVisible && !dispatched && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                Route Builder
              </h2>
              {classified && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34c759', display: 'inline-block' }} /> High
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff9500', display: 'inline-block', marginLeft: 8 }} /> Medium
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff3b30', display: 'inline-block', marginLeft: 8 }} /> Low
                </div>
              )}
            </div>

            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              Drag invoices between drivers to assign routes
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Object.keys(driverGroups).length}, 1fr)`, gap: 20 }}>
              {Object.entries(driverGroups).map(([driverName, driverFiles]) => {
                const isUnassigned = driverName === 'Unassigned';
                const color = isUnassigned ? '#8e8e93' : getDriverColor(driverName);
                const isOver = dragOverDriver === driverName;
                return (
                  <div
                    key={driverName}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverDriver(driverName); }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDriver(null); }}
                    onDrop={(e) => { e.preventDefault(); handleDropOnDriverCol(driverName); }}
                    style={{
                      background: isOver ? `${color}08` : 'var(--card)',
                      borderRadius: 18,
                      overflow: 'hidden',
                      boxShadow: isOver
                        ? `0 0 0 2px ${color}50, 0 4px 20px ${color}15`
                        : '0 1px 8px rgba(0,0,0,0.04)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {/* Driver column header */}
                    <div style={{
                      padding: '14px 16px 14px 22px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: isUnassigned ? 'rgba(142,142,147,0.06)' : `${color}08`,
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: isUnassigned ? 12 : '50%',
                        background: isUnassigned ? 'rgba(142,142,147,0.15)' : color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isUnassigned ? '#8e8e93' : '#fff', fontSize: 18, fontWeight: 700, flexShrink: 0,
                      }}>
                        {isUnassigned ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                            <line x1="18" y1="8" x2="23" y2="13" />
                          </svg>
                        ) : driverName.charAt(0)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontSize: 17, fontWeight: 700, color: isUnassigned ? 'var(--muted)' : 'var(--foreground)', margin: 0 }}>
                          {driverName}
                        </h3>
                        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                          {driverFiles.length} invoice{driverFiles.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      {driverFiles.length > 0 && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (isUnassigned) {
                              // Remove unassigned files from DB and UI
                              const unassignedIds = driverFiles.filter((f) => f.uploaded && f.uploadedId).map((f) => f.uploadedId!);
                              if (unassignedIds.length > 0) {
                                try {
                                  await fetch('/api/invoices/clear', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ invoice_ids: unassignedIds }),
                                  });
                                } catch { /* best effort */ }
                              }
                              setFiles((prev) => prev.filter((f) => f.assignedDriverName));
                            } else {
                              // Move all this driver's files to Unassigned
                              setFiles((prev) => prev.map((f) =>
                                f.assignedDriverName === driverName
                                  ? { ...f, assignedDriverId: undefined, assignedDriverName: undefined, confidence: undefined, reasoning: undefined }
                                  : f
                              ));
                            }
                          }}
                          style={{
                            padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                            border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                            background: 'rgba(255,59,48,0.08)', color: '#ff3b30',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {isUnassigned ? 'Clear All' : 'Clear'}
                        </button>
                      )}
                    </div>

                    {/* Stops list — draggable */}
                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
                      {driverFiles.map((f, fi) => {
                        const confColor = f.confidence === 'high' ? '#34c759' : f.confidence === 'medium' ? '#ff9500' : '#ff3b30';
                        const globalIdx = files.indexOf(f);
                        return (
                          <div
                            key={fi}
                            draggable
                            onDragStart={() => handleDragStartFile(globalIdx)}
                            onDragEnd={() => { setDragFileIdx(null); setDragOverDriver(null); }}
                            style={{
                              padding: '14px 16px',
                              background: dragFileIdx === globalIdx ? 'rgba(52,199,89,0.06)' : 'var(--background)',
                              borderRadius: 14,
                              display: 'flex', alignItems: 'center', gap: 12,
                              cursor: 'grab',
                              opacity: dragFileIdx === globalIdx ? 0.5 : 1,
                              transition: 'opacity 0.15s ease, background 0.15s ease',
                              border: dragFileIdx === globalIdx ? '1px dashed var(--accent)' : '1px solid transparent',
                            }}
                          >
                            {/* Drag handle */}
                            <div style={{ flexShrink: 0, color: 'var(--muted-2)', display: 'flex', alignItems: 'center' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="9" cy="5" r="1.5" />
                                <circle cx="15" cy="5" r="1.5" />
                                <circle cx="9" cy="12" r="1.5" />
                                <circle cx="15" cy="12" r="1.5" />
                                <circle cx="9" cy="19" r="1.5" />
                                <circle cx="15" cy="19" r="1.5" />
                              </svg>
                            </div>
                            <div style={{
                              width: 8, height: 8, borderRadius: '50%',
                              background: confColor, flexShrink: 0,
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {f.customerName || 'Unknown'}
                              </p>
                              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, marginTop: 2 }}>
                                INV #{f.invoiceNumber} {f.customerAddress ? `· ${f.customerAddress.slice(0, 35)}` : ''}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      {driverFiles.length === 0 && (
                        <div style={{
                          padding: '24px 16px', textAlign: 'center',
                          fontSize: 14, color: 'var(--muted-2)',
                          border: '2px dashed var(--border)', borderRadius: 14,
                        }}>
                          Drop invoices here
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* File Cards (pre-classification or upload-only mode) */}
        {files.length > 0 && !classified && !dispatched && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
            {files.map((entry, idx) => (
              <div
                key={`${entry.file.name}-${idx}`}
                style={{
                  background: 'var(--card)',
                  borderRadius: 18,
                  boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {entry.uploaded && (
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: '#34c759', borderRadius: '4px 0 0 4px' }} />
                )}

                <div style={{ display: 'flex', gap: 0 }}>
                  {/* PDF thumbnail */}
                  <div
                    style={{
                      width: 120, minHeight: 160, flexShrink: 0,
                      background: '#f8f8fa', borderRight: '1px solid var(--border)',
                      position: 'relative', overflow: 'hidden',
                    }}
                  >
                    {entry.previewUrl ? (
                      <iframe
                        src={`${entry.previewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                        style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
                        title={`Preview ${entry.file.name}`}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.4}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                    )}
                    <div style={{ position: 'absolute', bottom: 6, left: 6, background: 'rgba(255,59,48,0.9)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, letterSpacing: '0.03em' }}>
                      PDF
                    </div>
                  </div>

                  {/* Info fields */}
                  <div style={{ flex: 1, padding: '16px 20px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {entry.uploaded ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34c759', fontSize: 13, fontWeight: 600 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                            Uploaded
                          </div>
                        ) : entry.error ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                            {entry.error}
                          </div>
                        ) : entry.extracting ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--blue)', fontSize: 13, fontWeight: 600 }}>
                            <div style={{ width: 14, height: 14, border: '2px solid rgba(0,122,255,0.2)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            Reading with AI...
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                            {entry.file.name}
                          </span>
                        )}
                      </div>
                      {!entry.uploaded && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '4px 10px', flexShrink: 0, fontFamily: 'inherit', borderRadius: 8 }}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {/* Customer */}
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Customer</label>
                      <input
                        type="text" value={entry.customerName}
                        onChange={(e) => updateField(idx, 'customerName', e.target.value)}
                        placeholder="Customer name" disabled={entry.uploaded}
                        style={{ width: '100%', background: entry.uploaded ? 'rgba(60,60,67,0.03)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', fontSize: 15, fontWeight: 600, color: entry.uploaded ? 'var(--muted)' : 'var(--foreground)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                        onFocus={(e) => { if (!entry.uploaded) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(52,199,89,0.12)'; } }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                      />
                    </div>

                    {/* Invoice # + Address on same row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Invoice #</label>
                        <input
                          type="text" value={entry.invoiceNumber}
                          onChange={(e) => updateField(idx, 'invoiceNumber', e.target.value)}
                          placeholder="e.g. 350601" disabled={entry.uploaded}
                          style={{ width: '100%', background: entry.uploaded ? 'rgba(60,60,67,0.03)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', fontSize: 15, fontWeight: 600, color: entry.uploaded ? 'var(--muted)' : 'var(--foreground)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                          onFocus={(e) => { if (!entry.uploaded) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(52,199,89,0.12)'; } }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Delivery Address</label>
                        <input
                          type="text" value={entry.customerAddress}
                          onChange={(e) => updateField(idx, 'customerAddress', e.target.value)}
                          placeholder="Address for territory classification" disabled={entry.uploaded}
                          style={{ width: '100%', background: entry.uploaded ? 'rgba(60,60,67,0.03)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', fontSize: 15, fontWeight: 600, color: entry.uploaded ? 'var(--muted)' : 'var(--foreground)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                          onFocus={(e) => { if (!entry.uploaded) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(52,199,89,0.12)'; } }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                      </div>
                    </div>

                    {/* Ticket Type Toggle */}
                    {!entry.uploaded && (
                      <div style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={() => toggleTicketType(idx)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                            textTransform: 'uppercase', letterSpacing: '0.5px',
                            background: entry.ticketType === 'pickup' ? 'rgba(255,149,0,0.12)' : 'rgba(0,122,255,0.08)',
                            color: entry.ticketType === 'pickup' ? '#ff9500' : '#007aff',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {entry.ticketType === 'pickup' ? (
                            <>
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a1 1 0 011 1v5h5a1 1 0 110 2H9v5a1 1 0 11-2 0V9H2a1 1 0 010-2h5V2a1 1 0 011-1z"/></svg>
                              Pickup
                            </>
                          ) : (
                            <>
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M2 13h12v1H2v-1zm5-11v7.586L4.707 7.293l-.707.707L8 12l4-4-.707-.707L9 9.586V2H7z"/></svg>
                              Delivery
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        {files.length > 0 && !dispatched && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Upload + Classify (dispatch mode) or Upload Only */}
            {!allUploaded && !classified && (
              <button
                onClick={uploadAndDispatch}
                disabled={uploading || classifying || anyExtracting}
                style={{
                  width: '100%', height: 58,
                  background: (uploading || classifying || anyExtracting)
                    ? 'linear-gradient(135deg, rgba(52,199,89,0.5), rgba(40,167,69,0.5))'
                    : 'linear-gradient(135deg, #34c759, #28a745)',
                  color: '#fff', border: 'none', borderRadius: 16,
                  fontSize: 17, fontWeight: 600, cursor: (uploading || classifying || anyExtracting) ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: (uploading || classifying || anyExtracting) ? 'none' : '0 4px 16px rgba(52,199,89,0.25)',
                  transition: 'all 0.2s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}
              >
                {uploading ? (
                  <>
                    <div style={{ width: 20, height: 20, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Uploading...
                  </>
                ) : classifying ? (
                  <>
                    <div style={{ width: 20, height: 20, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    AI Classifying Territories...
                  </>
                ) : anyExtracting ? (
                  <>
                    <div style={{ width: 20, height: 20, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    AI Reading Invoices...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      {mode === 'dispatch' ? (
                        <>
                          <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
                        </>
                      ) : (
                        <>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </>
                      )}
                    </svg>
                    {mode === 'dispatch' ? 'Upload & Classify Routes' : 'Upload All Invoices'}
                  </>
                )}
              </button>
            )}

            {/* Save Routes button (after route builder is visible) */}
            {routeBuilderVisible && !dispatched && files.some((f) => f.assignedDriverName) && (
              <button
                onClick={dispatchAll}
                disabled={dispatching}
                style={{
                  width: '100%', height: 58,
                  background: dispatching
                    ? 'linear-gradient(135deg, rgba(52,199,89,0.5), rgba(40,167,69,0.5))'
                    : 'linear-gradient(135deg, #34c759, #28a745)',
                  color: '#fff', border: 'none', borderRadius: 16,
                  fontSize: 17, fontWeight: 700, cursor: dispatching ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: dispatching ? 'none' : '0 4px 16px rgba(52,199,89,0.25)',
                  transition: 'all 0.2s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}
              >
                {dispatching ? (
                  <>
                    <div style={{ width: 20, height: 20, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Saving Routes...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 2 11 13" />
                      <path d="m22 2-7 20-4-9-9-4 20-7z" />
                    </svg>
                    Save Routes
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes scale-in {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
