
import { useEffect, useRef, type RefObject } from 'react';

interface ReadingProgressProps {
  scrollContainerRef: RefObject<HTMLElement | null>;
}

export function ReadingProgress({ scrollContainerRef }: ReadingProgressProps) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    let raf = 0;

    // Write the width straight to the DOM — no React state, so a scroll
    // never triggers a re-render/reconcile on the hot path (that churn
    // dirtied layout each frame and compounded jank, especially with an
    // atmosphere's render loops running).
    const apply = () => {
      raf = 0;
      const bar = barRef.current;
      if (!bar) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      const max = scrollHeight - clientHeight;
      const pct = max <= 0 ? 0 : Math.min(100, (scrollTop / max) * 100);
      bar.style.width = `${pct}%`;
      bar.style.opacity = pct <= 0 ? '0' : '';
    };
    // Coalesce bursts of scroll events into a single write per frame.
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };

    container.addEventListener('scroll', onScroll, { passive: true });
    apply();
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollContainerRef]);

  return (
    <div className="reading-progress">
      <div className="reading-progress-bar" ref={barRef} style={{ width: '0%', opacity: 0 }} />
    </div>
  );
}
