'use client';

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
    // Save version snapshot before overwriting
    const { useVersionStore } = await import('@/stores/version-store');
    const activeF = useWorkspaceStore.getState().files.find((f) => f.id === activeFileId);
    if (activeF && activeFileContent) {
      useVersionStore.getState().saveVersion(activeFileId, activeF.filename, activeFileContent, 'editor');
    }
    const { db } = await import('@/lib/storage/db');
    await db.files.update(activeFileId, { content: newContent });
    // Reload content in store
    useWorkspaceStore.getState().setActiveFile(activeFileId);
    setShowEditor(false);
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
