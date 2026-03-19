'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calculator, Cpu, Globe2, Shield } from 'lucide-react';
import '@/components/landing/landing.css';

export default function InvestorsPage() {
  const [investment, setInvestment] = useState(500000);
  const [equityShare, setEquityShare] = useState(15);

  const metrics = useMemo(() => {
    // Math model: $500k funds marketing/dev -> 5,000 businesses by year 5
    const baselineB2B = Math.floor(investment / 100); 
    const revB2B = baselineB2B * 499;
    
    // Add Indie & B2C revenue for flavor
    const revIndie = (baselineB2B * 4) * 149; // 4 indies per B2B 
    const revB2C = (baselineB2B * 10) * 4.99; // 10 App Store sales per B2B
    
    const year5TotalRevenue = revB2B + revIndie + revB2C;
    const year5Profit = year5TotalRevenue * 0.40; // High margin dev tool
    
    // Developer tool exit multiple
    const companyValuation = year5Profit * 10; 
    const investorShare = companyValuation * (equityShare / 100);
    const exitMultiple = investorShare / investment;

    return {
      engineersFunded: Math.max(1, Math.floor(investment / 150000)),
      year5TotalRevenue,
      companyValuation,
      investorShare,
      exitMultiple,
      baselineB2B
    };
  }, [investment, equityShare]);

  const formatCurrency = (val: number) => {
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
    return `$${val}`;
  };

  return (
    <div className="landing">
      {/* Top Navbar Header */}
      <div className="landing-nav-bar">
        <Link href="/docs" className="landing-back-btn" style={{ textDecoration: 'none' }}>Documentation</Link>
        <Link href="/pricing" className="landing-back-btn" style={{ textDecoration: 'none' }}>Pricing</Link>
        <Link href="/" className="landing-back-btn" style={{ textDecoration: 'none' }}>
          <ArrowLeft size={16} />
          Back to MarkView
        </Link>
      </div>

      {/* Hero Section */}
      <header className="investor-hero">
        <div className="investor-hero-glow" />
        
        <div className="investor-hero-content">
          <h1 className="investor-hero-title">
            Fund the standard for{' '}
            <span className="investor-hero-accent">
              local-first AI documentation
            </span>
          </h1>
          <p className="investor-hero-subtitle">
            MarkView isn't just a markdown viewer. It's a headless, zero-cloud platform 
            engineered to power the next generation of LLMs, enterprise workflows, and developer productivity.
          </p>
        </div>
      </header>

      {/* The Thesis (3 Pillars) */}
      <section className="investor-pillars">
        <div className="investor-pillars-grid">
          <div className="investor-pillar-card">
            <Shield className="investor-pillar-icon" size={32} style={{ color: '#c084fc' }} />
            <h3 className="investor-pillar-title">Zero-Cloud Architecture</h3>
            <p className="investor-pillar-desc">
              Enterprise companies refuse to upload unreleased architecture to third-party clouds. 
              MarkView runs 100% in the browser (IndexedDB), bypassing impossible SOC2 hurdles entirely.
            </p>
          </div>
          <div className="investor-pillar-card">
            <Cpu className="investor-pillar-icon" size={32} style={{ color: '#818cf8' }} />
            <h3 className="investor-pillar-title">Native MCP Integration</h3>
            <p className="investor-pillar-desc">
              Equipped with 15 Model Context Protocol tools. MarkView is the first documentation engine structurally designed to act as a local RAG database for Claude, Cursor, and Copilots.
            </p>
          </div>
          <div className="investor-pillar-card">
            <Globe2 className="investor-pillar-icon" size={32} style={{ color: '#34d399' }} />
            <h3 className="investor-pillar-title">P2P Networked editing</h3>
            <p className="investor-pillar-desc">
              Multiplayer synchronization via WebRTC and Yjs. Real-time collaboration without a centralized database. The ultimate paradigm shift for developer workflows.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Seed Math */}
      <section className="investor-projection">
        <div className="investor-projection-header">
          <Calculator style={{ color: '#818cf8' }} size={28} />
          <h2 className="investor-projection-title">Interactive Capital Projection</h2>
        </div>

        <div className="investor-projection-card">
          <div className="investor-projection-grid">
            
            {/* Left Controls */}
            <div className="investor-controls">
              
              <div className="investor-slider-group">
                <div className="investor-slider-header">
                  <label className="investor-slider-label">Investment Amount</label>
                  <span className="investor-slider-value">{formatCurrency(investment)}</span>
                </div>
                <input 
                  type="range" 
                  min="50000" 
                  max="3000000" 
                  step="50000"
                  value={investment}
                  onChange={(e) => setInvestment(Number(e.target.value))}
                  className="investor-slider"
                />
              </div>

              <div className="investor-slider-group">
                <div className="investor-slider-header">
                  <label className="investor-slider-label">Equity Requested</label>
                  <span className="investor-slider-value">{equityShare}%</span>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="40" 
                  step="1"
                  value={equityShare}
                  onChange={(e) => setEquityShare(Number(e.target.value))}
                  className="investor-slider"
                />
              </div>

              <div className="investor-insight-box">
                <p className="investor-insight-text">
                  Your capital primarily scales our <strong>Outbound B2B Sales</strong> motion. Funding <span className="highlight">{metrics.engineersFunded} engineering &amp; sales positions</span> allows us to actively capture teams migrating away from legacy cloud documentation.
                </p>
              </div>

            </div>

            {/* Right Results */}
            <div className="investor-results">
              
              <h3 className="investor-results-section-title">Year 5 Operational Targets</h3>
              
              <div className="investor-metric-grid">
                <div className="investor-metric-card">
                  <div className="investor-metric-label">Total Active B2B Licenses</div>
                  <div className="investor-metric-value">{metrics.baselineB2B.toLocaleString()}</div>
                  <div className="investor-metric-sub">At $499/seat enterprise pricing</div>
                </div>
                <div className="investor-metric-card">
                  <div className="investor-metric-label">Total ARR (Revenue)</div>
                  <div className="investor-metric-value">{formatCurrency(metrics.year5TotalRevenue)}</div>
                  <div className="investor-metric-sub">Combined enterprise &amp; indie sales</div>
                </div>
              </div>

              <h3 className="investor-results-section-title">Exit Valuation Metrics</h3>
              
              <div className="investor-exit-grid">
                <div>
                  <div className="investor-exit-label">Company Valuation (10x Profit)</div>
                  <div className="investor-exit-value">{formatCurrency(metrics.companyValuation)}</div>
                </div>
                <div className="investor-exit-right">
                  <div className="investor-exit-label">Value of your {equityShare}% Share</div>
                  <div className="investor-exit-value investor-exit-value-highlight">{formatCurrency(metrics.investorShare)}</div>
                </div>
              </div>
              
              <div className="investor-roi-row">
                <span className="investor-roi-label">Projected ROI Multiple</span>
                <span className="investor-roi-value">
                  {metrics.exitMultiple.toFixed(1)}x
                </span>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer" style={{ marginTop: '96px' }}>
        <p style={{ marginBottom: '8px' }}>Confidential Interactive Projections • MarkView Team</p>
        <p className="landing-footer-sub">This does not constitute an official solicitation of investment. Projections are based on theoretical B2B expansion scale.</p>
      </footer>
    </div>
  );
}
