'use client';

import React, { useRef, useMemo } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useThemeStore } from '@/stores/theme-store';
import { useCollabStore } from '@/stores/collab-store';
import { Toolbar } from '@/components/viewer/toolbar';
import { Sidebar } from '@/components/viewer/sidebar';
import { MarkdownRenderer, preloadShiki } from '@/components/viewer/markdown-renderer';
import { TableOfContents } from '@/components/viewer/toc';
import { AnnotationToolbar, AnnotationPanel } from '@/components/viewer/annotation-toolbar';
import { SearchDialog } from '@/components/viewer/search-dialog';
import { WorkspaceTabs } from '@/components/workspace/workspace-tabs';
import { ReadingProgress } from '@/components/viewer/reading-progress';
import { Breadcrumbs } from '@/components/viewer/breadcrumbs';
import { FrontmatterCard } from '@/components/viewer/frontmatter-card';
import { PresentationMode } from '@/components/viewer/presentation-mode';
import { SplitView } from '@/components/viewer/split-view';
import { DiffView } from '@/components/viewer/diff-view';
import { MarkdownEditor } from '@/components/viewer/markdown-editor';
import { PresenceBar } from '@/components/collab/presence-bar';
import { parseFrontmatter } from '@/lib/markdown/frontmatter';
import { useViewerState } from '@/hooks/use-viewer-state';
import { useKeyboardNav } from '@/hooks/use-keyboard-nav';
import type { TocHeading } from '@/lib/markdown/pipeline';

