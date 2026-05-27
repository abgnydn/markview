// SPDX-License-Identifier: Apache-2.0

/**
 * Local-first embeddings layer for markview.
 *
 * Uses transformers.js with `all-MiniLM-L6-v2` (Xenova mirror, ONNX
 * quantized) — ~23 MB on first download, cached forever in the browser.
 * 384-dim vectors. WebGPU when available, WASM fallback. ~3-10 ms per
 * paragraph on M-series Mac.
 *
 * The model is loaded LAZILY — first call awaits the download. Subsequent
 * calls reuse the in-memory pipeline. Calls to `embedFile()` happen on
 * every save, so the first save in a new browser triggers the one-time
 * 23 MB pull, then it's instant.
 *
 * Per-paragraph vectors live in `db.embeddings`. Search at query time
 * cosines against in-memory float32 arrays — no FAISS, no HNSW, just
 * O(N·384) dot products. Fine up to ~50K paragraphs per workspace
 * (~20 ms search). When that gets slow, swap in HNSW.
 */

import { db, type DBEmbedding } from '@/lib/storage/db';
import { parseFrontmatter } from '@/lib/markdown/frontmatter';

type Pipeline = (text: string | string[], options?: { pooling?: string; normalize?: boolean }) => Promise<{ data: Float32Array; dims: number[] }>;

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const DIM = 384;

let pipelinePromise: Promise<Pipeline> | null = null;
let warmStatusCallbacks: Set<(s: ModelStatus) => void> = new Set();

export interface ModelStatus {
  state: 'idle' | 'loading' | 'ready' | 'failed';
  progress?: number;
  error?: string;
}

let currentStatus: ModelStatus = { state: 'idle' };

export function onModelStatus(cb: (s: ModelStatus) => void): () => void {
  warmStatusCallbacks.add(cb);
  cb(currentStatus);
  return () => warmStatusCallbacks.delete(cb);
}

function setStatus(s: ModelStatus) {
  currentStatus = s;
  warmStatusCallbacks.forEach((cb) => cb(s));
}

async function getPipeline(): Promise<Pipeline> {
  if (pipelinePromise) return pipelinePromise;
  pipelinePromise = (async () => {
    try {
      setStatus({ state: 'loading', progress: 0 });
      const { pipeline, env } = await import('@huggingface/transformers');
      // Allow remote loading but use the Hugging Face CDN.
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      const pipe = (await pipeline('feature-extraction', MODEL_ID, {
        progress_callback: (p: { status: string; progress?: number }) => {
          if (p.status === 'progress' && typeof p.progress === 'number') {
            setStatus({ state: 'loading', progress: p.progress });
          }
        },
      })) as unknown as Pipeline;
      setStatus({ state: 'ready' });
      return pipe;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus({ state: 'failed', error: msg });
      pipelinePromise = null;
      throw e;
    }
  })();
  return pipelinePromise;
}

/**
 * Split markdown content into paragraph-sized chunks for embedding.
 * Strips frontmatter; treats blank-line-separated blocks as paragraphs;
 * collapses code fences and very-short blocks; caps each chunk at ~600
 * characters so a single embedding represents a coherent unit of thought.
 */
