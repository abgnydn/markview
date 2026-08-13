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
import { DESKTOP_VERSION } from '@/lib/version';
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
const ASSET_MAC_ARM = `MarkView_${DESKTOP_VERSION}_aarch64.dmg`;
const ASSET_MAC_X64 = `MarkView_${DESKTOP_VERSION}_x64.dmg`;
const ASSET_WIN_SETUP = `MarkView_${DESKTOP_VERSION}_x64-setup.exe`;
const ASSET_LINUX_APPIMAGE = `MarkView_${DESKTOP_VERSION}_amd64.AppImage`;

function pickDownload(): { href: string; label: string; tooltip: string; os?: 'mac' | 'windows' | 'linux' } {
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
      ? { href: DL(ASSET_MAC_X64), label: 'Download for macOS (Intel)', tooltip: `${ASSET_MAC_X64} · 15 MB · Apache-2.0`, os: 'mac' }
      : { href: DL(ASSET_MAC_ARM), label: 'Download for macOS', tooltip: `${ASSET_MAC_ARM} · 15 MB · Apache-2.0`, os: 'mac' };
  }
  if (isWindows) {
    return { href: DL(ASSET_WIN_SETUP), label: 'Download for Windows', tooltip: `${ASSET_WIN_SETUP} · 13 MB · Apache-2.0`, os: 'windows' };
  }
  if (isLinux) {
    return { href: DL(ASSET_LINUX_APPIMAGE), label: 'Download for Linux', tooltip: `${ASSET_LINUX_APPIMAGE} · 85 MB · Apache-2.0`, os: 'linux' };
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
    title: 'One link, follow along live',
    body: 'Share a live link over WebRTC — guests follow along and read in real time. Zero server, no account, no trail.',
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
    // The hero promises "Drop a folder" — honor it. dataTransfer.files
    // exposes a directory as a single extension-less File, so folders
    // must be walked via webkitGetAsEntry (supported by every browser
    // that runs MarkView).
    const isMd = (name: string) => /\.(md|markdown)$/i.test(name);
    const collected: { filename: string; content: string }[] = [];
    const readEntry = (entry: FileSystemEntry, prefix: string): Promise<void> =>
      new Promise((resolve) => {
        if (entry.isFile && isMd(entry.name)) {
          (entry as FileSystemFileEntry).file(
            (f) => void f.text().then((content) => {
              collected.push({ filename: `${prefix}${entry.name}`, content });
              resolve();
            }, () => resolve()),
            () => resolve(),
          );
        } else if (entry.isDirectory) {
          const reader = (entry as FileSystemDirectoryEntry).createReader();
          const readAll = () => reader.readEntries((entries) => {
            if (entries.length === 0) return resolve();
            void Promise.all(entries.map((child) => readEntry(child, `${prefix}${entry.name}/`)))
              .then(readAll); // readEntries returns batches of ≤100
          }, () => resolve());
          readAll();
        } else {
          resolve();
        }
      });

    const items = Array.from(e.dataTransfer.items ?? []);
    const entries = items
      .map((item) => (typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null))
      .filter((entry): entry is FileSystemEntry => entry != null);
    if (entries.length > 0) {
      await Promise.all(entries.map((entry) => readEntry(entry, '')));
    } else {
      const dropped = Array.from(e.dataTransfer.files).filter((f) => isMd(f.name));
      for (const f of dropped) collected.push({ filename: f.name, content: await f.text() });
    }

    if (collected.length === 0) {
      // Tell the user why nothing happened instead of silently ignoring.
      setDropError('No markdown files (.md, .markdown) found in the drop.');
      window.setTimeout(() => setDropError(null), 3000);
      return;
    }
    onDropFiles(collected);
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
        {/* The desktop builds are not code-signed (no Apple Developer
            account), so macOS blocks the first launch outright — and since
            macOS 15 the old right-click → Open bypass is gone. Without this
            note the download is a dead end. Windows SmartScreen shows the
            equivalent "unrecognized app" prompt. */}
        {download.os === 'mac' && (
          <details className="ed-install-note">
            <summary>macOS says it “can’t verify” the app — what to do</summary>
            <p>
              MarkView is open source and unsigned (an Apple Developer ID costs $99/yr,
              which this project doesn’t have yet), so macOS blocks it on first launch.
            </p>
            <p>
              <strong>Easiest fix — install with Homebrew instead:</strong><br />
              <code>brew install --cask abgnydn/tap/markview</code><br />
              The app lands in Applications and opens normally.
            </p>
            <p>
              Already downloaded the .dmg? Open it via <strong>System Settings → Privacy
              &amp; Security</strong>, scroll to <strong>Security</strong>, then click{' '}
              <strong>Open Anyway</strong> — or run{' '}
              <code>xattr -dr com.apple.quarantine /Applications/MarkView.app</code>
            </p>
            <p>
              Rather not? The <a href="/">web app</a> is the same editor and needs no install.
            </p>
          </details>
        )}
        {download.os === 'windows' && (
          <details className="ed-install-note">
            <summary>Windows SmartScreen warning — what to do</summary>
            <p>
              The installer is unsigned, so SmartScreen shows “Windows protected your PC”.
              Click <strong>More info</strong> → <strong>Run anyway</strong>. Or use the{' '}
              <a href="/">web app</a>, which needs no install.
            </p>
          </details>
        )}

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
          <span className="ed-foot-sep">·</span>
          <a
            href="https://github.com/abgnydn/markview/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="ed-foot-link"
          >
            Changelog
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
