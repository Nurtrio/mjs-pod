'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useDriverStore } from '@/lib/store';
import type { RouteStop, Invoice } from '@/types';
import SignaturePad from '@/components/signature-pad';
import PhotoCapture from '@/components/photo-capture';

type Step = 'invoice' | 'photo' | 'signature' | 'review' | 'submitting' | 'success';

/* ── Inline PDF Preview with fullscreen expand ── */
function InvoicePdfPreview({ url, invoiceNumber }: { url: string; invoiceNumber: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {/* Compact preview card */}
      <div className="overflow-hidden rounded-2xl bg-card" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center justify-between border-b border-separator px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger/8">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6 text-danger">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div>
              <p className="text-[18px] font-semibold text-foreground">Invoice PDF</p>
              <p className="text-[14px] text-muted">#{invoiceNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex items-center gap-2 rounded-xl bg-ios-blue/10 px-5 py-3 text-[16px] font-semibold text-ios-blue transition-transform duration-150 active:scale-[0.95]"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
            Full Screen
          </button>
        </div>
        {/* Inline mini preview */}
        <div className="relative w-full bg-[#f8f8f8]" style={{ height: 440 }}>
          <iframe
            src={`${url}#toolbar=0&navpanes=0&view=FitH`}
            className="h-full w-full border-0"
            title="Invoice preview"
          />
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="absolute inset-0 z-10"
            aria-label="Expand invoice"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          />
        </div>
      </div>

      {/* Fullscreen overlay */}
      {expanded && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95" style={{ animation: 'fade-up 0.2s ease-out' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
            <p className="text-[18px] font-semibold text-white">Invoice #{invoiceNumber}</p>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-transform duration-150 active:scale-[0.9]"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            <iframe
              src={`${url}#toolbar=1&navpanes=0&view=FitH`}
              className="h-full w-full border-0"
              title="Invoice fullscreen"
              style={{ minHeight: '100%' }}
            />
          </div>
        </div>
      )}
    </>
  );
}

type StopData = RouteStop & { invoice: Invoice };

