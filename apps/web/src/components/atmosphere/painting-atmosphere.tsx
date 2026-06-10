// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ATMOSPHERES, pickPaintingFor, type ParticleKind } from './atmospheres';
import type { Atmosphere } from '@/stores/theme-store';
import { setAtmosphereAudio, unlockAtmosphereAudio } from '@/lib/atmosphere/audio';
import { WebGLParticles } from './webgl-particles';
import { WebGPUParticles } from './webgpu-particles';
import { DepthPainting } from './depth-painting';
import { SplatPainting } from './splat-painting';

interface PaintingAtmosphereProps {
  atmosphere: Exclude<Atmosphere, 'none'>;
  /** Bumped externally (sidebar "next painting" button) to force a re-pick. */
  paintingNonce?: number;
}

/**
 * PaintingAtmosphere — config-driven ambient background. Renders one of
 * the registered atmospheres (Fuji, Wave, Snow, Fields …). Each is a
 * real public-domain artwork with a museum attribution + an ambient
 * particle overlay matched to its scene.
 *
 *   Fuji   → cherry blossom petals drift down
 *   Wave   → sea spray erupts upward + outward
 *   Snow   → snowflakes fall heavy with a gentle sideways sway
 *   Fields → golden sun motes float lazily upward
 *
 * All particles run on pure CSS transform + opacity keyframes — 60fps on
 * the compositor, no canvas, no JS animation loop, no media downloads
 * beyond the JPEG. Pointer-events off, sits at z:0 behind the content.
 */
