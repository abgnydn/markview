// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { relatedToParagraph, type SimilarityHit } from '@/lib/embeddings';

interface RelatedNotesProps {
  /** Currently-viewed file's text. We embed the first ~600 chars as the
      "what is this file about" query. Caller usually passes the active
      content; updates trigger a re-query. */
  content: string | null;
  fileId: string | null;
  workspaceId: string | null;
}

/**
 * RelatedNotes — right-rail panel that lists the top semantically-related
 * paragraphs from elsewhere in the workspace. Cosine search against the
 * embedding store, debounced + cancellable. Clicking a hit opens that file.
 */
export function RelatedNotes({ content, fileId, workspaceId }: RelatedNotesProps) {
  const files = useWorkspaceStore((s) => s.files);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);
  const [hits, setHits] = useState<SimilarityHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!content || !fileId || !workspaceId) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    // Use the file's first ~600 chars as the "what is this about" query.
    // We strip the frontmatter inside relatedToParagraph → chunkContent.
    const query = content.slice(0, 600);
    const timer = setTimeout(async () => {
      try {
        const r = await relatedToParagraph(workspaceId, fileId, query, 6);
        if (!cancelled) setHits(r);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [content, fileId, workspaceId]);

  if (!content || !fileId || !workspaceId) return null;
  if (!loading && hits.length === 0) return null;

  return (
    <div className="related-notes">
      <div className="related-notes-header">
        <Sparkles size={11} className="related-notes-icon" />
        Related
      </div>
      <ul className="related-notes-list">
        {loading && hits.length === 0 && (
          <li className="related-notes-loading">searching…</li>
        )}
        {hits.map((h) => {
          const file = files.find((f) => f.id === h.fileId);
          const label = file?.displayName || file?.filename || 'untitled';
          return (
            <li key={`${h.fileId}-${h.paragraphIndex}`}>
              <button
                className="related-notes-row"
                onClick={() => setActiveFile(h.fileId)}
                title={h.preview}
              >
                <div className="related-notes-row-title">
                  <span className="related-notes-row-name">{label}</span>
                  <ArrowRight size={10} className="related-notes-row-arrow" />
                </div>
                <div className="related-notes-row-preview">{h.preview}</div>
                <div className="related-notes-row-score">{h.score.toFixed(2)}</div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
