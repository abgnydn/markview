// SPDX-License-Identifier: Apache-2.0

/**
 * remark plugin for extended inline syntax that plain GFM lacks:
 *
 *   ==highlight==   → <mark>highlight</mark>
 *   ^superscript^   → <sup>superscript</sup>   (e.g. 2^10^, E=mc^2^)
 *   ~subscript~     → <sub>subscript</sub>      (e.g. H~2~O)
 *   :shortcode:     → emoji (curated common set; unknown codes pass through)
 *
 * Runs AFTER remark-gfm, so `~~strike~~` is already a `delete` node and the
 * single-tilde subscript rule never touches it. Only visits `text` nodes, so
 * code spans / fenced code (separate node types) are never rewritten.
 */

import type { Root, Text } from 'mdast';
import type { Plugin } from 'unified';
import { visit, SKIP } from 'unist-util-visit';
import { EMOJI } from './emoji-map';

// One alternation; capture groups identify which form matched.
//   1: ==mark==   2: ^sup^   3: ~sub~   4: :emoji:
const TOKEN = /==([^=\n]+)==|\^([^\s^]+)\^|~([^\s~]+)~|:([a-z0-9_+-]+):/g;

interface InlineNode {
  type: string;
  value?: string;
  data?: { hName: string };
  children?: InlineNode[];
}

function wrap(hName: string, value: string): InlineNode {
  return { type: hName, data: { hName }, children: [{ type: 'text', value }] };
}

function tokenize(value: string): InlineNode[] | null {
  TOKEN.lastIndex = 0;
  const out: InlineNode[] = [];
  let last = 0;
  let matched = false;
  let m: RegExpExecArray | null;
  while ((m = TOKEN.exec(value)) !== null) {
    if (m.index > last) out.push({ type: 'text', value: value.slice(last, m.index) });
    if (m[1] != null) { out.push(wrap('mark', m[1])); matched = true; }
    else if (m[2] != null) { out.push(wrap('sup', m[2])); matched = true; }
    else if (m[3] != null) { out.push(wrap('sub', m[3])); matched = true; }
    else if (m[4] != null) {
      const glyph = EMOJI[m[4]];
      if (glyph) { out.push({ type: 'text', value: glyph }); matched = true; }
      else { out.push({ type: 'text', value: m[0] }); } // keep unknown :code: literal
    }
    last = TOKEN.lastIndex;
  }
  if (!matched) return null;
  if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
  return out;
}

export const remarkInlineExtras: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (parent == null || index == null) return;
      const replacement = tokenize(node.value);
      if (!replacement) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parent.children.splice(index, 1, ...(replacement as any));
      return [SKIP, index + replacement.length];
    });
  };
};
