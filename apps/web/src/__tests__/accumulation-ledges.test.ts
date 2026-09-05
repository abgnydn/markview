import { describe, it, expect } from 'vitest';
import { findLedges } from '@/components/atmosphere/accumulation';

// Synthetic depth maps: brighter = nearer. findLedges only reads
// { width, height, data }, so no canvas is needed.
function depthImage(w: number, h: number, v: (x: number, y: number) => number): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.max(0, Math.min(1, v(x, y)));
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(d * 255);
      data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data } as unknown as ImageData;
}

const W = 120;
const H = 100;

describe('findLedges', () => {
  it('finds a clean roof step sitting on a plateau', () => {
    const img = depthImage(W, H, (_x, y) => (y >= 50 ? 0.8 : 0.1));
    const ledges = findLedges(img);
    expect(ledges.length).toBeGreaterThanOrEqual(1);
    expect(ledges[0].y).toBeCloseTo(0.48, 1);
    expect(ledges[0].x0).toBeCloseTo(0, 2);
    expect(ledges[0].x1).toBeCloseTo(1, 2);
  });

  it('rejects a step with nothing under it (branch tip, noise flicker)', () => {
    const img = depthImage(W, H, (_x, y) => (y >= 50 && y < 56 ? 0.8 : 0.1));
    expect(findLedges(img)).toEqual([]);
  });

  it('rejects uniform far sky and uniform near field', () => {
    expect(findLedges(depthImage(W, H, () => 0.2))).toEqual([]);
    expect(findLedges(depthImage(W, H, () => 0.9))).toEqual([]);
  });

  it('rejects sparse bright noise in the sky', () => {
    const img = depthImage(W, H, (x, y) => {
      const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const n = h - Math.floor(h);
      return n > 0.93 ? 0.7 : 0.25;
    });
    expect(findLedges(img)).toEqual([]);
  });

  it('still finds a treetop-like blob (near, sustained below)', () => {
    // A rounded near mass: rows 40..80 near in the middle columns.
    const img = depthImage(W, H, (x, y) => (x >= 30 && x < 90 && y >= 40 && y < 82 ? 0.75 : 0.1));
    const ledges = findLedges(img);
    expect(ledges.length).toBeGreaterThanOrEqual(1);
    expect(ledges[0].y).toBeCloseTo(0.4, 1);
  });
});
