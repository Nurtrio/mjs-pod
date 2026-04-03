'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface SignaturePadProps {
  onSignatureChange: (dataUrl: string | null) => void;
  width?: number;
  height?: number;
}

export default function SignaturePad({ onSignatureChange, width, height = 300 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const [canvasWidth, setCanvasWidth] = useState(width || 600);

  useEffect(() => {
    if (!width && containerRef.current) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setCanvasWidth(entry.contentRect.width);
        }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, [width]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up high-DPI canvas
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, height);

    // Draw placeholder if no content
    if (!hasContent) {
      ctx.fillStyle = '#c7c7cc';
      ctx.font = "300 20px -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Sign here', canvasWidth / 2, height / 2);
    }
  }, [canvasWidth, height, hasContent]);

  const getPoint = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }, []);

  const startDrawing = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const point = getPoint(e);
    pointsRef.current = [point];
    setIsDrawing(true);

    if (!hasContent) {
      // Clear placeholder
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const dpr = window.devicePixelRatio || 1;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, height);
        ctx.restore();
      }
      setHasContent(true);
    }
  }, [getPoint, hasContent, canvasWidth, height]);

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const point = getPoint(e);
    pointsRef.current.push(point);

    const points = pointsRef.current;
    if (points.length < 2) return;

    ctx.strokeStyle = '#1c1c1e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Use quadratic bezier for smooth lines
    if (points.length === 2) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();
    } else {
      const last = points.length - 1;
      const prev = points[last - 1];
      const curr = points[last];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;

      ctx.beginPath();
      const prevMidX = (points[last - 2].x + prev.x) / 2;
      const prevMidY = (points[last - 2].y + prev.y) / 2;
      ctx.moveTo(prevMidX, prevMidY);
      ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      ctx.stroke();
    }
  }, [isDrawing, getPoint]);

  const stopDrawing = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    setIsDrawing(false);
    pointsRef.current = [];

    const canvas = canvasRef.current;
    if (canvas) {
      onSignatureChange(canvas.toDataURL('image/png'));
    }
  }, [isDrawing, onSignatureChange]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, height);
    ctx.restore();

    setHasContent(false);
    onSignatureChange(null);
  }, [canvasWidth, height, onSignatureChange]);

  return (
    <div ref={containerRef} className="w-full">
      <div
        style={{
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.06), 0 0.5px 0 rgba(0,0,0,0.04)',
          border: '0.5px solid var(--border)',
        }}
      >
        <canvas
          ref={canvasRef}
          className="signature-canvas block w-full"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <button
        type="button"
        onClick={clear}
        className="ios-button"
        style={{
          marginTop: 12,
          padding: '8px 0',
          fontSize: 17,
          fontWeight: 400,
          color: 'var(--blue)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Clear
      </button>
    </div>
  );
}
