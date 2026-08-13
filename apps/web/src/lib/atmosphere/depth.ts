// SPDX-License-Identifier: Apache-2.0

/**
 * Painting depth map pipeline.
 *
 * For each atmosphere painting, lazily compute a 384x384 grayscale
 * depth map via Depth Anything v2 small (transformers.js, ONNX). The
 * result is cached in the browser Cache API so the heavy work runs at
 * most once per painting per device. Subsequent loads are a single
 * cache hit + an ImageBitmap decode — fast enough that the WebGL
 * parallax layer can spin up as soon as the atmosphere mounts.
 *
 * The pipeline itself is also lazy: the ~50 MB ONNX weights only
 * download when ensureDepth() is called for the first time, and only
 * if the requested painting isn't already cached.
 */
// v2: paintings moved from .jpg to .webp URLs, so every v1 key is an
// orphan — new name lets the browser GC the old cache wholesale.
const CACHE_NAME = 'mv-depth-v2';

// ── Worker plumbing ──────────────────────────────────────────────────
//
// Inference runs in depth-worker.ts. It used to run here, on the main
// thread: measured on an M2 Max that was a 1.7s long task — a hard UI
// freeze — every time a painting's depth was computed, and the
// atmosphere rotates paintings, so it recurred all session. The
// ML_TIMEOUT_MS race below only chose which RESULT to use; the freeze
// happened either way.

let worker: Worker | null = null;
let workerFailed = false;
let nextRequestId = 1;
const pending = new Map<number, (r: { ok: boolean; bitmap?: ImageBitmap }) => void>();

function getWorker(): Worker | null {
  if (workerFailed) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./depth-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; bitmap?: ImageBitmap; error?: string }>) => {
      const resolve = pending.get(e.data.id);
      if (!resolve) return;
      pending.delete(e.data.id);
      if (!e.data.ok) console.warn('[depth] worker inference failed:', e.data.error);
      resolve({ ok: e.data.ok, bitmap: e.data.bitmap });
    };
    worker.onerror = (err) => {
      console.warn('[depth] worker crashed — falling back to procedural depth', err);
      workerFailed = true;
      for (const [, resolve] of pending) resolve({ ok: false });
      pending.clear();
      worker?.terminate();
      worker = null;
    };
    return worker;
  } catch (err) {
    console.warn('[depth] worker unavailable — falling back to procedural depth', err);
    workerFailed = true;
    return null;
  }
}

interface DepthResult {
  /** ImageBitmap of the grayscale depth map; nearest pixels are bright. */
  bitmap: ImageBitmap;
  /** Width of the depth map (matches bitmap). */
  width: number;
  height: number;
  /** true when this is the instant procedural fallback (not the ML model). */
  approximate?: boolean;
}

const DEPTH_SIZE = 384;
/** How long to wait for the ML model before falling back to procedural. A
 *  warm model finishes well inside this; a cold one (50 MB download) won't,
 *  so first-ever entries stay instant and the model caches in the background. */
const ML_TIMEOUT_MS = 2500;

/** Load a same-origin image so its pixels can be read. */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

/**
 * Procedural depth — a cheap, always-available approximation built from the
 * painting itself: foreground (lower in frame) reads as near, sky (upper) as
 * far, modulated by luminance and softened toward the edges. Good enough for
 * the parallax / splat to feel dimensional when the ML model is slow or
 * unavailable, so entering a painting NEVER fails or hangs.
 */
async function proceduralDepth(imageUrl: string): Promise<DepthResult | null> {
  try {
    const img = await loadImage(imageUrl);
    const n = DEPTH_SIZE;
    const cnv = document.createElement('canvas');
    cnv.width = n; cnv.height = n;
    const ctx = cnv.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, n, n);
    const src = ctx.getImageData(0, 0, n, n);
    const out = ctx.createImageData(n, n);
    const s = src.data, o = out.data;
    for (let y = 0; y < n; y++) {
      const vy = y / (n - 1);               // 0 top … 1 bottom
      const near = 0.62 * vy + 0.10;        // bottom is nearer
      for (let x = 0; x < n; x++) {
        const i = (y * n + x) << 2;
        const lum = (s[i] * 0.299 + s[i + 1] * 0.587 + s[i + 2] * 0.114) / 255;
        // brighter pixels read slightly nearer; clamp 0..1.
        let d = near + 0.28 * lum;
        d = d < 0 ? 0 : d > 1 ? 1 : d;
        const v = (d * 255) | 0;
        o[i] = v; o[i + 1] = v; o[i + 2] = v; o[i + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
    const bitmap = await createImageBitmap(cnv);
    return { bitmap, width: n, height: n, approximate: true };
  } catch {
    return null;
  }
}

/** Run the Depth-Anything model and cache the result. Returns null on any
 *  failure. Caches on success so a later call is an instant cache hit. */
async function computeMlDepth(imageUrl: string, cacheKey: string): Promise<DepthResult | null> {
  const w = getWorker();
  if (!w) return null;
  const id = nextRequestId++;
  const result = await new Promise<{ ok: boolean; bitmap?: ImageBitmap }>((resolve) => {
    pending.set(id, resolve);
    w.postMessage({ id, imageUrl, cacheKey });
  });
  if (!result.ok || !result.bitmap) return null;
  const bitmap = result.bitmap;
  return { bitmap, width: bitmap.width, height: bitmap.height };
}

/**
 * Ensure a depth map exists for the painting at `imageUrl`. This ALWAYS
 * resolves to a usable depth map (never null when a 2D canvas is available):
 *  1. a cached ML map (instant), else
 *  2. the ML model if it finishes within ML_TIMEOUT_MS, else
 *  3. an instant procedural approximation — while the ML model keeps running
 *     in the background and caches itself for the next entry.
 * So entering a painting / toggling the splat never hangs and never reports
 * "depth unavailable".
 */
export async function ensureDepth(imageUrl: string): Promise<DepthResult | null> {
  if (typeof window === 'undefined') return null;
  // ABSOLUTE key: the worker writes this entry and the main thread reads
  // it. A relative key resolves against each context's own base URL (the
  // worker script's directory vs the page), so the two sides would use
  // different keys and every load would miss the cache and re-run the model.
  const cacheKey = new URL(`/__mv-depth__/${encodeURIComponent(imageUrl)}`, location.origin).toString();

  // 1. Cached ML map — instant, best quality.
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(cacheKey);
    if (hit) {
      const blob = await hit.blob();
      const bitmap = await createImageBitmap(blob);
      return { bitmap, width: bitmap.width, height: bitmap.height };
    }
  } catch { /* cache may be disabled; fall through */ }

  // Kick off ML inference; it caches itself on success even if we don't wait.
  const mlPromise = computeMlDepth(imageUrl, cacheKey);
  mlPromise.catch(() => { /* never throws unhandled — handled below / in bg */ });

  // 2. Race the model against a short timeout.
  const raced = await Promise.race([
    mlPromise,
    new Promise<'timeout'>((resolve) => window.setTimeout(() => resolve('timeout'), ML_TIMEOUT_MS)),
  ]);
  if (raced && raced !== 'timeout') return raced;

  // 3. Timed out (or model unavailable) — return the instant approximation.
  //    The ML promise keeps running and will populate the cache for next time.
  return await proceduralDepth(imageUrl);
}

/** True if WebGL2 is available — the renderer needs it. */
export function isWebGLSupported(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch { return false; }
}
