// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, FileText, FolderOpen, X, Search as SearchIcon, ArrowRight } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { db, type DBFile } from '@/lib/storage/db';

interface FileBrowserProps {
  onClose: () => void;
}

/**
 * FileBrowser — a modal that lists every workspace and every file across
 * the entire IndexedDB store. Click a file to switch workspace + open it
 * in one tap. Designed to replace the redundant "Home" button: you can
 * navigate the whole library from one place.
 *
 * On mobile this is the fastest way to jump between workspaces since the
 * workspace tabs row is tight on horizontal space.
 */
export function FileBrowser({ onClose }: FileBrowserProps) {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeFiles = useWorkspaceStore((s) => s.files);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);

  // Map of workspaceId → its files (loaded lazily from IDB except for the
  // active workspace, which already lives in store state).
  const [filesByWs, setFilesByWs] = useState<Record<string, DBFile[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([activeWorkspaceId || '']));
  const [query, setQuery] = useState('');

  // Load files for every workspace once on mount so search can span all.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await db.files.toArray();
      if (cancelled) return;
      const grouped: Record<string, DBFile[]> = {};
      for (const f of all) {
        (grouped[f.workspaceId] ||= []).push(f);
      }
      for (const id in grouped) {
        grouped[id].sort((a, b) => a.order - b.order);
      }
      setFilesByWs(grouped);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filterText = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!filterText) return filesByWs;
    const out: Record<string, DBFile[]> = {};
    for (const ws of workspaces) {
      const matches = (filesByWs[ws.id] || []).filter((f) =>
        (f.displayName || f.filename).toLowerCase().includes(filterText)
        || ws.title.toLowerCase().includes(filterText)
      );
      if (matches.length > 0) out[ws.id] = matches;
    }
    return out;
  }, [filterText, filesByWs, workspaces]);

  const toggle = (wsId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(wsId)) next.delete(wsId);
      else next.add(wsId);
      return next;
    });
  };

  const openFile = async (wsId: string, fileId: string) => {
    if (wsId !== activeWorkspaceId) {
      await switchWorkspace(wsId);
    }
    await setActiveFile(fileId);
    onClose();
  };

  const totalFiles = Object.values(filesByWs).reduce((s, arr) => s + arr.length, 0);
  const totalShown = Object.values(filtered).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="file-browser-overlay" onClick={onClose}>
      <div className="file-browser" onClick={(e) => e.stopPropagation()}>
        <div className="file-browser-header">
          <div className="file-browser-title-row">
            <FolderOpen size={16} className="file-browser-icon" />
            <span className="file-browser-title">All workspaces</span>
            <span className="file-browser-count">
              {filterText ? `${totalShown} of ${totalFiles}` : `${workspaces.length} · ${totalFiles}`}
            </span>
            <button className="file-browser-close" onClick={onClose} title="Close (Esc)">
              <X size={16} />
            </button>
          </div>
          <div className="file-browser-search">
            <SearchIcon size={14} className="file-browser-search-icon" />
            <input
              className="file-browser-search-input"
              type="text"
              autoFocus
              placeholder="Filter workspaces and files…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="file-browser-search-clear" onClick={() => setQuery('')}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="file-browser-list">
          {workspaces.length === 0 && (
            <div className="file-browser-empty">No workspaces yet.</div>
          )}
          {workspaces.map((ws) => {
            const wsFiles = filtered[ws.id];
            if (filterText && !wsFiles) return null;
            // When the active workspace, prefer the in-memory list so
            // unsaved order changes are reflected immediately.
            const liveFiles = ws.id === activeWorkspaceId
              ? activeFiles.map((m) => ({ ...m, workspaceId: ws.id, content: '' }) as DBFile)
              : (wsFiles ?? filesByWs[ws.id] ?? []);
            const isOpen = filterText ? true : expanded.has(ws.id);
            const showFiles = filterText ? (wsFiles ?? []) : liveFiles;
            return (
              <div key={ws.id} className={`file-browser-ws ${ws.id === activeWorkspaceId ? 'file-browser-ws-active' : ''}`}>
                <button className="file-browser-ws-row" onClick={() => toggle(ws.id)}>
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <FolderOpen size={14} className="file-browser-ws-icon" />
                  <span className="file-browser-ws-name">{ws.title}</span>
                  <span className="file-browser-ws-count">{showFiles.length}</span>
                </button>
                {isOpen && showFiles.length > 0 && (
                  <ul className="file-browser-files">
                    {showFiles.map((f) => (
                      <li key={f.id}>
                        <button
                          className="file-browser-file"
                          onClick={() => openFile(ws.id, f.id)}
                          title={f.filename}
                        >
                          <FileText size={13} className="file-browser-file-icon" />
                          <span className="file-browser-file-name">
                            {('displayName' in f && f.displayName) || f.filename}
                          </span>
                          <ArrowRight size={12} className="file-browser-file-go" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {isOpen && showFiles.length === 0 && (
                  <div className="file-browser-files-empty">no files</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
