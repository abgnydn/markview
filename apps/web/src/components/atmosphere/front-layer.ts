// SPDX-License-Identifier: Apache-2.0
/**
 * Front layer — what the weather does to the scroll itself.
 *
 * The particles live behind the reading surface. But snow that reaches
 * the paper wets it, spray beads on the silk and runs, and rain drips off
 * the rod: those marks are ON the scroll, so they need a canvas in front
 * of it. This one is fixed over the viewport, above the content and below
 * the chrome, pointer-events off, and is only ever a few soft marks that
 * dry within seconds — the text underneath stays readable.
 *
 * The particle system reports the hits; this layer owns their life.
 */

export interface ScrollRect { left: number; right: number; top: number; bottom: number }

interface Mark {
  kind: 'wet' | 'bead' | 'drip' | 'streak';
  x: number; y: number;
  r: number;
  life: number; max: number;
  vy: number;
  /** For beads: seconds until it starts to run; for drips: seconds of swelling left. */
  wait: number;
  running: boolean;
}

const MAX_MARKS = 260;

export class FrontLayer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private marks: Mark[] = [];
  private dirty = true;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'mv-front-layer';
    this.canvas.setAttribute('aria-hidden', 'true');
    Object.assign(this.canvas.style, {
      position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '1',
    });
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = window.innerWidth * this.dpr;
    this.canvas.height = window.innerHeight * this.dpr;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.dirty = true;
  }

  destroy(): void { this.canvas.remove(); }

  private push(m: Mark): void {
    if (this.marks.length >= MAX_MARKS) this.marks.shift();
    this.marks.push(m);
    this.dirty = true;
  }

  /** A flake or a drop has reached the paper: a wet dot that dries. */
  wet(x: number, y: number, size: number): void {
    const max = 7 + Math.random() * 7;
    this.push({ kind: 'wet', x, y, r: 1.6 + size * 0.5, life: max, max, vy: 0, wait: 0, running: false });
  }

  /** Spray has hit the silk: a bead that sits, and if big enough, runs. */
  bead(x: number, y: number, size: number): void {
    const r = 1.4 + size * 0.28;
    const max = 6 + Math.random() * 6;
    this.push({ kind: 'bead', x, y, r, life: max, max, vy: 0, wait: r > 2.6 ? 0.4 + Math.random() * 2 : Infinity, running: false });
  }

  /** Rain gathering on the rod's underside: swells, then falls. */
  drip(x: number, y: number): void {
    this.push({ kind: 'drip', x, y, r: 0.8, life: 6, max: 6, vy: 0, wait: 0.8 + Math.random() * 2.2, running: false });
  }

  step(dt: number, scroll: ScrollRect | null): void {
    if (this.marks.length === 0) return;
    this.dirty = true;
    const H = window.innerHeight;
    const floor = scroll && scroll.bottom < H ? scroll.bottom : H + 20;
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i];
      m.life -= dt;
      if (m.life <= 0) { this.marks.splice(i, 1); continue; }
      if (m.kind === 'bead' || m.kind === 'drip') {
        if (!m.running) {
          m.wait -= dt;
          if (m.kind === 'drip') m.r = Math.min(4.2, m.r + dt * 1.4);
          if (m.wait <= 0) { m.running = true; m.life = Math.max(m.life, 4); }
        } else {
          // Runs down, faster as it goes, thinning as it leaves water behind.
          m.vy = Math.min(m.kind === 'drip' ? 420 : 140, m.vy + (m.kind === 'drip' ? 600 : 120) * dt);
          const ny = m.y + m.vy * dt;
          // The trail: a streak from where it was to where it is.
          this.push({ kind: 'streak', x: m.x + (Math.random() - 0.5) * 0.4, y: (m.y + ny) / 2, r: Math.max(0.6, m.r * 0.55), life: 2.6, max: 2.6, vy: ny - m.y, wait: 0, running: false });
          m.y = ny;
          m.r = Math.max(0.9, m.r - dt * 0.35);
          if (m.y > floor) { this.marks.splice(i, 1); continue; }
        }
      }
    }
  }

  render(): void {
    if (!this.dirty) return;
    this.dirty = false;
    const ctx = this.ctx;
    const W = window.innerWidth, H = window.innerHeight;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const m of this.marks) {
      const u = m.life / m.max;
      if (m.kind === 'wet') {
        // Wet paper is a little darker, with a slightly darker rim where the
        // water stopped; it dries from the middle out.
        const a = Math.min(1, u * 1.6) * 0.11;
        const r = m.r * (1 + (1 - u) * 0.6);
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r);
        g.addColorStop(0, `rgba(72, 58, 34, ${(a * (0.6 + 0.4 * u)).toFixed(3)})`);
        g.addColorStop(0.8, `rgba(72, 58, 34, ${(a * 0.7).toFixed(3)})`);
        g.addColorStop(0.92, `rgba(60, 46, 26, ${(a * 1.1).toFixed(3)})`);
        g.addColorStop(1, 'rgba(60, 46, 26, 0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, Math.PI * 2); ctx.fill();
      } else if (m.kind === 'streak') {
        const a = u * 0.16;
        const len = Math.max(2, Math.abs(m.vy));
        ctx.fillStyle = `rgba(60, 50, 34, ${a.toFixed(3)})`;
        ctx.fillRect(m.x - m.r / 2, m.y - len / 2, m.r, len);
      } else {
        // A drop is a lens: dark toward its lower rim where it refracts the
        // shadow, a hard white spark up and to the left where it catches
        // the light, and a shadow under it on the paper.
        const a = Math.min(1, u * 2);
        const sh = ctx.createRadialGradient(m.x + m.r * 0.4, m.y + m.r * 0.7, 0, m.x + m.r * 0.4, m.y + m.r * 0.7, m.r * 1.8);
        sh.addColorStop(0, `rgba(40, 32, 20, ${(0.22 * a).toFixed(3)})`);
        sh.addColorStop(1, 'rgba(40, 32, 20, 0)');
        ctx.fillStyle = sh;
        ctx.beginPath(); ctx.arc(m.x + m.r * 0.4, m.y + m.r * 0.7, m.r * 1.8, 0, Math.PI * 2); ctx.fill();
        const body = ctx.createRadialGradient(m.x - m.r * 0.3, m.y - m.r * 0.3, 0, m.x, m.y, m.r);
        body.addColorStop(0, `rgba(255, 255, 255, ${(0.55 * a).toFixed(3)})`);
        body.addColorStop(0.6, `rgba(225, 235, 245, ${(0.28 * a).toFixed(3)})`);
        body.addColorStop(0.92, `rgba(90, 100, 120, ${(0.42 * a).toFixed(3)})`);
        body.addColorStop(1, 'rgba(90, 100, 120, 0)');
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.ellipse(m.x, m.y, m.r, m.r * (m.running ? 1.5 : 1.08), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.85 * a).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(m.x - m.r * 0.35, m.y - m.r * 0.38, Math.max(0.5, m.r * 0.26), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }
}
