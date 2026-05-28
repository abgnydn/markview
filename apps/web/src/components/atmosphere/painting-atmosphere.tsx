// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { ATMOSPHERES, pickPaintingFor, type ParticleKind } from './atmospheres';
import type { Atmosphere } from '@/stores/theme-store';
import { setAtmosphereAudio, unlockAtmosphereAudio } from '@/lib/atmosphere/audio';
import { WebGLParticles } from './webgl-particles';
import { DepthPainting } from './depth-painting';

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
      <DepthPainting
        className="atmosphere-image"
        src={displayed.painting.imageSrc}
        paintingKey={displayed.painting.key}
      />

      {displayedCfg.particles !== 'none' && (
        /* GPU particle system — ~3000 particles per atmosphere driven
           by a Perlin wind field, cursor force, gravity, life/respawn
           cycle, and a per-atmosphere sprite texture. Replaces both
           the old CSS keyframe field and the small canvas flock with
           a single richer layer. */
        <WebGLParticles kind={displayedCfg.particles} />
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
    </div>
  );
}

interface ParticleInstance {
  key: number;
  style: React.CSSProperties;
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
