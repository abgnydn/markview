// SPDX-License-Identifier: Apache-2.0

/**
 * Slash-command completion source. Typing `/` at the start of a line (or
 * after whitespace) followed by a letter opens a menu of insertable blocks —
 * headings, lists, tables, callouts, math, and the otherwise-undiscoverable
 * code-fence plugins (csv, chart, tabs, timeline, map, mermaid, embed).
 *
 * Reuses CodeMirror's autocomplete UI; selecting a command replaces the
 * `/query` with the block template and places the cursor sensibly.
 */

import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import type { EditorView } from '@codemirror/view';

interface SlashCmd {
  label: string;
  detail: string;
  insert: string;
  /** Cursor offset from the insertion start; defaults to end of insert. */
  cursor?: number;
}

const COMMANDS: SlashCmd[] = [
  { label: 'Heading 1', detail: '#', insert: '# ' },
  { label: 'Heading 2', detail: '##', insert: '## ' },
  { label: 'Heading 3', detail: '###', insert: '### ' },
  { label: 'Bullet list', detail: '-', insert: '- ' },
  { label: 'Numbered list', detail: '1.', insert: '1. ' },
  { label: 'Task / checkbox', detail: '- [ ]', insert: '- [ ] ' },
  { label: 'Quote', detail: '>', insert: '> ' },
  { label: 'Divider', detail: '---', insert: '---\n' },
  { label: 'Table', detail: '2 columns', insert: '| Column | Column |\n| --- | --- |\n| Cell | Cell |\n' },
  { label: 'Code block', detail: '``` ```', insert: '```\n\n```\n', cursor: 4 },
  { label: 'Math block', detail: '$$ $$', insert: '$$\n\n$$\n', cursor: 3 },
  { label: 'Callout · Note', detail: '> [!NOTE]', insert: '> [!NOTE]\n> ' },
  { label: 'Callout · Tip', detail: '> [!TIP]', insert: '> [!TIP]\n> ' },
  { label: 'Callout · Warning', detail: '> [!WARNING]', insert: '> [!WARNING]\n> ' },
  { label: 'Callout · Caution', detail: '> [!CAUTION]', insert: '> [!CAUTION]\n> ' },
  { label: 'CSV table', detail: '```csv', insert: '```csv\nName, Score\nAda, 95\nAlan, 88\n```\n' },
  { label: 'Bar chart', detail: '```chart', insert: '```chart\nApples: 30\nPears: 45\nPlums: 20\n```\n' },
  { label: 'Tabs', detail: '```tabs', insert: '```tabs\nFirst\nContent of first tab\n---\nSecond\nContent of second tab\n```\n' },
  { label: 'Timeline', detail: '```timeline', insert: '```timeline\n2024: Kicked off\n2025: Shipped v1\n```\n' },
  { label: 'Map', detail: '```map', insert: '```map\nlat: 35.3606\nlng: 138.7274\nlabel: Mount Fuji\n```\n' },
  { label: 'Mermaid diagram', detail: '```mermaid', insert: '```mermaid\ngraph TD\n  A[Start] --> B[End]\n```\n' },
  { label: 'Embed (YouTube/Figma/…)', detail: '```embed', insert: '```embed\nhttps://\n```\n', cursor: 9 },
  { label: 'Alert box', detail: '```alert', insert: '```alert\nTIP\nYour message here\n```\n' },
];

export function slashCommands(ctx: CompletionContext): CompletionResult | null {
  // Match `/word` at the very start of a line or right after whitespace, so
  // it never fires inside a path/URL like `https://` or `a/b`.
  const token = ctx.matchBefore(/(?:^|\s)\/(\w*)$/);
  if (!token) return null;
  const slashIdx = token.text.lastIndexOf('/');
  const from = token.from + slashIdx + 1; // just after the slash

  return {
    from,
    options: COMMANDS.map((c) => ({
      label: c.label,
      detail: c.detail,
      type: 'keyword',
      apply: (view: EditorView, _completion: unknown, f: number, t: number) => {
        // f-1 deletes the leading slash along with the typed query.
        view.dispatch({
          changes: { from: f - 1, to: t, insert: c.insert },
          selection: { anchor: f - 1 + (c.cursor ?? c.insert.length) },
        });
      },
    })),
    validFor: /^\w*$/,
  };
}
