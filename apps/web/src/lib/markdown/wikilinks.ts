// SPDX-License-Identifier: Apache-2.0
//
// Expand `[[name]]` / `[[name|alias]]` wikilinks into standard markdown
// links (`[label](name.md)`) so they flow through the same internal-link
// handler as `[text](other.md)`.
//
// CODE-AWARE: the pass must not touch `[[...]]` inside fenced blocks or
// inline code — a config sample mentioning `[[foo]]` is content, not a
// link. Same segmentation trick as the core pipeline's extractMath: split
// on code spans; odd indices are code and pass through untouched.

const WIKILINK = /\[\[([^\]\n|]+?)(?:\|([^\]\n]+))?\]\]/g;

export function expandWikilinks(source: string): string {
  const segments = source.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  return segments
    .map((seg, i) => {
      if (i % 2 === 1) return seg; // code — leave verbatim
      return seg.replace(WIKILINK, (_match, target: string, alias?: string) => {
        const label = (alias ?? target).trim();
        const href = `${target.trim()}.md`;
        return `[${label}](${href})`;
      });
    })
    .join('');
}
