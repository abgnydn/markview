// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';

/**
 * ReadingDepthDial (R12) — slim vertical thermometer bottom-right
 * that fills as you scroll deeper into the document. Companion to the
 * existing reading thread at the very top (which is a horizontal
 * progress bar). Together they bracket the page: thread tells you
 * how much is left, dial tells you where you are.
 *
 * rAF-throttled scroll listener; only rerenders when the percentage
 * actually changes. Hides on touch / coarse pointer since it's a
 * mouse-hover affordance.
 */
export function ReadingDepthDial() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let raf = 0;
    const recompute = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) { setPct(0); return; }
      const next = Math.min(1, Math.max(0, window.scrollY / max));
      setPct((p) => (Math.abs(p - next) < 0.005 ? p : next));
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
  }, []);

  return (
    <div className="mv-depth-dial" aria-hidden="true">
      <div className="mv-depth-dial-fill" style={{ height: `${pct * 100}%` }} />
    </div>
  );
}
