'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useThemeStore } from '@/stores/theme-store';
import { Toolbar } from '@/components/viewer/toolbar';
import { Sidebar } from '@/components/viewer/sidebar';
import { MarkdownRenderer, preloadShiki } from '@/components/viewer/markdown-renderer';
import { TableOfContents } from '@/components/viewer/toc';
import { AnnotationToolbar, AnnotationPanel } from '@/components/viewer/annotation-toolbar';
import { SearchDialog } from '@/components/viewer/search-dialog';
import { LandingPage } from '@/components/landing/landing-page';
import { WorkspaceTabs } from '@/components/workspace/workspace-tabs';
import { ReadingProgress } from '@/components/viewer/reading-progress';
import { Breadcrumbs } from '@/components/viewer/breadcrumbs';
import { FrontmatterCard } from '@/components/viewer/frontmatter-card';
import { PresentationMode } from '@/components/viewer/presentation-mode';
import { SplitView } from '@/components/viewer/split-view';
import { DiffView } from '@/components/viewer/diff-view';
import { MarkdownEditor } from '@/components/viewer/markdown-editor';
import { useKeyboardNav } from '@/hooks/use-keyboard-nav';
import { parseFrontmatter } from '@/lib/markdown/frontmatter';
import { useCollabStore } from '@/stores/collab-store';
import { getRoomIdFromUrl } from '@/lib/collab/y-provider';
import { PresenceBar } from '@/components/collab/presence-bar';
import { JoinDialog } from '@/components/collab/join-dialog';
import type { TocHeading } from '@/lib/markdown/pipeline';

