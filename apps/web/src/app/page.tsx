'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useThemeStore } from '@/stores/theme-store';
import { useCollabStore } from '@/stores/collab-store';
import { LandingPage } from '@/components/landing/landing-page';
import { ViewerPage } from '@/components/viewer/viewer-page';
import { JoinDialog } from '@/components/collab/join-dialog';
import { getRoomIdFromUrl } from '@/lib/collab/y-provider';
import { preloadShiki } from '@/components/viewer/markdown-renderer';
import { initTauriBridge } from '@/lib/tauri/tauri-bridge';

export default function HomePage() {
  // ── Store slices ───────────────────────────────────────────────────
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const files = useWorkspaceStore((s) => s.files);
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const isLoaded = useWorkspaceStore((s) => s.isLoaded);
  const initialize = useWorkspaceStore((s) => s.initialize);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const addFiles = useWorkspaceStore((s) => s.addFiles);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace);
  const initializeTheme = useThemeStore((s) => s.initialize);
  const collabIsActive = useCollabStore((s) => s.isActive);
  const collabIsHost = useCollabStore((s) => s.isHost);

  // ── Routing state ──────────────────────────────────────────────────
  const [showLanding, setShowLanding] = useState(false);
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);

  // Ref for the hidden file-add input surfaced from ViewerPage
  const addFilesInputRef = useRef<HTMLInputElement | null>(null);

  // ── Initialization ─────────────────────────────────────────────────
  useEffect(() => {
    initializeTheme();
    initialize();
    preloadShiki();
    initTauriBridge(); // no-op in browser, activates in Tauri desktop
    const roomId = getRoomIdFromUrl();
    if (roomId) {
      setPendingRoomId(roomId);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [initializeTheme, initialize]);

  // Capture #md= before React clears the hash, then process after isLoaded
  const pendingHashRef = useRef<string | null>(null);
  useEffect(() => {
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
          useWorkspaceStore.getState().createWorkspace(
            result.title || 'Shared Document',
            [{ filename: `${result.title || 'document'}.md`, content: result.content }]
          );
          window.history.replaceState({}, '', window.location.pathname);
        }
      });
    });
  }, [isLoaded]);

  // ── Workspace handlers ─────────────────────────────────────────────
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

  const handleNavigateToFile = useCallback((filename: string) => {
    const lower = filename.toLowerCase();
    const target = files.find((f) => {
      const base = f.filename.split('/').pop()?.toLowerCase() || '';
      return base === lower || f.filename.toLowerCase() === lower;
    });
    if (target) setActiveFile(target.id);
  }, [files, setActiveFile]);

  // ── Add-files input (onChange forwarded to handleNewWorkspace) ─────
  const handleAddFilesChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      const processFiles = async () => {
        const list: { filename: string; content: string }[] = [];
        for (const file of Array.from(e.target.files!)) {
          if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
            list.push({ filename: file.name, content: await file.text() });
          }
        }
        if (list.length > 0) handleNewWorkspace(list);
      };
      processFiles();
    },
    [handleNewWorkspace]
  );

  // ── Guards ─────────────────────────────────────────────────────────
  if (!isLoaded) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading MarkView...</p>
      </div>
    );
  }

  const isGuestMode = collabIsActive && !collabIsHost;
  const activeFile = files.find((f) => f.id === activeFileId);
  const hasWorkspace = workspaces.length > 0 && activeWorkspaceId && activeFile;

  if (pendingRoomId && !collabIsActive) {
    return <JoinDialog roomId={pendingRoomId} onClose={() => setPendingRoomId(null)} />;
  }

  if ((!hasWorkspace && !isGuestMode) || showLanding) {
    return (
      <LandingPage
        onFilesSelected={(files) => { setShowLanding(false); handleFilesSelected(files); }}
        onGitHubImport={(files, title) => { setShowLanding(false); handleNewWorkspace(files, title); }}
        hasExistingWorkspace={hasWorkspace ? true : false}
        onBackToWorkspace={() => setShowLanding(false)}
        onClearAll={async () => {
          for (const ws of workspaces) await deleteWorkspace(ws.id);
          setShowLanding(false);
        }}
      />
    );
  }

  return (
    <>
      <ViewerPage
        onGoHome={() => setShowLanding(true)}
        addFilesInputRef={addFilesInputRef}
        onNavigateToFile={handleNavigateToFile}
      />
      {/* Hidden input for the "Add Files" toolbar action */}
      <input
        ref={addFilesInputRef}
        type="file"
        accept=".md,.markdown,.zip"
        multiple
        className="hidden"
        onChange={handleAddFilesChange}
      />
    </>
  );
}
