import { describe, it, expect } from 'vitest';
import {
  buildVaultAdjacency,
  kHopNeighbors,
  shortestPath,
  egoGraph,
  degreeCentrality,
  vaultHubs,
  communities,
  type Adjacency,
} from '@/components/vault/vault-graph-queries';
import type { VaultDoc } from '@/components/vault/vault-store';

function doc(id: string, title: string, content: string): VaultDoc {
  return { id, title, content, tint: 'cyan', createdAt: 0, updatedAt: 0 };
}

function adjFromEdges(nodes: string[], edges: Array<[string, string]>): Adjacency {
  const adj: Adjacency = new Map();
  for (const id of nodes) adj.set(id, new Set());
  for (const [a, b] of edges) {
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  }
  return adj;
}

describe('vault-graph-queries · buildVaultAdjacency', () => {
  it('includes every doc as a node, even if isolated', () => {
    const docs = [doc('A', 'a.md', 'no links'), doc('B', 'b.md', 'no links')];
    const adj = buildVaultAdjacency(docs);
    expect(adj.size).toBe(2);
    expect(adj.get('A')!.size).toBe(0);
    expect(adj.get('B')!.size).toBe(0);
  });

  it('folds wikilink + markdown link edges into adjacency', () => {
    const docs = [
      doc('A', 'a.md', '[[b]] [[c]]'),
      doc('B', 'b.md', '[a](a.md)'),
      doc('C', 'c.md', 'no links'),
    ];
    const adj = buildVaultAdjacency(docs);
    expect(adj.get('A')!.size).toBe(2);
    expect(adj.get('A')!.has('B')).toBe(true);
    expect(adj.get('A')!.has('C')).toBe(true);
    expect(adj.get('B')!.has('A')).toBe(true);
  });

  it('folds in semantic edges above the threshold and ignores weaker ones', () => {
    const docs = [doc('A', 'a.md', ''), doc('B', 'b.md', ''), doc('C', 'c.md', '')];
    const adj = buildVaultAdjacency(docs, {
      semanticEdges: [
        { a: 'A', b: 'B', w: 0.7 },
        { a: 'B', b: 'C', w: 0.2 },
      ],
      semanticMinSim: 0.5,
    });
    expect(adj.get('A')!.has('B')).toBe(true);
    expect(adj.get('B')!.has('C')).toBe(false);
  });
});

describe('vault-graph-queries · kHopNeighbors', () => {
  // A — B — C — D     X — Y (separate component)
  const adj = adjFromEdges(['A', 'B', 'C', 'D', 'X', 'Y'], [
    ['A', 'B'], ['B', 'C'], ['C', 'D'], ['X', 'Y'],
  ]);

  it('returns direct neighbors at hop 1', () => {
    const hits = kHopNeighbors(adj, 'B', 1);
    expect(hits.map((h) => h.id).sort()).toEqual(['A', 'C']);
    expect(hits.every((h) => h.hops === 1)).toBe(true);
  });

  it('returns neighbors out to depth k with their hop distance', () => {
    const hits = kHopNeighbors(adj, 'A', 3);
    const byId = new Map(hits.map((h) => [h.id, h.hops]));
    expect(byId.get('B')).toBe(1);
    expect(byId.get('C')).toBe(2);
    expect(byId.get('D')).toBe(3);
    expect(byId.has('A')).toBe(false);
  });

  it('does not cross disconnected components', () => {
    const hits = kHopNeighbors(adj, 'A', 99);
    expect(hits.find((h) => h.id === 'X')).toBeUndefined();
  });

  it('returns [] for unknown start or non-positive k', () => {
    expect(kHopNeighbors(adj, 'Z', 2)).toEqual([]);
    expect(kHopNeighbors(adj, 'A', 0)).toEqual([]);
  });
});

