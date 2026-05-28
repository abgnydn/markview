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
// transformers.js v4 doesn't export a top-level Pipeline type; we
// keep it loosely typed (the only thing we call is the pipeline as
// a function returning `{ depth: RawImage }`).
type DepthPipeline = (img: unknown) => Promise<{ depth: { toCanvas: () => HTMLCanvasElement } }>;

const MODEL_ID = 'onnx-community/depth-anything-v2-small';
const CACHE_NAME = 'mv-depth-v1';

let pipelinePromise: Promise<DepthPipeline> | null = null;
let pipelineFailed = false;

async function getPipeline(): Promise<DepthPipeline | null> {
  if (pipelineFailed) return null;
  if (pipelinePromise) return pipelinePromise;
  pipelinePromise = (async () => {
    const tx = await import('@huggingface/transformers');
    const pipelineFn = tx.pipeline as unknown as (
      task: string,
      model: string,
      opts?: Record<string, unknown>,
    ) => Promise<DepthPipeline>;
    try {
      return await pipelineFn('depth-estimation', MODEL_ID, { device: 'webgpu' });
    } catch {
      // WebGPU init refused — fall back to WASM (default).
      return await pipelineFn('depth-estimation', MODEL_ID);
    }
  })();
  try {
    return await pipelinePromise;
  } catch (err) {
    console.warn('[depth] pipeline init failed — atmospheres will fall back to flat <img>', err);
    pipelineFailed = true;
    pipelinePromise = null;
    return null;
  }
}

interface DepthResult {
  /** ImageBitmap of the grayscale depth map; nearest pixels are bright. */
  bitmap: ImageBitmap;
  /** Width of the depth map (matches bitmap). */
  width: number;
  height: number;
}

/**
 * Ensure a depth map exists for the painting at `imageUrl`. Returns
 * the cached/freshly-computed result. Returns null when the pipeline
 * can't run (no WebGPU + no WASM, model fetch failed, etc.) — callers
 * should fall back to the plain <img>.
 */
export async function ensureDepth(imageUrl: string): Promise<DepthResult | null> {
  if (typeof window === 'undefined') return null;
  const cacheKey = `depth:${imageUrl}`;
  // Try the cache first.
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(cacheKey);
    if (hit) {
      const blob = await hit.blob();
      const bitmap = await createImageBitmap(blob);
      return { bitmap, width: bitmap.width, height: bitmap.height };
    }
  } catch { /* cache may be disabled; fall through */ }

  const pipe = await getPipeline();
  if (!pipe) return null;

  let bitmap: ImageBitmap;
  try {
    const tx = await import('@huggingface/transformers');
    // Load the source painting into a RawImage via the public helper.
    const RawImageClass = (tx as unknown as { RawImage: { fromURL: (u: string) => Promise<unknown> } }).RawImage;
    const rawImage = await RawImageClass.fromURL(imageUrl);
    // The pipeline returns { depth: RawImage, predicted_depth: Tensor }.
    const out = await pipe(rawImage);
    const canvas = out.depth.toCanvas();
    // Resize down to 384x384 — coarser depth is fine for parallax and
    // saves a LOT of bytes in the cache.
    const target = 384;
    const tmp = document.createElement('canvas');
    tmp.width = target; tmp.height = target;
    const ctx = tmp.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(canvas, 0, 0, target, target);
    bitmap = await createImageBitmap(tmp);
    // Persist to cache as PNG blob.
    const blob = await new Promise<Blob | null>((resolve) => tmp.toBlob((b) => resolve(b), 'image/png'));
    if (blob) {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(cacheKey, new Response(blob, { headers: { 'content-type': 'image/png' } }));
      } catch { /* cache write failed — ignore */ }
    }
  } catch (err) {
    console.warn('[depth] inference failed for', imageUrl, err);
    return null;
  }
  return { bitmap, width: bitmap.width, height: bitmap.height };
}

/** True if WebGL2 is available — the renderer needs it. */
export function isWebGLSupported(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch { return false; }
}