export function chunkContent(rawContent: string): Array<{ index: number; text: string; preview: string }> {
  const { content } = parseFrontmatter(rawContent);
  // Drop fenced code blocks — they don't embed semantically well.
  const noCode = content.replace(/```[\s\S]*?```/g, '');
  const paragraphs = noCode
    .split(/\n{2,}/)
    .map((p) => p.replace(/^#+\s*/, '').trim())
    .filter((p) => p.length >= 24); // skip empty + ultra-short
  return paragraphs.map((text, index) => {
    const truncated = text.length > 600 ? text.slice(0, 600) : text;
    const preview = text.length > 140 ? text.slice(0, 140) + '…' : text;
    return { index, text: truncated, preview };
  });
}

/** Embed and persist every paragraph in a file. */
export async function embedFile(fileId: string, workspaceId: string, content: string): Promise<number> {
  const chunks = chunkContent(content);
  if (chunks.length === 0) {
    await db.embeddings.where('fileId').equals(fileId).delete();
    return 0;
  }
  const pipe = await getPipeline();
  const result = await pipe(chunks.map((c) => c.text), { pooling: 'mean', normalize: true });
  // `result.data` is a flat Float32Array of length N*DIM.
  const vectors: Float32Array[] = [];
  for (let i = 0; i < chunks.length; i++) {
    vectors.push(result.data.slice(i * DIM, (i + 1) * DIM));
  }
  // Replace all rows for this file in one transaction.
  await db.transaction('rw', db.embeddings, async () => {
    await db.embeddings.where('fileId').equals(fileId).delete();
    const rows: DBEmbedding[] = chunks.map((c, i) => ({
      id: `${fileId}:${c.index}`,
      fileId,
      workspaceId,
      paragraphIndex: c.index,
      preview: c.preview,
      vector: vectors[i].buffer.slice(vectors[i].byteOffset, vectors[i].byteOffset + vectors[i].byteLength) as ArrayBuffer,
    }));
    await db.embeddings.bulkPut(rows);
  });
  return chunks.length;
}

/** Embed a single query string (for search) — returns the unit vector. */
export async function embedQuery(query: string): Promise<Float32Array> {
  const pipe = await getPipeline();
  const result = await pipe(query, { pooling: 'mean', normalize: true });
  return new Float32Array(result.data.slice(0, DIM));
}

export interface SimilarityHit {
  fileId: string;
  workspaceId: string;
  paragraphIndex: number;
  preview: string;
  score: number;        // cosine, [-1, 1] — but with normalized vectors, [0, 1] in practice
}

/**
 * Cosine-similarity search over every embedded paragraph in the given
 * workspace. Returns the top-K most similar paragraphs, sorted desc.
 * If `excludeFileId` is set, skip results from that file (used when
 * suggesting related notes to the file you're currently reading).
 */
export async function searchEmbeddings(
  workspaceId: string,
  queryVec: Float32Array,
  options: { topK?: number; excludeFileId?: string } = {},
): Promise<SimilarityHit[]> {
  const { topK = 10, excludeFileId } = options;
  const rows = await db.embeddings.where('workspaceId').equals(workspaceId).toArray();
  const hits: SimilarityHit[] = [];
  for (const r of rows) {
    if (excludeFileId && r.fileId === excludeFileId) continue;
    const v = new Float32Array(r.vector);
    let dot = 0;
    for (let i = 0; i < DIM; i++) dot += queryVec[i] * v[i];
    hits.push({
      fileId: r.fileId,
      workspaceId: r.workspaceId,
      paragraphIndex: r.paragraphIndex,
      preview: r.preview,
      score: dot,
    });
  }
  hits.sort((a, b) => b.score - a.score);
  // Dedupe — multiple paragraphs from the same file can dominate the topK.
  // Keep the highest-scoring paragraph per file.
  const seen = new Set<string>();
  const deduped: SimilarityHit[] = [];
  for (const h of hits) {
    if (seen.has(h.fileId)) continue;
    seen.add(h.fileId);
    deduped.push(h);
    if (deduped.length >= topK) break;
  }
  return deduped;
}

/** Find related notes to a given paragraph (used by the right-rail panel). */
export async function relatedToParagraph(
  workspaceId: string,
  fileId: string,
  paragraphText: string,
  topK = 5,
): Promise<SimilarityHit[]> {
  if (!paragraphText.trim()) return [];
  const queryVec = await embedQuery(paragraphText);
  return searchEmbeddings(workspaceId, queryVec, { topK, excludeFileId: fileId });
}

/** Drop every embedding for a file (used when the file is deleted). */
export async function deleteEmbeddingsForFile(fileId: string): Promise<void> {
  await db.embeddings.where('fileId').equals(fileId).delete();
}

/** Drop every embedding for a workspace (used when the workspace is deleted). */
export async function deleteEmbeddingsForWorkspace(workspaceId: string): Promise<void> {
  await db.embeddings.where('workspaceId').equals(workspaceId).delete();
}

/**
 * Background-embed every file in the workspace that doesn't yet have
 * embeddings. Throttled — embeds one file per tick of the event loop so
 * the UI stays responsive. Returns when done.
 */
export async function backfillWorkspace(workspaceId: string): Promise<{ embedded: number; skipped: number }> {
  const files = await db.files.where('workspaceId').equals(workspaceId).toArray();
  let embedded = 0;
  let skipped = 0;
  for (const f of files) {
    const existing = await db.embeddings.where('fileId').equals(f.id).count();
    if (existing > 0) { skipped++; continue; }
    await embedFile(f.id, workspaceId, f.content);
    embedded++;
    await new Promise((r) => setTimeout(r, 0));
  }
  return { embedded, skipped };
}
