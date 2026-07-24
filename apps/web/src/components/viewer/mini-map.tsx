// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from 'react';

interface MiniMapProps {
  /** Bumps to trigger a re-sample when the active file's html changes. */
  refreshKey: string | number;
}

/**
 * MiniMap (R2) — silhouette of the whole document at ~1:50, drawn on
 * a narrow canvas in the right rail. The current viewport is a violet
 * box overlaid on the silhouette; clicking anywhere scrolls there.
 * Drag the box to scrub.
 *
 * The silhouette samples DOM rectangles for every block-level element
 * in the content (h1/h2/h3/p/li/blockquote/pre/table) and draws a
 * faint rectangle per element scaled to the canvas. Different element
 * types use slightly different alpha so the page reads like a
 * pictographic table of contents.
 *
 * Re-samples on `refreshKey` change + window resize, and on a single
 * MutationObserver pass for the content container (catches Mermaid
 * and Shiki rehydration without a tight polling loop).
 */
const KIND_ALPHA: Record<string, number> = {
  H1: 0.85, H2: 0.7, H3: 0.55,
  P:  0.32, LI: 0.32, BLOCKQUOTE: 0.4,
  PRE: 0.5, TABLE: 0.45,
};

export function MiniMap({ refreshKey }: MiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef({ active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let rafScheduled = false;

    const sample = (): { y: number; h: number; kind: string }[] => {
      const els = document.querySelectorAll<HTMLElement>(
        '.markdown-content h1, .markdown-content h2, .markdown-content h3, ' +
        '.markdown-content p, .markdown-content li, .markdown-content blockquote, ' +
        '.markdown-content pre, .markdown-content table',
      );
      const rows: { y: number; h: number; kind: string }[] = [];
      for (const el of Array.from(els)) {
        const r = el.getBoundingClientRect();
        rows.push({
          y: r.top + window.scrollY,
          h: Math.max(2, r.height),
          kind: el.tagName,
        });
      }
      return rows;
    };

    const draw = () => {
      rafScheduled = false;
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (cssW === 0 || cssH === 0) return;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const docH = Math.max(document.documentElement.scrollHeight, 1);
      const scale = cssH / docH;

      // Silhouette boxes.
      const rows = sample();
      for (const row of rows) {
        const y = row.y * scale;
        const h = Math.max(1, row.h * scale);
        ctx.fillStyle = `rgba(232, 230, 225, ${KIND_ALPHA[row.kind] ?? 0.3})`;
        ctx.fillRect(2, y, cssW - 4, h);
      }

      // Viewport indicator — violet box at current scrollY.
      const vpTop = window.scrollY * scale;
      const vpH = Math.max(8, window.innerHeight * scale);
      ctx.fillStyle = 'rgba(185, 164, 255, 0.16)';
      ctx.fillRect(0, vpTop, cssW, vpH);
      ctx.strokeStyle = 'rgba(185, 164, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, vpTop + 0.5, cssW - 1, vpH - 1);
    };

    const schedule = () => {
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(draw);
    };

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    // Catch deferred DOM mutations from Mermaid + Shiki rehydration.
    const content = document.querySelector('.markdown-content');
    const observer = content ? new MutationObserver(schedule) : null;
    observer?.observe(content!, { childList: true, subtree: true });

    // Click + drag = scrub.
    const scrubTo = (clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      const docH = document.documentElement.scrollHeight;
      const target = ratio * docH - window.innerHeight * 0.5;
      window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    };
    const onMouseDown = (e: MouseEvent) => {
      dragRef.current.active = true;
      scrubTo(e.clientY);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.active) return;
      scrubTo(e.clientY);
    };
    const onMouseUp = () => { dragRef.current.active = false; };
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [refreshKey]);

  return (
    <div className="mv-mini-map" aria-hidden="true" title="Document mini-map · click to scrub">
      <canvas ref={canvasRef} className="mv-mini-map-canvas" />
    </div>
  );
}
