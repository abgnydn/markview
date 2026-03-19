import fs from 'fs/promises';
import path from 'path';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { MarkdownRenderer } from '@/components/viewer/markdown-renderer';
import '@/components/landing/landing.css';

export default async function DocsPage() {
  // Read the markdown file directly from the filesystem during SSR/SSG
  const filePath = path.join(process.cwd(), 'src/app/docs/technical_documentation.md');
  const content = await fs.readFile(filePath, 'utf8');

  return (
    <div className="landing">
      {/* Top Navbar Header */}
      <div className="landing-nav-bar">
        <Link href="/pricing" className="landing-back-btn" style={{ textDecoration: 'none' }}>Pricing</Link>
        <Link href="/" className="landing-back-btn" style={{ textDecoration: 'none' }}>
          <ArrowLeft size={16} />
          Back to MarkView
        </Link>
      </div>

      {/* Main Documentation Content */}
      <div style={{ padding: '80px 20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <MarkdownRenderer content={content} />
      </div>

      {/* Footer */}
      <footer className="landing-footer">
        <p className="landing-footer-text">
          MarkView is an open source project. <br/>
          Built with Next.js · WebRTC · Shiki · Mermaid · KaTeX · MCP
        </p>
      </footer>
    </div>
  );
}
