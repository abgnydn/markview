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
  Image,
  FileSpreadsheet,
  Presentation,
  FileCode,
  LayoutDashboard,
  Link2,
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
  const [loading, setLoading] = useState<string | null>(null);
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
    setLoading(null);
    setIsOpen(false);
  };

  const withLoading = useCallback(
    (label: string, fn: () => Promise<void>) => {
      return async () => {
        setLoading(label);
        try {
          await fn();
          showToast(label);
        } catch (e) {
          console.error(`Export error (${label}):`, e);
          showToast(`Failed: ${label}`);
        }
      };
    },
    []
  );

  // ── Copy handlers ───────────────────────────────────────────────────
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

  const handleCopyImage = useCallback(
    withLoading('Copied as Image', async () => {
      const { copyAsImage } = await import('@/lib/export/export-image');
      await copyAsImage();
    }),
    []
  );

  // ── Download handlers ───────────────────────────────────────────────
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

  const handleDownloadPdf = useCallback(
    withLoading('Downloaded PDF', async () => {
      if (!activeFile || !activeFileContent) return;
      const { downloadAsPdf } = await import('@/lib/export/export-pdf');
      await downloadAsPdf(activeFile.filename, activeFileContent, resolved);
    }),
    [activeFile, activeFileContent, resolved]
  );

  const handleDownloadDocx = useCallback(
    withLoading('Downloaded .docx', async () => {
      if (!activeFile || !activeFileContent) return;
      const { downloadAsDocx } = await import('@/lib/export/export-docx');
      await downloadAsDocx(activeFile.filename, activeFileContent);
    }),
    [activeFile, activeFileContent]
  );

  const handleDownloadPptx = useCallback(
    withLoading('Downloaded .pptx', async () => {
      if (!activeFile || !activeFileContent) return;
      const { downloadAsPptx } = await import('@/lib/export/export-pptx');
      await downloadAsPptx(activeFile.filename, activeFileContent, resolved);
    }),
    [activeFile, activeFileContent, resolved]
  );

  const handleDownloadPng = useCallback(
    withLoading('Downloaded .png', async () => {
      if (!activeFile) return;
      const { downloadAsImage } = await import('@/lib/export/export-image');
      await downloadAsImage(activeFile.filename, 'png');
    }),
    [activeFile]
  );

  const handleDownloadSvg = useCallback(
    withLoading('Downloaded .svg', async () => {
      if (!activeFile) return;
      const { downloadAsImage } = await import('@/lib/export/export-image');
      await downloadAsImage(activeFile.filename, 'svg');
    }),
    [activeFile]
  );

  // ── Convert handlers ────────────────────────────────────────────────
  const handleDownloadRst = useCallback(() => {
    if (!activeFile || !activeFileContent) return;
    import('@/lib/export/export-convert').then(({ downloadAsRst }) => {
      downloadAsRst(activeFile.filename, activeFileContent);
      showToast('Downloaded .rst');
    });
  }, [activeFile, activeFileContent]);

  const handleDownloadAdoc = useCallback(() => {
    if (!activeFile || !activeFileContent) return;
    import('@/lib/export/export-convert').then(({ downloadAsAsciidoc }) => {
      downloadAsAsciidoc(activeFile.filename, activeFileContent);
      showToast('Downloaded .adoc');
    });
  }, [activeFile, activeFileContent]);

  // ── Workspace handlers ──────────────────────────────────────────────
  const handleDownloadSite = useCallback(
    withLoading('Downloaded static site', async () => {
      if (!activeWorkspaceId || !activeWorkspace) return;
      const { downloadAsStaticSite } = await import('@/lib/export/export-site');
      await downloadAsStaticSite(activeWorkspaceId, activeWorkspace.title, resolved);
    }),
    [activeWorkspaceId, activeWorkspace, resolved]
  );

  const handlePrint = useCallback(() => {
    setIsOpen(false);
    setTimeout(printDocument, 100);
  }, []);

  const handleShareUrl = useCallback(async () => {
    if (!activeFileContent) return;
    const { encodeMarkdownUrl, MAX_SHAREABLE_LENGTH } = await import('@/lib/sharing/url-share');
    if (activeFileContent.length > MAX_SHAREABLE_LENGTH) {
      showToast('File too large for URL sharing');
      return;
    }
    const url = await encodeMarkdownUrl(activeFileContent, activeFile?.displayName || activeFile?.filename);
    await navigator.clipboard.writeText(url);
    showToast('Share URL copied!');
  }, [activeFileContent, activeFile]);

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
          {/* Copy */}
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
            <button className="export-dropdown-item" onClick={handleCopyImage}>
              <Image size={15} />
              <span>Copy as Image</span>
              <kbd className="export-kbd">PNG</kbd>
            </button>
          </div>

          <div className="export-dropdown-divider" />

          {/* Export */}
          <div className="export-dropdown-section">
            <div className="export-dropdown-label">Export</div>
            <button className="export-dropdown-item" onClick={handleDownloadMd}>
              <FileText size={15} />
              <span>Download .md</span>
            </button>
            <button className="export-dropdown-item" onClick={handleDownloadHtml}>
              <Globe size={15} />
              <span>Download as HTML</span>
              <kbd className="export-kbd">Styled</kbd>
            </button>
            <button className="export-dropdown-item" onClick={handleDownloadPdf}>
              <FileText size={15} />
              <span>Download as PDF</span>
              {loading === 'Downloaded PDF' && <span className="export-spinner" />}
            </button>
            <button className="export-dropdown-item" onClick={handleDownloadDocx}>
              <FileSpreadsheet size={15} />
              <span>Download as Word</span>
              <kbd className="export-kbd">.docx</kbd>
            </button>
            <button className="export-dropdown-item" onClick={handleDownloadPptx}>
              <Presentation size={15} />
              <span>Download as PowerPoint</span>
              <kbd className="export-kbd">.pptx</kbd>
            </button>
            <button className="export-dropdown-item" onClick={handleDownloadPng}>
              <Image size={15} />
              <span>Download as PNG</span>
            </button>
            <button className="export-dropdown-item" onClick={handleDownloadSvg}>
              <Image size={15} />
              <span>Download as SVG</span>
            </button>
          </div>

          <div className="export-dropdown-divider" />

          {/* Convert */}
          <div className="export-dropdown-section">
            <div className="export-dropdown-label">Convert</div>
            <button className="export-dropdown-item" onClick={handleDownloadRst}>
              <FileCode size={15} />
              <span>Download as RST</span>
              <kbd className="export-kbd">reStructuredText</kbd>
            </button>
            <button className="export-dropdown-item" onClick={handleDownloadAdoc}>
              <FileCode size={15} />
              <span>Download as AsciiDoc</span>
              <kbd className="export-kbd">.adoc</kbd>
            </button>
          </div>

          <div className="export-dropdown-divider" />

          {/* Workspace */}
          <div className="export-dropdown-section">
            <div className="export-dropdown-label">Workspace</div>
            <button className="export-dropdown-item" onClick={handleDownloadZip}>
              <FileArchive size={15} />
              <span>Download .zip</span>
              <span className="export-badge">{activeWorkspace?.fileCount} files</span>
            </button>
            <button className="export-dropdown-item" onClick={handleDownloadSite}>
              <LayoutDashboard size={15} />
              <span>Export as Static Site</span>
              <kbd className="export-kbd">HTML + Nav</kbd>
            </button>
          </div>

          <div className="export-dropdown-divider" />

          <button className="export-dropdown-item" onClick={handlePrint}>
            <Printer size={15} />
            <span>Print / Save as PDF</span>
            <kbd className="export-kbd">⌘P</kbd>
          </button>

          <div className="export-dropdown-divider" />

          {/* Share */}
          <button className="export-dropdown-item" onClick={handleShareUrl}>
            <Link2 size={15} />
            <span>Share as URL</span>
            <kbd className="export-kbd">Link</kbd>
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