export function PaintingAtmosphere({ atmosphere, paintingNonce = 0 }: PaintingAtmosphereProps) {
  const cfg = ATMOSPHERES[atmosphere];
  // Today's painting (date-rotated or pinned via cycle button). The nonce
  // forces a re-pick when the user manually advances.
  const painting = useMemo(
    () => pickPaintingFor(atmosphere),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [atmosphere, paintingNonce],
  );

  // Preload-then-swap so the painting cross-fades instead of flashing
  // blank. `displayed` (atmosphere + painting) lags the incoming pair
  // by one decode: when either changes we kick off a preload, then
  // swap `displayed` on completion. Until then the previous frame
  // stays fully on screen — no blank img, no top-to-bottom cascade
  // from the data-attribute / scrim / particles updating before the
  // painting catches up.
  const [displayed, setDisplayed] = useState({ atmosphere, painting });
  const [imageReady, setImageReady] = useState(true);
  useEffect(() => {
    const sameAtmo = displayed.atmosphere === atmosphere;
    const samePainting = displayed.painting.imageSrc === painting.imageSrc;
    if (sameAtmo && samePainting) return;
    setImageReady(false);
    let cancelled = false;
    const swap = () => {
      if (cancelled) return;
      setDisplayed({ atmosphere, painting });
      // A frame after the new src lands, fade back in.
      requestAnimationFrame(() => requestAnimationFrame(() => setImageReady(true)));
    };
    const img = new Image();
    img.decoding = 'async';
    img.src = painting.imageSrc;
    if (typeof img.decode === 'function') {
      img.decode().then(swap).catch(swap);
    } else if (img.complete) {
      swap();
    } else {
      img.onload = swap;
      img.onerror = swap;
    }
    return () => { cancelled = true; };
  }, [atmosphere, painting, displayed.atmosphere, displayed.painting.imageSrc]);

  // Particles + cfg both come from the *displayed* atmosphere so they
  // travel with the painting; the whole layer fades as a unit.
  const displayedCfg = ATMOSPHERES[displayed.atmosphere as Exclude<Atmosphere, 'none'>] ?? cfg;
  const particles = useMemo(() => {
    if (!displayedCfg || displayedCfg.particles === 'none') return [];
    return buildParticles(displayedCfg.particles, displayedCfg.id);
  }, [displayedCfg]);

  // A small flock that drifts across the sky, varied per atmosphere.
  const birds = useMemo(
    () => (displayedCfg ? buildBirds(displayedCfg.id) : []),
    [displayedCfg],
  );
  const leaves = useMemo(
    () => (displayedCfg ? buildLeaves(displayedCfg.id) : []),
    [displayedCfg],
  );
  const inkMotes = useMemo(
    () => (displayedCfg ? buildInkMotes(displayedCfg.id) : []),
    [displayedCfg],
  );
  const creatures = useMemo(
    () => (displayedCfg ? buildCreatures(displayedCfg.id) : []),
    [displayedCfg],
  );

  // Switch ambient audio with the painting. Audio is muted by default
  // and needs an unlock gesture (handled inside the audio module).
  useEffect(() => {
    if (!cfg) return;
    setAtmosphereAudio(cfg.id);
    // Unlock on first user gesture — covers the autoplay-policy edge.
    const gesture = () => {
      unlockAtmosphereAudio();
      window.removeEventListener('pointerdown', gesture);
      window.removeEventListener('keydown', gesture);
    };
    window.addEventListener('pointerdown', gesture, { once: true });
    window.addEventListener('keydown', gesture, { once: true });
    return () => {
      setAtmosphereAudio('none');
      window.removeEventListener('pointerdown', gesture);
      window.removeEventListener('keydown', gesture);
    };
  }, [cfg]);

  // ── Render mode — 'relief' (depth-displaced mesh) or 'splat' (3D
  // Gaussian pigment cloud). Toggled with the `v` key (volumetric);
  // persisted for the session so it survives painting rotations.
  const [splatMode, setSplatMode] = useState(
    () => typeof sessionStorage !== 'undefined' && sessionStorage.getItem('mv-splat') === '1',
  );
  // Transient toast text shown on a `v`/`b` toggle ('' = hidden).
  const [hint, setHint] = useState('');
  const flashHint = useCallback((text: string) => {
    setHint(text);
    window.setTimeout(() => setHint(''), 1800);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'v' && e.key !== 'V') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (isTypingTarget(e.target)) return; // don't toggle mid-keystroke
      e.preventDefault();
      setSplatMode((prev) => {
        const next = !prev;
        try { sessionStorage.setItem('mv-splat', next ? '1' : '0'); } catch { /* ignore */ }
        flashHint(next ? 'Volumetric · pigment cloud' : 'Relief · depth surface');
        return next;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flashHint]);

  // ── Particle backend — 'webgl' (CPU sim, universal) or 'webgpu'
  // (TSL compute sim, opt-in). Toggled with `b`; requires navigator.gpu.
  // Any WebGPU init failure flips back to WebGL via onFallback.
  //
  // DELIBERATELY NOT persisted: the WebGPU path is experimental and a
  // heavy GPU load, so a page reload always starts on the safe WebGL
  // backend. It only ever turns on via an explicit `b` press in-session.
  const [gpuParticles, setGpuParticles] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'b' && e.key !== 'B') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (isTypingTarget(e.target)) return;
      if (!('gpu' in navigator)) { flashHint('Particles · WebGPU unavailable'); return; }
      setGpuParticles((prev) => {
        const next = !prev;
        flashHint(next ? 'Particles · WebGPU compute (experimental)' : 'Particles · WebGL');
        return next;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flashHint]);
  const onGpuFallback = useCallback(() => {
    setGpuParticles(false);
  }, []);

  // ── #14 Caption flourish — show the painting's title bottom-left
  // for 2s on swap. Re-fires whenever the displayed painting changes
  // (atmosphere change or rotation tick).
  const [captionVisible, setCaptionVisible] = useState(false);
  useEffect(() => {
    setCaptionVisible(true);
    const t = window.setTimeout(() => setCaptionVisible(false), 2400);
    return () => window.clearTimeout(t);
  }, [displayed.painting.imageSrc]);

  if (!displayedCfg) return null;

  const style: React.CSSProperties = {
    ['--atm-opacity-dark' as string]: String(displayedCfg.opacityDark),
    ['--atm-opacity-light' as string]: String(displayedCfg.opacityLight),
    ['--atm-filter-dark' as string]: displayedCfg.filterDark || 'none',
    ['--atm-filter-light' as string]: displayedCfg.filterLight || 'none',
    ['--atm-focal' as string]: displayed.painting.focal,
  };

  return (
    <div
      className={`atmosphere atmosphere-painting atmosphere-${displayedCfg.id}${imageReady ? '' : ' atmosphere-swapping'}`}
      style={style}
      aria-hidden="true"
    >
      {/* DepthPainting computes a per-painting depth map (Depth Anything
          v2 small via transformers.js, cached in Cache API per browser)
          and renders the painting through a WebGL2 fragment shader that
          offsets UV by cursor·depth + perlin wobble. The mountain stays
          put while the sky drifts; the painting subtly tilts toward the
          cursor. Falls back to a plain <img> while depth is computing or
          when WebGL isn't available. */}
      {splatMode ? (
        /* Volumetric mode — the painting lifted into a 3D Gaussian-splat
           cloud from its depth map. Orbits gently to show real parallax;
           soft pigment gaussians fuse where a triangle mesh would tear. */
        <SplatPainting
          className="atmosphere-image"
          src={displayed.painting.imageSrc}
          paintingKey={displayed.painting.key}
        />
      ) : (
        <DepthPainting
          className="atmosphere-image"
          src={displayed.painting.imageSrc}
          paintingKey={displayed.painting.key}
        />
      )}

      {/* (17) A distant flock drifts across the sky — a quiet sign of life
          over every painting. Pure CSS flight + wing-flap. */}
      <div className="atmosphere-birds" aria-hidden="true">
        {birds.map((b) => (
          <div key={b.key} className="atmosphere-bird" style={b.style}>
            <svg viewBox="0 0 24 8"><path d="M1 6 Q 6 1 12 4.6 Q 18 1 23 6" /></svg>
          </div>
        ))}
      </div>

      {/* (18) Drifting leaves — a few fall + sway + spin past the scene. */}
      <div className="atmosphere-leaves" aria-hidden="true">
        {leaves.map((l) => (
          <div key={l.key} className="atmosphere-leaf" style={l.style}>
            <svg viewBox="0 0 12 16"><path d="M6 0 C 11 5 11 11 6 16 C 1 11 1 5 6 0 Z M6 2 L6 14" /></svg>
          </div>
        ))}
      </div>

      {/* (19) Soft mist rising along the foot of the painting — depth. */}
      <div className="atmosphere-mist" aria-hidden="true" />

      {/* (38) Floating ink motes — slow dark dust catches the light. */}
      <div className="atmosphere-inkmotes" aria-hidden="true">
        {inkMotes.map((m) => (
          <div key={m.key} className="atmosphere-inkmote" style={m.style} />
        ))}
      </div>

      {/* Per-appearance creatures — cranes (Fuji), butterflies (Fields),
          koi (Wave), a lone crow (Snow). Native to each painting. */}
      <div className="atmosphere-creatures" aria-hidden="true">
        {creatures.map((c) => (
          <div key={c.key} className={`atmosphere-creature atmosphere-creature-${c.kind}`} style={c.style}>
            {CREATURE_SVG[c.kind]}
          </div>
        ))}
      </div>

      {displayedCfg.particles !== 'none' && (
        gpuParticles ? (
          /* TSL compute simulation on the WebGPU backend — same look,
             every particle's physics stepped on the GPU. Falls back to
             the WebGL field on any init error. */
          <WebGPUParticles
            key={`gpu-${displayedCfg.particles}`}
            kind={displayedCfg.particles}
            onFallback={onGpuFallback}
          />
        ) : (
          /* GPU-rendered, CPU-simulated particle field — curl-noise wind,
             cursor force, gravity, life/respawn, per-atmosphere sprite. */
          <WebGLParticles kind={displayedCfg.particles} />
        )
      )}

      <div className="atmosphere-credit">
        <span className="atmosphere-credit-artist">{displayed.painting.attribution}</span>
        <span className="atmosphere-credit-sep"> · </span>
        <span className="atmosphere-credit-detail">{displayed.painting.attributionDetail}</span>
      </div>

      {/* #14 Caption flourish — soft italic title bottom-left for 2.4s
          on every painting swap. Sits above the credit, fades on its own. */}
      <div
        className={`atmosphere-caption${captionVisible ? ' atmosphere-caption-show' : ''}`}
        aria-hidden="true"
      >
        {displayed.painting.attributionDetail.split(' · ')[0]}
      </div>

      {/* `v` / `b` key toast — confirms render-mode / particle-backend. */}
      <div
        className={`atmosphere-mode-hint${hint ? ' atmosphere-mode-hint-show' : ''}`}
        aria-hidden="true"
      >
        {hint}
      </div>
    </div>
  );
}

