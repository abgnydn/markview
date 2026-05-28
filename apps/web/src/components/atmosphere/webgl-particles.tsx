// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from 'react';
import type { ParticleKind } from './atmospheres';

interface WebGLParticlesProps {
  kind: Exclude<ParticleKind, 'none'>;
}

/**
 * Advanced GPU particle system — Three.js Points with a custom shader.
 * Replaces the ~30 CSS keyframes + tiny canvas flock with ~3000
 * particles per atmosphere driven by a real wind field + cursor force +
 * gravity + life/respawn cycle.
 *
 * State lives in JS Float32 arrays and uploads to a single VBO per
 * frame. The CPU update is ~0.4 ms for 3000 particles. Render is a
 * single gl.POINTS draw call with a per-atmosphere sprite texture
 * (drawn once on an offscreen canvas).
 *
 * Per-atmosphere physics:
 *   petals — falling, gentle horizontal drift, slow rotation, soft sway
 *   snow   — tighter falling, less drift, varied sizes
 *   spray  — burst upward from the lower-middle, fast decay
 *   motes  — slow upward float, soft glow, sparse
 */

interface KindConfig {
  count: number;
  spriteSize: number;       // canvas px for the sprite texture
  sprite: (ctx: CanvasRenderingContext2D, size: number) => void;
  // particle physics
  gravity: number;          // px/s² (positive = down)
  drag: number;             // velocity damping per second
  baseSize: number;         // base point size in px
  sizeJitter: number;       // ± px
  lifeMin: number;          // seconds
  lifeMax: number;
  windStrength: number;     // multiplier on the global wind vector
  cursorForce: number;      // 0-1 multiplier
  cursorRadius: number;     // px
  // spawn behavior
  spawnFrom: 'top' | 'bottom-band' | 'edges';
  initialVy: () => number;  // starting vertical velocity
  initialVx: () => number;  // starting horizontal velocity
  rotates: boolean;
}

// ── Per-atmosphere sprite drawers + physics ─────────────────────────────
//
// Earlier version used radial-gradient halos for every sprite which
// made the screen read as "perfume spray." Real snow / petals / water
// droplets are OPAQUE shapes with sharp edges and just a hint of
// anti-aliasing. Each drawer below renders a solid form with a
// minimal feather, not a glow.

const drawPetal = (ctx: CanvasRenderingContext2D, s: number) => {
  ctx.clearRect(0, 0, s, s);
  const cx = s / 2, cy = s / 2;
  // Real petal: opaque oval, slightly darker rim, faint vein highlight.
  // Tapered teardrop shape via two-bezier outline.
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.35, cy);
  ctx.quadraticCurveTo(cx, cy - s * 0.30, cx + s * 0.40, cy - s * 0.04);
  ctx.quadraticCurveTo(cx, cy + s * 0.30, cx - s * 0.35, cy);
  ctx.closePath();
  // Two-stop linear fill — body lighter top-left, rim darker bottom-right.
  const grad = ctx.createLinearGradient(cx - s * 0.3, cy - s * 0.25, cx + s * 0.3, cy + s * 0.25);
  grad.addColorStop(0, 'rgba(252, 213, 230, 1)');
  grad.addColorStop(0.6, 'rgba(249, 168, 212, 1)');
  grad.addColorStop(1, 'rgba(208, 124, 168, 1)');
  ctx.fillStyle = grad;
  ctx.fill();
  // Single vein down the long axis.
  ctx.strokeStyle = 'rgba(180, 110, 150, 0.5)';
  ctx.lineWidth = Math.max(0.6, s * 0.025);
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.30, cy);
  ctx.quadraticCurveTo(cx, cy - s * 0.05, cx + s * 0.35, cy - s * 0.02);
  ctx.stroke();
};