describe('vault-graph-queries · shortestPath', () => {
  const adj = adjFromEdges(['A', 'B', 'C', 'D', 'E'], [
    ['A', 'B'], ['B', 'C'], ['C', 'D'], ['A', 'D'],
    // E is isolated
  ]);

  it('returns the source-only path when source === target', () => {
    expect(shortestPath(adj, 'A', 'A')).toEqual(['A']);
  });

  it('finds the minimum-hop path inclusive of endpoints', () => {
    const p = shortestPath(adj, 'A', 'D');
    expect(p).toEqual(['A', 'D']);
  });

  it('returns null when target is unreachable', () => {
    expect(shortestPath(adj, 'A', 'E')).toBeNull();
  });

  it('returns null when an endpoint is missing', () => {
    expect(shortestPath(adj, 'A', 'Z')).toBeNull();
  });
});

describe('vault-graph-queries · egoGraph', () => {
  // Star: center C with arms; B further out.
  const adj = adjFromEdges(['C', 'A1', 'A2', 'A3', 'B'], [
    ['C', 'A1'], ['C', 'A2'], ['C', 'A3'], ['A1', 'B'],
  ]);

  it('induces the subgraph within k hops including connecting edges', () => {
    const ego = egoGraph(adj, 'C', 1);
    expect(ego.nodes[0]).toBe('C');
    expect(new Set(ego.nodes)).toEqual(new Set(['C', 'A1', 'A2', 'A3']));
    // Edges between arms (none) shouldn't appear; edges to center should.
    const keys = ego.edges.map(([a, b]) => (a < b ? `${a}|${b}` : `${b}|${a}`)).sort();
    expect(keys).toEqual(['A1|C', 'A2|C', 'A3|C']);
  });

  it('expands to depth-k including outer-rim connections', () => {
    const ego = egoGraph(adj, 'C', 2);
    expect(ego.nodes).toContain('B');
    const keys = ego.edges.map(([a, b]) => (a < b ? `${a}|${b}` : `${b}|${a}`)).sort();
    expect(keys).toContain('A1|B');
  });

  it('returns empty when center is unknown', () => {
    expect(egoGraph(adj, 'NOPE', 2)).toEqual({ nodes: [], edges: [] });
  });
});

describe('vault-graph-queries · degreeCentrality + vaultHubs', () => {
  const adj = adjFromEdges(['A', 'B', 'C', 'D'], [
    ['A', 'B'], ['A', 'C'], ['A', 'D'], ['B', 'C'],
  ]);

  it('reports per-node degree', () => {
    const deg = degreeCentrality(adj);
    expect(deg.get('A')).toBe(3);
    expect(deg.get('B')).toBe(2);
    expect(deg.get('C')).toBe(2);
    expect(deg.get('D')).toBe(1);
  });

  it('ranks hubs by degree with deterministic tiebreak', () => {
    const top = vaultHubs(adj, 3);
    expect(top[0]).toEqual({ id: 'A', degree: 3 });
    // B and C tie at degree 2; lex-min comes first.
    expect(top[1]).toEqual({ id: 'B', degree: 2 });
    expect(top[2]).toEqual({ id: 'C', degree: 2 });
  });
});

describe('vault-graph-queries · communities', () => {
  it('groups a connected clique under a single label', () => {
    const adj = adjFromEdges(['A', 'B', 'C', 'D'], [
      ['A', 'B'], ['B', 'C'], ['C', 'A'], ['A', 'D'],
    ]);
    const labels = communities(adj);
    const distinct = new Set(labels.values());
    expect(distinct.size).toBe(1);
  });

  it('separates two disconnected components into ≥2 labels', () => {
    const adj = adjFromEdges(['A', 'B', 'X', 'Y'], [
      ['A', 'B'], ['X', 'Y'],
    ]);
    const labels = communities(adj);
    expect(labels.get('A')).toBe(labels.get('B'));
    expect(labels.get('X')).toBe(labels.get('Y'));
    expect(labels.get('A')).not.toBe(labels.get('X'));
  });

  it('is deterministic — two runs on the same graph give the same partition', () => {
    const adj = adjFromEdges(['A', 'B', 'C', 'D', 'E'], [
      ['A', 'B'], ['B', 'C'], ['D', 'E'], ['C', 'D'],
    ]);
    const r1 = communities(adj);
    const r2 = communities(adj);
    for (const k of r1.keys()) expect(r1.get(k)).toBe(r2.get(k));
  });
});
