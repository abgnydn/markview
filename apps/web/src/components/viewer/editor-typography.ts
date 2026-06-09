// SPDX-License-Identifier: Apache-2.0

/**
 * Smart typography — as-you-type substitutions for prose:
 *   "  → “ ”   (curly, open/close by preceding char)
 *   '  → ‘ ’
 *   ...→ …      (on the third dot)
 *   ---→ —      (em dash, on the third hyphen)
 *   ->  → →     (arrow)
 *
 * Conservative on purpose, skipped inside code spans/blocks, and toggleable
 * (localStorage `mv-smart-typography` = '0' disables). The substitution rule
 * is a pure function so it's unit-tested without a live editor.
 */

import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

/**
 * Given the up-to-2 chars immediately before the caret and the just-typed
 * char, return the glyph to insert and how many preceding chars it consumes
 * (`back`), or null for no substitution.
 */
export function typographicReplacement(before: string, ch: string): { insert: string; back: number } | null {
  if (ch === '"') {
    const prev = before.slice(-1);
    return { insert: prev === '' || /[\s([{]/.test(prev) ? '“' : '”', back: 0 };
  }
  if (ch === "'") {
    const prev = before.slice(-1);
    return { insert: prev === '' || /[\s([{]/.test(prev) ? '‘' : '’', back: 0 };
  }
  if (ch === '.' && before.endsWith('..')) return { insert: '…', back: 2 };       // …
  if (ch === '-' && before.endsWith('--')) return { insert: '—', back: 2 };       // —
  if (ch === '>' && before.endsWith('-')) return { insert: '→', back: 1 };        // →
  return null;
}

function enabled(): boolean {
  try { return localStorage.getItem('mv-smart-typography') !== '0'; } catch { return true; }
}

/** CodeMirror input handler that applies typographic substitutions. */
export function smartTypography(): ReturnType<typeof EditorView.inputHandler.of> {
  return EditorView.inputHandler.of((view, from, to, text) => {
    if (text.length !== 1 || !enabled()) return false;
    // Never touch code — resolve the syntax node at the caret.
    const node = syntaxTree(view.state).resolveInner(from, -1);
    if (/Code|FencedCode|InlineCode/.test(node.type.name)) return false;
    const before = view.state.doc.sliceString(Math.max(0, from - 2), from);
    const r = typographicReplacement(before, text);
    if (!r) return false;
    view.dispatch({
      changes: { from: from - r.back, to, insert: r.insert },
      selection: { anchor: from - r.back + r.insert.length },
      userEvent: 'input.type',
    });
    return true;
  });
}
