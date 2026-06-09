// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Save, X, Edit3, Bold, Italic, Strikethrough, Highlighter, Code, Link2,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, Minus, Clock,
} from 'lucide-react';
import { createSnapshot } from '@/lib/snapshots';
import { HistoryPanel } from './history-panel';
import { EditorState, type Extension, RangeSetBuilder } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, highlightActiveLine,
  Decoration, type DecorationSet, ViewPlugin, type ViewUpdate,
} from '@codemirror/view';
import { markdown, markdownLanguage, insertNewlineContinueMarkup, deleteMarkupBackward } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { yCollab } from 'y-codemirror.next';
import { autocompletion, CompletionContext, closeBrackets } from '@codemirror/autocomplete';
import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import { MarkdownRenderer } from './markdown-renderer';
import { coAuthor } from './editor-coauthor';
import { markviewCompletions, invalidateCompletionCache } from './editor-completions';
import { slashCommands } from './editor-slash';
import { clipboardToTable } from './editor-paste';

interface MarkdownEditorProps {
  content: string;
  filename: string;
  /** File id — required for version-history snapshots to attach to the
      right file. If unset, snapshotting is disabled. */
  fileId?: string;
  workspaceId?: string;
  onSave: (content: string) => void;
  onClose: () => void;
  /**
   * Optional Y.Text the editor binds to for real-time collaboration.
   * When set, undo/redo flows through Yjs's UndoManager and edits sync
   * to every peer in the room. When unset, the editor is solo and the
   * `content` prop seeds the initial document.
   */
  yText?: Y.Text;
  awareness?: Awareness;
}

// Format-button kinds the toolbar dispatches.
type FormatKind =
  | 'bold' | 'italic' | 'strikethrough' | 'code' | 'highlight' | 'link'
  | 'h1' | 'h2' | 'h3'
  | 'ul' | 'ol' | 'quote' | 'hr';

/**
 * Toggle a symmetric inline marker (`**`, `*`, `~~`, `` ` ``, `==`) around the
 * selection: unwrap if it's already wrapped (markers inside OR just outside
 * the selection), otherwise wrap. With no selection, insert a placeholder.
 */
function toggleWrap(view: EditorView, marker: string, placeholder: string): void {
  const { state } = view;
  const sel = state.selection.main;
  const selected = state.doc.sliceString(sel.from, sel.to);
  const n = marker.length;

  if (selected) {
    if (selected.length >= n * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
      const inner = selected.slice(n, selected.length - n);
      view.dispatch({ changes: { from: sel.from, to: sel.to, insert: inner }, selection: { anchor: sel.from, head: sel.from + inner.length } });
      return;
    }
    const before = state.doc.sliceString(Math.max(0, sel.from - n), sel.from);
    const after = state.doc.sliceString(sel.to, Math.min(state.doc.length, sel.to + n));
    if (before === marker && after === marker) {
      view.dispatch({
        changes: [{ from: sel.from - n, to: sel.from }, { from: sel.to, to: sel.to + n }],
        selection: { anchor: sel.from - n, head: sel.to - n },
      });
      return;
    }
    const insert = `${marker}${selected}${marker}`;
    view.dispatch({ changes: { from: sel.from, to: sel.to, insert }, selection: { anchor: sel.from + n, head: sel.from + n + selected.length } });
    return;
  }
  const insert = `${marker}${placeholder}${marker}`;
  view.dispatch({ changes: { from: sel.from, insert }, selection: { anchor: sel.from + n, head: sel.from + n + placeholder.length } });
  view.focus();
}

/**
 * Apply a markdown formatting transform around the current selection (or at
 * the caret if nothing is selected). Implemented as a CodeMirror transaction
 * so undo/redo + collaborative edits both round-trip cleanly.
 */
