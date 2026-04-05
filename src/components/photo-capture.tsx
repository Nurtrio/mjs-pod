'use client';

import { useRef } from 'react';

interface PhotoCaptureProps {
  onPhotoCapture: (file: File, previewUrl: string) => void;
  onRetake: () => void;
  previewUrl: string | null;
}

export default function PhotoCapture({ onPhotoCapture, onRetake, previewUrl }: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onPhotoCapture(file, url);
  };

  const triggerCapture = () => {
    inputRef.current?.click();
  };

  if (previewUrl) {
    return (
      <div className="relative w-full" style={{ animation: 'scale-in 0.3s cubic-bezier(0.32,0.72,0,1)' }}>
        <div
          style={{
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
          }}
        >
          <img
            src={previewUrl}
            alt="Delivery photo"
            className="h-auto w-full object-contain"
            style={{ maxHeight: 560, background: '#000' }}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            onRetake();
            if (inputRef.current) inputRef.current.value = '';
          }}
          className="ios-button"
          style={{
            marginTop: 16,
            width: '100%',
            padding: '14px 0',
            fontSize: 17,
            fontWeight: 400,
            color: 'var(--blue)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Retake Photo
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleChange}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={triggerCapture}
        className="ios-button w-full"
        style={{
          flexDirection: 'column',
          gap: 20,
          borderRadius: 20,
          background: 'var(--secondary-bg)',
          border: '0.5px solid var(--border)',
          padding: '64px 32px',
          cursor: 'pointer',
          transition: 'transform 0.15s cubic-bezier(0.25,0.46,0.45,0.94), background 0.15s ease',
        }}
      >
        {/* iOS Camera-style circle button */}
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            background: 'var(--tertiary-bg)',
            border: '2px solid var(--muted-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="var(--muted)"
            style={{ width: 40, height: 40 }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
            />
          </svg>
        </div>
        <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
          Take Photo
        </span>
      </button>
    </div>
  );
}
