
import { useState, useEffect, useCallback } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type { TocHeading } from '@/lib/markdown/pipeline';

/**
 * Encapsulates all overlay/panel visibility state and their handlers.
 * Extracted from page.tsx to keep that file focused on routing/initialization.
 */
export function useViewerState() {
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const activeFileContent = useWorkspaceStore((s) => s.activeFileContent);

  // ── Overlay toggles ────────────────────────────────────────────────
  const [showPresentation, setShowPresentation] = useState(false);
  const [showSplitView, setShowSplitView] = useState(false);
  const [showDiffView, setShowDiffView] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ── Derived viewer data ─────────────────────────────────────────────
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [renderedHtml, setRenderedHtml] = useState('');

  // Presentation mode builds its deck from `renderedHtml`. Clear it on file
  // switch so a deck can never be assembled from the *previous* file's HTML
  // while the new file is still rendering; MarkdownRenderer repopulates it on
  // the next tick.
  useEffect(() => { setRenderedHtml(''); }, [activeFileId]);

  // ── Stable callbacks ────────────────────────────────────────────────
  const handleHeadingsChange = useCallback((h: TocHeading[]) => {
    setHeadings(h);
  }, []);

  const handleHtmlRendered = useCallback((html: string) => {
    setRenderedHtml(html);
  }, []);

  const handleEditorSave = useCallback(async (newContent: string) => {
    if (!activeFileId) return;
    // (Pre-save snapshotting is handled inside MarkdownEditor via the
    // snapshots library — see lib/snapshots.ts createSnapshot calls.)
    const { db } = await import('@/lib/storage/db');
    try {
      await db.files.update(activeFileId, { content: newContent });
    } catch (err) {
      // The write failed (most likely IndexedDB quota exceeded). Surface it
      // loudly and keep the editor open so the user can copy their work out
      // — silently swallowing it would let them believe the save succeeded.
      console.error('[save] failed to persist file', err);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('markview:toast', {
          detail: { message: 'Save failed — storage may be full. Copy your text to be safe.' },
        }));
      }
      return;
    }
    // #12 Quiet save indicator — broadcast so WorkspaceTabs can pulse
    // a dot on the active tab for 800ms instead of showing a toast.
    // Plus a soft bronze chime through the atmosphere audio bus (only
    // audible if the user already unmuted ambient audio).
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('markview:file-saved', { detail: { fileId: activeFileId } }));
      void import('@/lib/atmosphere/audio').then(({ playUiSound }) => playUiSound('chime'));
    }
    // Reload content in store
    useWorkspaceStore.getState().setActiveFile(activeFileId);
    setShowEditor(false);

    // Re-embed the file in the background — fire-and-forget so save UX
    // stays snappy. Failures (e.g. first-load model download still in
    // progress) are swallowed and re-tried on the next save.
    void (async () => {
      try {
        const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;
        if (!workspaceId) return;
        const { embedFile } = await import('@/lib/embeddings');
        await embedFile(activeFileId, workspaceId, newContent);
      } catch {
        /* embeddings are best-effort */
      }
    })();
  }, [activeFileId]);

  return {
    // Overlay state
    showPresentation, setShowPresentation,
    showSplitView,    setShowSplitView,
    showDiffView,     setShowDiffView,
    showEditor,       setShowEditor,
    mobileSidebarOpen, setMobileSidebarOpen,
    // Viewer data
    headings,
    renderedHtml,
    // Callbacks
    handleHeadingsChange,
    handleHtmlRendered,
    handleEditorSave,
  };
}
