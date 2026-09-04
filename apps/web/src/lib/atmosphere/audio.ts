import { getAudioContextCtor } from '@/lib/audio-context';
import type { Atmosphere } from '@/stores/theme-store';
// SPDX-License-Identifier: Apache-2.0

/**
 * Atmosphere audio — procedural ambient soundtracks built with the
 * native Web Audio API (no Tone.js, no external samples). Each
 * atmosphere has its own generator function that wires oscillators +
 * filters + noise to evoke the scene:
 *
 *   fuji   → pentatonic drone (shakuhachi-ish) + slow temple chime
 *   wave   → filtered brown noise swelling like ocean breath
 *   snow   → high-passed pink noise + occasional muted bell hits
 *   fields → warm pad + sparse high pluck (cicada/bird tones)
 *   rain   → band-passed noise hiss + sparse drips
 *
 * The whole thing is < 4 KB minified. No autoplay — needs an explicit
 * `start()` from a user gesture (browser autoplay policy). Master
 * volume + mute state persist to localStorage.
 *
 * `getAtmosphereSignal()` reads the output back as a few smoothed numbers
 * (level, low band, high band, onset) so the visuals can follow the sound.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let active: { stop: () => void } | null = null;
let currentId: Atmosphere | null = null;
let storedVolume = 0.35;
let muted = false;
let tap: SignalTap | null = null;

try {
  const v = localStorage.getItem('markview-atmosphere-volume');
  if (v !== null) storedVolume = Math.min(1, Math.max(0, parseFloat(v)));
  muted = localStorage.getItem('markview-atmosphere-muted') === 'true';
} catch {
  /* ignore */
}

function ensureContext(): AudioContext {
  if (!ctx) {
    const AC = getAudioContextCtor();
    // Behavior-equivalent to the old unguarded `new AC()`: environments
    // with no AudioContext at all throw; callers already guard with try.
    if (!AC) throw new Error('AudioContext unavailable');
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : storedVolume;
    // The analyser sits after the master gain, so it reads what actually
    // reaches the speakers (nothing while muted). getAtmosphereSignal()
    // divides the master gain back out so the numbers do not follow the
    // volume slider.
    const analyser = ctx.createAnalyser();
    analyser.fftSize = SIGNAL_FFT_SIZE;
    analyser.smoothingTimeConstant = 0;
    masterGain.connect(analyser).connect(ctx.destination);
    tap = {
      analyser,
      time: new Float32Array(analyser.fftSize),
      freq: new Float32Array(analyser.frequencyBinCount),
    };
  }
  return ctx;
}

function rampGainTo(value: number, durationSec = 1.2) {
  if (!ctx || !masterGain) return;
  const now = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(masterGain.gain.value, now);
  masterGain.gain.linearRampToValueAtTime(value, now + durationSec);
}



export function setAtmosphereMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem('markview-atmosphere-muted', String(muted)); } catch { /* ignore */ }
  rampGainTo(muted ? 0 : storedVolume, 0.3);
  // The credit line shows the recording's attribution only while sound is
  // audible (CC-BY), so it needs to know about mute changes in this tab —
  // the `storage` event only fires cross-tab.
  try { window.dispatchEvent(new CustomEvent('markview:atmosphere-muted')); } catch { /* SSR */ }
}

export function isAtmosphereMuted(): boolean {
  return muted;
}

// ── Field recordings ─────────────────────────────────────────────────────
// Each atmosphere prefers a real looping field recording bundled at
// /atmospheres/audio/<id>.opus (see scripts/fetch-atmosphere-audio.sh, which
// downloads + loops + encodes the CC-licensed sources). Synthesis below is
// the fallback: it plays whenever the file isn't bundled, fails to load, or
// can't be decoded — so audio never hard-breaks and the app still works
// fully offline.

const sampleCache = new Map<string, AudioBuffer | null>();

async function loadSample(id: string): Promise<AudioBuffer | null> {
  if (sampleCache.has(id)) return sampleCache.get(id) ?? null;
  try {
    const res = await fetch(`/atmospheres/audio/${id}.opus`);
    if (!res.ok) { sampleCache.set(id, null); return null; }
    const bytes = await res.arrayBuffer();
    const decoded = await ensureContext().decodeAudioData(bytes);
    sampleCache.set(id, decoded);
    return decoded;
  } catch {
    // Missing file, offline, or a codec the browser can't decode.
    sampleCache.set(id, null);
    return null;
  }
}

