// SPDX-License-Identifier: Apache-2.0
/**
 * Accumulation — what the particles leave behind, and the light they fall
 * through.
 *
 * The old layer stamped a soft radial blob wherever a particle reached the
 * bottom band and let the whole canvas fade. It read as white smudges,
 * because that is what it was: nothing was ever ON anything.
 *
 * These are surface models. Each atmosphere has its own:
 *
 *   snow    — a heightfield the flakes land ON (Bank, SNOW look): a flake
 *             stops where the pile already is, so the drift grows under the
 *             fall; between frames it slumps into mounds and melts slowly.
 *             Two surfaces: the ground, and the scroll's top rod, which
 *             collects a ridge like a windowsill.
 *   fields  — the same heightfield as a thin dust film (Bank, DUST look)
 *             under a litter of fallen chaff, lit by shafts of afternoon sun
 *             (Shafts) — dust is only visible where light crosses it.
 *   wave    — the sea's edge (Surf): a wash of water that runs up and back
 *             with each break, foam that piles where the wave broke and
 *             dissolves, bubbles that pop, and rings where spray hits the
 *             water.
 *   petals  — do not pile, they scatter: each is stamped where it lands as
 *             the actual petal sprite, lying flat at a random rest angle.
 *
 * Everything here is in CSS pixels; the caller scales the context by DPR.
 */

export interface RodSurface {
  /** Screen-space x extent of the rod's top edge, CSS px. */
  x0: number;
  x1: number;
  /** Screen-space y of the rod's top edge, CSS px from the viewport top. */
  y: number;
}

const CELL = 3;               // heightfield resolution, CSS px per sample

