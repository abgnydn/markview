// SPDX-License-Identifier: Apache-2.0

/**
 * Gaussian-splat cloud builder — lifts a painting + its monocular depth
 * map into a 3D point cloud (one soft gaussian per grid cell) plus an
 * LDI "behind" layer that inpaints what's hidden under foreground
 * silhouettes so the cloud can be orbited / walked without tearing.
 *
 * Shared by the fixed backdrop (splat-painting) and the immersive
 * walk-through (splat-world) so the lift is defined once.
 *
 * Output positions are in plane-local coords:
 *   x ∈ [-aspect/2, aspect/2], y ∈ [-0.5, 0.5], z = (depth-0.5)*range.
 * The consumer cover-scales the whole cloud to taste.
 */

export interface GaussianCloud {
  /** count*3 settled positions (plane-local). */
  base: Float32Array;
  /** count*3 linear-rgb colours. */
  colors: Float32Array;
  /** count*3 scatter directions for an assemble animation. */
  seeds: Float32Array;
  count: number;
  /** Per-gaussian footprint (plane-local units). */
  splatScale: number;
  /** Painting width / height. */
  paintAspect: number;
}

const DEPTH_RANGE = 0.62;

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/**
 * Build the cloud. `targetCount` is the front-layer grid budget; the LDI
 * behind layer adds a modest amount on top (silhouette band only).
 * Returns null if a 2D context can't be obtained.
 */
