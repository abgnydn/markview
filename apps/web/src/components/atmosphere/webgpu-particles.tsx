// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from 'react';
import type { ParticleKind } from './atmospheres';
import { CFG } from './webgl-particles';

interface WebGPUParticlesProps {
  kind: Exclude<ParticleKind, 'none'>;
  /** Called if WebGPU init / first frame fails — wrapper reverts to WebGL. */
  onFallback: () => void;
}

// Per-kind tint (sRGB 0..1) — the field is drawn as soft circles in this
// colour rather than the canvas sprite, which is the proven-renderable
// path for SpriteNodeMaterial (shapeCircle()) under the WebGPU backend.
const TINT: Record<Exclude<ParticleKind, 'none'>, [number, number, number]> = {
  petals: [0.976, 0.659, 0.831],
  snow:   [1.0, 1.0, 1.0],
  spray:  [0.745, 0.863, 0.961],
  motes:  [0.961, 0.804, 0.510],
};

/**
 * WebGPUParticles — the ambient field with its entire simulation in a TSL
 * compute shader on the WebGPU backend (instancedArray storage buffers +
 * Fn().compute()), rendered as instanced sprites.
 *
 * Render path uses only API shapes proven by the canonical r184
 * webgpu_compute_particles example: whole-buffer `.toAttribute()` for the
 * vertex-stage per-instance data (position, scale — NO swizzle, which
 * came back zero), `.element(instanceIndex)` for fragment-stage alpha, and
 * `shapeCircle()` for the footprint. Orthographic pixel camera with
 * sizeAttenuation off, so scale reads straight as pixels.
 *
 * Gated on navigator.gpu by the wrapper; any error here calls onFallback()
 * so the WebGL field always wins.
 */
