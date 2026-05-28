// SPDX-License-Identifier: Apache-2.0

import { EditorView, ViewPlugin, type ViewUpdate, Decoration, type DecorationSet, WidgetType } from '@codemirror/view';
import { RangeSetBuilder, type Extension } from '@codemirror/state';

/**
 * Editor extras for the polish round-3 finale.
 *
 *   R13 smartCapitalize  — when the user types `. `, `! ` or `? `
 *     followed by a lowercase letter, transform that letter to its
 *     uppercase form on the next space / enter / punctuation. ⌘Z
 *     reverts the auto-cap as a single history step. Off-by-default
 *     via a toggle; enabled by `smartCapitalize()` extension factory.
 *
 *   R18 cursorTrailPlugin — while the keystroke rate exceeds 5 keys/sec
 *     a small ghost of the typed character animates to the LEFT of the
 *     caret and fades over 220ms. Up to 4 ghosts at once. Pure CSS
 *     animation; we just inject + remove DOM nodes overlaid on the
 *     editor scroller.
 */

// ── R13 Smart capitalize ─────────────────────────────────────────────

/**
 * Sentence boundary regex applied to the chars immediately before the
 * caret. Allows the sentence-ender to be optionally followed by a
 * closing quote / bracket before the mandatory space.
 */
const SENTENCE_BOUNDARY = /(?:^|[.!?][)"'\]]?)\s+([a-z])$/;

export function smartCapitalize(): Extension {
  return EditorView.updateListener.of((upd: ViewUpdate) => {
    if (!upd.docChanged) return;
    // Only fire on user-input transactions; programmatic edits skip.
    const userInput = upd.transactions.some((tr) => tr.isUserEvent('input.type') || tr.isUserEvent('input'));
    if (!userInput) return;
    // Look at the just-typed insertion: was it a single space character?
    let lastInsert = '';
    for (const tr of upd.transactions) {
      tr.changes.iterChanges((_fA, _tA, _fB, _tB, inserted) => {
        lastInsert = inserted.toString();
      });
    }
    if (lastInsert !== ' ' && lastInsert !== '\n') return;
    const { state } = upd;
    const pos = state.selection.main.head;
    const lineBefore = state.doc.sliceString(Math.max(0, pos - 64), pos);
    const m = SENTENCE_BOUNDARY.exec(lineBefore);
    if (!m) return;
    // Position of the lowercase letter we want to capitalize.
    const letterIdx = pos - 2; // last char before the just-typed space
    if (letterIdx < 0) return;
    const letter = state.doc.sliceString(letterIdx, letterIdx + 1);
    if (!/[a-z]/.test(letter)) return;
    // Dispatch the capitalization as a separate transaction so it
    // shows up as a single ⌘Z undo step.
    setTimeout(() => {
      upd.view.dispatch({
        changes: { from: letterIdx, to: letterIdx + 1, insert: letter.toUpperCase() },
        userEvent: 'input.replace',
      });
    }, 0);
  });
}

// ── R18 Cursor trail ─────────────────────────────────────────────────

interface TrailGhost { id: number; from: number; ch: string; ts: number }

class GhostWidget extends WidgetType {
  constructor(private ch: string) { super(); }
  eq(other: GhostWidget) { return other.ch === this.ch; }
  toDOM() {
    const span = document.createElement('span');
    span.className = 'mv-cursor-ghost';
    span.textContent = this.ch;
    return span;
  }
  ignoreEvent() { return true; }
}

const TRAIL_MAX = 4;
const TRAIL_LIFETIME_MS = 220;
const RATE_THRESHOLD = 5; // keys/sec

export const cursorTrailPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;
    private ghosts: TrailGhost[] = [];
    private nextId = 0;
    private recentTs: number[] = [];
    private rafId = 0;

    constructor(private view: EditorView) {
      this.tick = this.tick.bind(this);
    }

    update(upd: ViewUpdate) {
      if (!upd.docChanged) return;
      const userInput = upd.transactions.some((tr) => tr.isUserEvent('input.type') || tr.isUserEvent('input'));
      if (!userInput) return;
      const now = performance.now();
      this.recentTs.push(now);
      this.recentTs = this.recentTs.filter((t) => now - t < 1000);
      if (this.recentTs.length < RATE_THRESHOLD) return;
      // Pull just-typed character.
      let typedCh = '';
      let typedAt = 0;
      for (const tr of upd.transactions) {
        tr.changes.iterChanges((_fA, _tA, fB, _tB, inserted) => {
          const s = inserted.toString();
          if (s.length === 1 && /\S/.test(s)) { typedCh = s; typedAt = fB; }
        });
      }
      if (!typedCh) return;
      this.ghosts.push({ id: ++this.nextId, from: typedAt, ch: typedCh, ts: now });
      if (this.ghosts.length > TRAIL_MAX) this.ghosts.shift();
      this.rebuild();
      if (this.rafId === 0) this.rafId = requestAnimationFrame(this.tick);
    }

    private tick() {
      this.rafId = 0;
      const now = performance.now();
      const before = this.ghosts.length;
      this.ghosts = this.ghosts.filter((g) => now - g.ts < TRAIL_LIFETIME_MS);
      if (this.ghosts.length !== before) {
        this.rebuild();
      }
      if (this.ghosts.length > 0) this.rafId = requestAnimationFrame(this.tick);
    }

    private rebuild() {
      const builder = new RangeSetBuilder<Decoration>();
      // Sort by from to satisfy RangeSetBuilder ordering.
      const sorted = [...this.ghosts].sort((a, b) => a.from - b.from);
      for (const g of sorted) {
        builder.add(g.from, g.from, Decoration.widget({ widget: new GhostWidget(g.ch), side: -1 }));
      }
      this.decorations = builder.finish();
      this.view.dispatch({});
    }

    destroy() {
      if (this.rafId !== 0) cancelAnimationFrame(this.rafId);
    }
  },
  { decorations: (v) => v.decorations },
);