/** Loop a decoded recording with the same slow fade-in the synths use. */
function playSample(buffer: AudioBuffer): ActiveAudio {
  const ac = ensureContext();
  const out = ac.createGain();
  out.gain.value = 0;
  if (masterGain) out.connect(masterGain); // ensureContext() has just set it
  out.gain.linearRampToValueAtTime(0.85, ac.currentTime + 2.2);

  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(out);
  src.start();

  return {
    stop: () => {
      const t = ac.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0, t + 1.0);
      window.setTimeout(() => {
        try { src.stop(); src.disconnect(); out.disconnect(); } catch { /* already gone */ }
      }, 1100);
    },
  };
}

function startSynth(id: Exclude<Atmosphere, 'none'>): ActiveAudio {
  switch (id) {
    case 'fuji':   return startFuji();
    case 'wave':   return startWave();
    case 'snow':   return startSnow();
    case 'fields': return startFields();
    case 'rain':   return startRain();
    // Exhaustiveness gate: adding a fifth atmosphere and forgetting its
    // audio used to compile clean and silently play nothing — now every
    // dispatch site gets a type error until this switch learns the case.
    default: { id satisfies never; return { stop: () => {} }; }
  }
}

/**
 * Switch to a different atmosphere's audio. Fades the old one out,
 * fades the new one in. Pass 'none' to silence.
 */
export function setAtmosphereAudio(id: Atmosphere) {
  if (id === currentId) return;
  currentId = id;
  if (active) {
    active.stop();
    active = null;
  }
  if (id === 'none' || muted) return;
  ensureContext();
  // If the context was suspended (no user gesture yet), defer until first
  // interaction. We'll be re-called from the gesture handler.
  if (ctx && ctx.state === 'suspended') return;

  // Real recording if we have one, synthesis otherwise. The load is async,
  // so re-check that the user hasn't switched away (or muted) before this
  // resolves — otherwise a slow fetch could start audio for a mood that is
  // no longer showing.
  const requested = id;
  void loadSample(id).then((buffer) => {
    if (currentId !== requested || muted || active) return;
    active = buffer ? playSample(buffer) : startSynth(requested);
  });
}

/** Resume the audio context after a user gesture. Browsers require this. */
export function unlockAtmosphereAudio() {
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume().then(() => {
      if (currentId && !active && !muted) {
        const id = currentId;
        currentId = null; // bypass the `id === currentId` early return
        setAtmosphereAudio(id);
      }
    });
  }
}

// ── Signal for the visuals ───────────────────────────────────────────────
// A wave should break on the crash in the recording and a gust should
// follow the wind's loudness, so the visual layers poll a few numbers
// derived from the audio output once per frame.

export interface AtmosphereSignal {
  /** RMS of the output, 0..1. A bundled loop sits around 0.4–0.5. */
  level: number;
  /** Energy in ~20–250 Hz (surf rumble, wind body), 0..1. */
  low: number;
  /** Energy in ~2–8 kHz (hiss, cicadas, chimes), 0..1. */
  high: number;
  /** Rate of rise of `low`, 0..1. Peaks on a crash, decays within ~300 ms. */
  onset: number;
}

interface SignalTap {
  analyser: AnalyserNode;
  time: Float32Array<ArrayBuffer>;
  freq: Float32Array<ArrayBuffer>;
}

const SIGNAL_FFT_SIZE = 1024;
// Pre-master RMS that reads as level 1. The bundled loops are matched to a
// −29 dB mean (scripts/fetch-atmosphere-audio.sh), decode to a mono RMS of
// about 0.03 and play at 0.85, which puts their level near 0.4–0.5 with
// peaks near 1.
const LEVEL_REF = 0.06;
// Band RMS that reads as 1. Measured on the loops: wave's low band sits
// near 0.45 and reaches 1 on a crash; the fields and fuji high bands sit
// near 0.3. The snow loop has almost no 2–8 kHz content, so its high band
// stays near 0.02.
const BAND_REF = 0.04;
const ATTACK_S = 0.05;
const RELEASE_S = 0.4;
// The onset compares `low` with a copy lagged by this much. With one
// frame of lag the per-frame FFT jitter reads as constant small pulses;
// 150 ms keeps a crash at 0.6–1 and the calm stretches under 0.25.
const ONSET_LAG_S = 0.15;
// A rise of `low` at this rate (units per second) reads as onset 1.
const ONSET_FULL_RATE = 2;
const ONSET_DECAY_S = 0.1;
const SIGNAL_CACHE_MS = 8;
// Below this master gain the division is meaningless; treat as silent.
const MIN_GAIN = 0.01;

