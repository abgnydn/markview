// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { TocHeading } from '@/lib/markdown/pipeline';

interface TocProps {
  headings: TocHeading[];
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Table of contents with scroll-spy. Listens to the scroll container
 * and on every frame picks the heading whose top has most recently
 * passed the 28% mark of the container — that's the "current section."
 *
 * Why not IntersectionObserver: with rootMargin tuned to mid-page the
 * observer goes silent between hits and the active item gets stuck
 * (especially for long sections where no other heading is in the active
 * band). A scroll-driven pick is dumb but always correct.
 */
export function TableOfContents({ headings, scrollContainerRef }: TocProps) {
  const [activeId, setActiveId] = useState<string>('');
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (headings.length === 0) {
      setActiveId('');
      return;
    }
    const container = scrollContainerRef?.current;
    const scrollTarget: HTMLElement | Window = container ?? window;

    let raf = 0;
    const recompute = () => {
      raf = 0;
      // Sample the container's box. For window-scroll fall back to a
      // synthetic { top: 0, bottom: innerHeight } rect.
      const top = container ? container.getBoundingClientRect().top : 0;
      const height = container ? container.clientHeight : window.innerHeight;
      const triggerY = top + height * 0.28;

      let active = headings[0]?.id ?? '';
      for (const h of headings) {
        const el = document.getElementById(h.id);
        if (!el) continue;
        const elTop = el.getBoundingClientRect().top;
        if (elTop <= triggerY) active = h.id;
        else break;
      }
      setActiveId((prev) => (prev === active ? prev : active));
    };

    const onScroll = () => {
      if (raf !== 0) return;
      raf = requestAnimationFrame(recompute);
    };

    recompute();
    scrollTarget.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      scrollTarget.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf !== 0) cancelAnimationFrame(raf);
    };
  }, [headings, scrollContainerRef]);

  // Keep the active TOC item in view inside the nav itself — useful for
  // long docs where the TOC scrolls.
  useEffect(() => {
    if (!activeId || !navRef.current) return;
    const link = navRef.current.querySelector<HTMLElement>(`[data-toc-id="${activeId}"]`);
    if (!link) return;
    const navRect = navRef.current.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    if (linkRect.top < navRect.top || linkRect.bottom > navRect.bottom) {
      link.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [activeId]);

  const handleClick = useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (!el) return;
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
    },
    [scrollContainerRef],
  );

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

  return (
    <aside className="toc">
      <div className="toc-header">
        <h3 className="toc-title">On this page</h3>
      </div>
      <nav className="toc-nav" ref={navRef}>
        {headings.map((heading, i) => (
          <button
            key={`${heading.id}-${i}`}
            data-toc-id={heading.id}
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
