// SPDX-License-Identifier: Apache-2.0
/// <reference lib="webworker" />

/**
 * Embedding worker.
 *
 * Feature extraction used to run on the main thread, so embedding a
 * document (the idle backfill pass, a save, a search) blocked rendering.
 * Measured on an M2 Max with an atmosphere running: a 1.5 SECOND long
 * task for a 120-paragraph file — the UI simply froze mid-animation.
 *
 * Only inference lives here. Chunking, Dexie writes, and similarity math
 * stay in lib/embeddings.ts; this worker just turns strings into vectors.
 */

import { pipeline, env } from '@huggingface/transformers';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

type Pipe = (
  input: string | string[],
  opts: { pooling: 'mean'; normalize: boolean },
) => Promise<{ data: Float32Array }>;

let pipePromise: Promise<Pipe> | null = null;

function getPipe(): Promise<Pipe> {
  if (!pipePromise) {
    pipePromise = (async () => {
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      return (await pipeline('feature-extraction', MODEL_ID, {
        progress_callback: (p: { status: string; progress?: number }) => {
          if (p.status === 'progress' && typeof p.progress === 'number') {
            (self as unknown as Worker).postMessage({ type: 'status', progress: p.progress });
          }
        },
      })) as unknown as Pipe;
    })();
  }
  return pipePromise;
}

interface EmbedRequest {
  id: number;
  texts: string[];
}

self.onmessage = async (e: MessageEvent<EmbedRequest>) => {
  const { id, texts } = e.data;
  try {
    const pipe = await getPipe();
    const result = await pipe(texts.length === 1 ? texts[0] : texts, {
      pooling: 'mean',
      normalize: true,
    });
    // Copy out of the tensor's buffer so it can be transferred.
    const data = new Float32Array(result.data);
    (self as unknown as Worker).postMessage({ id, ok: true, data }, [data.buffer]);
  } catch (err) {
    pipePromise = null; // let a later call retry a failed model load
    (self as unknown as Worker).postMessage({ id, ok: false, error: String(err) });
  }
};