/* Step indicator bar */
function StepBar({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { num: 1, label: 'Photo' },
    { num: 2, label: 'Signature' },
    { num: 3, label: 'Review' },
  ];

  return (
    <div className="mb-7">
      <div className="flex items-center gap-4">
        {steps.map((s) => (
          <div key={s.num} className="flex flex-1 flex-col items-center gap-2.5">
            <div className={`h-[6px] w-full rounded-full transition-all duration-500 ${
              s.num <= current ? 'bg-accent' : 'bg-border'
            }`} />
            <span className={`text-[13px] font-semibold uppercase tracking-wider ${
              s.num === current ? 'text-accent' : s.num < current ? 'text-muted' : 'text-muted-2'
            }`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubmittingScreen() {
  const [elapsed, setElapsed] = useState(0);
  const totalSeconds = 7;

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => Math.min(prev + 1, totalSeconds));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const progress = Math.min((elapsed / totalSeconds) * 100, 95);
  const remaining = Math.max(totalSeconds - elapsed, 0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-8">
      {/* Animated spinner */}
      <div className="relative mb-10">
        <svg className="h-28 w-28" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="6" />
          <circle
            cx="60" cy="60" r="52" fill="none" stroke="var(--accent)" strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 52}`}
            strokeDashoffset={`${2 * Math.PI * 52 * (1 - progress / 100)}`}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[32px] font-bold text-accent">{remaining}</span>
          <span className="text-[12px] font-semibold uppercase tracking-wider text-muted">sec</span>
        </div>
      </div>

      <p className="text-[24px] font-bold text-foreground">Processing POD...</p>
      <p className="mt-3 text-[16px] text-muted">Uploading photo, signature & generating PDF</p>
      <p className="mt-6 text-[14px] text-muted-2">Please don&apos;t close this page</p>
    </div>
  );
}

export default function DeliverPage() {
  const router = useRouter();
  const { stopId } = useParams<{ stopId: string }>();
  const driver = useDriverStore((s) => s.driver);

  const [step, setStep] = useState<Step>('invoice');
  const [stop, setStop] = useState<StopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [podFilename, setPodFilename] = useState('');

  useEffect(() => {
    if (!driver) {
      router.replace('/driver');
      return;
    }
    if (!stopId) return;
    setLoading(true);
    fetch(`/api/stops/${stopId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load stop (${r.status})`);
        return r.json();
      })
      .then((data) => {
        setStop(data);
        // Record arrival time when driver opens this stop
        if (data && !data.arrived_at && data.status === 'pending') {
          fetch(`/api/stops/${stopId}/arrive`, { method: 'POST' }).catch(() => {});
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [driver, stopId, router]);

  const handlePhotoCapture = useCallback((file: File, previewUrl: string) => {
    setPhotoFile(file);
    setPhotoPreview(previewUrl);
  }, []);

  const handleRetakePhoto = useCallback(() => {
    setPhotoFile(null);
    setPhotoPreview(null);
  }, []);

  const handleSignatureChange = useCallback((dataUrl: string | null) => {
    setSignatureDataUrl(dataUrl);
  }, []);

  const handleSubmit = async () => {
    if (!stop || !driver || !photoFile || !signatureDataUrl) return;
    setStep('submitting');
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.append('stop_id', stop.id);
      formData.append('driver_id', driver.id);
      formData.append('photo', photoFile);
      formData.append('signature', signatureDataUrl);
      if (notes.trim()) formData.append('notes', notes.trim());

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        );
        formData.append('gps_lat', String(pos.coords.latitude));
        formData.append('gps_lng', String(pos.coords.longitude));
      } catch {
        // GPS optional
      }

      const res = await fetch('/api/pod/submit', { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Submit failed (${res.status})`);
      }
      const result = await res.json();

      const invoiceNum = stop.invoice?.invoice_number || 'UNKNOWN';
      const driverName = driver.name.replace(/\s+/g, '_');
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      setPodFilename(result.filename || `INV-${invoiceNum}_${driverName}_${date}.pdf`);
      setStep('success');
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Submission failed');
      setStep('review');
    }
  };

  if (!driver) return null;

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <div className="flex items-center gap-3 text-[17px] text-muted">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading delivery...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center gap-4 px-6">
        <div className="rounded-2xl bg-danger/10 px-6 py-5 text-center text-[17px] text-danger">
          {error}
        </div>
        <button
          type="button"
          onClick={() => router.push('/driver/route')}
          className="rounded-2xl bg-card px-8 py-4 text-[17px] font-semibold text-foreground transition-transform duration-150 active:scale-[0.97]"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          Back to Route
        </button>
      </div>
    );
  }

  const invoiceNumber = stop?.invoice?.invoice_number || 'N/A';
  const customerName = stop?.invoice?.customer_name || 'Unknown Customer';

  // ── STEP: INVOICE VIEW ──
  if (step === 'invoice') {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const pdfPath = stop?.invoice?.pdf_storage_path;
    const pdfUrl = pdfPath ? `${supabaseUrl}/storage/v1/object/public/invoices/${pdfPath}` : null;

    return (
      <div className="min-h-[calc(100vh-72px)] bg-background">
        <div className="px-6 py-7">
          {/* Back & View Route */}
          <div className="mb-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push('/driver/route')}
              className="flex items-center gap-2 text-[18px] font-medium text-ios-blue transition-opacity active:opacity-60"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Route
            </button>
            <button
              type="button"
              onClick={() => router.push('/driver/route')}
              className="flex items-center gap-2 rounded-xl bg-ios-blue/10 px-4 py-2.5 text-[15px] font-semibold text-ios-blue transition-all duration-150 active:scale-[0.95]"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4.5 w-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              View All Stops
            </button>
          </div>

          {/* Delivery info header */}
          <div className="mb-6 rounded-2xl bg-card p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
            <div className="flex items-start gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-[22px] font-bold text-accent">
                {stop?.stop_order || '#'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium uppercase tracking-wider text-muted">Stop {stop?.stop_order}</p>
                <h2 className="mt-1 text-[26px] font-bold leading-tight text-foreground">{customerName}</h2>
                <p className="mt-1.5 text-[17px] font-medium text-ios-blue">INV #{invoiceNumber}</p>
              </div>
            </div>

            {/* Address — large and prominent */}
            {stop?.invoice?.customer_address && (
              <div className="mt-5 flex items-start gap-4 rounded-xl bg-ios-blue/8 p-5">
                <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ios-blue/15">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6 text-ios-blue">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold uppercase tracking-wider text-ios-blue/70">Delivery Address</p>
                  <p className="mt-1 text-[22px] font-bold leading-snug text-foreground">{stop.invoice.customer_address}</p>
                </div>
              </div>
            )}
          </div>

          {/* PDF Preview */}
          {pdfUrl ? (
            <div className="mb-6">
              <InvoicePdfPreview url={pdfUrl} invoiceNumber={invoiceNumber} />
            </div>
          ) : (
            <div className="mb-6 flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-12 text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-12 w-12 text-muted-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="text-[16px] text-muted">No PDF attached to this invoice</p>
            </div>
          )}

          {/* Start button */}
          <button
            type="button"
            onClick={() => setStep('photo')}
            className="w-full rounded-2xl bg-accent py-[20px] text-[20px] font-bold text-white shadow-[0_4px_16px_rgba(52,199,89,0.3)] transition-all duration-150 active:scale-[0.97] active:shadow-[0_2px_8px_rgba(52,199,89,0.2)]"
            style={{ WebkitTapHighlightColor: 'transparent', height: 68 }}
          >
            Begin Delivery
          </button>
        </div>
      </div>
    );
  }

  // ── STEP: PHOTO CAPTURE ──
  if (step === 'photo') {
    return (
      <div className="flex min-h-[calc(100vh-72px)] flex-col bg-background px-6 py-7">
        <StepBar current={1} />

        <div className="mb-4 rounded-2xl bg-card p-5" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
          <p className="text-[18px] font-bold text-foreground">{customerName}</p>
          <p className="mt-1 text-[15px] font-medium text-ios-blue">INV #{invoiceNumber}</p>
          {stop?.invoice?.customer_address && (
            <p className="mt-2 text-[17px] font-semibold leading-snug text-foreground/80">{stop.invoice.customer_address}</p>
          )}
        </div>

        <h2 className="mb-5 text-[24px] font-bold text-foreground">Take Delivery Photo</h2>

        <div className="flex-1">
          <PhotoCapture
            onPhotoCapture={handlePhotoCapture}
            onRetake={handleRetakePhoto}
            previewUrl={photoPreview}
          />
        </div>

        <div className="mt-7 flex gap-4">
          <button
            type="button"
            onClick={() => setStep('invoice')}
            className="flex-1 rounded-2xl bg-card py-[18px] text-[18px] font-semibold text-foreground transition-all duration-150 active:scale-[0.97]"
            style={{ WebkitTapHighlightColor: 'transparent', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => setStep('signature')}
            disabled={!photoFile}
            className="flex-1 rounded-2xl bg-accent py-[18px] text-[18px] font-bold text-white shadow-[0_4px_16px_rgba(52,199,89,0.3)] transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  // ── STEP: SIGNATURE CAPTURE ──
  if (step === 'signature') {
    return (
      <div className="flex min-h-[calc(100vh-72px)] flex-col bg-background px-6 py-7">
        <StepBar current={2} />

        <div className="mb-4 rounded-2xl bg-card p-5" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
          <p className="text-[18px] font-bold text-foreground">{customerName}</p>
          <p className="mt-1 text-[15px] font-medium text-ios-blue">INV #{invoiceNumber}</p>
          {stop?.invoice?.customer_address && (
            <p className="mt-2 text-[17px] font-semibold leading-snug text-foreground/80">{stop.invoice.customer_address}</p>
          )}
        </div>

        <h2 className="mb-2 text-[24px] font-bold text-foreground">Customer Signature</h2>
        <p className="mb-6 text-[16px] text-muted">Have the customer sign in the box below</p>

        <div className="flex-1">
          <SignaturePad onSignatureChange={handleSignatureChange} height={380} />
        </div>

        <div className="mt-7 flex gap-4">
          <button
            type="button"
            onClick={() => setStep('photo')}
            className="flex-1 rounded-2xl bg-card py-[18px] text-[18px] font-semibold text-foreground transition-all duration-150 active:scale-[0.97]"
            style={{ WebkitTapHighlightColor: 'transparent', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => setStep('review')}
            disabled={!signatureDataUrl}
            className="flex-1 rounded-2xl bg-accent py-[18px] text-[18px] font-bold text-white shadow-[0_4px_16px_rgba(52,199,89,0.3)] transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  // ── STEP: REVIEW & SUBMIT ──
  if (step === 'review') {
    return (
      <div className="flex min-h-[calc(100vh-72px)] flex-col bg-background px-6 py-7">
        <StepBar current={3} />

        <h2 className="mb-6 text-[24px] font-bold text-foreground">Review & Submit</h2>

        <div className="flex-1 space-y-5">
          {/* Delivery info */}
          <div className="rounded-2xl bg-card p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ios-blue/10 text-[20px] font-bold text-ios-blue">
                {stop?.stop_order || '#'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[20px] font-bold text-foreground">{customerName}</p>
                <p className="mt-1 text-[16px] font-medium text-muted">INV #{invoiceNumber}</p>
              </div>
            </div>
          </div>

          {/* Photo */}
          <div className="rounded-2xl bg-card p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 text-accent">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                </div>
                <p className="text-[18px] font-semibold text-foreground">Delivery Photo</p>
              </div>
              <button
                type="button"
                onClick={() => setStep('photo')}
                className="rounded-lg px-4 py-2 text-[16px] font-semibold text-ios-blue transition-opacity active:opacity-60"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                Retake
              </button>
            </div>
            {photoPreview && (
              <img
                src={photoPreview}
                alt="Delivery"
                className="w-full rounded-2xl bg-black object-contain"
                style={{ maxHeight: 340 }}
              />
            )}
          </div>

          {/* Signature */}
          <div className="rounded-2xl bg-card p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ios-blue/10">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 text-ios-blue">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                  </svg>
                </div>
                <p className="text-[18px] font-semibold text-foreground">Customer Signature</p>
              </div>
              <button
                type="button"
                onClick={() => setStep('signature')}
                className="rounded-lg px-4 py-2 text-[16px] font-semibold text-ios-blue transition-opacity active:opacity-60"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                Redo
              </button>
            </div>
            {signatureDataUrl && (
              <div className="overflow-hidden rounded-2xl border border-separator bg-white">
                <img
                  src={signatureDataUrl}
                  alt="Signature"
                  className="w-full object-contain"
                  style={{ height: 160 }}
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="rounded-2xl bg-card p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange/10">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 text-orange">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              </div>
              <p className="text-[18px] font-semibold text-foreground">Notes <span className="font-normal text-muted">(optional)</span></p>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Missing items, special instructions..."
              rows={3}
              className="w-full resize-none rounded-xl bg-background p-5 text-[17px] leading-relaxed text-foreground placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          {submitError && (
            <div className="rounded-2xl bg-danger/10 px-6 py-5 text-center text-[16px] font-medium text-danger">
              {submitError}
            </div>
          )}
        </div>

        <div className="mt-7 flex gap-4">
          <button
            type="button"
            onClick={() => setStep('signature')}
            className="rounded-2xl bg-card px-8 py-[18px] text-[18px] font-semibold text-foreground transition-all duration-150 active:scale-[0.97]"
            style={{ WebkitTapHighlightColor: 'transparent', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 rounded-2xl bg-accent py-[18px] text-[20px] font-bold text-white shadow-[0_4px_16px_rgba(52,199,89,0.3)] transition-all duration-150 active:scale-[0.97]"
            style={{ WebkitTapHighlightColor: 'transparent', height: 64 }}
          >
            Submit POD
          </button>
        </div>
      </div>
    );
  }

  // ── STEP: SUBMITTING ──
  if (step === 'submitting') {
    return <SubmittingScreen />;
  }

  // ── STEP: SUCCESS ──
  if (step === 'success') {
    return (
      <div className="flex min-h-[calc(100vh-72px)] flex-col items-center justify-center bg-background px-8">
        <div style={{ animation: 'spring-in 0.5s ease-out' }} className="flex flex-col items-center">
          <div className="mb-8 flex h-32 w-32 items-center justify-center rounded-full bg-accent/15">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="h-20 w-20 text-accent"
              style={{ animation: 'checkDraw 0.5s ease-out forwards' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="mb-3 text-[34px] font-bold text-accent">POD Submitted!</h2>
          <p className="mb-2 text-[19px] text-foreground">{customerName}</p>
          {podFilename && (
            <p className="mb-12 max-w-md break-all text-center text-[14px] text-muted">{podFilename}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => router.push('/driver/route')}
          className="w-full max-w-md rounded-2xl bg-accent py-[20px] text-[20px] font-bold text-white shadow-[0_4px_16px_rgba(52,199,89,0.3)] transition-all duration-150 active:scale-[0.97]"
          style={{ WebkitTapHighlightColor: 'transparent', height: 68 }}
        >
          Next Delivery
        </button>
      </div>
    );
  }

  return null;
}
