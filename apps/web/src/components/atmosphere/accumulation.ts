// SPDX-License-Identifier: Apache-2.0
/**
 * Accumulation — what the particles leave behind.
 *
 * The old layer stamped a soft radial blob wherever a particle reached the
 * bottom band and let the whole canvas fade. It read as white smudges,
 * because that is what it was: nothing was ever ON anything.
 *
 * This is a surface model. Snow is a heightfield — one height per few
 * pixels along a surface — that the flakes land ON: a flake stops where the
 * pile already is, not at a fixed line, so the drift visibly grows under the
 * fall. Between frames the field slumps (peaks diffuse into mounds, the way
 * a loose powder finds its angle of repose), growth slows as it nears the
 * cap, and it melts very slowly so it never fills the screen. There are two
 * surfaces: the ground along the bottom of the viewport, and the top rod of
 * the hanging scroll, which collects a ridge like a windowsill does.
 *
 * Petals do not pile, they scatter: each one is stamped where it lands as
 * the actual petal sprite, lying flat at a random rest angle, slightly
 * darkened as a thing on the ground is. A carpet, not a mound.
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
const GROUND_MAX = 96;        // px — where growth has effectively stopped
const ROD_MAX = 11;
const SLUMP = 1.35;            // diffusion rate: how fast peaks spread into mounds
const MELT_PER_SEC = 0.0012;  // ~10 minutes to lose half a pile with no new snow

export class SnowBank {
  private ground = new Float32Array(1);
  private rod = new Float32Array(1);
  private rodX0 = 0;
  private rodX1 = 0;
  private rodY = -1;
  private width = 1;
  private noise: HTMLCanvasElement | null = null;
  private sparkles: { x: number; life: number; max: number; on: 'ground' | 'rod' }[] = [];
  private sparkleClock = 0;

  resize(widthCss: number): void {
    this.width = Math.max(1, widthCss);
    const cells = Math.ceil(this.width / CELL) + 1;
    if (this.ground.length !== cells) {
      const next = new Float32Array(cells);
      // The ground already has snow on it; a winter scene does not start
      // bare. A low, slow undulation, so the first flakes land on a drift
      // with a shape rather than on a ruler.
      for (let i = 0; i < cells; i++) {
        const x = i * CELL;
        next[i] = 9 + 7 * Math.sin(x * 0.011) + 4.5 * Math.sin(x * 0.031 + 1.3) + 2.5 * Math.sin(x * 0.073 + 0.4) + 1.5 * Math.sin(x * 0.19 + 2.1);
      }
      this.ground = next;
    }
  }

  /** The scroll's top rod, or null when it is off-screen. */
  setRod(rod: RodSurface | null): void {
    if (!rod) { this.rodY = -1; return; }
    const cells = Math.max(1, Math.ceil((rod.x1 - rod.x0) / CELL) + 1);
    if (this.rod.length !== cells) this.rod = new Float32Array(cells);
    this.rodX0 = rod.x0; this.rodX1 = rod.x1; this.rodY = rod.y;
  }

  /** Height of the ground pile at screen x, CSS px above the viewport bottom. */
  groundHeightAt(x: number): number {
    const i = Math.max(0, Math.min(this.ground.length - 1, Math.round(x / CELL)));
    return this.ground[i];
  }

  /** Height of the rod ridge at screen x, or -1 when x is off the rod. */
  rodHeightAt(x: number): number {
    if (this.rodY < 0 || x < this.rodX0 || x > this.rodX1) return -1;
    const i = Math.max(0, Math.min(this.rod.length - 1, Math.round((x - this.rodX0) / CELL)));
    return this.rod[i];
  }

  get rodTop(): number { return this.rodY; }

  /** A flake of `size` px has landed at screen x on the given surface. */
  deposit(x: number, size: number, on: 'ground' | 'rod'): void {
    const field = on === 'ground' ? this.ground : this.rod;
    const max = on === 'ground' ? GROUND_MAX : ROD_MAX;
    const cx = on === 'ground' ? x / CELL : (x - this.rodX0) / CELL;
    // Kernel width varies flake to flake, so the pile is built from mounds
    // of different sizes rather than one smooth ramp.
    const radius = Math.max(2.5, size * (0.5 + Math.random() * 0.9)) / CELL;   // cells
    // Tuned so a drift is unmistakable inside half a minute and sculptural
    // inside two; real snow is slower, but nobody watches a screen for an
    // hour to find out whether it piles.
    const amount = 2.4 + size * 0.45;                     // px of height, spread over the kernel
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
    if (this.sparkleClock > 0.08 && this.sparkles.length < 44) {
      this.sparkleClock = 0;
      const onRod = this.rodY >= 0 && Math.random() < 0.25;
      const x = onRod ? this.rodX0 + Math.random() * (this.rodX1 - this.rodX0) : Math.random() * this.width;
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
    const k = Math.min(0.45, SLUMP * dt);
    let prev = field[0];
    for (let i = 1; i < n - 1; i++) {
      const cur = field[i];
      const next = field[i + 1];
      field[i] = cur + k * (prev + next - 2 * cur);
      prev = cur;
    }
    const melt = 1 - MELT_PER_SEC * dt;
    for (let i = 0; i < n; i++) field[i] *= melt;
  }

  /** Draw the ground drift and the rod ridge. Context is in CSS px. */
  render(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    ctx.clearRect(0, 0, W, H);
    this.drawPile(ctx, this.ground, 0, W, H, 'ground');
    if (this.rodY >= 0) this.drawPile(ctx, this.rod, this.rodX0, this.rodX1, this.rodY, 'rod');
  }

  private drawPile(ctx: CanvasRenderingContext2D, field: Float32Array, x0: number, x1: number, base: number, on: 'ground' | 'rod'): void {
    let peak = 0;
    for (let i = 0; i < field.length; i++) if (field[i] > peak) peak = field[i];
    if (peak < 0.6) return;

    // Crest through the field's midpoints, with a stable per-cell grain so
    // the edge is crystalline rather than a spline — snow is granular at
    // every scale, and a perfectly smooth crest reads as plastic.
    const relief = (i: number): number => {
      const h = Math.sin(i * 12.9898) * 43758.5453;
      return (h - Math.floor(h) - 0.5) * (on === 'ground' ? 2.2 : 1.2) * Math.min(1, field[i] / 10);
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
    body();
    ctx.shadowColor = 'rgba(28, 40, 62, 0.42)';
    ctx.shadowBlur = on === 'ground' ? 22 : 8;
    ctx.shadowOffsetY = on === 'ground' ? 6 : 3;
    ctx.fillStyle = 'rgba(28, 40, 62, 0.001)';
    ctx.fill();
    ctx.restore();

    // 2. The snow itself: white at the crest, going cool in its own shadow
    //    toward the base. Fresh snow is never grey; its shade is blue.
    const g = ctx.createLinearGradient(0, base - peak, 0, base);
    g.addColorStop(0.00, 'rgba(255, 255, 255, 0.99)');
    g.addColorStop(0.45, 'rgba(244, 247, 251, 0.98)');
    g.addColorStop(1.00, 'rgba(214, 224, 238, 0.97)');
    body();
    ctx.fillStyle = g;
    ctx.fill();

    // 3. Form. One key light, upper left. A slope that faces it is lit, a
    //    slope that faces away is in its own shadow, and the shadow is blue.
    //    The shade is computed per cell into a one-pixel-high image and drawn
    //    stretched over the pile: the browser's bilinear filtering turns the
    //    cell values into a continuous gradient across the drift. Filling
    //    per-cell strips instead banded like corduroy.
    ctx.save();
    body();
    ctx.clip();
    const shade = this.shadeImage(field);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(shade, x0, base - peak - 6, x1 - x0, (peak + 6) * 1.5);
    ctx.restore();

    // 4. Grain — snow is granular, a flat fill is plaster. Noise clipped to
    //    the pile, faint, in soft-light so it modulates rather than dirties.
    ctx.save();
    body();
    ctx.clip();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.16;
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
    ctx.beginPath();
    crest();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = on === 'ground' ? 1.6 : 1.1;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();

    // 6. Glints.
    for (const s of this.sparkles) {
      if (s.on !== on) continue;
      const i = Math.max(0, Math.min(field.length - 1, Math.round((s.x - x0) / CELL)));
      if (field[i] < 2) continue;
      const a = Math.sin((s.life / s.max) * Math.PI);
      const y = base - field[i] + 1.5;
      // a soft bloom, then the point, then a four-ray flare at the peak
      const g = ctx.createRadialGradient(s.x, y, 0, s.x, y, 5);
      g.addColorStop(0, `rgba(255, 255, 255, ${(0.55 * a).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(s.x, y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255, 255, 255, ${(0.7 + 0.3 * a).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(s.x, y, 1.1 + a * 1.5, 0, Math.PI * 2); ctx.fill();
      if (a > 0.6) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${((a - 0.6) * 2.2).toFixed(3)})`;
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
    for (let i = 0; i < n; i++) {
      // slope over a 5-cell window: + = rising to the right = facing away
      // from the upper-left light
      const a = field[Math.max(0, i - 2)], b = field[Math.min(n - 1, i + 2)];
      const slope = (b - a) / (4 * CELL);
      const sh = Math.max(-1, Math.min(1, slope * 7.5));
      const o = i * 4;
      if (sh > 0) { img.data[o] = 92; img.data[o + 1] = 112; img.data[o + 2] = 148; img.data[o + 3] = Math.round(sh * 0.34 * 255); }
      else        { img.data[o] = 255; img.data[o + 1] = 255; img.data[o + 2] = 255; img.data[o + 3] = Math.round(-sh * 0.5 * 255); }
    }
    // second row: fully transparent (createImageData is zeroed)
    x.putImageData(img, 0, 0);
    return c;
  }

  private noiseTile(): HTMLCanvasElement {
    if (this.noise) return this.noise;
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
    this.noise = c;
    return c;
  }
}

/**
 * Petal carpet — a persistent canvas of petals lying where they fell. The
 * caller stamps the live sprite (so a fallen petal is the same petal) at the
 * landing point, and the carpet is faded very slowly so it thins rather
 * than accumulating into a pink floor.
 */
export function stampPetal(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number, y: number, size: number, alpha: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.random() * Math.PI * 2);
  // Lying flat, seen from above and slightly foreshortened.
  ctx.scale(1, 0.72);
  ctx.globalAlpha = alpha;
  // A petal on the ground is in the ground's shadow: a hair darker and
  // cooler than one in the air.
  ctx.filter = 'brightness(0.86) saturate(0.9)';
  const s = size * 2.2;
  ctx.drawImage(sprite, -s / 2, -s / 2, s, s);
  ctx.restore();
}
