// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useThemeStore } from "@/stores/theme-store";
import { useCollabStore } from "@/stores/collab-store";
import { ViewerPage } from "@/components/viewer/viewer-page";
import { JoinDialog } from "@/components/collab/join-dialog";
import { getRoomIdFromUrl } from "@/lib/collab/y-provider";
import { preloadShiki } from "@/components/viewer/markdown-renderer";

/**
 * Markview's home — a single surface: the editor.
 *
 * No landing page split, no marketing scaffolding. If the URL has a
 * `?room=<id>` parameter, the JoinDialog prompts to join a live collab
 * room before the editor mounts.
 */
export default function Home() {
  const isLoaded = useWorkspaceStore((s) => s.isLoaded);
  const initialize = useWorkspaceStore((s) => s.initialize);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);
  const files = useWorkspaceStore((s) => s.files);
  const initializeTheme = useThemeStore((s) => s.initialize);
  const collabIsActive = useCollabStore((s) => s.isActive);

  const addFilesInputRef = useRef<HTMLInputElement>(null);

  // Eager Shiki preload — avoids a 200ms flash on first render.
  useEffect(() => {
    void preloadShiki();
  }, []);

  // One-time store initialization (Dexie hydration + theme).
  useEffect(() => {
    void initialize();
    initializeTheme();
  }, [initialize, initializeTheme]);

  // Inter-workspace navigation by filename — used by [[wikilinks]] inside
  // the renderer. If we find a matching file in the active workspace, jump
  // to it; otherwise this is a no-op.
  const handleNavigateToFile = (filename: string) => {
    const target = files.find(
      (f) => f.filename === filename || f.filename === `${filename}.md`,
    );
    if (target) void setActiveFile(target.id);
  };

  if (!isLoaded) {
    return (
      <div className="loading-screen" aria-busy="true">
        loading workspace…
      </div>
    );
  }

  // Show the room-join dialog when there's a ?room=... but no active collab.
  const pendingRoomId = getRoomIdFromUrl();
  if (pendingRoomId && !collabIsActive) {
    return (
      <JoinDialog
        roomId={pendingRoomId}
        onClose={() => {
          // Strip the ?room= param + reload as a regular session.
          const url = new URL(window.location.href);
          url.searchParams.delete("room");
          window.history.replaceState({}, "", url.toString());
          window.location.reload();
        }}
      />
    );
  }

  return (
    <ViewerPage
      onGoHome={() => {
        // setActiveFile expects a string; the workspace store treats empty
        // string as "no active file" in current Home → ViewerPage contract.
        // A future cleanup would make setActiveFile(null) explicit.
        void setActiveFile("");
      }}
      addFilesInputRef={addFilesInputRef}
      onNavigateToFile={handleNavigateToFile}
    />
  );
}
