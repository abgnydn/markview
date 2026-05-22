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
import { preloadShiki } from "@/components/viewer/markdown-renderer";

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
    void preloadShiki();
  }, []);

  useEffect(() => {
    void initialize();
    initializeTheme();
  }, [initialize, initializeTheme]);

  const handleNavigateToFile = (filename: string) => {
    const target = files.find(
      (f) => f.filename === filename || f.filename === `${filename}.md`,
    );
    if (target) void setActiveFile(target.id);
  };

  const handleStart = async () => {
    if (workspaces.length === 0) {
      await createWorkspace("welcome", [
        {
          filename: "welcome.md",
          content: WELCOME_DOC,
        },
      ]);
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
    return <LandingEditor onStart={() => void handleStart()} />;
  }

  return (
    <ViewerPage
      onGoHome={handleGoHome}
      addFilesInputRef={addFilesInputRef}
      onNavigateToFile={handleNavigateToFile}
    />
  );
}

const WELCOME_DOC = `# Welcome to MarkView

A markdown editor that stays on your machine.

## What you can do

- **Edit** — CodeMirror 6 with full markdown syntax highlighting. Press \`⌘B\` for bold, \`⌘I\` for italic, \`⌘K\` for link.
- **Render** — Shiki for code, Mermaid for diagrams, KaTeX for math.
- **Search** — \`⌘K\` opens a fuzzy finder across all open files.
- **Export** — PDF, Word, PowerPoint, PNG, SVG, HTML, or a static site.
- **Share** — generate a live collab URL; another person joins and you both type at once.

## Try it now

Drag a \`.md\` file onto this page. Or drop an entire folder. Or paste a GitHub URL — MarkView will pull the markdown files in.

Everything stays on your machine. No accounts, no uploads, no telemetry.

\`\`\`typescript
function welcome(): string {
  return 'happy editing';
}
\`\`\`

> Tip: press \`E\` to open the editor on this file, or click anywhere in the rendered text to keep reading.
`;
