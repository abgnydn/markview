'use client';

import React, { useCallback, useState, useRef } from 'react';
import { Upload, FolderOpen, FileText, Clock } from 'lucide-react';
import { GitHubImport } from './github-import';
import { useWorkspaceStore, type WorkspaceMeta } from '@/stores/workspace-store';

interface FileUploadProps {
  onFilesSelected: (files: { filename: string; content: string }[]) => void;
  onGitHubImport?: (files: { filename: string; content: string }[], title: string) => void;
  recentWorkspaces?: WorkspaceMeta[];
}

export function FileUpload({ onFilesSelected, onGitHubImport, recentWorkspaces }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files: { filename: string; content: string }[] = [];
      const items = Array.from(fileList);

      for (const file of items) {
        if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
          const content = await file.text();
          // Preserve relative path for folder structure, strip top-level folder name
          const rawPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
          const parts = rawPath.split('/');
          // Remove top-level folder name (e.g., "my-docs/api/auth.md" → "api/auth.md")
          const filename = parts.length > 1 ? parts.slice(1).join('/') : file.name;
          files.push({ filename, content });
        }
      }

      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [onFilesSelected]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const items = e.dataTransfer.items;
      const allFiles: File[] = [];

      if (items) {
        const entries: FileSystemEntry[] = [];
        for (let i = 0; i < items.length; i++) {
          const entry = items[i].webkitGetAsEntry?.();
          if (entry) entries.push(entry);
        }

        const readEntry = async (entry: FileSystemEntry): Promise<File[]> => {
          if (entry.isFile) {
            return new Promise((resolve) => {
              (entry as FileSystemFileEntry).file((f) => resolve([f]));
            });
          } else if (entry.isDirectory) {
            const dirReader = (entry as FileSystemDirectoryEntry).createReader();
            const entries = await new Promise<FileSystemEntry[]>((resolve) => {
              dirReader.readEntries((e) => resolve(e));
            });
            const nested = await Promise.all(entries.map(readEntry));
            return nested.flat();
          }
          return [];
        };

        for (const entry of entries) {
          const files = await readEntry(entry);
          allFiles.push(...files);
        }
      } else {
        allFiles.push(...Array.from(e.dataTransfer.files));
      }

      processFiles(allFiles);
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="upload-container">
      <div className="upload-hero">
        <div className="upload-logo">
          <img src="/icon-192.png" alt="MarkView Logo" className="upload-logo-icon" style={{ width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px', display: 'block' }} />
          <h1 className="upload-title">MarkView</h1>
          <p className="upload-subtitle">
            High-performance markdown rendering stack & offline viewer
          </p>
        </div>

        <div
          className={`upload-dropzone ${isDragging ? 'upload-dropzone-active' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload className="upload-icon" size={48} strokeWidth={1.5} />
          <p className="upload-dropzone-text">
            Drop your markdown files or folders here
          </p>
          <p className="upload-dropzone-hint">
            Supports <code>.md</code> files — everything stays in your browser
          </p>
          <div className="upload-buttons">
            <button
              className="upload-btn upload-btn-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText size={18} />
              Choose Files
            </button>
            <button
              className="upload-btn upload-btn-secondary"
              onClick={() => folderInputRef.current?.click()}
            >
              <FolderOpen size={18} />
              Choose Folder
            </button>
          </div>
        </div>

        {/* GitHub import */}
        {onGitHubImport && (
          <div className="upload-section">
            <h3 className="upload-section-title">Import from GitHub</h3>
            <GitHubImport onFilesLoaded={onGitHubImport} />
          </div>
        )}

        {/* Recent workspaces */}
        {recentWorkspaces && recentWorkspaces.length > 0 && (
          <div className="upload-section">
            <h3 className="upload-section-title">Recent Workspaces</h3>
            <div className="recent-workspaces">
              {recentWorkspaces.slice(0, 5).map((ws) => (
                <button
                  key={ws.id}
                  className="recent-workspace-card"
                  onClick={() => {
                    // Re-open by switching to this workspace
                    useWorkspaceStore.getState().switchWorkspace(ws.id);
                  }}
                >
                  <div className="recent-workspace-info">
                    <span className="recent-workspace-title">{ws.title}</span>
                    <span className="recent-workspace-meta">
                      {ws.fileCount} files
                      <span className="recent-workspace-dot">·</span>
                      <Clock size={11} />
                      {formatDate(ws.updatedAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="upload-features">
          {[
            { icon: '🔒', title: 'Privacy First', desc: 'Files never leave your browser' },
            { icon: '📊', title: 'Mermaid Diagrams', desc: 'Full diagram support' },
            { icon: '🎨', title: 'Beautiful Rendering', desc: 'GitHub-quality markdown' },
            { icon: '🔍', title: 'Full-text Search', desc: 'Search across all docs' },
            { icon: '🔗', title: 'Inter-doc Links', desc: 'Navigate between .md files' },
            { icon: '⌨️', title: 'Keyboard Nav', desc: '↑↓ files, / search, ⌘K' },
          ].map((feature) => (
            <div key={feature.title} className="upload-feature-card">
              <span className="upload-feature-icon">{feature.icon}</span>
              <h3 className="upload-feature-title">{feature.title}</h3>
              <p className="upload-feature-desc">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && processFiles(e.target.files)}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is not in standard types
        webkitdirectory=""
        className="hidden"
        onChange={(e) => e.target.files && processFiles(e.target.files)}
      />
    </div>
  );
}
