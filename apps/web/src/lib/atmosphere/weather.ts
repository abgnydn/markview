// SPDX-License-Identifier: Apache-2.0
/**
 * Weather — the scene changes while you read.
 *
 * Every atmosphere used to be the same at minute one and minute twenty.
 * This is a slow state machine of fronts: calm, building, squall,
 * clearing, each lasting from half a minute to a few minutes, cycling for
 * as long as the page is open. It produces four numbers the layers read:
 *
 *   intensity  — how much is falling / rising / breaking (1 = the base)
 *   wind       — how often and how hard it gusts (1 = the base)
 *   sea        — how much energy the swell has (wave only; 1 = the base)
 *   visibility — how far you can see through the air (1 = clear)
 *
 * When the atmosphere audio is playing, its signal leans on these: a loud
 * stretch of surf raises `sea`, a rising wind raises `wind`. The visuals
 * then follow the sound instead of running on a clock beside it.
 */

import type { Atmosphere } from '@/stores/theme-store';
import { getAtmosphereSignal } from './audio';

export type Front = 'calm' | 'building' | 'squall' | 'clearing';

export interface Weather {
  front: Front;
  intensity: number;
  wind: number;
  sea: number;
  visibility: number;
  /** The audio's onset pulse (0..1) when it is playing, else 0. */
  onset: number;
  /** The audio's low-band level (0..1) when it is playing, else 0. */
  low: number;
}

interface Targets { intensity: number; wind: number; sea: number; visibility: number }

// What each front means, per scene. The squall is the base times these;
// the base counts in the particle configs are sized for the squall.
const FRONTS: Record<Exclude<Atmosphere, 'none'>, Record<Front, Targets>> = {
  snow: {
    calm:     { intensity: 0.35, wind: 0.5, sea: 1, visibility: 1.0 },
    building: { intensity: 0.7,  wind: 1.1, sea: 1, visibility: 0.9 },
    squall:   { intensity: 1.0,  wind: 1.8, sea: 1, visibility: 0.7 },
    clearing: { intensity: 0.5,  wind: 0.8, sea: 1, visibility: 0.95 },
  },
  fuji: {
    calm:     { intensity: 0.4,  wind: 0.6, sea: 1, visibility: 1.0 },
    building: { intensity: 0.75, wind: 1.2, sea: 1, visibility: 1.0 },
    squall:   { intensity: 1.0,  wind: 1.6, sea: 1, visibility: 0.95 },
    clearing: { intensity: 0.55, wind: 0.7, sea: 1, visibility: 1.0 },
  },
  wave: {
    calm:     { intensity: 0.6,  wind: 0.6, sea: 0.55, visibility: 1.0 },
    building: { intensity: 0.85, wind: 1.0, sea: 0.85, visibility: 0.95 },
    squall:   { intensity: 1.0,  wind: 1.5, sea: 1.25, visibility: 0.85 },
    clearing: { intensity: 0.7,  wind: 0.8, sea: 0.7,  visibility: 1.0 },
  },
  fields: {
    calm:     { intensity: 0.6,  wind: 0.5, sea: 1, visibility: 1.0 },
    building: { intensity: 0.85, wind: 1.0, sea: 1, visibility: 1.0 },
    squall:   { intensity: 1.0,  wind: 1.7, sea: 1, visibility: 0.95 },
    clearing: { intensity: 0.7,  wind: 0.7, sea: 1, visibility: 1.0 },
  },
  rain: {
    calm:     { intensity: 0.45, wind: 0.5, sea: 1, visibility: 0.95 },
    building: { intensity: 0.8,  wind: 1.0, sea: 1, visibility: 0.85 },
    squall:   { intensity: 1.0,  wind: 1.6, sea: 1, visibility: 0.65 },
    clearing: { intensity: 0.5,  wind: 0.7, sea: 1, visibility: 0.9 },
  },
};

// How long each front holds, seconds. Long enough to be a mood, short
// enough that a reading session sees the weather turn.
const HOLD: Record<Front, [number, number]> = {
  calm: [70, 180],
  building: [40, 90],
  squall: [35, 80],
  clearing: [40, 90],
};
const NEXT: Record<Front, Front> = { calm: 'building', building: 'squall', squall: 'clearing', clearing: 'calm' };

export class WeatherClock {
  private front: Front;
  private hold: number;
  private clock = 0;
  private cur: Targets;
  private readonly fronts: Record<Front, Targets>;

  constructor(private readonly atm: Exclude<Atmosphere, 'none'>) {
    this.fronts = FRONTS[atm];
    // Start somewhere in the cycle, never at the same place twice, and not
    // in the squall: the first thing seen should be the scene, not the storm.
    const starts: Front[] = ['calm', 'building', 'clearing'];
    this.front = starts[Math.floor(Math.random() * starts.length)];
    this.hold = this.pickHold(this.front) * (0.4 + Math.random() * 0.6);
    this.cur = { ...this.fronts[this.front] };
  }

  private pickHold(f: Front): number {
    const [a, b] = HOLD[f];
    return a + Math.random() * (b - a);
  }

  /** Advance by dt seconds and return the weather now. */
  step(dt: number): Weather {
    this.clock += dt;
    if (this.clock >= this.hold) {
      this.front = NEXT[this.front];
      this.hold = this.pickHold(this.front);
      this.clock = 0;
    }
    // Fronts arrive over ~20 s, not on the frame they are declared.
    const t = this.fronts[this.front];
    const k = Math.min(1, dt / 20);
    this.cur.intensity += (t.intensity - this.cur.intensity) * k;
    this.cur.wind += (t.wind - this.cur.wind) * k;
    this.cur.sea += (t.sea - this.cur.sea) * k;
    this.cur.visibility += (t.visibility - this.cur.visibility) * k;

    // The sound, when there is one, leans on the weather. It is a nudge:
    // the fronts still own the shape of the session.
    const sig = getAtmosphereSignal();
    let onset = 0, low = 0, windBoost = 0, seaBoost = 0;
    if (sig) {
      onset = sig.onset;
      low = sig.low;
      if (this.atm === 'wave') seaBoost = (sig.level - 0.4) * 0.6;
      // Wind is the loudness of the loop: the snow recording is a wind
      // recording with nothing above 2 kHz, so the band split says nothing
      // there and the overall level is what carries a gust.
      if (this.atm === 'snow') windBoost = (sig.level - 0.4) * 0.9;
      if (this.atm === 'fields' || this.atm === 'fuji') windBoost = (sig.high - 0.3) * 0.8;
    }
    return {
      front: this.front,
      intensity: this.cur.intensity,
      wind: Math.max(0.2, this.cur.wind + windBoost),
      sea: Math.max(0.3, this.cur.sea + seaBoost),
      visibility: this.cur.visibility,
      onset,
      low,
    };
  }
}
