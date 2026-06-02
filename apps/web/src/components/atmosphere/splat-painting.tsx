// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { ensureDepth, isWebGLSupported } from '@/lib/atmosphere/depth';
import { buildGaussianCloud } from '@/lib/atmosphere/splat-cloud';

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
 *  2. We sample a dense grid (~55k cells) and LIFT each pixel into a
 *     3D Gaussian: world position from (u, v, depth), colour from the
 *     painting, a soft isotropic footprint sized to overlap neighbours.
 *     The painting stops being a displaced sheet and becomes a volume
 *     of floating pigment that coheres into the image.
 *  3. One instanced draw call renders every gaussian as a camera-facing
 *     billboard with an exp(-r²) alpha falloff. A throttled CPU radix-ish
 *     argsort keeps them back-to-front so alpha compositing is correct
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
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetCount = window.innerWidth < 900 || dpr < 1.5 ? 32000 : 55000;
      const cloud = buildGaussianCloud(paintImg, depthResult.bitmap, targetCount);
      if (cancelled || !cloud) { setFallback(true); return; }
      const { base, colors, seeds, count: N, splatScale, paintAspect } = cloud;

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

      // Unit-quad billboard geometry, instanced.
      const quad = new THREE.InstancedBufferGeometry();
      // Unit quad as vec3 (z=0) — ShaderMaterial injects `attribute vec3
      // position`, so the corner attribute must match that type.
      const corners = new Float32Array([
        -0.5, -0.5, 0,  0.5, -0.5, 0,  0.5, 0.5, 0,  -0.5, 0.5, 0,
      ]);
      quad.setAttribute('position', new THREE.BufferAttribute(corners, 3));
      quad.setIndex([0, 1, 2, 0, 2, 3]);
      // Instance attributes (rewritten each sort, in back-to-front order).
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
          uScale: { value: splatScale },
          uCover: { value: 1.0 },
          uReveal: { value: 0.0 },
          uOpacity: { value: 1.0 },
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
          uniform float uCover;
          uniform float uReveal;
          varying vec2 vCorner;
          varying vec3 vColor;
          void main() {
            vCorner = position.xy * 2.0;     // [-1,1] across the quad
            vColor = aColor;
            // Assemble: lerp from scattered (aSeed) to settled (aOffset).
            float rv = clamp(uReveal, 0.0, 1.0);
            vec3 settled = aOffset;
            vec3 scattered = aOffset + aSeed * 1.4;
            vec3 pos = mix(scattered, settled, rv);
            // Cover-scale folds in via the model matrix; the billboard
            // corner is added in VIEW space so gaussians always face us.
            vec4 mv = modelViewMatrix * vec4(pos, 1.0);
            mv.xy += position.xy * uScale * uCover * 2.0;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          precision highp float;
          uniform float uReveal;
          uniform float uOpacity;
          varying vec2 vCorner;
          varying vec3 vColor;
          void main() {
            float r2 = dot(vCorner, vCorner);
            if (r2 > 1.0) discard;
            // exp(-r²·k) gaussian footprint, soft to the edge.
            float a = exp(-r2 * 4.5) * uOpacity * clamp(uReveal * 1.2, 0.0, 1.0);
            // Premultiplied output so overlapping splats accumulate cleanly.
            gl_FragColor = vec4(vColor * a, a);
          }
        `,
      });

      const mesh = new THREE.Mesh(quad, material);
      mesh.frustumCulled = false;
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

      // ── Back-to-front sort (throttled) ───────────────────────────
      // Sort indices by view-space z, then write the instance buffers in
      // that order. Uniform cover-scale preserves ordering, so we sort
      // through the unscaled offsets (cheaper, identical result).
      const order = new Uint32Array(N);
      for (let i = 0; i < N; i++) order[i] = i;
      const viewZ = new Float32Array(N);
      const offArr = aOffset.array as Float32Array;
      const colArr = aColor.array as Float32Array;
      const seedArr = aSeed.array as Float32Array;
      const sortCloud = () => {
        const m = mesh.matrixWorld.elements;
        const vm = camera.matrixWorldInverse.elements;
        // Combined MV z-row coefficients (so we sort in view space).
        const a2 = vm[2] * m[0] + vm[6] * m[1] + vm[10] * m[2];
        const b2 = vm[2] * m[4] + vm[6] * m[5] + vm[10] * m[6];
        const c2 = vm[2] * m[8] + vm[6] * m[9] + vm[10] * m[10];
        const d2 = vm[2] * m[12] + vm[6] * m[13] + vm[10] * m[14] + vm[14];
        for (let i = 0; i < N; i++) {
          viewZ[i] = a2 * base[i * 3] + b2 * base[i * 3 + 1] + c2 * base[i * 3 + 2] + d2;
        }
        // Ascending view z = most negative (farthest) first.
        Array.prototype.sort.call(order, (x: number, y: number) => viewZ[x] - viewZ[y]);
        for (let k = 0; k < N; k++) {
          const s = order[k];
          offArr[k * 3] = base[s * 3];     offArr[k * 3 + 1] = base[s * 3 + 1];     offArr[k * 3 + 2] = base[s * 3 + 2];
          colArr[k * 3] = colors[s * 3];   colArr[k * 3 + 1] = colors[s * 3 + 1];   colArr[k * 3 + 2] = colors[s * 3 + 2];
          seedArr[k * 3] = seeds[s * 3];   seedArr[k * 3 + 1] = seeds[s * 3 + 1];   seedArr[k * 3 + 2] = seeds[s * 3 + 2];
        }
        aOffset.needsUpdate = true;
        aColor.needsUpdate = true;
        aSeed.needsUpdate = true;
      };
      camera.updateMatrixWorld();
      mesh.updateMatrixWorld();
      sortCloud();

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
        // most ~8×/s — the argsort is the one heavy CPU cost, so we
        // never let a fast cursor wiggle trigger it every frame.
        const nowMs = performance.now();
        if (Math.abs(az - lastSortAz) > 0.012 && nowMs - lastSortAt > 120) {
          sortCloud();
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
        quad.dispose();
        material.dispose();
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
