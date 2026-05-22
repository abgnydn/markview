// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from "react";
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
 *   1. LandingEditor — shown when no workspace exists yet.
 *   2. ViewerPage    — shown when the user has at least one workspace.
 *
 * "Open editor" on the landing seeds a demo README so the editor has
 * something to render the first time. Any subsequent visit goes
 * straight to ViewerPage.
 */
export default function Home() {
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
    await createWorkspace("welcome", [
      {
        filename: "welcome.md",
        content: WELCOME_DOC,
      },
    ]);
  };

  if (!isLoaded) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#060912",
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

  // No workspace yet → landing.
  if (workspaces.length === 0) {
    return <LandingEditor onStart={() => void handleStart()} />;
  }

  return (
    <ViewerPage
      onGoHome={() => void setActiveFile("")}
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