type Rgb = [number, number, number];
const rgba = (c: Rgb, a: number): string => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a.toFixed(3)})`;

/** What a pile is made of — snow and dust share the physics, not the look. */
export interface PileLook {
  groundMax: number;          // px — where growth has effectively stopped
  rodMax: number;
  slump: number;              // diffusion rate: how fast peaks spread into mounds
  meltPerSec: number;         // fraction of height lost per second
  seed: (x: number) => number;   // initial ground height at screen x
  relief: number;             // crest roughness, px at full height
  body: [string, string, string];   // gradient: crest, mid, base
  ao: { color: Rgb; alpha: number; blur: number };
  shade: { dark: Rgb; darkAlpha: number; lightAlpha: number };
  grain: number;              // multiply-noise opacity
  crest: { color: string; width: number };
  glint: { color: Rgb; every: number; max: number };
}

export const SNOW_LOOK: PileLook = {
  groundMax: 96,
  rodMax: 11,
  slump: 1.35,
  meltPerSec: 0.0012,        // ~10 minutes to lose half a pile with no new snow
  // The ground already has snow on it; a winter scene does not start bare.
  // A low, slow undulation, so the first flakes land on a drift with a
  // shape rather than on a ruler.
  seed: (x) => 9 + 7 * Math.sin(x * 0.011) + 4.5 * Math.sin(x * 0.031 + 1.3) + 2.5 * Math.sin(x * 0.073 + 0.4) + 1.5 * Math.sin(x * 0.19 + 2.1),
  relief: 2.2,
  // White at the crest, going cool in its own shadow toward the base.
  // Fresh snow is never grey; its shade is blue.
  body: ['rgba(255, 255, 255, 0.99)', 'rgba(244, 247, 251, 0.98)', 'rgba(214, 224, 238, 0.97)'],
  ao: { color: [28, 40, 62], alpha: 0.42, blur: 22 },
  shade: { dark: [92, 112, 148], darkAlpha: 0.34, lightAlpha: 0.5 },
  grain: 0.16,
  crest: { color: 'rgba(255, 255, 255, 0.95)', width: 1.6 },
  glint: { color: [255, 255, 255], every: 0.08, max: 44 },
};

export const DUST_LOOK: PileLook = {
  groundMax: 9,
  rodMax: 3.5,
  slump: 0.9,
  meltPerSec: 0.0005,
  seed: () => 0,             // a floor starts clean; the film is what settles on it
  relief: 1.0,
  // Dry, warm, and matte: straw and pollen, lit from the same upper-left.
  body: ['rgba(246, 230, 186, 0.92)', 'rgba(226, 198, 138, 0.9)', 'rgba(186, 148, 86, 0.88)'],
  ao: { color: [78, 52, 18], alpha: 0.32, blur: 8 },
  shade: { dark: [118, 84, 34], darkAlpha: 0.36, lightAlpha: 0.42 },
  grain: 0.22,
  crest: { color: 'rgba(255, 244, 208, 0.8)', width: 1.0 },
  glint: { color: [255, 238, 176], every: 0.16, max: 22 },
};

export class Bank {
  private ground = new Float32Array(1);
  private rod = new Float32Array(1);
  private rx0 = 0;
  private rx1 = 0;
  private rodY = -1;
  private width = 1;
  private noise: HTMLCanvasElement | null = null;
  private sparkles: { x: number; life: number; max: number; on: 'ground' | 'rod' }[] = [];
  private sparkleClock = 0;

  constructor(private readonly look: PileLook) {}

  resize(widthCss: number): void {
    this.width = Math.max(1, widthCss);
    const cells = Math.ceil(this.width / CELL) + 1;
    if (this.ground.length !== cells) {
      const next = new Float32Array(cells);
      for (let i = 0; i < cells; i++) next[i] = this.look.seed(i * CELL);
      this.ground = next;
    }
  }

  /** The scroll's top rod, or null when it is off-screen. */
  setRod(rod: RodSurface | null): void {
    if (!rod) { this.rodY = -1; return; }
    const cells = Math.max(1, Math.ceil((rod.x1 - rod.x0) / CELL) + 1);
    if (this.rod.length !== cells) this.rod = new Float32Array(cells);
    this.rx0 = rod.x0; this.rx1 = rod.x1; this.rodY = rod.y;
  }

  /** Height of the ground pile at screen x, CSS px above the viewport bottom. */
  groundHeightAt(x: number): number {
    const i = Math.max(0, Math.min(this.ground.length - 1, Math.round(x / CELL)));
    return this.ground[i];
  }

  /** Height of the rod ridge at screen x, or -1 when x is off the rod. */
  rodHeightAt(x: number): number {
    if (this.rodY < 0 || x < this.rx0 || x > this.rx1) return -1;
    const i = Math.max(0, Math.min(this.rod.length - 1, Math.round((x - this.rx0) / CELL)));
    return this.rod[i];
  }

  get rodTop(): number { return this.rodY; }
  get rodX0(): number { return this.rx0; }
  get rodX1(): number { return this.rx1; }

  /**
   * The rod has been shaken: a fraction of its ridge falls off. Returns
   * the height lost, summed over the rod, so the caller knows how much to
   * drop back into the air (0 when there was nothing to shed).
   */
  shedRod(fraction: number): number {
    if (this.rodY < 0) return 0;
    let lost = 0;
    for (let i = 0; i < this.rod.length; i++) {
      const d = this.rod[i] * fraction * (0.6 + Math.random() * 0.8);
      this.rod[i] -= d;
      lost += d;
    }
    return lost;
  }

  /** A particle of `size` px has landed at screen x on the given surface. */
  deposit(x: number, size: number, on: 'ground' | 'rod', scale = 1): void {
    const field = on === 'ground' ? this.ground : this.rod;
    const max = on === 'ground' ? this.look.groundMax : this.look.rodMax;
    const cx = on === 'ground' ? x / CELL : (x - this.rx0) / CELL;
    // Kernel width varies flake to flake, so the pile is built from mounds
    // of different sizes rather than one smooth ramp.
    const radius = Math.max(2.5, size * (0.5 + Math.random() * 0.9)) / CELL;   // cells
    // Tuned so a drift is unmistakable inside half a minute and sculptural
    // inside two; real snow is slower, but nobody watches a screen for an
    // hour to find out whether it piles.
    const amount = (2.4 + size * 0.45) * scale;           // px of height, spread over the kernel
    const i0 = Math.max(0, Math.floor(cx - radius)), i1 = Math.min(field.length - 1, Math.ceil(cx + radius));
    for (let i = i0; i <= i1; i++) {
      const t = (i - cx) / radius;
      const k = Math.exp(-t * t * 2.2);                   // gaussian kernel
      // Growth slows as the pile approaches its cap, so it settles into a
      // drift instead of climbing forever.
      const room = 1 - field[i] / max;
      field[i] += amount * k * Math.max(0, room);
    }
  }

  step(dt: number): void {
    this.relax(this.ground, dt);
    if (this.rodY >= 0) this.relax(this.rod, dt);
    // Glints. A snow surface catches the light in a few moving points; each
    // one lives a second or two, then another appears elsewhere.
    this.sparkleClock += dt;
    if (this.sparkleClock > this.look.glint.every && this.sparkles.length < this.look.glint.max) {
      this.sparkleClock = 0;
      const onRod = this.rodY >= 0 && Math.random() < 0.25;
      const x = onRod ? this.rx0 + Math.random() * (this.rx1 - this.rx0) : Math.random() * this.width;
      const max = 0.8 + Math.random() * 1.6;
      this.sparkles.push({ x, life: max, max, on: onRod ? 'rod' : 'ground' });
    }
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      this.sparkles[i].life -= dt;
      if (this.sparkles[i].life <= 0) this.sparkles.splice(i, 1);
    }
  }

  private relax(field: Float32Array, dt: number): void {
    const n = field.length;
    if (n < 3) return;
    const k = Math.min(0.45, this.look.slump * dt);
    let prev = field[0];
    for (let i = 1; i < n - 1; i++) {
      const cur = field[i];
      const next = field[i + 1];
      field[i] = cur + k * (prev + next - 2 * cur);
      prev = cur;
    }
    const melt = 1 - this.look.meltPerSec * dt;
    for (let i = 0; i < n; i++) field[i] *= melt;
  }

  /** Draw the ground pile and the rod ridge. Context is in CSS px. Does not clear. */
  render(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    this.drawPile(ctx, this.ground, 0, W, H, 'ground');
    if (this.rodY >= 0) this.drawPile(ctx, this.rod, this.rx0, this.rx1, this.rodY, 'rod');
  }

  private drawPile(ctx: CanvasRenderingContext2D, field: Float32Array, x0: number, x1: number, base: number, on: 'ground' | 'rod'): void {
    const look = this.look;
    let peak = 0;
    for (let i = 0; i < field.length; i++) if (field[i] > peak) peak = field[i];
    if (peak < 0.6) return;

    // A dusting is translucent; only a deep drift is opaque. Without this
    // a 1px pile renders the full opaque body + crest and reads as a solid
    // bar floating over the painting.
    const weight = Math.min(1, peak / 10);

    // Crest through the field's midpoints, with a stable per-cell grain so
    // the edge is crystalline rather than a spline — snow is granular at
    // every scale, and a perfectly smooth crest reads as plastic.
    const reliefAmp = on === 'ground' ? look.relief : look.relief * 0.55;
    const relief = (i: number): number => {
      const h = Math.sin(i * 12.9898) * 43758.5453;
      return (h - Math.floor(h) - 0.5) * reliefAmp * Math.min(1, field[i] / 10);
    };
    const top = (i: number): number => base - field[i] + relief(i);
    const crest = (): void => {
      ctx.moveTo(x0, top(0));
      for (let i = 1; i < field.length; i++) {
        const xa = x0 + (i - 1) * CELL, xb = x0 + i * CELL;
        const ya = top(i - 1), yb = top(i);
        ctx.quadraticCurveTo(xa, ya, (xa + xb) / 2, (ya + yb) / 2);
      }
      ctx.lineTo(x1, top(field.length - 1));
    };
    const body = (): void => {
      ctx.beginPath();
      crest();
      ctx.lineTo(x1, base + (on === 'ground' ? 2 : 6));
      ctx.lineTo(x0, base + (on === 'ground' ? 2 : 6));
      ctx.closePath();
    };

    // 1. Ambient occlusion under the crest: the ground beside a drift is in
    //    its shadow. Drawn first, bigger and blurred, so the pile sits in it.
    ctx.save();
    ctx.globalAlpha = weight;
    body();
    ctx.shadowColor = rgba(look.ao.color, look.ao.alpha);
    ctx.shadowBlur = on === 'ground' ? look.ao.blur : look.ao.blur * 0.36;
    ctx.shadowOffsetY = on === 'ground' ? 6 : 3;
    ctx.fillStyle = rgba(look.ao.color, 0.001);
    ctx.fill();
    ctx.restore();

    // 2. The pile itself: lit at the crest, in its own shadow toward the base.
    const g = ctx.createLinearGradient(0, base - peak, 0, base);
    g.addColorStop(0.00, look.body[0]);
    g.addColorStop(0.45, look.body[1]);
    g.addColorStop(1.00, look.body[2]);
    body();
    ctx.fillStyle = g;
    ctx.save();
    ctx.globalAlpha = weight;
    ctx.fill();
    ctx.restore();

    // 3. Form. One key light, upper left. A slope that faces it is lit, a
    //    slope that faces away is in its own shadow. The shade is computed
    //    per cell into a two-row image and drawn stretched over the pile:
    //    the browser's bilinear filtering turns the cell values into a
    //    continuous gradient across the drift. Filling per-cell strips
    //    instead banded like corduroy.
    ctx.save();
    body();
    ctx.clip();
    const shade = this.shadeImage(field);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(shade, x0, base - peak - 6, x1 - x0, (peak + 6) * 1.5);
    ctx.restore();

    // 4. Grain — a flat fill is plaster. Noise clipped to the pile, faint,
    //    in multiply so it modulates rather than dirties.
    ctx.save();
    body();
    ctx.clip();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = look.grain;
    const pat = ctx.createPattern(this.noiseTile(), 'repeat');
    if (pat) {
      ctx.translate(x0, base - peak - 4);
      ctx.scale(1.6, 1.6);
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, (x1 - x0) / 1.6, (peak + 12) / 1.6);
    }
    ctx.restore();

    // 5. Crest light: the top surface faces the sky and is the brightest
    //    thing in the scene. A thin bright stroke, slightly lifted.
    ctx.save();
    ctx.globalAlpha = weight;
    ctx.beginPath();
    crest();
    ctx.strokeStyle = look.crest.color;
    ctx.lineWidth = on === 'ground' ? look.crest.width : look.crest.width * 0.7;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();

    // 6. Glints.
    const gc = look.glint.color;
    for (const s of this.sparkles) {
      if (s.on !== on) continue;
      const i = Math.max(0, Math.min(field.length - 1, Math.round((s.x - x0) / CELL)));
      if (field[i] < (on === 'ground' ? 2 : 0.8)) continue;
      const a = Math.sin((s.life / s.max) * Math.PI);
      const y = base - field[i] + 1.5;
      // a soft bloom, then the point, then a four-ray flare at the peak
      const g = ctx.createRadialGradient(s.x, y, 0, s.x, y, 5);
      g.addColorStop(0, rgba(gc, 0.55 * a));
      g.addColorStop(1, rgba(gc, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(s.x, y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(gc, 0.7 + 0.3 * a);
      ctx.beginPath(); ctx.arc(s.x, y, 1.1 + a * 1.5, 0, Math.PI * 2); ctx.fill();
      if (a > 0.6) {
        ctx.strokeStyle = rgba(gc, (a - 0.6) * 2.2);
        ctx.lineWidth = 0.8;
        const r = 3 + a * 4;
        ctx.beginPath();
        ctx.moveTo(s.x - r, y); ctx.lineTo(s.x + r, y);
        ctx.moveTo(s.x, y - r); ctx.lineTo(s.x, y + r);
        ctx.stroke();
      }
    }
  }

  private shadeCanvas: HTMLCanvasElement | null = null;
  private shadeImage(field: Float32Array): HTMLCanvasElement {
    const n = field.length;
    if (!this.shadeCanvas) this.shadeCanvas = document.createElement('canvas');
    const c = this.shadeCanvas;
    // Two rows: the shade at the crest, and a transparent row beneath it, so
    // the stretched image fades from the lit/shaded crest down to the base,
    // where the ambient occlusion takes over. One row shaded the whole
    // face as vertical columns of light.
    if (c.width !== n) { c.width = n; c.height = 2; }
    const x = c.getContext('2d');
    if (!x) return c;
    const img = x.createImageData(n, 2);
    const { dark, darkAlpha, lightAlpha } = this.look.shade;
    for (let i = 0; i < n; i++) {
      // slope over a 5-cell window: + = rising to the right = facing away
      // from the upper-left light
      const a = field[Math.max(0, i - 2)], b = field[Math.min(n - 1, i + 2)];
      const slope = (b - a) / (4 * CELL);
      const sh = Math.max(-1, Math.min(1, slope * 7.5));
      const o = i * 4;
      if (sh > 0) { img.data[o] = dark[0]; img.data[o + 1] = dark[1]; img.data[o + 2] = dark[2]; img.data[o + 3] = Math.round(sh * darkAlpha * 255); }
      else        { img.data[o] = 255; img.data[o + 1] = 255; img.data[o + 2] = 255; img.data[o + 3] = Math.round(-sh * lightAlpha * 255); }
    }
    // second row: fully transparent (createImageData is zeroed)
    x.putImageData(img, 0, 0);
    return c;
  }

  private noiseTile(): HTMLCanvasElement {
    if (this.noise) return this.noise;
    this.noise = makeNoiseTile();
    return this.noise;
  }
}

function makeNoiseTile(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 96; c.height = 96;
  const x = c.getContext('2d');
  if (x) {
    const img = x.createImageData(96, 96);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 110 + Math.random() * 90;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
  }
  return c;
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Surf — the sea's edge along the bottom of the viewport.
 *
 * A wave breaking is three things at different speeds. The WASH is the
 * sheet of water that runs up the sand and drains back: it rises fast,
 * hangs, and recedes slowly, and its leading edge is the brightest line in
 * the scene. FOAM is left where the wave broke — a heightfield, like the
 * snow, but it dissolves in seconds, not minutes, and it is riddled with
 * bubbles that pop. RINGS are where spray comes back down onto the water.
 */
const FOAM_MAX = 40;
const FOAM_SLUMP = 2.2;
const FOAM_DISSOLVE = 0.10;    // per second — foam is gone in ~10 s

export class Surf {
  private foam = new Float32Array(1);
  private width = 1;
  private noise: HTMLCanvasElement | null = null;
  private bubbles: { x: number; y: number; r: number; life: number; max: number }[] = [];
  private rings: { x: number; y: number; life: number; max: number; size: number }[] = [];
  private bubbleClock = 0;
  private washClock = 99;    // seconds since the last break
  private washAmp = 0;
  private washPrevAmp = 0;
  private washDir = 1;       // which way the wash edge slants
  private wash = 3;
  private t = 0;

  resize(widthCss: number): void {
    this.width = Math.max(1, widthCss);
    const cells = Math.ceil(this.width / CELL) + 1;
    if (this.foam.length !== cells) this.foam = new Float32Array(cells);
  }

  /** The water's edge, CSS px above the viewport bottom, at screen x. */
  washHeightAt(x: number): number {
    return this.wash + this.edgeWobble(x);
  }

  /** Foam height at screen x, CSS px above the viewport bottom. */
  foamHeightAt(x: number): number {
    const i = Math.max(0, Math.min(this.foam.length - 1, Math.round(x / CELL)));
    return this.foam[i];
  }

  /** A wave has broken. `strength` 0..1. */
  break(strength: number, dir: number): void {
    this.washPrevAmp = this.wash;
    this.washClock = 0;
    this.washAmp = 22 + 34 * strength;
    this.washDir = dir;
  }

  /** Foam left by the break at screen x. Called along the crest as it runs. */
  depositFoam(x: number, amount: number): void {
    const cx = x / CELL;
    const radius = (14 + Math.random() * 22) / CELL;
    const i0 = Math.max(0, Math.floor(cx - radius)), i1 = Math.min(this.foam.length - 1, Math.ceil(cx + radius));
    for (let i = i0; i <= i1; i++) {
      const t = (i - cx) / radius;
      const k = Math.exp(-t * t * 2.0);
      const room = 1 - this.foam[i] / FOAM_MAX;
      this.foam[i] += amount * k * Math.max(0, room);
    }
  }

  /** A droplet of `size` px has come down on the water at screen x. */
  splash(x: number, size: number, foams = true): void {
    const y = this.width > 0 ? -this.washHeightAt(x) * Math.random() : 0;   // relative to the bottom
    if (this.rings.length < 120) {
      const max = 0.55 + size * 0.05;
      this.rings.push({ x, y, life: max, max, size });
    }
    // Spray landing on foam adds to it, a little. Rain on a puddle does not.
    if (foams) this.depositFoam(x, 0.35 + size * 0.12);
  }

  step(dt: number): void {
    this.t += dt;
    this.washClock += dt;
    // The wash: up over ~1.8 s (easing out), a beat at the top, then back
    // over 4 s. Between breaks a low swash keeps the sand wet.
    const u = this.washClock;
    const rise = 1 - Math.pow(1 - Math.min(1, u / 1.8), 3);
    const recede = smoothstep(2.6, 6.5, u);
    const target = 3 + this.washAmp * rise * (1 - recede) + this.washPrevAmp * (1 - rise) * 0.4;
    this.wash += (target - this.wash) * Math.min(1, dt * 6);

    // Foam relaxes and dissolves.
    const n = this.foam.length;
    if (n >= 3) {
      const k = Math.min(0.45, FOAM_SLUMP * dt);
      let prev = this.foam[0];
      for (let i = 1; i < n - 1; i++) {
        const cur = this.foam[i];
        this.foam[i] = cur + k * (prev + this.foam[i + 1] - 2 * cur);
        prev = cur;
      }
      const d = 1 - FOAM_DISSOLVE * dt;
      for (let i = 0; i < n; i++) this.foam[i] *= d;
    }

    // Bubbles form where there is foam, and pop.
    this.bubbleClock += dt;
    if (this.bubbleClock > 0.03) {
      this.bubbleClock = 0;
      for (let k = 0; k < 3 && this.bubbles.length < 260; k++) {
        const x = Math.random() * this.width;
        const h = this.foamHeightAt(x);
        if (h < 3 || Math.random() > h / FOAM_MAX + 0.15) continue;
        const max = 0.5 + Math.random() * 2.2;
        this.bubbles.push({ x, y: -Math.random() * h * 0.9, r: 0.8 + Math.random() * Math.random() * 3.4, life: max, max });
      }
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.life -= dt;
      if (b.life <= 0 || this.foamHeightAt(b.x) < 1.5) this.bubbles.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].life -= dt;
      if (this.rings[i].life <= 0) this.rings.splice(i, 1);
    }
  }

  private edgeWobble(x: number): number {
    const t = this.t;
    return 2.6 * Math.sin(x * 0.021 + t * 1.9 * this.washDir) + 1.6 * Math.sin(x * 0.053 - t * 1.3) + 0.9 * Math.sin(x * 0.11 + t * 2.7);
  }

  /** Draw the water's edge. Context in CSS px. Does not clear. */
  render(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const washPath = (): void => {
      ctx.beginPath();
      ctx.moveTo(0, H - this.washHeightAt(0));
      for (let x = 4; x <= W + 4; x += 4) ctx.lineTo(x, H - this.washHeightAt(x));
      ctx.lineTo(W + 8, H + 4);
      ctx.lineTo(-8, H + 4);
      ctx.closePath();
    };

    // 1. Wet ground: water darkens what it has touched, and the darkening
    //    reaches higher than the water does now — the sand remembers the
    //    last wash.
    const wetTop = H - Math.max(this.wash, 3) - 10;
    const wet = ctx.createLinearGradient(0, wetTop, 0, H);
    wet.addColorStop(0, 'rgba(18, 32, 44, 0)');
    wet.addColorStop(0.5, 'rgba(18, 32, 44, 0.18)');
    wet.addColorStop(1, 'rgba(18, 32, 44, 0.32)');
    ctx.fillStyle = wet;
    ctx.fillRect(0, wetTop, W, H - wetTop);

    // 2. The wash itself: a thin sheet of water, dark and translucent with
    //    a milky edge where it is thinnest and full of air.
    ctx.save();
    washPath();
    const sheet = ctx.createLinearGradient(0, H - this.wash - 6, 0, H);
    sheet.addColorStop(0, 'rgba(214, 232, 240, 0.34)');
    sheet.addColorStop(0.18, 'rgba(120, 156, 176, 0.30)');
    sheet.addColorStop(1, 'rgba(38, 70, 92, 0.42)');
    ctx.fillStyle = sheet;
    ctx.fill();
    // Sky on the water: a specular sheen that slides with the wobble.
    ctx.clip();
    ctx.globalCompositeOperation = 'screen';
    const sheen = ctx.createLinearGradient(0, H - this.wash, 0, H - this.wash + 14);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.26)');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, H - this.wash - 8, W, 24);
    ctx.restore();

    // 3. The leading edge: the brightest line in the scene, with a soft
    //    glow, because the thinnest water is the one full of bubbles.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, H - this.washHeightAt(0));
    for (let x = 4; x <= W + 4; x += 4) ctx.lineTo(x, H - this.washHeightAt(x));
    ctx.strokeStyle = 'rgba(236, 248, 255, 0.55)';
    ctx.lineWidth = 4;
    ctx.filter = 'blur(2px)';
    ctx.stroke();
    ctx.filter = 'none';
    ctx.strokeStyle = 'rgba(248, 253, 255, 0.92)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.restore();

    // 4. Foam: a frothy body, whiter than the water, ragged at the crest.
    let peak = 0;
    for (let i = 0; i < this.foam.length; i++) if (this.foam[i] > peak) peak = this.foam[i];
    if (peak > 0.8) {
      const top = (i: number): number => {
        const h = Math.sin(i * 12.9898 + this.t * 0.6) * 43758.5453;
        return H - this.foam[i] + (h - Math.floor(h) - 0.5) * 4.2 * Math.min(1, this.foam[i] / 8);
      };
      const foamBody = (): void => {
        ctx.beginPath();
        ctx.moveTo(0, top(0));
        for (let i = 1; i < this.foam.length; i++) {
          const xa = (i - 1) * CELL, xb = i * CELL;
          const ya = top(i - 1), yb = top(i);
          ctx.quadraticCurveTo(xa, ya, (xa + xb) / 2, (ya + yb) / 2);
        }
        ctx.lineTo(W + 4, H + 2);
        ctx.lineTo(-4, H + 2);
        ctx.closePath();
      };
      ctx.save();
      foamBody();
      const fg = ctx.createLinearGradient(0, H - peak, 0, H);
      fg.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
      fg.addColorStop(0.5, 'rgba(240, 247, 250, 0.9)');
      fg.addColorStop(1, 'rgba(196, 214, 224, 0.78)');
      ctx.fillStyle = fg;
      ctx.fill();
      ctx.clip();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.2;
      if (!this.noise) this.noise = makeNoiseTile();
      const pat = ctx.createPattern(this.noise, 'repeat');
      if (pat) {
        ctx.translate(this.t * 3, H - peak - 4);
        ctx.scale(1.3, 1.3);
        ctx.fillStyle = pat;
        ctx.fillRect(-W, 0, (W * 3) / 1.3, (peak + 12) / 1.3);
      }
      ctx.restore();
      // 5. Bubbles: a rim and a highlight each; they shrink as they pop.
      for (const b of this.bubbles) {
        const u = b.life / b.max;
        const r = b.r * (u < 0.15 ? u / 0.15 : 1);
        if (r < 0.4) continue;
        const y = H + b.y;
        ctx.beginPath(); ctx.arc(b.x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(190, 210, 222, 0.35)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 0.7;
        ctx.stroke();
        ctx.beginPath(); ctx.arc(b.x - r * 0.35, y - r * 0.35, Math.max(0.3, r * 0.28), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fill();
      }
    }

    // 6. Rings where spray comes down: an expanding foreshortened ellipse.
    for (const r of this.rings) {
      const u = 1 - r.life / r.max;
      const rad = 2 + u * (10 + r.size * 1.6);
      const a = (1 - u) * 0.7;
      ctx.beginPath();
      ctx.ellipse(r.x, H + r.y, rad, rad * 0.32, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(236, 248, 255, ${a.toFixed(3)})`;
      ctx.lineWidth = 1.1 - u * 0.6;
      ctx.stroke();
    }
  }
}

