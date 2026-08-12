import { Link } from 'react-router-dom';
import { Github } from '@/components/ui/brand-icons';
import { useMarketingBeacon } from '@/lib/analytics';
import { usePageTitle } from '@/hooks/use-page-title';


export default function PrivacyPage() {
  useMarketingBeacon();
  usePageTitle("Privacy Policy — MarkView");
  return (
    <div className="landing">
      {/* Sticky Nav Bar */}
      <nav className="landing-navbar">
        <div className="landing-navbar-inner">
          <Link to="/" className="landing-navbar-brand" style={{ textDecoration: 'none' }}>
            <img src="/icon-192.png" alt="MarkView" className="landing-navbar-logo" />
            <span className="landing-navbar-name">MarkView</span>
          </Link>
          <div className="landing-navbar-links">
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
          <p>MarkView currently runs <strong>no analytics at all</strong>. If we enable analytics for the marketing pages in the future, it will be Cloudflare Web Analytics — a cookie-free, aggregate-only page view counter — and this policy will be updated first.</p>
          <p><strong>Important:</strong> No analytics or telemetry of any kind runs inside the MarkView editor or desktop app.</p>

          <h2>5. Peer-to-Peer Collaboration</h2>
          <p>MarkView&apos;s real-time collaboration feature uses WebRTC (via Yjs) for direct peer-to-peer connections. Document data is transmitted directly between collaborating browsers without passing through any intermediate server. Connection signaling uses temporary WebSocket connections that do not log or store document content.</p>

          <h2>6. GitHub Import</h2>
          <p>When you use the GitHub Import feature, MarkView fetches public repository data directly from GitHub&apos;s API and raw content URLs. These requests go directly from your browser to GitHub — MarkView does not proxy, cache, or log these requests.</p>

          <h2>7. Third-Party Services</h2>
          <ul style={{ color: '#a1a1aa', lineHeight: '2', paddingLeft: '20px' }}>
            <li><strong>GitHub API</strong> — Used only when you explicitly import from a GitHub repository</li>
            <li><strong>Hugging Face</strong> — When you explicitly enable an AI feature (local chat model, painting-atmosphere depth), the model weights are downloaded from Hugging Face&apos;s CDN. Your documents are never uploaded — models run entirely in your browser.</li>
            <li><strong>Cloud AI (optional)</strong> — If you choose the cloud mode of AI chat or the AI co-author, the relevant text excerpt is sent to our Cloudflare Workers AI endpoint to generate a response. It is processed transiently and not stored or logged. Local mode keeps everything on-device.</li>
          </ul>

          <h2>8. Desktop Application</h2>
          <p>The MarkView desktop application (macOS, Windows, Linux) operates entirely offline. It does not phone home, check for updates automatically, or transmit any data. Files are read from and written to your local file system only.</p>

          <h2>9. Children&apos;s Privacy</h2>
          <p>MarkView does not knowingly collect any personal information from children under 13. Since we do not collect personal data from anyone, this concern is inherently addressed by our architecture.</p>

          <h2>10. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated revision date.</p>

          <h2>11. Contact</h2>
          <p>For privacy-related questions, please contact us at <a href="mailto:privacy@markview.ai" style={{ color: '#a5b4fc' }}>privacy@markview.ai</a>.</p>
        </div>
      </div>

      {/* Footer */}
      <footer className="landing-footer">
        <img src="/icon-192.png" alt="MarkView Logo" style={{ width: 44, height: 44, borderRadius: 10, margin: '0 auto 20px auto', display: 'block', opacity: 0.9 }} />
        <p><strong>MarkView</strong> — Open source markdown documentation viewer</p>
        <p className="landing-footer-sub">Built with Vite · React · WebRTC (Yjs) · Shiki · Mermaid · KaTeX</p>
        <p className="landing-footer-links">
          <span>·</span>
          <span>·</span>
          <a href="https://www.npmjs.com/package/@markview/core" target="_blank" rel="noopener noreferrer">npm</a>
          <span>·</span>
          <a href="https://github.com/abgnydn/markview" target="_blank" rel="noopener noreferrer">GitHub</a>
          <span>·</span>
          <Link to="/terms">Terms</Link>
          <span>·</span>
          <Link to="/privacy">Privacy</Link>
        </p>
      </footer>
    </div>
  );
}
