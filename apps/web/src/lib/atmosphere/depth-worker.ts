// SPDX-License-Identifier: Apache-2.0
/// <reference lib="webworker" />

/**
 * Depth-map worker.
 *
 * Depth Anything v2 small used to run on the main thread. Even with the
 * WebGPU backend, tensor pre/post-processing is synchronous JS — and when
 * WebGPU init is refused it silently falls back to WASM, which is fully
 * blocking. Measured on an M2 Max: a single 1.7 SECOND long task, i.e. a
 * frozen UI, every time a painting's depth was computed. Since the
 * atmosphere rotates paintings, that freeze recurred for the whole
 * session.
 *
 * Running it here keeps the main thread free: the parallax shader stays at
 * its refresh rate while depth computes, and the result is handed back as
 * a transferable ImageBitmap (zero-copy).
 *
 * The Cache API write also happens here, so a cache hit on a later visit
 * never needs to start the worker at all.
 */

import { pipeline, RawImage } from '@huggingface/transformers';

const MODEL_ID = 'onnx-community/depth-anything-v2-small';
const CACHE_NAME = 'mv-depth-v1';
const DEPTH_SIZE = 384;

interface DepthRequest {
  id: number;
  imageUrl: string;
  cacheKey: string;
}

type DepthPipe = (img: unknown) => Promise<{
  depth: { data: Uint8ClampedArray; width: number; height: number; channels: number };
}>;

let pipePromise: Promise<DepthPipe> | null = null;

async function getPipe(): Promise<DepthPipe> {
  if (!pipePromise) {
    pipePromise = (async () => {
      const fn = pipeline as unknown as (
        task: string, model: string, opts?: Record<string, unknown>,
      ) => Promise<DepthPipe>;
      try {
        return await fn('depth-estimation', MODEL_ID, { device: 'webgpu' });
      } catch {
        // WebGPU unavailable in this worker — WASM is fine here, it no
        // longer blocks anything the user can see.
        return await fn('depth-estimation', MODEL_ID);
      }
    })();
  }
  return pipePromise;
}

self.onmessage = async (e: MessageEvent<DepthRequest>) => {
  const { id, imageUrl, cacheKey } = e.data;
  try {
    const pipe = await getPipe();
    const input = await RawImage.fromURL(imageUrl);
    const { depth } = await pipe(input);

    // Grayscale (1-channel) → RGBA so it can become an ImageBitmap.
    const { data, width, height, channels } = depth;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const v = data[i * channels];
      const o = i << 2;
      rgba[o] = v; rgba[o + 1] = v; rgba[o + 2] = v; rgba[o + 3] = 255;
    }

    const srcBitmap = await createImageBitmap(new ImageData(rgba, width, height));
    const canvas = new OffscreenCanvas(DEPTH_SIZE, DEPTH_SIZE);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context in worker');
    ctx.drawImage(srcBitmap, 0, 0, DEPTH_SIZE, DEPTH_SIZE);
    srcBitmap.close();

    // Cache before transferring the bitmap (transfer detaches the canvas).
    try {
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const cache = await caches.open(CACHE_NAME);
      await cache.put(cacheKey, new Response(blob, { headers: { 'content-type': 'image/png' } }));
    } catch { /* cache disabled / quota — the bitmap below still works */ }

    const bitmap = canvas.transferToImageBitmap();
    (self as unknown as Worker).postMessage({ id, ok: true, bitmap }, [bitmap]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: String(err) });
  }
};
