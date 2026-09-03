// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from 'react';
import { SnowBank, stampPetal } from './accumulation';
import type { ParticleKind } from './atmospheres';

interface WebGLParticlesProps {
  kind: Exclude<ParticleKind, 'none'>;
}

/**
 * Advanced GPU particle system — Three.js Points with a custom shader.
 * Replaces the ~30 CSS keyframes + tiny canvas flock with ~3000
 * particles per atmosphere driven by a real wind field + gravity +
 * life/respawn cycle. The particles do not react to the cursor: they
 * fall, and that is all they do.
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

export interface KindConfig {
  count: number;
  spriteSize: number;       // canvas px for the sprite texture
  sprite: (ctx: CanvasRenderingContext2D, size: number) => void;
  // particle physics
  gravity: number;          // px/s² (positive = down)
  drag: number;             // velocity damping per second
  terminalV: number;        // px/s cap on |velocity| — gravity stops accumulating past this
  stretch: number;          // motion-blur stretch multiplier — sprite grows along travel when fast (0=off)
  baseSize: number;         // base point size in px
  sizeJitter: number;       // ± px
  lifeMin: number;          // seconds
  lifeMax: number;
  windStrength: number;     // multiplier on the global wind vector
  // spawn behavior
  spawnFrom: 'top' | 'bottom-band' | 'edges';
  initialVy: () => number;  // starting vertical velocity
  initialVx: () => number;  // starting horizontal velocity
  rotates: boolean;
  // Persistent accumulation — particles that "land" (low velocity in
  // a high-depth zone) write a soft splat to the accumulation canvas
  // that fades over time. accumulate=0 disables the layer entirely
  // for that kind (spray + motes never settle).
  accumulate: number;       // splat alpha 0..1 when a particle lands
  accumulateFadePerSec: number; // per-second multiplicative decay of the layer
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
  // A flake as a camera sees it, not as a diagram draws it: a soft-bodied
  // disc whose brightness gathers slightly toward the rim. Out-of-focus
  // points of light form exactly that — a faintly ringed disc — and the
  // shader pushes the near flakes further out of focus, so the rim is
  // what sells them as bokeh instead of dots. Far flakes are tiny enough
  // that the rim collapses into a plain bright speck.
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.42);
  grad.addColorStop(0.00, 'rgba(255, 255, 255, 0.86)');
  grad.addColorStop(0.62, 'rgba(255, 255, 255, 0.90)');
  grad.addColorStop(0.84, 'rgba(255, 255, 255, 1.00)');
  grad.addColorStop(1.00, 'rgba(255, 255, 255, 0.00)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
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

export const CFG: Record<Exclude<ParticleKind, 'none'>, KindConfig> = {
  petals: {
    // Cherry-blossom flurries IRL are sparse — a few dozen visible at a
    // time, not hundreds. Big size variance so a couple of large petals
    // dominate against many small distant ones.
    count: 700,
    spriteSize: 96,
    sprite: drawPetal,
    gravity: 6,
    drag: 0.04,
    terminalV: 36,        // cherry blossom petals fall slow — ~36 px/s max
    stretch: 0.05,        // barely any stretch — petals tumble, don't streak
    accumulate: 0.45,     // petals settle visibly — pink dust on the bottom edges
    accumulateFadePerSec: 0.018,  // ~55 s half-life
    baseSize: 10,
    sizeJitter: 18,        // 10–28px — strong size variance
    // A petal at ~30px/s needs ~25s to cross the viewport; shorter lives
    // timed out in the air and nothing reached the ground to carpet it.
    lifeMin: 38,
    lifeMax: 58,
    windStrength: 0.95,
    spawnFrom: 'top',
    initialVy: () => 4 + Math.random() * 10,
    initialVx: () => (Math.random() - 0.5) * 14,
    rotates: true,
  },
  snow: {
    // Snowfall density tuned to "calm flurry," not blizzard. Most flakes
    // are tiny (3-6px) with occasional larger ones (up to 11px).
    count: 1400,
    spriteSize: 64,
    sprite: drawSnow,
    gravity: 14,
    drag: 0.06,
    terminalV: 80,        // snow falls steady; gusts can push past briefly
    stretch: 0.85,        // near flakes on a gust streak visibly; far ones barely
    accumulate: 0.55,     // snow PILES UP — strongest accumulation of any kind
    accumulateFadePerSec: 0.010,  // ~95 s half-life (snow stays put longer)
    // Wide spread on purpose: depth-of-field only reads if the nearest
    // flakes are unmistakably bigger and softer than the rest.
    baseSize: 2.5,
    sizeJitter: 15,
    // Long enough to reach the ground: a flake that times out mid-air never
    // lands, and it is the landings that build the drift.
    lifeMin: 34,
    lifeMax: 50,
    windStrength: 0.8,
    spawnFrom: 'top',
    initialVy: () => 10 + Math.random() * 18,
    initialVx: () => (Math.random() - 0.5) * 4,
    rotates: false,
  },
  spray: {
    // Spray off a wave crest — a handful of large droplets per burst,
    // many small mist droplets behind. Short-lived.
    count: 600,
    spriteSize: 64,
    sprite: drawSpray,
    gravity: 110,
    drag: 0.32,
    terminalV: 280,       // spray bursts fast — water droplets streak when airborne
    stretch: 0.45,        // strongest streak — looks like real flying droplets
    accumulate: 0.0,      // water spray evaporates, doesn't settle
    accumulateFadePerSec: 0.0,
    baseSize: 3,
    sizeJitter: 7,
    lifeMin: 0.9,
    lifeMax: 2.1,
    windStrength: 0.25,
    spawnFrom: 'bottom-band',
    initialVy: () => -(70 + Math.random() * 200),
    initialVx: () => (Math.random() - 0.5) * 180,
    rotates: false,
  },
  motes: {
    // Sun-dust / pollen — should feel sparse and slow. The "glow" is the
    // point of motes so keep their soft halo but thin out the density.
    count: 500,
    spriteSize: 64,
    sprite: drawMote,
    gravity: -5,
    drag: 0.10,
    terminalV: 24,        // motes drift slow, never streak
    stretch: 0.0,         // no motion blur on glowing motes
    accumulate: 0.0,      // sun-dust never settles (floats up forever)
    accumulateFadePerSec: 0.0,
    baseSize: 4,
    sizeJitter: 6,
    lifeMin: 22,
    lifeMax: 38,
    windStrength: 0.35,
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

  // Two-octave curl noise: a slow large-scale eddy (the prevailing
  // gust direction) summed with a fast small-scale swirl (turbulent
  // detail). Real wind isn't a single coherent frequency — gusts
  // happen inside gusts inside gusts. Two octaves is the cheapest
  // way to get that compound texture without buying simplex noise.
  function curl(fx: number, fy: number, eps: number): [number, number] {
    const dx = (noise2(fx, fy + eps) - noise2(fx, fy - eps)) / (2 * eps);
    const dy = (noise2(fx + eps, fy) - noise2(fx - eps, fy)) / (2 * eps);
    return [dx, -dy];
  }

  return (x: number, y: number, t: number): [number, number] => {
    // Coarse octave: large eddies, slow drift.
    const [cx, cy] = curl(x * 0.0020 + t * 0.04, y * 0.0020 + t * 0.03, 0.6);
    // Fine octave: small swirls, faster, half amplitude.
    const [fxs, fys] = curl(x * 0.0070 + t * 0.18, y * 0.0070 + t * 0.14, 0.5);
    // Global drift so the whole field travels across the screen.
    const drift = Math.sin(t * 0.07) * 8;
    return [
      cx * 26 + fxs * 12 + drift,
      cy * 26 + fys * 12,
    ];
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
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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
      // Mipmaps are the depth-of-field. Sampling a coarser level is a free,
      // exact box blur of the sprite, so the fragment shader can defocus a
      // particle just by biasing the level it reads — near flakes read a
      // blurry level, far ones the sharp one.
      spriteTex.generateMipmaps = true;
      spriteTex.minFilter = THREE.LinearMipmapLinearFilter;
      spriteTex.magFilter = THREE.LinearFilter;
      spriteTex.colorSpace = THREE.SRGBColorSpace;

      const count = cfg.count;
      const positions = new Float32Array(count * 3);  // x, y, z
      const sizes = new Float32Array(count);
      const rotations = new Float32Array(count);
      const alphas = new Float32Array(count);
      const depthAttr = new Float32Array(count); // depth, mirrored for the shader
      const stretchAttr = new Float32Array(count).fill(1); // motion-blur elongation

      // Velocity + life + DEPTH live in JS only (not uploaded to GPU).
      // `depth` 0=far (small + slow + dim), 1=near (large + fast + bright).
      // Distributed via sqrt so more particles sit "far" (natural perspective).
      const vx = new Float32Array(count);
      const vy = new Float32Array(count);
      const life = new Float32Array(count);
      const lifeMax = new Float32Array(count);
      const rotV = new Float32Array(count);     // rotation velocity rad/s
      const depth = new Float32Array(count);    // 0..1, near = bigger/faster/brighter
      const alphaBase = new Float32Array(count); // 0.55–1.0 per-particle alpha jitter (some flakes are translucent, some opaque)

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
        depthAttr[i] = depth[i];
        vx[i] = cfg.initialVx();
        vy[i] = cfg.initialVy();
        // Per-particle size scales with depth: near = base + jitter,
        // far = base * 0.35. Gives real depth-of-field rather than a
        // flat curtain of identical specks.
        const dScale = 0.35 + depth[i] * 0.65;
        sizes[i] = (cfg.baseSize + Math.random() * cfg.sizeJitter) * dScale;
        rotations[i] = Math.random() * Math.PI * 2;
        rotV[i] = cfg.rotates ? (Math.random() - 0.5) * 1.8 : 0;
        // Per-particle alpha jitter — some flakes/petals are barely
        // there, others fully opaque. Real snow visibly has both.
        alphaBase[i] = 0.55 + Math.random() * 0.45;
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
      geom.setAttribute('depth', new THREE.BufferAttribute(depthAttr, 1));
      geom.setAttribute('stretch', new THREE.BufferAttribute(stretchAttr, 1));

      const material = new THREE.ShaderMaterial({
        uniforms: {
          uSprite:  { value: spriteTex },
          uDpr:     { value: dpr },
          // Mip levels of defocus applied to the nearest particles. The
          // camera is focused on the page; the flakes drifting past the lens
          // are the ones that should smear.
          uBokeh:   { value: 3.2 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        vertexShader: `
          attribute float size;
          attribute float rotation;
          attribute float alpha;
          attribute float depth;
          attribute float stretch;
          varying float vAlpha;
          varying float vRotation;
          varying float vDepth;
          varying float vStretch;
          uniform float uDpr;
          void main() {
            vAlpha = alpha;
            vRotation = rotation;
            vDepth = depth;
            vStretch = stretch;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = size * uDpr;
          }
        `,
        fragmentShader: `
          precision mediump float;
          uniform sampler2D uSprite;
          uniform float uBokeh;
          varying float vAlpha;
          varying float vRotation;
          varying float vDepth;
          varying float vStretch;
          void main() {
            // Into the sprite's own frame: rotate so x runs along the
            // velocity, then squeeze the short axis by the stretch so the
            // disc is left long along the path — a streak, not a dot.
            vec2 uv = gl_PointCoord - 0.5;
            float c = cos(vRotation), s = sin(vRotation);
            uv = mat2(c, -s, s, c) * uv;
            uv.y *= vStretch;
            uv += 0.5;
            if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
            // Depth of field. The focal plane is the page, mid-distance; the
            // nearest particles are past it and go soft, read from a coarser
            // mip level. Far ones stay pin-sharp specks.
            float near = smoothstep(0.45, 1.0, vDepth);
            vec4 tex = texture2D(uSprite, uv, near * uBokeh);
            // Out-of-focus highlights spread their light over more pixels,
            // so they look lighter, not dimmer: lift them a touch.
            gl_FragColor = vec4(tex.rgb * (1.0 + near * 0.12), tex.a * vAlpha);
          }
        `,
      });

      const points = new THREE.Points(geom, material);
      scene.add(points);

      // ── Accumulation Canvas2D layer ────────────────────────────────
      // Settled particles (low velocity in a foreground zone) splat
      // here as a soft sprite. Layer fades per-second. Sits BELOW the
      // WebGL particles canvas (z-index in CSS via .mv-accumulation).
      const accumCanvas = document.createElement('canvas');
      accumCanvas.className = 'mv-accumulation';
      accumCanvas.setAttribute('aria-hidden', 'true');
      Object.assign(accumCanvas.style, {
        position: 'absolute',
        inset: '0',
        pointerEvents: 'none',
        zIndex: '1',
      });
      const setAccumSize = () => {
        const dprA = Math.min(window.devicePixelRatio || 1, 1.5);
        accumCanvas.width = window.innerWidth * dprA;
        accumCanvas.height = window.innerHeight * dprA;
        accumCanvas.style.width = `${window.innerWidth}px`;
        accumCanvas.style.height = `${window.innerHeight}px`;
      };
      setAccumSize();
      canvas.parentElement?.insertBefore(accumCanvas, canvas);
      const accumCtx = accumCanvas.getContext('2d')!;
      const accumDpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const accumOn = cfg.accumulate > 0;
      // Snow piles on surfaces (see accumulation.ts); petals carpet the
      // ground where they fall. Two different things, two code paths.
      const pileMode: 'bank' | 'carpet' | 'none' = !accumOn ? 'none' : kind === 'snow' ? 'bank' : 'carpet';
      const bank = new SnowBank();
      bank.resize(W());
      // The scroll's top rod is a surface too. Its position is layout, read at
      // 8Hz off the hot path — never inside the per-particle loop.
      let rodClock = 0;
      const updateRod = () => {
        const el = document.querySelector('.viewer-content');
        if (!el) { bank.setRod(null); return; }
        const r = el.getBoundingClientRect();
        const y = r.top - 8;                        // the rod's top edge: 8px proud of the silk
        if (y < 2 || y > H() - 30) { bank.setRod(null); return; }
        bank.setRod({ x0: r.left - 14 + 9, x1: r.right + 14 - 9, y });
      };
      let bankFrame = 0;

      const onResize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        camera.left = -window.innerWidth / 2;
        camera.right = window.innerWidth / 2;
        camera.top = window.innerHeight / 2;
        camera.bottom = -window.innerHeight / 2;
        camera.updateProjectionMatrix();
        // Resizing the accumulation canvas clears it (browser behavior).
        // The snow bank is a heightfield, not pixels, so it survives.
        setAccumSize();
        bank.resize(W());
      };
      window.addEventListener('resize', onResize);

      // ── Main loop ─────────────────────────────────────────────────
      const wind = makeWindField();
      let last = performance.now();
      let raf = 0;

      // Gusts. The wind field gives texture; it does not give weather. A
      // gust is a coherent event: it builds over a second or two, holds,
      // and dies away, and while it is on the whole field leans the same
      // way. That is what makes snow read as WEATHER rather than a
      // particle field — you can see one coming across the frame.
      let gust = 0, gustTarget = 0, gustDir = 1, gustClock = 0, gustWait = 6 + Math.random() * 8;
      const stepGust = (dt: number) => {
        gustClock += dt;
        if (gustTarget === 0 && gustClock > gustWait) {
          gustTarget = 0.6 + Math.random() * 0.4;
          gustDir = Math.random() < 0.5 ? -1 : 1;
          gustClock = 0;
          gustWait = 2.5 + Math.random() * 3.5;       // how long it blows
        } else if (gustTarget > 0 && gustClock > gustWait) {
          gustTarget = 0;
          gustClock = 0;
          gustWait = 7 + Math.random() * 12;          // calm before the next
        }
        gust += (gustTarget - gust) * Math.min(1, dt * (gustTarget > 0 ? 0.9 : 0.5));
      };

      // Scroll parallax. The reader's scroll is a camera move: when the page
      // goes up, what is close to the lens goes up more than what is far.
      // Without this the flakes are a sheet of glass in front of the page.
      let lastScrollY = window.scrollY;
      // Cap the particle simulation to ~30fps. Each tick runs a full CPU
      // physics pass, a full-screen accumulation fade, AND re-uploads every
      // particle buffer to the GPU — at 60fps that alone can swamp an
      // integrated GPU and make the whole UI (scroll, hover) feel laggy.
      // Ambient snow/dust reads fine at 30fps — motion is dt-based so the
      // speed is identical — and this halves the cost, handing the frame
      // budget back to the actual interface.
      // 60fps. This was 30 on the theory that halving the sim saved the
      // frame budget; profiled, the whole particle draw is 0.06–0.13ms and
      // the sim under a millisecond, and 30fps is exactly the stutter that
      // reads as "screensaver" — a falling flake stepping instead of
      // gliding. A 120Hz display still renders every other frame.
      const MIN_FRAME_MS = 15;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const now = performance.now();
        if (now - last < MIN_FRAME_MS) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const tSec = now / 1000;

        const dragFactor = Math.exp(-cfg.drag * dt);
        stepGust(dt);
        const scrollDelta = window.scrollY - lastScrollY;
        lastScrollY = window.scrollY;
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
          // A gust leans on everything, the near layer hardest, and lifts a
          // little: snow in a gust goes sideways and slightly UP.
          if (gust > 0.01) {
            vx[i] += gustDir * gust * 70 * speedScale * dt;
            vy[i] += gust * 18 * speedScale * dt;
          }
          // Flutter. A petal is a sail: it does not fall, it see-saws down,
          // sliding sideways one way then the other as it tips, and its spin
          // follows the tip. Each has its own phase and rate.
          if (cfg.rotates) {
            const ph = i * 1.7 + tSec * (1.4 + (i % 7) * 0.13);
            vx[i] += Math.sin(ph) * 28 * dt;
            vy[i] += Math.max(0, Math.cos(ph * 0.5)) * 9 * dt;
            rotV[i] = Math.cos(ph) * 1.6;
          }
          // Camera move: parallax with the reader's scroll.
          if (scrollDelta !== 0) positions[ix + 1] += scrollDelta * (0.10 + d * 0.55);

          // Gravity (positive = down → reduces y). Also depth-scaled.
          vy[i] -= cfg.gravity * speedScale * dt;

          // Drag.
          vx[i] *= dragFactor;
          vy[i] *= dragFactor;

          // Terminal velocity — clamp |v| so gravity doesn't keep
          // accumulating into a streak. Real particles reach a max
          // fall speed (air resistance = gravity), then hold.
          const speed = Math.hypot(vx[i], vy[i]);
          const vTerm = cfg.terminalV * (0.5 + d * 0.5);
          if (speed > vTerm) {
            const s = vTerm / speed;
            vx[i] *= s;
            vy[i] *= s;
          }

          // Integrate.
          positions[ix] = px + vx[i] * dt;
          positions[ix + 1] = py + vy[i] * dt;
          // Motion blur. A fast particle close to the lens smears along its
          // path within the exposure; a far one does not. Elongation is
          // therefore speed × nearness, and the sprite is turned so its long
          // axis lies along the velocity. Kinds that tumble (petals) keep
          // their own spin — a petal does not streak, it flutters.
          const near = 0.25 + d * 0.75;
          const stretch = Math.min(2.4, 1 + (speed / vTerm) * cfg.stretch * near);
          stretchAttr[i] = stretch;
          if (cfg.rotates) rotations[i] += rotV[i] * dt;
          else rotations[i] = Math.atan2(vy[i], vx[i]);
          // The quad is square, so it grows by the stretch on both axes and the
          // shader squeezes the sprite back down across the short axis.
          sizes[i] = (cfg.baseSize + (depth[i] * cfg.sizeJitter)) * (0.35 + depth[i] * 0.65) * stretch;

          // Life + alpha + per-particle alpha jitter + depth dim.
          life[i] -= dt;
          const lm = lifeMax[i];
          const u = life[i] / lm;
          const fade = u < 0.85 ? Math.min(1, u / 0.2) : (1 - u) / 0.15;
          const depthAlpha = 0.45 + d * 0.55;
          alphas[i] = Math.max(0, Math.min(1, fade * depthAlpha * alphaBase[i]));

          // Landing. Screen space: x from the left, y from the top.
          let settled = false;
          if (pileMode !== 'none') {
            const sx = positions[ix] + W() / 2;
            const sy = H() / 2 - positions[ix + 1];
            const syPrev = H() / 2 - py;
            const restSize = (cfg.baseSize + depth[i] * cfg.sizeJitter) * (0.35 + depth[i] * 0.65);
            if (pileMode === 'bank') {
              // A flake stops where the pile already is, so the drift grows
              // under the fall instead of flakes vanishing into a line.
              // The scroll hangs at one depth. Flakes nearer than it pass in
              // front, farther ones behind; only the band at its depth can
              // land on the rod. Without this the rod, sitting at the top of
              // the viewport, caught every flake over the column the moment
              // it entered the frame, and the snowfall over the page died.
              const rodH = d > 0.28 && d < 0.5 ? bank.rodHeightAt(sx) : -1;
              if (rodH >= 0) {
                const rodSurface = bank.rodTop - rodH;
                if (syPrev < rodSurface && sy >= rodSurface && vy[i] < 0) {
                  bank.deposit(sx, restSize, 'rod');
                  settled = true;
                }
              }
              if (!settled) {
                const groundSurface = H() - bank.groundHeightAt(sx);
                if (sy >= groundSurface - 1) {
                  bank.deposit(sx, restSize, 'ground');
                  settled = true;
                }
              }
            } else if (sy >= H() - 4 - Math.random() * 26) {
              // Petals come to rest in a shallow band along the bottom; a
              // few land on the rod as well.
              const rodH = bank.rodHeightAt(sx);
              const y = rodH >= 0 && Math.random() < 0.08 ? bank.rodTop + 2 : H() - 2 - Math.random() * 22;
              accumCtx.save();
              accumCtx.scale(accumDpr, accumDpr);
              accumCtx.globalCompositeOperation = 'source-over';
              stampPetal(accumCtx, spriteCanvas, sx, y, restSize, cfg.accumulate * alphaBase[i]);
              accumCtx.restore();
              settled = true;
            }
          }

          // Respawn if life expired OR offscreen OR just settled.
          const offX = positions[ix] < -W() * 0.6 || positions[ix] > W() * 0.6;
          const offY = positions[ix + 1] < -H() * 0.7 || positions[ix + 1] > H() * 0.7;
          if (life[i] <= 0 || offX || offY || settled) respawn(i, false);
        }

        if (pileMode === 'bank') {
          rodClock += dt;
          if (rodClock > 0.125) { rodClock = 0; updateRod(); }
          bank.step(dt);
          // The drift is redrawn from the heightfield, not accumulated as
          // pixels, so it can be drawn at a third of the sim rate with no
          // loss: nothing on it moves faster than the pile grows.
          if ((bankFrame++ % 3) === 0) {
            accumCtx.save();
            accumCtx.setTransform(accumDpr, 0, 0, accumDpr, 0, 0);
            bank.render(accumCtx, W(), H());
            accumCtx.restore();
          }
        } else if (pileMode === 'carpet' && cfg.accumulateFadePerSec > 0) {
          // The carpet thins over minutes rather than piling into a floor.
          const fadeAlpha = cfg.accumulateFadePerSec * dt;
          accumCtx.globalCompositeOperation = 'destination-out';
          accumCtx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
          accumCtx.fillRect(0, 0, accumCanvas.width, accumCanvas.height);
          accumCtx.globalCompositeOperation = 'source-over';
        }

        // Mark attributes for GPU upload.
        geom.attributes.position.needsUpdate = true;
        geom.attributes.size.needsUpdate = true;
        geom.attributes.rotation.needsUpdate = true;
        geom.attributes.alpha.needsUpdate = true;
        geom.attributes.depth.needsUpdate = true;
        geom.attributes.stretch.needsUpdate = true;

        renderer.render(scene, camera);
        // NOTE: no requestAnimationFrame here — the top of tick() already
        // scheduled the next frame. Scheduling in both places grew the
        // pending-callback set by one per rendered frame (unbounded rAF
        // accumulation, and orphan callbacks surviving teardown to render
        // on a disposed renderer).
      };
      raf = requestAnimationFrame(tick);

      // Pause the simulation when the tab is hidden. `last` is reset on
      // resume so the first dt after returning isn't a multi-second
      // jump (it's also clamped to 0.05 in tick, belt + suspenders).
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
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVis);
        if (raf) cancelAnimationFrame(raf);
        accumCanvas.remove();
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
