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
 *
 * The whole thing is < 4 KB minified. No autoplay — needs an explicit
 * `start()` from a user gesture (browser autoplay policy). Master
 * volume + mute state persist to localStorage.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let active: { stop: () => void } | null = null;
let currentId: string | null = null;
let storedVolume = 0.35;
let muted = false;

try {
  const v = localStorage.getItem('markview-atmosphere-volume');
  if (v !== null) storedVolume = Math.min(1, Math.max(0, parseFloat(v)));
  muted = localStorage.getItem('markview-atmosphere-muted') === 'true';
} catch {
  /* ignore */
}

function ensureContext(): AudioContext {
  if (!ctx) {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : storedVolume;
    masterGain.connect(ctx.destination);
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

export function setAtmosphereVolume(v: number) {
  storedVolume = Math.min(1, Math.max(0, v));
  try { localStorage.setItem('markview-atmosphere-volume', String(storedVolume)); } catch { /* ignore */ }
  if (!muted) rampGainTo(storedVolume, 0.3);
}

export function getAtmosphereVolume(): number {
  return storedVolume;
}

export function setAtmosphereMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem('markview-atmosphere-muted', String(muted)); } catch { /* ignore */ }
  rampGainTo(muted ? 0 : storedVolume, 0.3);
}

export function isAtmosphereMuted(): boolean {
  return muted;
}

/**
 * Switch to a different atmosphere's audio. Fades the old one out,
 * fades the new one in. Pass 'none' to silence.
 */
export function setAtmosphereAudio(id: string) {
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

  switch (id) {
    case 'fuji':   active = startFuji();   break;
    case 'wave':   active = startWave();   break;
    case 'snow':   active = startSnow();   break;
    case 'fields': active = startFields(); break;
  }
}

/** Resume the audio context after a user gesture. Browsers require this. */
export function unlockAtmosphereAudio() {
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume().then(() => {
      if (currentId && !active && !muted) setAtmosphereAudio(currentId);
    });
  }
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

  // Temple bell every 18-32s
  const bellTimer = window.setInterval(() => {
    if (!ctx) return;
    bellPing(ac, out, 330 + Math.random() * 220);
  }, 22000);

  return {
    stop: () => {
      window.clearInterval(bellTimer);
      const t = ac.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0, t + 1.0);
      window.setTimeout(() => {
        try { oscs.forEach((o) => o.stop()); lfo.stop(); out.disconnect(); } catch { /* */ }
      }, 1100);
    },
  };
}

/** Filtered brown noise swelling like ocean breath. */
function startWave(): ActiveAudio {
  const ac = ensureContext();
  const out = ac.createGain();
  out.gain.value = 0.0;
  out.connect(masterGain!);
  out.gain.linearRampToValueAtTime(0.38, ac.currentTime + 2.5);

  const noise = brownNoise(ac);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  lp.Q.value = 0.6;
  const swellGain = ac.createGain();
  swellGain.gain.value = 0.6;
  noise.connect(lp).connect(swellGain).connect(out);

  // Slow swell LFO — ocean breath, 7-12s period.
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.11;
  const lfoG = ac.createGain();
  lfoG.gain.value = 0.32;
  lfo.connect(lfoG).connect(swellGain.gain);
  lfo.start();

  return {
    stop: () => {
      const t = ac.currentTime;
      out.gain.linearRampToValueAtTime(0, t + 1.0);
      window.setTimeout(() => { try { lfo.stop(); noise.disconnect(); out.disconnect(); } catch { /* */ } }, 1100);
    },
  };
}

/** Hushed pink noise + sparse muted bells (snowy night quiet). */
function startSnow(): ActiveAudio {
  const ac = ensureContext();
  const out = ac.createGain();
  out.gain.value = 0.0;
  out.connect(masterGain!);
  out.gain.linearRampToValueAtTime(0.25, ac.currentTime + 2.5);

  const noise = pinkNoise(ac);
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1100;
  hp.Q.value = 0.3;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3800;
  noise.connect(hp).connect(lp).connect(out);

  const bellTimer = window.setInterval(() => {
    if (!ctx) return;
    bellPing(ac, out, 580 + Math.random() * 300, 0.05);
  }, 28000);

  return {
    stop: () => {
      window.clearInterval(bellTimer);
      const t = ac.currentTime;
      out.gain.linearRampToValueAtTime(0, t + 1.0);
      window.setTimeout(() => { try { noise.disconnect(); out.disconnect(); } catch { /* */ } }, 1100);
    },
  };
}

/** Warm pad + sparse high pluck (cicada/bird in wheat). */
function startFields(): ActiveAudio {
  const ac = ensureContext();
  const out = ac.createGain();
  out.gain.value = 0.0;
  out.connect(masterGain!);
  out.gain.linearRampToValueAtTime(0.3, ac.currentTime + 2.5);

  // Two warm low oscillators
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

  // Sparse pluck — high sine envelope every 6-14s
  const pluckTimer = window.setInterval(() => {
    if (!ctx) return;
    pluck(ac, out, 1200 + Math.random() * 800);
  }, 9000);

  return {
    stop: () => {
      window.clearInterval(pluckTimer);
      const t = ac.currentTime;
      out.gain.linearRampToValueAtTime(0, t + 1.0);
      window.setTimeout(() => { try { oscs.forEach((o) => o.stop()); out.disconnect(); } catch { /* */ } }, 1100);
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

function bellPing(ac: AudioContext, out: AudioNode, freq: number, vol = 0.08) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  const t = ac.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 4.6);
}

function pluck(ac: AudioContext, out: AudioNode, freq: number) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  const t = ac.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.04, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.95);
}
