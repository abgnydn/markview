import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import '@/components/landing/landing.css';

export const metadata = {
  title: 'Privacy Policy — MarkView',
  description: 'MarkView privacy policy. Zero telemetry, zero tracking inside the app, all data stays local.',
};

export default function PrivacyPage() {
  return (
    <div className="landing">
      <div className="landing-nav-bar">
        <Link href="/pricing" className="landing-back-btn" style={{ textDecoration: 'none' }}>Pricing</Link>
        <Link href="/docs" className="landing-back-btn" style={{ textDecoration: 'none' }}>Documentation</Link>
        <Link href="/" className="landing-back-btn" style={{ textDecoration: 'none' }}>
          <ArrowLeft size={16} />
          Back to MarkView
        </Link>
      </div>

      <div style={{ padding: '80px 20px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <h1 className="landing-section-title" style={{ fontSize: '2.5rem', marginBottom: '12px' }}>Privacy Policy</h1>
        <p style={{ color: '#71717a', fontSize: '14px', marginBottom: '48px' }}>Last updated: March 20, 2026</p>

        <div className="landing-legal-content">
          <h2>1. Our Commitment to Privacy</h2>
          <p>MarkView is built on a privacy-first, local-first architecture. Your documents, files, and workspace data never leave your device. We do not collect, transmit, or store any of your content on external servers.</p>

          <h2>2. Data Processing</h2>
          <p>All markdown rendering, file parsing, syntax highlighting, diagram generation, and document editing happens entirely in your browser or on your local machine. MarkView uses IndexedDB for workspace persistence — this data remains on your device and is never sent to any server.</p>

          <h2>3. What We Do NOT Collect</h2>
          <ul style={{ color: '#a1a1aa', lineHeight: '2', paddingLeft: '20px' }}>
            <li>Your document contents</li>
            <li>Your file names or directory structures</li>
            <li>Your editing history or version snapshots</li>
            <li>Your annotations or highlights</li>
            <li>Your workspace configurations</li>
            <li>Any personal information or identifiers inside the application</li>
          </ul>

          <h2>4. Website Analytics</h2>
          <p>Our marketing website (markview.ai) uses <a href="https://plausible.io" target="_blank" rel="noopener noreferrer" style={{ color: '#a5b4fc' }}>Plausible Analytics</a>, a privacy-friendly, cookie-free analytics tool. Plausible does not use cookies, does not collect personal data, and is fully GDPR, CCPA, and PECR compliant. Analytics are limited to aggregate page view counts on our marketing pages only.</p>
          <p><strong>Important:</strong> No analytics or telemetry of any kind runs inside the MarkView editor, desktop app, Chrome extension, or SDK packages.</p>

          <h2>5. Peer-to-Peer Collaboration</h2>
          <p>MarkView&apos;s real-time collaboration feature uses WebRTC (via Yjs) for direct peer-to-peer connections. Document data is transmitted directly between collaborating browsers without passing through any intermediate server. Connection signaling uses temporary WebSocket connections that do not log or store document content.</p>

          <h2>6. GitHub Import</h2>
          <p>When you use the GitHub Import feature, MarkView fetches public repository data directly from GitHub&apos;s API and raw content URLs. These requests go directly from your browser to GitHub — MarkView does not proxy, cache, or log these requests.</p>

          <h2>7. Third-Party Services</h2>
          <ul style={{ color: '#a1a1aa', lineHeight: '2', paddingLeft: '20px' }}>
            <li><strong>Plausible Analytics</strong> — Cookie-free page view counting on marketing pages only</li>
            <li><strong>Lemon Squeezy</strong> — Payment processing for commercial licenses (their own <a href="https://www.lemonsqueezy.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#a5b4fc' }}>privacy policy</a> applies)</li>
            <li><strong>GitHub API</strong> — Used only when you explicitly import from a GitHub repository</li>
            <li><strong>KaTeX CDN</strong> — Font stylesheet loaded for math equation rendering</li>
          </ul>

          <h2>8. Desktop Application</h2>
          <p>The MarkView for Mac desktop application operates entirely offline. It does not phone home, check for updates automatically, or transmit any data. Files are read from and written to your local file system only.</p>

          <h2>9. Chrome Extension</h2>
          <p>The MarkView Chrome extension renders markdown files locally in your browser. It does not collect browsing history, page content, or any other data. It only activates on .md and .markdown file URLs.</p>

          <h2>10. Children&apos;s Privacy</h2>
          <p>MarkView does not knowingly collect any personal information from children under 13. Since we do not collect personal data from anyone, this concern is inherently addressed by our architecture.</p>

          <h2>11. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated revision date.</p>

          <h2>12. Contact</h2>
          <p>For privacy-related questions, please contact us at <a href="mailto:privacy@markview.ai" style={{ color: '#a5b4fc' }}>privacy@markview.ai</a>.</p>
        </div>
      </div>

      <footer className="landing-footer" style={{ marginTop: '64px' }}>
        <p className="landing-footer-text">
          MarkView is an open source project. <br/>
          Built with Next.js · WebRTC · Shiki · Mermaid · KaTeX · MCP
        </p>
      </footer>
    </div>
  );
}