/**
 * Shafts — afternoon light coming in from the upper left.
 *
 * Dust is not visible in air; it is visible in light. The motes' alpha is
 * multiplied by `intensityAt` so they flare inside a beam and all but vanish
 * outside it, and the beams themselves are drawn as long, soft, warm wedges
 * that sway very slowly. Each beam is rendered once into its own canvas and
 * placed per frame, so the per-frame cost is three drawImage calls.
 */
interface Beam { ax: number; angle: number; width: number; intensity: number; phase: number; sway: number }

export class Shafts {
  private beams: Beam[] = [
    { ax: 0.14, angle: 0.44, width: 150, intensity: 0.50, phase: 0.0, sway: 30 },
    { ax: 0.40, angle: 0.38, width: 80,  intensity: 0.38, phase: 2.1, sway: 22 },
    { ax: 0.63, angle: 0.48, width: 200, intensity: 0.44, phase: 4.0, sway: 38 },
    { ax: 0.86, angle: 0.41, width: 60,  intensity: 0.30, phase: 1.2, sway: 18 },
  ];
  private sprites: HTMLCanvasElement[] = [];
  private W = 1;
  private H = 1;
  // The scene light: colour of the beams, how much they lean, and how much
  // of them there is in this air. Set from scene-light.ts; the sprites are
  // rebuilt when the colour changes, which is once a minute at most.
  private color: Rgb = [255, 226, 168];
  private lean = 1;
  private strength = 1;