export function WebGPUParticles({ kind, onFallback }: WebGPUParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cfg = CFG[kind];
    const tint = TINT[kind];

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const THREE = await import('three/webgpu');
        const TSL = await import('three/tsl');
        if (cancelled) return;
        const {
          Fn, If, uniform, float, vec2, vec3, instancedArray, instanceIndex,
          hash, shapeCircle, mx_noise_vec3,
        } = TSL;

        // Keep the count modest — matching the CPU field, capped low. The
        // earlier 6× headroom (up to 60k sprites) is a heavy GPU load on
        // integrated/shared-memory machines and could hang the display;
        // not worth it for an ambient backdrop. GPU compute still earns
        // its keep by freeing the main thread.
        const COUNT = Math.min(cfg.count, 1500);
        const isBottom = cfg.spawnFrom === 'bottom-band';

        // ── Renderer (WebGPU backend) ────────────────────────────────
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const renderer = new THREE.WebGPURenderer({ canvas, antialias: false, alpha: true });
        renderer.setPixelRatio(dpr);
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        await renderer.init();
        if (cancelled) { renderer.dispose(); return; }

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(
          -window.innerWidth / 2, window.innerWidth / 2,
          window.innerHeight / 2, -window.innerHeight / 2, -1, 1,
        );
        camera.position.z = 0.5;

        // ── Storage buffers ──────────────────────────────────────────
        // Render-facing (read via toAttribute / element):
        //   posBuf  vec3 (x, y, 0)        → positionNode (whole)
        //   sizBuf  vec2 (sizePx, sizePx) → scaleNode (whole)
        //   attrBuf vec4 (depth, life, lifeMax, alpha) → opacity via .w
        // Compute-only:
        //   velBuf  vec4 (vx, vy, _, alphaBase)
        const posBuf = instancedArray(COUNT, 'vec3');
        const sizBuf = instancedArray(COUNT, 'vec2');
        const attrBuf = instancedArray(COUNT, 'vec4');
        const velBuf = instancedArray(COUNT, 'vec4');

        // ── Uniforms ─────────────────────────────────────────────────
        const uDt = uniform(0.016);
        const uTime = uniform(0);
        const uW = uniform(window.innerWidth);
        const uH = uniform(window.innerHeight);
        const uCursor = uniform(vec2(0, 0));
        const uGravity = uniform(cfg.gravity);
        const uDrag = uniform(cfg.drag);
        const uTerminal = uniform(cfg.terminalV);
        const uWind = uniform(cfg.windStrength);
        const uCursorF = uniform(cfg.cursorForce);
        const uCursorR = uniform(cfg.cursorRadius);
        const uBase = uniform(cfg.baseSize);
        const uJitter = uniform(cfg.sizeJitter);
        const uStretch = uniform(cfg.stretch);
        const uLifeMin = uniform(cfg.lifeMin);
        const uLifeRange = uniform(cfg.lifeMax - cfg.lifeMin);
        const uBottom = uniform(isBottom ? 1 : 0);
        const uStaggered = uniform(1);

        const rnd = (salt: number) =>
          hash(instanceIndex.toFloat().mul(salt).add(uTime.mul(60.0)).add(salt));

        const spawn = Fn(() => {
          const pos = posBuf.element(instanceIndex);
          const siz = sizBuf.element(instanceIndex);
          const vel = velBuf.element(instanceIndex);
          const at = attrBuf.element(instanceIndex);

          const rx = rnd(1.7), ry = rnd(3.1), rd = rnd(5.3), rl = rnd(7.9);
          const rvx = rnd(11.1), rvy = rnd(13.3);

          const depth = rd.mul(rd);
          at.x = depth;

          const topX = rx.sub(0.5).mul(uW.mul(1.1));
          const topY = uH.mul(0.5).add(ry.mul(40.0));
          const botX = rx.sub(0.5).mul(uW.mul(0.85));
          const botY = uH.mul(-0.10).sub(ry.mul(uH.mul(0.30)));
          pos.x = topX.mix(botX, uBottom);
          pos.y = topY.mix(botY, uBottom);
          pos.z = float(0);

          const sz = uBase.add(depth.mul(uJitter)).mul(float(0.35).add(depth.mul(0.65)));
          siz.x = sz;
          siz.y = sz;

          const vy0 = uBottom.mix(rvy.mul(14.0).add(4.0), rvy.mul(200.0).add(70.0).negate());
          const vx0 = rvx.sub(0.5).mul(uBottom.mix(float(14.0), float(180.0)));
          vel.x = vx0;
          vel.y = vy0;
          vel.z = float(0);
          vel.w = float(0.55).add(rnd(29.0).mul(0.45));  // alphaBase

          const lm = uLifeMin.add(rl.mul(uLifeRange));
          at.z = lm;
          at.y = lm.mul(float(1.0).mix(rnd(23.0), uStaggered));
          at.w = float(0);  // alpha (set in update)
        });

        const computeInit = Fn(() => { spawn(); })().compute(COUNT);
        uStaggered.value = 1;
        renderer.compute(computeInit);
        uStaggered.value = 0;

        const computeUpdate = Fn(() => {
          const pos = posBuf.element(instanceIndex);
          const siz = sizBuf.element(instanceIndex);
          const vel = velBuf.element(instanceIndex);
          const at = attrBuf.element(instanceIndex);

          const depth = at.x;
          const speedScale = float(0.4).add(depth.mul(0.6));

          const flow = mx_noise_vec3(vec3(pos.x.mul(0.0022), pos.y.mul(0.0022), uTime.mul(0.05)));
          vel.x = vel.x.add(flow.x.mul(26.0).mul(uWind).mul(speedScale).mul(uDt));
          vel.y = vel.y.add(flow.y.mul(26.0).mul(uWind).mul(speedScale).mul(uDt));

          vel.y = vel.y.sub(uGravity.mul(speedScale).mul(uDt));

          const dx = pos.x.sub(uCursor.x);
          const dy = pos.y.sub(uCursor.y);
          const dist = dx.mul(dx).add(dy.mul(dy)).sqrt().max(0.001);
          If(dist.lessThan(uCursorR), () => {
            const f = float(1.0).sub(dist.div(uCursorR)).mul(uCursorF).mul(220.0)
              .mul(float(0.3).add(depth.mul(0.7)));
            vel.x = vel.x.add(dx.div(dist).mul(f).mul(uDt));
            vel.y = vel.y.add(dy.div(dist).mul(f).mul(uDt));
          });

          const factor = uDrag.mul(uDt).negate().exp();
          vel.x = vel.x.mul(factor);
          vel.y = vel.y.mul(factor);

          const sp = vel.x.mul(vel.x).add(vel.y.mul(vel.y)).sqrt().max(0.0001);
          const vTerm = uTerminal.mul(float(0.5).add(depth.mul(0.5)));
          If(sp.greaterThan(vTerm), () => {
            const s = vTerm.div(sp);
            vel.x = vel.x.mul(s);
            vel.y = vel.y.mul(s);
          });

          pos.x = pos.x.add(vel.x.mul(uDt));
          pos.y = pos.y.add(vel.y.mul(uDt));

          const stretch = float(1.0).add(sp.div(vTerm).mul(uStretch)).min(1.6);
          const sz = uBase.add(depth.mul(uJitter)).mul(float(0.35).add(depth.mul(0.65))).mul(stretch);
          siz.x = sz;
          siz.y = sz;

          at.y = at.y.sub(uDt);
          const u = at.y.div(at.z).clamp(0.0, 1.0);
          const fadeIn = float(1.0).sub(u).div(0.15).clamp(0.0, 1.0);
          const fadeOut = u.div(0.2).clamp(0.0, 1.0);
          const fade = fadeIn.mul(fadeOut);
          at.w = fade.mul(float(0.45).add(depth.mul(0.55))).mul(vel.w);

          const dead = at.y.lessThan(0.0);
          const offX = pos.x.lessThan(uW.mul(-0.6)).or(pos.x.greaterThan(uW.mul(0.6)));
          const offY = pos.y.lessThan(uH.mul(-0.7)).or(pos.y.greaterThan(uH.mul(0.7)));
          If(dead.or(offX).or(offY), () => { spawn(); });
        })().compute(COUNT);

        // ── Render material ──────────────────────────────────────────
        const material = new THREE.SpriteNodeMaterial();
        material.transparent = true;
        material.depthWrite = false;
        material.sizeAttenuation = false;          // ortho: scale = pixels
        material.positionNode = posBuf.toAttribute();           // vec3, whole
        material.scaleNode = sizBuf.toAttribute();              // vec2, whole
        material.colorNode = vec3(tint[0], tint[1], tint[2]);
        // shapeCircle() returns an under-typed Node; it's a valid float
        // mask at runtime, so coerce it for the typed .mul().
        const circle = shapeCircle() as unknown as ReturnType<typeof float>;
        material.opacityNode = attrBuf.element(instanceIndex).w.mul(circle);

        const sprite = new THREE.Sprite(material);
        sprite.count = COUNT;
        sprite.frustumCulled = false;
        scene.add(sprite);

        // ── Inputs ───────────────────────────────────────────────────
        const onMove = (e: MouseEvent) => {
          uCursor.value.x = e.clientX - window.innerWidth / 2;
          uCursor.value.y = window.innerHeight / 2 - e.clientY;
        };
        window.addEventListener('mousemove', onMove);

        const onResize = () => {
          renderer.setSize(window.innerWidth, window.innerHeight, false);
          camera.left = -window.innerWidth / 2;
          camera.right = window.innerWidth / 2;
          camera.top = window.innerHeight / 2;
          camera.bottom = -window.innerHeight / 2;
          camera.updateProjectionMatrix();
          uW.value = window.innerWidth;
          uH.value = window.innerHeight;
        };
        window.addEventListener('resize', onResize);

        // ── Warm-up frame (INSIDE the try) ───────────────────────────
        // Run one compute + render through the awaitable API so any TSL /
        // shader-compile or device error surfaces HERE — caught below and
        // cleanly fallen back to WebGL — instead of throwing uncaught inside
        // the rAF loop and leaving a silent dead canvas. This was the bug:
        // the loop's first frame was the real point of failure, unguarded.
        await renderer.computeAsync(computeUpdate); // await surfaces compile errors
        renderer.render(scene, camera);             // init() already awaited → sync render
        if (cancelled) { renderer.dispose(); return; }
        console.log(`[webgpu-particles] running · kind=${kind} · count=${COUNT}`);
        // Surface success to the on-screen toast so the device/path is visible
        // without opening DevTools.
        const adapterInfo = (renderer.backend as { adapter?: { info?: unknown } } | undefined)?.adapter?.info;
        window.dispatchEvent(new CustomEvent('markview:toast', {
          detail: { message: `WebGPU OK · ${COUNT} particles · ${JSON.stringify(adapterInfo ?? 'adapter?')}` },
        }));

        // ── Loop ─────────────────────────────────────────────────────
        let last = performance.now();
        let raf = 0;
        const tick = () => {
          const now = performance.now();
          uDt.value = Math.min(0.05, (now - last) / 1000);
          uTime.value = now / 1000;
          last = now;
          renderer.compute(computeUpdate);
          renderer.render(scene, camera);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        const onVis = () => {
          if (document.hidden) {
            if (raf) { cancelAnimationFrame(raf); raf = 0; }
          } else if (!raf) {
            last = performance.now();
            raf = requestAnimationFrame(tick);
          }
        };
        document.addEventListener('visibilitychange', onVis);

        cleanup = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('resize', onResize);
          document.removeEventListener('visibilitychange', onVis);
          if (raf) cancelAnimationFrame(raf);
          material.dispose();
          renderer.dispose();
        };
      } catch (err) {
        console.warn('[webgpu-particles] init failed — falling back to WebGL', err);
        const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        window.dispatchEvent(new CustomEvent('markview:toast', {
          detail: { message: `WebGPU failed → WebGL · ${msg}` },
        }));
        if (!cancelled) onFallback();
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [kind, onFallback]);

  return (
    <canvas
      ref={canvasRef}
      className="atmosphere-cursor-canvas"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}
    />
  );
}
