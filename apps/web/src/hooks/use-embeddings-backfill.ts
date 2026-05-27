// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';

/**
 * useEmbeddingsBackfill — kicks off a lazy embed pass for any file in
 * the given workspace that doesn't have vectors yet.
 *
 * Why the long delay: the first run downloads ~23 MB of MiniLM weights
 * AND compiles the ONNX WASM runtime on the main thread. The WASM
 * compile alone is a multi-second blocking task — visible as a "page
 * froze right after it loaded" jank. We don't want any of that on the
 * critical path of someone opening a shared URL just to read.
 *
 * Strategy: defer 10 s, then still go through requestIdleCallback so we
 * yield to any in-flight rendering. Cancelling on unmount keeps it from
 * firing for a workspace the user navigated away from.
 *
 * No-op when `workspaceId` is null.
 */
const BACKFILL_DELAY_MS = 10_000;

export function useEmbeddingsBackfill(workspaceId: string | null | undefined): void {
  useEffect(() => {
    if (!workspaceId) return;

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (h: number) => void;
    };
    let idleHandle: number | null = null;

    const run = () => {
      void import('@/lib/embeddings').then(({ backfillWorkspace }) => {
        void backfillWorkspace(workspaceId);
      });
    };

    const timeoutHandle = window.setTimeout(() => {
      if (typeof w.requestIdleCallback === 'function') {
        idleHandle = w.requestIdleCallback(run, { timeout: 5_000 });
      } else {
        run();
      }
    }, BACKFILL_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutHandle);
      if (idleHandle !== null && typeof w.cancelIdleCallback === 'function') {
        w.cancelIdleCallback(idleHandle);
      }
    };
  }, [workspaceId]);
}
