'use client';

// Plain-BFS graph queries over the vault adjacency. No GraphBLAS, no SpMV,
// no WGSL — at vault scale (typically <10k nodes) a hot Map<string,Set<string>>
// outruns any GPU dispatch by the time you've finished uploading the input.
//
// Adjacency is undirected, no self-loops. Build it from doc wikilinks and,
// optionally, semantic edges (TF-IDF or embeddings) so "related" can mean
// either explicit hyperlink or thematic similarity.

import type { VaultDoc } from './vault-store';
import { buildEdges } from './vault-links';
import type { SemanticEdge } from './vault-tfidf';

export type Adjacency = Map<string, Set<string>>;

export interface BuildAdjacencyOptions {
  /** Optional semantic edges to fold in alongside wikilink edges. */
  semanticEdges?: SemanticEdge[];
  /** Minimum similarity to count a semantic edge as an adjacency. */
  semanticMinSim?: number;
}

export function buildVaultAdjacency(
  docs: VaultDoc[],
  opts: BuildAdjacencyOptions = {},
): Adjacency {
  const adj: Adjacency = new Map();
  for (const d of docs) adj.set(d.id, new Set());

  for (const [a, b] of buildEdges(docs)) {
    if (a === b) continue;
    adj.get(a)?.add(b);
    adj.get(b)?.add(a);
  }

  if (opts.semanticEdges) {
    const minSim = opts.semanticMinSim ?? 0;
    for (const e of opts.semanticEdges) {
      if (e.a === e.b) continue;
      if (e.w < minSim) continue;
      if (!adj.has(e.a) || !adj.has(e.b)) continue;
      adj.get(e.a)!.add(e.b);
      adj.get(e.b)!.add(e.a);
    }
  }

  return adj;
}

export interface NeighborHit {
  id: string;
  hops: number;
}

/** BFS to depth k. Returns hits in BFS order, excludes the start node. */
export function kHopNeighbors(adj: Adjacency, start: string, k: number): NeighborHit[] {
  if (k < 1 || !adj.has(start)) return [];
  const visited = new Set<string>([start]);
  const out: NeighborHit[] = [];
  let frontier: string[] = [start];
  for (let depth = 1; depth <= k && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const u of frontier) {
      const nbrs = adj.get(u);
      if (!nbrs) continue;
      for (const v of nbrs) {
        if (visited.has(v)) continue;
        visited.add(v);
        out.push({ id: v, hops: depth });
        next.push(v);
      }
    }
    frontier = next;
  }
  return out;
}

/** Shortest hop-count path from source to target (inclusive). null if unreachable. */
export function shortestPath(adj: Adjacency, source: string, target: string): string[] | null {
  if (source === target) return adj.has(source) ? [source] : null;
  if (!adj.has(source) || !adj.has(target)) return null;

  const prev = new Map<string, string>();
  const visited = new Set<string>([source]);
  let frontier: string[] = [source];

  while (frontier.length > 0) {
    const next: string[] = [];
    for (const u of frontier) {
      const nbrs = adj.get(u);
      if (!nbrs) continue;
      for (const v of nbrs) {
        if (visited.has(v)) continue;
        visited.add(v);
        prev.set(v, u);
        if (v === target) {
          const path = [target];
          let cur = u;
          while (cur !== source) {
            path.push(cur);
            cur = prev.get(cur)!;
          }
          path.push(source);
          return path.reverse();
        }
        next.push(v);
      }
    }
    frontier = next;
  }
  return null;
}

export interface EgoGraphResult {
  /** Center first, then neighbors in BFS order. */
  nodes: string[];
  /** Undirected edges within the induced subgraph. */
  edges: Array<[string, string]>;
}

/** Induced subgraph of nodes within k hops of `center`, plus interconnecting edges. */
export function egoGraph(adj: Adjacency, center: string, k: number): EgoGraphResult {
  if (!adj.has(center)) return { nodes: [], edges: [] };
  const hits = kHopNeighbors(adj, center, k);
  const nodes = [center, ...hits.map((h) => h.id)];
  const set = new Set(nodes);
  const edges: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const u of nodes) {
    const nbrs = adj.get(u);
    if (!nbrs) continue;
    for (const v of nbrs) {
      if (!set.has(v)) continue;
      const key = u < v ? `${u}|${v}` : `${v}|${u}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([u, v]);
    }
  }
  return { nodes, edges };
}

/** Degree per node. Isolated nodes get 0. */
export function degreeCentrality(adj: Adjacency): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, nbrs] of adj) out.set(id, nbrs.size);
  return out;
}

export interface HubHit {
  id: string;
  degree: number;
}

/** Top-N nodes by degree. Deterministic tiebreak on id (lex-min wins). */
export function vaultHubs(adj: Adjacency, n = 10): HubHit[] {
  return Array.from(adj, ([id, nbrs]) => ({ id, degree: nbrs.size }))
    .sort((a, b) => (b.degree - a.degree) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, n);
}

export interface CommunityOptions {
  /** Stop after this many sweeps even if labels are still changing. */
  maxIterations?: number;
}

/** Label propagation: O(iter · |E|), no params, deterministic.
 *  Each node adopts the most frequent label among its neighbors;
 *  ties break on lex-min so two runs on the same graph give the same partition. */
export function communities(adj: Adjacency, opts: CommunityOptions = {}): Map<string, string> {
  const max = opts.maxIterations ?? 20;
  const nodes = Array.from(adj.keys()).sort();
  const label = new Map<string, string>();
  for (const id of nodes) label.set(id, id);

  for (let iter = 0; iter < max; iter++) {
    let changed = false;
    for (const u of nodes) {
      const nbrs = adj.get(u);
      if (!nbrs || nbrs.size === 0) continue;
      const counts = new Map<string, number>();
      for (const v of nbrs) {
        const lab = label.get(v)!;
        counts.set(lab, (counts.get(lab) ?? 0) + 1);
      }
      let bestLabel = label.get(u)!;
      let bestCount = -1;
      for (const [lab, count] of counts) {
        if (count > bestCount || (count === bestCount && lab < bestLabel)) {
          bestLabel = lab;
          bestCount = count;
        }
      }
      if (label.get(u) !== bestLabel) {
        label.set(u, bestLabel);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return label;
}
