'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { FileText, Trash2, ChevronRight, ChevronDown, Folder, FolderOpen, Share2, GripVertical, Sun, Moon, Monitor } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useCollabStore } from '@/stores/collab-store';
import { useThemeStore } from '@/stores/theme-store';
import { THEME_PRESETS } from '@/lib/themes/presets';
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
  const reorderFiles = useWorkspaceStore((s) => s.reorderFiles);
  const collabIsActive = useCollabStore((s) => s.isActive);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const { mode, setMode, colorScheme, setColorScheme } = useThemeStore();

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

  const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId);

  const tree = useMemo(() => buildTree(files), [files]);

  // Check if we have nested paths at all
  const hasNesting = useMemo(() => files.some((f) => f.filename.includes('/')), [files]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    // Make the drag ghost slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDragIndex(null);
    setDropIndex(null);
    dragCounter.current = 0;
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  }, []);

  const handleDragEnter = useCallback((index: number) => {
    dragCounter.current++;
    setDropIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      setDropIndex(null);
      dragCounter.current = 0;
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      reorderFiles(fromIndex, toIndex);
    }
    setDragIndex(null);
    setDropIndex(null);
    dragCounter.current = 0;
  }, [reorderFiles]);

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
          // Nested file tree — no drag reorder for tree structure
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
          // Flat list — draggable for reorder
          files.map((file, index) => (
            <div
              key={file.id}
              className={`sidebar-item sidebar-item-draggable ${activeFileId === file.id ? 'sidebar-item-active' : ''} ${dragIndex === index ? 'sidebar-item-dragging' : ''} ${dropIndex === index && dragIndex !== index ? 'sidebar-item-drop-target' : ''}`}
              onClick={() => { setActiveFile(file.id); onFileSelect?.(); }}
              title={file.filename}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') setActiveFile(file.id); }}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragEnter={() => handleDragEnter(index)}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
            >
              <span className="sidebar-drag-handle" onMouseDown={(e) => e.stopPropagation()}>
                <GripVertical size={12} />
              </span>
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
      
      {/* Inline settings (hidden on desktop via css or just acting as footer settings) */}
      <div className="sidebar-mobile-settings mobile-only" style={{ marginTop: 'auto', paddingTop: 20, paddingBottom: 24, borderTop: '1px solid var(--border-muted)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Appearance</span>
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', padding: 4, borderRadius: 8, border: '1px solid var(--border-muted)' }}>
              {['light', 'dark', 'system'].map((m) => {
                const ItemIcon = m === 'dark' ? Moon : m === 'light' ? Sun : Monitor;
                return (
                  <button key={m} onClick={() => setMode(m as any)} style={{ padding: '6px 12px', borderRadius: 4, background: mode === m ? 'var(--bg-hover)' : 'transparent', color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }} title={m}>
                    <ItemIcon size={14} />
                  </button>
                );
              })}
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Theme</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 140 }}>
              {THEME_PRESETS.map((preset) => (
                <button key={preset.id} onClick={() => setColorScheme(preset.id)} style={{ width: 24, height: 24, borderRadius: '50%', background: `linear-gradient(135deg, ${preset.dark['--bg-primary'] || '#0d1117'} 50%, ${preset.dark['--accent-blue'] || '#58a6ff'} 50%)`, border: colorScheme === preset.id ? '2px solid var(--text-primary)' : '2px solid transparent', boxShadow: '0 0 0 1px var(--border-muted)', cursor: 'pointer' }} title={preset.name} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
    {showShareDialog && <ShareDialog onClose={() => setShowShareDialog(false)} />}
    </>
  );
}
