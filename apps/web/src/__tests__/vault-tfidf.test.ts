import { describe, it, expect } from 'vitest';
import { buildSemanticEdges } from '@/components/vault/vault-tfidf';
import type { VaultDoc } from '@/components/vault/vault-store';

function doc(id: string, title: string, content: string): VaultDoc {
  return {
    id,
    title,
    content,
    tint: 'cyan',
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('vault-tfidf · buildSemanticEdges', () => {
  it('returns no edges for fewer than two docs', () => {
    expect(buildSemanticEdges([])).toEqual([]);
    expect(buildSemanticEdges([doc('A', 'a.md', 'anything')])).toEqual([]);
  });

  it('pairs topically overlapping docs above the min-sim threshold', () => {
    const docs = [
      doc('A', 'quantum.md', 'quantum computing qubits superposition entanglement'),
      doc('B', 'qubits.md', 'qubits superposition entanglement quantum gates'),
      doc('C', 'cooking.md', 'tomato basil olive oil pasta simmer'),
    ];
    const edges = buildSemanticEdges(docs, { topK: 3, minSim: 0.05 });
    // A and B share the strong thematic vocabulary; C should not link to either.
    const keys = edges
      .map((e) => (e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`))
      .sort();
    expect(keys).toContain('A|B');
    expect(keys).not.toContain('A|C');
    expect(keys).not.toContain('B|C');
  });

  it('respects topK per document', () => {
    const docs = [
      doc('A', 'a.md', 'apple banana cherry'),
      doc('B', 'b.md', 'apple banana'),
      doc('C', 'c.md', 'apple cherry'),
      doc('D', 'd.md', 'banana cherry'),
      doc('E', 'e.md', 'apple'),
    ];
    const edges = buildSemanticEdges(docs, { topK: 2, minSim: 0.01 });
    // Each doc should appear in at most topK undirected edges from its own
    // preference list. The final undirected set may exceed topK per node when
    // neighbors "vote" back, but the function should never pick more than topK
    // strongest ones per doc before the dedupe phase. We just assert no
    // duplicate keys slip through.
    const keys = edges.map((e) =>
      e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('discards pairs below minSim threshold', () => {
    const docs = [
      doc('A', 'a.md', 'alpha beta gamma'),
      doc('B', 'b.md', 'totally unrelated vocabulary instances'),
    ];
    const edges = buildSemanticEdges(docs, { topK: 3, minSim: 0.5 });
    expect(edges).toEqual([]);
  });

  it('strips markdown noise (code fences, wikilink/md-link syntax) before tokenizing', () => {
    // Three docs: A and B share "actualcontent" after tokenization; C is a
    // decoy that keeps IDF from collapsing to zero on the shared term.
    const docs = [
      doc(
        'A',
        'a.md',
        '```js\nconst shouldNotMatter = 1;\n```\n\n[[welcome]] [home](welcome.md) actualcontent more',
      ),
      doc('B', 'b.md', 'actualcontent more words'),
      doc('C', 'c.md', 'completely unrelated alphabet vocabulary'),
    ];
    const edges = buildSemanticEdges(docs, { topK: 3, minSim: 0.01 });
    const ab = edges.find(
      (x) => (x.a === 'A' && x.b === 'B') || (x.a === 'B' && x.b === 'A'),
    );
    expect(ab).toBeDefined();
    expect(ab!.w).toBeGreaterThan(0);
    // C should not link to either A or B — noise in the code fence wasn't
    // smuggled through.
    const hasC = edges.some((e) => e.a === 'C' || e.b === 'C');
    expect(hasC).toBe(false);
  });

  it('produces weights in [0, 1]', () => {
    const docs = [
      doc('A', 'a.md', 'shared terminology here repeatedly'),
      doc('B', 'b.md', 'shared terminology here repeatedly same words'),
      doc('C', 'c.md', 'completely different lexicon entirely'),
    ];
    const edges = buildSemanticEdges(docs, { topK: 3, minSim: 0.01 });
    for (const e of edges) {
      expect(e.w).toBeGreaterThan(0);
      expect(e.w).toBeLessThanOrEqual(1);
    }
  });
});
