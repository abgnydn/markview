// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useThemeStore } from "@/stores/theme-store";
import { useCollabStore } from "@/stores/collab-store";
import { ViewerPage } from "@/components/viewer/viewer-page";
import { LandingEditor } from "@/components/landing/landing-editor";
import { JoinDialog } from "@/components/collab/join-dialog";
import { getRoomIdFromUrl } from "@/lib/collab/y-provider";

// Showcase docs — loaded as raw text. Each file exercises a different
// renderer feature so the seed workspace doubles as a feature tour.
import welcomeDoc from "@/showcase/01-welcome.md?raw";
import typographyDoc from "@/showcase/02-typography.md?raw";
import codeDoc from "@/showcase/03-code.md?raw";
import mathDoc from "@/showcase/04-math.md?raw";
import tablesDoc from "@/showcase/05-tables.md?raw";
import calloutsDoc from "@/showcase/06-callouts.md?raw";
import diagramsDoc from "@/showcase/07-diagrams.md?raw";
import mediaDoc from "@/showcase/08-media.md?raw";

/**
 * Home — single route. Two surfaces:
 *   1. LandingEditor — shown when no workspace exists yet, OR the user
 *      came back to the landing via `?home=1` (e.g. clicking the brand
 *      mark in the toolbar). Workspaces are preserved across the visit.
 *   2. ViewerPage    — shown when the user has at least one workspace and
 *      isn't explicitly asking for the landing.
 *
 * "Open editor" on the landing seeds a welcome workspace the first time;
 * subsequent visits reuse whatever's in IndexedDB and clear the ?home flag.
 */
export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const showLanding = searchParams.get("home") === "1";

  const isLoaded = useWorkspaceStore((s) => s.isLoaded);
  const initialize = useWorkspaceStore((s) => s.initialize);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);
  const files = useWorkspaceStore((s) => s.files);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const initializeTheme = useThemeStore((s) => s.initialize);
  const collabIsActive = useCollabStore((s) => s.isActive);

  const addFilesInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void initialize();
    initializeTheme();
  }, [initialize, initializeTheme]);

  // Recipient side of "Share as URL" — when the URL hash contains
  // `#md=<gz-base64>...`, decode it into a transient workspace so the
  // shared markdown actually surfaces in the editor. Without this the
  // encode side copies a working URL but the recipient sees nothing.
  //
  // Runs once per mount and only after the workspace store has loaded,
  // so we don't race with `initialize()`. Hash is cleared post-import
  // to keep refreshes idempotent.
  const sharedHandledRef = useRef(false);
  useEffect(() => {
    if (!isLoaded || sharedHandledRef.current) return;
    if (typeof window === "undefined" || !window.location.hash.includes("md=")) return;
    sharedHandledRef.current = true;
    void (async () => {
      const { checkUrlForSharedContent } = await import("@/lib/sharing/url-share");
      const shared = await checkUrlForSharedContent();
      if (!shared) return;
      const filename = (shared.title?.endsWith(".md") ? shared.title : `${shared.title ?? "shared"}.md`)
        .replace(/[^\w.\- ]/g, "_");
      await createWorkspace(`shared — ${shared.title ?? "untitled"}`, [
        { filename, content: shared.content },
      ]);
      // Wipe the hash so a refresh doesn't re-import the same payload.
      const url = new URL(window.location.href);
      url.hash = "";
      window.history.replaceState({}, "", url.toString());
      setSearchParams({});
    })();
  }, [isLoaded, createWorkspace, setSearchParams]);

  const handleNavigateToFile = (filename: string) => {
    const target = files.find(
      (f) => f.filename === filename || f.filename === `${filename}.md`,
    );
    if (target) void setActiveFile(target.id);
  };

  const handleStart = async () => {
    if (workspaces.length === 0) {
      await createWorkspace("showcase", SHOWCASE_FILES);
    }
    // Clear the ?home=1 flag so the next render shows the editor.
    setSearchParams({});
  };

  const handleGoHome = () => {
    // Don't delete the workspace — preserving the user's work matters more
    // than a clean state. Push the ?home=1 flag and Home re-renders into
    // the landing. Clicking "Open editor" clears the flag and the editor
    // surfaces the existing workspace.
    setSearchParams({ home: "1" });
  };

  /**
   * Github import → seed a new workspace from the imported markdown files
   * and drop the user straight into it.
   */
  const handleImportGithub = async (
    files: { filename: string; content: string }[],
    repoName: string,
  ) => {
    if (files.length === 0) return;
    await createWorkspace(repoName || "github-import", files);
    setSearchParams({});
  };

  if (!isLoaded) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--zen-bg-deep, #060912)",
          color: "rgba(148,163,184,0.6)",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          fontSize: 13,
        }}
      >
        loading…
      </div>
    );
  }

  // Collab join — explicit room url short-circuits the landing.
  const pendingRoomId = getRoomIdFromUrl();
  if (pendingRoomId && !collabIsActive) {
    return (
      <JoinDialog
        roomId={pendingRoomId}
        onClose={() => {
          const url = new URL(window.location.href);
          url.searchParams.delete("room");
          window.history.replaceState({}, "", url.toString());
          window.location.reload();
        }}
      />
    );
  }

  // Landing if: no workspace yet OR user explicitly asked for it via ?home=1.
  if (workspaces.length === 0 || showLanding) {
    return (
      <LandingEditor
        onStart={() => void handleStart()}
        onImportGithub={(files, repoName) => void handleImportGithub(files, repoName)}
      />
    );
  }

  return (
    <ViewerPage
      onGoHome={handleGoHome}
      addFilesInputRef={addFilesInputRef}
      onNavigateToFile={handleNavigateToFile}
    />
  );
}

/**
 * The seed workspace. Eight files that together exercise every renderer
 * feature — typography, code (multi-language), math, tables, callouts,
 * diagrams, media — so the first thing a new user sees is a complete tour
 * of what the editor can render.
 */
const SHOWCASE_FILES = [
  { filename: "01-welcome.md",    content: welcomeDoc },
  { filename: "02-typography.md", content: typographyDoc },
  { filename: "03-code.md",       content: codeDoc },
  { filename: "04-math.md",       content: mathDoc },
  { filename: "05-tables.md",     content: tablesDoc },
  { filename: "06-callouts.md",   content: calloutsDoc },
  { filename: "07-diagrams.md",   content: diagramsDoc },
  { filename: "08-media.md",      content: mediaDoc },
];