const drawSnow = (ctx: CanvasRenderingContext2D, s: number) => {
  ctx.clearRect(0, 0, s, s);
  const cx = s / 2, cy = s / 2;
  // Opaque white disk with a single-pixel feather. Reads as a crisp
  // snowflake, not a glow. Two-stop gradient gives natural anti-alias.
  const grad = ctx.createRadialGradient(cx, cy, s * 0.30, cx, cy, s * 0.40);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.85, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.40, 0, Math.PI * 2);
  ctx.fill();
};

const drawSpray = (ctx: CanvasRenderingContext2D, s: number) => {
  ctx.clearRect(0, 0, s, s);
  const cx = s / 2, cy = s / 2;
  // Small opaque water droplet — slightly elongated like a real airborne
  // droplet, white-blue core, sharp edge.
  ctx.beginPath();
  ctx.ellipse(cx, cy, s * 0.28, s * 0.34, 0, 0, Math.PI * 2);
  const grad = ctx.createLinearGradient(cx, cy - s * 0.3, cx, cy + s * 0.3);
  grad.addColorStop(0, 'rgba(240, 250, 255, 1)');
  grad.addColorStop(1, 'rgba(170, 210, 240, 1)');
  ctx.fillStyle = grad;
  ctx.fill();
  // Tiny specular highlight, top-left.
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.08, cy - s * 0.10, s * 0.06, s * 0.04, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fill();
};

const drawMote = (ctx: CanvasRenderingContext2D, s: number) => {
  ctx.clearRect(0, 0, s, s);
  const cx = s / 2, cy = s / 2;
  // Motes are the one kind that SHOULD glow — they're suspended pollen /
  // sun-dust catching light, not solid objects. Keep the soft halo but
  // tighten the core so they read as warm specks, not blobs.
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.45);
  grad.addColorStop(0, 'rgba(255, 240, 195, 1)');
  grad.addColorStop(0.25, 'rgba(245, 205, 130, 0.8)');
  grad.addColorStop(1, 'rgba(245, 200, 120, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.45, 0, Math.PI * 2);
  ctx.fill();
};

const CFG: Record<Exclude<ParticleKind, 'none'>, KindConfig> = {
  petals: {
    // Cherry-blossom flurries IRL are sparse — a few dozen visible at a
    // time, not hundreds. Big size variance so a couple of large petals
    // dominate against many small distant ones.
    count: 700,
    spriteSize: 36,
    sprite: drawPetal,
    gravity: 6,
    drag: 0.04,
    baseSize: 10,
    sizeJitter: 18,        // 10–28px — strong size variance
    lifeMin: 18,
    lifeMax: 32,
    windStrength: 0.95,
    cursorForce: 0.35,
    cursorRadius: 180,
    spawnFrom: 'top',
    initialVy: () => 4 + Math.random() * 10,
    initialVx: () => (Math.random() - 0.5) * 14,
    rotates: true,
  },
  snow: {
    // Snowfall density tuned to "calm flurry," not blizzard. Most flakes
    // are tiny (3-6px) with occasional larger ones (up to 11px).
    count: 1400,
    spriteSize: 22,
    sprite: drawSnow,
    gravity: 14,
    drag: 0.06,
    baseSize: 3,
    sizeJitter: 8,
    lifeMin: 22,
    lifeMax: 36,
    windStrength: 0.45,
    cursorForce: 0.22,
    cursorRadius: 130,
    spawnFrom: 'top',
    initialVy: () => 10 + Math.random() * 18,
    initialVx: () => (Math.random() - 0.5) * 4,
    rotates: false,
  },
  spray: {
    // Spray off a wave crest — a handful of large droplets per burst,
    // many small mist droplets behind. Short-lived.
    count: 600,
    spriteSize: 18,
    sprite: drawSpray,
    gravity: 110,
    drag: 0.32,
    baseSize: 3,
    sizeJitter: 7,
    lifeMin: 0.9,
    lifeMax: 2.1,
    windStrength: 0.25,
    cursorForce: 0.5,
    cursorRadius: 160,
    spawnFrom: 'bottom-band',
    initialVy: () => -(70 + Math.random() * 200),
    initialVx: () => (Math.random() - 0.5) * 180,
    rotates: false,
  },
  motes: {
    // Sun-dust / pollen — should feel sparse and slow. The "glow" is the
    // point of motes so keep their soft halo but thin out the density.
    count: 500,
    spriteSize: 18,
    sprite: drawMote,
    gravity: -5,
    drag: 0.10,
    baseSize: 4,
    sizeJitter: 6,
    lifeMin: 22,
    lifeMax: 38,
    windStrength: 0.35,
    cursorForce: 0.20,
    cursorRadius: 140,
    spawnFrom: 'bottom-band',
    initialVy: () => -(6 + Math.random() * 10),
    initialVx: () => (Math.random() - 0.5) * 6,
    rotates: false,
  },
};

