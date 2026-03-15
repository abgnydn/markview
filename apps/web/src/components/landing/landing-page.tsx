'use client';

import React, { useRef, useState } from 'react';
import { Upload, Github, Shield, Zap, Layers, Code2, Eye, Columns2, FileCode2, Presentation as PresentationIcon, Search, Keyboard, BookOpen, FileText, Terminal, Puzzle, Chrome, ArrowLeft } from 'lucide-react';
import './landing.css';

interface LandingPageProps {
  onFilesSelected: (files: { filename: string; content: string }[], title?: string) => void;
  onGitHubImport: (files: { filename: string; content: string }[], title?: string) => void;
  hasExistingWorkspace?: boolean;
  onBackToWorkspace?: () => void;
}

export function LandingPage({ onFilesSelected, onGitHubImport, hasExistingWorkspace, onBackToWorkspace }: LandingPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    const results: { filename: string; content: string }[] = [];
    for (const file of Array.from(fileList)) {
      if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
        const content = await file.text();
        const relativePath = (file as any).webkitRelativePath || file.name;
        results.push({ filename: relativePath, content });
      }
    }
    if (results.length > 0) onFilesSelected(results);
  };

  const handleGitHubImport = async () => {
    if (!githubUrl.trim()) return;
    setIsImporting(true);
    try {
      // Parse GitHub URL to API URL
      const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)(?:\/(.+))?)?/);
      if (!match) { alert('Invalid GitHub URL'); setIsImporting(false); return; }
      const [, owner, repo, branch = 'main', subpath = ''] = match;

      // Security: validate extracted segments contain only safe characters
      const safeSegment = /^[a-zA-Z0-9._-]+$/;
      if (!safeSegment.test(owner) || !safeSegment.test(repo.replace(/\.git$/, ''))) {
        alert('Invalid GitHub owner or repository name.');
        setIsImporting(false);
        return;
      }

      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (!data.tree) { alert('Could not fetch repository'); setIsImporting(false); return; }
      const mdFiles = data.tree.filter((f: any) => {
        const isMarkdown = f.path.endsWith('.md') || f.path.endsWith('.markdown');
        return f.type === 'blob' && isMarkdown && (!subpath || f.path.startsWith(subpath));
      });
      const files = await Promise.all(
        mdFiles.slice(0, 50).map(async (f: any) => {
          const raw = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${f.path}`);
          return { filename: f.path, content: await raw.text() };
        })
      );
      if (files.length > 0) onGitHubImport(files, `${owner}/${repo}`);
    } catch { alert('Failed to import from GitHub'); }
    setIsImporting(false);
  };

  const features = [
    { icon: Eye, title: 'Rich Rendering', desc: 'GitHub-flavored markdown, Mermaid diagrams, KaTeX math, syntax-highlighted code blocks' },
    { icon: Layers, title: 'Workspace Management', desc: 'Multi-tab workspaces with nested file trees, drag to reorder, persistent sessions via IndexedDB' },
    { icon: Search, title: 'Instant Search', desc: 'Full-text search across all documents with keyboard shortcut (⌘K) and highlighted results' },
    { icon: Columns2, title: 'Split & Compare', desc: 'Side-by-side file viewing and unified diff comparison with line-by-line highlighting' },
    { icon: Code2, title: 'Built-in Editor', desc: 'Edit, split, and preview modes with live markdown rendering and ⌘S to save' },
    { icon: PresentationIcon, title: 'Presentation Mode', desc: 'Transform markdown into navigable slides based on headings — instant slide decks' },
    { icon: Keyboard, title: 'Keyboard-First', desc: 'Navigate files, switch workspaces, toggle focus mode, adjust font size — all from the keyboard' },
    { icon: BookOpen, title: 'Reading Experience', desc: 'Table of contents, reading progress, word count, breadcrumbs, frontmatter cards' },
    { icon: FileText, title: 'Export Anything', desc: 'Copy as HTML, rich text, plain text. Export to PDF, standalone HTML, JSON, or Markdown bundle' },
    { icon: Github, title: 'GitHub Import', desc: 'Paste any GitHub repo URL and instantly load its markdown documentation' },
    { icon: Zap, title: 'Focus Mode', desc: 'Distraction-free reading that hides sidebar and TOC — just you and the content' },
    { icon: Puzzle, title: 'PWA & Extension', desc: 'Install as a desktop app or use the Chrome extension for viewing .md files anywhere' },
  ];

  const mcpTools = [
    { name: 'search_docs', desc: 'Full-text search across all markdown files' },
    { name: 'get_document', desc: 'Read any document with metadata' },
    { name: 'get_headings', desc: 'Extract heading structure (TOC)' },
    { name: 'validate_workspace', desc: 'Find broken links & orphan files' },
    { name: 'get_code_blocks', desc: 'Extract code examples by language' },
    { name: 'create_document', desc: 'Generate new documentation' },
    { name: 'get_tables', desc: 'Extract tables as structured JSON' },
    { name: 'rename_document', desc: 'Move files & auto-fix links' },
  ];

  return (
    <div className="landing">
      {/* Back to workspace */}
      {hasExistingWorkspace && onBackToWorkspace && (
        <button className="landing-back-btn" onClick={onBackToWorkspace}>
          <ArrowLeft size={16} />
          Back to workspace
        </button>
      )}
      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-glow" />
        <div className="landing-hero-content">
          <div className="landing-badge">
            <Shield size={14} />
            <span>Zero-account · Privacy-first · Offline-ready</span>
          </div>
          <h1 className="landing-title">
            The markdown viewer
            <br />
            <span className="landing-title-accent">your docs deserve</span>
          </h1>
          <p className="landing-subtitle">
            Beautiful rendering, full-text search, split view, presentation mode,
            built-in editor, and 15 MCP tools for AI assistants.
            <br />
            Your files never leave the browser.
          </p>

          <div className="landing-cta-group">
            <button
              className="landing-cta-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={18} />
              Open Markdown Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.markdown"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button
              className="landing-cta-secondary"
              onClick={() => {
                const folderInput = document.createElement('input');
                folderInput.type = 'file';
                folderInput.setAttribute('webkitdirectory', '');
                folderInput.setAttribute('directory', '');
                folderInput.onchange = async (e) => {
                  const target = e.target as HTMLInputElement;
                  if (!target.files) return;
                  const results: { filename: string; content: string }[] = [];
                  for (const file of Array.from(target.files)) {
                    if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
                      const content = await file.text();
                      results.push({ filename: (file as any).webkitRelativePath || file.name, content });
                    }
                  }
                  if (results.length > 0) onFilesSelected(results);
                };
                folderInput.click();
              }}
            >
              <Layers size={18} />
              Open Folder
            </button>
          </div>

          <div className="landing-github-import">
            <div className="landing-github-input-row">
              <Github size={16} />
              <input
                className="landing-github-input"
                type="text"
                placeholder="github.com/owner/repo — paste a GitHub URL"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGitHubImport()}
              />
              <button
                className="landing-github-btn"
                onClick={handleGitHubImport}
                disabled={isImporting || !githubUrl.trim()}
              >
                {isImporting ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>

        {/* Floating preview window */}
        <div className="landing-preview">
          <div className="landing-preview-chrome">
            <span className="landing-preview-dot" style={{background: '#ff5f57'}} />
            <span className="landing-preview-dot" style={{background: '#febc2e'}} />
            <span className="landing-preview-dot" style={{background: '#28c840'}} />
            <span className="landing-preview-title">MarkView</span>
          </div>
          <div className="landing-preview-body">
            <div className="landing-preview-sidebar">
              <div className="landing-preview-sidebar-item active">📄 README.md</div>
              <div className="landing-preview-sidebar-item">📄 API.md</div>
              <div className="landing-preview-sidebar-item">📁 docs/</div>
              <div className="landing-preview-sidebar-item indent">📄 setup.md</div>
              <div className="landing-preview-sidebar-item indent">📄 auth.md</div>
            </div>
            <div className="landing-preview-content">
              <div className="landing-preview-h1">Getting Started</div>
              <div className="landing-preview-text">Welcome to the project documentation. This guide covers installation, configuration, and usage.</div>
              <div className="landing-preview-h2">Installation</div>
              <div className="landing-preview-code">
                <span className="landing-preview-code-lang">bash</span>
                npm install markview
              </div>
              <div className="landing-preview-h2">Features</div>
              <div className="landing-preview-text">✅ Rich rendering&nbsp; ✅ Full-text search&nbsp; ✅ Offline</div>
            </div>
            <div className="landing-preview-toc">
              <div className="landing-preview-toc-title">ON THIS PAGE</div>
              <div className="landing-preview-toc-item active">Getting Started</div>
              <div className="landing-preview-toc-item">Installation</div>
              <div className="landing-preview-toc-item">Features</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-section">
        <h2 className="landing-section-title">Everything you need</h2>
        <p className="landing-section-subtitle">
          A complete documentation viewing experience — no sign-up, no cloud, no compromise.
        </p>
        <div className="landing-features-grid">
          {features.map((f) => (
            <div className="landing-feature-card" key={f.title}>
              <div className="landing-feature-icon">
                <f.icon size={22} />
              </div>
              <h3 className="landing-feature-title">{f.title}</h3>
              <p className="landing-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MCP */}
      <section className="landing-section landing-mcp-section">
        <div className="landing-mcp-badge">
          <Terminal size={14} />
          <span>Model Context Protocol</span>
        </div>
        <h2 className="landing-section-title">15 MCP tools for AI</h2>
        <p className="landing-section-subtitle">
          Let Claude, Cursor, or any MCP-compatible AI assistant read, search, and manage your documentation.
        </p>
        <div className="landing-mcp-grid">
          {mcpTools.map((t) => (
            <div className="landing-mcp-tool" key={t.name}>
              <code className="landing-mcp-tool-name">{t.name}</code>
              <span className="landing-mcp-tool-desc">{t.desc}</span>
            </div>
          ))}
        </div>
        <div className="landing-mcp-install">
          <span className="landing-mcp-install-label">Add to your AI config:</span>
          <code className="landing-mcp-install-code">node markview/apps/mcp/dist/index.js ./your-docs</code>
        </div>
      </section>

      {/* Privacy + Extension */}
      <section className="landing-section">
        <div className="landing-bottom-grid">
          <div className="landing-privacy-card">
            <Shield size={32} />
            <h3>Your files never leave the browser</h3>
            <p>
              No accounts. No cloud uploads. No telemetry. Everything runs locally
              in IndexedDB. Works offline once loaded.
            </p>
            <div className="landing-privacy-stack">
              <span>🔒 Zero account</span>
              <span>☁️ Zero cloud</span>
              <span>📡 Zero telemetry</span>
              <span>✈️ Works offline</span>
            </div>
          </div>
          <div className="landing-extension-card">
            <Chrome size={32} />
            <h3>Chrome Extension</h3>
            <p>
              View any <code>.md</code> file in the browser with full MarkView rendering.
              Right-click any page to open in MarkView.
            </p>
            <div className="landing-extension-features">
              <span>🎨 Syntax highlighting</span>
              <span>📊 Mermaid diagrams</span>
              <span>🔢 KaTeX math</span>
              <span>📋 Copy as rich text</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>
          <strong>MarkView</strong> — Open source markdown documentation viewer
        </p>
        <p className="landing-footer-sub">
          Built with Next.js · Shiki · Mermaid · KaTeX · MCP
        </p>
      </footer>
    </div>
  );
}