function calculateReadingStats(content: string) {
  const text = content.replace(/[#*`\[\]()>-]/g, '').trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 230));
  return { words, minutes };
}

interface ViewerPageProps {
  /** Called when user clicks the home/logo button */
  onGoHome: () => void;
  /** Ref for the hidden file-add input (managed by page.tsx) */
  addFilesInputRef: React.RefObject<HTMLInputElement | null>;
  /** Called when inter-workspace file navigation is needed */
  onNavigateToFile: (filename: string) => void;
}

/**
 * The full viewer shell rendered when a workspace is active.
 * All overlay/panel state lives in useViewerState; routing lives in page.tsx.
 */
export function ViewerPage({ onGoHome, addFilesInputRef, onNavigateToFile }: ViewerPageProps) {
  const focusMode = useThemeStore((s) => s.focusMode);

  // Workspace data
  const files = useWorkspaceStore((s) => s.files);
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const activeFileContent = useWorkspaceStore((s) => s.activeFileContent);
  const isContentLoading = useWorkspaceStore((s) => s.isContentLoading);

  // Collab
  const collabIsActive = useCollabStore((s) => s.isActive);
  const collabIsHost = useCollabStore((s) => s.isHost);
  const syncedFiles = useCollabStore((s) => s.syncedFiles);
  const syncedActiveFileId = useCollabStore((s) => s.syncedActiveFileId);
  const syncedActiveFileContent = useCollabStore((s) => s.syncedActiveFileContent);

  // All overlay/panel state from the hook
  const {
    showPresentation, setShowPresentation,
    showSplitView,    setShowSplitView,
    showDiffView,     setShowDiffView,
    showEditor,       setShowEditor,
    mobileSidebarOpen, setMobileSidebarOpen,
    headings,
    renderedHtml,
    handleHeadingsChange,
    handleHtmlRendered,
    handleEditorSave,
  } = useViewerState();

  // Keyboard shortcuts
  useKeyboardNav();

  const contentRef = useRef<HTMLDivElement>(null);

  // Scroll to top whenever the active file changes
  React.useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeFileId]);

  // Guest mode: collab viewer without edit rights
  const isGuestMode = collabIsActive && !collabIsHost;
  const effectiveContent = isGuestMode ? syncedActiveFileContent : activeFileContent;
  const activeFile = files.find((f) => f.id === activeFileId);
  const effectiveActiveFile = isGuestMode
    ? syncedFiles.find((f) => f.id === syncedActiveFileId)
    : activeFile;

  // Derived values
  const frontmatterResult = useMemo(() => {
    if (!activeFileContent) return null;
    return parseFrontmatter(activeFileContent);
  }, [activeFileContent]);

  const workspaceFileNames = useMemo(
    () => files.map((f) => f.filename.split('/').pop() || f.filename),
    [files]
  );

  const readingStats = useMemo(() => {
    if (!activeFileContent) return null;
    return calculateReadingStats(activeFileContent);
  }, [activeFileContent]);

  const displayFilename = effectiveActiveFile?.filename || 'untitled';

  return (
    <div className={`app ${focusMode ? 'focus-mode' : ''}`}>
      <Toolbar
        onAddFiles={() => addFilesInputRef.current?.click()}
        readingStats={readingStats}
        onTogglePresentation={() => setShowPresentation(true)}
        onToggleSplitView={() => setShowSplitView(!showSplitView)}
        onToggleDiffView={() => setShowDiffView(true)}
        onToggleEditor={() => setShowEditor(true)}
        onGoHome={onGoHome}
        onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
      />
      <PresenceBar />
      <WorkspaceTabs />

      <div className="viewer-layout">
        {mobileSidebarOpen && (
          <div className="sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} />
        )}
        {!focusMode && (
          <Sidebar
            className={mobileSidebarOpen ? 'sidebar-mobile-open' : ''}
            onFileSelect={() => setMobileSidebarOpen(false)}
          />
        )}
        <main className="viewer-main" ref={contentRef}>
          <ReadingProgress scrollContainerRef={contentRef} />
          <div className="viewer-content">
            <Breadcrumbs filepath={displayFilename} />
            <div className="viewer-file-header">
              <h2 className="viewer-filename">
                {displayFilename.split('/').pop()?.replace(/\.md$/i, '') || displayFilename}
              </h2>
            </div>
            {frontmatterResult && Object.keys(frontmatterResult.data).length > 0 && (
              <FrontmatterCard data={frontmatterResult.data} />
            )}
            {isContentLoading ? (
              <div className="content-loading">
                <div className="skeleton-line skeleton-title" />
                <div className="skeleton-line skeleton-long" />
                <div className="skeleton-line skeleton-full" />
                <div className="skeleton-line skeleton-medium" />
                <div className="skeleton-line skeleton-long" />
                <div className="skeleton-block" />
                <div className="skeleton-line skeleton-subtitle" />
                <div className="skeleton-line skeleton-full" />
                <div className="skeleton-line skeleton-long" />
                <div className="skeleton-line skeleton-short" />
              </div>
            ) : activeFileContent ? (
              <MarkdownRenderer
                content={frontmatterResult ? frontmatterResult.content : activeFileContent}
                onHeadingsChange={handleHeadingsChange}
                onHtmlRendered={handleHtmlRendered}
                onNavigateToFile={onNavigateToFile}
                workspaceFiles={workspaceFileNames}
              />
            ) : (
              <div className="content-loading">
                <p>No content available</p>
              </div>
            )}
            {activeFileId && (
              <AnnotationToolbar fileId={activeFileId} containerRef={contentRef} />
            )}
            {activeFileId && (
              <AnnotationPanel fileId={activeFileId} />
            )}
          </div>
        </main>
        {!focusMode && <TableOfContents headings={headings} scrollContainerRef={contentRef} />}
        {showSplitView && activeFileId && (
          <SplitView mainFileId={activeFileId} onClose={() => setShowSplitView(false)} />
        )}
      </div>

      <SearchDialog />

      {/* Overlays */}
      {showPresentation && effectiveContent && (
        <PresentationMode
          html={renderedHtml || effectiveContent}
          onClose={() => setShowPresentation(false)}
        />
      )}

      {showDiffView && activeFileId && (
        <DiffView
          fileAId={activeFileId}
          onClose={() => setShowDiffView(false)}
        />
      )}

      {showEditor && activeFileId && activeFileContent && (
        <MarkdownEditor
          content={activeFileContent}
          filename={activeFile?.filename || 'untitled.md'}
          onSave={handleEditorSave}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}