  /** `azimuth` -1..1 (light from the left leans the beams right), `strength` 0..1. */
  setLight(color: Rgb, azimuth: number, strength: number): void {
    const changed = color[0] !== this.color[0] || color[1] !== this.color[1] || color[2] !== this.color[2];
    this.color = color;
    // Beams lean away from the light; straight down when it is overhead.
    this.lean = -azimuth * 1.2;
    this.strength = strength;
    if (changed) this.resize(this.W, this.H);
  }

  get visible(): boolean { return this.strength > 0.02; }

  resize(W: number, H: number): void {
    this.W = W; this.H = H;
    this.sprites = this.beams.map((b) => {
      const c = document.createElement('canvas');
      const bw = Math.ceil(b.width * 3.2);
      const bh = Math.ceil(H * 1.6);
      c.width = bw; c.height = bh;
      const x = c.getContext('2d');
      if (!x) return c;
      // Across the beam: a gaussian-ish profile — bright core, long soft
      // shoulders — in the warm colour of late light.
      const across = x.createLinearGradient(0, 0, bw, 0);
      const stops: [number, number][] = [[0, 0], [0.2, 0.05], [0.35, 0.28], [0.5, 1], [0.65, 0.28], [0.8, 0.05], [1, 0]];
      for (const [p, a] of stops) across.addColorStop(p, rgba(this.color, a * 0.6));
      x.fillStyle = across;
      x.fillRect(0, 0, bw, bh);
      // Along the beam: brightest where it enters, thinning toward the floor.
      const along = x.createLinearGradient(0, 0, 0, bh);
      along.addColorStop(0, 'rgba(0, 0, 0, 0)');
      along.addColorStop(0.55, 'rgba(0, 0, 0, 0.45)');
      along.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
      x.globalCompositeOperation = 'destination-out';
      x.fillStyle = along;
      x.fillRect(0, 0, bw, bh);
      return c;
    });
  }

