// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from 'react';

/**
 * InkDropper (#11) — click anywhere on the painting and a drop of sumi
 * ink lands there, then diffuses + curls through a wind field over
 * ~30s before fading. Click-drag paints a calligraphic trail.
 *
 * Pure Canvas2D: each click spawns ~40 ink particles with random
 * outward velocity; every frame they're advected by 2D curl noise
 * (divergence-free, so the ink swirls instead of spreading uniformly),
 * stamped as soft dark splats onto a persistent ink canvas that fades
 * per-second. The splat trail IS the art — the particles themselves
 * aren't drawn, only their deposits.
 *
 * Mounts globally; only active when an atmosphere is on (gated by the
 * `enabled` prop) so it doesn't intercept clicks on the plain page.
 */
interface InkDropperProps {
  enabled: boolean;
}

interface InkParticle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;     // 1 → 0
  size: number;
}

export function InkDropper({ enabled }: InkDropperProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };
    resize();
    window.addEventListener('resize', resize);

    // ── Curl-noise wind (matches webgl-particles' field shape) ─────
    const fract = (x: number) => x - Math.floor(x);
    const fade = (t: number) => t * t * (3 - 2 * t);
    const hash = (x: number, y: number) => fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);
    const noise2 = (x: number, y: number) => {
      const ix = Math.floor(x), iy = Math.floor(y);
      const fx = fade(x - ix), fy = fade(y - iy);
      const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
    const curl = (x: number, y: number, t: number): [number, number] => {
      const fx = x * 0.0024 + t * 0.05;
      const fy = y * 0.0024 + t * 0.04;
      const e = 0.6;
      const dx = (noise2(fx, fy + e) - noise2(fx, fy - e)) / (2 * e);
      const dy = (noise2(fx + e, fy) - noise2(fx - e, fy)) / (2 * e);
      return [dx * 40, -dy * 40];
    };

    const particles: InkParticle[] = [];

    const drop = (clientX: number, clientY: number, count: number, strength: number) => {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = Math.random() * strength;
        particles.push({
          x: clientX * dpr,
          y: clientY * dpr,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 1,
          size: (2 + Math.random() * 5) * dpr,
        });
      }
    };

    let dragging = false;
    const onDown = (e: MouseEvent) => {
      if (!enabledRef.current) return;
      const t = e.target as HTMLElement | null;
      // Ignore chrome — only paint on the open painting space.
      if (t && t.closest('button, a, input, textarea, [role="button"], .mv-atm-dots, .toolbar, .sidebar, .mv-palette, .editor-overlay, .ai-chat-panel, .mv-cards-overlay, .graph-view-overlay, .markdown-content')) return;
      dragging = true;
      drop(e.clientX, e.clientY, 44, 90);
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging || !enabledRef.current) return;
      drop(e.clientX, e.clientY, 6, 40);
    };
    const onUp = () => { dragging = false; };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    let last = performance.now();
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;

      // Fade the whole ink layer slowly (~30s to clear a fresh splat).
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${0.020 * dt * 60})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';

      // Advect + stamp.
      const isLight = !document.documentElement.classList.contains('dark') &&
        document.documentElement.getAttribute('data-theme') !== 'dark';
      // Ink is dark on light theme, a luminous indigo on dark theme so
      // it reads against the painting either way.
      const inkRGB = isLight ? '20, 16, 28' : '120, 105, 200';

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const [wx, wy] = curl(p.x / dpr, p.y / dpr, t);
        p.vx = p.vx * 0.94 + wx * dt;
        p.vy = p.vy * 0.94 + wy * dt + 6 * dt; // gentle gravity
        p.x += p.vx * dt * dpr;
        p.y += p.vy * dt * dpr;
        p.life -= dt * 0.5;            // ~2s particle life; deposits persist
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        const a = p.life * 0.10;       // each stamp is faint; they layer
        const r = p.size * (1.4 - p.life * 0.4);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(${inkRGB}, ${a})`);
        g.addColorStop(1, `rgba(${inkRGB}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  if (!enabled) return null;
  return (
    <canvas
      ref={canvasRef}
      className="mv-ink-canvas"
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1 }}
    />
  );
}
