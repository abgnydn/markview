'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Save, X, Eye, Edit3 } from 'lucide-react';
import { MarkdownRenderer } from './markdown-renderer';

interface MarkdownEditorProps {
  content: string;
  filename: string;
  onSave: (content: string) => void;
  onClose: () => void;
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
        <div className={`editor-body editor-mode-${mode}`}>
          {mode !== 'preview' && (
            <div className="editor-edit-pane">
              <textarea
                ref={textareaRef}
                className="editor-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
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
