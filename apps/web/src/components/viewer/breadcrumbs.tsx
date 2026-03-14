'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbsProps {
  filepath: string;
  onNavigateToFolder?: (path: string) => void;
}

export function Breadcrumbs({ filepath }: BreadcrumbsProps) {
  const parts = filepath.split('/');
  if (parts.length <= 1) return null; // No breadcrumbs for root-level files

  return (
    <nav className="breadcrumbs" aria-label="File path">
      {parts.map((part, i) => {
        const isLast = i === parts.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight size={12} className="breadcrumb-sep" />}
            <span className={`breadcrumb-item ${isLast ? 'breadcrumb-current' : 'breadcrumb-folder'}`}>
              {isLast ? part.replace(/\.md$/i, '') : part}
            </span>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
