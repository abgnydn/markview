// SPDX-License-Identifier: Apache-2.0

/**
 * Backlinks — find every note that links to a target note, via `[[name]]`,
 * `[[name|alias]]`, `![[name]]` transclusions, or a markdown link to the
 * target's filename. Pure + testable; the panel feeds it the workspace files.
 */

export interface BacklinkFile {
  id: string;
  displayName: string;
  filename: string;
  content: string;
}

export interface Backlink {
  fileId: string;
  label: string;
  /** The line the link appears on, trimmed for a preview. */
  snippet: string;
}

function lineAround(content: string, index: number): string {
  const start = content.lastIndexOf('\n', index) + 1;
  let end = content.indexOf('\n', index);
  if (end === -1) end = content.length;
  return content.slice(start, end).trim().slice(0, 140);
}

export function findBacklinks(
  target: { id: string; displayName: string; filename: string },
  files: BacklinkFile[],
): Backlink[] {
  const names = new Set<string>();
  for (const n of [target.displayName, target.filename, target.filename.replace(/\.md$/i, '')]) {
    if (n) names.add(n.toLowerCase());
  }

  const results: Backlink[] = [];
  for (const f of files) {
    if (f.id === target.id) continue;
    let hitIndex = -1;

    // [[name]] / [[name|alias]] / ![[name]] / ![[name#section]]
    const wikiRe = /!?\[\[\s*([^\]#|]+?)\s*(?:[#|][^\]]*)?\]\]/g;
    let m: RegExpExecArray | null;
    while ((m = wikiRe.exec(f.content)) !== null) {
      if (names.has(m[1].trim().toLowerCase())) { hitIndex = m.index; break; }
    }

    // [text](name) / [text](name.md)
    if (hitIndex === -1) {
      const mdRe = /\]\(([^)\s]+)\)/g;
      while ((m = mdRe.exec(f.content)) !== null) {
        const href = m[1].trim().replace(/^\.?\//, '').replace(/\.md$/i, '').toLowerCase();
        if (names.has(href)) { hitIndex = m.index; break; }
      }
    }

    if (hitIndex !== -1) {
      results.push({
        fileId: f.id,
        label: f.displayName || f.filename,
        snippet: lineAround(f.content, hitIndex),
      });
    }
  }
  return results;
}
