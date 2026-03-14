'use client';

import React, { useEffect, useState, type RefObject } from 'react';

interface ReadingProgressProps {
  scrollContainerRef: RefObject<HTMLElement | null>;
}

export function ReadingProgress({ scrollContainerRef }: ReadingProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const max = scrollHeight - clientHeight;
      if (max <= 0) {
        setProgress(0);
        return;
      }
      setProgress(Math.min(100, (scrollTop / max) * 100));
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef]);

  if (progress === 0) return null;

  return (
    <div className="reading-progress">
      <div className="reading-progress-bar" style={{ width: `${progress}%` }} />
    </div>
  );
}
