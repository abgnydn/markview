// SPDX-License-Identifier: Apache-2.0
//
// /p/:slug — per-project workspace. Loads the bundle written by
// scripts/sync-portfolio.mjs (readme.md / changelog.md / commits.md)
// from /portfolio/<slug>/, mounts it as a workspace in the same
// Zustand+Dexie store that powers the editor, and renders the existing
// ViewerPage so every editor feature (zen toggle, ⌘K search, share
// links, presentation mode, semantic search) lights up for free.
//
// The workspace is rebuilt on each visit so the daily sync's fresh
// commits propagate immediately, at the cost of any per-visit
// annotations. v1 trade-off; revisit if users start writing notes.

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useThemeStore } from "@/stores/theme-store";
import { ViewerPage } from "@/components/viewer/viewer-page";
import { useMarketingBeacon } from "@/lib/analytics";

type Status = "loading" | "ready" | "error";

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 18,
        background:
          "radial-gradient(ellipse at 50% 0%, #0b0a0d 0%, #050406 100%)",
        color: "rgba(236,232,224,0.46)",
        fontFamily:
          'ui-monospace, "Berkeley Mono", SFMono-Regular, Menlo, monospace',
        fontSize: 11,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        textAlign: "center",
        padding: 24,
      }}
    >
      {children}
    </div>
  );
}

export default function Project() {
  useMarketingBeacon();
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isLoaded = useWorkspaceStore((s) => s.isLoaded);
  const initialize = useWorkspaceStore((s) => s.initialize);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);
  const files = useWorkspaceStore((s) => s.files);
  const initializeTheme = useThemeStore((s) => s.initialize);

  const addFilesInputRef = useRef<HTMLInputElement>(null);

  // Lock body scroll for the editor surface — Projects sets
  // proj-route-mounted to UNLOCK it, so we explicitly remove that here.
  useEffect(() => {
    document.body.classList.remove("proj-route-mounted");
  }, []);

  // Initialize store + theme on mount.
  useEffect(() => {
    void initialize();
    initializeTheme();
  }, [initialize, initializeTheme]);

  // Hydrate (or refresh) the workspace for this slug. Re-runs when slug
  // changes so navigating /p/a → /p/b correctly rebuilds.
  const hydratedSlugRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isLoaded) return;
    if (hydratedSlugRef.current === slug) return;
    hydratedSlugRef.current = slug;
    setStatus("loading");

    void (async () => {
      try {
        // Pull the bundle. Vite serves /public verbatim so this URL is
        // stable in dev and production alike.
        const base = `/portfolio/${encodeURIComponent(slug)}`;
        const [readmeRes, changelogRes, commitsRes] = await Promise.all([
          fetch(`${base}/readme.md`),
          fetch(`${base}/changelog.md`),
          fetch(`${base}/commits.md`),
        ]);

        if (!readmeRes.ok) {
          throw new Error(
            `no portfolio bundle for "${slug}" (HTTP ${readmeRes.status})`
          );
        }

        const [readme, changelog, commits] = await Promise.all([
          readmeRes.text(),
          changelogRes.ok ? changelogRes.text() : Promise.resolve(""),
          commitsRes.ok ? commitsRes.text() : Promise.resolve(""),
        ]);

        const title = `portfolio: ${slug}`;
        // Latest store snapshot (workspaces from selector may be stale
        // between rapid navigations).
        const existing = useWorkspaceStore
          .getState()
          .workspaces.find((w) => w.title === title);
        if (existing) {
          await deleteWorkspace(existing.id);
        }

        const newFiles = [
          { filename: "README.md", content: readme },
          ...(changelog
            ? [{ filename: "CHANGELOG.md", content: changelog }]
            : []),
          ...(commits ? [{ filename: "commits.md", content: commits }] : []),
        ];
        await createWorkspace(title, newFiles);

        setStatus("ready");
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    })();
  }, [isLoaded, slug, createWorkspace, deleteWorkspace]);

  const handleGoHome = () => {
    navigate("/projects");
  };

  const handleNavigateToFile = (filename: string) => {
    const target = files.find(
      (f) => f.filename === filename || f.filename === `${filename}.md`
    );
    if (target) void setActiveFile(target.id);
  };

  if (!isLoaded || status === "loading") {
    return <CenteredMessage>loading {slug}…</CenteredMessage>;
  }
  if (status === "error") {
    return (
      <CenteredMessage>
        <div>couldn't load /p/{slug}</div>
        <div style={{ opacity: 0.7, letterSpacing: "0.06em", textTransform: "none" }}>
          {errorMsg}
        </div>
        <button
          type="button"
          onClick={() => navigate("/projects")}
          style={{
            background: "transparent",
            border: "1px solid rgba(236,232,224,0.18)",
            color: "rgba(236,232,224,0.82)",
            padding: "8px 14px",
            borderRadius: 3,
            fontFamily: "inherit",
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          ← back to projects
        </button>
      </CenteredMessage>
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
