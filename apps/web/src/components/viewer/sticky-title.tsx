// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState, type RefObject } from 'react';

interface Crumb { id: string; level: 1 | 2 | 3; text: string }

/**
 * StickyTitle (#7 + R9) — small-caps whisper-bar at the top of the
 * viewport that fades in once the H1 has scrolled out of view. Reads
 * as a live breadcrumb: H1 › current H2 › current H3, where the
 * "current" H2/H3 is the most recently passed heading of that level
 * (same logic as the TOC scroll-spy). Pairs with .sticky-title /
 * .sticky-title-crumbs / .sticky-title-sep in zen.css.
 */
export function StickyTitle({
  contentRef,
}: {
  contentRef: RefObject<HTMLElement | null>;
}) {
  const [h1, setH1] = useState<string>('');
  const [h2, setH2] = useState<string>('');
  const [h3, setH3] = useState<string>('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const h1El = root.querySelector('h1');
    setH1((h1El?.textContent || '').trim());
    if (!h1El) { setVisible(false); return; }

    let raf = 0;
    const recompute = () => {
      raf = 0;
      const triggerY = window.innerHeight * 0.18;
      // Show only after H1 scrolls past the trigger.
      const above = h1El.getBoundingClientRect().top < 0;
      setVisible(above);

      // Walk h2/h3 in document order, track last-passed at each level.
      const subs = root.querySelectorAll<HTMLHeadingElement>('h2, h3');
      let cur2 = '', cur3 = '';
      for (const el of Array.from(subs)) {
        const top = el.getBoundingClientRect().top;
        if (top > triggerY) break;
        const text = (el.textContent || '').replace(/^#\s*/, '').trim();
        if (el.tagName === 'H2') { cur2 = text; cur3 = ''; }
        else { cur3 = text; }
      }
      setH2(cur2);
      setH3(cur3);
    };

    const onScroll = () => { if (raf === 0) raf = requestAnimationFrame(recompute); };
    recompute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf !== 0) cancelAnimationFrame(raf);
    };
  });

  if (!h1) return null;
  const parts: Crumb[] = [{ id: 'h1', level: 1, text: h1 }];
  if (h2) parts.push({ id: 'h2', level: 2, text: h2 });
  if (h3) parts.push({ id: 'h3', level: 3, text: h3 });

  return (
    <div
      className={`sticky-title${visible ? ' sticky-title-show' : ''}`}
      aria-hidden="true"
    >
      <span className="sticky-title-crumbs">
        {parts.map((p, i) => (
          <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <span className="sticky-title-sep">›</span>}
            <span>{p.text}</span>
          </span>
        ))}
      </span>
    </div>
  );
}
