// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { ensureDepth, isWebGLSupported } from '@/lib/atmosphere/depth';
import { buildGaussianCloud } from '@/lib/atmosphere/splat-cloud';
import { createSplatRenderer } from '@/lib/atmosphere/gaussian-renderer';

interface SplatPaintingProps {
  src: string;
  /** Painting key — re-lifts the splat cloud when this changes. */
  paintingKey: string;
  opacity?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * SplatPainting — the painting reconstructed as a 3D Gaussian-splat cloud.
 *
 * This is the single-image → 3DGS pipeline that shipped across the
 * browser ecosystem in 2025–26 (SpawnScene, Visionary, WebSplatter),
 * adapted to our cached monocular depth:
 *
 *  1. ensureDepth() gives a per-painting depth map (Depth Anything v2,
 *     cached). We already pay this cost for the relief mesh.
 *  2. We sample a dense grid (32–55k cells) and LIFT each pixel into a
 *     3D Gaussian: world position from (u, v, depth), colour from the
 *     painting, a soft isotropic footprint sized to overlap neighbours.
 *     The painting stops being a displaced sheet and becomes a volume
 *     of floating pigment that coheres into the image.
 *  3. One instanced draw call renders every gaussian as a camera-facing
 *     billboard with an exp(-r²) alpha falloff. A throttled CPU counting
 *     sort keeps them back-to-front so alpha compositing is correct
 *     as the camera gently orbits.
 *  4. The camera auto-orbits a few degrees + parallaxes to the cursor,
 *     so you perceive real depth — foreground motes part from the
 *     background, soft edges fill the seams a triangle mesh would tear.
 *  5. On mount the cloud ASSEMBLES: every gaussian starts scattered in
 *     space and converges to its place as it fades in — a true 3D
 *     version of the dissolve, like pigment settling into the canvas.
 *
 * Falls back to a plain <img> while depth computes / when WebGL2 is
 * unavailable. Toggled against the relief mesh with the `v` key.
 */
export function SplatPainting({ src, paintingKey, opacity = 1, className, style }: SplatPaintingProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(true);

  useEffect(() => {
    setReady(false);
    setFallback(true);
    if (!isWebGLSupported()) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const depthResult = await ensureDepth(src);
      if (cancelled || !depthResult) { setFallback(true); return; }
      const canvas = canvasRef.current;
      if (!canvas) return;
      const THREE = await import('three');
      if (cancelled) return;

      // ── Load the painting + read colour / depth onto small grids ──
      const texLoader = new THREE.TextureLoader();
      const paintImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        texLoader.load(src, (t) => resolve(t.image as HTMLImageElement), undefined, reject);
      });
      if (cancelled) return;

      // Lift the painting + depth into a gaussian cloud (front grid +
      // LDI behind layer) via the shared builder. Fewer points on
      // low-DPR / small screens to stay light on integrated GPUs.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      // Backdrop cloud — kept lighter than the immersive world so the `v`
      // toggle's synchronous build doesn't stall the main thread (which read
      // as lag + frozen scroll on switch).
      const targetCount = window.innerWidth < 900 || dpr < 1.5 ? 22000 : 38000;
      const cloud = buildGaussianCloud(paintImg, depthResult.bitmap, targetCount);
      if (cancelled || !cloud) { setFallback(true); return; }
      const { paintAspect } = cloud;

      // ── Three.js scene ────────────────────────────────────────────
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: true });
      renderer.setPixelRatio(dpr);
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      const FOV_DEG = 40;
      const CAM_DIST = 1.6;
      const camera = new THREE.PerspectiveCamera(FOV_DEG, window.innerWidth / window.innerHeight, 0.1, 10);
      camera.position.set(0, 0, CAM_DIST);
      camera.lookAt(0, 0, 0);

      // Instanced gaussian billboards via the shared renderer. The
      // backdrop keeps the softer default falloff (4.5) and full footprint.
      const splat = createSplatRenderer(THREE, cloud);
      const { mesh, material } = splat;
      scene.add(mesh);

      // Cover-fit: scale the whole cloud so the unit plane fills the
      // frustum at z=0 (with buffer for the depth pop + orbit).
      const fit = () => {
        const visH = 2 * CAM_DIST * Math.tan(THREE.MathUtils.degToRad(FOV_DEG) / 2);
        const visW = visH * camera.aspect;
        const cover = Math.max(visH, visW / paintAspect) * 1.12;
        mesh.scale.set(cover, cover, cover);
        (material.uniforms.uCover as { value: number }).value = cover;
      };
      fit();

      // Back-to-front sort (counting sort inside the shared renderer).
      camera.updateMatrixWorld();
      splat.sort(camera);

      const resize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        fit();
      };
      window.addEventListener('resize', resize);

      // Cursor parallax — the cloud leans toward the pointer.
      let pointerX = 0, pointerY = 0;
      const onPointer = (e: PointerEvent) => {
        pointerX = (e.clientX / window.innerWidth - 0.5) * 2;
        pointerY = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener('pointermove', onPointer, { passive: true });

      const start = performance.now();
      let lastSortAz = 999;
      let lastSortAt = 0;
      let rafId = 0;
      const draw = () => {
        const t = (performance.now() - start) / 1000;
        // Auto-orbit + cursor parallax. The LDI behind-layer fills the
        // disocclusion gaps, so we can swing wider than the bare cloud
        // (≈±9° azimuth) and let the parallax really read.
        const az = Math.sin(t * 0.18) * 0.16 + pointerX * 0.075;
        const el = Math.cos(t * 0.14) * 0.06 - pointerY * 0.05;
        camera.position.set(
          Math.sin(az) * CAM_DIST,
          Math.sin(el) * CAM_DIST,
          Math.cos(az) * Math.cos(el) * CAM_DIST,
        );
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();

        // Assemble over 1.6s.
        const u = material.uniforms.uReveal as { value: number };
        if (u.value < 1) u.value = Math.min(1, t / 1.6);

        // Re-sort only when the view rotated enough to matter AND at
        // most ~8×/s — the sort is the one heavy CPU cost, so we
        // never let a fast cursor wiggle trigger it every frame.
        const nowMs = performance.now();
        if (Math.abs(az - lastSortAz) > 0.012 && nowMs - lastSortAt > 120) {
          splat.sort(camera);
          lastSortAz = az;
          lastSortAt = nowMs;
        }
        renderer.render(scene, camera);
        rafId = requestAnimationFrame(draw);
      };
      rafId = requestAnimationFrame(draw);

      const onVis = () => {
        if (document.hidden) {
          if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        } else if (!rafId) {
          rafId = requestAnimationFrame(draw);
        }
      };
      document.addEventListener('visibilitychange', onVis);

      cleanup = () => {
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointermove', onPointer);
        document.removeEventListener('visibilitychange', onVis);
        if (rafId) cancelAnimationFrame(rafId);
        splat.dispose();
        renderer.dispose();
      };

      setReady(true);
      setFallback(false);
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [src, paintingKey]);

  return (
    <>
      {fallback && (
        <img
          className={className}
          src={src}
          alt=""
          loading="eager"
          decoding="async"
          style={{ ...style, opacity }}
        />
      )}
      <canvas
        ref={canvasRef}
        className={className}
        aria-hidden="true"
        style={{
          ...style,
          opacity: ready && !fallback ? opacity : 0,
          transition: 'opacity 700ms ease',
          pointerEvents: 'none',
          position: 'absolute',
          inset: 0,
        }}
      />
    </>
  );
}