  private axisX(b: Beam, t: number): number {
    return b.ax * this.W + Math.sin(t * 0.09 + b.phase) * b.sway;
  }
  private angleOf(b: Beam): number { return b.angle * this.lean; }

  // Per-frame cache for intensityAt: the beams move once a frame, the
  // particles ask hundreds of times.
  private ax = new Float32Array(4);
  private cs = new Float32Array(4);
  private sn = new Float32Array(4);

  prepare(t: number): void {
    for (let i = 0; i < this.beams.length; i++) {
      const b = this.beams[i];
      this.ax[i] = this.axisX(b, t);
      this.cs[i] = Math.cos(this.angleOf(b));
      this.sn[i] = Math.sin(this.angleOf(b));
    }
  }

  /** How much light crosses screen point (x, y), 0..1. Call prepare(t) first. */
  intensityAt(x: number, y: number): number {
    let sum = 0;
    const vert = 1 - 0.4 * y / this.H;
    for (let i = 0; i < this.beams.length; i++) {
      const b = this.beams[i];
      const perp = (x - this.ax[i]) * this.cs[i] - y * this.sn[i];
      const q = perp / b.width;
      if (q > 1.6 || q < -1.6) continue;
      sum += b.intensity * Math.exp(-q * q * 2.4) * vert;
    }
    return Math.min(1, sum * 2.2 * this.strength);
  }

