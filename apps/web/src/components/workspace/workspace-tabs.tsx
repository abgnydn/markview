'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Pencil } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace-store';

export function WorkspaceTabs() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace);
  const renameWorkspace = useWorkspaceStore((s) => s.renameWorkspace);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  if (workspaces.length <= 1) return null;

  const handleStartRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const handleFinishRename = () => {
    if (editingId && editTitle.trim()) {
      renameWorkspace(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleClose = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to close this workspace?')) {
      deleteWorkspace(id);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="workspace-tabs">
      <div className="workspace-tabs-scroll">
        {workspaces.map((ws) => (
          <div
            key={ws.id}
            className={`workspace-tab ${ws.id === activeWorkspaceId ? 'workspace-tab-active' : ''}`}
            onClick={() => switchWorkspace(ws.id)}
            title={`${ws.title} — ${ws.fileCount} files, ${formatSize(ws.totalSize)}`}
          >
            {editingId === ws.id ? (
              <input
                ref={editInputRef}
                className="workspace-tab-edit"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleFinishRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFinishRename();
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="workspace-tab-title">{ws.title}</span>
                <span className="workspace-tab-count">{ws.fileCount}</span>
                <button
                  className="workspace-tab-action workspace-tab-rename"
                  onClick={(e) => handleStartRename(ws.id, ws.title, e)}
                  title="Rename"
                >
                  <Pencil size={10} />
                </button>
                <button
                  className="workspace-tab-action workspace-tab-close"
                  onClick={(e) => handleClose(ws.id, e)}
                  title="Close workspace"
                >
                  <X size={12} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
