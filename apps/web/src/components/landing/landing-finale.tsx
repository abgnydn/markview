'use client';

import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';
import { Chrome, Github } from '@/components/ui/brand-icons';

const CMD = 'npx @markview/mcp ./docs';

export function LandingFinale() {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section
      className="landing-finale"
      data-scene="finale"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 6vw',
        position: 'relative',
        zIndex: 2,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '12px',
          letterSpacing: '0.3em',
          color: 'rgba(103, 232, 249, 0.9)',
          marginBottom: '20px',
          textTransform: 'uppercase',
        }}
      >
        Fin · Begin
      </div>
      <h2
        style={{
          fontSize: 'clamp(48px, 8vw, 104px)',
          lineHeight: 1.0,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          margin: 0,
          backgroundImage:
            'linear-gradient(135deg, #ffffff 0%, #bae6fd 45%, #c4b5fd 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textShadow: '0 0 60px rgba(103, 232, 249, 0.15)',
        }}
      >
        Start the brain.
      </h2>
      <p
        style={{
          marginTop: '26px',
          fontSize: 'clamp(15px, 1.25vw, 19px)',
          lineHeight: 1.6,
          color: 'rgba(226, 232, 240, 0.9)',
          maxWidth: '580px',
          textShadow: '0 1px 20px rgba(0, 0, 0, 0.45)',
        }}
      >
        Run the MCP locally. Install the browser extension. Your vault becomes portable AI memory —
        on every tab, on every question.
      </p>

      <div
        style={{
          marginTop: '52px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '18px',
        }}
      >
        <a
          href="https://github.com/abgnydn/markview#install"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 28px',
            borderRadius: '999px',
            background:
              'linear-gradient(135deg, #0ea5e9 0%, #a78bfa 100%)',
            color: '#061225',
            fontSize: '15px',
            fontWeight: 600,
            letterSpacing: '0.01em',
            textDecoration: 'none',
            boxShadow:
              '0 0 48px rgba(103, 232, 249, 0.32), 0 8px 24px rgba(0,0,0,0.55)',
          }}
        >
          <Chrome size={16} /> Install the extension
        </a>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 16px',
            borderRadius: '10px',
            background: 'rgba(7, 14, 33, 0.7)',
            border: '1px solid rgba(103, 232, 249, 0.18)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: '13px',
            color: 'rgba(226, 232, 240, 0.92)',
          }}
        >
          <Terminal size={14} color="#67e8f9" />
          <code>{CMD}</code>
          <button
            onClick={copy}
            style={{
              background: 'transparent',
              border: 'none',
              color: copied
                ? 'rgba(52, 211, 153, 0.95)'
                : 'rgba(103, 232, 249, 0.8)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="Copy command"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>

        <a
          href="https://github.com/abgnydn/markview"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '999px',
            background: 'transparent',
            color: 'rgba(226, 232, 240, 0.8)',
            fontSize: '13px',
            textDecoration: 'none',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Github size={14} /> View on GitHub · Apache 2.0
        </a>

        <div
          style={{
            marginTop: '14px',
            fontSize: '11px',
            color: 'rgba(148, 163, 184, 0.6)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          or drop a .md file anywhere on this page
        </div>
      </div>
    </section>
  );
}
