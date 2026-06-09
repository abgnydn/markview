// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import {
  type Annotation,
  annotationFromSelection,
  reanchor,
} from '@/lib/annotations';
import { useAnnotationStore } from '@/stores/annotation-store';

interface AnnotationsLayerProps {
  fileId: string | null;
  /** Bumps to re-anchor after content changes. */
  refreshKey: string | number;
}

/**
 * AnnotationsLayer (R11) — margin notes tied to text ranges.
 *
 *   ⌘⇧A (Ctrl+Shift+A) on a non-collapsed selection inside .markdown-
 *   content prompts for a note. The selection's text + ±24 chars of
 *   context are stored as an "anchor" so the note re-finds itself when
 *   the file is reopened (even after small edits).
 *
 * For each annotation that re-anchors, we render a tiny dot in the
 * RIGHT margin at the range's vertical position; hovering or clicking
 * the dot expands a card with the note. Click the underlined anchor
 * text to scroll/highlight. Orphan annotations (anchor no longer
 * found) cluster at the bottom of the dot column with a faded ring.
 */
export function AnnotationsLayer({ fileId, refreshKey }: AnnotationsLayerProps) {
  // The annotation list lives in the shared store (so the toolbar's writes
  // show here immediately); the layer keeps only its own view state.
  const annotations = useAnnotationStore((s) => s.annotations);
  const addAnnotation = useAnnotationStore((s) => s.add);
  const removeAnnotation = useAnnotationStore((s) => s.remove);
  const loadAnnotationsForFile = useAnnotationStore((s) => s.load);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; note: string } | null>(null);
  const [positions, setPositions] = useState<Map<string, { top: number; orphan: boolean }>>(new Map());
  const [draftAt, setDraftAt] = useState<{ top: number } | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const draftInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Load the active file's annotations into the shared store on file switch.
  useEffect(() => {
    if (fileId) loadAnnotationsForFile(fileId);
  }, [fileId, loadAnnotationsForFile]);

  // ⌘⇧A creates an annotation from the current selection.
  useEffect(() => {
    if (!fileId) return;
    const onKey = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a')) return;
      const root = document.querySelector('.markdown-content');
      if (!root) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const node = sel.anchorNode;
      if (!node || !root.contains(node)) return;
      e.preventDefault();
      // Use the selection's bottom edge as the draft anchor Y.
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setDraftAt({ top: rect.top + window.scrollY });
      setDraftNote('');
      // Save the selection by capturing the would-be annotation now;
      // the selection might be lost when the user clicks into the
      // editor textarea. We store a draft ann inside `editing`
      // immediately and commit/abort based on the textarea action.
      const draft = annotationFromSelection(fileId, root, '');
      if (!draft) { setDraftAt(null); return; }
      setEditing({ id: draft.id, note: '' });
      // Stash the draft so commit can finalize.
      pendingDraftRef.current = draft;
      sel.removeAllRanges();
      requestAnimationFrame(() => draftInputRef.current?.focus());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fileId]);

  const pendingDraftRef = useRef<Annotation | null>(null);

  const commitDraft = () => {
    const draft = pendingDraftRef.current;
    if (!draft) { setEditing(null); setDraftAt(null); return; }
    if (!draftNote.trim()) { abortDraft(); return; }
    const final: Annotation = { ...draft, note: draftNote.trim() };
    addAnnotation(final);
    pendingDraftRef.current = null;
    setEditing(null);
    setDraftAt(null);
    setDraftNote('');
  };
  const abortDraft = () => {
    pendingDraftRef.current = null;
    setEditing(null);
    setDraftAt(null);
    setDraftNote('');
  };

  // Recompute Y-positions of all annotations whenever content changes
  // or the window scrolls (positions are in absolute page coords, so
  // scroll changes don't move them, but resize/rerender does).
  useEffect(() => {
    const root = document.querySelector('.markdown-content');
    if (!root) return;
    let raf = 0;
    const compute = () => {
      raf = 0;
      const next = new Map<string, { top: number; orphan: boolean }>();
      for (const a of annotations) {
        const range = reanchor(root, a);
        if (!range) {
          next.set(a.id, { top: 0, orphan: true });
          continue;
        }
        const rect = range.getBoundingClientRect();
        next.set(a.id, { top: rect.top + window.scrollY, orphan: false });
      }
      setPositions(next);
    };
    const schedule = () => { if (raf === 0) raf = requestAnimationFrame(compute); };
    schedule();
    window.addEventListener('resize', schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      if (raf !== 0) cancelAnimationFrame(raf);
    };
  }, [annotations, refreshKey]);

  const deleteAnnotation = (id: string) => {
    removeAnnotation(id);
    if (hoverId === id) setHoverId(null);
  };

  if (!fileId) return null;

  return (
    <>
      {/* Dot column — anchored to the absolute page coords of each
          annotation's range. position:absolute so it scrolls with
          the document. */}
      <div className="mv-anno-dots" aria-hidden="true">
        {annotations.map((a) => {
          const pos = positions.get(a.id);
          if (!pos) return null;
          return (
            <button
              key={a.id}
              type="button"
              className={`mv-anno-dot${pos.orphan ? ' mv-anno-dot-orphan' : ''}${hoverId === a.id ? ' is-hover' : ''}`}
              style={{ top: pos.orphan ? undefined : pos.top + 4 }}
              onMouseEnter={() => setHoverId(a.id)}
              onMouseLeave={() => setHoverId(null)}
              title={a.note}
            />
          );
        })}
      </div>

      {/* Card for the currently-hovered annotation. */}
      {hoverId && (() => {
        const a = annotations.find((x) => x.id === hoverId);
        const pos = positions.get(hoverId);
        if (!a || !pos) return null;
        return (
          <div
            className="mv-anno-card"
            style={{ top: pos.orphan ? '12vh' : pos.top }}
            onMouseEnter={() => setHoverId(a.id)}
            onMouseLeave={() => setHoverId(null)}
          >
            <div className="mv-anno-anchor">"{a.anchorText.slice(0, 80)}{a.anchorText.length > 80 ? '…' : ''}"</div>
            <div className="mv-anno-note">{a.note}</div>
            <button className="mv-anno-delete" onClick={() => deleteAnnotation(a.id)} title="Delete note">×</button>
          </div>
        );
      })()}

      {/* Draft composer — appears when ⌘⇧A is pressed on a selection. */}
      {editing && draftAt && (
        <div className="mv-anno-card mv-anno-card-edit" style={{ top: draftAt.top }}>
          <div className="mv-anno-anchor">
            "{(pendingDraftRef.current?.anchorText || '').slice(0, 80)}…"
          </div>
          <textarea
            ref={draftInputRef}
            className="mv-anno-input"
            placeholder="Note for this passage…"
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); abortDraft(); }
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); commitDraft(); }
            }}
          />
          <div className="mv-anno-actions">
            <button className="mv-anno-btn" onClick={abortDraft}>cancel</button>
            <button className="mv-anno-btn mv-anno-btn-primary" onClick={commitDraft}>save</button>
          </div>
        </div>
      )}
    </>
  );
}
