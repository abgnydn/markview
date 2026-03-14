'use client';

import React from 'react';

interface FrontmatterCardProps {
  data: Record<string, string | string[] | number | boolean>;
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
              {Array.isArray(value) ? (
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
