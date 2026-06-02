// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { ensureDepth } from '@/lib/atmosphere/depth';
import { buildGaussianCloud } from '@/lib/atmosphere/splat-cloud';

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
      const dpr0 = Math.min(window.devicePixelRatio || 1, 2);
      const targetCount = window.innerWidth < 900 || dpr0 < 1.5 ? 80000 : 150000;
      const cloud = buildGaussianCloud(paintImg, depthResult.bitmap, targetCount);
      if (cancelled || !cloud) { setStatus('error'); return; }
      const { base, colors, seeds, count: N, splatScale } = cloud;

      const THREE = await import('three');
      if (cancelled) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: true });
      renderer.setPixelRatio(dpr);
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.05, 50);

      // Instanced gaussian billboards (same shader as the backdrop).
      const quad = new THREE.InstancedBufferGeometry();
      const corners = new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]);
      quad.setAttribute('position', new THREE.BufferAttribute(corners, 3));
      quad.setIndex([0, 1, 2, 0, 2, 3]);
      const aOffset = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
      const aColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
      const aSeed = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
      aOffset.setUsage(THREE.DynamicDrawUsage);
      aColor.setUsage(THREE.DynamicDrawUsage);
      aSeed.setUsage(THREE.DynamicDrawUsage);
      quad.setAttribute('aOffset', aOffset);
      quad.setAttribute('aColor', aColor);
      quad.setAttribute('aSeed', aSeed);
      quad.instanceCount = N;

      const material = new THREE.ShaderMaterial({
        uniforms: {
          // Tight footprint — ~1.6× the grid spacing: enough overlap to
          // close holes, small enough to keep brushstroke detail crisp
          // (the old 2.6× smeared neighbours into mush).
          uScale: { value: splatScale * 0.85 },
          uReveal: { value: 0.0 },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.NormalBlending,
        premultipliedAlpha: true,
        vertexShader: `
          precision highp float;
          attribute vec3 aOffset;
          attribute vec3 aColor;
          attribute vec3 aSeed;
          uniform float uScale;
          uniform float uReveal;
          varying vec2 vCorner;
          varying vec3 vColor;
          void main() {
            vCorner = position.xy * 2.0;
            vColor = aColor;
            float rv = clamp(uReveal, 0.0, 1.0);
            vec3 pos = mix(aOffset + aSeed * 1.4, aOffset, rv);
            vec4 mv = modelViewMatrix * vec4(pos, 1.0);
            mv.xy += position.xy * uScale * 2.0;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          precision highp float;
          uniform float uReveal;
          varying vec2 vCorner;
          varying vec3 vColor;
          void main() {
            float r2 = dot(vCorner, vCorner);
            if (r2 > 1.0) discard;
            float a = exp(-r2 * 5.5) * clamp(uReveal * 1.2, 0.0, 1.0);
            gl_FragColor = vec4(vColor * a, a);
          }
        `,
      });

      const mesh = new THREE.Mesh(quad, material);
      mesh.frustumCulled = false;
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

      // ── Back-to-front sort (throttled) ───────────────────────────
      const order = new Uint32Array(N);
      for (let i = 0; i < N; i++) order[i] = i;
      const viewZ = new Float32Array(N);
      const offArr = aOffset.array as Float32Array;
      const colArr = aColor.array as Float32Array;
      const seedArr = aSeed.array as Float32Array;
      const sortCloud = () => {
        const m = mesh.matrixWorld.elements;
        const vm = camera.matrixWorldInverse.elements;
        const a2 = vm[2] * m[0] + vm[6] * m[1] + vm[10] * m[2];
        const b2 = vm[2] * m[4] + vm[6] * m[5] + vm[10] * m[6];
        const c2 = vm[2] * m[8] + vm[6] * m[9] + vm[10] * m[10];
        const d2 = vm[2] * m[12] + vm[6] * m[13] + vm[10] * m[14] + vm[14];
        for (let i = 0; i < N; i++) {
          viewZ[i] = a2 * base[i * 3] + b2 * base[i * 3 + 1] + c2 * base[i * 3 + 2] + d2;
        }
        order.sort((x, y) => viewZ[x] - viewZ[y]);
        for (let k = 0; k < N; k++) {
          const s = order[k];
          offArr[k * 3] = base[s * 3]; offArr[k * 3 + 1] = base[s * 3 + 1]; offArr[k * 3 + 2] = base[s * 3 + 2];
          colArr[k * 3] = colors[s * 3]; colArr[k * 3 + 1] = colors[s * 3 + 1]; colArr[k * 3 + 2] = colors[s * 3 + 2];
          seedArr[k * 3] = seeds[s * 3]; seedArr[k * 3 + 1] = seeds[s * 3 + 1]; seedArr[k * 3 + 2] = seeds[s * 3 + 2];
        }
        aOffset.needsUpdate = true; aColor.needsUpdate = true; aSeed.needsUpdate = true;
      };
      sortCloud();

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

        // Re-sort only when the view actually moved (the argsort is the
        // one heavy per-frame cost at 55k+ splats), or while assembling.
        if (Math.abs(az - sAz) > 0.004 || Math.abs(el - sEl) > 0.004
            || Math.abs(radius - sR) > 0.01 || u.value < 1) {
          sortCloud();
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
        quad.dispose();
        material.dispose();
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
