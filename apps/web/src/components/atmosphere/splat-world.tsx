// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { ensureDepth } from '@/lib/atmosphere/depth';
import { buildGaussianCloud } from '@/lib/atmosphere/splat-cloud';
import { createSplatRenderer } from '@/lib/atmosphere/gaussian-renderer';

interface SplatWorldProps {
  /** Painting image URL to enter. */
  src: string;
  kind?: string;
  onClose: () => void;
}

/**
 * SplatWorld — "go inside" the painting as a navigable 3D Gaussian-splat
 * cloud. The same lift + LDI as the backdrop volumetric mode, but
 * fullscreen and interactive: drag to orbit, scroll / W·S to dolly,
 * A·D to swing around, Esc to exit. The cloud assembles from scattered
 * pigment on entry. Bounded orbit keeps you in front of the cloud where
 * the LDI fill holds, so the parallax reads without revealing the void
 * behind the single-image reconstruction.
 *
 * Pure Three.js (WebGL) — light, no WebGPU, no crash risk.
 */
export function SplatWorld({ src, onClose }: SplatWorldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const depthResult = await ensureDepth(src);
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      if (!depthResult) { setStatus('error'); return; }

      // Load the painting as an HTMLImageElement for pixel sampling.
      const paintImg = await new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });
      if (cancelled) return;
      if (!paintImg) { setStatus('error'); return; }

      // Immersive view = the focus, so spend the detail budget: ~150k
      // gaussians (vs 55k for the backdrop) captures far more of the
      // high-res painting. Lighter on low-DPR / small screens.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetCount = window.innerWidth < 900 || dpr < 1.5 ? 80000 : 150000;
      const cloud = buildGaussianCloud(paintImg, depthResult.bitmap, targetCount);
      if (cancelled || !cloud) { setStatus('error'); return; }

      const THREE = await import('three');
      if (cancelled) return;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: true });
      renderer.setPixelRatio(dpr);
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.05, 50);

      // Instanced gaussian billboards via the shared renderer. Tight
      // footprint (0.85× the grid spacing) + a crisp falloff keeps
      // brushstroke detail — the old 2.6× / 5.5 combo smeared neighbours.
      const splat = createSplatRenderer(THREE, cloud, { scaleMul: 0.85, falloff: 5.5 });
      const { mesh, material } = splat;
      scene.add(mesh);

      // ── Orbit state ──────────────────────────────────────────────
      // Spherical camera around the cloud centre, bounded to stay in
      // front (where the LDI fill is valid).
      let az = 0;          // azimuth (rad)
      let el = 0.04;       // elevation (rad)
      let radius = 1.95;   // distance to centre
      const AZ_LIM = 0.85, EL_LIM = 0.6, R_MIN = 0.7, R_MAX = 3.4;
      const target = new THREE.Vector3(0, 0, 0);
      const applyCam = () => {
        const ce = Math.cos(el), se = Math.sin(el);
        camera.position.set(
          target.x + Math.sin(az) * ce * radius,
          target.y + se * radius,
          target.z + Math.cos(az) * ce * radius,
        );
        camera.lookAt(target);
        camera.updateMatrixWorld();
      };
      applyCam();

      // Back-to-front sort (counting sort inside the shared renderer).
      splat.sort(camera);

      // ── Controls ─────────────────────────────────────────────────
      let dragging = false, lastX = 0, lastY = 0;
      const onDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
      const onUp = () => { dragging = false; };
      const onPointerMove = (e: PointerEvent) => {
        if (!dragging) return;
        az = Math.max(-AZ_LIM, Math.min(AZ_LIM, az - (e.clientX - lastX) * 0.005));
        el = Math.max(-EL_LIM, Math.min(EL_LIM, el + (e.clientY - lastY) * 0.005));
        lastX = e.clientX; lastY = e.clientY;
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        radius = Math.max(R_MIN, Math.min(R_MAX, radius + e.deltaY * 0.0012));
      };
      const keys = new Set<string>();
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') { onClose(); return; }
        keys.add(e.key.toLowerCase());
      };
      const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
      canvas.addEventListener('pointerdown', onDown);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      const onResize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', onResize);

      setStatus('ready');

      const start = performance.now();
      let raf = 0;
      let sAz = 999, sEl = 999, sR = 999;
      const draw = () => {
        const t = (performance.now() - start) / 1000;
        // Keyboard: W/S dolly, A/D swing azimuth.
        if (keys.has('w')) radius = Math.max(R_MIN, radius - 0.02);
        if (keys.has('s')) radius = Math.min(R_MAX, radius + 0.02);
        if (keys.has('a')) az = Math.max(-AZ_LIM, az - 0.012);
        if (keys.has('d')) az = Math.min(AZ_LIM, az + 0.012);
        applyCam();

        const u = material.uniforms.uReveal as { value: number };
        if (u.value < 1) u.value = Math.min(1, t / 1.8);

        // Re-sort only when the view actually moved (the sort is the
        // one heavy per-frame cost at 150k splats), or while assembling.
        if (Math.abs(az - sAz) > 0.004 || Math.abs(el - sEl) > 0.004
            || Math.abs(radius - sR) > 0.01 || u.value < 1) {
          splat.sort(camera);
          sAz = az; sEl = el; sR = radius;
        }
        renderer.render(scene, camera);
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);

      cleanup = () => {
        canvas.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('wheel', onWheel);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('resize', onResize);
        if (raf) cancelAnimationFrame(raf);
        splat.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [src, onClose]);

  return (
    <div className="splat-world">
      <canvas ref={canvasRef} className="splat-world-canvas" aria-hidden="true" />
      {status === 'loading' && <div className="splat-world-status">Lifting the painting into pigment…</div>}
      {status === 'error' && <div className="splat-world-status">Couldn’t build the cloud — depth unavailable.</div>}
      {status === 'ready' && (
        <div className="splat-world-hint">drag to orbit · scroll or W/S to move · A/D to swing · Esc to exit</div>
      )}
      <button className="splat-world-exit" onClick={onClose} aria-label="Exit painting">✕</button>
    </div>
  );
}
