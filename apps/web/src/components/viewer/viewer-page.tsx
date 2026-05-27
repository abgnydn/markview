
import React, { useRef, useMemo, useState, useCallback, lazy, Suspense } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useThemeStore } from '@/stores/theme-store';
import { useCollabStore } from '@/stores/collab-store';
import { Toolbar } from '@/components/viewer/toolbar';
import { Sidebar } from '@/components/viewer/sidebar';
import { MarkdownRenderer } from '@/components/viewer/markdown-renderer';
import { TableOfContents } from '@/components/viewer/toc';
import { AnnotationToolbar, AnnotationPanel } from '@/components/viewer/annotation-toolbar';
import { SearchDialog } from '@/components/viewer/search-dialog';
import { WorkspaceTabs } from '@/components/workspace/workspace-tabs';
import { ReadingProgress } from '@/components/viewer/reading-progress';
import { Breadcrumbs } from '@/components/viewer/breadcrumbs';
import { FrontmatterCard } from '@/components/viewer/frontmatter-card';

// Heavy user-triggered overlays — lazy so the cold-open chunk stays
// tight. The MarkdownEditor pulls in CodeMirror, PresentationMode pulls
// in reveal-style rendering, AiChat pulls transformers.js — none of it
// belongs on the path of "open a shared URL, just read."
const PresentationMode = lazy(() => import('@/components/viewer/presentation-mode').then((m) => ({ default: m.PresentationMode })));
const SplitView = lazy(() => import('@/components/viewer/split-view').then((m) => ({ default: m.SplitView })));
const DiffView = lazy(() => import('@/components/viewer/diff-view').then((m) => ({ default: m.DiffView })));
const MarkdownEditor = lazy(() => import('@/components/viewer/markdown-editor').then((m) => ({ default: m.MarkdownEditor })));
const FileBrowser = lazy(() => import('@/components/viewer/file-browser').then((m) => ({ default: m.FileBrowser })));
const GraphView = lazy(() => import('@/components/viewer/graph-view').then((m) => ({ default: m.GraphView })));
const AiChat = lazy(() => import('@/components/viewer/ai-chat').then((m) => ({ default: m.AiChat })));

