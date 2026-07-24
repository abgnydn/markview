// SPDX-License-Identifier: Apache-2.0

/**
 * LandingEditor — markdown-editor-focused hero for `markview.ai`.
 *
 * Shown at `/` when no workspace exists yet. Clicking "Open editor"
 * seeds a demo workspace and renders the ViewerPage in place. The
 * surface uses the same zen palette + typography as the reader so the
 * landing reads as a single chapter in the same book.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GitHubImport } from '@/components/workspace/github-import';
import { useMarketingBeacon } from '@/lib/analytics';
import './landing-editor.css';

interface LandingEditorProps {
  onStart: () => void;
  onImportGithub: (files: { filename: string; content: string }[], repoName: string) => void;
  onDropFiles: (files: { filename: string; content: string }[]) => void;
}

/**
 * Pick the best-fit download asset for the visitor's UA. Asset names track
 * the desktop app version (tauri.conf.json) — keep these in sync with the
 * `desktop-v<version>` release that publishes them. Unknown user-agents fall
 * back to the release page so the visitor can browse the asset list.
 */
const RELEASES_URL = 'https://github.com/abgnydn/markview/releases/latest';
const DL = (asset: string) =>
  `https://github.com/abgnydn/markview/releases/latest/download/${asset}`;

// MUST match the version of the latest published desktop-v* release —
// `releases/latest/download/` only resolves assets of that release, so a
// stale/premature version here means every download button 404s. Bump this
// together with tagging a new desktop release.
const DESKTOP_VERSION = '0.2.0';
const ASSET_MAC_ARM = `MarkView_${DESKTOP_VERSION}_aarch64.dmg`;
const ASSET_MAC_X64 = `MarkView_${DESKTOP_VERSION}_x64.dmg`;
const ASSET_WIN_SETUP = `MarkView_${DESKTOP_VERSION}_x64-setup.exe`;
const ASSET_LINUX_APPIMAGE = `MarkView_${DESKTOP_VERSION}_amd64.AppImage`;

function pickDownload(): { href: string; label: string; tooltip: string } {
  if (typeof navigator === 'undefined') {
    return { href: RELEASES_URL, label: 'Download for desktop', tooltip: '' };
  }
  const ua = navigator.userAgent;
  const uad = (navigator as { userAgentData?: { platform?: string } }).userAgentData;
  const platform = uad?.platform ?? '';

  const isMac = /Mac/i.test(ua) || /macOS/i.test(platform);
  const isWindows = /Windows/i.test(ua) || /Windows/i.test(platform);
  const isLinux = !isMac && !isWindows && (/Linux/i.test(ua) || /Linux/i.test(platform));

  if (isMac) {
    const looksIntel = /Intel/i.test(ua) && !/Apple/i.test(platform);
    return looksIntel
      ? { href: DL(ASSET_MAC_X64), label: 'Download for macOS (Intel)', tooltip: `${ASSET_MAC_X64} · 15 MB · Apache-2.0` }
      : { href: DL(ASSET_MAC_ARM), label: 'Download for macOS', tooltip: `${ASSET_MAC_ARM} · 15 MB · Apache-2.0` };
  }
  if (isWindows) {
    return { href: DL(ASSET_WIN_SETUP), label: 'Download for Windows', tooltip: `${ASSET_WIN_SETUP} · 13 MB · Apache-2.0` };
  }
  if (isLinux) {
    return { href: DL(ASSET_LINUX_APPIMAGE), label: 'Download for Linux', tooltip: `${ASSET_LINUX_APPIMAGE} · 85 MB · Apache-2.0` };
  }
  return { href: RELEASES_URL, label: 'Download for desktop', tooltip: 'Pick the build for your OS' };
}

// Feature cards — each one a small magazine column with a mono caps label
// and a serif paragraph.
const FEATURES: Array<{ label: string; title: string; body: string }> = [
  {
    label: 'Render',
    title: 'GitHub-flavored, fast',
    body: 'Mermaid, KaTeX, Shiki for 140+ languages, tables, alerts, footnotes — rendered locally, instantly.',
  },
  {
    label: 'Workspace',
    title: 'Files-first, never tabs',
    body: 'Multi-file workspaces, nested trees, drag-and-drop, GitHub repo import. IndexedDB-persistent.',
  },
  {
    label: 'Edit',
    title: 'Focus-paragraph mode',
    body: 'CodeMirror 6 with a serif body, a violet caret, and everything but the line you\'re on dimmed.',
  },
  {
    label: 'Export',
    title: 'Out into the world',
    body: 'PDF, Word, PowerPoint, PNG, SVG, HTML, RST, AsciiDoc, static site. Print, share, embed.',
  },
  {
    label: 'Collab',
    title: 'One URL, two cursors',
    body: 'Real-time multiplayer editing over WebRTC. Zero server, no account, no trail.',
  },
  {
    label: 'AI',
    title: 'Ask your notes, locally',
    body: 'Semantic search, related-notes rail, and a workspace-grounded chat. MiniLM and SmolLM2 run in your browser — no API keys, no uploads.',
  },
  {
    label: 'Privacy',
    title: 'Stays on your machine',
    body: 'No accounts. No telemetry. Files never leave your browser. Full PWA, plus native desktop builds for Mac, Windows, Linux.',
  },
];

