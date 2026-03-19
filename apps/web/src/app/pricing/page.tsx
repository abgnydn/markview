import Link from 'next/link';
import { ArrowLeft, Check, Mail } from 'lucide-react';
import '@/components/landing/landing.css';

export default function PricingPage() {
  return (
    <div className="landing">
      {/* Top Navbar Header */}
      <div className="landing-nav-bar">
        <Link href="/docs" className="landing-back-btn" style={{ textDecoration: 'none' }}>Documentation</Link>
        <Link href="/investors" className="landing-back-btn" style={{ textDecoration: 'none' }}>Investors</Link>
        <Link href="/" className="landing-back-btn" style={{ textDecoration: 'none' }}>
          <ArrowLeft size={16} />
          Back to MarkView
        </Link>
      </div>

      {/* Main Pricing Content */}
      <div style={{ padding: '80px 20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        
        <h2 className="landing-section-title" style={{ fontSize: '3rem', marginBottom: '16px' }}>Simple, transparent pricing.</h2>
        <p className="landing-section-subtitle" style={{ maxWidth: '800px', margin: '0 auto 64px auto', fontSize: '1.25rem', lineHeight: '1.6' }}>
          MarkView is proudly open source (AGPLv3) to ensure a high-quality verifiable engine. 
          Embedding MarkView inside a commercial or closed-source application requires a dual-license from Lemon Squeezy.
        </p>

        {/* Pricing Grid */}
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
            <a className="landing-pricing-btn landing-pricing-btn-primary" href="#checkout-lemon-squeezy-indie">
              <Mail size={14} /> Get Indie License
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
            <a className="landing-pricing-btn landing-pricing-btn-secondary" href="#checkout-lemon-squeezy-business">
              <Mail size={14} /> Get Business License
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
            <a className="landing-pricing-btn landing-pricing-btn-secondary" href="mailto:support@markview.ai?subject=MarkView%20Enterprise%20License">
              <Mail size={14} /> Contact Enterprise
            </a>
          </div>
          
        </div>

        {/* FAQ Section Extracted from Global CSS Rules */}
        <div className="landing-pricing-faq" style={{ marginTop: '120px' }}>
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
              <div className="landing-pricing-faq-q">What happens when my license expires?</div>
              <div className="landing-pricing-faq-a">You can continue to use the version of the SDK that was available when your license expired forever, but you lose access to further updates and support until renewed.</div>
            </div>
            
            <div className="landing-pricing-faq-item">
              <div className="landing-pricing-faq-q">How does Lemon Squeezy integration work?</div>
              <div className="landing-pricing-faq-a">When you purchase a license, Lemon Squeezy issues a secure License Key instantly. Simply provide this key inside the MarkView platform to permanently waive AGPL restrictions.</div>
            </div>

          </div>
        </div>

      </div>
      
      {/* Global Landing Footer Styling Match */}
      <footer className="landing-footer" style={{ marginTop: '64px' }}>
        <p className="landing-footer-text">
          MarkView is an open source project. <br/>
          Built with Next.js · WebRTC · Shiki · Mermaid · KaTeX · MCP
        </p>
      </footer>
    </div>
  );
}
