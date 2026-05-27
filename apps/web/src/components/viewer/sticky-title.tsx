// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState, type RefObject } from 'react';

/**
 * StickyTitle (#7) — once the user scrolls past the page's H1, show a
 * small-caps whisper-bar at the top of the viewport with the same
 * title. Slides back out when the H1 comes back into view. Pure
 * IntersectionObserver — no scroll listeners, no layout reads.
 *
 * Pairs with .sticky-title / .sticky-title-show in zen.css.
 */
export function StickyTitle({
  contentRef,
}: {
  contentRef: RefObject<HTMLElement | null>;
}) {
  const [title, setTitle] = useState<string>('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const h1 = root.querySelector('h1');
    if (!h1) {
      setTitle('');
      setVisible(false);
      return;
    }
    setTitle((h1.textContent || '').trim());
    const io = new IntersectionObserver(
      ([entry]) => {
        // Show the whisper-bar only when the H1 is fully out of view
        // ABOVE the viewport (user scrolled past it).
        if (!entry) return;
        const above = entry.boundingClientRect.top < 0 && !entry.isIntersecting;
        setVisible(above);
      },
      { rootMargin: '0px 0px 0px 0px', threshold: 0 },
    );
    io.observe(h1);
    return () => io.disconnect();
  });

  if (!title) return null;
  return (
    <div
      className={`sticky-title${visible ? ' sticky-title-show' : ''}`}
      aria-hidden="true"
    >
      {title}
    </div>
  );
}
