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

  const endIdx = trimmed.indexOf('\n---', 3);
  if (endIdx === -1) {
    return { data: {}, content: raw };
  }

  const yamlBlock = trimmed.slice(4, endIdx).trim();
  const content = trimmed.slice(endIdx + 4).trimStart();
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
