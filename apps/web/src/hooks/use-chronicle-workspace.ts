// SPDX-License-Identifier: Apache-2.0
//
// useChronicleWorkspace — lazily build (or reuse) a single workspace
// containing every project's bundle (readme + changelog + commits) so
// the existing <AiChat /> component can answer cross-project questions
// via RAG without any new chat plumbing.
//
// Only runs when `active` flips true (i.e. the chat panel opens), so
// /projects's first paint isn't slowed by fetching 100+ markdown files.

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useEmbeddingsBackfill } from "@/hooks/use-embeddings-backfill";

const CHRONICLE_TITLE = "the chronicle";
// commits.md intentionally excluded — short, keyword-heavy artifacts
// dominate the embedding store and degrade retrieval for synthesis
// questions. The per-project view at /p/:slug already exposes them.
const BUNDLE_FILES = ["readme.md", "changelog.md"] as const;
const BATCH_SIZE = 8;

type Status = "idle" | "loading" | "ready" | "error";

interface Result {
  workspaceId: string | null;
  status: Status;
  loaded: number;
  total: number;
  error: string | null;
}

export function useChronicleWorkspace(active: boolean, slugs: string[]): Result {
  const [status, setStatus] = useState<Status>("idle");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const total = slugs.length * BUNDLE_FILES.length;

  // Backfill embeddings for the chronicle once the workspace exists.
  // The existing hook is a no-op when workspaceId is null.
  useEmbeddingsBackfill(workspaceId);

  useEffect(() => {
    if (!active || slugs.length === 0) return;
    let cancelled = false;

    void (async () => {
      setStatus("loading");
      setError(null);
      setLoaded(0);

      const store = useWorkspaceStore.getState();
      if (!store.isLoaded) await store.initialize();

      // Reuse an existing chronicle workspace if one exists.
      const existing = useWorkspaceStore
        .getState()
        .workspaces.find((w) => w.title === CHRONICLE_TITLE);

      if (existing) {
        await store.switchWorkspace(existing.id);
        if (cancelled) return;
        setWorkspaceId(existing.id);
        setLoaded(total);
        setStatus("ready");
        return;
      }

      try {
        const files: { filename: string; content: string }[] = [];
        for (let i = 0; i < slugs.length; i += BATCH_SIZE) {
          if (cancelled) return;
          const batch = slugs.slice(i, i + BATCH_SIZE);
          const results = await Promise.all(
            batch.flatMap((slug) =>
              BUNDLE_FILES.map(async (name) => {
                try {
                  const res = await fetch(
                    `/portfolio/${encodeURIComponent(slug)}/${name}`
                  );
                  if (!res.ok) return null;
                  return {
                    filename: `${slug}/${name}`,
                    content: await res.text(),
                  };
                } catch {
                  return null;
                }
              })
            )
          );
          for (const r of results) if (r) files.push(r);
          if (!cancelled) setLoaded((n) => n + batch.length * BUNDLE_FILES.length);
        }
        if (cancelled) return;

        if (files.length === 0) {
          throw new Error("no portfolio bundles loaded");
        }

        await store.createWorkspace(CHRONICLE_TITLE, files);
        const id = useWorkspaceStore.getState().activeWorkspaceId;
        if (cancelled) return;
        setWorkspaceId(id);
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, slugs.length, total]);

  return { workspaceId, status, loaded, total, error };
}
