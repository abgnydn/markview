'use client';

import React from 'react';

interface FrontmatterCardProps {
  data: Record<string, string | string[] | number | boolean>;
}

// Tier → (label, color) for the privacy badge. Mirrors the vault-overlay
// tier→tint mapping so the same `sensitivity:` value reads consistently
// across editor, frontmatter card, and 3D vault.
const TIER_BADGE: Record<string, { fg: string; bg: string; border: string; dot: string }> = {
  public:   { fg: '#0891b2', bg: 'rgba(103, 232, 249, 0.10)', border: 'rgba(103, 232, 249, 0.45)', dot: '#67e8f9' },
  internal: { fg: '#7c3aed', bg: 'rgba(167, 139, 250, 0.10)', border: 'rgba(167, 139, 250, 0.45)', dot: '#a78bfa' },
  private:  { fg: '#d97706', bg: 'rgba(251, 191, 36, 0.10)', border: 'rgba(251, 191, 36, 0.45)', dot: '#fbbf24' },
  secret:   { fg: '#e11d48', bg: 'rgba(255, 122, 148, 0.10)', border: 'rgba(255, 122, 148, 0.45)', dot: '#ff7a94' },
};

function TierBadge({ tier }: { tier: string }): React.JSX.Element {
  const k = tier.trim().toLowerCase();
  const style = TIER_BADGE[k];
  if (!style) return <>{tier}</>;
  return (
    <span
      title={`sensitivity: ${k} — routed via Ternary Veil`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: 11,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        color: style.fg,
        background: style.bg,
        border: `1px solid ${style.border}`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: style.dot,
          boxShadow: `0 0 6px ${style.dot}`,
        }}
      />
      {k}
    </span>
  );
}

export function FrontmatterCard({ data }: FrontmatterCardProps) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return (
    <div className="frontmatter-card">
      <div className="frontmatter-header">Metadata</div>
      <div className="frontmatter-grid">
        {entries.map(([key, value]) => (
          <div key={key} className="frontmatter-row">
            <span className="frontmatter-key">{key}</span>
            <span className="frontmatter-value">
              {key.toLowerCase() === 'sensitivity' && typeof value === 'string' ? (
                <TierBadge tier={value} />
              ) : Array.isArray(value) ? (
                <span className="frontmatter-tags">
                  {value.map((v, i) => (
                    <span key={i} className="frontmatter-tag">{v}</span>
                  ))}
                </span>
              ) : typeof value === 'boolean' ? (
                <span className={`frontmatter-bool ${value ? 'is-true' : 'is-false'}`}>
                  {String(value)}
                </span>
              ) : (
                String(value)
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