function applyFormat(view: EditorView, kind: FormatKind): void {
  const { state } = view;
  const sel = state.selection.main;
  const selected = state.doc.sliceString(sel.from, sel.to);

  // Symmetric inline markers toggle (wrap / unwrap).
  switch (kind) {
    case 'bold': return toggleWrap(view, '**', 'bold');
    case 'italic': return toggleWrap(view, '*', 'italic');
    case 'strikethrough': return toggleWrap(view, '~~', 'text');
    case 'highlight': return toggleWrap(view, '==', 'highlight');
    case 'code':
      if (selected.includes('\n')) break; // fenced block — handled below
      return toggleWrap(view, '`', 'code');
  }

  let insert = '';
  let cursorOffset = 0;

  switch (kind) {
    case 'code':
      // Multi-line selection → fenced code block.
      insert = `\`\`\`\n${selected}\n\`\`\``;
      cursorOffset = 4;
      break;
    case 'link':
      insert = selected ? `[${selected}](url)` : '[text](url)';
      cursorOffset = selected ? selected.length + 3 : 1;
      break;
    case 'h1':
      insert = `# ${selected || 'Heading'}`;
      cursorOffset = 2;
      break;
    case 'h2':
      insert = `## ${selected || 'Heading'}`;
      cursorOffset = 3;
      break;
    case 'h3':
      insert = `### ${selected || 'Heading'}`;
      cursorOffset = 4;
      break;
    case 'ul':
      insert = selected
        ? selected.split('\n').map((l) => `- ${l}`).join('\n')
        : '- Item';
      cursorOffset = 2;
      break;
    case 'ol':
      insert = selected
        ? selected.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n')
        : '1. Item';
      cursorOffset = 3;
      break;
    case 'quote':
      insert = selected
        ? selected.split('\n').map((l) => `> ${l}`).join('\n')
        : '> Quote';
      cursorOffset = 2;
      break;
    case 'hr':
      insert = '\n---\n';
      cursorOffset = insert.length;
      break;
  }

  const anchor = sel.from + (selected ? insert.length : cursorOffset);
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert },
    selection: { anchor, head: selected ? sel.from : anchor },
  });
  view.focus();
}

// Zen syntax highlight — markdown markers fade; prose stays warm and present.
// Hierarchy: heading > strong > body > emphasis > meta. Color is sparse on
// purpose so the EYE is led by typography (size + weight), not paint.
//
// All colors funnel through theme-aware CSS variables defined in zen.css so
// the same theme works on dark paper AND light cream — no separate light/dark
// theme objects needed.
const markviewHighlight = HighlightStyle.define([
  { tag: t.heading,       class: 'cm-tok-heading' },
  { tag: t.heading1,      class: 'cm-tok-heading cm-tok-h1' },
  { tag: t.heading2,      class: 'cm-tok-heading cm-tok-h2' },
  { tag: t.heading3,      class: 'cm-tok-heading cm-tok-h3' },
  { tag: t.strong,        class: 'cm-tok-strong' },
  { tag: t.emphasis,      class: 'cm-tok-emphasis' },
  { tag: t.strikethrough, class: 'cm-tok-strikethrough' },
  { tag: t.link,          class: 'cm-tok-link' },
  { tag: t.url,           class: 'cm-tok-url' },
  { tag: t.monospace,     class: 'cm-tok-code' },
  { tag: t.list,          class: 'cm-tok-list' },
  { tag: t.quote,         class: 'cm-tok-quote' },
  { tag: t.meta,          class: 'cm-tok-meta' },
  { tag: t.comment,       class: 'cm-tok-meta' },
]);

/**
 * Focus-paragraph mode — the paragraph holding the caret stays full-ink;
 * everything else dims to half-opacity. iA Writer / Hemingway feel.
 * A "paragraph" is a run of non-blank lines (markdown block).
 */
const focusParagraphPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(u: ViewUpdate) {
      if (u.selectionSet || u.docChanged || u.viewportChanged) {
        this.decorations = this.build(u.view);
      }
    }
    build(view: EditorView): DecorationSet {
      const cursor = view.state.selection.main.head;
      const doc = view.state.doc;
      const cursorLine = doc.lineAt(cursor).number;
      let pStart = cursorLine;
      let pEnd = cursorLine;
      while (pStart > 1 && doc.line(pStart - 1).text.trim() !== '') pStart--;
      while (pEnd < doc.lines && doc.line(pEnd + 1).text.trim() !== '') pEnd++;
      const builder = new RangeSetBuilder<Decoration>();
      const { from, to } = view.viewport;
      const firstVisible = doc.lineAt(from).number;
      const lastVisible = doc.lineAt(to).number;
      for (let i = firstVisible; i <= lastVisible; i++) {
        if (i < pStart || i > pEnd) {
          const line = doc.line(i);
          builder.add(line.from, line.from, Decoration.line({ class: 'cm-zen-dim' }));
        }
      }
      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations },
);