export function buildGaussianCloud(
  paintImg: HTMLImageElement,
  depthBitmap: ImageBitmap,
  targetCount: number,
): GaussianCloud | null {
  const paintAspect = paintImg.width / paintImg.height;
  const GH = Math.max(120, Math.round(Math.sqrt(targetCount / paintAspect)));
  const GW = Math.round(GH * paintAspect);
  const N0 = GW * GH;

  // Sample colour + depth onto GW×GH grids (both top-down, row 0 = top).
  const colCanvas = document.createElement('canvas');
  colCanvas.width = GW; colCanvas.height = GH;
  const colCtx = colCanvas.getContext('2d', { willReadFrequently: true });
  if (!colCtx) return null;
  colCtx.drawImage(paintImg, 0, 0, GW, GH);
  const colData = colCtx.getImageData(0, 0, GW, GH).data;

  const depCanvas = document.createElement('canvas');
  depCanvas.width = GW; depCanvas.height = GH;
  const depCtx = depCanvas.getContext('2d', { willReadFrequently: true });
  if (!depCtx) return null;
  depCtx.drawImage(depthBitmap, 0, 0, GW, GH);
  const depData = depCtx.getImageData(0, 0, GW, GH).data;

  const dGrid = new Float32Array(N0);
  for (let p = 0; p < N0; p++) dGrid[p] = depData[p * 4] / 255;

  // ── LDI inpainting — synthesise the background behind silhouettes ──
  const EDGE = 0.06;
  const BAND = 3;
  const idxOf = (i: number, j: number) => j * GW + i;
  const front = new Uint8Array(N0);
  for (let j = 0; j < GH; j++) {
    for (let i = 0; i < GW; i++) {
      const here = dGrid[idxOf(i, j)];
      let minNb = here;
      if (i > 0) minNb = Math.min(minNb, dGrid[idxOf(i - 1, j)]);
      if (i < GW - 1) minNb = Math.min(minNb, dGrid[idxOf(i + 1, j)]);
      if (j > 0) minNb = Math.min(minNb, dGrid[idxOf(i, j - 1)]);
      if (j < GH - 1) minNb = Math.min(minNb, dGrid[idxOf(i, j + 1)]);
      if (here - minNb > EDGE) front[idxOf(i, j)] = 1;
    }
  }
  for (let b = 1; b < BAND; b++) {
    const grow: number[] = [];
    for (let j = 0; j < GH; j++) {
      for (let i = 0; i < GW; i++) {
        const c = idxOf(i, j);
        if (front[c]) continue;
        const here = dGrid[c];
        const nbFront =
          (i > 0 && front[idxOf(i - 1, j)] && here >= dGrid[idxOf(i - 1, j)] - 0.02) ||
          (i < GW - 1 && front[idxOf(i + 1, j)] && here >= dGrid[idxOf(i + 1, j)] - 0.02) ||
          (j > 0 && front[idxOf(i, j - 1)] && here >= dGrid[idxOf(i, j - 1)] - 0.02) ||
          (j < GH - 1 && front[idxOf(i, j + 1)] && here >= dGrid[idxOf(i, j + 1)] - 0.02);
        if (nbFront) grow.push(c);
      }
    }
    for (const c of grow) front[c] = 1;
  }
  const bgR = new Float32Array(N0), bgG = new Float32Array(N0), bgB = new Float32Array(N0);
  const bgD = new Float32Array(N0);
  const known = new Uint8Array(N0);
  for (let p = 0; p < N0; p++) {
    if (!front[p]) {
      known[p] = 1;
      bgR[p] = colData[p * 4]; bgG[p] = colData[p * 4 + 1]; bgB[p] = colData[p * 4 + 2];
      bgD[p] = dGrid[p];
    }
  }
  for (let k = 0; k < 16; k++) {
    for (let j = 0; j < GH; j++) {
      for (let i = 0; i < GW; i++) {
        const c = idxOf(i, j);
        if (known[c]) continue;
        let r = 0, g = 0, bl = 0, dd = 0, cnt = 0;
        const acc = (nc: number) => {
          if (known[nc]) { r += bgR[nc]; g += bgG[nc]; bl += bgB[nc]; dd += bgD[nc]; cnt++; }
        };
        if (i > 0) acc(idxOf(i - 1, j));
        if (i < GW - 1) acc(idxOf(i + 1, j));
        if (j > 0) acc(idxOf(i, j - 1));
        if (j < GH - 1) acc(idxOf(i, j + 1));
        if (cnt > 0) {
          bgR[c] = r / cnt; bgG[c] = g / cnt; bgB[c] = bl / cnt; bgD[c] = dd / cnt;
          known[c] = 1;
        }
      }
    }
  }
  const behind: number[] = [];
  for (let p = 0; p < N0; p++) {
    if (front[p] && known[p] && bgD[p] < dGrid[p] - 0.02) behind.push(p);
  }

  // ── Assemble the cloud (front layer + LDI behind layer) ───────────
  const count = N0 + behind.length;
  const base = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  const scatterFor = (i: number, j: number, out: number, salt: number) => {
    const h = Math.sin((i * 12.9898 + j * 78.233 + salt) * 43758.5453);
    const a = (h - Math.floor(h)) * Math.PI * 2;
    const h2 = Math.sin((i * 39.346 + j * 11.135 + salt) * 12543.21);
    const r = 0.5 + (h2 - Math.floor(h2)) * 1.4;
    seeds[out * 3] = Math.cos(a) * r;
    seeds[out * 3 + 1] = Math.sin(a) * r;
    seeds[out * 3 + 2] = Math.sin(i * 7.13 + j * 3.7 + salt) * 0.6;
  };
  let n = 0;
  for (let j = 0; j < GH; j++) {
    for (let i = 0; i < GW; i++) {
      const u = (i + 0.5) / GW;
      const v = (j + 0.5) / GH;
      const idx = j * GW + i;
      const d = dGrid[idx];
      const ci = idx * 4;
      base[n * 3] = (u - 0.5) * paintAspect;
      base[n * 3 + 1] = 0.5 - v;
      base[n * 3 + 2] = (d - 0.5) * DEPTH_RANGE;
      colors[n * 3] = srgbToLinear(colData[ci]);
      colors[n * 3 + 1] = srgbToLinear(colData[ci + 1]);
      colors[n * 3 + 2] = srgbToLinear(colData[ci + 2]);
      scatterFor(i, j, n, 0);
      n++;
    }
  }
  for (const p of behind) {
    const i = p % GW, j = (p / GW) | 0;
    const u = (i + 0.5) / GW;
    const v = (j + 0.5) / GH;
    base[n * 3] = (u - 0.5) * paintAspect;
    base[n * 3 + 1] = 0.5 - v;
    base[n * 3 + 2] = (bgD[p] - 0.5) * DEPTH_RANGE;
    colors[n * 3] = srgbToLinear(bgR[p]);
    colors[n * 3 + 1] = srgbToLinear(bgG[p]);
    colors[n * 3 + 2] = srgbToLinear(bgB[p]);
    scatterFor(i, j, n, 101);
    n++;
  }

  const splatScale = (1.0 / GH) * 1.9;
  return { base, colors, seeds, count, splatScale, paintAspect };
}