let signal: AtmosphereSignal | null = null;
let signalAt = 0;
let primed = false;
let sLevel = 0, sLow = 0, sHigh = 0, lowLag = 0, sOnset = 0;

/** True while an atmosphere is producing audible output. */
export function isAtmosphereAudioPlaying(): boolean {
  return active !== null && !muted && ctx?.state === 'running';
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** One-pole envelope follower: fast up, slow down. */
function follow(cur: number, target: number, dt: number): number {
  return cur + (target - cur) * (1 - Math.exp(-dt / (target > cur ? ATTACK_S : RELEASE_S)));
}

/**
 * The current audio signal, or null when nothing is playing (no
 * atmosphere, muted, or the context is still suspended). Computed at most
 * once per ~8 ms; every caller in a frame gets the same object.
 */
export function getAtmosphereSignal(): AtmosphereSignal | null {
  const gain = masterGain?.gain.value ?? 0;
  if (!tap || !isAtmosphereAudioPlaying() || gain < MIN_GAIN) {
    primed = false;
    signal = null;
    return null;
  }
  const now = performance.now();
  if (signal && now - signalAt < SIGNAL_CACHE_MS) return signal;
  const dt = primed ? Math.min(0.1, (now - signalAt) / 1000) : 0;
  signalAt = now;

  const { analyser, time, freq } = tap;
  analyser.getFloatTimeDomainData(time);
  analyser.getFloatFrequencyData(freq);

  let sq = 0;
  for (const s of time) sq += s * s;
  // Divide the master gain out: the analyser is post-fader.
  const rms = Math.sqrt(sq / time.length) / gain;

  // Band energies as a share of the total, so the browser's FFT scaling
  // cancels and each band becomes the RMS of that part of the signal.
  const binHz = analyser.context.sampleRate / analyser.fftSize;
  const lowEnd = Math.floor(250 / binHz);
  const highStart = Math.ceil(2000 / binHz);
  const highEnd = Math.min(freq.length - 1, Math.floor(8000 / binHz));
  let total = 0, lowP = 0, highP = 0;
  let k = 0;
  for (const db of freq) {
    if (k > 0) { // skip DC
      const p = 10 ** (db / 10);
      total += p;
      if (k <= lowEnd) lowP += p;
      else if (k >= highStart && k <= highEnd) highP += p;
    }
    k++;
  }
  const rawLevel = clamp01(rms / LEVEL_REF);
  const rawLow = total > 0 ? clamp01((rms * Math.sqrt(lowP / total)) / BAND_REF) : 0;
  const rawHigh = total > 0 ? clamp01((rms * Math.sqrt(highP / total)) / BAND_REF) : 0;

  if (!primed) {
    // First frame after (re)start: settle on the current values so the
    // fade-in does not read as an onset.
    sLevel = rawLevel; sLow = rawLow; sHigh = rawHigh; lowLag = rawLow; sOnset = 0;
    primed = true;
  } else {
    sLevel = follow(sLevel, rawLevel, dt);
    sLow = follow(sLow, rawLow, dt);
    sHigh = follow(sHigh, rawHigh, dt);
    lowLag += (sLow - lowLag) * (1 - Math.exp(-dt / ONSET_LAG_S));
    const rise = Math.max(0, sLow - lowLag) / ONSET_LAG_S;
    sOnset = Math.max(clamp01(rise / ONSET_FULL_RATE), sOnset * Math.exp(-dt / ONSET_DECAY_S));
  }
  signal = { level: sLevel, low: sLow, high: sHigh, onset: sOnset };
  return signal;
}

// ─────────────────────────────────────────────────────────────────────────
// Per-atmosphere generators
// ─────────────────────────────────────────────────────────────────────────

interface ActiveAudio { stop: () => void }

/** Pentatonic E-minor drone + slow temple-bell chimes. */
function startFuji(): ActiveAudio {
  const ac = ensureContext();
  const out = ac.createGain();
  out.gain.value = 0.0;
  out.connect(masterGain!);
  out.gain.linearRampToValueAtTime(0.32, ac.currentTime + 2.2);

  // Pentatonic E-minor pad: E2, G2, A2, B2, D3 (low + airy)
  const freqs = [82.41, 98.0, 110.0, 123.47, 146.83];
  const oscs: OscillatorNode[] = [];
  freqs.forEach((f, i) => {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.detune.value = (i - 2) * 5;
    const g = ac.createGain();
    g.gain.value = 0.12 + (i === 0 ? 0.06 : 0);
    o.connect(g).connect(out);
    o.start();
    oscs.push(o);
  });

  // Slow amplitude LFO — feel of wind across the pad.
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.05;
  const lfoG = ac.createGain();
  lfoG.gain.value = 0.06;
  lfo.connect(lfoG).connect(out.gain);
  lfo.start();

  // Distant wind: pink noise band-passed around 600Hz, very low.
  const windNoise = pinkNoise(ac);
  const windBp = ac.createBiquadFilter();
  windBp.type = 'bandpass';
  windBp.frequency.value = 600;
  windBp.Q.value = 1.2;
  const windGain = ac.createGain();
  windGain.gain.value = 0.05;
  windNoise.connect(windBp).connect(windGain).connect(out);

  // Multi-partial bronze bell every 22-38s.
  const bellTimer = window.setInterval(() => {
    if (!ctx) return;
    bronzeBell(ac, out, 280 + Math.random() * 180);
  }, 26000);

  // Sparse koto pluck on the pentatonic — every 14-22s.
  const kotoTimer = window.setInterval(() => {
    if (!ctx) return;
    const pentatonic = [329.63, 392.0, 440.0, 493.88, 587.33]; // E4-D5
    pluck(ac, out, pentatonic[Math.floor(Math.random() * pentatonic.length)]!, 0.06, 1.2);
  }, 17000);

  return {
    stop: () => {
      window.clearInterval(bellTimer);
      window.clearInterval(kotoTimer);
      const t = ac.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0, t + 1.0);
      window.setTimeout(() => {
        try { oscs.forEach((o) => o.stop()); lfo.stop(); windNoise.disconnect(); out.disconnect(); } catch { /* */ }
      }, 1100);
    },
  };
}

