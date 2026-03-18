'use client';

import React, { useState, useMemo } from 'react';
import { FileText, Trash2, ChevronRight, ChevronDown, Folder, FolderOpen, Share2 } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useCollabStore } from '@/stores/collab-store';
import { ShareDialog } from '@/components/collab/share-dialog';
import '@/components/collab/collab.css';

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  fileId?: string;
  children: TreeNode[];
}

function buildTree(files: { id: string; filename: string; displayName: string }[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.filename.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join('/');

      const existing = current.find((n) => n.name === name && n.isFolder === !isLast);
      if (existing) {
        current = existing.children;
      } else {
        const node: TreeNode = {
          name: isLast ? (file.displayName || name) : name,
          path,
          isFolder: !isLast,
          fileId: isLast ? file.id : undefined,
          children: [],
        };
        current.push(node);
        current = node.children;
      }
    }
  }

  // Sort: folders first, then alphabetical
  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    }).map((n) => ({ ...n, children: sortNodes(n.children) }));
  };

  return sortNodes(root);
}

function TreeItem({
  node,
  depth,
  activeFileId,
  onSelect,
  onRemove,
}: {
  node: TreeNode;
  depth: number;
  activeFileId: string | null;
  onSelect: (fileId: string) => void;
  onRemove: (fileId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  if (node.isFolder) {
    return (
      <div className="tree-folder">
        <div
          className="sidebar-item sidebar-folder-item"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => setIsOpen((v) => !v)}
          role="button"
          tabIndex={0}
        >
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {isOpen ? <FolderOpen size={14} className="sidebar-item-icon folder-icon" /> : <Folder size={14} className="sidebar-item-icon folder-icon" />}
          <span className="sidebar-item-name">{node.name}</span>
        </div>
        {isOpen && (
          <div className="tree-children">
            {node.children.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                activeFileId={activeFileId}
                onSelect={onSelect}
                onRemove={onRemove}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`sidebar-item ${activeFileId === node.fileId ? 'sidebar-item-active' : ''}`}
      style={{ paddingLeft: `${12 + depth * 16}px` }}
      onClick={() => node.fileId && onSelect(node.fileId)}
      title={node.path}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' && node.fileId) onSelect(node.fileId); }}
    >
      <FileText size={14} className="sidebar-item-icon" />
      <span className="sidebar-item-name">{node.name}</span>
      <button
        className="sidebar-item-remove"
        onClick={(e) => {
          e.stopPropagation();
          if (node.fileId) onRemove(node.fileId);
        }}
        title="Remove file"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

export function Sidebar({ onFileSelect, className }: { onFileSelect?: () => void; className?: string }) {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const files = useWorkspaceStore((s) => s.files);
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);
  const removeFile = useWorkspaceStore((s) => s.removeFile);
  const collabIsActive = useCollabStore((s) => s.isActive);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId);

  const tree = useMemo(() => buildTree(files), [files]);

  // Check if we have nested paths at all
  const hasNesting = useMemo(() => files.some((f) => f.filename.includes('/')), [files]);

  if (!activeWorkspace) return null;

  return (
    <>
    <aside className={`sidebar ${className || ''}`}>
      <div className="sidebar-header">
        <h2 className="sidebar-title">{activeWorkspace.title}</h2>
        <button
          className={`collab-share-btn ${collabIsActive ? 'collab-sharing' : ''}`}
          onClick={() => setShowShareDialog(true)}
          title={collabIsActive ? 'Sharing — click to manage' : 'Share workspace'}
        >
          <Share2 size={12} />
          {collabIsActive ? 'Sharing' : 'Share'}
        </button>
      </div>
      <nav className="sidebar-nav">
        {hasNesting ? (
          // Nested file tree
          tree.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              activeFileId={activeFileId}
              onSelect={(id) => { setActiveFile(id); onFileSelect?.(); }}
              onRemove={removeFile}
            />
          ))
        ) : (
          // Flat list (no folders)
          files.map((file) => (
            <div
              key={file.id}
              className={`sidebar-item ${activeFileId === file.id ? 'sidebar-item-active' : ''}`}
              onClick={() => { setActiveFile(file.id); onFileSelect?.(); }}
              title={file.filename}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') setActiveFile(file.id); }}
            >
              <FileText size={14} className="sidebar-item-icon" />
              <span className="sidebar-item-name">{file.displayName || file.filename}</span>
              <button
                className="sidebar-item-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(file.id);
                }}
                title="Remove file"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </nav>
    </aside>
    {showShareDialog && <ShareDialog onClose={() => setShowShareDialog(false)} />}
    </>
  );
}
