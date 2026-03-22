'use client';

import React, { useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { Upload, Github, Shield, Zap, Layers, Code2, Eye, Columns2, FileCode2, Presentation as PresentationIcon, Search, Keyboard, BookOpen, FileText, Terminal, Puzzle, Chrome, ArrowLeft, Trash2, Package, Check, Copy, Mail, LayoutTemplate, Palette, Link2, Type, MessageSquarePlus, History, Plug, Monitor, Users } from 'lucide-react';
import { WORKSPACE_TEMPLATES } from '@/lib/templates/workspace-templates';
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
  const [copiedPkg, setCopiedPkg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleCopy = (pkg: string, cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedPkg(pkg);
    setTimeout(() => setCopiedPkg(null), 2000);
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    const results: { filename: string; content: string }[] = [];
    for (const file of Array.from(droppedFiles)) {
      if (file.name.match(/\.(md|markdown)$/i)) {
        const content = await file.text();
        results.push({ filename: file.name, content });
      }
    }
    if (results.length > 0) {
      onFilesSelected(results);
    }
  }, [onFilesSelected]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    // Check for .zip files first
    const zipFile = Array.from(fileList).find((f) => f.name.endsWith('.zip'));
    if (zipFile) {
      try {
        const { importWorkspaceZip } = await import('@/lib/import/import-zip');
        const { title, files } = await importWorkspaceZip(zipFile);
        onFilesSelected(files, title);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to import ZIP');
      }
      return;
    }

    const results: { filename: string; content: string }[] = [];
    for (const file of Array.from(fileList)) {
      if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
        const content = await file.text();
        const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
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
      const mdFiles = data.tree.filter((f: { path: string; type: string }) => {
        const isMarkdown = f.path.endsWith('.md') || f.path.endsWith('.markdown');
        return f.type === 'blob' && isMarkdown && (!subpath || f.path.startsWith(subpath));
      });
      const files = await Promise.all(
        mdFiles.slice(0, 50).map(async (f: { path: string }) => {
          const raw = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${f.path}`);
          return { filename: f.path, content: await raw.text() };
        })
      );
      if (files.length > 0) onGitHubImport(files, `${owner}/${repo}`);
    } catch { alert('Failed to import from GitHub'); }
    setIsImporting(false);
  };

  const features = [
    { icon: Eye, title: 'Rich Rendering', desc: 'GitHub-flavored markdown, Mermaid diagrams, KaTeX math, syntax-highlighted code blocks', color: 'purple' },
    { icon: Layers, title: 'Workspace Management', desc: 'Multi-tab workspaces with nested file trees, drag to reorder, persistent sessions via IndexedDB', color: 'blue' },
    { icon: Search, title: 'Instant Search', desc: 'Full-text search across all documents with keyboard shortcut (⌘K) and highlighted results', color: 'amber' },
    { icon: Columns2, title: 'Split & Compare', desc: 'Side-by-side file viewing and unified diff comparison with line-by-line highlighting', color: 'blue' },
    { icon: Type, title: 'WYSIWYG Editor', desc: '13 formatting buttons (bold, italic, headings, lists, links), ⌘B/⌘I/⌘K shortcuts, Tab indent', color: 'emerald' },
    { icon: PresentationIcon, title: 'Presentation Mode', desc: 'Transform markdown into navigable slides based on headings — instant slide decks', color: 'purple' },
    { icon: Palette, title: 'Custom Themes', desc: '6 curated presets — Dracula, Nord, Monokai, Solarized, Rosé Pine, GitHub — with dark/light variants', color: 'rose' },
    { icon: Link2, title: 'URL Sharing', desc: 'Share any workspace via URL — content is gzip-compressed and base64-encoded in the hash, zero server needed', color: 'emerald' },
    { icon: LayoutTemplate, title: 'Starter Templates', desc: '6 pre-built templates — README, API Docs, Changelog, Meeting Notes, Tech Spec, Blog Post', color: 'amber' },
    { icon: MessageSquarePlus, title: 'Annotations', desc: 'Highlight text, pick a color, add notes — annotations are persisted per file and shown in a panel', color: 'rose' },
    { icon: Plug, title: 'Plugin System', desc: 'Extend rendering with custom code fences — built-in: alert boxes, bar charts, tabs, timelines, embeds', color: 'purple' },
    { icon: History, title: 'Version History', desc: 'Auto-snapshots on editor save, stored in IndexedDB — browse, restore, or delete any previous version', color: 'blue' },
    { icon: BookOpen, title: 'Reading Experience', desc: 'Table of contents, reading progress, word count, breadcrumbs, frontmatter cards', color: 'emerald' },
    { icon: Users, title: 'P2P Collaboration', desc: 'Real-time multiplayer editing using WebRTC — collaborate seamlessly via a direct local connection, zero servers required', color: 'indigo' },
    { icon: FileText, title: 'Export Everywhere', desc: 'PDF, Microsoft Word (.docx), PowerPoint (.pptx), PNG, HTML — generate presentation-ready files directly from the browser', color: 'amber' },
    { icon: Github, title: 'GitHub Import', desc: 'Paste any GitHub repo URL and instantly load its markdown documentation', color: 'indigo' },
    { icon: Keyboard, title: 'Keyboard-First', desc: 'Navigate files, switch workspaces, toggle focus mode, adjust font size — all from the keyboard', color: 'blue' },
    { icon: Zap, title: 'Focus Mode', desc: 'Distraction-free reading that hides sidebar and TOC — just you and the content', color: 'rose' },
    { icon: Puzzle, title: 'Native macOS App', desc: 'Native Tauri v2 desktop app — set as your default .md opener, ships as a proper .app + .dmg bundle', color: 'indigo' },
    { icon: Chrome, title: 'PWA & Extension', desc: 'Install as a PWA from Chrome/Edge or use the Chrome extension to view .md files in the browser', color: 'amber' },
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
    <div
      className="landing"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="landing-drop-overlay">
          <div className="landing-drop-content">
            <Upload size={48} className="landing-drop-icon" />
            <h2 className="landing-drop-title">Drop your .md files here</h2>
            <p className="landing-drop-subtitle">Release to instantly render your markdown — no upload, no server, fully private</p>
          </div>
        </div>
      )}
      {/* Sticky Nav Bar */}
      <nav className="landing-navbar">
        <div className="landing-navbar-inner">
          <div className="landing-navbar-brand">
            <img src="/icon-192.png" alt="MarkView" className="landing-navbar-logo" />
            <span className="landing-navbar-name">MarkView</span>
          </div>
          <div className="landing-navbar-links">
            <a href="#features" className="landing-navbar-link">Features</a>
            <a href="#pricing" className="landing-navbar-link">Pricing</a>
            <Link href="/docs" className="landing-navbar-link">Docs</Link>
            <a href="https://github.com/abgnydn/markview" target="_blank" rel="noopener noreferrer" className="landing-navbar-github">
              <Github size={16} />
              <span>GitHub</span>
            </a>
            {hasExistingWorkspace && onBackToWorkspace && (
              <button className="landing-navbar-workspace-btn" onClick={onBackToWorkspace}>
                <Monitor size={14} />
                <span>Workspace</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      {/* spacer for fixed navbar */}
      <div style={{ height: 64 }} />
      <section className="landing-hero">
        <div className="landing-hero-glow" />
        <div className="landing-hero-content">
          <img 
            src="/icon-192.png" 
            alt="MarkView App Icon" 
            style={{ 
              width: 88, 
              height: 88, 
              borderRadius: 22, 
              margin: '0 auto 32px auto', 
              display: 'block', 
              boxShadow: '0 12px 32px rgba(88, 166, 255, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05)' 
            }} 
          />
          <div className="landing-badge">
            <Shield size={14} />
            <span>Zero-account · Privacy-first · Native macOS app · Offline-ready</span>
          </div>
          <h1 className="landing-title">
            The embeddable Markdown
            <br />
            <span className="landing-title-accent">rendering stack</span>
          </h1>
          <p className="landing-subtitle">
            A high-performance markdown engine available as a React SDK, Web Component, and native macOS App. Built with Shiki, Mermaid, KaTeX, and MCP for AI assistants.
            <br />
            Private, offline, and ready to embed.
          </p>

          <div className="landing-cta-group">
            <button
              className="landing-cta-primary"
              onClick={async () => {
                const demoFiles = ['welcome.md', 'architecture.md', 'api-reference.md'];
                try {
                  const files = await Promise.all(
                    demoFiles.map(async (name) => {
                      const res = await fetch(`/demo/${name}`);
                      const content = await res.text();
                      return { filename: name, content };
                    })
                  );
                  onGitHubImport(files, 'MarkView Demo');
                } catch {
                  alert('Failed to load demo files');
                }
              }}
            >
              <Eye size={18} />
              Try the Demo
            </button>
            <a
              className="landing-cta-secondary"
              href="https://github.com/abgnydn/markview#-quick-start"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
            >
              <Monitor size={18} />
              Download for macOS
            </a>
          </div>

          <div className="landing-cta-secondary-row">
            <button
              className="landing-cta-subtle"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} />
              Open Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.markdown,.zip"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button
              className="landing-cta-subtle"
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
                      results.push({ filename: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name, content });
                    }
                  }
                  if (results.length > 0) onFilesSelected(results);
                };
                folderInput.click();
              }}
            >
              <Layers size={16} />
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

          {/* Template picker */}
          <div className="landing-templates">
            <div className="landing-templates-label">
              <LayoutTemplate size={14} />
              Or start from a template
            </div>
            <div className="landing-templates-grid">
              {WORKSPACE_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  className="landing-template-card"
                  onClick={() => onFilesSelected(tpl.files, tpl.name)}
                >
                  <span className="landing-template-emoji">{tpl.emoji}</span>
                  <span className="landing-template-name">{tpl.name}</span>
                </button>
              ))}
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
          <div className="landing-preview-body" style={{ padding: 0, overflow: 'hidden' }}>
            <img 
              src="/landing-screenshot.png" 
              alt="MarkView App Interface" 
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} 
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="landing-section">
        <h2 className="landing-section-title">Everything you need</h2>
        <p className="landing-section-subtitle">
          A complete documentation viewing experience — no sign-up, no cloud, no compromise.
        </p>
        <div className="landing-features-grid">
          {features.map((f) => (
            <div className={`landing-feature-card landing-feature-${f.color}`} key={f.title}>
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

      {/* npm Packages */}
      <section className="landing-section landing-npm-section">
        <div className="landing-npm-badge">
          <Package size={14} />
          <span>npm packages</span>
        </div>
        <h2 className="landing-section-title">Use anywhere, install nothing</h2>
        <p className="landing-section-subtitle">
          4 packages for every use case — rendering, components, AI tools.
          Pick the one that fits your stack.
        </p>
        <div className="landing-npm-packages landing-npm-packages-4">
          <div className="landing-npm-pkg-card">
            <div className="landing-npm-pkg-name">@markview/core</div>
            <div className="landing-npm-pkg-desc">Framework-agnostic engine</div>
            <div className="landing-npm-install-box">
              <code className="landing-npm-cmd">npm i @markview/core</code>
              <button className="landing-npm-copy-btn" onClick={() => handleCopy('core', 'npm i @markview/core')} title="Copy command" aria-label="Copy to clipboard">
                {copiedPkg === 'core' ? <Check size={14} className="landing-npm-copied-icon" /> : <Copy size={14} />}
              </button>
            </div>
            <pre className="landing-npm-code-content">
{`import { renderMarkdown }
  from '@markview/core';

const html = await
  renderMarkdown(md);`}
            </pre>
            <a href="https://www.npmjs.com/package/@markview/core" target="_blank" rel="noopener noreferrer" className="landing-npm-pkg-link">View on npm →</a>
          </div>
          <div className="landing-npm-pkg-card landing-npm-pkg-featured">
            <div className="landing-npm-pkg-label">Most Popular</div>
            <div className="landing-npm-pkg-name">@markview/react</div>
            <div className="landing-npm-pkg-desc">Drop-in React component</div>
            <div className="landing-npm-install-box">
              <code className="landing-npm-cmd">npm i @markview/react</code>
              <button className="landing-npm-copy-btn" onClick={() => handleCopy('react', 'npm i @markview/react')} title="Copy command" aria-label="Copy to clipboard">
                {copiedPkg === 'react' ? <Check size={14} className="landing-npm-copied-icon" /> : <Copy size={14} />}
              </button>
            </div>
            <pre className="landing-npm-code-content">
{`import { MarkView }
  from '@markview/react';

<MarkView content={md}
  theme="dark" shiki />`}
            </pre>
            <a href="https://www.npmjs.com/package/@markview/react" target="_blank" rel="noopener noreferrer" className="landing-npm-pkg-link">View on npm →</a>
          </div>
          <div className="landing-npm-pkg-card">
            <div className="landing-npm-pkg-name">@markview/webcomponent</div>
            <div className="landing-npm-pkg-desc">Vue · Angular · Svelte · HTML</div>
            <div className="landing-npm-install-box">
              <code className="landing-npm-cmd">npm i @markview/webcomponent</code>
              <button className="landing-npm-copy-btn" onClick={() => handleCopy('webcomponent', 'npm i @markview/webcomponent')} title="Copy command" aria-label="Copy to clipboard">
                {copiedPkg === 'webcomponent' ? <Check size={14} className="landing-npm-copied-icon" /> : <Copy size={14} />}
              </button>
            </div>
            <pre className="landing-npm-code-content">
{`import
  '@markview/webcomponent';

<mark-view content="# Hi"
  theme="dark" shiki />`}
            </pre>
            <a href="https://www.npmjs.com/package/@markview/webcomponent" target="_blank" rel="noopener noreferrer" className="landing-npm-pkg-link">View on npm →</a>
          </div>
          <div className="landing-npm-pkg-card landing-npm-pkg-mcp">
            <div className="landing-npm-pkg-label-green">AI Ready</div>
            <div className="landing-npm-pkg-name">@markview/mcp</div>
            <div className="landing-npm-pkg-desc">MCP server for AI assistants</div>
            <div className="landing-npm-install-box">
              <code className="landing-npm-cmd">npx markview-mcp ./docs</code>
              <button className="landing-npm-copy-btn" onClick={() => handleCopy('mcp', 'npx markview-mcp ./docs')} title="Copy command" aria-label="Copy to clipboard">
                {copiedPkg === 'mcp' ? <Check size={14} className="landing-npm-copied-icon" /> : <Copy size={14} />}
              </button>
            </div>
            <pre className="landing-npm-code-content">
{`// 15 tools for Claude,
// Cursor, and any
// MCP-compatible client
// Zero config needed`}
            </pre>
            <a href="https://www.npmjs.com/package/@markview/mcp" target="_blank" rel="noopener noreferrer" className="landing-npm-pkg-link">View on npm →</a>
          </div>
        </div>
        <div className="landing-npm-features">
          <div className="landing-npm-feature"><Check size={14} /> Shiki syntax highlighting (140+ languages)</div>
          <div className="landing-npm-feature"><Check size={14} /> Mermaid diagrams</div>
          <div className="landing-npm-feature"><Check size={14} /> KaTeX math equations</div>
          <div className="landing-npm-feature"><Check size={14} /> GitHub-style alerts</div>
          <div className="landing-npm-feature"><Check size={14} /> XSS sanitization</div>
          <div className="landing-npm-feature"><Check size={14} /> 15 MCP tools for AI</div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="landing-section">
        <h2 className="landing-section-title">Simple pricing</h2>
        <p className="landing-section-subtitle">
          Two ways to use MarkView — embed the SDK in your product, or get the desktop app.
        </p>

        {/* SDK / Component Licensing */}
        <div className="landing-pricing-channel-label">
          <Code2 size={14} />
          <span>For Developers — SDK &amp; Component Licensing</span>
        </div>
        <div className="landing-pricing-grid">
          <div className="landing-pricing-card">
            <div className="landing-pricing-name">Open Source</div>
            <div className="landing-pricing-price">Free</div>
            <div className="landing-pricing-period">AGPL-3.0 license</div>
            <ul className="landing-pricing-features">
              <li><Check size={14} /> Full rendering engine</li>
              <li><Check size={14} /> All features included</li>
              <li><Check size={14} /> Community support</li>
              <li><Check size={14} /> Must open-source your app</li>
            </ul>
            <a className="landing-pricing-btn landing-pricing-btn-secondary" href="https://github.com/abgnydn/markview" target="_blank" rel="noopener noreferrer">
              View on GitHub
            </a>
          </div>
          <div className="landing-pricing-card landing-pricing-featured">
            <div className="landing-pricing-popular">Most Popular</div>
            <div className="landing-pricing-name">Indie</div>
            <div className="landing-pricing-price">$149<span>/year</span></div>
            <div className="landing-pricing-period">1 developer, 3 projects</div>
            <ul className="landing-pricing-features">
              <li><Check size={14} /> Use in proprietary apps</li>
              <li><Check size={14} /> No AGPL obligations</li>
              <li><Check size={14} /> All future updates</li>
              <li><Check size={14} /> Email support</li>
            </ul>
            <a className="landing-pricing-btn landing-pricing-btn-primary" href="mailto:abgunaydin94@gmail.com?subject=MarkView%20Indie%20License">
              <Mail size={14} /> Get License
            </a>
          </div>
          <div className="landing-pricing-card">
            <div className="landing-pricing-name">Business</div>
            <div className="landing-pricing-price">$499<span>/year</span></div>
            <div className="landing-pricing-period">Up to 15 developers</div>
            <ul className="landing-pricing-features">
              <li><Check size={14} /> Unlimited projects</li>
              <li><Check size={14} /> No AGPL obligations</li>
              <li><Check size={14} /> All future updates</li>
              <li><Check size={14} /> Priority support</li>
            </ul>
            <a className="landing-pricing-btn landing-pricing-btn-secondary" href="mailto:abgunaydin94@gmail.com?subject=MarkView%20Business%20License">
              <Mail size={14} /> Contact Us
            </a>
          </div>
          <div className="landing-pricing-card">
            <div className="landing-pricing-name">Enterprise</div>
            <div className="landing-pricing-price">Custom</div>
            <div className="landing-pricing-period">Unlimited developers</div>
            <ul className="landing-pricing-features">
              <li><Check size={14} /> Everything in Business</li>
              <li><Check size={14} /> Dedicated support &amp; SLA</li>
              <li><Check size={14} /> Custom integrations</li>
              <li><Check size={14} /> Legal review &amp; invoicing</li>
            </ul>
            <a className="landing-pricing-btn landing-pricing-btn-secondary" href="mailto:abgunaydin94@gmail.com?subject=MarkView%20Enterprise%20License">
              <Mail size={14} /> Contact Sales
            </a>
          </div>
        </div>

        {/* Desktop App */}
        <div className="landing-pricing-channel-label landing-pricing-channel-label-app">
          <Monitor size={14} />
          <span>Desktop App — Mac App Store</span>
        </div>
        <div className="landing-pricing-app-row">
          <div className="landing-pricing-app-card">
            <div className="landing-pricing-app-left">
              <div className="landing-pricing-app-icon" style={{ display: 'flex', alignItems: 'center' }}>
                <img 
                  src="/icon-192.png" 
                  alt="MarkView macOS App" 
                  style={{ width: 44, height: 44, borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.05)' }} 
                />
              </div>
              <div>
                <div className="landing-pricing-app-name">MarkView for Mac</div>
                <div className="landing-pricing-app-desc">
                  Native Tauri v2 app — set as your default .md opener. Fast, private, offline.
                </div>
              </div>
            </div>
            <div className="landing-pricing-app-right">
              <div className="landing-pricing-app-price">$14.99</div>
              <div className="landing-pricing-app-note">One-time purchase</div>
              <a className="landing-pricing-btn landing-pricing-btn-primary" href="https://github.com/abgnydn/markview#-quick-start" target="_blank" rel="noopener noreferrer">
                <Monitor size={14} /> Setup Instructions
              </a>
              <div className="landing-pricing-app-store-note">🍎 Coming soon on the Mac App Store</div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="landing-pricing-faq">
          <h3 className="landing-pricing-faq-title">Frequently asked questions</h3>
          <div className="landing-pricing-faq-grid">
            <div className="landing-pricing-faq-item">
              <div className="landing-pricing-faq-q">Can I use MarkView for free in an open-source project?</div>
              <div className="landing-pricing-faq-a">Yes! If your project is open-source under an AGPL-compatible license, you can use it freely.</div>
            </div>
            <div className="landing-pricing-faq-item">
              <div className="landing-pricing-faq-q">Can I evaluate before purchasing?</div>
              <div className="landing-pricing-faq-a">Absolutely. Use the AGPL version for development and testing. You only need a commercial license when you deploy to production in a closed-source application.</div>
            </div>
            <div className="landing-pricing-faq-item">
              <div className="landing-pricing-faq-q">What if I&apos;m building an internal tool?</div>
              <div className="landing-pricing-faq-a">Internal tools not distributed to external users may not trigger AGPL obligations, but we recommend a commercial license for clarity.</div>
            </div>
            <div className="landing-pricing-faq-item">
              <div className="landing-pricing-faq-q">Is the desktop app the same as the web app?</div>
              <div className="landing-pricing-faq-a">Yes — the desktop app wraps the full MarkView experience in a native macOS shell. It can be set as your default .md file opener.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <img 
          src="/icon-192.png" 
          alt="MarkView Logo" 
          style={{ width: 44, height: 44, borderRadius: 10, margin: '0 auto 20px auto', display: 'block', opacity: 0.9 }} 
        />
        <p>
          <strong>MarkView</strong> — Open source markdown documentation viewer
        </p>
        <p className="landing-footer-sub">
          Built with Next.js · WebRTC (Yjs) · Shiki · Mermaid · KaTeX · MCP
        </p>
        <p className="landing-footer-links">
          <a href="/pricing" className="text-[var(--accent-blue)]">Pricing</a>
          <span>·</span>
          <a href="/docs" className="text-[var(--accent-blue)]">Documentation</a>
          <span>·</span>
          <a href="https://www.npmjs.com/package/@markview/core" target="_blank" rel="noopener noreferrer">npm</a>
          <span>·</span>
          <a href="https://github.com/abgnydn/markview" target="_blank" rel="noopener noreferrer">GitHub</a>
          <span>·</span>
          <a href="https://github.com/abgnydn/markview/blob/main/COMMERCIAL_LICENSE.md" target="_blank" rel="noopener noreferrer">Commercial License</a>
          <span>·</span>
          <a href="/terms">Terms</a>
          <span>·</span>
          <a href="/privacy">Privacy</a>
        </p>
      </footer>
    </div>
  );
}
