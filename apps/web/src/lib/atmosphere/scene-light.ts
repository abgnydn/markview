// SPDX-License-Identifier: Apache-2.0
/**
 * Scene light — one light for the whole atmosphere.
 *
 * The painting's relief, the shafts the dust glows in, the shade on the
 * snow, the scroll's cast shadow and the warmth on the paper all used to
 * have their own idea of where the light was. This module is the one
 * answer: a key light derived from the local clock (a continuous sun, not
 * four phases) blended with the atmosphere's own character (Fuji is a
 * morning; Fields is late afternoon; Snow is a cold sky; Wave is overcast
 * with sea glare; Rain is a dark sky). Everything reads from here.
 *
 * The result is published two ways: as a value (`getSceneLight`) for the
 * WebGL layers, and as CSS custom properties on <html> for the stylesheet
 * (`--key-x`, `--key-y`, `--key-rgb`, `--key-warmth`, `--atm-grain`).
 */

import type { Atmosphere } from '@/stores/theme-store';

export type Phase = 'dawn' | 'day' | 'dusk' | 'night';

export interface SceneLight {
  phase: Phase;
  /** Fractional local hour, 0..24. */
  hour: number;
  /** Sun elevation, radians; negative below the horizon. */
  elevation: number;
  /** Where the light is across the frame: -1 left … +1 right. */
  azimuth: number;
  /** Unit vector for Lambert: +x right, +y up, +z toward the viewer. */
  dir: [number, number, number];
  /** Key colour, 0..1. */
  color: [number, number, number];
  /** Key intensity, 0..1. */
  intensity: number;
  /** Fill colour, 0..1 (the sky). */
  ambient: [number, number, number];
  /** Sun position in painting UV, for the rays; v up. */
  sunUv: [number, number];
  /** How much sun there is to make rays from, 0..1. */
  sunOn: number;
  /** Moonlight, 0..1 — only at night. */
  moon: number;
  /** How visible the beams are in this air, 0..1. */
  shafts: number;
  /** Exposure hint for the painting, 1 = as painted. */
  exposure: number;
}

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const mix3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] =>
  [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

interface Character {
  azimuth: number;                 // where this scene wants its light
  azimuthWeight: number;           // how much it insists over the clock
  color: [number, number, number]; // tint on top of the sun's own colour
  intensity: number;
  ambient: [number, number, number];
  shafts: number;
  exposure: number;
}

const CHARACTER: Record<Exclude<Atmosphere, 'none'>, Character> = {
  fuji:   { azimuth: -0.65, azimuthWeight: 0.6, color: [1.0, 0.86, 0.84], intensity: 0.85, ambient: [0.78, 0.74, 0.80], shafts: 0.25, exposure: 1.0 },
  wave:   { azimuth:  0.1,  azimuthWeight: 0.3, color: [0.86, 0.92, 1.0], intensity: 0.6,  ambient: [0.62, 0.70, 0.78], shafts: 0.1,  exposure: 1.05 },
  snow:   { azimuth: -0.3,  azimuthWeight: 0.4, color: [0.84, 0.90, 1.0], intensity: 0.7,  ambient: [0.66, 0.72, 0.84], shafts: 0.15, exposure: 1.1 },
  fields: { azimuth: -0.75, azimuthWeight: 0.7, color: [1.0, 0.88, 0.62], intensity: 1.0,  ambient: [0.70, 0.62, 0.48], shafts: 1.0,  exposure: 1.0 },
  rain:   { azimuth:  0.2,  azimuthWeight: 0.3, color: [0.78, 0.84, 0.92], intensity: 0.45, ambient: [0.50, 0.56, 0.64], shafts: 0.05, exposure: 1.15 },
};

function phaseForHour(h: number): Phase {
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}

/** The light for an atmosphere at a local time. Pure. */
export function computeSceneLight(atm: Exclude<Atmosphere, 'none'>, date = new Date(), tintOff = false): SceneLight {
  const c = CHARACTER[atm];
  // With the time-of-day tint switched off the scene is always mid-afternoon.
  const hour = tintOff ? 14.5 : date.getHours() + date.getMinutes() / 60;
  const phase = phaseForHour(hour);
  // A day from 6 to 18: the sun climbs to ~60° at noon and sets at 18.
  const dayT = (hour - 6) / 12;                        // 0 at sunrise, 1 at sunset
  const elevation = Math.sin(clamp01(dayT) * Math.PI) * 1.05 - (dayT < 0 || dayT > 1 ? 0.35 : 0);
  const up = clamp01(elevation / 1.05);                // 0 on the horizon, 1 at noon
  const night = elevation < 0.02;
  // Facing the painting, the morning sun is on the left and moves right.
  const clockAz = Math.max(-1, Math.min(1, (hour - 12) / 6));
  const azimuth = mix(clockAz, c.azimuth, c.azimuthWeight);

  // The sun's own colour: warm and weak on the horizon, white and strong high up.
  const sunColor = mix3([1.0, 0.62, 0.38], [1.0, 0.97, 0.92], Math.pow(up, 0.6));
  const moonColor: [number, number, number] = [0.62, 0.72, 0.92];
  const moon = night ? 0.55 : 0;
  const keyColor: [number, number, number] = night
    ? moonColor
    : [sunColor[0] * c.color[0], sunColor[1] * c.color[1], sunColor[2] * c.color[2]];
  const intensity = night ? 0.35 * c.intensity + 0.1 : c.intensity * mix(0.55, 1, up);

  // Direction: across the frame by azimuth, up by elevation, and always
  // some z so the relief is lit from the front rather than grazed.
  const ex = azimuth * 0.8;
  const ey = night ? 0.7 : mix(0.15, 0.95, up);
  const ez = 0.75;
  const len = Math.hypot(ex, ey, ez);
  const dir: [number, number, number] = [ex / len, ey / len, ez / len];

  const sunUv: [number, number] = [0.5 + azimuth * 0.42, night ? 0.9 : mix(0.68, 0.98, up)];
  const sunOn = night ? 0 : clamp01(0.35 + up) * (c.shafts > 0.2 ? 1 : 0.6);
  const ambient = night ? mix3(c.ambient, [0.22, 0.26, 0.40], 0.7) : c.ambient;
  const exposure = c.exposure * (night ? 0.88 : 1);

  return { phase, hour, elevation, azimuth, dir, color: keyColor, intensity, ambient, sunUv, sunOn, moon, shafts: c.shafts * (night ? 0.4 : 1), exposure };
}

// ── Live value + subscribers ────────────────────────────────────────────

let current: SceneLight | null = null;
let currentAtm: Exclude<Atmosphere, 'none'> | null = null;
const listeners = new Set<(l: SceneLight) => void>();
let timer: number | null = null;

/** The light now, for the active atmosphere. Null before `setSceneAtmosphere`. */
export function getSceneLight(): SceneLight | null { return current; }

export function onSceneLight(cb: (l: SceneLight) => void): () => void {
  listeners.add(cb);
  if (current) cb(current);
  return () => { listeners.delete(cb); };
}

function tintOff(): boolean {
  return typeof document !== 'undefined' && document.documentElement.getAttribute('data-time-phase') === 'off';
}

function publish(): void {
  if (!currentAtm) return;
  current = computeSceneLight(currentAtm, new Date(), tintOff());
  applyCssVars(current);
  listeners.forEach((cb) => cb(current as SceneLight));
}

/** Tell the light which scene it is lighting. 'none' clears it. Idempotent. */
export function setSceneAtmosphere(atm: Atmosphere): void {
  if (atm === 'none') {
    currentAtm = null; current = null;
    if (timer !== null) { window.clearInterval(timer); timer = null; }
    clearCssVars();
    return;
  }
  currentAtm = atm;
  publish();
  // The sun moves slowly; a minute is finer than anyone can see.
  if (timer === null) timer = window.setInterval(publish, 60 * 1000);
}

const VARS = ['--key-x', '--key-y', '--key-rgb', '--key-warmth', '--key-intensity', '--moon'];

/**
 * The stylesheet's share: where the light is (for the scroll's cast
 * shadow), what colour it is (for the warmth on the paper) and how much
 * of it there is.
 */
function applyCssVars(l: SceneLight): void {
  const root = document.documentElement.style;
  root.setProperty('--key-x', l.azimuth.toFixed(3));
  root.setProperty('--key-y', clamp01(l.elevation / 1.05).toFixed(3));
  root.setProperty('--key-rgb', `${Math.round(l.color[0] * 255)}, ${Math.round(l.color[1] * 255)}, ${Math.round(l.color[2] * 255)}`);
  // Warmth: how yellow the key is relative to its blue, 0 (cold) .. 1 (gold).
  const warmth = clamp01((l.color[0] - l.color[2]) * 1.6) * l.intensity;
  root.setProperty('--key-warmth', warmth.toFixed(3));
  root.setProperty('--key-intensity', l.intensity.toFixed(3));
  root.setProperty('--moon', l.moon.toFixed(3));
}

function clearCssVars(): void {
  const root = document.documentElement.style;
  for (const v of VARS) root.removeProperty(v);
}
