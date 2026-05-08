'use client';

import type { VaultDoc } from './vault-store';

// Minimal English stopword set — small enough to stay fast, big enough
// to remove the usual noise that would dominate TF-IDF weights.
const STOP = new Set([
  'a','an','and','are','as','at','be','but','by','can','could','did','do','does',
  'for','from','had','has','have','he','her','him','his','how','i','if','in','is',
  'it','its','just','me','more','most','my','no','not','of','on','or','our','she',
  'should','so','some','such','than','that','the','their','them','then','there',
  'these','they','this','those','to','was','we','were','what','when','where',
  'which','who','why','will','with','would','you','your','also','been','being',
]);

function tokenize(text: string): string[] {
  // Strip markdown noise before splitting.
  const clean = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
    .toLowerCase();
  const out: string[] = [];
  for (const p of clean.split(/[^a-z0-9]+/)) {
    if (p.length < 3) continue;
    if (STOP.has(p)) continue;
    if (/^\d+$/.test(p)) continue;
    out.push(p);
  }
  return out;
}

export interface SemanticEdge {
  a: string;
  b: string;
  /** Cosine similarity in [0, 1]. */
  w: number;
}

export interface SemanticOptions {
  /** Keep at most this many strongest neighbors per doc. */
  topK?: number;
  /** Discard pairs with cosine similarity below this threshold. */
  minSim?: number;
}

/**
 * Build soft "semantic" edges between docs based on TF-IDF cosine similarity
 * of their content. Lightweight — no models, no network, <100ms for ~200 docs.
 */
export function buildSemanticEdges(
  docs: VaultDoc[],
  opts: SemanticOptions = {},
): SemanticEdge[] {
  const topK = opts.topK ?? 3;
  const minSim = opts.minSim ?? 0.12;
  const N = docs.length;
  if (N < 2) return [];

  // Stage 1 — tokenize + term frequencies per doc.
  const tfs: Array<Map<string, number>> = [];
  for (const d of docs) {
    const tokens = tokenize(d.content);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    tfs.push(tf);
  }

  // Stage 2 — document frequency per term.
  const df = new Map<string, number>();
  for (const tf of tfs) {
    for (const term of tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  }

  // Stage 3 — unit-normalized TF-IDF vectors.
  const vecs: Array<Map<string, number>> = [];
  for (const tf of tfs) {
    let total = 0;
    for (const c of tf.values()) total += c;
    if (total === 0) {
      vecs.push(new Map());
      continue;
    }
    const v = new Map<string, number>();
    let norm2 = 0;
    for (const [term, count] of tf) {
      const idf = Math.log(N / (df.get(term) ?? 1));
      const w = (count / total) * idf;
      if (w <= 0) continue;
      v.set(term, w);
      norm2 += w * w;
    }
    const norm = Math.sqrt(norm2) || 1;
    for (const [term, w] of v) v.set(term, w / norm);
    vecs.push(v);
  }

  // Stage 4 — pairwise cosine, collect per-doc top-K (undirected).
  const perDocTop: Array<Array<{ j: number; sim: number }>> = Array.from(
    { length: N },
    () => [],
  );

  for (let i = 0; i < N; i++) {
    const vi = vecs[i];
    if (vi.size === 0) continue;
    for (let j = i + 1; j < N; j++) {
      const vj = vecs[j];
      if (vj.size === 0) continue;
      // Walk the smaller map — most docs have few terms overlapping.
      const [small, large] = vi.size <= vj.size ? [vi, vj] : [vj, vi];
      let dot = 0;
      for (const [term, w] of small) {
        const w2 = large.get(term);
        if (w2) dot += w * w2;
      }
      if (dot < minSim) continue;
      perDocTop[i].push({ j, sim: dot });
      perDocTop[j].push({ j: i, sim: dot });
    }
  }

  // Stage 5 — dedupe top-K-per-doc into a final undirected edge list.
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
