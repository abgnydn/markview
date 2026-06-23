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
  /** Lite / performance mode — skip ALL WebGL (depth shader, render loop)
   *  and show only the static painting <img>. The same code path as the
   *  WebGL-unavailable fallback, so weak GPUs aren't asked to run a
   *  full-screen shader every frame. */
  forceStatic?: boolean;
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
export function DepthPainting({ src, paintingKey, opacity = 1, className, style, forceStatic = false }: DepthPaintingProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(true);

  useEffect(() => {
    setReady(false);
    setFallback(true);
    // Lite mode (or no WebGL) → keep the static <img>, never boot Three.js.
    if (!isWebGLSupported() || forceStatic) return;
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

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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

      // Load the still painting as a Three.js texture. (Previous
      // cinemagraph / VideoTexture branch was removed in the cleanup
      // pass — SVD-XT output at 1024×576 looked too soft against the
      // native 1920×1314 JPGs. The depth mesh + Lambert lighting +
      // depth-band motion shader below give the "alive" feel at full
      // source resolution.)
      const texLoader = new THREE.TextureLoader();
      const paintingTex = await new Promise<InstanceType<typeof THREE.Texture>>((resolve, reject) => {
        texLoader.load(src, (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = renderer.capabilities.getMaxAnisotropy();
          t.minFilter = THREE.LinearFilter;
          t.magFilter = THREE.LinearFilter;
          resolve(t);
        }, undefined, reject);
      });
      if (cancelled) { paintingTex.dispose(); renderer.dispose(); return; }
      const paintImg = paintingTex.image as HTMLImageElement;

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

      const material = new THREE.ShaderMaterial({
        uniforms: {
          uPaint:      { value: paintingTex },
          uDepth:      { value: depthTex },
          uDisplace:   { value: 0.22 },        // Z extents — peaks rise this much
          uTime:       { value: 0.0 },
          uLightDir:   { value: new THREE.Vector3(-0.7, 0.6, 0.9).normalize() },
          uAmbient:    { value: 0.78 },
          // Sun position — drives god-rays direction. Mapped from the
          // current time-of-day phase (dawn = upper-left, day = top,
          // dusk = upper-right, night = below horizon → rays off).
          uSunUv:      { value: new THREE.Vector2(0.5, 0.92) },
          uSunOn:      { value: 1.0 },
          // Echo-location pulse — origin (UV) + start time. While
          // (now - start) is within ~2 s a brightening ring expands
          // through the scene. Origin (-1,-1) = no pulse.
          uPulseUv:    { value: new THREE.Vector2(-1, -1) },
          uPulseTime:  { value: -1000.0 },
          // Depth-of-field — focal plane (0..1 depth) follows scroll;
          // pixels far from it blur. uDofAmount scales the effect.
          uFocal:      { value: 0.62 },
          uDofAmount:  { value: 0.5 },
          // Dissolve-in — 0 = nothing, 1 = fully assembled. Animated
          // 0→1 on mount so the painting "burns in" from noise.
          uReveal:     { value: 0.0 },
          // Anaglyph 3D — 0 = off, 1 = red/cyan stereo from the depth
          // map. Toggle with the `g` key.
          uAnaglyph:   { value: 0.0 },
          uAspect:     { value: 1.0 },
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
        transparent: true,
        fragmentShader: `
          precision highp float;
          uniform sampler2D uPaint;
          uniform sampler2D uDepth;
          uniform vec3 uLightDir;
          uniform float uAmbient;
          uniform float uTime;
          uniform vec2 uSunUv;
          uniform float uSunOn;
          uniform vec2 uPulseUv;
          uniform float uPulseTime;
          uniform float uFocal;
          uniform float uDofAmount;
          uniform float uReveal;
          uniform float uAnaglyph;
          uniform float uAspect;
          varying vec2 vUv;
          varying float vDepth;
          varying vec3 vNormal;

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
          float dSamp(vec2 uv) { return texture2D(uDepth, vec2(uv.x, 1.0 - uv.y)).r; }
          float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

          // Depth-of-field sampler — 7-tap rosette blur whose radius is
          // the circle-of-confusion (distance from the focal plane).
          vec3 sampleDof(vec2 uv, float blurR) {
            if (blurR < 0.0008) return texture2D(uPaint, uv).rgb;
            vec3 acc = texture2D(uPaint, uv).rgb;
            for (int i = 0; i < 6; i++) {
              float a = float(i) * 1.0472;
              acc += texture2D(uPaint, uv + vec2(cos(a), sin(a)) * blurR).rgb;
            }
            return acc / 7.0;
          }

          void main() {
            // Living motion bands by depth.
            float far  = smoothstep(0.40, 0.05, vDepth);
            float mid  = smoothstep(0.30, 0.45, vDepth) *
                         (1.0 - smoothstep(0.60, 0.78, vDepth));

            float t = uTime * 0.035;
            vec2 skyOff = vec2(
              (vnoise(vec2(vUv.x * 3.0 + t * 2.4, vUv.y * 1.6)) - 0.5) * 0.018
              + sin(uTime * 0.07 + vUv.y * 1.4) * 0.006,
              (vnoise(vec2(vUv.x * 2.2, vUv.y * 2.4 + t * 1.3)) - 0.5) * 0.006
            );
            vec2 midOff = vec2(
              sin(uTime * 0.55 + vUv.x * 14.0 + vUv.y * 4.0) * 0.0035,
              cos(uTime * 0.42 + vUv.y * 18.0 + vUv.x * 6.0) * 0.0045
            );
            vec2 motion = skyOff * far + midOff * mid;

            // ── Depth-of-field circle-of-confusion ────────────────
            // Wide in-focus dead-zone (0.22) + low blur scale so the
            // subject and most of the mid stay crisp — only the very
            // far / very near edges get a whisper of softness.
            float coc = clamp((abs(vDepth - uFocal) - 0.22) * 1.8, 0.0, 1.0) * uDofAmount;
            float blurR = coc * 0.004;

            // ── Sample painting (anaglyph splits the channels by a
            //    depth-driven horizontal parallax for red/cyan 3D) ──
            vec3 base;
            if (uAnaglyph > 0.5) {
              float sep = (vDepth - 0.5) * 0.018;
              vec2 ax = vec2(sep / uAspect, 0.0);
              vec3 cl = sampleDof(vUv + motion + ax, blurR);
              vec3 cr = sampleDof(vUv + motion - ax, blurR);
              base = vec3(cl.r, cr.g, cr.b);
            } else {
              base = sampleDof(vUv + motion, blurR);
            }

            // ── Lambert + ambient ─────────────────────────────────
            float ndotl = max(dot(normalize(vNormal), normalize(uLightDir)), 0.0);
            float shade = uAmbient + (1.0 - uAmbient) * ndotl;

            // ── SSAO (cheap screen-space ambient occlusion) ───────
            // Sample 4 neighbors at increasing radius; pixels with
            // significantly DEEPER neighbors are occluded (in a
            // valley) and darken slightly. Crevices in the painting
            // (rock cracks, eaves) read as having real shade.
            float e = 1.0 / 256.0;
            float dHere = vDepth;
            float ao = 0.0;
            for (int k = 0; k < 4; k++) {
              float ang = float(k) * 1.5708;
              vec2 off = vec2(cos(ang), sin(ang)) * e * 2.0;
              float dN = dSamp(vUv + off);
              ao += max(0.0, dN - dHere);
            }
            float aoTerm = 1.0 - clamp(ao * 1.6, 0.0, 0.35);

            // ── Aerial perspective haze (halved) ──────────────────
            vec3 hazeFull = mix(vec3(0.86, 0.82, 0.74), base, smoothstep(0.0, 0.55, vDepth));
            vec3 haze = mix(base, hazeFull, 0.5);

            // ── Water surface specular kick ───────────────────────
            float ripple = sin(uTime * 0.55 + vUv.x * 14.0 + vUv.y * 4.0);
            float specMid = pow(max(ripple, 0.0), 6.0) * mid * 0.25;

            vec3 lit = haze * shade * aoTerm + vec3(specMid);

            // ── Bloom (in-shader 6-tap blur on bright pass) ───────
            // Sample 6 neighbors at offset radii, keep only the
            // bright-pass portion (luma > 0.65), add as additive
            // glow. Way cheaper than a real Kawase chain.
            vec3 bloom = vec3(0.0);
            for (int b = 0; b < 6; b++) {
              float ba = float(b) * 1.047197;
              vec2 boff = vec2(cos(ba), sin(ba)) * 0.0045;
              vec3 bn = texture2D(uPaint, vUv + boff).rgb;
              float bl = max(0.0, luma(bn) - 0.65);
              bloom += bn * bl;
            }
            bloom *= 0.32;

            // ── God rays (radial samples toward sun) ──────────────
            // Sample 12 points along the line from this pixel to
            // the sun UV; accumulate brightness where depth is low
            // (sky / cloud holes). Sun off (night) → factor 0.
            vec3 rays = vec3(0.0);
            if (uSunOn > 0.0) {
              vec2 dirS = (uSunUv - vUv) / 12.0;
              vec2 sUv = vUv;
              float decay = 1.0;
              for (int g = 0; g < 12; g++) {
                sUv += dirS;
                float dG = dSamp(sUv);
                float skyContrib = smoothstep(0.45, 0.0, dG);
                float lumS = luma(texture2D(uPaint, sUv).rgb);
                rays += vec3(1.0, 0.94, 0.84) * skyContrib * lumS * decay;
                decay *= 0.86;
              }
              rays *= 0.020 * uSunOn;
            }

            // ── Echo-location pulse ───────────────────────────────
            // Brightens pixels at radius = (time - pulseTime) * 0.45
            // from uPulseUv. Decays after 2s.
            float pulseAge = uTime - uPulseTime;
            float pulseTerm = 0.0;
            if (pulseAge > 0.0 && pulseAge < 2.0 && uPulseUv.x >= 0.0) {
              float ringR = pulseAge * 0.45;
              float dPulse = distance(vUv, uPulseUv);
              float ringW = 0.045;
              float onRing = exp(-pow((dPulse - ringR) / ringW, 2.0));
              pulseTerm = onRing * (1.0 - pulseAge * 0.5);
            }

            vec3 finalColor = lit + bloom + rays + vec3(pulseTerm) * vec3(0.7, 0.65, 0.95);

            // ── Dissolve-in reveal ────────────────────────────────
            // On mount uReveal animates 0→1. Each pixel "turns on"
            // when uReveal passes its noise value, so the painting
            // assembles out of scattered grain. A bright violet edge
            // rides the reveal front for a particle-shimmer feel.
            float grain = vnoise(vUv * 90.0);
            float rev = smoothstep(grain - 0.10, grain + 0.02, uReveal);
            float edge = (1.0 - abs(rev - 0.5) * 2.0);
            if (uReveal < 0.999) {
              finalColor += vec3(0.55, 0.50, 0.85) * edge * 0.6;
            }
            gl_FragColor = vec4(finalColor, rev);
          }
        `,
      });

      const mesh = new THREE.Mesh(geom, material);
      scene.add(mesh);

      // Cover-fit the plane to the camera frustum at z=0 (5% buffer
      // for the depth-displaced peaks). The camera is now STATIC —
      // cursor-driven orbit removed per user feedback ("don't need
      // the parallax effect"). The painting's life comes from the
      // depth-band motion shader + Lambert lighting, not from the
      // camera moving.
      const fitMesh = () => {
        const visibleH = 2 * CAM_DIST * Math.tan(THREE.MathUtils.degToRad(FOV_DEG) / 2);
        const visibleW = visibleH * camera.aspect;
        const heightToFit = visibleH;
        const heightFromWidth = visibleW / paintAspect;
        const scale = Math.max(heightToFit, heightFromWidth) * 1.05;
        mesh.scale.set(scale, scale, 1);
      };
      fitMesh();

      // Focal plane follows scroll — but the per-frame draw loop must stay
      // free of layout reads. Reading document.scrollHeight forces a reflow,
      // and doing it 60×/sec inside the loop stalled the main thread (and
      // starved every other atmosphere rAF loop — particles visibly hitched)
      // whenever the page scrolled. So: cache the scroll range, recompute the
      // focal *target* from a passive scroll listener (scrollY is cheap, no
      // reflow), and let the loop merely ease toward it.
      let focalCur = 0.62;
      let focalTarget = 0.62;
      let docMax = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const updateFocalTarget = () => {
        const sp = Math.min(1, Math.max(0, window.scrollY / docMax));
        focalTarget = 0.30 + sp * 0.55; // 0.30 (far/sky) → 0.85 (near/foreground)
      };
      updateFocalTarget();
      window.addEventListener('scroll', updateFocalTarget, { passive: true });
      // Content height changes (doc switch, image/font load) move the scroll
      // range; refresh the cached max off the hot path, not in the loop.
      const focalRO = new ResizeObserver(() => {
        docMax = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        updateFocalTarget();
      });
      focalRO.observe(document.body);

      const resize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        (material.uniforms.uAspect as { value: number }).value = window.innerWidth / window.innerHeight;
        fitMesh();
        docMax = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        updateFocalTarget();
      };
      (material.uniforms.uAspect as { value: number }).value = window.innerWidth / window.innerHeight;
      window.addEventListener('resize', resize);

      // Anaglyph 3D toggle (key `g`, non-typing) — flips red/cyan stereo.
      const onAnaglyphKey = (e: KeyboardEvent) => {
        const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key !== 'g' && e.key !== 'G') return;
        const u = material.uniforms.uAnaglyph as { value: number };
        u.value = u.value > 0.5 ? 0.0 : 1.0;
      };
      window.addEventListener('keydown', onAnaglyphKey);

      // Sun position by time-of-day — drives the god-rays shader.
      // Read by reading <html data-time-phase> which time-of-day.ts
      // sets to dawn / day / dusk / night / off. Re-read every draw
      // so manual toggles update without remount.
      const PHASE_SUN: Record<string, { uv: [number, number]; on: number }> = {
        dawn:  { uv: [0.18, 0.88], on: 0.85 },
        day:   { uv: [0.50, 0.95], on: 1.00 },
        dusk:  { uv: [0.82, 0.88], on: 0.95 },
        night: { uv: [0.50, 0.20], on: 0.0 },
        off:   { uv: [0.50, 0.95], on: 0.0 },
      };

      const start = performance.now();

      // Echo-location pulse — click anywhere on the painting and a
      // bright ring expands from the click point over 2 s. Useful as
      // a meditative interaction; reveals the depth structure of the
      // painting as the ring travels through it.
      const onClick = (e: MouseEvent) => {
        // Ignore clicks on interactive chrome — sidebar buttons,
        // toolbar, atmosphere dots, palette, links, etc. The pulse
        // is for the painting space only.
        const target = e.target as HTMLElement | null;
        if (target && target.closest('button, a, input, textarea, [role="button"], .mv-atm-dots, .toolbar, .sidebar, .mv-palette, .mv-cards-overlay, .editor-overlay')) return;
        const u = e.clientX / window.innerWidth;
        const v = 1.0 - e.clientY / window.innerHeight;
        (material.uniforms.uPulseUv.value as InstanceType<typeof THREE.Vector2>).set(u, v);
        (material.uniforms.uPulseTime as { value: number }).value =
          (performance.now() - start) / 1000;
      };
      window.addEventListener('click', onClick);
      // Focal plane follows scroll — top of the doc focuses the far
      // (sky) zone, bottom focuses the near (foreground), so the
      // tilt-shift sweet spot drifts as you read. Eased toward target.
      let rafId = 0;
      // Frame governor. When nobody's interacting, the *only* thing changing
      // is the slow (~39s) light orbit — yet we were re-rendering a
      // full-screen shader at 60fps to inch it along. That's what makes the
      // whole UI feel heavy: the atmosphere spends the frame's GPU budget
      // before a hover or scroll ever gets a turn. So render every frame only
      // while something is genuinely moving (the dissolve-in, scroll-driven
      // focal easing, or a click ripple); otherwise throttle to ~15fps, which
      // is imperceptible for a 39s orbit and frees ~4× of the idle GPU for
      // the actual UI.
      let lastRender = -1;
      const IDLE_FRAME_MS = 1000 / 15;
      const reveal = material.uniforms.uReveal as { value: number };
      const draw = (now: number) => {
        rafId = requestAnimationFrame(draw);
        const tNow = (performance.now() - start) / 1000;

        const active =
          reveal.value < 1 ||                            // dissolve-in on mount
          Math.abs(focalTarget - focalCur) > 0.0008 ||   // scroll-focal still easing
          tNow - (material.uniforms.uPulseTime as { value: number }).value < 2.0; // click ripple
        if (!active && lastRender >= 0 && now - lastRender < IDLE_FRAME_MS) return;
        lastRender = now;

        (material.uniforms.uTime as { value: number }).value = tNow;

        // Living relief — the key light slowly orbits in azimuth so
        // the bas-relief shadows shift over ~40s, making brushstrokes
        // and ridges feel sculpted rather than painted-flat.
        const az = tNow * 0.16;
        (material.uniforms.uLightDir.value as InstanceType<typeof THREE.Vector3>)
          .set(Math.cos(az) * 0.7, 0.55, Math.sin(az) * 0.5 + 0.6).normalize();

        // Dissolve-in over 1.3s on mount.
        if (reveal.value < 1) reveal.value = Math.min(1, tNow / 1.3);

        // Focal plane eased toward the scroll-derived target (computed off
        // the hot path by updateFocalTarget). No layout reads happen here, so
        // the loop never forces a reflow mid-scroll.
        focalCur += (focalTarget - focalCur) * 0.05;
        (material.uniforms.uFocal as { value: number }).value = focalCur;

        const phase = document.documentElement.getAttribute('data-time-phase') || 'day';
        const sun = PHASE_SUN[phase] ?? PHASE_SUN.day;
        (material.uniforms.uSunUv.value as InstanceType<typeof THREE.Vector2>).set(sun.uv[0], sun.uv[1]);
        (material.uniforms.uSunOn as { value: number }).value = sun.on;
        renderer.render(scene, camera);
      };
      rafId = requestAnimationFrame(draw);

      // Pause the render loop when the tab is hidden — no point burning
      // GPU on an off-screen atmosphere. Resume on return.
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
        window.removeEventListener('scroll', updateFocalTarget);
        focalRO.disconnect();
        window.removeEventListener('click', onClick);
        window.removeEventListener('keydown', onAnaglyphKey);
        document.removeEventListener('visibilitychange', onVis);
        if (rafId) cancelAnimationFrame(rafId);
        geom.dispose();
        material.dispose();
        paintingTex.dispose();
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
  }, [src, paintingKey, forceStatic]);

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
