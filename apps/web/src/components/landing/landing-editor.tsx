'use client';

/**
 * LandingEditor — markdown-editor-focused hero for `markview.ai`.
 *
 * This is the surface a developer/writer lands on when they came for
 * the markdown editor itself, not the brain/vault product. Clean,
 * single-screen, opens straight into the editor on click.
 *
 * Toggled via NEXT_PUBLIC_SURFACE=editor (LandingAtlas remains the
 * default for the brain/vault product surface).
 */

import { useCallback } from 'react';
import './landing.css';

interface LandingEditorProps {
  /** Click "Open editor" → parent sets a workspace + renders ViewerPage. */
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
    body: 'WYSIWYG editor with formatting toolbar, split view, diff view, presentation mode, version history, annotations.',
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

export function LandingEditor({ onStart }: LandingEditorProps): React.JSX.Element {
  const start = useCallback(() => {
    onStart();
  }, [onStart]);

  return (
    <div className="ed-landing">
      <header className="ed-nav">
        <div className="ed-nav-brand">
          <img src="/icon-192.png" alt="" className="ed-nav-logo" />
          <span className="ed-nav-name">MarkView</span>
        </div>
        <nav className="ed-nav-links">
          <a href="/docs" className="ed-nav-link">Docs</a>
          <a href="https://github.com/abgnydn/markview" target="_blank" rel="noopener" className="ed-nav-link">GitHub</a>
          <button onClick={start} className="ed-nav-cta">Open editor</button>
        </nav>
      </header>

      <main className="ed-hero">
        <div className="ed-hero-eyebrow">markdown · local-first · open source</div>
        <h1 className="ed-hero-title">
          A markdown editor that <span className="ed-hero-accent">respects</span> your files.
        </h1>
        <p className="ed-hero-sub">
          Drag a file in. Drop a folder. Paste a GitHub repo URL. MarkView renders, edits,
          searches, diffs, and exports — entirely on your machine. No accounts, no uploads,
          no telemetry.
        </p>
        <div className="ed-hero-cta-row">
          <button onClick={start} className="ed-cta-primary">Open editor →</button>
          <a
            href="https://github.com/abgnydn/markview"
            target="_blank"
            rel="noopener"
            className="ed-cta-secondary"
          >
            View on GitHub
          </a>
        </div>
        <div className="ed-hero-meta">
          <span>⌘K</span> search · <span>⌘B</span> bold · <span>⌘I</span> italic · <span>⌘S</span> save snapshot · drag-drop a `.md` to start
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
        <a href="/privacy" className="ed-foot-link">Privacy</a>
        <span className="ed-foot-sep">·</span>
        <a href="/terms" className="ed-foot-link">Terms</a>
        <span className="ed-foot-sep">·</span>
        <a href="https://github.com/abgnydn/markview" target="_blank" rel="noopener" className="ed-foot-link">
          AGPL-3.0
        </a>
      </footer>

      <style jsx>{`
        .ed-landing {
          min-height: 100vh;
          background: linear-gradient(180deg, #0c1018 0%, #060912 100%);
          color: #e2e8f0;
          font-family: ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", sans-serif;
          padding: 0 32px;
          display: flex;
          flex-direction: column;
        }
        .ed-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 22px 0;
          max-width: 1100px;
          width: 100%;
          margin: 0 auto;
        }
        .ed-nav-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .ed-nav-logo {
          width: 28px;
          height: 28px;
          border-radius: 6px;
        }
        .ed-nav-name {
          font-weight: 600;
          font-size: 16px;
          letter-spacing: -0.01em;
        }
        .ed-nav-links {
          display: flex;
          align-items: center;
          gap: 22px;
        }
        .ed-nav-link {
          color: rgba(232, 237, 246, 0.65);
          text-decoration: none;
          font-size: 14px;
          letter-spacing: 0.01em;
          transition: color 0.2s;
        }
        .ed-nav-link:hover {
          color: #e2e8f0;
        }
        .ed-nav-cta,
        .ed-cta-primary {
          background: linear-gradient(180deg, #6366f1 0%, #4f46e5 100%);
          color: white;
          border: 0;
          border-radius: 999px;
          padding: 8px 18px;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          letter-spacing: 0.01em;
          transition: transform 0.15s, box-shadow 0.15s;
          box-shadow: 0 6px 30px rgba(99, 102, 241, 0.25);
        }
        .ed-nav-cta:hover,
        .ed-cta-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 36px rgba(99, 102, 241, 0.35);
        }
        .ed-hero {
          max-width: 760px;
          width: 100%;
          margin: 80px auto 0;
          text-align: center;
        }
        .ed-hero-eyebrow {
          display: inline-block;
          font-size: 11px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(148, 163, 184, 0.78);
          padding: 6px 14px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 999px;
          margin-bottom: 28px;
        }
        .ed-hero-title {
          font-size: clamp(36px, 5.5vw, 64px);
          line-height: 1.05;
          letter-spacing: -0.025em;
          margin: 0 0 22px;
          font-weight: 700;
        }
        .ed-hero-accent {
          background: linear-gradient(180deg, #67e8f9 0%, #6366f1 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .ed-hero-sub {
          font-size: 17px;
          line-height: 1.55;
          color: rgba(203, 213, 225, 0.78);
          margin: 0 0 36px;
        }
        .ed-hero-cta-row {
          display: flex;
          gap: 14px;
          justify-content: center;
          margin-bottom: 24px;
        }
        .ed-cta-secondary {
          background: rgba(255, 255, 255, 0.04);
          color: #e2e8f0;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          padding: 8px 18px;
          font-size: 14px;
          font-weight: 500;
          font-family: inherit;
          text-decoration: none;
          letter-spacing: 0.01em;
          transition: background 0.15s, border-color 0.15s;
        }
        .ed-cta-secondary:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.22);
        }
        .ed-hero-meta {
          font-size: 12px;
          color: rgba(148, 163, 184, 0.58);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: 0.02em;
        }
        .ed-hero-meta span {
          color: rgba(203, 213, 225, 0.85);
          padding: 1px 6px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 4px;
          margin: 0 2px;
        }
        .ed-features {
          max-width: 1100px;
          width: 100%;
          margin: 90px auto 0;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 22px;
        }
        .ed-feature {
          padding: 22px 22px 26px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
        }
        .ed-feature-title {
          font-size: 15px;
          font-weight: 600;
          margin: 0 0 10px;
          color: #e2e8f0;
          letter-spacing: -0.01em;
        }
        .ed-feature-body {
          font-size: 13.5px;
          line-height: 1.55;
          color: rgba(203, 213, 225, 0.7);
          margin: 0;
        }
        .ed-foot {
          max-width: 1100px;
          width: 100%;
          margin: 80px auto 32px;
          padding-top: 22px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 12px;
          color: rgba(148, 163, 184, 0.65);
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .ed-foot-mark {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: 0.04em;
        }
        .ed-foot-sep {
          opacity: 0.45;
        }
        .ed-foot-link {
          color: rgba(148, 163, 184, 0.78);
          text-decoration: none;
          transition: color 0.15s;
        }
        .ed-foot-link:hover {
          color: #e2e8f0;
        }
      `}</style>
    </div>
  );
}