/** Ocean swell — brown noise low-passed with a swell LFO, deep
 *  sub-rumble layer underneath, occasional distant gull cry and
 *  bell-buoy clang, slow stereo pan so the surf moves across the ears. */
function startWave(): ActiveAudio {
  const ac = ensureContext();
  const out = ac.createGain();
  out.gain.value = 0.0;
  out.connect(masterGain!);
  out.gain.linearRampToValueAtTime(0.38, ac.currentTime + 2.5);

  // Main surf — brown noise via stereo panner for slow L/R movement.
  const noise = brownNoise(ac);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  lp.Q.value = 0.6;
  const swellGain = ac.createGain();
  swellGain.gain.value = 0.6;
  const panner = ac.createStereoPanner();
  noise.connect(lp).connect(swellGain).connect(panner).connect(out);

  // Slow swell LFO — ocean breath, ~9s period.
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.11;
  const lfoG = ac.createGain();
  lfoG.gain.value = 0.32;
  lfo.connect(lfoG).connect(swellGain.gain);
  lfo.start();

  // Stereo movement LFO — different period from the swell so it
  // doesn't sync. -0.5 to 0.5 pan range.
  const panLfo = ac.createOscillator();
  panLfo.frequency.value = 0.07;
  const panLfoG = ac.createGain();
  panLfoG.gain.value = 0.5;
  panLfo.connect(panLfoG).connect(panner.pan);
  panLfo.start();

  // Sub-rumble: 35Hz sine with a very slow tremolo, body of the ocean.
  const sub = ac.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = 35;
  const subGain = ac.createGain();
  subGain.gain.value = 0.10;
  sub.connect(subGain).connect(out);
  sub.start();

  // Gull cry every 35-65s — quick frequency sweep with vibrato.
  const gullTimer = window.setInterval(() => {
    if (!ctx) return;
    gullCry(ac, out);
  }, 48000);

  // Bell buoy every 70-120s — single low metallic ping.
  const buoyTimer = window.setInterval(() => {
    if (!ctx) return;
    bronzeBell(ac, out, 180 + Math.random() * 60, 0.06);
  }, 90000);

  return {
    stop: () => {
      window.clearInterval(gullTimer);
      window.clearInterval(buoyTimer);
      const t = ac.currentTime;
      out.gain.linearRampToValueAtTime(0, t + 1.0);
      window.setTimeout(() => {
        try { lfo.stop(); panLfo.stop(); sub.stop(); noise.disconnect(); out.disconnect(); } catch { /* */ }
      }, 1100);
    },
  };
}