  render(ctx: CanvasRenderingContext2D, t: number): void {
    if (!this.visible) return;
    for (let i = 0; i < this.beams.length; i++) {
      const b = this.beams[i];
      const sprite = this.sprites[i];
      if (!sprite) continue;
      ctx.save();
      ctx.translate(this.axisX(b, t), -40);
      ctx.rotate(-this.angleOf(b));
      // A beam breathes: dust density along it varies, so it brightens and
      // dims a little over tens of seconds.
      ctx.globalAlpha = Math.min(1, b.intensity * 2.2) * this.strength * (0.82 + 0.18 * Math.sin(t * 0.21 + b.phase * 1.7));
      ctx.drawImage(sprite, -sprite.width / 2, 0);
      ctx.restore();
    }
  }
}

/**
 * Litter — a persistent canvas of things lying where they fell. The caller
 * stamps the live sprite (so a fallen petal is the same petal) at the
 * landing point, flat, at a random rest angle, slightly darkened as a thing
 * on the ground is. For petals the whole carpet is faded very slowly so it
 * thins rather than accumulating into a pink floor.
 */
export function stampFlat(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  cell: number, grid: number,
  x: number, y: number, size: number, alpha: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.random() * Math.PI * 2);
  // Lying flat, seen from above and slightly foreshortened.
  ctx.scale(1, 0.72);
  ctx.globalAlpha = alpha;
  // A thing on the ground is in the ground's shadow: a hair darker and
  // cooler than one in the air.
  ctx.filter = 'brightness(0.86) saturate(0.9)';
  const s = size * 2.2;
  // The atlas is a grid×grid square with the cells along the top row.
  const cw = sprite.width / grid;
  ctx.drawImage(sprite, cell * cw, 0, cw, cw, -s / 2, -s / 2, s, s);
  ctx.restore();
}

