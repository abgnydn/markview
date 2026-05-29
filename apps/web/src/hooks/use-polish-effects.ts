// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';

/**
 * usePolishEffects — mount-once ambient hooks for the polish layer.
 * Each effect is independent and toggles a body class or CSS custom
 * property that the styles in zen.css respond to. Centralized here
 * so viewer-page stays clean and we can adjust thresholds in one place.
 *
 *   N2  Hold-⌘ 600ms        → body.mv-keyhint-show
 *   N5  Fast scroll (>1.5px/ms) → body.mv-fast-scroll (cleared on settle)
 *   N17 Mouse over .viewer-main → updates --cursor-x / --cursor-y on it
 *   N20 30s idle             → body.mv-idle (cleared on any input)
 */
export function usePolishEffects(): void {
  // N2 — hold ⌘ (or Ctrl) for 600ms to reveal keyhints. Release to hide.
  useEffect(() => {
    let timer: number | null = null;
    const isMeta = (e: KeyboardEvent) =>
      e.key === 'Meta' || e.key === 'Control';
    const onDown = (e: KeyboardEvent) => {
      if (!isMeta(e)) return;
      if (timer !== null) return;
      timer = window.setTimeout(() => {
        document.body.classList.add('mv-keyhint-show');
        timer = null;
      }, 600);
    };
    const onUp = (e: KeyboardEvent) => {
      if (!isMeta(e)) return;
      if (timer !== null) { window.clearTimeout(timer); timer = null; }
      document.body.classList.remove('mv-keyhint-show');
    };
    const onBlur = () => {
      if (timer !== null) { window.clearTimeout(timer); timer = null; }
      document.body.classList.remove('mv-keyhint-show');
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  // N5 — velocity-aware atmosphere dim. Tracks scroll dy/dt; if it
  // exceeds ~1.5 px/ms (fast flick) we dim, clearing on settle.
  useEffect(() => {
    let lastY = window.scrollY;
    let lastT = performance.now();
    let clearTimer: number | null = null;
    const onScroll = () => {
      const now = performance.now();
      const dy = Math.abs(window.scrollY - lastY);
      const dt = Math.max(1, now - lastT);
      lastY = window.scrollY;
      lastT = now;
      if (dy / dt > 1.5) {
        document.body.classList.add('mv-fast-scroll');
        if (clearTimer !== null) window.clearTimeout(clearTimer);
        clearTimer = window.setTimeout(() => {
          document.body.classList.remove('mv-fast-scroll');
        }, 280);
      }
    };
    // Also listen on the viewer-main scroller (the actual scroll container).
    const main = document.querySelector('.viewer-main');
    const targets: (Window | Element)[] = main ? [window, main] : [window];
    targets.forEach((t) => t.addEventListener('scroll', onScroll, { passive: true }));
    return () => {
      targets.forEach((t) => t.removeEventListener('scroll', onScroll));
      if (clearTimer !== null) window.clearTimeout(clearTimer);
    };
  }, []);

  // N17 — soft highlighter cursor in viewer. Track mouse over
  // .viewer-main and update its --cursor-x / --cursor-y custom props.
  // rAF-throttled to one update per frame.
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('.viewer-main');
    if (!main) return;
    let raf = 0;
    let pendingX = 0;
    let pendingY = 0;
    const apply = () => {
      raf = 0;
      main.style.setProperty('--cursor-x', `${pendingX}px`);
      main.style.setProperty('--cursor-y', `${pendingY}px`);
    };
    const onMove = (e: MouseEvent) => {
      pendingX = e.clientX;
      pendingY = e.clientY;
      if (raf === 0) raf = requestAnimationFrame(apply);
    };
    main.addEventListener('mousemove', onMove);
    return () => {
      main.removeEventListener('mousemove', onMove);
      if (raf !== 0) cancelAnimationFrame(raf);
    };
  });

  // N20 — idle "stay with it" lift. After 30s of no input, body
  // gets .mv-idle which the CSS uses to brighten the atmosphere by 6%
  // and settle the grain. Any keyboard / mouse / scroll event resets.
  useEffect(() => {
    let timer: number | null = null;
    const arm = () => {
      if (timer !== null) window.clearTimeout(timer);
      document.body.classList.remove('mv-idle');
      timer = window.setTimeout(() => {
        document.body.classList.add('mv-idle');
      }, 30_000);
    };
    const events: Array<keyof WindowEventMap> = ['keydown', 'mousemove', 'scroll', 'touchstart', 'pointerdown'];
    events.forEach((ev) => window.addEventListener(ev, arm, { passive: true }));
    arm();
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, arm));
      if (timer !== null) window.clearTimeout(timer);
      document.body.classList.remove('mv-idle');
    };
  }, []);

}