/** Snowy night — high-passed pink noise (snow hush), slow breath LFO,
 *  faint shimmer overtone, sparse bell-cluster (three soft bells at
 *  once like temple wind chimes catching a gust). */
function startSnow(): ActiveAudio {
  const ac = ensureContext();
  const out = ac.createGain();
  out.gain.value = 0.0;
  out.connect(masterGain!);
  out.gain.linearRampToValueAtTime(0.25, ac.currentTime + 2.5);

  // Snow hush — pink noise band 1.1-3.8 kHz.
  const noise = pinkNoise(ac);
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1100;
  hp.Q.value = 0.3;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3800;
  const breath = ac.createGain();
  breath.gain.value = 0.6;
  noise.connect(hp).connect(lp).connect(breath).connect(out);

  // Wind breath LFO — 8-14s.
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.085;
  const lfoG = ac.createGain();
  lfoG.gain.value = 0.3;
  lfo.connect(lfoG).connect(breath.gain);
  lfo.start();

  // Shimmer overtone: cluster of 4 high sines, very low gain. Sounds
  // like distant ice crystals if you listen carefully.
  const shimmerOscs: OscillatorNode[] = [];
  [5240, 6210, 7670, 9120].forEach((f) => {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.detune.value = (Math.random() - 0.5) * 10;
    const g = ac.createGain();
    g.gain.value = 0.008;
    o.connect(g).connect(out);
    o.start();
    shimmerOscs.push(o);
  });

  // Bell cluster every ~38s — 3 soft bells together with detune.
  const bellTimer = window.setInterval(() => {
    if (!ctx) return;
    const base = 540 + Math.random() * 240;
    bronzeBell(ac, out, base, 0.045);
    window.setTimeout(() => bronzeBell(ac, out, base * 1.18, 0.035), 200);
    window.setTimeout(() => bronzeBell(ac, out, base * 1.5,  0.025), 480);
  }, 38000);

  return {
    stop: () => {
      window.clearInterval(bellTimer);
      const t = ac.currentTime;
      out.gain.linearRampToValueAtTime(0, t + 1.0);
      window.setTimeout(() => {
        try { lfo.stop(); shimmerOscs.forEach((o) => o.stop()); noise.disconnect(); out.disconnect(); } catch { /* */ }
      }, 1100);
    },
  };
}

/** Summer fields — warm pad (A2/E3 triangles), bee buzz (detuned low
 *  sawtooth), cicada texture (filtered noise bursts), occasional flute
 *  notes that sustain like a distant farmer's pipe. */
