'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Download,
  ClipboardCopy,
  FileText,
  FileArchive,
  Globe,
  Printer,
  Copy,
  Check,
} from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useThemeStore } from '@/stores/theme-store';
import {
  copyAsMarkdown,
  copyAsHtml,
  downloadMarkdown,
  downloadWorkspaceZip,
  downloadAsHtml,
  printDocument,
} from '@/lib/export/export-utils';

export function ExportMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const activeFileContent = useWorkspaceStore((s) => s.activeFileContent);
  const files = useWorkspaceStore((s) => s.files);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const resolved = useThemeStore((s) => s.resolved);

  const activeFile = files.find((f) => f.id === activeFileId);
  const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId);

  // Close menu on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (msg: string) => {
    setToast(msg);
    setIsOpen(false);
  };

  const handleCopyMarkdown = useCallback(async () => {
    if (!activeFileContent) return;
    await copyAsMarkdown(activeFileContent);
    showToast('Copied as Markdown');
  }, [activeFileContent]);

  const handleCopyHtml = useCallback(async () => {
    if (!activeFileContent) return;
    await copyAsHtml(activeFileContent);
    showToast('Copied as rich HTML');
  }, [activeFileContent]);

  const handleDownloadMd = useCallback(() => {
    if (!activeFile || !activeFileContent) return;
    downloadMarkdown(activeFile.filename, activeFileContent);
    showToast('Downloaded .md');
  }, [activeFile, activeFileContent]);

  const handleDownloadZip = useCallback(async () => {
    if (!activeWorkspaceId || !activeWorkspace) return;
    await downloadWorkspaceZip(activeWorkspaceId, activeWorkspace.title);
    showToast('Downloaded .zip');
  }, [activeWorkspaceId, activeWorkspace]);

  const handleDownloadHtml = useCallback(async () => {
    if (!activeFile || !activeFileContent) return;
    await downloadAsHtml(activeFile.filename, activeFileContent, resolved);
    showToast('Downloaded .html');
  }, [activeFile, activeFileContent, resolved]);

  const handlePrint = useCallback(() => {
    setIsOpen(false);
    // Small delay so menu closes before print dialog
    setTimeout(printDocument, 100);
  }, []);

  if (!activeFile) return null;

  return (
    <div className="export-menu-container" ref={menuRef}>
      <button
        className="toolbar-btn"
        onClick={() => setIsOpen((v) => !v)}
        title="Copy & Export"
      >
        <Download size={18} />
      </button>

      {isOpen && (
        <div className="export-dropdown">
          <div className="export-dropdown-section">
            <div className="export-dropdown-label">Copy</div>
            <button className="export-dropdown-item" onClick={handleCopyMarkdown}>
              <ClipboardCopy size={15} />
              <span>Copy as Markdown</span>
              <kbd className="export-kbd">Raw</kbd>
            </button>
            <button className="export-dropdown-item" onClick={handleCopyHtml}>
              <Copy size={15} />
              <span>Copy as HTML</span>
              <kbd className="export-kbd">Rich</kbd>
            </button>
          </div>

          <div className="export-dropdown-divider" />

          <div className="export-dropdown-section">
            <div className="export-dropdown-label">Export</div>
            <button className="export-dropdown-item" onClick={handleDownloadMd}>
              <FileText size={15} />
              <span>Download .md</span>
            </button>
            <button className="export-dropdown-item" onClick={handleDownloadZip}>
              <FileArchive size={15} />
              <span>Download workspace .zip</span>
              <span className="export-badge">{activeWorkspace?.fileCount} files</span>
            </button>
            <button className="export-dropdown-item" onClick={handleDownloadHtml}>
              <Globe size={15} />
              <span>Download as HTML</span>
              <kbd className="export-kbd">Styled</kbd>
            </button>
          </div>

          <div className="export-dropdown-divider" />

          <button className="export-dropdown-item" onClick={handlePrint}>
            <Printer size={15} />
            <span>Print / Save as PDF</span>
            <kbd className="export-kbd">⌘P</kbd>
          </button>
        </div>
      )}

      {toast && (
        <div className="export-toast">
          <Check size={14} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
