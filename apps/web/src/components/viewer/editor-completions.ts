// SPDX-License-Identifier: Apache-2.0

/**
 * Editor completions — CodeMirror autocomplete sources for the markdown
 * editor. Two triggers:
 *
 *   [[…   → suggest workspace files. Picking one inserts `[[name]]`.
 *   #…    → suggest existing tags collected from every file in the
 *           workspace's frontmatter + inline hashtags.
 *
 * Tags + files are computed once per editor mount and cached. If you
 * want them refreshed without remounting the editor, call
 * `invalidateCompletionCache()`.
 */

import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { db } from '@/lib/storage/db';
import { parseFrontmatter } from '@/lib/markdown/frontmatter';

interface CachedSnapshot {
  files: Array<{ id: string; filename: string; label: string }>;
  tags: string[];
  workspaceId: string;
  loadedAt: number;
}

let cache: CachedSnapshot | null = null;
let pending: Promise<CachedSnapshot> | null = null;

const CACHE_TTL_MS = 30_000;

export function invalidateCompletionCache(): void {
  cache = null;
  pending = null;
}

async function loadSnapshot(workspaceId: string): Promise<CachedSnapshot> {
  if (cache && cache.workspaceId === workspaceId && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return cache;
  }
  if (pending) return pending;
  pending = (async () => {
    const dbFiles = await db.files.where('workspaceId').equals(workspaceId).toArray();
    const tagSet = new Set<string>();
    for (const f of dbFiles) {
      const fm = parseFrontmatter(f.content);
      const fmTags = (() => {
        const raw = fm.data['tags'] ?? fm.data['tag'] ?? fm.data['categories'] ?? fm.data['category'];
        if (!raw) return [];
        if (Array.isArray(raw)) return raw.map(String);
        if (typeof raw === 'string') return raw.split(/[,;]\s*/);
        return [];
      })();
      for (const t of fmTags) if (t.trim()) tagSet.add(t.trim().toLowerCase());
      const stripped = fm.content.replace(/```[\s\S]*?```/g, '');
      const re = /(?:^|\s)#([\w-]{2,32})/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(stripped)) !== null) tagSet.add(m[1].toLowerCase());
    }
    const snap: CachedSnapshot = {
      files: dbFiles.map((f) => ({
        id: f.id,
        filename: f.filename,
        label: f.displayName || f.filename.replace(/\.md$/i, ''),
      })),
      tags: Array.from(tagSet).sort(),
      workspaceId,
      loadedAt: Date.now(),
    };
    cache = snap;
    pending = null;
    return snap;
  })();
  return pending;
}

/**
 * CodeMirror completion source factory. Pass the active workspaceId at
 * the time the editor mounts; the source uses it to scope filename + tag
 * suggestions.
 */
export function markviewCompletions(workspaceId: string) {
  return async function (ctx: CompletionContext): Promise<CompletionResult | null> {
    // `[[...` — file suggestion. Match from "[[" onward to the cursor.
    const wikiToken = ctx.matchBefore(/\[\[([^\]\n]*)$/);
    if (wikiToken) {
      const q = wikiToken.text.slice(2).toLowerCase();
      const snap = await loadSnapshot(workspaceId);
      const matches = snap.files
        .filter((f) => !q || f.label.toLowerCase().includes(q) || f.filename.toLowerCase().includes(q))
        .slice(0, 12);
      return {
        from: wikiToken.from + 2, // skip the [[
        options: matches.map((f) => ({
          label: f.label,
          detail: f.filename,
          type: 'text',
          apply: `${f.label}]]`,
        })),
        validFor: /^[\w\s-]*$/,
      };
    }

    // `#…` — tag suggestion. Only fire at the start of a word.
    const tagToken = ctx.matchBefore(/(^|\s)#([\w-]*)$/);
    if (tagToken && (tagToken.text.startsWith(' #') || tagToken.text.startsWith('#'))) {
      // Find where the `#` actually sits in the doc.
      const text = tagToken.text;
      const hashIdx = text.indexOf('#');
      const q = text.slice(hashIdx + 1).toLowerCase();
      const snap = await loadSnapshot(workspaceId);
      const matches = snap.tags
        .filter((t) => !q || t.includes(q))
        .slice(0, 12);
      if (matches.length === 0 && q.length === 0) return null;
      return {
        from: tagToken.from + hashIdx + 1,
        options: matches.map((t) => ({
          label: t,
          type: 'keyword',
          apply: t,
        })),
        validFor: /^[\w-]*$/,
      };
    }

    return null;
  };
}