function startFields(): ActiveAudio {
  const ac = ensureContext();
  const out = ac.createGain();
  out.gain.value = 0.0;
  out.connect(masterGain!);
  out.gain.linearRampToValueAtTime(0.3, ac.currentTime + 2.5);

  // Warm pad — two triangle oscillators with a low-pass.
  const freqs = [110.0, 164.81]; // A2 + E3
  const oscs: OscillatorNode[] = [];
  freqs.forEach((f) => {
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = ac.createGain();
    g.gain.value = 0.16;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 850;
    o.connect(lp).connect(g).connect(out);
    o.start();
    oscs.push(o);
  });

  // Bee buzz — two detuned sawtooths around 200Hz, wandering frequency
  // for that "bumblebee in the wheat" feel.
  const bee1 = ac.createOscillator();
  const bee2 = ac.createOscillator();
  bee1.type = 'sawtooth';
  bee2.type = 'sawtooth';
  bee1.frequency.value = 198;
  bee2.frequency.value = 204;
  const beeLp = ac.createBiquadFilter();
  beeLp.type = 'lowpass';
  beeLp.frequency.value = 580;
  const beeGain = ac.createGain();
  beeGain.gain.value = 0.025;
  bee1.connect(beeLp); bee2.connect(beeLp);
  beeLp.connect(beeGain).connect(out);
  bee1.start(); bee2.start();
  // Wander the bee frequency with an LFO so it doesn't sit static.
  const beeLfo = ac.createOscillator();
  beeLfo.frequency.value = 0.18;
  const beeLfoG = ac.createGain();
  beeLfoG.gain.value = 9;
  beeLfo.connect(beeLfoG).connect(bee1.frequency);
  beeLfo.start();

  // Cicada texture — short noise bursts band-passed around 4kHz,
  // every 4-9s. Stops when the page is hidden so we don't drain CPU.
  const cicadaTimer = window.setInterval(() => {
    if (!ctx || document.hidden) return;
    cicadaChirp(ac, out);
  }, 6500);

  // Distant flute — long sustained sine notes on F major pentatonic.
  const fluteTimer = window.setInterval(() => {
    if (!ctx) return;
    const notes = [349.23, 392.0, 440.0, 523.25, 587.33]; // F4-D5
    fluteNote(ac, out, notes[Math.floor(Math.random() * notes.length)]!);
  }, 24000);

  return {
    stop: () => {
      window.clearInterval(cicadaTimer);
      window.clearInterval(fluteTimer);
      const t = ac.currentTime;
      out.gain.linearRampToValueAtTime(0, t + 1.0);
      window.setTimeout(() => {
        try { oscs.forEach((o) => o.stop()); bee1.stop(); bee2.stop(); beeLfo.stop(); out.disconnect(); } catch { /* */ }
      }, 1100);
    },
  };
}

/** Steady rain — pink noise band-passed to a hiss, a slow breath LFO so
 *  the shower swells and eases, and sparse high drips. */
function startRain(): ActiveAudio {
  const ac = ensureContext();
  const out = ac.createGain();
  out.gain.value = 0.0;
  if (masterGain) out.connect(masterGain); // ensureContext() has just set it
  out.gain.linearRampToValueAtTime(0.3, ac.currentTime + 2.5);

  // Rain hiss — pink noise band 900 Hz–5 kHz.
  const noise = pinkNoise(ac);
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 900;
  hp.Q.value = 0.4;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 5000;
  const breath = ac.createGain();
  breath.gain.value = 0.7;
  noise.connect(hp).connect(lp).connect(breath).connect(out);

  // Shower LFO — ~12 s.
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.08;
  const lfoG = ac.createGain();
  lfoG.gain.value = 0.25;
  lfo.connect(lfoG).connect(breath.gain);
  lfo.start();

  // Drips — a short high pluck every ~1.4 s at a random pitch.
  const dripTimer = window.setInterval(() => {
    if (!ctx || document.hidden) return;
    pluck(ac, out, 1600 + Math.random() * 1000, 0.02, 0.25);
  }, 1400);

  return {
    stop: () => {
      window.clearInterval(dripTimer);
      const t = ac.currentTime;
      out.gain.linearRampToValueAtTime(0, t + 1.0);
      window.setTimeout(() => {
        try { lfo.stop(); noise.disconnect(); out.disconnect(); } catch { /* */ }
      }, 1100);
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Noise sources + helpers
// ─────────────────────────────────────────────────────────────────────────

function brownNoise(ac: AudioContext): AudioBufferSourceNode {
  const buf = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    data[i] = last * 3.5;
  }
  const node = ac.createBufferSource();
  node.buffer = buf;
  node.loop = true;
  node.start();
  return node;
}

function pinkNoise(ac: AudioContext): AudioBufferSourceNode {
  const buf = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  const node = ac.createBufferSource();
  node.buffer = buf;
  node.loop = true;
  node.start();
  return node;
}


function pluck(ac: AudioContext, out: AudioNode, freq: number, vol = 0.04, durSec = 0.9) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  const t = ac.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + durSec);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + durSec + 0.05);
}

/** Multi-partial bronze bell — a fundamental plus three inharmonic
 *  overtones each with its own decay. The slight detune between
 *  partials makes them beat against each other and sound like a real
 *  cast bell instead of a sine ping. */
