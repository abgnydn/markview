// SPDX-License-Identifier: Apache-2.0
//
// Synthesized sound effects for the 3D constellation — all generated at
// runtime via the Web Audio API. No audio files, no network, no licensing.
// AudioContext must be (re)started from a user gesture, so call ensure()
// on the first click/tap.

export class ConstellationSfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private padNodes: { stop: () => void } | null = null;
  private airGain: GainNode | null = null;     // dynamic "music" layer
  muted = false;

  ensure() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Booster-pack tear: a sharp filtered-noise rip with a crackle tail.
  rip() {
    const ctx = this.ctx, master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.6);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(800, t);
    bp.frequency.exponentialRampToValueAtTime(4500, t + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    src.connect(bp).connect(g).connect(master);
    src.start(t);
    src.stop(t + 0.6);
  }

  // Card flip whoosh — short airy noise sweep.
  flip() {
    const ctx = this.ctx, master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.18);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(600, t);
    lp.frequency.exponentialRampToValueAtTime(5000, t + 0.1);
    lp.frequency.exponentialRampToValueAtTime(900, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    src.connect(lp).connect(g).connect(master);
    src.start(t);
    src.stop(t + 0.2);
  }

  // Bright bell-ish shimmer for hover/holo.
  shimmer() {
    const ctx = this.ctx, master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    [1567, 2093, 2637].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.01 + i * 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.55);
    });
  }

  // FM bell chime — a clean "rare" ping.
  chime() {
    const ctx = this.ctx, master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    carrier.frequency.value = 1046; // C6
    mod.frequency.value = 1046 * 2.01;
    modGain.gain.value = 600;
    mod.connect(modGain).connect(carrier.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    carrier.connect(g).connect(master);
    carrier.start(t); mod.start(t);
    carrier.stop(t + 1.3); mod.stop(t + 1.3);
  }

  // Secret-rare sting — a swelling major-7 chord with a shimmer on top.
  secret() {
    const ctx = this.ctx, master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 987.77]; // C E G B
    chord.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i < 2 ? "triangle" : "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.18);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 1.7);
    });
    // sparkle on top
    const t2 = t + 0.12;
    [2093, 2637, 3136].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t2 + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.05, t2 + i * 0.05 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t2 + i * 0.05 + 0.6);
      o.connect(g).connect(master);
      o.start(t2 + i * 0.05);
      o.stop(t2 + i * 0.05 + 0.7);
    });
  }

  // A soft tuned pluck — one note per element type, so stepping through
  // cards plays a melody. `semi` is semitones above a low root.
  note(semi: number, pan = 0) {
    const ctx = this.ctx, master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    const freq = 220 * Math.pow(2, semi / 12);
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = freq * 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    const g2 = ctx.createGain();
    g2.gain.value = 0.4;
    let out: AudioNode = g;
    if (typeof ctx.createStereoPanner === "function") {
      const pn = ctx.createStereoPanner();
      pn.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(pn); out = pn;
    }
    out.connect(master);
    o2.connect(g2).connect(g);
    o.start(t); o2.start(t);
    o.stop(t + 0.75); o2.stop(t + 0.75);
  }

  // Dynamic music: a high airy layer that swells as the cardex fills.
  setIntensity(v: number) {
    if (this.airGain && this.ctx) this.airGain.gain.setTargetAtTime(0.012 + Math.max(0, Math.min(1, v)) * 0.05, this.ctx.currentTime, 1.2);
  }

  // Low cosmic ambient drone — sustained, very quiet, under everything.
  startPad() {
    const ctx = this.ctx, master = this.master;
    if (!ctx || !master || this.padNodes) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 3);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 500;
    g.connect(lp).connect(master);
    const oscs = [55, 82.4, 110, 164.8].map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? "sine" : "triangle";
      o.frequency.value = f;
      const detune = ctx.createOscillator();
      detune.frequency.value = 0.05 + i * 0.03;
      const dg = ctx.createGain();
      dg.gain.value = 3;
      detune.connect(dg).connect(o.detune);
      o.connect(g);
      o.start(t); detune.start(t);
      return { o, detune };
    });
    // airy "music" layer — gain rises with the cardex (setIntensity)
    const air = ctx.createGain(); air.gain.value = 0.012;
    const airLp = ctx.createBiquadFilter(); airLp.type = "lowpass"; airLp.frequency.value = 2200;
    air.connect(airLp).connect(master);
    this.airGain = air;
    const airOscs = [330, 440, 554].map((f, i) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = i === 0 ? 0.5 : 0.3;
      o.connect(og).connect(air); o.start(t); return o;
    });

    this.padNodes = {
      stop: () => {
        const tt = ctx.currentTime;
        g.gain.setTargetAtTime(0.0001, tt, 0.5);
        air.gain.setTargetAtTime(0.0001, tt, 0.5);
        oscs.forEach(({ o, detune }) => { o.stop(tt + 2); detune.stop(tt + 2); });
        airOscs.forEach((o) => o.stop(tt + 2));
      },
    };
  }

  stopPad() {
    this.padNodes?.stop();
    this.padNodes = null;
  }

  dispose() {
    this.stopPad();
    this.ctx?.close();
    this.ctx = null;
  }
}