// Zen editor surface — warm paper feel. Generous left/right padding centers
// the prose; the editor surface itself is the "paper". No active-line bg,
// no harsh selection, soft violet caret with a slow breath + glow.
const markviewTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      fontSize: '17px',
      backgroundColor: 'transparent',
      // Base text color comes from the zen palette — adapts to light/dark
      // automatically since the var is set on the html element.
      color: 'var(--zen-fg)',
    },
    '.cm-scroller': {
      fontFamily:
        "'Iowan Old Style', 'Charter', 'Iowan', 'New York', 'Source Serif Pro', Georgia, serif",
      lineHeight: '1.72',
    },
    '.cm-content': {
      // Mirror the renderer's content width so the editor feels like the
      // same page, just with markup made visible. Modest top padding (~6vh)
      // so the title opens near the top; generous bottom padding lets any
      // line reach viewport-center as the user types deeper (typewriter
      // affordance).
      maxWidth: '720px',
      margin: '0 auto',
      padding: '6vh 4vw 50vh',
      caretColor: 'var(--zen-accent, #9b7dff)',
    },
    '.cm-gutters': { display: 'none' },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent' },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--zen-accent-soft, rgba(155, 125, 255, 0.22))',
    },
    '.cm-cursor, .cm-cursor-primary': {
      borderLeftColor: 'var(--zen-accent, #9b7dff)',
      borderLeftWidth: '2px',
      boxShadow: '0 0 10px var(--zen-accent-glow, rgba(155, 125, 255, 0.45))',
      animation: 'zen-caret-breath 1100ms ease-in-out infinite',
    },
    '.cm-line': {
      // Slight horizontal padding so wrap doesn't kiss the margin.
      paddingLeft: '0',
      paddingRight: '0',
      transition: 'opacity 320ms cubic-bezier(0.32, 0.72, 0.32, 1)',
    },
    // Focus-paragraph dim: every line that isn't part of the cursor's
    // paragraph fades. The plugin tags the right lines.
    '.cm-line.cm-zen-dim': { opacity: 'var(--zen-dim-opacity, 0.55)' },
    // Syntax highlight tokens — driven by CSS vars so they adapt to theme.
    '.cm-tok-heading':       { color: 'var(--zen-fg)', fontWeight: '700' },
    '.cm-tok-h1':            { fontSize: '1.18em', fontWeight: '800' },
    '.cm-tok-h2':            { fontWeight: '700' },
    '.cm-tok-h3':            { fontWeight: '600' },
    '.cm-tok-strong':        { color: 'var(--zen-fg)', fontWeight: '700' },
    '.cm-tok-emphasis':      { color: 'var(--zen-fg)', fontStyle: 'italic' },
    '.cm-tok-strikethrough': { color: 'var(--zen-fg-faint)', textDecoration: 'line-through' },
    '.cm-tok-link':          { color: 'var(--zen-accent)' },
    '.cm-tok-url':           { color: 'var(--zen-accent)' },
    '.cm-tok-code':          { color: 'var(--zen-code)' },
    '.cm-tok-list':          { color: 'var(--zen-fg-soft)' },
    '.cm-tok-quote':         { color: 'var(--zen-fg-soft)', fontStyle: 'italic' },
    '.cm-tok-meta':          { color: 'var(--zen-fg-faint)' },
  },
);

/** First image File from a clipboard / drag DataTransfer, or null. */
function imageFromTransfer(dt: DataTransfer): File | null {
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) return f;
    }
  }
  for (const f of Array.from(dt.files ?? [])) {
    if (f.type.startsWith('image/')) return f;
  }
  return null;
}

/** Store an image as a local asset and insert `![alt](asset:id)` at `pos`
 *  (or the cursor). Returns the position just after the inserted text. */
async function insertImageAsset(
  view: EditorView,
  file: File,
  workspaceId: string,
  pos?: number,
): Promise<number> {
  const { storeAsset } = await import('@/lib/assets');
  const id = await storeAsset(file, workspaceId);
  const alt = (file.name || 'image').replace(/\.[^.]+$/, '');
  const at = pos ?? view.state.selection.main.head;
  const md = `![${alt}](asset:${id})`;
  view.dispatch({ changes: { from: at, insert: md }, selection: { anchor: at + md.length } });
  return at + md.length;
}