interface ParticleInstance {
  key: number;
  style: React.CSSProperties;
}

/** True when the event originates from a text-editing surface (input, textarea,
 *  any contenteditable, or the CodeMirror editor) — so the v/b hotkeys never
 *  fire mid-keystroke. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return true;
  return typeof el.closest === 'function' && el.closest('.cm-editor') !== null;
}

/**
 * buildBirds — a distant flock for the sky. Seeded per atmosphere so the
 * flight pattern is stable across re-renders. Each bird gets its own height,
 * size (depth), speed, start offset, and a tiny vertical drift.
 */
function buildBirds(atmosphereId: string): ParticleInstance[] {
  const seedByAtmosphere: Record<string, number> = {
    fuji: 0xb14d5, wave: 0x5ea91, snow: 0xfa11e, fields: 0xf1e1d,
  };
  const rng = mulberry32(seedByAtmosphere[atmosphereId] ?? 0xb1d533);
  // More birds over open-sky scenes, fewer over the wave/snow close-ups.
  const count = atmosphereId === 'fields' || atmosphereId === 'fuji' ? 7 : 5;
  return Array.from({ length: count }, (_, i) => {
    const scale = 0.45 + rng() * 0.95;
    return {
      key: i,
      style: {
        top: `${5 + rng() * 34}%`,
        width: `${20 * scale}px`,
        height: `${8 * scale}px`,
        color: `rgba(26, 22, 31, ${0.30 + rng() * 0.24})`,
        animationDuration: `${42 + rng() * 44}s`,
        animationDelay: `${-rng() * 80}s`,
        ['--bird-drift' as string]: `${(rng() - 0.5) * 12}vh`,
        ['--flap' as string]: `${0.42 + rng() * 0.28}s`,
      } as React.CSSProperties,
    };
  });
}

