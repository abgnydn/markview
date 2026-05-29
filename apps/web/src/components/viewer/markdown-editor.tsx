// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Save, X, Edit3, Bold, Italic, Strikethrough, Code, Link2,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, Minus, Clock,
} from 'lucide-react';
import { createSnapshot } from '@/lib/snapshots';
import { HistoryPanel } from './history-panel';
import { EditorState, type Extension, RangeSetBuilder } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, highlightActiveLine,
  Decoration, type DecorationSet, ViewPlugin, type ViewUpdate,
} from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
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
import { markviewCompletions, invalidateCompletionCache } from './editor-completions';

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
  | 'bold' | 'italic' | 'strikethrough' | 'code' | 'link'
  | 'h1' | 'h2' | 'h3'
  | 'ul' | 'ol' | 'quote' | 'hr';

/**
 * Apply a markdown formatting transform around the current selection (or at
 * the caret if nothing is selected). Implemented as a CodeMirror transaction
 * so undo/redo + collaborative edits both round-trip cleanly.
 */
function applyFormat(view: EditorView, kind: FormatKind): void {
  const { state } = view;
  const sel = state.selection.main;
  const selected = state.doc.sliceString(sel.from, sel.to);

  let insert = '';
  let cursorOffset = 0;

  switch (kind) {
    case 'bold':
      insert = selected ? `**${selected}**` : '**bold**';
      cursorOffset = selected ? insert.length : 2;
      break;
    case 'italic':
      insert = selected ? `*${selected}*` : '*italic*';
      cursorOffset = selected ? insert.length : 1;
      break;
    case 'strikethrough':
      insert = selected ? `~~${selected}~~` : '~~text~~';
      cursorOffset = selected ? insert.length : 2;
      break;
    case 'code':
      if (selected.includes('\n')) {
        insert = `\`\`\`\n${selected}\n\`\`\``;
        cursorOffset = 4;
      } else {
        insert = selected ? `\`${selected}\`` : '`code`';
        cursorOffset = selected ? insert.length : 1;
      }
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
    // R16 — Smart-paste: when the user pastes a bare URL that ends
    // up on its own line (after the paste), auto-convert it to a
    // markdown link `[host](url)`. Future work: a CORS proxy on the
    // share-worker for og:title fetching → real rich cards.
    EditorView.domEventHandlers({
      paste(event, view) {
        const text = event.clipboardData?.getData('text/plain') ?? '';
        const m = text.trim().match(/^(https?:\/\/[^\s]+)$/i);
        if (!m) return false;
        let host = '';
        try { host = new URL(m[1]!).host.replace(/^www\./, ''); } catch { return false; }
        // Replace only if the paste lands on an otherwise-empty line.
        const { state } = view;
        const line = state.doc.lineAt(state.selection.main.head);
        if (line.text.trim() !== '') return false;
        event.preventDefault();
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: `[${host}](${m[1]!})` },
        });
        return true;
      },
    }),
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
      switch (e.key) {
        case 'b': e.preventDefault(); format('bold'); break;
        case 'i': e.preventDefault(); format('italic'); break;
        case 'k': e.preventDefault(); format('link'); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [format]);

  const formatButtons = [
    { icon: Bold, type: 'bold', title: 'Bold (⌘B)' },
    { icon: Italic, type: 'italic', title: 'Italic (⌘I)' },
    { icon: Strikethrough, type: 'strikethrough', title: 'Strikethrough' },
    { icon: Code, type: 'code', title: 'Code' },
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
                <MarkdownRenderer content={text} />
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