// PresenceBar replaced by the floating <ShareStatus /> widget (bottom-right).
import { ShareStatus } from '@/components/collab/share-status';
import { RelatedNotes } from '@/components/viewer/related-notes';
import { PaintingAtmosphere } from '@/components/atmosphere/painting-atmosphere';
import { useAtmosphereRotation } from '@/hooks/use-atmosphere-rotation';
import { useEmbeddingsBackfill } from '@/hooks/use-embeddings-backfill';
import { useViewerOverlays } from '@/hooks/use-viewer-overlays';
import { parseFrontmatter } from '@/lib/markdown/frontmatter';
import { useViewerState } from '@/hooks/use-viewer-state';
import { useKeyboardNav } from '@/hooks/use-keyboard-nav';
import { Upload } from 'lucide-react';
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
  const atmosphere = useThemeStore((s) => s.atmosphere);

  // Workspace data
  const addFiles = useWorkspaceStore((s) => s.addFiles);
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

  // ── Drag-and-drop state ──────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Overlay state + their keyboard shortcuts (\ for graph, ⌘J for chat,
  // Esc closes whichever is open). One hook owns the whole stack.
  const {
    vaultOpen, setVaultOpen,
    fileBrowserOpen, setFileBrowserOpen,
    aiChatOpen, setAiChatOpen,
  } = useViewerOverlays();

  // Bumps when the atmosphere painting should re-pick — handles both
  // the sidebar cycle/shuffle buttons AND timed rotation (hourly, 5m).
  const paintingNonce = useAtmosphereRotation(atmosphere);

  // Lazy-embed every file that doesn't have vectors yet (powers
  // semantic search + related-notes + AI chat). Triggers the one-time
  // MiniLM download on first run.
  useEmbeddingsBackfill(useWorkspaceStore.getState().activeWorkspaceId);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    const results: { filename: string; content: string }[] = [];
    for (const file of Array.from(droppedFiles)) {
      if (file.name.match(/\.(md|markdown)$/i)) {
        const content = await file.text();
        results.push({ filename: file.name, content });
      }
    }
    if (results.length > 0) {
      addFiles(results);
    }
  }, [addFiles]);

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
    <div
      className={`app ${focusMode ? 'focus-mode' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Zen hover zones — three invisible 16px strips at the edges that
          reveal chrome only when the cursor genuinely reaches for it.
          Without these, `.toolbar:hover` would fire on the whole shell. */}
      <div className="zen-zone zen-zone-top" aria-hidden="true" />
      <div className="zen-zone zen-zone-left" aria-hidden="true" />
      <div className="zen-zone zen-zone-right" aria-hidden="true" />
      {isDragging && (
        <div className="viewer-drop-overlay">
          <div className="viewer-drop-content">
            <Upload size={48} className="viewer-drop-icon" />
            <h2 className="viewer-drop-title">Drop your .md files here</h2>
            <p className="viewer-drop-subtitle">Files will be added to the current workspace</p>
          </div>
        </div>
      )}
      <Toolbar
        onAddFiles={() => addFilesInputRef.current?.click()}
        readingStats={readingStats}
        onTogglePresentation={() => setShowPresentation(true)}
        onToggleSplitView={() => setShowSplitView(!showSplitView)}
        onToggleDiffView={() => setShowDiffView(true)}
        onToggleEditor={() => setShowEditor(true)}
        onToggleVault={() => setVaultOpen(true)}
        onOpenFileBrowser={() => setFileBrowserOpen(true)}
        onOpenAiChat={() => setAiChatOpen(true)}
        onGoHome={onGoHome}
        onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
      />
      {atmosphere !== 'none' && (
        <PaintingAtmosphere atmosphere={atmosphere} paintingNonce={paintingNonce} />
      )}
      <ShareStatus />
      <WorkspaceTabs />

      {/* Standalone "+ new workspace" drop target. Becomes visible only
          while a sidebar file is being dragged. Drop a file here to
          promote it into its own brand-new workspace. */}
      <div
        className="workspace-tab-new-drop-standalone"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('application/x-markview-file')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            (e.currentTarget as HTMLElement).classList.add('is-hot');
          }
        }}
        onDragLeave={(e) => {
          (e.currentTarget as HTMLElement).classList.remove('is-hot');
        }}
        onDrop={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).classList.remove('is-hot');
          const fileId = e.dataTransfer.getData('application/x-markview-file');
          if (fileId) {
            void useWorkspaceStore.getState().promoteFileToNewWorkspace(fileId);
          }
        }}
        aria-hidden="true"
      >
        + Drop here to make it its own workspace
      </div>

      {/* Hidden file input — the "+" button in the toolbar calls
          `addFilesInputRef.current.click()`. We read each .md / .markdown
          file's text and append to the active workspace. */}
      <input
        ref={addFilesInputRef}
        type="file"
        accept=".md,.markdown,text/markdown"
        multiple
        style={{ display: 'none' }}
        onChange={async (e) => {
          const picked = e.target.files;
          if (!picked || picked.length === 0) return;
          const incoming: { filename: string; content: string }[] = [];
          for (const f of Array.from(picked)) {
            try {
              const content = await f.text();
              incoming.push({ filename: f.name, content });
            } catch (err) {
              console.warn('failed to read file', f.name, err);
            }
          }
          if (incoming.length > 0) {
            await useWorkspaceStore.getState().addFiles(incoming);
          }
          // reset so picking the same file twice fires another change
          e.target.value = '';
        }}
      />

      {fileBrowserOpen && (
        <Suspense fallback={null}>
          <FileBrowser onClose={() => setFileBrowserOpen(false)} />
        </Suspense>
      )}

      {vaultOpen && (
        <Suspense fallback={null}>
          <GraphView onClose={() => setVaultOpen(false)} />
        </Suspense>
      )}

      {aiChatOpen && (
        <Suspense fallback={null}>
          <AiChat onClose={() => setAiChatOpen(false)} />
        </Suspense>
      )}

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
              <div className="viewer-empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '60vh', opacity: 0.15, userSelect: 'none', pointerEvents: 'none' }}>
                <img src="/icon-512.png" alt="" style={{ width: 120, height: 120, filter: 'grayscale(100%) drop-shadow(0 0 40px rgba(255,255,255,0.1))' }} />
                <h3 style={{ marginTop: 24, fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em' }}>MarkView</h3>
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
        {!focusMode && (
          <div className="viewer-right-rail">
            <TableOfContents headings={headings} scrollContainerRef={contentRef} />
            <RelatedNotes
              content={activeFileContent}
              fileId={activeFileId}
              workspaceId={useWorkspaceStore.getState().activeWorkspaceId}
            />
          </div>
        )}
        {showSplitView && activeFileId && (
          <Suspense fallback={null}>
            <SplitView mainFileId={activeFileId} onClose={() => setShowSplitView(false)} />
          </Suspense>
        )}
      </div>

      <SearchDialog />

      {/* Overlays */}
      {showPresentation && effectiveContent && (
        <Suspense fallback={null}>
          <PresentationMode
            html={renderedHtml || effectiveContent}
            onClose={() => setShowPresentation(false)}
          />
        </Suspense>
      )}

      {showDiffView && activeFileId && (
        <Suspense fallback={null}>
          <DiffView
            fileAId={activeFileId}
            onClose={() => setShowDiffView(false)}
          />
        </Suspense>
      )}

      {showEditor && activeFileId && activeFileContent && (() => {
        // When collab is on, hand the editor a Y.Text from the shared
        // doc so edits stream peer-to-peer in real time. Solo mode
        // leaves yText undefined and the editor seeds from `content`.
        const collab = useCollabStore.getState();
        const collabFileId = isGuestMode
          ? syncedActiveFileId ?? activeFileId
          : activeFileId;
        const yText = collabIsActive ? collab.getYText(collabFileId) ?? undefined : undefined;
        const awareness = collabIsActive ? collab.getAwareness() ?? undefined : undefined;
        return (
          <Suspense fallback={null}>
            <MarkdownEditor
              content={activeFileContent}
              filename={activeFile?.filename || 'untitled.md'}
              fileId={activeFile?.id}
              workspaceId={useWorkspaceStore.getState().activeWorkspaceId || undefined}
              onSave={handleEditorSave}
              onClose={() => setShowEditor(false)}
              yText={yText}
              awareness={awareness}
            />
          </Suspense>
        );
      })()}

    </div>
  );
}
