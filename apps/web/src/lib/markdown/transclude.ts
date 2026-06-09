// SPDX-License-Identifier: Apache-2.0

/**
 * Transclusion — `![[note]]` embeds another note's content inline, and
 * `![[note#Heading]]` embeds just that section. (`[[note]]` without the `!`
 * stays a regular wikilink.) Expansion is recursive with a depth + cycle
 * guard so a note embedding itself can't loop forever.
 *
 * The actual note lookup is injected as a resolver so this stays pure and
 * testable; the viewer wires it to the workspace's IndexedDB files.
 */

export type TranscludeResolver = (name: string, heading?: string) => Promise<string | null>;

const MAX_DEPTH = 4;

/**
 * Return the markdown of the section under `heading` (inclusive of the
 * heading line) up to the next same-or-higher-level heading. Empty string
 * if the heading isn't found.
 */
export function extractSection(md: string, heading: string): string {
  const norm = (s: string) => s.replace(/[#*_`~]/g, '').trim().toLowerCase();
  const target = norm(heading);
  const lines = md.split('\n');
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^(#{1,6})\s+(.*)$/);
    if (h && norm(h[2]) === target) { start = i; level = h[1].length; break; }
  }
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const h = lines[i].match(/^(#{1,6})\s+/);
    if (h && h[1].length <= level) { end = i; break; }
  }
  return lines.slice(start, end).join('\n').trim();
}

/** True if the content contains at least one `![[...]]` transclusion. */
export function hasTransclusion(content: string): boolean {
  return /!\[\[[^\]]+\]\]/.test(content);
}

/** Expand every `![[note]]` / `![[note#heading]]` in `content`. */
export async function expandTransclusions(
  content: string,
  resolve: TranscludeResolver,
  depth = 0,
  seen: Set<string> = new Set(),
): Promise<string> {
  if (depth > MAX_DEPTH) return content;
  const re = /!\[\[\s*([^\]#|]+?)\s*(?:#\s*([^\]|]+?)\s*)?\]\]/g;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    out += content.slice(last, m.index);
    const name = m[1].trim();
    const heading = m[2]?.trim();
    const key = `${name.toLowerCase()}#${(heading ?? '').toLowerCase()}`;
    if (seen.has(key)) {
      out += `*(circular embed: ${name})*`;
    } else {
      const raw = await resolve(name, heading);
      if (raw == null) {
        out += `> [!WARNING]\n> Embedded note not found: ${name}`;
      } else {
        const next = new Set(seen);
        next.add(key);
        out += await expandTransclusions(raw, resolve, depth + 1, next);
      }
    }
    last = m.index + m[0].length;
  }
  out += content.slice(last);
  return out;
}
