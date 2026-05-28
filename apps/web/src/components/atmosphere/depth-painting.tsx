// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { ensureDepth, isWebGLSupported } from '@/lib/atmosphere/depth';

interface DepthPaintingProps {
  src: string;
  /** Painting key — re-derives a depth map when this changes. */
  paintingKey: string;
  /** Image opacity at idle (matches the plain <img> opacity). */
  opacity?: number;
  className?: string;
  /** Inline style passthrough (used for filter, mask, etc.). */
  style?: React.CSSProperties;
}

/**
 * DepthPainting — paintings rendered as a true 3D bas-relief.
 *
 * Pipeline:
 *  1. ensureDepth() computes / fetches a depth map per painting via
 *     Depth Anything v2 small (cached in the Cache API).
 *  2. We build a real Three.js scene: a 192×128 subdivided PlaneGeometry,
 *     a CustomShaderMaterial that samples the painting as base color
 *     and displaces each vertex along Z by the depth value, and a
 *     PerspectiveCamera that orbits subtly with the cursor.
 *  3. A DirectionalLight at 30°/-20° plus AmbientLight gives the
 *     bas-relief surface real Lambert shading — peaks catch light,
 *     valleys fall into shadow.
 *  4. Slow time-driven Z bias adds a faint breathing motion.
 *
 * Unlike a UV-displacement shader, the camera + lighting are real, so
 * the painting reads as actual surface, not a parallax trick.
 *
 * Falls back to a plain <img> while depth computes / when WebGL2 is
 * unavailable / when the GPU initialization fails.
 */
