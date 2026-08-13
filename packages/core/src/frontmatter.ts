/**
 * Parse YAML frontmatter from markdown content.
 * Returns the frontmatter data and the content without frontmatter.
 *
 * @example
 * ```ts
 * import { parseFrontmatter } from '@markview/core';
 *
 * const { data, content } = parseFrontmatter(`---
 * title: My Document
 * tags: [typescript, markdown]
 * ---
 * # Hello World`);
 *
 * console.log(data.title);  // "My Document"
 * console.log(data.tags);   // ["typescript", "markdown"]
 * ```
 */

export interface FrontmatterResult {
  data: Record<string, string | string[] | number | boolean>;
  content: string;
}

export function parseFrontmatter(raw: string): FrontmatterResult {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('---')) {
    return { data: {}, content: raw };
  }

  // The closing delimiter must be a standalone `---` line — a bare
  // indexOf('\n---') would match `\n---anything` (e.g. a YAML value or a
  // 4-dash rule) and split the document in the wrong place.
  const closeMatch = /\n---[ \t]*(?:\n|$)/.exec(trimmed.slice(3));
  if (!closeMatch) {
    return { data: {}, content: raw };
  }
  const endIdx = 3 + closeMatch.index;

  const yamlBlock = trimmed.slice(4, endIdx).trim();
  const content = trimmed.slice(endIdx + closeMatch[0].length).trimStart();
  const data: Record<string, string | string[] | number | boolean> = {};

  for (const line of yamlBlock.split('\n')) {
    const match = line.match(/^(\w[\w\s-]*?):\s*(.+)$/);
    if (!match) continue;
    const [, key, value] = match;
    const k = key.trim();
    const v = value.trim();

    // Try to parse arrays like [a, b, c]
    if (v.startsWith('[') && v.endsWith(']')) {
      data[k] = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
    } else if (v === 'true') {
      data[k] = true;
    } else if (v === 'false') {
      data[k] = false;
    } else if (!isNaN(Number(v)) && v !== '') {
      data[k] = Number(v);
    } else {
      data[k] = v.replace(/^["']|["']$/g, '');
    }
  }

  return { data, content };
}
