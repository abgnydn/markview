'use client';

import { useEffect, useMemo, useState } from 'react';
import type { VaultDoc } from './vault-store';
import { buildSemanticEdges, type SemanticEdge } from './vault-tfidf';
import { buildEmbeddingEdges } from './vault-embeddings';

export type SemanticSource =
  | 'off'         // not enabled
  | 'tfidf'       // TF-IDF only (no attempt or failed)
  | 'loading'     // embeddings being computed; TF-IDF is what's on screen
  | 'embedding';  // embeddings ready; rendering those

export interface UseSemanticEdgesResult {
  edges: SemanticEdge[];
  source: SemanticSource;
  /** 0..1 during loading, 1 when ready. */
  progress: number;
}

export function useSemanticEdges(
  docs: VaultDoc[],
  enabled: boolean,
): UseSemanticEdgesResult {
  // TF-IDF is instant; memo it separately so it's always the fallback.
  const tfidfEdges = useMemo(
    () =>
      enabled && docs.length >= 2
        ? buildSemanticEdges(docs, { topK: 3, minSim: 0.12 })
        : [],
    [docs, enabled],
  );

  const [embeddingEdges, setEmbeddingEdges] = useState<SemanticEdge[] | null>(null);
  const [source, setSource] = useState<SemanticSource>('off');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!enabled || docs.length < 2) {
      setEmbeddingEdges(null);
      setSource('off');
      setProgress(0);
      return;
    }

    // While the model loads or the embeddings recompute, show TF-IDF so
    // the user isn't staring at nothing.
    setSource((prev) => (prev === 'embedding' ? 'loading' : 'loading'));
    setProgress(0);

    const controller = new AbortController();
    (async () => {
      try {
        const edges = await buildEmbeddingEdges(docs, {
          topK: 3,
          minSim: 0.4,
          signal: controller.signal,
          onProgress: (done, total) => {
            if (!controller.signal.aborted) {
              setProgress(total > 0 ? done / total : 0);
            }
          },
        });
        if (!controller.signal.aborted) {
          setEmbeddingEdges(edges);
          setSource('embedding');
          setProgress(1);
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.warn('[vault] embedding build failed, staying on TF-IDF:', err);
        if (!controller.signal.aborted) {
          setEmbeddingEdges(null);
          setSource('tfidf');
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [docs, enabled]);

  // Embedding result supersedes TF-IDF once ready.
  const edges =
    source === 'embedding' && embeddingEdges ? embeddingEdges : tfidfEdges;

  return { edges, source, progress };
}
