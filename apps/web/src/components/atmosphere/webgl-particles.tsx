// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from 'react';
import { Bank, DUST_LOOK, SNOW_LOOK, Shafts, Surf, stampFlat } from './accumulation';
import type { ParticleKind } from './atmospheres';

interface WebGLParticlesProps {
  kind: Exclude<ParticleKind, 'none'>;
}

/**
 * GPU particle system — Three.js Points with a custom shader.
 *
 * State lives in JS Float32 arrays and uploads to a single VBO per frame.
 * Render is one gl.POINTS draw call with a per-atmosphere sprite atlas
 * (drawn once on an offscreen canvas). Each atmosphere is one or two
 * POPULATIONS sharing the buffers — mist and droplets, dust and chaff —
 * each with its own physics and its own cell in the atlas.
 *
 * What the particles leave behind (the drift, the litter, the sea's edge)
 * and the light they fall through live in accumulation.ts and are drawn on
 * a Canvas2D layer under the points.
 *
 * Per-atmosphere:
 *   petals — fall like sails, see-sawing; carpet the ground and the rod
 *   snow   — falls steady, gusts, and PILES: a heightfield on the ground
 *            and a ridge on the scroll's rod
 *   spray  — the sea breaks at the foot of the scroll every ten seconds or
 *            so: a burst of droplets and mist runs along the crest, the
 *            wash runs up and back, foam is left and dissolves
 *   motes  — dust and chaff in shafts of afternoon light; the dust glows
 *            only inside the beams, the chaff sinks and litters the floor
 */

export interface Population {
  sprite: (ctx: CanvasRenderingContext2D, size: number) => void;
  gravity: number;          // px/s² (positive = down)
  drag: number;             // velocity damping per second
  terminalV: number;        // px/s cap on |velocity| — gravity stops accumulating past this
  stretch: number;          // motion-blur stretch multiplier — sprite grows along travel when fast (0=off)
  baseSize: number;         // base point size in px
  sizeJitter: number;       // ± px
  lifeMin: number;          // seconds
  lifeMax: number;
  windStrength: number;     // multiplier on the global wind vector
  alpha: number;            // multiplier on the per-particle alpha
  // spawn behavior. 'parked' populations are not respawned on death: they
  // wait, invisible, for an event (a wave breaking) to emit them.
  spawnFrom: 'top' | 'bottom-band' | 'parked';
  initialVy: () => number;  // starting vertical velocity, +up
  initialVx: () => number;  // starting horizontal velocity
  rotates: boolean;         // tumbles with its own spin, rather than aligning to its velocity
  flutter: number;          // see-saw amplitude for things that fall like sails (0=off)
}

export interface KindConfig {
  count: number;
  spriteSize: number;       // canvas px per atlas cell
  populations: Population[];   // index = atlas cell
  share: number;            // fraction of `count` in populations[1]
  // What lands where. 'bank': a heightfield the particles pile on (snow).
  // 'carpet': stamped flat where they fall, faded slowly (petals). 'surf':
  // the sea's edge, droplets splash on it. 'field': a dust film plus a
  // litter of what fell, under light shafts.
  pile: 'bank' | 'carpet' | 'surf' | 'field';
  carpetAlpha: number;      // stamp alpha for carpet/field litter
  carpetFadePerSec: number; // per-second decay of the litter
}

