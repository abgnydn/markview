import fs from 'fs/promises';
import path from 'path';
import { Github } from 'lucide-react';
import Link from 'next/link';
import { MarkdownRenderer } from '@/components/viewer/markdown-renderer';
import '@/components/landing/landing.css';

export default async function DocsPage() {
  // Read the markdown file directly from the filesystem during SSR/SSG
  const filePath = path.join(process.cwd(), 'src/app/docs/technical_documentation.md');
  const content = await fs.readFile(filePath, 'utf8');

  return (
    <div className="landing">
      {/* Sticky Nav Bar */}
      <nav className="landing-navbar">
        <div className="landing-navbar-inner">
          <Link href="/" className="landing-navbar-brand" style={{ textDecoration: 'none' }}>
            <img src="/icon-192.png" alt="MarkView" className="landing-navbar-logo" />
            <span className="landing-navbar-name">MarkView</span>
          </Link>
          <div className="landing-navbar-links">
            <Link href="/pricing" className="landing-navbar-link">Pricing</Link>
            <Link href="/docs" className="landing-navbar-link" style={{ color: '#fafafa' }}>Docs</Link>
            <a href="https://github.com/abgnydn/markview" target="_blank" rel="noopener noreferrer" className="landing-navbar-github">
              <Github size={16} />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </nav>

      {/* Spacer for fixed navbar */}
      <div style={{ height: 64 }} />

      {/* Main Documentation Content */}
      <div style={{ padding: '40px 20px 80px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <MarkdownRenderer content={content} />
      </div>

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
          <Link href="/pricing">Pricing</Link>
          <span>·</span>
          <Link href="/docs">Documentation</Link>
          <span>·</span>
          <a href="https://www.npmjs.com/package/@markview/core" target="_blank" rel="noopener noreferrer">npm</a>
          <span>·</span>
          <a href="https://github.com/abgnydn/markview" target="_blank" rel="noopener noreferrer">GitHub</a>
          <span>·</span>
          <Link href="/terms">Terms</Link>
          <span>·</span>
          <Link href="/privacy">Privacy</Link>
        </p>
      </footer>
    </div>
  );
}
