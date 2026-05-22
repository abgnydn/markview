// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Save, X, Edit3, Bold, Italic, Strikethrough, Code, Link2,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, Minus,
} from 'lucide-react';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { MarkdownRenderer } from './markdown-renderer';

interface MarkdownEditorProps {
  content: string;
  filename: string;
  onSave: (content: string) => void;
  onClose: () => void;
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

// Dark syntax highlight tuned for the Markview color palette.
const markviewHighlight = HighlightStyle.define([
  { tag: t.heading, color: '#e2e8f0', fontWeight: '700' },
  { tag: t.heading1, color: '#f1f5f9', fontWeight: '800', fontSize: '1.05em' },
  { tag: t.heading2, color: '#e2e8f0', fontWeight: '700' },
  { tag: t.heading3, color: '#cbd5e1', fontWeight: '600' },
  { tag: t.strong, color: '#f8fafc', fontWeight: '700' },
  { tag: t.emphasis, color: '#cbd5e1', fontStyle: 'italic' },
  { tag: t.strikethrough, color: '#64748b', textDecoration: 'line-through' },
  { tag: t.link, color: '#67e8f9', textDecoration: 'underline' },
  { tag: t.url, color: '#67e8f9' },
  { tag: t.monospace, color: '#fbbf24' },
  { tag: t.list, color: '#a78bfa' },
  { tag: t.quote, color: '#94a3b8', fontStyle: 'italic' },
  { tag: t.meta, color: '#64748b' },
  { tag: t.comment, color: '#475569', fontStyle: 'italic' },
]);

// Dark theme — paints the surface; uses CSS variables where it can so the
// surrounding app theme picker can override.
const markviewTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      fontSize: '14px',
      backgroundColor: 'var(--editor-bg, #0d1117)',
      color: 'var(--editor-fg, #e2e8f0)',
    },
    '.cm-scroller': {
      fontFamily:
        "var(--font-mono, ui-monospace, SFMono-Regular, 'JetBrains Mono', 'Cascadia Code', monospace)",
      lineHeight: '1.6',
    },
    '.cm-content': { padding: '18px 8px', caretColor: '#a78bfa' },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: 'rgba(148,163,184,0.4)',
      border: 'none',
    },
    '.cm-activeLine': { backgroundColor: 'rgba(167,139,250,0.06)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#a78bfa' },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(103,232,249,0.25)',
    },
    '.cm-cursor': { borderLeftColor: '#a78bfa' },
  },
  { dark: true },
);

function buildExtensions(onDocChange: (doc: string) => void): Extension[] {
  return [
    history(),
    lineNumbers(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    syntaxHighlighting(markviewHighlight),
    markviewTheme,
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

export function MarkdownEditor({ content, filename, onSave, onClose }: MarkdownEditorProps) {
  const [text, setText] = useState(content);
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>('split');
  const hasChanges = text !== content;

  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Memoize the extension list — buildExtensions captures the setText updater
  // via a closure, so we must rebuild whenever the host setter changes
  // (effectively never; just include here to satisfy the dep contract).
  const extensions = useMemo(() => buildExtensions((doc) => setText(doc)), []);

  // Boot the CodeMirror view exactly once per overlay open.
  useEffect(() => {
    if (!hostRef.current || viewRef.current) return;
    viewRef.current = new EditorView({
      state: EditorState.create({ doc: content, extensions }),
      parent: hostRef.current,
    });
    viewRef.current.focus();
    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
    // content is the initial value — intentionally not re-applied on every
    // change; CodeMirror owns the document from boot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extensions]);

  // ⌘S to save, Esc to close.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges) onSave(text);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [text, hasChanges, onSave, onClose]);

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
    <div className="editor-overlay">
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
            <button
              className="editor-save-btn"
              onClick={() => onSave(text)}
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
    </div>
  );
}