export function DepthPainting({ src, paintingKey, opacity = 1, className, style }: DepthPaintingProps) {
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
      // Three.js is lazy-loaded — bundle stays small for users who
      // never enable an atmosphere.
      const THREE = await import('three');
      if (cancelled) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(dpr);
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();

      // Perspective camera — moderate FOV, sits at CAM_DIST from the
      // plane. The plane is then SCALED to cover the camera's visible
      // frustum at z=0 (object-fit: cover), with a buffer so depth
      // displacement + orbit can't reveal the edges.
      const FOV_DEG = 40;
      const CAM_DIST = 1.6;
      const camera = new THREE.PerspectiveCamera(FOV_DEG, window.innerWidth / window.innerHeight, 0.1, 10);
      camera.position.set(0, 0, CAM_DIST);
      camera.lookAt(0, 0, 0);

      // Lights. Directional from upper-left gives high-depth peaks a
      // bright rim; the ambient fills shadow so dark valleys aren't lost.
      const ambient = new THREE.AmbientLight(0xffffff, 0.78);
      scene.add(ambient);
      const sun = new THREE.DirectionalLight(0xffffff, 1.15);
      sun.position.set(-0.7, 0.6, 0.9);
      scene.add(sun);

      // Prefer a cinemagraph MP4 next to the JPG if one was pre-rendered
      // (see tools/cinemagraph/render.py). Use a HEAD probe so we only
      // pay the discovery cost once per src, then either:
      //   - bind a <video> as a Three.js VideoTexture (the painting now
      //     actually MOVES — clouds drift, waves crash), or
      //   - fall back to a still-image TextureLoader.
      const mp4Url = src.replace(/\.(jpe?g|png|webp|avif)$/i, '.mp4');
      let videoEl: HTMLVideoElement | null = null;
      let paintingTex: InstanceType<typeof THREE.Texture> | null = null;
      let paintImg: { width: number; height: number } = { width: 1, height: 1 };

      const probeRes = await fetch(mp4Url, { method: 'HEAD' }).catch(() => null);
      const hasMp4 = !!probeRes && probeRes.ok;
      if (cancelled) { renderer.dispose(); return; }

      if (hasMp4) {
        videoEl = document.createElement('video');
        videoEl.src = mp4Url;
        videoEl.crossOrigin = 'anonymous';
        videoEl.muted = true;
        videoEl.loop = true;
        videoEl.playsInline = true;
        videoEl.preload = 'auto';
        await new Promise<void>((resolve, reject) => {
          videoEl!.addEventListener('loadeddata', () => resolve(), { once: true });
          videoEl!.addEventListener('error', () => reject(new Error('video load failed')), { once: true });
        }).catch(() => { videoEl = null; });
        if (videoEl && !cancelled) {
          try { await videoEl.play(); } catch { /* autoplay denied — VideoTexture still updates on user gesture */ }
          paintingTex = new THREE.VideoTexture(videoEl);
          paintingTex.colorSpace = THREE.SRGBColorSpace;
          paintingTex.minFilter = THREE.LinearFilter;
          paintingTex.magFilter = THREE.LinearFilter;
          paintImg = { width: videoEl.videoWidth, height: videoEl.videoHeight };
        }
      }

      if (!videoEl) {
        const texLoader = new THREE.TextureLoader();
        paintingTex = await new Promise<InstanceType<typeof THREE.Texture>>((resolve, reject) => {
          texLoader.load(src, (t) => {
            t.colorSpace = THREE.SRGBColorSpace;
            t.anisotropy = renderer.capabilities.getMaxAnisotropy();
            t.minFilter = THREE.LinearFilter;
            t.magFilter = THREE.LinearFilter;
            resolve(t);
          }, undefined, reject);
        });
        const img = paintingTex.image as HTMLImageElement;
        paintImg = { width: img.width, height: img.height };
      }
      if (cancelled) { paintingTex!.dispose(); renderer.dispose(); return; }

      // Depth map as a CanvasTexture (the ImageBitmap from ensureDepth).
      const depthTex = new THREE.CanvasTexture(depthResult.bitmap);
      depthTex.minFilter = THREE.LinearFilter;
      depthTex.magFilter = THREE.LinearFilter;

      // Plane — built at the painting's native aspect (planeH=1,
      // planeW=paintAspect). We then scale the mesh to fully cover
      // the camera's visible frustum (recomputed on resize).
      const paintAspect = paintImg.width / paintImg.height;
      const geom = new THREE.PlaneGeometry(paintAspect, 1, 192, 128);
      // Compute per-vertex normals AFTER displacement — done in the
      // shader via finite-difference on the depth texture.

      // paintingTex is guaranteed defined past the fallback branch — TS
      // can't follow the conditional assignment so we re-narrow here.
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uPaint:      { value: paintingTex! },
          uDepth:      { value: depthTex },
          uDisplace:   { value: 0.22 },        // Z extents — peaks rise this much
          uTime:       { value: 0.0 },
          uLightDir:   { value: new THREE.Vector3(-0.7, 0.6, 0.9).normalize() },
          uAmbient:    { value: 0.78 },
        },
        vertexShader: `
          uniform sampler2D uDepth;
          uniform float uDisplace;
          uniform float uTime;
          varying vec2 vUv;
          varying float vDepth;
          varying vec3 vNormal;

          float sampleDepth(vec2 uv) {
            return texture2D(uDepth, vec2(uv.x, 1.0 - uv.y)).r;
          }

          void main() {
            vUv = uv;
            float d = sampleDepth(uv);
            vDepth = d;

            // Small ambient breath via time: low-frequency sine in Z for
            // higher-depth (foreground) zones only — sky stays calm.
            float breath = sin(uTime * 0.18 + d * 6.0) * 0.005 * d;

            // Finite-difference normal from the depth map. Samples
            // four neighbors at 1/192 (texel step on the long axis).
            float e = 1.0 / 192.0;
            float dL = sampleDepth(uv + vec2(-e, 0.0));
            float dR = sampleDepth(uv + vec2( e, 0.0));
            float dD = sampleDepth(uv + vec2(0.0,-e));
            float dU = sampleDepth(uv + vec2(0.0, e));
            vec3 n = normalize(vec3(
              (dL - dR) * uDisplace * 8.0,
              (dD - dU) * uDisplace * 8.0,
              1.0
            ));
            vNormal = n;

            vec3 displaced = position + normal * (d * uDisplace + breath);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
          }
        `,
        fragmentShader: `
          precision highp float;
          uniform sampler2D uPaint;
          uniform sampler2D uDepth;
          uniform vec3 uLightDir;
          uniform float uAmbient;
          uniform float uTime;
          varying vec2 vUv;
          varying float vDepth;
          varying vec3 vNormal;

          // Cheap value-noise for the sky drift.
          float hash21(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          float vnoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            float a = hash21(i);
            float b = hash21(i + vec2(1.0, 0.0));
            float c = hash21(i + vec2(0.0, 1.0));
            float d = hash21(i + vec2(1.0, 1.0));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
          }

          void main() {
            // Living motion bands by depth — picked from the depth map
            // so each painting auto-segments:
            //   far  (depth 0.00–0.35): SKY — slow horizontal drift +
            //                            very low-frequency vertical wobble
            //   mid  (depth 0.35–0.65): WATER / MIST — sinusoidal ripple
            //   near (depth 0.65–1.00): SUBJECT — rock still
            float far  = smoothstep(0.40, 0.05, vDepth);
            float mid  = smoothstep(0.30, 0.45, vDepth) *
                         (1.0 - smoothstep(0.60, 0.78, vDepth));
            // 'near' has no motion; subjects hold.

            // Sky drift — slow horizontal flow + tiny vertical wobble.
            // Multi-octave so clouds feel like real clouds, not a sine bar.
            float t = uTime * 0.035;
            vec2 skyOff = vec2(
              (vnoise(vec2(vUv.x * 3.0 + t * 2.4, vUv.y * 1.6)) - 0.5) * 0.018
              + sin(uTime * 0.07 + vUv.y * 1.4) * 0.006,
              (vnoise(vec2(vUv.x * 2.2, vUv.y * 2.4 + t * 1.3)) - 0.5) * 0.006
            );

            // Water / mist ripple — small high-frequency sinusoid that
            // shimmers across the surface.
            vec2 midOff = vec2(
              sin(uTime * 0.55 + vUv.x * 14.0 + vUv.y * 4.0) * 0.0035,
              cos(uTime * 0.42 + vUv.y * 18.0 + vUv.x * 6.0) * 0.0045
            );

            vec2 motion = skyOff * far + midOff * mid;

            // Sample the painting through the motion offset.
            vec3 base = texture2D(uPaint, vUv + motion).rgb;

            // Lambert shading from the depth-derived normal.
            float ndotl = max(dot(normalize(vNormal), normalize(uLightDir)), 0.0);
            float shade = uAmbient + (1.0 - uAmbient) * ndotl;

            // Subtle aerial perspective — distant zones gain a touch of
            // warm-paper haze, so the sky recedes spatially.
            vec3 haze = mix(vec3(0.86, 0.82, 0.74), base, smoothstep(0.0, 0.55, vDepth));

            // Mid-band ripple gets a tiny specular kick when it crests,
            // so water actually catches the light.
            float ripple = sin(uTime * 0.55 + vUv.x * 14.0 + vUv.y * 4.0);
            float specMid = pow(max(ripple, 0.0), 6.0) * mid * 0.25;

            gl_FragColor = vec4(haze * shade + vec3(specMid), 1.0);
          }
        `,
      });

      const mesh = new THREE.Mesh(geom, material);
      scene.add(mesh);

      // Cover-fit the plane to the camera frustum at z=0 (with 10%
      // buffer for depth displacement + camera orbit). Re-run on every
      // resize so the painting always fills the viewport.
      const fitMesh = () => {
        const visibleH = 2 * CAM_DIST * Math.tan(THREE.MathUtils.degToRad(FOV_DEG) / 2);
        const visibleW = visibleH * camera.aspect;
        // Cover: pick the larger of (match height) or (match width).
        const heightToFit = visibleH;
        const heightFromWidth = visibleW / paintAspect;
        const scale = Math.max(heightToFit, heightFromWidth) * 1.10;
        mesh.scale.set(scale, scale, 1);
      };
      fitMesh();

      // Cursor — drives a soft camera orbit (yaw/pitch ≤ ~5°).
      let cursorTarget = { x: 0, y: 0 };
      let cursorCur = { x: 0, y: 0 };
      const onMove = (e: MouseEvent) => {
        cursorTarget = {
          x: (e.clientX / window.innerWidth) * 2 - 1,
          y: (e.clientY / window.innerHeight) * 2 - 1,
        };
      };
      window.addEventListener('mousemove', onMove);

      const resize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        fitMesh();
      };
      window.addEventListener('resize', resize);

      const start = performance.now();
      let rafId = 0;
      const draw = () => {
        cursorCur.x += (cursorTarget.x - cursorCur.x) * 0.05;
        cursorCur.y += (cursorTarget.y - cursorCur.y) * 0.05;
        // Camera now barely moves — the painting's own depth-band
        // motion (sky drift, water ripple, subject still) IS the life.
        // The camera adds a whisper of orbit so the cursor still feels
        // connected to the scene.
        const yaw = -cursorCur.x * 0.025;
        const pitch = cursorCur.y * 0.02;
        camera.position.x = Math.sin(yaw) * CAM_DIST;
        camera.position.y = Math.sin(pitch) * CAM_DIST;
        camera.position.z = Math.cos(yaw) * CAM_DIST;
        camera.lookAt(0, 0, 0);
        (material.uniforms.uTime as { value: number }).value = (performance.now() - start) / 1000;
        renderer.render(scene, camera);
        rafId = requestAnimationFrame(draw);
      };
      rafId = requestAnimationFrame(draw);

      cleanup = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('resize', resize);
        if (rafId) cancelAnimationFrame(rafId);
        if (videoEl) {
          try { videoEl.pause(); } catch { /* */ }
          videoEl.src = '';
        }
        geom.dispose();
        material.dispose();
        paintingTex!.dispose();
        depthTex.dispose();
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
      {/* Plain image while depth + Three.js scene boot, and as the
          permanent fallback when WebGL/WebGPU/WASM all fail. */}
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
