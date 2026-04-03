'use client';

import { useCallback, useRef, useState } from 'react';
import Nav from '@/components/nav';

interface FileEntry {
  file: File;
  invoiceNumber: string;
  customerName: string;
  uploaded: boolean;
  error: string | null;
  previewUrl?: string;
  extracting?: boolean;
}

export default function UploadPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
        return { file, invoiceNumber, customerName, uploaded: false, error: null, previewUrl: URL.createObjectURL(file), extracting: true };
      });

      // Fire off Claude extraction for each file
      entries.forEach((entry, i) => {
        extractWithClaude(entry.file, startIdx + i);
      });

      return [...prev, ...entries];
    });
    setAllDone(false);
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

  const updateField = (idx: number, field: 'invoiceNumber' | 'customerName', value: string) => {
    setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, [field]: value } : f)));
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadAll = async () => {
    setUploading(true);
    const updated = [...files];

    for (let i = 0; i < updated.length; i++) {
      if (updated[i].uploaded) continue;

      const formData = new FormData();
      formData.append('file', updated[i].file);
      formData.append('invoice_number', updated[i].invoiceNumber);
      formData.append('customer_name', updated[i].customerName);

      try {
        const res = await fetch('/api/invoices/upload', { method: 'POST', body: formData });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Upload failed');
        }
        updated[i] = { ...updated[i], uploaded: true, error: null };
      } catch (e: unknown) {
        updated[i] = { ...updated[i], error: e instanceof Error ? e.message : 'Upload failed' };
      }
      setFiles([...updated]);
    }

    setUploading(false);
    if (updated.every((f) => f.uploaded)) setAllDone(true);
  };

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--background)' }}>
      <Nav />
      <main style={{ flex: 1, padding: '32px 40px 48px', maxWidth: 800, margin: '0 auto', width: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--foreground)',
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            Upload Invoices
          </h1>
          <p
            style={{
              fontSize: 15,
              color: 'var(--muted)',
              marginTop: 6,
              margin: 0,
              marginBlockStart: 6,
            }}
          >
            Add PDF invoices to assign to driver routes
          </p>
        </div>

        {/* Success Banner */}
        {allDone && (
          <div
            style={{
              background: 'rgba(52,199,89,0.08)',
              borderRadius: 16,
              padding: '16px 22px',
              fontSize: 15,
              fontWeight: 600,
              color: '#34c759',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: 'rgba(52,199,89,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            All invoices uploaded successfully
          </div>
        )}

        {/* Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            background: dragOver ? 'rgba(52,199,89,0.04)' : 'var(--card)',
            borderRadius: 22,
            border: 'none',
            padding: '56px 32px',
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
          {/* Subtle gradient overlay on hover */}
          {dragOver && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(135deg, rgba(52,199,89,0.04) 0%, rgba(52,199,89,0.08) 100%)',
                borderRadius: 22,
                pointerEvents: 'none',
              }}
            />
          )}
          {/* Cloud upload illustration */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 22,
              background: dragOver ? 'rgba(52,199,89,0.12)' : 'rgba(52,199,89,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              transition: 'all 0.25s ease',
            }}
          >
            <svg
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              stroke={dragOver ? '#34c759' : 'var(--accent)'}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transition: 'stroke 0.25s ease' }}
            >
              <path d="M12 16.5V9.75m0 0 3 3m-3-3-3 3" />
              <path d="M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
            </svg>
          </div>
          <p
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: dragOver ? '#34c759' : 'var(--foreground)',
              margin: 0,
              transition: 'color 0.25s ease',
            }}
          >
            {dragOver ? 'Drop your files here' : 'Drag & drop PDF invoices'}
          </p>
          <p
            style={{
              fontSize: 14,
              color: 'var(--muted)',
              margin: 0,
              marginTop: 8,
            }}
          >
            or click to browse your files
          </p>
          <div
            style={{
              marginTop: 16,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 16px',
              borderRadius: 100,
              background: 'rgba(60,60,67,0.04)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--muted)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            PDF files only
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={handleChange}
          />
        </div>

        {/* File Cards */}
        {files.length > 0 && (
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
                {/* Green left accent on success */}
                {entry.uploaded && (
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: '#34c759', borderRadius: '4px 0 0 4px' }} />
                )}

                <div style={{ display: 'flex', gap: 0 }}>
                  {/* Left: Mini PDF thumbnail */}
                  <div
                    style={{
                      width: 120,
                      minHeight: 160,
                      flexShrink: 0,
                      background: '#f8f8fa',
                      borderRight: '1px solid var(--border)',
                      position: 'relative',
                      overflow: 'hidden',
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
                    {/* PDF badge overlay */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 6,
                        left: 6,
                        background: 'rgba(255,59,48,0.9)',
                        color: '#fff',
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        letterSpacing: '0.03em',
                      }}
                    >
                      PDF
                    </div>
                  </div>

                  {/* Right: Info + editable fields */}
                  <div style={{ flex: 1, padding: '16px 20px', minWidth: 0 }}>
                    {/* Header row: status + remove */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {entry.uploaded ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34c759', fontSize: 13, fontWeight: 600 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
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
                          style={{
                            background: 'none', border: 'none', color: 'var(--danger)', fontSize: 13, fontWeight: 600,
                            cursor: 'pointer', padding: '4px 10px', flexShrink: 0, fontFamily: 'inherit', borderRadius: 8,
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {/* Customer Name — on top */}
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Customer
                      </label>
                      <input
                        type="text"
                        value={entry.customerName}
                        onChange={(e) => updateField(idx, 'customerName', e.target.value)}
                        placeholder="Customer name"
                        disabled={entry.uploaded}
                        style={{
                          width: '100%', background: entry.uploaded ? 'rgba(60,60,67,0.03)' : 'var(--background)',
                          border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px',
                          fontSize: 15, fontWeight: 600, color: entry.uploaded ? 'var(--muted)' : 'var(--foreground)',
                          outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                          transition: 'border-color 0.2s, box-shadow 0.2s',
                        }}
                        onFocus={(e) => { if (!entry.uploaded) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(52,199,89,0.12)'; } }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                      />
                    </div>

                    {/* Invoice Number — below */}
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Invoice #
                      </label>
                      <input
                        type="text"
                        value={entry.invoiceNumber}
                        onChange={(e) => updateField(idx, 'invoiceNumber', e.target.value)}
                        placeholder="e.g. 350601"
                        disabled={entry.uploaded}
                        style={{
                          width: '100%', background: entry.uploaded ? 'rgba(60,60,67,0.03)' : 'var(--background)',
                          border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px',
                          fontSize: 15, fontWeight: 600, color: entry.uploaded ? 'var(--muted)' : 'var(--foreground)',
                          outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                          fontVariantNumeric: 'tabular-nums', transition: 'border-color 0.2s, box-shadow 0.2s',
                        }}
                        onFocus={(e) => { if (!entry.uploaded) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(52,199,89,0.12)'; } }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload All Button */}
        {files.length > 0 && !allDone && (
          <button
            onClick={uploadAll}
            disabled={uploading}
            style={{
              width: '100%',
              height: 56,
              background: uploading
                ? 'linear-gradient(135deg, rgba(52,199,89,0.5) 0%, rgba(40,167,69,0.5) 100%)'
                : 'linear-gradient(135deg, #34c759 0%, #28a745 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 16,
              fontSize: 17,
              fontWeight: 600,
              cursor: uploading ? 'default' : 'pointer',
              fontFamily: 'inherit',
              boxShadow: uploading ? 'none' : '0 4px 16px rgba(52,199,89,0.25)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              letterSpacing: '-0.01em',
            }}
          >
            {uploading ? (
              <>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    border: '2.5px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                Uploading...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload All Invoices
              </>
            )}
          </button>
        )}
      </main>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