// Per-appearance creature silhouettes. Stroke shapes (crane/crow) vs filled
// (butterfly/koi) are split apart in CSS.
const CREATURE_SVG: Record<string, React.ReactNode> = {
  crane: (
    <svg viewBox="0 0 46 22">
      <path d="M2 13 Q 12 4 22 11 Q 32 4 44 12" />
      <path d="M22 11 L 30 9 L 34 10" />
      <path d="M2 13 L 0 11" />
    </svg>
  ),
  crow: (
    <svg viewBox="0 0 24 8"><path d="M1 6 Q 6 1 12 4.6 Q 18 1 23 6" /></svg>
  ),
  butterfly: (
    <svg viewBox="0 0 22 18">
      <path d="M11 9 C 4 1 -1 6 4 12 C 8 17 11 12 11 9 Z" />
      <path d="M11 9 C 18 1 23 6 18 12 C 14 17 11 12 11 9 Z" />
      <line x1="11" y1="5" x2="11" y2="14" />
    </svg>
  ),
  koi: (
    <svg viewBox="0 0 34 16">
      <path d="M3 8 Q 14 1 26 8 Q 14 15 3 8 Z" />
      <path d="M26 8 L 33 3 L 31 8 L 33 13 Z" />
    </svg>
  ),
};

interface CreatureInstance { key: number; kind: string; style: React.CSSProperties }

