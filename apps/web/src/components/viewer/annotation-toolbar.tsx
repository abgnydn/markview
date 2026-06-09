
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquarePlus, Highlighter, Trash2 } from 'lucide-react';
import { useAnnotationStore } from '@/stores/annotation-store';
import {
  annotationFromSelection,
  ANNOTATION_COLORS,
  ANNOTATION_COLOR_MAP,
  type Annotation,
  type AnnotationColor,
} from '@/lib/annotations';

/** The root the layer re-anchors against — anchors must be built relative to
 *  the same element so stored offsets line up on reload. */
const CONTENT_SELECTOR = '.markdown-content';

interface AnnotationToolbarProps {
  fileId: string;
  containerRef: React.RefObject<HTMLElement | null>;
}

/**
 * Floating toolbar that appears on text selection inside the markdown viewer.
 * Lets users highlight text and add notes — backed by the shared annotation
 * store (re-anchoring storage), so highlights persist and survive edits.
 */
export function AnnotationToolbar({ fileId, containerRef }: AnnotationToolbarProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [color, setColor] = useState<AnnotationColor>('yellow');
  const toolbarRef = useRef<HTMLDivElement>(null);
  // The anchor (text + surrounding context) captured at selection time — the
  // live selection is gone by the time the user clicks a toolbar button.
  const pendingRef = useRef<Annotation | null>(null);

  const add = useAnnotationStore((s) => s.add);

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !containerRef.current) {
      if (!showNoteInput) setPosition(null);
      return;
    }

    const text = selection.toString().trim();
    if (!text || text.length < 3) {
      if (!showNoteInput) setPosition(null);
      return;
    }

    // Check selection is within our container
    const anchorNode = selection.anchorNode;
    if (!anchorNode || !containerRef.current.contains(anchorNode)) {
      return;
    }

    // Capture the re-anchorable annotation now, before the selection clears.
    const root = document.querySelector(CONTENT_SELECTOR);
    pendingRef.current = root ? annotationFromSelection(fileId, root, '') : null;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    setPosition({
      top: rect.top - containerRect.top - 44,
      left: Math.min(
        Math.max(rect.left - containerRect.left + rect.width / 2 - 80, 0),
        containerRect.width - 180
      ),
    });
  }, [containerRef, showNoteInput, fileId]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setPosition(null);
        setShowNoteInput(false);
        setNoteText('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const commit = (note: string) => {
    const draft = pendingRef.current;
    if (draft) add({ ...draft, note, color });
    pendingRef.current = null;
    setPosition(null);
    setShowNoteInput(false);
    setNoteText('');
    window.getSelection()?.removeAllRanges();
  };

  const handleHighlight = (withNote = false) => {
    if (withNote) { setShowNoteInput(true); return; }
    commit('');
  };

  if (!position) return null;

  return (
    <div
      ref={toolbarRef}
      className="annotation-toolbar"
      style={{ top: position.top, left: position.left }}
    >
      {!showNoteInput ? (
        <div className="annotation-toolbar-buttons">
          <div className="annotation-color-row">
            {ANNOTATION_COLORS.map((c) => (
              <button
                key={c}
                className={`annotation-color-btn ${color === c ? 'active' : ''}`}
                style={{ background: ANNOTATION_COLOR_MAP[c] }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <button className="annotation-action-btn" onClick={() => handleHighlight(false)} title="Highlight">
            <Highlighter size={14} />
          </button>
          <button className="annotation-action-btn" onClick={() => handleHighlight(true)} title="Add note">
            <MessageSquarePlus size={14} />
          </button>
        </div>
      ) : (
        <div className="annotation-note-input">
          <textarea
            className="annotation-note-textarea"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note..."
            autoFocus
            rows={2}
          />
          <div className="annotation-note-actions">
            <button className="annotation-note-cancel" onClick={() => { setShowNoteInput(false); setNoteText(''); }}>
              Cancel
            </button>
            <button className="annotation-note-save" onClick={() => commit(noteText)}>
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Panel showing all annotations for the active file.
 */
interface AnnotationPanelProps {
  fileId: string;
}

export function AnnotationPanel({ fileId: _fileId }: AnnotationPanelProps) {
  const annotations = useAnnotationStore((s) => s.annotations);
  const activeId = useAnnotationStore((s) => s.activeAnnotationId);
  const setActive = useAnnotationStore((s) => s.setActiveAnnotation);
  const removeAnnotation = useAnnotationStore((s) => s.remove);

  if (annotations.length === 0) return null;

  return (
    <div className="annotation-panel">
      <div className="annotation-panel-header">
        <MessageSquarePlus size={14} />
        <span>Annotations ({annotations.length})</span>
      </div>
      <div className="annotation-panel-list">
        {annotations.map((ann) => (
          <div
            key={ann.id}
            className={`annotation-panel-item ${activeId === ann.id ? 'active' : ''}`}
            onClick={() => setActive(ann.id)}
          >
            <div className="annotation-panel-highlight" style={{ borderLeftColor: ANNOTATION_COLOR_MAP[ann.color] }}>
              <span className="annotation-panel-text">&ldquo;{ann.anchorText.slice(0, 80)}{ann.anchorText.length > 80 ? '...' : ''}&rdquo;</span>
            </div>
            {ann.note && <div className="annotation-panel-note">{ann.note}</div>}
            <div className="annotation-panel-actions">
              <button
                className="annotation-panel-delete"
                onClick={(e) => { e.stopPropagation(); removeAnnotation(ann.id); }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
