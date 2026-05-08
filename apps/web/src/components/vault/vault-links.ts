'use client';

import type { VaultDoc } from './vault-store';

const WIKILINK = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;
const MD_LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;

function normTitle(s: string): string {
  // Drop any fragment/query, take the final path segment, strip .md, lowercase.
  // This lets [text](./how-it-works.md) and [[how-it-works]] resolve to the
  // same title index entry.
  const noFragment = s.split(/[#?]/)[0];
  const parts = noFragment.split('/');
  const last = parts[parts.length - 1] ?? noFragment;
  return last.trim().replace(/\.md$/i, '').toLowerCase();
}

function buildTitleIndex(docs: VaultDoc[]): Map<string, string> {
  const idx = new Map<string, string>();
  for (const d of docs) idx.set(normTitle(d.title), d.id);
  return idx;
}

/** Collect the set of doc IDs this doc links to (outbound references). */
export function extractLinkedIds(
  content: string,
  selfId: string,
  titleIndex: Map<string, string>,
): Set<string> {
  const out = new Set<string>();

  WIKILINK.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKILINK.exec(content))) {
    const id = titleIndex.get(normTitle(m[1]));
    if (id && id !== selfId) out.add(id);
  }

  MD_LINK.lastIndex = 0;
  while ((m = MD_LINK.exec(content))) {
    const raw = m[1];
    if (/^https?:/i.test(raw) || /^mailto:/i.test(raw) || raw.startsWith('#')) continue;
    const id = titleIndex.get(normTitle(raw.split(/[#?]/)[0]));
    if (id && id !== selfId) out.add(id);
  }

  return out;
}

/** Undirected edge list (no duplicates, no self-loops). */
export function buildEdges(docs: VaultDoc[]): Array<[string, string]> {
  const titleIndex = buildTitleIndex(docs);
  const edges: Array<[string, string]> = [];
  const seen = new Set<string>();

  for (const d of docs) {
    const out = extractLinkedIds(d.content, d.id, titleIndex);
    for (const targetId of out) {
      const a = d.id < targetId ? d.id : targetId;
      const b = d.id < targetId ? targetId : d.id;
      const key = `${a}|${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([d.id, targetId]);
    }
  }

  return edges;
}
