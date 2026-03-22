import Link from 'next/link';
import { Github } from 'lucide-react';
import '@/components/landing/landing.css';

export const metadata = {
  title: 'Terms of Service — MarkView',
  description: 'MarkView terms of service for the web app, desktop app, SDK packages, and commercial licenses.',
};

export default function TermsPage() {
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
            <Link href="/docs" className="landing-navbar-link">Docs</Link>
            <a href="https://github.com/abgnydn/markview" target="_blank" rel="noopener noreferrer" className="landing-navbar-github">
              <Github size={16} />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </nav>

      {/* Spacer for fixed navbar */}
      <div style={{ height: 64 }} />

      <div style={{ padding: '40px 20px 80px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <h1 className="landing-section-title" style={{ fontSize: '2.5rem', marginBottom: '12px' }}>Terms of Service</h1>
        <p style={{ color: '#71717a', fontSize: '14px', marginBottom: '48px' }}>Last updated: March 20, 2026</p>

        <div className="landing-legal-content">
          <h2>1. Acceptance of Terms</h2>
          <p>By accessing or using MarkView (&quot;the Service&quot;), including the web application at markview.ai, the native macOS application, Chrome extension, npm packages (@markview/core, @markview/react, @markview/webcomponent, @markview/mcp), and any related services, you agree to be bound by these Terms of Service.</p>

          <h2>2. Description of Service</h2>
          <p>MarkView is a markdown rendering and documentation viewing platform. The Service processes all data locally in your browser or on your device. MarkView does not transmit, store, or process your documents on any external server.</p>

          <h2>3. User Accounts</h2>
          <p>MarkView does not require user accounts. The Service operates on a zero-account, privacy-first model. All data is stored locally using IndexedDB in your browser or on your device&apos;s file system.</p>

          <h2>4. Open Source License (AGPL-3.0)</h2>
          <p>The MarkView source code is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). You may use, modify, and distribute the software under the terms of this license, provided that any derivative work is also distributed under AGPL-3.0 and its source code is made available.</p>

          <h2>5. Commercial License</h2>
          <p>If you wish to embed MarkView SDK packages in a proprietary or closed-source application without AGPL obligations, you must purchase a commercial license. Commercial licenses are available through Lemon Squeezy and come in Indie, Business, and Enterprise tiers. See our <Link href="/pricing" style={{ color: '#a5b4fc' }}>Pricing page</Link> for details.</p>

          <h2>6. Desktop Application</h2>
          <p>The MarkView for Mac desktop application is a separate product available for a one-time purchase. The desktop app is built with Tauri v2 and processes all files locally on your machine.</p>

          <h2>7. Intellectual Property</h2>
          <p>The MarkView name, logo, and branding are trademarks of MarkView. The software itself is open source under AGPL-3.0, but the trademarks may not be used without permission.</p>

          <h2>8. Disclaimer of Warranties</h2>
          <p>THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.</p>

          <h2>9. Limitation of Liability</h2>
          <p>IN NO EVENT SHALL MARKVIEW OR ITS CONTRIBUTORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE.</p>

          <h2>10. Changes to Terms</h2>
          <p>We reserve the right to modify these Terms at any time. Changes will be posted on this page with an updated revision date. Your continued use of the Service after any changes constitutes acceptance of the new Terms.</p>

          <h2>11. Contact</h2>
          <p>For questions about these Terms, please contact us at <a href="mailto:support@markview.ai" style={{ color: '#a5b4fc' }}>support@markview.ai</a>.</p>
        </div>
      </div>

      {/* Footer */}
      <footer className="landing-footer">
        <img src="/icon-192.png" alt="MarkView Logo" style={{ width: 44, height: 44, borderRadius: 10, margin: '0 auto 20px auto', display: 'block', opacity: 0.9 }} />
        <p><strong>MarkView</strong> — Open source markdown documentation viewer</p>
        <p className="landing-footer-sub">Built with Next.js · WebRTC (Yjs) · Shiki · Mermaid · KaTeX · MCP</p>
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