function calculateReadingStats(content: string) {
  const text = content.replace(/[#*`\[\]()>-]/g, '').trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 230));
  return { words, minutes };
}

export default function HomePage() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const files = useWorkspaceStore((s) => s.files);
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const activeFileContent = useWorkspaceStore((s) => s.activeFileContent);
  const isContentLoading = useWorkspaceStore((s) => s.isContentLoading);
  const isLoaded = useWorkspaceStore((s) => s.isLoaded);
  const initialize = useWorkspaceStore((s) => s.initialize);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);
  const addFiles = useWorkspaceStore((s) => s.addFiles);
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace);
  const initializeTheme = useThemeStore((s) => s.initialize);
  const focusMode = useThemeStore((s) => s.focusMode);

  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [showPresentation, setShowPresentation] = useState(false);
  const [showSplitView, setShowSplitView] = useState(false);
  const [showDiffView, setShowDiffView] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [renderedHtml, setRenderedHtml] = useState('');
  const [showLanding, setShowLanding] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);
  const addFilesInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Collab state
  const collabIsActive = useCollabStore((s) => s.isActive);
  const collabIsHost = useCollabStore((s) => s.isHost);
  const syncedTitle = useCollabStore((s) => s.syncedTitle);
  const syncedFiles = useCollabStore((s) => s.syncedFiles);
  const syncedActiveFileId = useCollabStore((s) => s.syncedActiveFileId);
  const syncedActiveFileContent = useCollabStore((s) => s.syncedActiveFileContent);
  const setSyncedActiveFile = useCollabStore((s) => s.setSyncedActiveFile);

  // Keyboard navigation
  useKeyboardNav();

  // Initialize
  useEffect(() => {
    initializeTheme();
    initialize();
    preloadShiki();
    // Detect ?room= parameter
    const roomId = getRoomIdFromUrl();
    if (roomId) {
      setPendingRoomId(roomId);
      // Clean URL without reload
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [initializeTheme, initialize]);

  // Detect #md= shared content — runs only after store is hydrated from IndexedDB
  const pendingHashRef = useRef<string | null>(null);
  useEffect(() => {
    // Capture hash before any navigation clears it
    if (window.location.hash.includes('md=') && !pendingHashRef.current) {
      pendingHashRef.current = window.location.hash;
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || !pendingHashRef.current) return;
    const hash = pendingHashRef.current;
    pendingHashRef.current = null;
    import('@/lib/sharing/url-share').then(({ decodeMarkdownUrl }) => {
      decodeMarkdownUrl(hash).then((result) => {
        if (result) {
          const wsStore = useWorkspaceStore.getState();
          wsStore.createWorkspace(
            result.title || 'Shared Document',
            [{ filename: `${result.title || 'document'}.md`, content: result.content }]
          );
          window.history.replaceState({}, '', window.location.pathname);
        }
      });
    });
  }, [isLoaded]);

  // Scroll to top on file change
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeFileId]);

  // Parse frontmatter
  const frontmatterResult = useMemo(() => {
    if (!activeFileContent) return null;
    return parseFrontmatter(activeFileContent);
  }, [activeFileContent]);

  const handleFilesSelected = useCallback(
    (newFiles: { filename: string; content: string }[]) => {
      if (activeWorkspaceId) {
        addFiles(newFiles);
      } else {
        const title = newFiles.length === 1
          ? newFiles[0].filename.replace(/\.md$/i, '').split('/').pop() || 'Documentation'
          : 'Documentation';
        createWorkspace(title, newFiles);
      }
    },
    [activeWorkspaceId, addFiles, createWorkspace]
  );

  const handleNewWorkspace = useCallback(
    (newFiles: { filename: string; content: string }[], title?: string) => {
      const wsTitle = title || (newFiles.length === 1
        ? newFiles[0].filename.replace(/\.md$/i, '').split('/').pop() || 'Documentation'
        : 'Documentation');
      createWorkspace(wsTitle, newFiles);
    },
    [createWorkspace]
  );

  const handleHeadingsChange = useCallback((h: TocHeading[]) => {
    setHeadings(h);
  }, []);

  const handleHtmlRendered = useCallback((html: string) => {
    setRenderedHtml(html);
  }, []);

  // Inter-document linking handler
  const handleNavigateToFile = useCallback((filename: string) => {
    const lowerFilename = filename.toLowerCase();
    const target = files.find((f) => {
      const basename = f.filename.split('/').pop()?.toLowerCase() || '';
      return basename === lowerFilename || f.filename.toLowerCase() === lowerFilename;
    });
    if (target) {
      setActiveFile(target.id);
    }
  }, [files, setActiveFile]);

  // Workspace file names for link validation
  const workspaceFileNames = useMemo(
    () => files.map((f) => f.filename.split('/').pop() || f.filename),
    [files]
  );

  // Reading stats
  const readingStats = useMemo(() => {
    if (!activeFileContent) return null;
    return calculateReadingStats(activeFileContent);
  }, [activeFileContent]);

  // Editor save handler
  const handleEditorSave = useCallback(async (newContent: string) => {
    if (!activeFileId) return;
    // Save version to history before updating
    const { useVersionStore } = await import('@/stores/version-store');
    const activeF = useWorkspaceStore.getState().files.find((f) => f.id === activeFileId);
    if (activeF && activeFileContent) {
      useVersionStore.getState().saveVersion(activeFileId, activeF.filename, activeFileContent, 'editor');
    }
    const { db } = await import('@/lib/storage/db');
    await db.files.update(activeFileId, { content: newContent });
    // Reload content
    useWorkspaceStore.getState().setActiveFile(activeFileId);
    setShowEditor(false);
  }, [activeFileId, activeFileContent]);

  const activeFile = files.find((f) => f.id === activeFileId);

  if (!isLoaded) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading MarkView...</p>
      </div>
    );
  }

  // Guest mode: viewing a shared workspace
  const isGuestMode = collabIsActive && !collabIsHost;

  // Determine effective content based on mode
  const effectiveContent = isGuestMode ? syncedActiveFileContent : activeFileContent;
  const effectiveActiveFile = isGuestMode
    ? syncedFiles.find((f) => f.id === syncedActiveFileId)
    : activeFile;

  const hasWorkspace = workspaces.length > 0 && activeWorkspaceId && activeFile;

  // Show join dialog if we have a pending room
  if (pendingRoomId && !collabIsActive) {
    return (
      <JoinDialog
        roomId={pendingRoomId}
        onClose={() => setPendingRoomId(null)}
      />
    );
  }

  if ((!hasWorkspace && !isGuestMode) || showLanding) {
    return (
      <LandingPage
        onFilesSelected={(files, title) => {
          setShowLanding(false);
          handleFilesSelected(files);
        }}
        onGitHubImport={(files, title) => {
          setShowLanding(false);
          handleNewWorkspace(files, title);
        }}
        hasExistingWorkspace={hasWorkspace ? true : false}
        onBackToWorkspace={() => setShowLanding(false)}
        onClearAll={async () => {
          for (const ws of workspaces) {
            await deleteWorkspace(ws.id);
          }
          setShowLanding(false);
        }}
      />
    );
  }

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
        onGoHome={() => setShowLanding(true)}
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
              <h2 className="viewer-filename">{displayFilename.split('/').pop()?.replace(/\.md$/i, '') || displayFilename}</h2>
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
                onNavigateToFile={handleNavigateToFile}
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
      {showPresentation && activeFileContent && (
        <PresentationMode
          html={renderedHtml || activeFileContent}
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

      <input
        ref={addFilesInputRef}
        type="file"
        accept=".md,.markdown,.zip"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            const processFiles = async () => {
              const fileList: { filename: string; content: string }[] = [];
              for (const file of Array.from(e.target.files!)) {
                if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
                  const content = await file.text();
                  fileList.push({ filename: file.name, content });
                }
              }
              if (fileList.length > 0) handleNewWorkspace(fileList);
            };
            processFiles();
          }
        }}
      />
    </div>
  );
}
