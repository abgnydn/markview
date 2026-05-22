// SPDX-License-Identifier: Apache-2.0

/**
 * LandingEditor — markdown-editor-focused hero for `markview.ai`.
 *
 * Shown at `/` when no workspace exists yet. Clicking "Open editor"
 * seeds a demo workspace and renders the ViewerPage in place.
 */

import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import './landing-editor.css';

interface LandingEditorProps {
  onStart: () => void;
}

const FEATURES: Array<{ title: string; body: string }> = [
  {
    title: 'GitHub-flavored, fast',
    body: 'Mermaid, KaTeX, Shiki for 140+ languages, tables, alerts, footnotes — all rendered locally, instantly.',
  },
  {
    title: 'Workspace-first',
    body: 'Multi-tab, nested file trees, drag-and-drop, GitHub repo import. IndexedDB-persistent — survives refresh.',
  },
  {
    title: 'Edit + render in one place',
    body: 'CodeMirror 6 editor with formatting toolbar, split view, diff view, presentation mode, version history.',
  },
  {
    title: 'Export everywhere',
    body: 'PDF, Word, PowerPoint, PNG, SVG, HTML, RST, AsciiDoc, static site. Print, share, embed.',
  },
  {
    title: 'P2P collab',
    body: 'Real-time multiplayer editing via WebRTC. Zero server. Share a URL, you both type at once.',
  },
  {
    title: 'Zero-cloud',
    body: 'No accounts. No telemetry. Files never leave your browser. Full PWA, works offline.',
  },
];

export function LandingEditor({ onStart }: LandingEditorProps) {
  const start = useCallback(() => onStart(), [onStart]);

  return (
    <div className="ed-landing">
      <header className="ed-nav">
        <div className="ed-nav-brand">
          <img src="/icon-192.png" alt="" className="ed-nav-logo" />
          <span className="ed-nav-name">MarkView</span>
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
          Zero-account · Privacy-first · Native macOS app · Offline-ready
        </div>
        <h1 className="ed-hero-title">
          A markdown editor that <span className="ed-hero-accent">stays on your machine</span>.
        </h1>
        <p className="ed-hero-sub">
          Drag a file in. Drop a folder. Paste a GitHub repo URL. MarkView renders, edits,
          searches, diffs, and exports — entirely on your machine. No accounts, no uploads,
          no telemetry. Share a live collab link when you want company.
        </p>
        <div className="ed-hero-cta-row">
          <button onClick={start} className="ed-cta-primary">Open editor →</button>
          <a
            href="https://github.com/abgnydn/markview/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            className="ed-cta-secondary"
            title="Latest release on GitHub — pick the .dmg, .msi, or .AppImage for your OS"
          >
            Download for desktop
          </a>
        </div>
        <div className="ed-hero-meta">
          <span>⌘K</span> search · <span>⌘B</span> bold · <span>⌘I</span> italic · <span>⌘S</span> save · drag-drop a <code>.md</code> to start
        </div>
      </main>

      <section className="ed-features">
        {FEATURES.map((f) => (
          <article key={f.title} className="ed-feature">
            <h3 className="ed-feature-title">{f.title}</h3>
            <p className="ed-feature-body">{f.body}</p>
          </article>
        ))}
      </section>

      <footer className="ed-foot">
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
      </footer>
    </div>
  );
}