// ── Wind field — 2D CURL NOISE ──────────────────────────────────────────
//
// Value noise (what we used before) is divergent — particles flow OUT of
// some regions and pile up in others, which reads as uniform sideways
// drift across the screen. Curl noise is the perpendicular gradient of
// a scalar field, so it's divergence-free: vectors swirl into eddies
// the way real air does over a wing. That's the difference between
// "snow blown sideways" and "snow caught in a real gust."
//
// Implementation: hash-based 2D value noise + finite-difference curl.
// ~30 lines, fast enough to call once per particle per frame.

function makeWindField() {
  const fract = (x: number) => x - Math.floor(x);
  const fade = (t: number) => t * t * (3 - 2 * t);
  const hash = (x: number, y: number) =>
    fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);

  function noise2(x: number, y: number): number {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fX = fade(x - ix), fY = fade(y - iy);
    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);
    return a + (b - a) * fX + (c - a) * fY + (a - b - c + d) * fX * fY;
  }

  return (x: number, y: number, t: number): [number, number] => {
    const fx = x * 0.0022 + t * 0.05;
    const fy = y * 0.0022 + t * 0.04;
    const eps = 0.6;
    // Curl of the 2D noise scalar: returns ⟂ to ∇noise, which spirals
    // around peaks instead of flowing past them.
    const dx = (noise2(fx, fy + eps) - noise2(fx, fy - eps)) / (2 * eps);
    const dy = (noise2(fx + eps, fy) - noise2(fx - eps, fy)) / (2 * eps);
    const mag = 26;
    // Slow global drift so the eddies travel across the screen.
    const drift = Math.sin(t * 0.07) * 8;
    return [dx * mag + drift, -dy * mag];
  };
}

