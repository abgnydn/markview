import { describe, it, expect } from 'vitest';
import { buildEdges, extractLinkedIds } from '@/components/vault/vault-links';
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

function titleIndex(docs: VaultDoc[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const d of docs) m.set(d.title.replace(/\.md$/i, '').toLowerCase(), d.id);
  return m;
}

describe('vault-links · extractLinkedIds', () => {
  const docs = [
    doc('A', 'welcome.md', '# Welcome\n\nSee [[how-it-works]] and [[graph]].'),
    doc('B', 'how-it-works.md', '# Tour\n\nJump to [[welcome]].'),
    doc('C', 'graph.md', '# Graph\n\nSee [welcome](welcome.md) and [docs](./how-it-works.md).'),
    doc('D', 'ideas.md', 'Linking to missing [[nonexistent]] and external [Google](https://google.com).'),
  ];
  const idx = titleIndex(docs);

  it('resolves [[wikilinks]] case-insensitively, stripping .md', () => {
    const out = extractLinkedIds(docs[0].content, 'A', idx);
    expect(Array.from(out).sort()).toEqual(['B', 'C']);
  });

  it('resolves markdown [text](target.md) links', () => {
    const out = extractLinkedIds(docs[2].content, 'C', idx);
    expect(Array.from(out).sort()).toEqual(['A', 'B']);
  });

  it('ignores http(s) / mailto / hash-only targets', () => {
    const out = extractLinkedIds(docs[3].content, 'D', idx);
    expect(out.size).toBe(0);
  });

  it('drops self-references', () => {
    const self = doc('X', 'self.md', '[[self]] and [[self]]');
    const ownIdx = titleIndex([self]);
    const out = extractLinkedIds(self.content, 'X', ownIdx);
    expect(out.size).toBe(0);
  });

  it('handles [[link|alias]] and [[link#anchor]] syntax', () => {
    const d = doc('E', 'x.md', '[[welcome|home]] and [[how-it-works#usage]]');
    const out = extractLinkedIds(d.content, 'E', idx);
    expect(Array.from(out).sort()).toEqual(['A', 'B']);
  });
});

describe('vault-links · buildEdges', () => {
  it('produces an undirected edge list with no duplicates or self-loops', () => {
    const docs = [
      doc('A', 'a.md', '[[b]] [[c]]'),
      doc('B', 'b.md', '[[a]] [[c]]'),
      doc('C', 'c.md', '[[a]]'),
    ];
    const edges = buildEdges(docs);
    const keys = edges
      .map(([a, b]) => (a < b ? `${a}|${b}` : `${b}|${a}`))
      .sort();
    expect(keys).toEqual(['A|B', 'A|C', 'B|C']);
  });

  it('returns an empty list for a vault with no links', () => {
    const docs = [doc('A', 'a.md', 'no links'), doc('B', 'b.md', 'also none')];
    expect(buildEdges(docs)).toEqual([]);
  });

  it('gracefully handles links to nonexistent titles', () => {
    const docs = [doc('A', 'a.md', '[[missing]]')];
    expect(buildEdges(docs)).toEqual([]);
  });
});