function buildExtensions(
  onDocChange: (doc: string) => void,
  collab: { yText?: Y.Text; awareness?: Awareness },
  workspaceId?: string,
): Extension[] {
  // y-codemirror.next ships its own UndoManager; bypass CodeMirror's
  // history extension when collab is active so undo doesn't double-fire.
  const collabExt = collab.yText
    ? [yCollab(collab.yText, collab.awareness ?? null)]
    : [history()];

  // Autocomplete sources — [[file]] picker + #tag picker. Only attach
  // if we have a workspace context, otherwise skip.
  const completionExt = workspaceId
    ? [
        autocompletion({
          override: [
            (ctx: CompletionContext) => markviewCompletions(workspaceId)(ctx),
            slashCommands,
          ],
          activateOnTyping: true,
          maxRenderedOptions: 12,
        }),
        closeBrackets(),
      ]
    : [];

  return [
    ...collabExt,
    ...completionExt,
    lineNumbers(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    syntaxHighlighting(markviewHighlight),
    focusParagraphPlugin,
    markviewTheme,
    // Smart-paste:
    //   0. an image  → store locally + insert ![](asset:id)
    //   1. a URL pasted over a selection  → [selection](url)
    //   2. spreadsheet / HTML-table data  → a markdown table
    //   3. a bare URL on an empty line    → [host](url)
    EditorView.domEventHandlers({
      paste(event, view) {
        const cd = event.clipboardData;
        if (!cd) return false;

        // 0. Image on the clipboard → persist as a local asset.
        const imageFile = imageFromTransfer(cd);
        if (imageFile && workspaceId) {
          event.preventDefault();
          void insertImageAsset(view, imageFile, workspaceId);
          return true;
        }

        const text = cd.getData('text/plain') ?? '';
        const html = cd.getData('text/html') ?? '';
        const { state } = view;
        const sel = state.selection.main;
        const urlMatch = text.trim().match(/^(https?:\/\/[^\s]+)$/i);

        // 1. URL over a non-empty selection → wrap it as a link.
        if (urlMatch && !sel.empty) {
          const selected = state.sliceDoc(sel.from, sel.to);
          event.preventDefault();
          view.dispatch({ changes: { from: sel.from, to: sel.to, insert: `[${selected}](${urlMatch[1]})` } });
          return true;
        }

        // 2. Tabular paste (Excel / Sheets / web table) → markdown table.
        const table = clipboardToTable(text, html);
        if (table) {
          event.preventDefault();
          view.dispatch({
            changes: { from: sel.from, to: sel.to, insert: table },
            selection: { anchor: sel.from + table.length },
          });
          return true;
        }

        // 3. Bare URL on an otherwise-empty line → [host](url).
        if (urlMatch) {
          let host = '';
          try { host = new URL(urlMatch[1]!).host.replace(/^www\./, ''); } catch { return false; }
          const line = state.doc.lineAt(sel.head);
          if (line.text.trim() !== '') return false;
          event.preventDefault();
          view.dispatch({ changes: { from: line.from, to: line.to, insert: `[${host}](${urlMatch[1]!})` } });
          return true;
        }
        return false;
      },
      drop(event, view) {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => /^image\//.test(f.type));
        if (files.length === 0 || !workspaceId) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head;
        void (async () => {
          let at = pos;
          for (const f of files) at = await insertImageAsset(view, f, workspaceId, at);
        })();
        return true;
      },
    }),
    // AI co-author — Tab at line-end spawns a ghost continuation in
    // the user's voice (cloud Llama-3.3). Bound BEFORE indentWithTab so
    // it gets first crack at Tab; it returns false mid-line / without
    // context, falling through to normal indentation.
    coAuthor(),
    // Markdown list/quote continuation — Enter in a `- `/`1.`/`> `/`- [ ]`
    // block starts the next item (double-Enter on an empty item exits it);
    // Backspace at the start of a marker removes it. Bound before the default
    // keymap so it wins on Enter/Backspace.
    keymap.of([
      { key: 'Enter', run: insertNewlineContinueMarkup },
      { key: 'Backspace', run: deleteMarkupBackward },
    ]),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      indentWithTab,
    ]),
    EditorView.lineWrapping,
    EditorView.updateListener.of((upd) => {
      if (upd.docChanged) onDocChange(upd.state.doc.toString());
    }),
  ];
}