/**
 * Litter — things lying where they fell, as a list rather than pixels, so
 * the wind can move them. A gust slides the light ones along the ground;
 * they gather against the foot of the scroll the way petals gather against
 * a kerb, and the ones on the rod are blown off it. A petal on the ground
 * also bleeds a little ink into the paper of the scene over its first
 * seconds — the print's own medium, not a photograph's.
 */
export interface LitterItem {
  x: number; y: number; size: number; angle: number; alpha: number; cell: number;
  onRod: boolean;
  age: number;
  vx: number;
}

export class Litter {
  items: LitterItem[] = [];
  private readonly max: number;

  constructor(private readonly fadePerSec: number, max = 520) { this.max = max; }

  add(x: number, y: number, size: number, alpha: number, cell: number, onRod = false): void {
    if (this.items.length >= this.max) this.items.shift();
    this.items.push({ x, y, size, angle: Math.random() * Math.PI * 2, alpha, cell, onRod, age: 0, vx: 0 });
  }

  /**
   * `gust` 0..1 and its direction; `scroll` is the reading surface's
   * screen rect (things on the ground stop against its sides); `H` the
   * viewport height. Returns the items blown off the rod, for the caller
   * to drop back into the air.
   */
  step(dt: number, gust: number, gustDir: number, scroll: { left: number; right: number; top: number; bottom: number } | null, W: number, H: number): LitterItem[] {
    const blownOff: LitterItem[] = [];
    const fade = 1 - this.fadePerSec * dt;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      it.alpha *= fade;
      if (it.alpha < 0.05 || it.x < -40 || it.x > W + 40) { this.items.splice(i, 1); continue; }
      if (it.onRod) {
        // A hard gust lifts the light ones off the rod.
        if (gust > 0.6 && Math.random() < (gust - 0.6) * 0.12 * dt * 60 / Math.max(1, it.size * 0.25)) {
          blownOff.push(it);
          this.items.splice(i, 1);
        }
        continue;
      }
      // Along the ground: pushed by the gust, held back by friction, big
      // ones harder to move.
      const push = gust * gustDir * 90 / Math.max(1, it.size * 0.35);
      it.vx += (push - it.vx) * Math.min(1, dt * 2.5);
      if (Math.abs(it.vx) > 0.5) {
        let nx = it.x + it.vx * dt;
        if (scroll && it.y > scroll.top && it.y < scroll.bottom) {
          // The scroll's foot is a wall on the ground.
          const lw = scroll.left - 18, rw = scroll.right + 18;
          if (it.x <= lw && nx > lw) { nx = lw - Math.random() * 6; it.vx = 0; }
          else if (it.x >= rw && nx < rw) { nx = rw + Math.random() * 6; it.vx = 0; }
        }
        it.x = nx;
        it.angle += it.vx * dt * 0.02;
      }
    }
    return blownOff;
  }

  /** Draw every item. `ink` > 0 adds the sumi-e bleed under the ground items. */
  render(ctx: CanvasRenderingContext2D, sprite: HTMLCanvasElement, grid: number, ink: number): void {
    const cw = sprite.width / grid;
    for (const it of this.items) {
      if (ink > 0 && !it.onRod) {
        // Ink spreads for two seconds, then holds, faint and cool.
        const spread = Math.min(1, it.age / 2);
        const r = it.size * (1.1 + spread * 0.9);
        const g = ctx.createRadialGradient(it.x, it.y + 1, 0, it.x, it.y + 1, r);
        g.addColorStop(0, `rgba(40, 30, 50, ${(0.16 * ink * it.alpha * spread).toFixed(3)})`);
        g.addColorStop(1, 'rgba(40, 30, 50, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(it.x, it.y + 1, r, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.angle);
      ctx.scale(1, 0.72);
      ctx.globalAlpha = it.alpha;
      ctx.filter = 'brightness(0.86) saturate(0.9)';
      const s = it.size * 2.2;
      ctx.drawImage(sprite, it.cell * cw, 0, cw, cw, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
  }
}

/**
 * The moon — a disc and a halo at the sun's position at night, drawn
 * behind everything on the accumulation layer. The halo is the moon seen
 * through the same air the snow falls through.
 */
export function drawMoon(ctx: CanvasRenderingContext2D, x: number, y: number, strength: number, W: number): void {
  if (strength <= 0.01) return;
  const r = Math.max(14, W * 0.016);
  const halo = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 9);
  halo.addColorStop(0, `rgba(214, 226, 248, ${(0.22 * strength).toFixed(3)})`);
  halo.addColorStop(0.35, `rgba(190, 206, 236, ${(0.07 * strength).toFixed(3)})`);
  halo.addColorStop(1, 'rgba(190, 206, 236, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(x, y, r * 9, 0, Math.PI * 2); ctx.fill();
  const disc = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
  disc.addColorStop(0, `rgba(250, 250, 244, ${(0.95 * strength).toFixed(3)})`);
  disc.addColorStop(0.85, `rgba(228, 232, 240, ${(0.9 * strength).toFixed(3)})`);
  disc.addColorStop(1, `rgba(220, 226, 238, 0)`);
  ctx.fillStyle = disc;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

/**
 * Ledges — the painting's own horizontal surfaces, read off its depth
 * map: the top edge of anything near (a roof, a rail, a branch) is a
 * place snow can lie. Found once per painting in image space, mapped to
 * the screen by the caller.
 */
export interface Ledge { x0: number; x1: number; y: number; depth: number }   // image-space, 0..1 fractions

export function findLedges(depth: ImageData): Ledge[] {
  const { width: w, height: h, data } = depth;
  const dAt = (x: number, y: number): number => data[(y * w + x) * 4] / 255;
  // The surface just below the step must STAY near for a stretch: the step
  // leads onto a roof plane, a ridge top, a treetop — not a noise flicker
  // in the sky or a branch tip, where depth falls away again at once. A
  // lone step with nothing under it would render as snow floating in air.
  const plateauBelow = (x: number, y0: number, v: number): boolean => {
    let sum = 0, n = 0;
    for (let y = y0; y < Math.min(h, y0 + 18); y += 2) { sum += dAt(x, y); n++; }
    if (n === 0) return false;
    return Math.abs(sum / n - v) < 0.09;
  };
  // Per column: the topmost strong step from far to near, in the middle
  // band of the picture, on something that is actually near.
  const step = 4;
  const cols = Math.floor(w / step);
  const ledgeY = new Float32Array(cols).fill(-1);
  const ledgeD = new Float32Array(cols);
  for (let c = 0; c < cols; c++) {
    const x = c * step;
    for (let y = Math.floor(h * 0.12) + 6; y < h * 0.88; y += 2) {
      const above = dAt(x, y - 6), here = dAt(x, y + 2);
      if (here > 0.55 && here - above > 0.14 && plateauBelow(x, y + 2, here)) { ledgeY[c] = y; ledgeD[c] = here; break; }
    }
  }
  // Group adjacent columns with a continuous edge into segments.
  const out: Ledge[] = [];
  let start = -1;
  const flush = (end: number) => {
    if (start < 0) return;
    if (end - start >= 6) {
      let ySum = 0, dSum = 0;
      for (let c = start; c < end; c++) { ySum += ledgeY[c]; dSum += ledgeD[c]; }
      const n = end - start;
      out.push({ x0: (start * step) / w, x1: (end * step) / w, y: ySum / n / h, depth: dSum / n });
    }
    start = -1;
  };
  for (let c = 0; c < cols; c++) {
    if (ledgeY[c] < 0) { flush(c); continue; }
    if (start < 0) { start = c; continue; }
    if (Math.abs(ledgeY[c] - ledgeY[c - 1]) > 5) { flush(c); start = c; }
  }
  flush(cols);
  // The longest first; the caller keeps what it can afford.
  out.sort((a, b) => (b.x1 - b.x0) - (a.x1 - a.x0));
  return out;
}

export const LEDGE_LOOK: PileLook = { ...SNOW_LOOK, seed: () => 0, rodMax: 8, relief: 1.6 };
