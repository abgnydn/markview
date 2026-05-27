
import { useState, useCallback } from 'react';
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
    await db.files.update(activeFileId, { content: newContent });
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
  }, [activeFileId, activeFileContent]);

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