// ── Sprites ─────────────────────────────────────────────────────────────
//
// Real snow / petals / water droplets are OPAQUE shapes with sharp edges
// and just a hint of anti-aliasing. Each drawer renders a solid form with a
// minimal feather. The exceptions glow because the real thing glows: dust
// in a sunbeam, mist against the light.

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
  // A water droplet in the air: a lens. Dark rim where it refracts the
  // sea behind it, bright body, a hard specular where it catches the sky.
  ctx.beginPath();
  ctx.ellipse(cx, cy, s * 0.30, s * 0.36, 0, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(cx - s * 0.06, cy - s * 0.08, s * 0.04, cx, cy, s * 0.36);
  grad.addColorStop(0, 'rgba(250, 253, 255, 1)');
  grad.addColorStop(0.55, 'rgba(206, 230, 244, 1)');
  grad.addColorStop(0.88, 'rgba(150, 190, 216, 1)');
  grad.addColorStop(1, 'rgba(96, 136, 168, 1)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.09, cy - s * 0.13, s * 0.07, s * 0.045, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fill();
};

const drawMist = (ctx: CanvasRenderingContext2D, s: number) => {
  ctx.clearRect(0, 0, s, s);
  const cx = s / 2, cy = s / 2;
  // Spindrift: too small to be a droplet, it is a soft point of scattered
  // light with no edge at all.
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.46);
  grad.addColorStop(0, 'rgba(236, 246, 252, 0.9)');
  grad.addColorStop(0.4, 'rgba(226, 240, 248, 0.5)');
  grad.addColorStop(1, 'rgba(220, 236, 246, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.46, 0, Math.PI * 2);
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

const drawChaff = (ctx: CanvasRenderingContext2D, s: number) => {
  ctx.clearRect(0, 0, s, s);
  const cx = s / 2, cy = s / 2;
  // A husk off the wheat: a slender, slightly bowed blade, straw-coloured,
  // darker along one edge, with a pale midrib. Opaque; it is a solid thing.
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.42, cy + s * 0.02);
  ctx.quadraticCurveTo(cx - s * 0.05, cy - s * 0.16, cx + s * 0.42, cy - s * 0.05);
  ctx.quadraticCurveTo(cx + s * 0.02, cy + s * 0.12, cx - s * 0.42, cy + s * 0.02);
  ctx.closePath();
  const grad = ctx.createLinearGradient(cx, cy - s * 0.14, cx, cy + s * 0.12);
  grad.addColorStop(0, 'rgba(238, 214, 150, 1)');
  grad.addColorStop(0.55, 'rgba(214, 178, 104, 1)');
  grad.addColorStop(1, 'rgba(150, 112, 52, 1)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(250, 236, 190, 0.7)';
  ctx.lineWidth = Math.max(0.6, s * 0.02);
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.38, cy + s * 0.01);
  ctx.quadraticCurveTo(cx - s * 0.04, cy - s * 0.09, cx + s * 0.36, cy - s * 0.04);
  ctx.stroke();
};

const pop = (p: Partial<Population> & Pick<Population, 'sprite'>): Population => ({
  gravity: 0, drag: 0.05, terminalV: 60, stretch: 0, baseSize: 3, sizeJitter: 4,
  lifeMin: 10, lifeMax: 20, windStrength: 0.5, alpha: 1, spawnFrom: 'top',
  initialVy: () => 0, initialVx: () => 0, rotates: false, flutter: 0,
  ...p,
});

export const CFG: Record<Exclude<ParticleKind, 'none'>, KindConfig> = {
  petals: {
    // Cherry-blossom flurries IRL are sparse — a few dozen visible at a
    // time, not hundreds. Big size variance so a couple of large petals
    // dominate against many small distant ones.
    count: 700,
    spriteSize: 96,
    share: 0,
    pile: 'carpet',
    carpetAlpha: 0.85,
    carpetFadePerSec: 0.018,  // ~55 s half-life
    populations: [pop({
      sprite: drawPetal,
      gravity: 9,
      drag: 0.04,
      terminalV: 52,        // cherry blossom petals fall slow — ~50 px/s max
      stretch: 0.05,        // barely any stretch — petals tumble, don't streak
      baseSize: 10,
      sizeJitter: 18,        // 10–28px — strong size variance
      // A petal at ~30px/s needs ~25s to cross the viewport; shorter lives
      // timed out in the air and nothing reached the ground to carpet it.
      lifeMin: 38,
      lifeMax: 58,
      windStrength: 0.95,
      spawnFrom: 'top',
      initialVy: () => -(4 + Math.random() * 10),
      initialVx: () => (Math.random() - 0.5) * 14,
      rotates: true,
      flutter: 1,
    })],
  },
  snow: {
    // Snowfall density tuned to "calm flurry," not blizzard. Most flakes
    // are tiny (3-6px) with occasional larger ones (up to 11px).
    count: 1400,
    spriteSize: 64,
    share: 0,
    pile: 'bank',
    carpetAlpha: 0,
    carpetFadePerSec: 0,
    populations: [pop({
      sprite: drawSnow,
      gravity: 14,
      drag: 0.06,
      terminalV: 80,        // snow falls steady; gusts can push past briefly
      stretch: 0.85,        // near flakes on a gust streak visibly; far ones barely
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
      initialVy: () => -(10 + Math.random() * 18),
      initialVx: () => (Math.random() - 0.5) * 4,
    })],
  },
  spray: {
    // The sea. Nothing here spawns on its own: a break emits a burst of
    // droplets and a cloud of spindrift along the crest, and between breaks
    // there is only a thin trickle of mist off the swash.
    count: 1500,
    spriteSize: 64,
    share: 0.3,
    pile: 'surf',
    carpetAlpha: 0,
    carpetFadePerSec: 0,
    populations: [
      pop({
        // Spindrift: near-weightless, carried by the wind, gone in seconds.
        sprite: drawMist,
        gravity: 5,
        drag: 0.55,
        terminalV: 110,
        baseSize: 6,
        sizeJitter: 16,
        lifeMin: 2.6,
        lifeMax: 6,
        windStrength: 1.4,
        alpha: 0.7,
        spawnFrom: 'parked',
      }),
      pop({
        // Droplets: heavy, fast, streak when airborne, arc and come down.
        sprite: drawSpray,
        gravity: 240,
        drag: 0.14,
        terminalV: 460,
        stretch: 0.6,
        baseSize: 3.5,
        sizeJitter: 11,
        lifeMin: 2.4,
        lifeMax: 3.4,
        windStrength: 0.3,
        spawnFrom: 'parked',
      }),
    ],
  },
  motes: {
    // Dust in sunlight, and the chaff it came off. The dust rises on warm
    // air and is only seen inside a beam; the chaff is heavier, tumbles
    // down like a petal, and litters the floor and the rod.
    count: 1300,
    spriteSize: 64,
    share: 0.25,
    pile: 'field',
    carpetAlpha: 0.7,
    carpetFadePerSec: 0.006,  // ~2 min half-life
    populations: [
      pop({
        sprite: drawMote,
        gravity: -5,
        drag: 0.10,
        terminalV: 24,        // motes drift slow, never streak
        baseSize: 5,
        sizeJitter: 10,
        lifeMin: 22,
        lifeMax: 38,
        windStrength: 0.35,
        spawnFrom: 'bottom-band',
        initialVy: () => 6 + Math.random() * 10,
        initialVx: () => (Math.random() - 0.5) * 6,
      }),
      pop({
        sprite: drawChaff,
        gravity: 7,
        drag: 0.05,
        terminalV: 30,
        baseSize: 7,
        sizeJitter: 13,
        lifeMin: 34,
        lifeMax: 54,
        windStrength: 1.2,
        spawnFrom: 'top',
        initialVy: () => -(4 + Math.random() * 8),
        initialVx: () => (Math.random() - 0.5) * 20,
        rotates: true,
        flutter: 0.7,
      }),
    ],
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
    const pops = cfg.populations;
    const cells = pops.length;

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

      // Sprite atlas — one cell per population, drawn once on an offscreen
      // canvas. The shader picks the cell from a per-particle attribute.
      const spriteCanvas = document.createElement('canvas');
      // The atlas stays SQUARE. A 128×64 canvas uploaded as a mipmapped
      // texture came back incomplete (every sample transparent, no error
      // logged) and the whole population vanished; with a square atlas the
      // mip chain is well-formed. Cells sit in the top row.
      const grid = cells > 1 ? 2 : 1;
      spriteCanvas.width = cfg.spriteSize * grid;
      spriteCanvas.height = cfg.spriteSize * grid;
      const sctx = spriteCanvas.getContext('2d')!;
      for (let c = 0; c < cells; c++) {
        sctx.save();
        sctx.translate(c * cfg.spriteSize, 0);
        pops[c].sprite(sctx, cfg.spriteSize);
        sctx.restore();
      }
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
      const cellAttr = new Float32Array(count);  // atlas cell = population

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
      const popOf = new Uint8Array(count);
      const parked = new Uint8Array(count);
      const parkedStack: number[][] = pops.map(() => []);

      const W = () => window.innerWidth;
      const H = () => window.innerHeight;

      for (let i = 0; i < count; i++) {
        popOf[i] = i < count * (1 - cfg.share) ? 0 : 1;
        cellAttr[i] = popOf[i];
      }

      const park = (i: number) => {
        parked[i] = 1;
        alphas[i] = 0;
        life[i] = 0;
        positions[i * 3 + 1] = -H() * 3;   // off-screen; the GPU clips it
        parkedStack[popOf[i]].push(i);
      };

      // Give a particle its body: depth, size, spin, alpha, life. Position
      // and velocity are the caller's.
      const embody = (i: number, P: Population, staggered: boolean) => {
        positions[i * 3 + 2] = 0;
        // Depth — squared distribution so most particles are "far" and
        // a few are "near" (matches what you see looking through real air).
        const u = Math.random();
        depth[i] = u * u;
        depthAttr[i] = depth[i];
        // Per-particle size scales with depth: near = base + jitter,
        // far = base * 0.35. Gives real depth-of-field rather than a
        // flat curtain of identical specks.
        const dScale = 0.35 + depth[i] * 0.65;
        sizes[i] = (P.baseSize + Math.random() * P.sizeJitter) * dScale;
        rotations[i] = Math.random() * Math.PI * 2;
        rotV[i] = P.rotates ? (Math.random() - 0.5) * 1.8 : 0;
        // Per-particle alpha jitter — some flakes/petals are barely
        // there, others fully opaque. Real snow visibly has both.
        alphaBase[i] = (0.55 + Math.random() * 0.45) * P.alpha;
        const lm = P.lifeMin + Math.random() * (P.lifeMax - P.lifeMin);
        lifeMax[i] = lm;
        life[i] = staggered ? Math.random() * lm : lm;
        parked[i] = 0;
      };

      // Spawn / respawn a particle. If `staggered`, distribute life so
      // initial particles aren't all "just born" at t=0.
      const respawn = (i: number, staggered = false) => {
        const P = pops[popOf[i]];
        switch (P.spawnFrom) {
          case 'top':
            positions[i * 3] = (Math.random() - 0.5) * W() * 1.1;
            positions[i * 3 + 1] = H() / 2 + Math.random() * 40;
            break;
          case 'bottom-band':
            positions[i * 3] = (Math.random() - 0.5) * W() * 0.85;
            positions[i * 3 + 1] = -H() * (0.10 + Math.random() * 0.30);
            break;
          case 'parked':
            park(i);
            return;
        }
        vx[i] = P.initialVx();
        vy[i] = P.initialVy();
        embody(i, P, staggered);
      };

      // Emit a parked particle at a screen-space point with a velocity.
      const emit = (popIdx: number, sx: number, sy: number, evx: number, evy: number): boolean => {
        const i = parkedStack[popIdx].pop();
        if (i === undefined) return false;
        positions[i * 3] = sx - W() / 2;
        positions[i * 3 + 1] = H() / 2 - sy;
        vx[i] = evx;
        vy[i] = evy;
        embody(i, pops[popIdx], false);
        // The sea is at the foot of the scroll, in the foreground: what it
        // throws up is near the lens, not spread through the whole depth.
        depth[i] = 0.2 + Math.random() * 0.8;
        depthAttr[i] = depth[i];
        return true;
      };

      for (let i = 0; i < count; i++) respawn(i, true);

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
      geom.setAttribute('rotation', new THREE.BufferAttribute(rotations, 1));
      geom.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
      geom.setAttribute('depth', new THREE.BufferAttribute(depthAttr, 1));
      geom.setAttribute('stretch', new THREE.BufferAttribute(stretchAttr, 1));
      geom.setAttribute('cell', new THREE.BufferAttribute(cellAttr, 1));

      const material = new THREE.ShaderMaterial({
        uniforms: {
          uSprite:  { value: spriteTex },
          uDpr:     { value: dpr },
          uGrid:    { value: cells > 1 ? 2 : 1 },
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
          attribute float cell;
          varying float vAlpha;
          varying float vRotation;
          varying float vDepth;
          varying float vStretch;
          varying float vCell;
          uniform float uDpr;
          void main() {
            vAlpha = alpha;
            vRotation = rotation;
            vDepth = depth;
            vStretch = stretch;
            vCell = cell;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = size * uDpr;
          }
        `,
        fragmentShader: `
          precision mediump float;
          uniform sampler2D uSprite;
          uniform float uBokeh;
          uniform float uGrid;
          varying float vAlpha;
          varying float vRotation;
          varying float vDepth;
          varying float vStretch;
          varying float vCell;
          void main() {
            if (vAlpha <= 0.002) discard;
            // Into the sprite's own frame: rotate so x runs along the
            // velocity, then squeeze the short axis by the stretch so the
            // disc is left long along the path — a streak, not a dot.
            vec2 uv = gl_PointCoord - 0.5;
            float c = cos(vRotation), s = sin(vRotation);
            uv = mat2(c, -s, s, c) * uv;
            uv.y *= vStretch;
            uv += 0.5;
            if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
            // Into the atlas: cell vCell of the top row of a uGrid×uGrid grid
            // (the canvas is uploaded flipped, so the top row is the high v).
            uv = (uv + vec2(vCell, uGrid - 1.0)) / uGrid;
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
      // Never cull. Three computes the bounding sphere once, from the first
      // frame's positions; a population that starts parked off-screen gets a
      // sphere of radius zero out past the bottom edge and the whole draw is
      // skipped for good, no matter where the particles go afterwards.
      points.frustumCulled = false;
      scene.add(points);

      // ── Accumulation Canvas2D layer ────────────────────────────────
      // What the particles leave behind, and (for the fields) the light
      // they fall through. Sits BELOW the WebGL particles canvas.
      const accumCanvas = document.createElement('canvas');
      accumCanvas.className = 'mv-accumulation';
      accumCanvas.setAttribute('aria-hidden', 'true');
      Object.assign(accumCanvas.style, {
        position: 'absolute',
        inset: '0',
        pointerEvents: 'none',
        zIndex: '1',
      });
      const accumDpr = Math.min(window.devicePixelRatio || 1, 1.5);
      // Litter — things lying where they fell — persists between frames on
      // its own canvas, because the surface under it is redrawn every frame.
      const litterCanvas = document.createElement('canvas');
      const litterCtx = litterCanvas.getContext('2d')!;
      const setAccumSize = () => {
        for (const c of [accumCanvas, litterCanvas]) {
          c.width = window.innerWidth * accumDpr;
          c.height = window.innerHeight * accumDpr;
        }
        accumCanvas.style.width = `${window.innerWidth}px`;
        accumCanvas.style.height = `${window.innerHeight}px`;
      };
      setAccumSize();
      canvas.parentElement?.insertBefore(accumCanvas, canvas);
      const accumCtx = accumCanvas.getContext('2d')!;
      const pile = cfg.pile;
      const bank = new Bank(pile === 'field' ? DUST_LOOK : SNOW_LOOK);
      bank.resize(W());
      const surf = new Surf();
      surf.resize(W());
      const shafts = new Shafts();
      shafts.resize(W(), H());
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
      // The litter is stamped with the live sprite, so what lies on the floor
      // is the same thing that fell.
      const stampLitter = (ctx: CanvasRenderingContext2D, i: number, sx: number, sy: number, size: number) => {
        ctx.save();
        ctx.scale(accumDpr, accumDpr);
        ctx.globalCompositeOperation = 'source-over';
        stampFlat(ctx, spriteCanvas, popOf[i], grid, sx, sy, size, cfg.carpetAlpha * alphaBase[i]);
        ctx.restore();
      };

      // A blossom scene does not start with a bare floor: petals have been
      // falling all morning. Seed the carpet, and a few on the rod, once.
      let carpetSeeded = false;
      const seedCarpet = () => {
        if (carpetSeeded || pile !== 'carpet') return;
        carpetSeeded = true;
        const P = pops[0];
        const seed = (sx: number, sy: number) => {
          const d = Math.random() ** 2;
          const size = (P.baseSize + d * P.sizeJitter) * (0.35 + d * 0.65);
          accumCtx.save();
          accumCtx.scale(accumDpr, accumDpr);
          stampFlat(accumCtx, spriteCanvas, 0, grid, sx, sy, size, cfg.carpetAlpha * (0.5 + Math.random() * 0.5));
          accumCtx.restore();
        };
        for (let k = 0; k < 90; k++) seed(Math.random() * W(), H() - 2 - Math.random() * 24);
        if (bank.rodTop >= 0) {
          const el = document.querySelector('.viewer-content');
          const r = el?.getBoundingClientRect();
          if (r) for (let k = 0; k < 9; k++) seed(r.left + Math.random() * r.width, bank.rodTop - 4);
        }
      };

      const onResize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        camera.left = -window.innerWidth / 2;
        camera.right = window.innerWidth / 2;
        camera.top = window.innerHeight / 2;
        camera.bottom = -window.innerHeight / 2;
        camera.updateProjectionMatrix();
        // Resizing the accumulation canvas clears it (browser behavior).
        // The heightfields survive; the litter does not.
        setAccumSize();
        bank.resize(W());
        surf.resize(W());
        shafts.resize(W(), H());
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

      // The sea. A swell arrives every nine seconds or so (the audio's
      // breath is 0.11 Hz) and breaks: the break RUNS along the crest, left
      // to right or right to left, over a second and a half, and everything
      // it throws up is thrown from where the crest is now. Foam is left
      // along its path; the wash follows it up the sand.
      let swellWait = 2.5 + Math.random() * 2;
      let breaking = false, breakT = 0, breakDur = 1.6, breakX0 = 0, breakX1 = 0, breakStrength = 0, breakDir = 1;
      let mistBudget = 0, dropBudget = 0;
      const emitMist = (sx: number, sy: number, spread: number, up: number) => {
        emit(0, sx, sy, (Math.random() - 0.5) * spread, up * (0.4 + Math.random() * 0.6));
      };
      const stepSea = (dt: number) => {
        const w = W(), h = H();
        if (!breaking) {
          swellWait -= dt;
          if (swellWait <= 0) {
            breaking = true;
            breakT = 0;
            breakStrength = 0.45 + Math.random() * 0.55;
            breakDir = Math.random() < 0.5 ? -1 : 1;
            const span = w * (0.22 + Math.random() * 0.36 * breakStrength);
            const start = Math.random() * (w - span);
            breakX0 = breakDir > 0 ? start : start + span;
            breakX1 = breakDir > 0 ? start + span : start;
            breakDur = 1.2 + span / w * 1.4;
            surf.break(breakStrength, breakDir);
          }
        } else {
          breakT += dt;
          const u = Math.min(1, breakT / breakDur);
          const env = Math.sin(u * Math.PI);
          const crest = breakX0 + (breakX1 - breakX0) * u;
          // The crest is moving at hundreds of px/s, so any one cell is under
          // it for a few frames only; the rate is high so those frames leave
          // a visible bank, and the cap keeps it from becoming a wall.
          surf.depositFoam(crest + (Math.random() - 0.5) * 50, 260 * breakStrength * env * dt);
          // Droplets fan up and forward from the crest; mist boils off it.
          dropBudget += 420 * breakStrength * env * dt;
          mistBudget += 2000 * breakStrength * env * dt;
          const lift = 150 + 230 * breakStrength;
          while (dropBudget >= 1) {
            dropBudget -= 1;
            const sx = crest + (Math.random() - 0.5) * 90;
            const sy = h - 4 - Math.random() * 22;
            const a = (Math.random() - 0.5) * 1.1 + breakDir * 0.25;   // radians off vertical
            const v = lift * (0.45 + Math.random() * 0.75);
            if (!emit(1, sx, sy, Math.sin(a) * v, Math.cos(a) * v)) break;
          }
          while (mistBudget >= 1) {
            mistBudget -= 1;
            emitMist(crest + (Math.random() - 0.5) * 160, h - 2 - Math.random() * 30, 140, 40 + 120 * breakStrength);
          }
          if (breakT >= breakDur) {
            breaking = false;
            swellWait = 5.5 + Math.random() * 6;
          }
        }
        // Between breaks: the swash breathes a little mist, and throws the
        // odd droplet.
        mistBudget += 26 * dt;
        dropBudget += 3 * dt;
        while (mistBudget >= 1) {
          mistBudget -= 1;
          emitMist(Math.random() * w, h - 2 - Math.random() * 12, 40, 30);
        }
        while (dropBudget >= 1) {
          dropBudget -= 1;
          const sx = Math.random() * w;
          if (!emit(1, sx, h - 4, (Math.random() - 0.5) * 60, 80 + Math.random() * 120)) break;
        }
      };

      // Scroll parallax. The reader's scroll is a camera move: when the page
      // goes up, what is close to the lens goes up more than what is far.
      // Without this the flakes are a sheet of glass in front of the page.
      let lastScrollY = window.scrollY;
      // 60fps. Profiled, the whole particle draw is 0.06–0.13ms and the sim
      // under a millisecond; 30fps is exactly the stutter that reads as
      // "screensaver" — a falling flake stepping instead of gliding. A
      // 120Hz display still renders every other frame.
      const MIN_FRAME_MS = 15;
      const dragFactors = new Float32Array(cells);
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const now = performance.now();
        if (now - last < MIN_FRAME_MS) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const tSec = now / 1000;
        const w = W(), h = H();

        for (let c = 0; c < cells; c++) dragFactors[c] = Math.exp(-pops[c].drag * dt);
        stepGust(dt);
        if (pile === 'surf') stepSea(dt);
        if (pile === 'field') shafts.prepare(tSec);
        const scrollDelta = window.scrollY - lastScrollY;
        lastScrollY = window.scrollY;
        for (let i = 0; i < count; i++) {
          if (parked[i]) continue;
          const ix = i * 3;
          const P = pops[popOf[i]];
          // Position in centered coords.
          const px = positions[ix];
          const py = positions[ix + 1];
          // Depth scale — far particles move slower, fall slower, dim.
          const d = depth[i];
          const speedScale = 0.4 + d * 0.6;

          // Curl-noise wind. Far particles get less of the wind so
          // distant snow doesn't whip around like nearby snow.
          const [wx, wy] = wind(px + w / 2, h / 2 - py, tSec);
          vx[i] += wx * P.windStrength * speedScale * dt;
          vy[i] += wy * P.windStrength * speedScale * dt;
          // A gust leans on everything, the near layer hardest, and lifts a
          // little: snow in a gust goes sideways and slightly UP.
          if (gust > 0.01) {
            vx[i] += gustDir * gust * 70 * P.windStrength * speedScale * dt;
            vy[i] += gust * 18 * P.windStrength * speedScale * dt;
          }
          // Flutter. A petal is a sail: it does not fall, it see-saws down,
          // sliding sideways one way then the other as it tips, and its spin
          // follows the tip. Each has its own phase and rate.
          if (P.flutter > 0) {
            const ph = i * 1.7 + tSec * (1.4 + (i % 7) * 0.13);
            vx[i] += Math.sin(ph) * 28 * P.flutter * dt;
            vy[i] += Math.max(0, Math.cos(ph * 0.5)) * 9 * P.flutter * dt;
            rotV[i] = Math.cos(ph) * 1.6;
          }
          // Camera move: parallax with the reader's scroll.
          if (scrollDelta !== 0) positions[ix + 1] += scrollDelta * (0.10 + d * 0.55);

          // Gravity (positive = down → reduces y). Also depth-scaled.
          vy[i] -= P.gravity * speedScale * dt;

          // Drag.
          const dragFactor = dragFactors[popOf[i]];
          vx[i] *= dragFactor;
          vy[i] *= dragFactor;

          // Terminal velocity — clamp |v| so gravity doesn't keep
          // accumulating into a streak. Real particles reach a max
          // fall speed (air resistance = gravity), then hold.
          const speed = Math.hypot(vx[i], vy[i]);
          const vTerm = P.terminalV * (0.5 + d * 0.5);
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
          const stretch = Math.min(2.4, 1 + (speed / vTerm) * P.stretch * near);
          stretchAttr[i] = stretch;
          if (P.rotates) rotations[i] += rotV[i] * dt;
          else rotations[i] = Math.atan2(vy[i], vx[i]);
          // The quad is square, so it grows by the stretch on both axes and the
          // shader squeezes the sprite back down across the short axis.
          const restSize = (P.baseSize + d * P.sizeJitter) * (0.35 + d * 0.65);
          sizes[i] = restSize * stretch;

          // Life + alpha + per-particle alpha jitter + depth dim.
          life[i] -= dt;
          const lm = lifeMax[i];
          const u = life[i] / lm;
          const fade = u < 0.85 ? Math.min(1, u / 0.2) : (1 - u) / 0.15;
          const depthAlpha = 0.45 + d * 0.55;
          let alpha = fade * depthAlpha * alphaBase[i];

          // Landing. Screen space: x from the left, y from the top.
          const sx = positions[ix] + w / 2;
          const sy = h / 2 - positions[ix + 1];
          const syPrev = h / 2 - py;
          let settled = false;
          // The scroll hangs at one depth. Particles nearer than it pass in
          // front, farther ones behind; only the band at its depth can land
          // on the rod. Without this the rod, sitting at the top of the
          // viewport, caught everything over the column the moment it
          // entered the frame.
          const atRodDepth = d > 0.28 && d < 0.5;
          if (pile === 'bank') {
            // A flake stops where the pile already is, so the drift grows
            // under the fall instead of flakes vanishing into a line.
            const rodH = atRodDepth ? bank.rodHeightAt(sx) : -1;
            if (rodH >= 0) {
              const rodSurface = bank.rodTop - rodH;
              if (syPrev < rodSurface && sy >= rodSurface && vy[i] < 0) {
                bank.deposit(sx, restSize, 'rod');
                settled = true;
              }
            }
            if (!settled && sy >= h - bank.groundHeightAt(sx) - 1) {
              bank.deposit(sx, restSize, 'ground');
              settled = true;
            }
          } else if (pile === 'carpet') {
            // Petals come to rest in a shallow band along the bottom, and
            // some of those crossing the rod stay on it.
            const rodH = atRodDepth ? bank.rodHeightAt(sx) : -1;
            if (rodH >= 0 && syPrev < bank.rodTop && sy >= bank.rodTop && vy[i] < 0 && Math.random() < 0.4) {
              stampLitter(accumCtx, i, sx, bank.rodTop - 4, restSize);
              settled = true;
            } else if (sy >= h - 4 - Math.random() * 26) {
              stampLitter(accumCtx, i, sx, h - 2 - Math.random() * 22, restSize);
              settled = true;
            }
          } else if (pile === 'surf') {
            // Droplets come down on the water or the foam; mist just fades.
            if (popOf[i] === 1 && vy[i] < 0) {
              const surface = h - Math.max(surf.foamHeightAt(sx), surf.washHeightAt(sx)) - 1;
              if (syPrev < surface && sy >= surface) {
                surf.splash(sx, restSize);
                settled = true;
              }
            }
          } else if (pile === 'field') {
            // Dust is lit only inside a beam; chaff is solid, so it is
            // merely brighter in one.
            const light = shafts.intensityAt(sx, sy);
            alpha *= popOf[i] === 0 ? 0.04 + 1.4 * light : 0.6 + 0.4 * light;
            if (popOf[i] === 1) {
              const rodH = atRodDepth ? bank.rodHeightAt(sx) : -1;
              if (rodH >= 0) {
                const rodSurface = bank.rodTop - rodH;
                if (syPrev < rodSurface && sy >= rodSurface && vy[i] < 0) {
                  bank.deposit(sx, restSize, 'rod', 0.35);
                  stampLitter(litterCtx, i, sx, rodSurface - 1, restSize);
                  settled = true;
                }
              }
              if (!settled && sy >= h - bank.groundHeightAt(sx) - 1 - Math.random() * 14) {
                bank.deposit(sx, restSize, 'ground', 0.5);
                stampLitter(litterCtx, i, sx, Math.min(h - 2, sy), restSize);
                settled = true;
              }
            }
          }
          alphas[i] = Math.max(0, Math.min(1, alpha));

          // Respawn if life expired OR offscreen OR just settled.
          const offX = positions[ix] < -w * 0.6 || positions[ix] > w * 0.6;
          const offY = positions[ix + 1] < -h * 0.7 || positions[ix + 1] > h * 0.7;
          if (life[i] <= 0 || offX || offY || settled) respawn(i, false);
        }

        if (pile !== 'surf') {
          rodClock += dt;
          if (rodClock > 0.125) { rodClock = 0; updateRod(); seedCarpet(); }
        }
        // The surfaces are redrawn from their models, not accumulated as
        // pixels, so they can be drawn at a fraction of the sim rate with no
        // loss: nothing on them moves faster than a pile grows — except the
        // sea, which gets every other frame.
        const cadence = pile === 'surf' ? 2 : 3;
        const draw = (bankFrame++ % cadence) === 0;
        if (pile === 'bank') {
          bank.step(dt);
          if (draw) {
            accumCtx.save();
            accumCtx.setTransform(accumDpr, 0, 0, accumDpr, 0, 0);
            accumCtx.clearRect(0, 0, w, h);
            bank.render(accumCtx, w, h);
            accumCtx.restore();
          }
        } else if (pile === 'surf') {
          surf.step(dt);
          if (draw) {
            accumCtx.save();
            accumCtx.setTransform(accumDpr, 0, 0, accumDpr, 0, 0);
            accumCtx.clearRect(0, 0, w, h);
            surf.render(accumCtx, w, h);
            accumCtx.restore();
          }
        } else if (pile === 'field') {
          bank.step(dt);
          // The litter thins over minutes rather than piling into a floor.
          litterCtx.globalCompositeOperation = 'destination-out';
          litterCtx.fillStyle = `rgba(0,0,0,${cfg.carpetFadePerSec * dt})`;
          litterCtx.fillRect(0, 0, litterCanvas.width, litterCanvas.height);
          litterCtx.globalCompositeOperation = 'source-over';
          if (draw) {
            accumCtx.save();
            accumCtx.setTransform(accumDpr, 0, 0, accumDpr, 0, 0);
            accumCtx.clearRect(0, 0, w, h);
            shafts.render(accumCtx, tSec);
            bank.render(accumCtx, w, h);
            accumCtx.drawImage(litterCanvas, 0, 0, w, h);
            accumCtx.restore();
          }
        } else if (pile === 'carpet') {
          const fadeAlpha = cfg.carpetFadePerSec * dt;
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
