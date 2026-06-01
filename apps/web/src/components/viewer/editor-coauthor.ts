// SPDX-License-Identifier: Apache-2.0

import { StateField, StateEffect, type Extension } from '@codemirror/state';
import { EditorView, Decoration, type DecorationSet, WidgetType, keymap } from '@codemirror/view';
import { continueWriting } from '@/lib/generation';

/**
 * AI co-author — Tab at the end of a line spawns a ghost continuation
 * paragraph generated in the user's voice (Cloudflare Workers AI
 * Llama-3.3-70B, same backend as cloud chat). The ghost renders as a
 * dimmed inline widget after the cursor; it is NOT in the document yet.
 *
 *   Tab    (at line end, no selection) → request a ghost continuation
 *   ⌘↵ / Ctrl↵                         → accept: insert the ghost text
 *   Esc                                → reject: discard the ghost
 *   any edit                           → discard the ghost
 *
 * The ghost streams token-by-token as the model generates, so you see
 * the continuation appear live. Cloud-only; if the request fails or
 * returns empty, Tab falls through to its normal indent behavior.
 */

// ── State ────────────────────────────────────────────────────────────

interface GhostState {
  /** Document offset where the ghost is anchored (the cursor at request). */
  pos: number;
  /** Streamed text so far. */
  text: string;
  /** True while the model is still generating. */
  pending: boolean;
}

const setGhost = StateEffect.define<GhostState | null>();

const ghostField = StateField.define<GhostState | null>({
  create: () => null,
  update(value, tr) {
    // Any doc change that isn't our own ghost-streaming clears it.
    for (const e of tr.effects) {
      if (e.is(setGhost)) return e.value;
    }
    if (tr.docChanged && value) return null;
    // Selection move away from the anchor also clears.
    if (value && tr.selection && tr.selection.main.head !== value.pos) return null;
    return value;
  },
  provide: (f) => EditorView.decorations.from(f, (g) => {
    if (!g || !g.text) return Decoration.none;
    return Decoration.set([
      Decoration.widget({
        widget: new GhostWidget(g.text, g.pending),
        side: 1,
      }).range(g.pos),
    ]);
  }),
});

class GhostWidget extends WidgetType {
  constructor(private text: string, private pending: boolean) { super(); }
  eq(other: GhostWidget) { return other.text === this.text && other.pending === this.pending; }
  toDOM() {
    const span = document.createElement('span');
    span.className = 'mv-coauthor-ghost' + (this.pending ? ' mv-coauthor-pending' : '');
    span.textContent = this.text;
    // A hint suffix once generation is done.
    if (!this.pending && this.text) {
      const hint = document.createElement('span');
      hint.className = 'mv-coauthor-hint';
      hint.textContent = '  ⌘↵ accept · esc';
      span.appendChild(hint);
    }
    return span;
  }
  ignoreEvent() { return true; }
}

// ── Module-scoped abort so a new request cancels the old ────────────────
let activeAbort: AbortController | null = null;

function requestGhost(view: EditorView): boolean {
  const { state } = view;
  const sel = state.selection.main;
  if (!sel.empty) return false; // only at a bare cursor
  const pos = sel.head;
  const line = state.doc.lineAt(pos);
  // Only fire at the END of a line (so Tab still indents mid-line).
  if (pos !== line.to) return false;
  // Need some preceding text to continue from.
  const before = state.doc.sliceString(0, pos);
  if (before.trim().length < 12) return false;

  // Cancel any in-flight request, seed an empty pending ghost.
  activeAbort?.abort();
  const ac = new AbortController();
  activeAbort = ac;
  view.dispatch({ effects: setGhost.of({ pos, text: '', pending: true }) });

  void continueWriting(before, {
    signal: ac.signal,
    onToken: (_chunk, full) => {
      // Bail if this request was superseded or the ghost cleared.
      if (ac.signal.aborted) return;
      const cur = view.state.field(ghostField, false);
      if (!cur || cur.pos !== pos) return;
      view.dispatch({ effects: setGhost.of({ pos, text: full, pending: true }) });
    },
  }).then((finalText) => {
    if (ac.signal.aborted) return;
    const cur = view.state.field(ghostField, false);
    if (!cur || cur.pos !== pos) return;
    if (!finalText) {
      view.dispatch({ effects: setGhost.of(null) });
      return;
    }
    view.dispatch({ effects: setGhost.of({ pos, text: finalText, pending: false }) });
  });

  return true; // consumed the Tab
}

function acceptGhost(view: EditorView): boolean {
  const g = view.state.field(ghostField, false);
  if (!g || !g.text || g.pending) return false;
  activeAbort?.abort();
  view.dispatch({
    changes: { from: g.pos, insert: g.text },
    selection: { anchor: g.pos + g.text.length },
    effects: setGhost.of(null),
  });
  return true;
}

function rejectGhost(view: EditorView): boolean {
  const g = view.state.field(ghostField, false);
  if (!g) return false;
  activeAbort?.abort();
  view.dispatch({ effects: setGhost.of(null) });
  return true;
}

/**
 * The co-author extension bundle. Inserted into the editor's extension
 * list. Tab is bound here with higher precedence than indentWithTab so
 * the ghost request runs first; when it returns false (mid-line, no
 * context, etc.) the keymap falls through to indent.
 */
export function coAuthor(): Extension {
  return [
    ghostField,
    keymap.of([
      { key: 'Tab', run: requestGhost },
      { key: 'Mod-Enter', run: acceptGhost },
      { key: 'Escape', run: rejectGhost },
    ]),
  ];
}
