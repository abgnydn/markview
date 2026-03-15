'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { TocHeading } from '@/lib/markdown/pipeline';

interface TocProps {
  headings: TocHeading[];
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

export function TableOfContents({ headings, scrollContainerRef }: TocProps) {
  const [activeId, setActiveId] = useState<string>('');
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setupObserver = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const headingElements = headings
      .map((h) => document.getElementById(h.id))
      .filter(Boolean) as HTMLElement[];

    if (headingElements.length === 0) return;

    // Use the scroll container as the root if available, otherwise viewport
    const root = scrollContainerRef?.current || null;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Collect all currently visible headings
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        root,
        rootMargin: '-80px 0px -65% 0px',
        threshold: 0,
      }
    );

    headingElements.forEach((el) => observerRef.current!.observe(el));

    // Set initial active heading (first one visible)
    if (headingElements.length > 0 && !activeId) {
      setActiveId(headingElements[0].id);
    }

    return () => observerRef.current?.disconnect();
  }, [headings, scrollContainerRef, activeId]);

  useEffect(() => {
    // Delay to let DOM render heading IDs
    const timer = setTimeout(setupObserver, 300);
    return () => {
      clearTimeout(timer);
      observerRef.current?.disconnect();
    };
  }, [setupObserver]);

  if (headings.length === 0) {
    return (
      <aside className="toc">
        <div className="toc-skeleton">
          <div className="skeleton-line" style={{ width: '50%' }} />
          <div className="skeleton-line" style={{ width: '80%' }} />
          <div className="skeleton-line" style={{ width: '65%' }} />
          <div className="skeleton-line" style={{ width: '90%' }} />
          <div className="skeleton-line" style={{ width: '55%' }} />
          <div className="skeleton-line" style={{ width: '70%' }} />
          <div className="skeleton-line" style={{ width: '45%' }} />
          <div className="skeleton-line" style={{ width: '75%' }} />
        </div>
      </aside>
    );
  }

  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;

    // Use the scroll container for scrolling
    const container = scrollContainerRef?.current;
    if (container) {
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const offset = elRect.top - containerRect.top + container.scrollTop - 24;
      container.scrollTo({ top: offset, behavior: 'smooth' });
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setActiveId(id);
  };

  return (
    <aside className="toc">
      <div className="toc-header">
        <h3 className="toc-title">On this page</h3>
      </div>
      <nav className="toc-nav">
        {headings.map((heading, i) => (
          <button
            key={`${heading.id}-${i}`}
            className={`toc-item toc-item-level-${heading.level} ${
              activeId === heading.id ? 'toc-item-active' : ''
            }`}
            onClick={() => handleClick(heading.id)}
          >
            {heading.text}
          </button>
        ))}
      </nav>
    </aside>
  );
}
