
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Pencil } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export function WorkspaceTabs() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace);
  const renameWorkspace = useWorkspaceStore((s) => s.renameWorkspace);
  const reorderWorkspaces = useWorkspaceStore((s) => s.reorderWorkspaces);
  const moveFileToWorkspace = useWorkspaceStore((s) => s.moveFileToWorkspace);
  const promoteFileToNewWorkspace = useWorkspaceStore((s) => s.promoteFileToNewWorkspace);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [workspaceToClose, setWorkspaceToClose] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Drag-and-drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // Cross-workspace file-drop: when a sidebar file is dragged over a tab,
  // we highlight the tab differently from intra-tabs reorder.
  const [fileDropWsId, setFileDropWsId] = useState<string | null>(null);
  const dragCounter = useRef(0);

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
    setWorkspaceToClose(id);
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // --- Drag-and-drop handlers ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (editingId) return;
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    (e.currentTarget as HTMLElement).style.opacity = '0.4';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '';
    setDragIndex(null);
    setDropIndex(null);
    dragCounter.current = 0;
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragCounter.current++;
    setDropIndex(index);
  };

  const handleDragLeave = () => {
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDropIndex(null);
    }
  };

  const handleDragOver = (e: React.DragEvent, wsId: string) => {
    e.preventDefault();
    // A sidebar file carries `application/x-markview-file`; mark this tab
    // as a cross-workspace drop target so the user gets visible feedback.
    if (e.dataTransfer.types.includes('application/x-markview-file')) {
      e.dataTransfer.dropEffect = 'move';
      setFileDropWsId(wsId);
    } else {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: React.DragEvent, toIndex: number, toWsId: string) => {
    e.preventDefault();
    // Cross-workspace file move takes precedence — the payload tells us
    // what kind of drop this is.
    const fileId = e.dataTransfer.getData('application/x-markview-file');
    setFileDropWsId(null);
    if (fileId) {
      void moveFileToWorkspace(fileId, toWsId);
      dragCounter.current = 0;
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    const fromIndex = Number(e.dataTransfer.getData('text/plain'));
    dragCounter.current = 0;
    setDragIndex(null);
    setDropIndex(null);
    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      reorderWorkspaces(fromIndex, toIndex);
    }
  };

  // "New workspace" drop target — drop a file here to promote it into
  // its own workspace.
  const handleNewWsDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setFileDropWsId(null);
    const fileId = e.dataTransfer.getData('application/x-markview-file');
    if (fileId) {
      void promoteFileToNewWorkspace(fileId);
    }
  };
  const handleNewWsDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-markview-file')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setFileDropWsId('__new__');
    }
  };
  const handleNewWsDragLeave = () => {
    setFileDropWsId(null);
  };

  return (
    <>
      <div className="workspace-tabs">
      <div className="workspace-tabs-scroll">
        {workspaces.map((ws, index) => (
          <div
            key={ws.id}
            className={`workspace-tab${ws.id === activeWorkspaceId ? ' workspace-tab-active' : ''}${dragIndex === index ? ' workspace-tab-dragging' : ''}${dropIndex === index && dragIndex !== index ? ' workspace-tab-drop-target' : ''}${fileDropWsId === ws.id ? ' workspace-tab-file-drop' : ''}`}
            onClick={() => switchWorkspace(ws.id)}
            title={`${ws.title} — ${ws.fileCount} files, ${formatSize(ws.totalSize)}\nDrop a file here to move it into this workspace.`}
            draggable={editingId !== ws.id}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragEnter={(e) => handleDragEnter(e, index)}
            onDragLeave={() => { handleDragLeave(); if (fileDropWsId === ws.id) setFileDropWsId(null); }}
            onDragOver={(e) => handleDragOver(e, ws.id)}
            onDrop={(e) => handleDrop(e, index, ws.id)}
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
        {/* "New workspace" drop target — drag a file here to promote it
            into its own workspace. Invisible until something's being
            dragged so it doesn't clutter the row otherwise. */}
        <div
          className={`workspace-tab-new-drop${fileDropWsId === '__new__' ? ' workspace-tab-new-drop-active' : ''}`}
          onDragOver={handleNewWsDragOver}
          onDragLeave={handleNewWsDragLeave}
          onDrop={handleNewWsDrop}
          title="Drop a file here to make it its own workspace"
        >
          + new
        </div>
      </div>
      </div>
      <ConfirmDialog
        isOpen={workspaceToClose !== null}
        title="Close Workspace"
        description="Are you sure you want to close this workspace and remove it from your sessions? You can always recreate it later by reopening the folder."
        confirmText="Close Workspace"
        onConfirm={() => {
          if (workspaceToClose) deleteWorkspace(workspaceToClose);
          setWorkspaceToClose(null);
        }}
        onCancel={() => setWorkspaceToClose(null)}
      />
    </>
  );
}