/** buildCreatures — the creature native to each appearance. */
function buildCreatures(atmosphereId: string): CreatureInstance[] {
  const rng = mulberry32(0xc4ea ^ atmosphereId.length * 0x27d4);
  const make = (kind: string, count: number): CreatureInstance[] =>
    Array.from({ length: count }, (_, i) => {
      const scale = 0.7 + rng() * 0.7;
      let style: React.CSSProperties;
      if (kind === 'crane') {
        style = {
          top: `${8 + rng() * 22}%`, width: `${42 * scale}px`, height: `${20 * scale}px`,
          color: `rgba(28, 24, 30, ${0.4 + rng() * 0.2})`,
          animationDuration: `${54 + rng() * 36}s`, animationDelay: `${-rng() * 80}s`,
          ['--c-drift' as string]: `${(rng() - 0.5) * 10}vh`,
        };
      } else if (kind === 'butterfly') {
        style = {
          left: `${rng() * 90}%`, top: `${30 + rng() * 45}%`, width: `${14 * scale}px`, height: `${12 * scale}px`,
          color: 'var(--zen-accent)',
          animationDuration: `${14 + rng() * 12}s`, animationDelay: `${-rng() * 20}s`,
          ['--c-sway' as string]: `${6 + rng() * 10}vw`, ['--c-rise' as string]: `${(rng() - 0.5) * 30}vh`,
          ['--flap' as string]: `${0.18 + rng() * 0.14}s`,
        };
      } else if (kind === 'koi') {
        style = {
          top: `${72 + rng() * 18}%`, width: `${30 * scale}px`, height: `${14 * scale}px`,
          color: `rgba(190, 72, 40, ${0.55 + rng() * 0.25})`,
          animationDuration: `${38 + rng() * 30}s`, animationDelay: `${-rng() * 40}s`,
          ['--c-drift' as string]: `${(rng() - 0.5) * 6}vh`,
        };
      } else {
        style = {
          top: `${10 + rng() * 24}%`, width: `${22 * scale}px`, height: `${8 * scale}px`,
          color: `rgba(16, 14, 18, ${0.4 + rng() * 0.2})`,
          animationDuration: `${48 + rng() * 40}s`, animationDelay: `${-rng() * 80}s`,
          ['--c-drift' as string]: `${(rng() - 0.5) * 10}vh`, ['--flap' as string]: `${0.45 + rng() * 0.2}s`,
        };
      }
      return { key: i, kind, style };
    });
  switch (atmosphereId) {
    case 'fuji': return make('crane', 2);
    case 'fields': return make('butterfly', 5);
    case 'wave': return make('koi', 3);
    case 'snow': return make('crow', 2);
    default: return [];
  }
}

/** buildInkMotes — slow-drifting dark dust specks for atmospheric depth. */
function buildInkMotes(atmosphereId: string): ParticleInstance[] {
  const rng = mulberry32(0x1a4 ^ atmosphereId.charCodeAt(0) * 0x85eb);
  return Array.from({ length: 14 }, (_, i) => {
    const size = 2 + rng() * 3;
    return {
      key: i,
      style: {
        left: `${rng() * 100}%`,
        top: `${rng() * 100}%`,
        width: `${size}px`,
        height: `${size}px`,
        opacity: 0.12 + rng() * 0.18,
        animationDuration: `${20 + rng() * 26}s`,
        animationDelay: `${-rng() * 30}s`,
        ['--mote-x' as string]: `${(rng() - 0.5) * 8}vw`,
        ['--mote-y' as string]: `${(rng() - 0.5) * 8}vh`,
      } as React.CSSProperties,
    };
  });
}

/** buildLeaves — a few leaves that fall, sway, and spin past the scene. */
function buildLeaves(atmosphereId: string): ParticleInstance[] {
  const rng = mulberry32(0x1eaf ^ atmosphereId.length * 0x9e37);
  return Array.from({ length: 5 }, (_, i) => {
    const scale = 0.7 + rng() * 0.9;
    return {
      key: i,
      style: {
        left: `${rng() * 100}%`,
        width: `${11 * scale}px`,
        height: `${15 * scale}px`,
        color: `rgba(70, 52, 28, ${0.26 + rng() * 0.2})`,
        animationDuration: `${16 + rng() * 18}s`,
        animationDelay: `${-rng() * 30}s`,
        ['--leaf-sway' as string]: `${5 + rng() * 9}vw`,
        ['--leaf-spin' as string]: `${(rng() > 0.5 ? 1 : -1) * (240 + rng() * 320)}deg`,
      } as React.CSSProperties,
    };
  });
}

