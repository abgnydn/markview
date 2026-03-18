'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Save, X, Eye, Edit3, Bold, Italic, Strikethrough, Code, Link2,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, Minus,
} from 'lucide-react';
import { MarkdownRenderer } from './markdown-renderer';

interface MarkdownEditorProps {
  content: string;
  filename: string;
  onSave: (content: string) => void;
  onClose: () => void;
}

/** Insert/wrap markdown syntax at the cursor position or around selection */
function applyFormat(
  textarea: HTMLTextAreaElement,
  setText: (s: string) => void,
  type: string,
) {
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  const selected = value.substring(start, end);
  let replacement = '';
  let cursorOffset = 0;

  switch (type) {
    case 'bold':
      replacement = selected ? `**${selected}**` : '**bold**';
      cursorOffset = selected ? replacement.length : 2;
      break;
    case 'italic':
      replacement = selected ? `*${selected}*` : '*italic*';
      cursorOffset = selected ? replacement.length : 1;
      break;
    case 'strikethrough':
      replacement = selected ? `~~${selected}~~` : '~~text~~';
      cursorOffset = selected ? replacement.length : 2;
      break;
    case 'code':
      if (selected.includes('\n')) {
        replacement = `\`\`\`\n${selected}\n\`\`\``;
        cursorOffset = 4;
      } else {
        replacement = selected ? `\`${selected}\`` : '`code`';
        cursorOffset = selected ? replacement.length : 1;
      }
      break;
    case 'link':
      replacement = selected ? `[${selected}](url)` : '[text](url)';
      cursorOffset = selected ? selected.length + 3 : 1;
      break;
    case 'h1':
      replacement = `# ${selected || 'Heading'}`;
      cursorOffset = 2;
      break;
    case 'h2':
      replacement = `## ${selected || 'Heading'}`;
      cursorOffset = 3;
      break;
    case 'h3':
      replacement = `### ${selected || 'Heading'}`;
      cursorOffset = 4;
      break;
    case 'ul':
      replacement = selected
        ? selected.split('\n').map((l) => `- ${l}`).join('\n')
        : '- Item';
      cursorOffset = 2;
      break;
    case 'ol':
      replacement = selected
        ? selected.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n')
        : '1. Item';
      cursorOffset = 3;
      break;
    case 'quote':
      replacement = selected
        ? selected.split('\n').map((l) => `> ${l}`).join('\n')
        : '> Quote';
      cursorOffset = 2;
      break;
    case 'hr':
      replacement = '\n---\n';
      cursorOffset = replacement.length;
      break;
    default:
      return;
  }

  const newText = value.substring(0, start) + replacement + value.substring(end);
  setText(newText);

  // Restore focus and set cursor
  requestAnimationFrame(() => {
    textarea.focus();
    const pos = start + cursorOffset;
    textarea.setSelectionRange(pos, selected ? start + replacement.length : pos);
  });
}

export function MarkdownEditor({ content, filename, onSave, onClose }: MarkdownEditorProps) {
  const [text, setText] = useState(content);
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>('split');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasChanges = text !== content;

  // Auto-focus textarea
  useEffect(() => {
    if (mode !== 'preview' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [mode]);

  // ⌘S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges) onSave(text);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [text, hasChanges, onSave, onClose]);

  const format = useCallback((type: string) => {
    if (textareaRef.current) {
      applyFormat(textareaRef.current, setText, type);
    }
  }, []);

  // Handle Tab key to insert spaces instead of leaving textarea
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const { selectionStart, selectionEnd, value } = ta;
      const newText = value.substring(0, selectionStart) + '  ' + value.substring(selectionEnd);
      setText(newText);
      requestAnimationFrame(() => {
        ta.setSelectionRange(selectionStart + 2, selectionStart + 2);
      });
    }
  }, []);

  const formatButtons = [
    { icon: Bold, type: 'bold', title: 'Bold (⌘B)', shortcut: 'b' },
    { icon: Italic, type: 'italic', title: 'Italic (⌘I)', shortcut: 'i' },
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

  // Keyboard shortcuts for formatting
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.target !== textareaRef.current) return;
      switch (e.key) {
        case 'b': e.preventDefault(); format('bold'); break;
        case 'i': e.preventDefault(); format('italic'); break;
        case 'k': e.preventDefault(); format('link'); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [format]);

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
            >
              Edit
            </button>
            <button
              className={`editor-mode-btn ${mode === 'split' ? 'active' : ''}`}
              onClick={() => setMode('split')}
            >
              Split
            </button>
            <button
              className={`editor-mode-btn ${mode === 'preview' ? 'active' : ''}`}
              onClick={() => setMode('preview')}
            >
              Preview
            </button>
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

        {/* Formatting toolbar — visible in edit and split mode */}
        {mode !== 'preview' && (
          <div className="editor-format-bar">
            {formatButtons.map((btn, i) =>
              btn === 'sep' ? (
                <span key={`sep-${i}`} className="editor-format-sep" />
              ) : (
                <button
                  key={btn.type}
                  className="editor-format-btn"
                  onClick={() => format(btn.type)}
                  title={btn.title}
                >
                  <btn.icon size={15} />
                </button>
              )
            )}
          </div>
        )}

        <div className={`editor-body editor-mode-${mode}`}>
          {mode !== 'preview' && (
            <div className="editor-edit-pane">
              <textarea
                ref={textareaRef}
                className="editor-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
              />
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

