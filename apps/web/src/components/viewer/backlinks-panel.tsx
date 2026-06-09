// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { Link2, ArrowRight } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { findBacklinks, type Backlink } from '@/lib/backlinks';

interface BacklinksPanelProps {
  fileId: string | null;
  workspaceId: string | null;
}

/**
 * BacklinksPanel — right-rail "what links here" for the active note. Scans
 * the workspace's files for wikilinks / transclusions / markdown links that
 * point at this note. Reuses the related-notes styling.
 */
export function BacklinksPanel({ fileId, workspaceId }: BacklinksPanelProps) {
  const files = useWorkspaceStore((s) => s.files);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);
  const [links, setLinks] = useState<Backlink[]>([]);

  useEffect(() => {
    if (!fileId || !workspaceId) { setLinks([]); return; }
    const target = files.find((f) => f.id === fileId);
    if (!target) { setLinks([]); return; }
    let cancelled = false;
    void (async () => {
      const { db } = await import('@/lib/storage/db');
      const all = await db.files.where('workspaceId').equals(workspaceId).toArray();
      if (cancelled) return;
      setLinks(findBacklinks(
        { id: target.id, displayName: target.displayName, filename: target.filename },
        all,
      ));
    })();
    return () => { cancelled = true; };
  }, [fileId, workspaceId, files]);

  if (links.length === 0) return null;

  return (
    <div className="related-notes">
      <div className="related-notes-header">
        <Link2 size={11} className="related-notes-icon" />
        Linked from ({links.length})
      </div>
      <ul className="related-notes-list">
        {links.map((l) => (
          <li key={l.fileId}>
            <button
              className="related-notes-row"
              onClick={() => setActiveFile(l.fileId)}
              title={l.snippet}
            >
              <div className="related-notes-row-title">
                <span className="related-notes-row-name">{l.label}</span>
                <ArrowRight size={10} className="related-notes-row-arrow" />
              </div>
              <div className="related-notes-row-preview">{l.snippet}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
