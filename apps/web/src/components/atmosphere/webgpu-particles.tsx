// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from 'react';
import type { ParticleKind } from './atmospheres';
import { CFG } from './webgl-particles';

interface WebGPUParticlesProps {
  kind: Exclude<ParticleKind, 'none'>;
  /** Called if WebGPU init / first frame fails — wrapper reverts to WebGL. */
  onFallback: () => void;
}

/**
 * WebGPUParticles — the ambient field, but the entire simulation runs in
 * a TSL compute shader on the WebGPU backend instead of the CPU.
 *
 * Same look as the WebGL system (reuses CFG physics + the per-kind sprite
 * texture, same orthographic pixel camera), but every particle's wind /
 * gravity / cursor / drag / terminal-velocity / life-respawn step happens
 * on the GPU via `instancedArray` storage buffers and a `Fn().compute()`
 * dispatch. That frees the main thread and lets the count climb far past
 * what a per-frame JS loop + VBO upload could carry.
 *
 * API mirrors the canonical three.js r184 `webgpu_compute_particles`
 * example (instancedArray / element(instanceIndex) / SpriteNodeMaterial /
 * positions.toAttribute()). Gated on navigator.gpu by the wrapper; any
 * error here calls onFallback() so the loved WebGL field always wins.
 */
export function WebGPUParticles({ kind, onFallback }: WebGPUParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cfg = CFG[kind];

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const THREE = await import('three/webgpu');
        const TSL = await import('three/tsl');
        if (cancelled) return;
        const {
          Fn, If, uniform, float, vec2, vec3, vec4, instancedArray, instanceIndex,
          hash, texture, uv, smoothstep, mx_noise_vec3,
        } = TSL;

        // GPU compute carries far more than the CPU loop — push the count
        // up for a richer field, but keep per-particle size/alpha so it
        // still reads as the tuned "calm flurry," not a blizzard.
        const COUNT = Math.min(60000, cfg.count * 6);
        const isBottom = cfg.spawnFrom === 'bottom-band';

        // ── Sprite texture (same drawer as the WebGL field) ──────────
        const spriteCanvas = document.createElement('canvas');
        spriteCanvas.width = cfg.spriteSize;
        spriteCanvas.height = cfg.spriteSize;
        const sctx = spriteCanvas.getContext('2d')!;
        cfg.sprite(sctx, cfg.spriteSize);
        const spriteTex = new THREE.CanvasTexture(spriteCanvas);
        spriteTex.colorSpace = THREE.SRGBColorSpace;

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
        // pos:  (x, y, rotation, size)
        // vel:  (vx, vy, rotV, alpha)
        // attr: (depth, life, lifeMax, alphaBase)
        const posBuf = instancedArray(COUNT, 'vec4');
        const velBuf = instancedArray(COUNT, 'vec4');
        const attrBuf = instancedArray(COUNT, 'vec4');

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
        // 1 → spread initial life across the cycle (so the field isn't all
        // "just born" at t=0); 0 → full life on respawn during the run.
        const uStaggered = uniform(1);

        // Random helper — three decorrelated hashes from the index + a salt.
        const rnd = (salt: number) => hash(instanceIndex.toFloat().mul(salt).add(uTime.mul(60.0)).add(salt));

        // (Re)spawn a particle in place. Used by init (staggered life via
        // uStaggered=1) and by the update step (uStaggered=0) on death.
        const spawn = Fn(() => {
          const pos = posBuf.element(instanceIndex);
          const vel = velBuf.element(instanceIndex);
          const at = attrBuf.element(instanceIndex);

          const rx = rnd(1.7);
          const ry = rnd(3.1);
          const rd = rnd(5.3);
          const rl = rnd(7.9);
          const rvx = rnd(11.1);
          const rvy = rnd(13.3);

          // Squared depth distribution → most particles "far".
          const depth = rd.mul(rd);
          at.x = depth;

          // Top spawners drop in from above; bottom-band spawners erupt
          // from the lower third. Blend by uBottom (0 or 1).
          const topX = rx.sub(0.5).mul(uW.mul(1.1));
          const topY = uH.mul(0.5).add(ry.mul(40.0));
          const botX = rx.sub(0.5).mul(uW.mul(0.85));
          const botY = uH.mul(-0.10).sub(ry.mul(uH.mul(0.30)));
          pos.x = topX.mix(botX, uBottom);
          pos.y = topY.mix(botY, uBottom);
          pos.z = rnd(17.0).mul(6.2832);       // rotation
          pos.w = uBase.add(depth.mul(uJitter)).mul(float(0.35).add(depth.mul(0.65)));

          // Initial velocity — sign of gravity sets the launch direction.
          // (Top: drift down; bottom-band: burst up — matches CFG ranges.)
          const vy0 = uBottom.mix(rvy.mul(14.0).add(4.0), rvy.mul(200.0).add(70.0).negate());
          const vx0 = rvx.sub(0.5).mul(uBottom.mix(float(14.0), float(180.0)));
          vel.x = vx0;
          vel.y = vy0;
          vel.z = rnd(19.0).sub(0.5).mul(1.8);  // rotV
          vel.w = float(0);                     // alpha (set in update)

          const lm = uLifeMin.add(rl.mul(uLifeRange));
          at.z = lm;
          // uStaggered=1 → random life phase; uStaggered=0 → full life.
          at.y = lm.mul(float(1.0).mix(rnd(23.0), uStaggered));
          at.w = float(0.55).add(rnd(29.0).mul(0.45));          // alphaBase
        });

        const computeInit = Fn(() => { spawn(); })().compute(COUNT);
        uStaggered.value = 1;
        renderer.compute(computeInit);
        uStaggered.value = 0;  // subsequent respawns use full life

        const computeUpdate = Fn(() => {
          const pos = posBuf.element(instanceIndex);
          const vel = velBuf.element(instanceIndex);
          const at = attrBuf.element(instanceIndex);

          const depth = at.x;
          const speedScale = float(0.4).add(depth.mul(0.6));

          // Wind — a swirly flow field (mx noise) scaled like the curl
          // field in the WebGL version. Far particles feel less of it.
          const flow = mx_noise_vec3(vec3(pos.x.mul(0.0022), pos.y.mul(0.0022), uTime.mul(0.05)));
          vel.x = vel.x.add(flow.x.mul(26.0).mul(uWind).mul(speedScale).mul(uDt));
          vel.y = vel.y.add(flow.y.mul(26.0).mul(uWind).mul(speedScale).mul(uDt));

          // Gravity (positive cfg.gravity = downward → y decreases).
          vel.y = vel.y.sub(uGravity.mul(speedScale).mul(uDt));

          // Cursor repulsion — only the near layer responds strongly.
          const dx = pos.x.sub(uCursor.x);
          const dy = pos.y.sub(uCursor.y);
          const dist = dx.mul(dx).add(dy.mul(dy)).sqrt().max(0.001);
          If(dist.lessThan(uCursorR), () => {
            const f = float(1.0).sub(dist.div(uCursorR)).mul(uCursorF).mul(220.0)
              .mul(float(0.3).add(depth.mul(0.7)));
            vel.x = vel.x.add(dx.div(dist).mul(f).mul(uDt));
            vel.y = vel.y.add(dy.div(dist).mul(f).mul(uDt));
          });

          // Drag — exp(-drag·dt) per frame.
          const factor = uDrag.mul(uDt).negate().exp();
          vel.x = vel.x.mul(factor);
          vel.y = vel.y.mul(factor);

          // Terminal velocity (depth-scaled) clamps |v|.
          const sp = vel.x.mul(vel.x).add(vel.y.mul(vel.y)).sqrt().max(0.0001);
          const vTerm = uTerminal.mul(float(0.5).add(depth.mul(0.5)));
          If(sp.greaterThan(vTerm), () => {
            const s = vTerm.div(sp);
            vel.x = vel.x.mul(s);
            vel.y = vel.y.mul(s);
          });

          // Integrate.
          pos.x = pos.x.add(vel.x.mul(uDt));
          pos.y = pos.y.add(vel.y.mul(uDt));
          pos.z = pos.z.add(vel.z.mul(uDt));

          // Size with velocity-stretch (motion-blur cue).
          const stretch = float(1.0).add(sp.div(vTerm).mul(uStretch)).min(1.6);
          pos.w = uBase.add(depth.mul(uJitter)).mul(float(0.35).add(depth.mul(0.65))).mul(stretch);

          // Life + alpha (fade-in over first 15%, fade-out over last 20%).
          at.y = at.y.sub(uDt);
          const u = at.y.div(at.z).clamp(0.0, 1.0);
          const fade = smoothstep(0.0, 0.15, float(1.0).sub(u)).mul(smoothstep(0.0, 0.2, u));
          vel.w = fade.mul(float(0.45).add(depth.mul(0.55))).mul(at.w);

          // Respawn on death or leaving the frame.
          const dead = at.y.lessThan(0.0);
          const offX = pos.x.lessThan(uW.mul(-0.6)).or(pos.x.greaterThan(uW.mul(0.6)));
          const offY = pos.y.lessThan(uH.mul(-0.7)).or(pos.y.greaterThan(uH.mul(0.7)));
          If(dead.or(offX).or(offY), () => { spawn(); });
        })().compute(COUNT);

        // ── Sprite render material ───────────────────────────────────
        const material = new THREE.SpriteNodeMaterial();
        material.transparent = true;
        material.depthWrite = false;
        // Orthographic pixel camera — sprites MUST disable size
        // attenuation or they render at the wrong (tiny) scale. (The
        // canonical example uses a perspective camera, so it never hits
        // this.) With attenuation off, scaleNode is in world units = px.
        material.sizeAttenuation = false;
        const posAttr = posBuf.toAttribute();
        const velAttr = velBuf.toAttribute();
        material.positionNode = vec3(posAttr.x, posAttr.y, 0);
        material.scaleNode = posAttr.w;
        material.rotationNode = posAttr.z;
        const tex = texture(spriteTex, uv());
        material.colorNode = tex.rgb;          // colorNode wants vec3
        material.opacityNode = tex.a.mul(velAttr.w);

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

        // ── Loop ─────────────────────────────────────────────────────
        let last = performance.now();
        let raf = 0;
        let firstFrameOk = false;
        const tick = () => {
          const now = performance.now();
          uDt.value = Math.min(0.05, (now - last) / 1000);
          uTime.value = now / 1000;
          last = now;
          renderer.compute(computeUpdate);
          renderer.render(scene, camera);
          if (!firstFrameOk) {
            firstFrameOk = true;
            console.log(`[webgpu-particles] running · kind=${kind} · count=${COUNT}`);
          }
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
          spriteTex.dispose();
          renderer.dispose();
        };
        void firstFrameOk;
      } catch (err) {
        console.warn('[webgpu-particles] init failed — falling back to WebGL', err);
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
