// SPDX-License-Identifier: Apache-2.0

/**
 * A requestAnimationFrame loop that automatically pauses when the tab
 * is hidden and resumes when it returns. Centralizes the
 * visibilitychange dance that every atmosphere render loop needs, so
 * new loops are correct-by-default instead of quietly burning GPU in
 * background tabs.
 *
 *   const loop = startRafLoop((dt, now) => { ...render... });
 *   // later
 *   loop.stop();
 *
 * The callback receives `dt` (seconds since last frame, clamped to
 * 0.05 so a resume gap never produces a giant step) and `now`
 * (performance.now()). On resume after a hidden pause the internal
 * clock is reset, so the first `dt` back is a normal frame.
 *
 * `onResume` (optional) runs once each time the loop wakes from a
 * hidden pause — use it to re-sync any external timestamps the
 * callback reads outside of `dt`.
 */
export interface RafLoop {
  stop(): void;
}

export function startRafLoop(
  frame: (dt: number, now: number) => void,
  opts: { onResume?: () => void } = {},
): RafLoop {
  let rafId = 0;
  let last = performance.now();
  let stopped = false;

  const tick = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frame(dt, now);
    rafId = requestAnimationFrame(tick);
  };

  const onVis = () => {
    if (document.hidden) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    } else if (!rafId && !stopped) {
      last = performance.now();
      opts.onResume?.();
      rafId = requestAnimationFrame(tick);
    }
  };

  document.addEventListener('visibilitychange', onVis);
  rafId = requestAnimationFrame(tick);

  return {
    stop() {
      stopped = true;
      document.removeEventListener('visibilitychange', onVis);
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    },
  };
}