/**
 * buildParticles — per-kind particle field. Stable seed per atmosphere
 * so re-renders don't reshuffle positions. Each particle gets its own
 * random delay/duration/drift so the field looks organic instead of
 * mechanical.
 */
function buildParticles(kind: ParticleKind, atmosphereId: string): ParticleInstance[] {
  // Different seeds per atmosphere → different but stable distributions.
  const seedByAtmosphere: Record<string, number> = {
    fuji:   0xfeedface,
    wave:   0x0c0ffee5,
    snow:   0xa1b2c3d4,
    fields: 0xf1e1d50f,
  };
  const rng = mulberry32(seedByAtmosphere[atmosphereId] ?? 0x1234abcd);

  switch (kind) {
    case 'petals':   return petalsField(rng);
    case 'snow':     return snowField(rng);
    case 'spray':    return sprayField(rng);
    case 'motes':    return motesField(rng);
    default:         return [];
  }
}

// ── Petals: pink/violet ellipses drift down with sideways drift + spin ─
const PETAL_COLORS = ['#fbcfe8', '#fda4af', '#f9a8d4', '#e9d5ff', '#c4b5fd', '#fde2e4'];
function petalsField(rng: () => number): ParticleInstance[] {
  return Array.from({ length: 14 }, (_, i) => ({
    key: i,
    style: {
      left: `${rng() * 100}%`,
      animationDelay: `${-rng() * 32}s`,
      animationDuration: `${28 + rng() * 24}s`,
      background: PETAL_COLORS[i % PETAL_COLORS.length],
      ['--drift' as string]: `${(rng() - 0.5) * 280}px`,
      ['--scale' as string]: 0.55 + rng() * 0.7,
      ['--rot' as string]: `${rng() * 360}deg`,
    } as React.CSSProperties,
  }));
}

// ── Snow: white dots, slow fall, gentle sideways sway, varied sizes ────
function snowField(rng: () => number): ParticleInstance[] {
  return Array.from({ length: 36 }, (_, i) => {
    const size = 3 + rng() * 6; // 3–9px
    return {
      key: i,
      style: {
        left: `${rng() * 100}%`,
        width: `${size}px`,
        height: `${size}px`,
        animationDelay: `${-rng() * 40}s`,
        animationDuration: `${24 + rng() * 22}s`,
        ['--sway' as string]: `${(rng() - 0.5) * 60}px`,
        ['--opacity-peak' as string]: String(0.5 + rng() * 0.4),
      } as React.CSSProperties,
    };
  });
}

// ── Spray: tiny white-blue droplets erupting upward + outward, fade fast
function sprayField(rng: () => number): ParticleInstance[] {
  return Array.from({ length: 22 }, (_, i) => ({
    key: i,
    style: {
      // Spray bursts from the wave-crest area (lower-middle of viewport).
      left: `${20 + rng() * 60}%`,
      bottom: `${20 + rng() * 25}%`,
      animationDelay: `${-rng() * 9}s`,
      animationDuration: `${4.8 + rng() * 4.4}s`,
      ['--launch-x' as string]: `${(rng() - 0.5) * 220}px`,
      ['--launch-y' as string]: `${-(60 + rng() * 180)}px`,
      ['--scale' as string]: 0.35 + rng() * 0.7,
    } as React.CSSProperties,
  }));
}

// ── Motes: golden sun-dust drifting upward, slow horizontal float, soft glow
function motesField(rng: () => number): ParticleInstance[] {
  return Array.from({ length: 16 }, (_, i) => {
    const size = 4 + rng() * 5; // 4–9px
    return {
      key: i,
      style: {
        left: `${rng() * 100}%`,
        bottom: `-${20 + rng() * 80}px`,
        width: `${size}px`,
        height: `${size}px`,
        animationDelay: `${-rng() * 40}s`,
        animationDuration: `${32 + rng() * 26}s`,
        ['--mote-x' as string]: `${(rng() - 0.5) * 140}px`,
        ['--opacity-peak' as string]: String(0.4 + rng() * 0.45),
      } as React.CSSProperties,
    };
  });
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
