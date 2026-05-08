'use client';

import type { VaultDoc } from './vault-store';
import type { SemanticEdge } from './vault-tfidf';

// Dynamic import so Turbopack doesn't try to pre-bundle the transformers wasm
// at build time. First call loads the model (~120MB quantized multilingual-e5-small);
// subsequent calls reuse the cached pipeline.
// Multilingual means Turkish, Arabic, and friends embed correctly — essential
// for DavaKasası and any non-English vault.

type EmbedFn = (
  text: string,
  opts: { pooling?: 'mean' | 'cls'; normalize?: boolean },
) => Promise<{ data: Float32Array | number[] | Uint8Array }>;

let embedderPromise: Promise<EmbedFn> | null = null;

async function getEmbedder(): Promise<EmbedFn> {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const mod = await import('@huggingface/transformers');
      if (mod.env) {
        mod.env.allowLocalModels = false;
      }
      const pipe = await mod.pipeline(
        'feature-extraction',
        'Xenova/multilingual-e5-small',
      );
      return pipe as unknown as EmbedFn;
    })();
  }
  return embedderPromise;
}

/** Small fast non-cryptographic hash — FNV-1a. */
function hashContent(s: string): string {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

const embedCache = new Map<string, Float32Array>();

async function embedOne(content: string): Promise<Float32Array> {
  const key = hashContent(content);
  const cached = embedCache.get(key);
  if (cached) return cached;

  const embedder = await getEmbedder();
  // Truncate very long content — e5-small's context is 512 tokens (~2k chars)
  // and we don't need more for thematic similarity. e5 expects a "passage: "
  // prefix on doc-side inputs; we prepend it so similarity math is calibrated.
  const trimmed = content.length > 4000 ? content.slice(0, 4000) : content;
  const prefixed = `passage: ${trimmed}`;
  const out = await embedder(prefixed, { pooling: 'mean', normalize: true });
  const raw = out.data as Float32Array | number[] | Uint8Array;
  const vec = raw instanceof Float32Array ? raw : Float32Array.from(raw as ArrayLike<number>);
  embedCache.set(key, vec);
  return vec;
}

export interface EmbeddingOptions {
  topK?: number;
  minSim?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export async function buildEmbeddingEdges(
  docs: VaultDoc[],
  opts: EmbeddingOptions = {},
): Promise<SemanticEdge[]> {
  const topK = opts.topK ?? 3;
  const minSim = opts.minSim ?? 0.4;
  const N = docs.length;
  if (N < 2) return [];

  const vectors: Float32Array[] = new Array(N);
  for (let i = 0; i < N; i++) {
    if (opts.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    vectors[i] = await embedOne(docs[i].content);
    opts.onProgress?.(i + 1, N);
  }

  // Cosine similarity — vectors are already unit-normalized.
  const perDocTop: Array<Array<{ j: number; sim: number }>> = Array.from(
    { length: N },
    () => [],
  );

  for (let i = 0; i < N; i++) {
    const vi = vectors[i];
    for (let j = i + 1; j < N; j++) {
      const vj = vectors[j];
      const len = Math.min(vi.length, vj.length);
      let dot = 0;
      for (let k = 0; k < len; k++) dot += vi[k] * vj[k];
      if (dot < minSim) continue;
      perDocTop[i].push({ j, sim: dot });
      perDocTop[j].push({ j: i, sim: dot });
    }
  }

  const seen = new Set<string>();
  const edges: SemanticEdge[] = [];
  for (let i = 0; i < N; i++) {
    const top = perDocTop[i]
      .sort((a, b) => b.sim - a.sim)
      .slice(0, topK);
    for (const { j, sim } of top) {
      const a = docs[i].id;
      const b = docs[j].id;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a, b, w: sim });
    }
  }

  return edges;
}

/** Pre-warm the model on idle (optional — the first semantic toggle triggers
 *  it anyway). Call from a user gesture if you want to eliminate first-toggle
 *  latency at a known-safe moment. */
export function preloadEmbedder(): void {
  if (typeof window === 'undefined') return;
  void getEmbedder();
}