export function LandingEditor({ onStart, onImportGithub, onDropFiles }: LandingEditorProps) {
  useMarketingBeacon();
  const start = useCallback(() => onStart(), [onStart]);
  const download = useMemo(() => pickDownload(), []);

  // The hero promises "drag-drop a .md to start" — honor it right here on
  // the landing, mirroring the viewer's drop handling. dragCounter tracks
  // enter/leave pairs so child elements don't flicker the overlay off.
  const [isDragging, setIsDragging] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const dragCounter = useRef(0);
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) => /\.(md|markdown)$/i.test(f.name));
    if (dropped.length === 0) {
      // Tell the user why nothing happened instead of silently ignoring.
      setDropError('Only markdown files (.md, .markdown) can be opened.');
      window.setTimeout(() => setDropError(null), 3000);
      return;
    }
    const files = await Promise.all(dropped.map(async (f) => ({ filename: f.name, content: await f.text() })));
    onDropFiles(files);
  }, [onDropFiles]);

  return (
    <div
      className={`ed-landing${isDragging ? ' is-dragover' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragging(true); }}
      onDragLeave={() => { dragCounter.current--; if (dragCounter.current <= 0) { dragCounter.current = 0; setIsDragging(false); } }}
      onDrop={(e) => void handleDrop(e)}
    >
      {isDragging && (
        <div className="ed-drop-overlay" aria-hidden>
          <div className="ed-drop-overlay-card">Drop your <code>.md</code> — it opens right here</div>
        </div>
      )}
      {dropError && (
        <div className="ed-drop-overlay" role="alert" style={{ background: 'transparent', backdropFilter: 'none', alignItems: 'flex-end', paddingBottom: 48 }}>
          <div className="ed-drop-overlay-card" style={{ borderStyle: 'solid', borderColor: '#ff5f57' }}>{dropError}</div>
        </div>
      )}
      <header className="ed-nav">
        <div className="ed-nav-brand">
          <span className="ed-nav-mark" aria-hidden="true">
            <span className="ed-nav-mark-m">M</span>
          </span>
          <span className="ed-nav-name">Markview</span>
        </div>
        <nav className="ed-nav-links">
          <a
            href="https://github.com/abgnydn/markview"
            target="_blank"
            rel="noopener noreferrer"
            className="ed-nav-link"
          >
            GitHub
          </a>
          <button onClick={start} className="ed-nav-cta">Open editor</button>
        </nav>
      </header>

      <main className="ed-hero">
        <div className="ed-hero-eyebrow">
          <span className="ed-hero-eyebrow-dot" />
          markdown, reconsidered
          <span className="ed-hero-eyebrow-dot" />
        </div>
        <h1 className="ed-hero-title">
          A markdown editor that <em className="ed-hero-accent">stays on your machine</em>.
        </h1>
        <p className="ed-hero-sub">
          Drag a file in. Drop a folder. Paste a GitHub repo URL. Markview renders, edits,
          searches, diffs, and exports — entirely on your machine. No accounts, no uploads,
          no telemetry. Share a live collab link when you want company.
        </p>
        <div className="ed-hero-cta-row">
          <button onClick={start} className="ed-cta-primary">Open editor →</button>
          <a
            href={download.href}
            target="_blank"
            rel="noopener noreferrer"
            className="ed-cta-secondary"
            title={download.tooltip || 'Latest release on GitHub'}
          >
            {download.label}
          </a>
        </div>
        <div className="ed-hero-meta">
          <kbd>⌘K</kbd> search · <kbd>⌘B</kbd> bold · <kbd>⌘I</kbd> italic · <kbd>⌘S</kbd> save · drag-drop a <code>.md</code> to start
        </div>

        <div className="ed-github-import">
          <div className="ed-github-import-label">
            Or import a GitHub repo
          </div>
          <GitHubImport onFilesLoaded={onImportGithub} />
        </div>
      </main>

      <div className="ed-rule" aria-hidden="true">· · ·</div>

      <section className="ed-features">
        {FEATURES.map((f) => (
          <article key={f.title} className="ed-feature">
            <div className="ed-feature-label">{f.label}</div>
            <h3 className="ed-feature-title">{f.title}</h3>
            <p className="ed-feature-body">{f.body}</p>
          </article>
        ))}
      </section>

      <div className="ed-rule" aria-hidden="true">· · ·</div>

      <blockquote className="ed-pullquote">
        A good editor disappears. So does this one.
      </blockquote>

      <footer className="ed-foot">
        <div className="ed-foot-row">
          <span className="ed-foot-mark">markview · 2026</span>
          <span className="ed-foot-sep">·</span>
          <Link to="/privacy" className="ed-foot-link">Privacy</Link>
          <span className="ed-foot-sep">·</span>
          <Link to="/terms" className="ed-foot-link">Terms</Link>
          <span className="ed-foot-sep">·</span>
          <a
            href="https://github.com/abgnydn/markview"
            target="_blank"
            rel="noopener noreferrer"
            className="ed-foot-link"
          >
            Apache-2.0 on GitHub
          </a>
        </div>
        <div className="ed-foot-credit">
          <span className="ed-foot-credit-by">By</span>
          <a
            href="https://barisgunaydin.com"
            target="_blank"
            rel="noopener noreferrer"
            className="ed-foot-credit-name"
          >
            Ahmet Baris Gunaydin
          </a>
          <span className="ed-foot-sep">·</span>
          <a
            href="https://barisgunaydin.com"
            target="_blank"
            rel="noopener noreferrer"
            className="ed-foot-link"
          >
            barisgunaydin.com
          </a>
          <span className="ed-foot-sep">·</span>
          <a
            href="mailto:hi@barisgunaydin.com"
            className="ed-foot-link"
          >
            hi@barisgunaydin.com
          </a>
        </div>
      </footer>
    </div>
  );
}