function bronzeBell(ac: AudioContext, out: AudioNode, freq: number, vol = 0.08) {
  const partials = [
    { mult: 1.0,  amp: 1.00, dur: 5.0 },
    { mult: 2.76, amp: 0.55, dur: 3.0 },
    { mult: 5.40, amp: 0.32, dur: 2.0 },
    { mult: 8.93, amp: 0.18, dur: 1.2 },
  ];
  const t = ac.currentTime;
  partials.forEach((p) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = freq * p.mult;
    o.detune.value = (Math.random() - 0.5) * 6;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * p.amp, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + p.dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + p.dur + 0.1);
  });
}

/** Gull cry — sine sweeping down with quick vibrato, lasts ~600ms. */
function gullCry(ac: AudioContext, out: AudioNode) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'sine';
  const t = ac.currentTime;
  o.frequency.setValueAtTime(1800, t);
  o.frequency.exponentialRampToValueAtTime(900, t + 0.35);
  o.frequency.exponentialRampToValueAtTime(620, t + 0.6);
  // Vibrato
  const vib = ac.createOscillator();
  vib.frequency.value = 9;
  const vibG = ac.createGain();
  vibG.gain.value = 35;
  vib.connect(vibG).connect(o.frequency);
  vib.start(t);
  vib.stop(t + 0.65);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.05, t + 0.04);
  g.gain.linearRampToValueAtTime(0, t + 0.6);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.65);
}

/** Cicada chirp — short burst of band-passed noise around 4kHz. */
function cicadaChirp(ac: AudioContext, out: AudioNode) {
  const buf = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 4200;
  bp.Q.value = 8;
  const g = ac.createGain();
  const t = ac.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.022, t + 0.04);
  g.gain.linearRampToValueAtTime(0, t + 0.35);
  src.connect(bp).connect(g).connect(out);
  src.start(t);
  src.stop(t + 0.4);
}

/** Distant flute note — slow attack sine with a slight vibrato. */
function fluteNote(ac: AudioContext, out: AudioNode, freq: number) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  const t = ac.currentTime;
  const vib = ac.createOscillator();
  vib.frequency.value = 5.5;
  const vibG = ac.createGain();
  vibG.gain.value = 3;
  vib.connect(vibG).connect(o.frequency);
  vib.start(t);
  vib.stop(t + 3.0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.035, t + 0.4);
  g.gain.linearRampToValueAtTime(0.025, t + 1.6);
  g.gain.linearRampToValueAtTime(0, t + 3.0);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 3.05);
}

/** UI sounds — tiny click + save chime + page-turn whoosh. Mixed
 *  through the master gain so they respect the user's volume + mute
 *  preferences. */
export function playUiSound(kind: 'tick' | 'chime' | 'whoosh') {
  if (muted || !ctx || !masterGain || ctx.state !== 'running') return;
  const ac = ctx;
  const out = ac.createGain();
  out.gain.value = 0.4;
  out.connect(masterGain);
  switch (kind) {
    case 'tick': {
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.value = 2200;
      const g = ac.createGain();
      const t = ac.currentTime;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.03, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      o.connect(g).connect(out);
      o.start(t); o.stop(t + 0.1);
      window.setTimeout(() => out.disconnect(), 200);
      break;
    }
    case 'chime':
      bronzeBell(ac, out, 740, 0.05);
      window.setTimeout(() => out.disconnect(), 5500);
      break;
    case 'whoosh': {
      const buf = ac.createBuffer(1, ac.sampleRate * 0.35, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource();
      src.buffer = buf;
      const filt = ac.createBiquadFilter();
      filt.type = 'lowpass';
      const t = ac.currentTime;
      filt.frequency.setValueAtTime(280, t);
      filt.frequency.linearRampToValueAtTime(2200, t + 0.18);
      filt.frequency.linearRampToValueAtTime(380, t + 0.34);
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.04, t + 0.05);
      g.gain.linearRampToValueAtTime(0, t + 0.34);
      src.connect(filt).connect(g).connect(out);
      src.start(t); src.stop(t + 0.4);
      window.setTimeout(() => out.disconnect(), 500);
      break;
    }
  }
}