export function WebGLParticles({ kind }: WebGLParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cfg = CFG[kind];

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const THREE = await import('three');
      if (cancelled) return;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(window.innerWidth, window.innerHeight, false);

      const scene = new THREE.Scene();
      // Orthographic in screen pixels — simpler than perspective for 2D-ish
      // particles. (0,0) at viewport center, +x right, +y up.
      const camera = new THREE.OrthographicCamera(
        -window.innerWidth / 2, window.innerWidth / 2,
        window.innerHeight / 2, -window.innerHeight / 2,
        -1, 1,
      );
      camera.position.z = 0.5;

      // Sprite texture — drawn once on offscreen canvas.
      const spriteCanvas = document.createElement('canvas');
      spriteCanvas.width = cfg.spriteSize;
      spriteCanvas.height = cfg.spriteSize;
      const sctx = spriteCanvas.getContext('2d')!;
      cfg.sprite(sctx, cfg.spriteSize);
      const spriteTex = new THREE.CanvasTexture(spriteCanvas);
      spriteTex.minFilter = THREE.LinearFilter;
      spriteTex.magFilter = THREE.LinearFilter;
      spriteTex.colorSpace = THREE.SRGBColorSpace;

      const count = cfg.count;
      const positions = new Float32Array(count * 3);  // x, y, z
      const sizes = new Float32Array(count);
      const rotations = new Float32Array(count);
      const alphas = new Float32Array(count);

      // Velocity + life + DEPTH live in JS only (not uploaded to GPU).
      // `depth` 0=far (small + slow + dim), 1=near (large + fast + bright).
      // Distributed via sqrt so more particles sit "far" (natural perspective).
      const vx = new Float32Array(count);
      const vy = new Float32Array(count);
      const life = new Float32Array(count);
      const lifeMax = new Float32Array(count);
      const rotV = new Float32Array(count);    // rotation velocity rad/s
      const depth = new Float32Array(count);   // 0..1, near = bigger/faster/brighter

      const W = () => window.innerWidth;
      const H = () => window.innerHeight;

      // Spawn / respawn a particle. If `staggered`, distribute life so
      // initial particles aren't all "just born" at t=0.
      const respawn = (i: number, staggered = false) => {
        switch (cfg.spawnFrom) {
          case 'top':
            positions[i * 3] = (Math.random() - 0.5) * W() * 1.1;
            positions[i * 3 + 1] = H() / 2 + Math.random() * 40;
            break;
          case 'bottom-band':
            positions[i * 3] = (Math.random() - 0.5) * W() * 0.85;
            positions[i * 3 + 1] = -H() * (0.10 + Math.random() * 0.30);
            break;
          case 'edges':
            positions[i * 3] = (Math.random() < 0.5 ? -1 : 1) * W() * 0.5;
            positions[i * 3 + 1] = (Math.random() - 0.5) * H();
            break;
        }
        positions[i * 3 + 2] = 0;
        // Depth — squared distribution so most particles are "far" and
        // a few are "near" (matches what you see looking through real air).
        const u = Math.random();
        depth[i] = u * u;
        vx[i] = cfg.initialVx();
        vy[i] = cfg.initialVy();
        // Per-particle size scales with depth: near = base + jitter,
        // far = base * 0.35. Gives real depth-of-field rather than a
        // flat curtain of identical specks.
        const dScale = 0.35 + depth[i] * 0.65;
        sizes[i] = (cfg.baseSize + Math.random() * cfg.sizeJitter) * dScale;
        rotations[i] = Math.random() * Math.PI * 2;
        rotV[i] = cfg.rotates ? (Math.random() - 0.5) * 1.8 : 0;
        const lm = cfg.lifeMin + Math.random() * (cfg.lifeMax - cfg.lifeMin);
        lifeMax[i] = lm;
        life[i] = staggered ? Math.random() * lm : lm;
      };

      for (let i = 0; i < count; i++) respawn(i, true);

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
      geom.setAttribute('rotation', new THREE.BufferAttribute(rotations, 1));
      geom.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

      const material = new THREE.ShaderMaterial({
        uniforms: {
          uSprite:  { value: spriteTex },
          uDpr:     { value: dpr },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        vertexShader: `
          attribute float size;
          attribute float rotation;
          attribute float alpha;
          varying float vAlpha;
          varying float vRotation;
          uniform float uDpr;
          void main() {
            vAlpha = alpha;
            vRotation = rotation;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = size * uDpr;
          }
        `,
        fragmentShader: `
          precision mediump float;
          uniform sampler2D uSprite;
          varying float vAlpha;
          varying float vRotation;
          void main() {
            // Rotate gl_PointCoord around its center.
            vec2 uv = gl_PointCoord - 0.5;
            float c = cos(vRotation), s = sin(vRotation);
            uv = mat2(c, -s, s, c) * uv + 0.5;
            if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
            vec4 tex = texture2D(uSprite, uv);
            gl_FragColor = vec4(tex.rgb, tex.a * vAlpha);
          }
        `,
      });

      const points = new THREE.Points(geom, material);
      scene.add(points);

      // ── Inputs ────────────────────────────────────────────────────
      let cursorX = 0, cursorY = 0;
      const onMove = (e: MouseEvent) => {
        // Convert to centered coords (camera space).
        cursorX = e.clientX - W() / 2;
        cursorY = H() / 2 - e.clientY;
      };
      window.addEventListener('mousemove', onMove);

      const onResize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        camera.left = -window.innerWidth / 2;
        camera.right = window.innerWidth / 2;
        camera.top = window.innerHeight / 2;
        camera.bottom = -window.innerHeight / 2;
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', onResize);

      // ── Main loop ─────────────────────────────────────────────────
      const wind = makeWindField();
      let last = performance.now();
      let raf = 0;
      const tick = () => {
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const tSec = now / 1000;

        const dragFactor = Math.exp(-cfg.drag * dt);
        for (let i = 0; i < count; i++) {
          const ix = i * 3;
          // Position in centered coords.
          const px = positions[ix];
          const py = positions[ix + 1];
          // Depth scale — far particles move slower, fall slower, dim.
          const d = depth[i];
          const speedScale = 0.4 + d * 0.6;

          // Curl-noise wind. Far particles get less of the wind so
          // distant snow doesn't whip around like nearby snow.
          const [wx, wy] = wind(px + W() / 2, H() / 2 - py, tSec);
          vx[i] += wx * cfg.windStrength * speedScale * dt;
          vy[i] += wy * cfg.windStrength * speedScale * dt;

          // Gravity (positive = down → reduces y). Also depth-scaled.
          vy[i] -= cfg.gravity * speedScale * dt;

          // Cursor force (push particles away from cursor) — only the
          // near layer responds strongly so the cursor reads as
          // genuinely close to the viewer, not a global wind.
          const dx = px - cursorX;
          const dy = py - cursorY;
          const dist2 = dx * dx + dy * dy;
          const r = cfg.cursorRadius;
          if (dist2 < r * r && dist2 > 0.001) {
            const dist = Math.sqrt(dist2);
            const force = (1 - dist / r) * cfg.cursorForce * 220 * (0.3 + d * 0.7);
            vx[i] += (dx / dist) * force * dt;
            vy[i] += (dy / dist) * force * dt;
          }

          // Drag.
          vx[i] *= dragFactor;
          vy[i] *= dragFactor;

          // Integrate.
          positions[ix] = px + vx[i] * dt;
          positions[ix + 1] = py + vy[i] * dt;
          rotations[i] += rotV[i] * dt;

          // Life + alpha + depth-driven dim. Far particles top out at
          // ~0.55 alpha — they read as atmosphere haze rather than
          // crisp foreground.
          life[i] -= dt;
          const lm = lifeMax[i];
          const u = life[i] / lm;             // 1 → 0
          const fade = u < 0.85 ? Math.min(1, u / 0.2) : (1 - u) / 0.15;
          const depthAlpha = 0.45 + d * 0.55;
          alphas[i] = Math.max(0, Math.min(1, fade * depthAlpha));

          // Respawn if life expired OR if it's far offscreen.
          const offX = positions[ix] < -W() * 0.6 || positions[ix] > W() * 0.6;
          const offY = positions[ix + 1] < -H() * 0.7 || positions[ix + 1] > H() * 0.7;
          if (life[i] <= 0 || offX || offY) respawn(i, false);
        }

        // Mark attributes for GPU upload.
        geom.attributes.position.needsUpdate = true;
        geom.attributes.size.needsUpdate = true;
        geom.attributes.rotation.needsUpdate = true;
        geom.attributes.alpha.needsUpdate = true;

        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      cleanup = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('resize', onResize);
        if (raf) cancelAnimationFrame(raf);
        geom.dispose();
        material.dispose();
        spriteTex.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [kind]);

  return (
    <canvas
      ref={canvasRef}
      className="atmosphere-cursor-canvas"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}
    />
  );
}