export function MarkdownEditor({
  content,
  filename,
  fileId,
  workspaceId,
  onSave,
  onClose,
  yText,
  awareness,
}: MarkdownEditorProps) {
  // When collab is on, the Y.Text is the source of truth — seed local state
  // from it and let the updateListener mirror future edits back.
  const initialText = yText ? yText.toString() : content;
  const [text, setText] = useState(initialText);
  // Debounced copy of `text` that drives the live preview — without it the
  // full markdown→Shiki→mermaid→KaTeX pipeline re-runs on every keystroke.
  // The CodeMirror buffer stays live; only the heavy renderer waits ~180ms.
  const [previewText, setPreviewText] = useState(initialText);
  useEffect(() => {
    const id = window.setTimeout(() => setPreviewText(text), 180);
    return () => window.clearTimeout(id);
  }, [text]);
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>('split');
  const [showHistory, setShowHistory] = useState(false);
  // #15 Cursor halo — add .editor-typing class while the user is
  // actively typing (decays 800ms after the last keystroke), so the
  // violet glow only appears when the caret is "alive".
  const [isTyping, setIsTyping] = useState(false);
  const typingTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const onKey = () => {
      setIsTyping(true);
      if (typingTimerRef.current !== null) window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = window.setTimeout(() => setIsTyping(false), 800);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (typingTimerRef.current !== null) window.clearTimeout(typingTimerRef.current);
    };
  }, []);
  // In collab mode "modified vs saved" is meaningless (the host's local
  // disk-save flow doesn't apply); we hide the unsaved dot.
  const hasChanges = yText ? false : text !== content;

  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const extensions = useMemo(
    () => buildExtensions((doc) => setText(doc), { yText, awareness }, workspaceId),
    [yText, awareness, workspaceId],
  );

  // Boot the CodeMirror view exactly once per overlay open. In collab mode
  // the doc is empty here because yCollab pulls from the Y.Text on connect.
  useEffect(() => {
    if (!hostRef.current || viewRef.current) return;
    viewRef.current = new EditorView({
      state: EditorState.create({
        doc: yText ? '' : content,
        extensions,
      }),
      parent: hostRef.current,
    });
    viewRef.current.focus();
    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extensions]);

  // ⌘S to save, Esc to close. Save also drops a `save` snapshot so the
  // user has a clean restore point at every commit.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges) {
          onSave(text);
          if (fileId && workspaceId) {
            void createSnapshot(fileId, workspaceId, text, 'save');
            // New tags / new wikilinks might exist after save — drop the
            // completion cache so suggestions reflect what's just written.
            invalidateCompletionCache();
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [text, hasChanges, onSave, onClose, fileId, workspaceId]);

  // Flush unsaved edits when the tab is hidden or closed. `beforeunload`
  // can't reliably await an async IndexedDB write, but visibilitychange →
  // hidden (and pagehide) fire while the page is still alive, so onSave's
  // write lands. A ref holds the latest text/flag so the listener stays
  // registered once instead of re-subscribing on every keystroke.
  const flushState = useRef({ text, hasChanges, onSave, fileId, workspaceId });
  flushState.current = { text, hasChanges, onSave, fileId, workspaceId };
  useEffect(() => {
    const doFlush = () => {
      const s = flushState.current;
      if (!s.hasChanges) return;
      s.onSave(s.text);
      if (s.fileId && s.workspaceId) void createSnapshot(s.fileId, s.workspaceId, s.text, 'auto');
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') doFlush(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', doFlush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', doFlush);
    };
  }, []);

  // Auto-snapshot every 5 minutes if the doc has changed since the last
  // snapshot. Dedup happens in createSnapshot so a quiet doc doesn't pile
  // up duplicate rows.
  useEffect(() => {
    if (!fileId || !workspaceId) return;
    const handle = window.setInterval(() => {
      if (text && text.trim().length > 0) {
        void createSnapshot(fileId, workspaceId, text, 'auto');
      }
    }, 5 * 60 * 1000);
    return () => window.clearInterval(handle);
  }, [fileId, workspaceId, text]);

  /**
   * Restore a snapshot back into the editor. In collab mode we push the
   * change through the Y.Text inside a single Yjs transaction so every
   * peer sees the restore as one atomic edit. Solo mode just dispatches
   * a CodeMirror change.
   */
  const restoreSnapshot = useCallback((newContent: string) => {
    if (yText) {
      yText.doc?.transact(() => {
        yText.delete(0, yText.length);
        yText.insert(0, newContent);
      });
    } else if (viewRef.current) {
      const view = viewRef.current;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: newContent },
      });
    }
    // Drop a snapshot of the pre-restore state so undo-by-history works.
    if (fileId && workspaceId) {
      void createSnapshot(fileId, workspaceId, newContent, 'manual', 'restored');
    }
  }, [yText, fileId, workspaceId]);

  const format = useCallback((kind: FormatKind) => {
    if (viewRef.current) applyFormat(viewRef.current, kind);
  }, []);

  // Keyboard shortcuts for formatting (⌘B / ⌘I / ⌘K).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const inEditor = viewRef.current?.dom.contains(e.target as Node);
      if (!inEditor) return;
      let kind: FormatKind | null = null;
      switch (e.key.toLowerCase()) {
        case 'b': kind = 'bold'; break;
        case 'i': kind = 'italic'; break;
        case 'k': kind = 'link'; break;
        case 'e': kind = 'code'; break;
        case 'x': if (e.shiftKey) kind = 'strikethrough'; break;       // ⌘⇧X
        case 'h': if (e.shiftKey) kind = 'highlight'; break;           // ⌘⇧H
        case '1': if (e.altKey) kind = 'h1'; break;                    // ⌘⌥1
        case '2': if (e.altKey) kind = 'h2'; break;                    // ⌘⌥2
        case '3': if (e.altKey) kind = 'h3'; break;                    // ⌘⌥3
      }
      if (!kind) return;
      e.preventDefault();
      format(kind);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [format]);

  const formatButtons = [
    { icon: Bold, type: 'bold', title: 'Bold (⌘B)' },
    { icon: Italic, type: 'italic', title: 'Italic (⌘I)' },
    { icon: Strikethrough, type: 'strikethrough', title: 'Strikethrough (⌘⇧X)' },
    { icon: Highlighter, type: 'highlight', title: 'Highlight (⌘⇧H)' },
    { icon: Code, type: 'code', title: 'Code (⌘E)' },
    { icon: Link2, type: 'link', title: 'Link (⌘K)' },
    'sep',
    { icon: Heading1, type: 'h1', title: 'Heading 1' },
    { icon: Heading2, type: 'h2', title: 'Heading 2' },
    { icon: Heading3, type: 'h3', title: 'Heading 3' },
    'sep',
    { icon: List, type: 'ul', title: 'Bullet List' },
    { icon: ListOrdered, type: 'ol', title: 'Numbered List' },
    { icon: Quote, type: 'quote', title: 'Blockquote' },
    { icon: Minus, type: 'hr', title: 'Horizontal Rule' },
  ] as const;

  return (
    <div className={`editor-overlay${isTyping ? ' editor-typing' : ''}`}>
      <div className="editor-container">
        <div className="editor-toolbar">
          <div className="editor-toolbar-left">
            <Edit3 size={14} />
            <span className="editor-filename">{filename}</span>
            {hasChanges && <span className="editor-unsaved">● Modified</span>}
          </div>
          <div className="editor-toolbar-center">
            <button
              className={`editor-mode-btn ${mode === 'edit' ? 'active' : ''}`}
              onClick={() => setMode('edit')}
            >Edit</button>
            <button
              className={`editor-mode-btn ${mode === 'split' ? 'active' : ''}`}
              onClick={() => setMode('split')}
            >Split</button>
            <button
              className={`editor-mode-btn ${mode === 'preview' ? 'active' : ''}`}
              onClick={() => setMode('preview')}
            >Preview</button>
          </div>
          <div className="editor-toolbar-right">
            {fileId && (
              <button
                className="editor-save-btn editor-history-btn"
                onClick={() => setShowHistory(true)}
                title="Version history"
              >
                <Clock size={14} />
                History
              </button>
            )}
            <button
              className="editor-save-btn"
              onClick={() => {
                onSave(text);
                if (fileId && workspaceId) {
                  void createSnapshot(fileId, workspaceId, text, 'save');
                }
              }}
              disabled={!hasChanges}
            >
              <Save size={14} />
              Save
            </button>
            <button className="editor-close-btn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {mode !== 'preview' && (
          <div className="editor-format-bar">
            {formatButtons.map((btn, i) =>
              btn === 'sep' ? (
                <span key={`sep-${i}`} className="editor-format-sep" />
              ) : (
                <button
                  key={btn.type}
                  className="editor-format-btn"
                  onClick={() => format(btn.type as FormatKind)}
                  title={btn.title}
                >
                  <btn.icon size={15} />
                </button>
              ),
            )}
          </div>
        )}

        <div className={`editor-body editor-mode-${mode}`}>
          {mode !== 'preview' && (
            <div className="editor-edit-pane">
              <div ref={hostRef} className="editor-codemirror" />
            </div>
          )}
          {mode !== 'edit' && (
            <div className="editor-preview-pane">
              <div className="editor-preview-content">
                <MarkdownRenderer content={previewText} />
              </div>
            </div>
          )}
        </div>
      </div>

      {showHistory && fileId && workspaceId && (
        <HistoryPanel
          fileId={fileId}
          workspaceId={workspaceId}
          currentContent={text}
          onRestore={restoreSnapshot}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
