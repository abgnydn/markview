// SPDX-License-Identifier: Apache-2.0
/**
 * Mount sway — the hanging scroll moves in the wind.
 *
 * The particle field publishes the wind it is blowing through wind.ts
 * (`getWind()`: gust 0..1, dir -1 | 1). This reads it at 10 Hz and drives
 * a damped spring on a rotation angle, written each frame as an inline
 * `rotate` on `.viewer-content`; zen.css puts the pivot at the top of the
 * cord and keeps the mount on its own compositor layer.
 *
 * Written on the element, not as a custom property on <html>: a custom
 * property inherits, so one write on the root recalculated style for every
 * element in the document — measured at ~6 ms a write on the welcome doc,
 * which in a gust is most of the frame budget. An inline rotate touches one
 * element's style and costs under a millisecond of paint per change.
 *
 * A spring, not a tween: a gust leans the scroll over, and when it drops
 * the scroll swings back through its rest and settles, the way a real
 * kakejiku does after a door opens. Under-damped so it overshoots; 0.5 Hz
 * so the swing reads as a heavy object, not a flag. When the air is still
 * a slow sine breathes the scroll a fraction of a degree either way, so it
 * never looks pinned.
 */

import { getWind } from '@/lib/atmosphere/wind';

const POLL_MS = 100;                    // the wind changes slowly; read it at 10 Hz
const GUST_DEG = 0.9;                   // where a full gust leans the scroll to
const OMEGA = 2 * Math.PI * 0.5;        // natural frequency, 0.5 Hz
const ZETA = 0.35;                      // damping ratio — under 1, so it swings past and settles
const BREATH_DEG = 0.15;                // idle drift when nothing is blowing
const BREATH_OMEGA = (2 * Math.PI) / 11; // one idle breath every 11 s
const WRITE_EPS = 0.002;                // deg — smaller moves are not worth a style write
const WRITE_MS = 50;                    // each write repaints the mount (~1 ms); 20 Hz is smooth for a 0.5 Hz swing
const MAX_DEG = 1.5;                    // hard cap — the spring cannot reach it, a bad wind value must not either
const MAX_DT = 0.1;                     // s — a tab back from the background takes a small step, not one huge one

/** Starts the sway loop. Returns a function that stops it and clears the angle. */
export function startMountSway(): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let mount: HTMLElement | null = null;
  let raf = 0;
  let angle = 0;           // deg, the spring's position
  let velocity = 0;        // deg/s
  let target = 0;          // deg, where the wind is pushing the scroll toward
  let last = 0;            // ms, previous frame
  let lastRead = -POLL_MS; // ms, previous wind read
  let lastWrite = -WRITE_MS; // ms, previous rotate write
  let lastWritten = 0;     // deg, what the mount currently has (no inline rotate = 0)

  const readWind = () => {
    // The mount is looked up on the wind's clock, not the frame's — a class
    // query is cheap, but there is no reason to run it 60 times a second.
    if (!mount?.isConnected) mount = document.querySelector<HTMLElement>('.viewer-content');
    const { gust, dir } = getWind();
    target = Math.min(1, Math.max(0, gust)) * (dir < 0 ? -1 : 1) * GUST_DEG;
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(MAX_DT, (now - last) / 1000);
    last = now;
    if (now - lastRead >= POLL_MS) {
      lastRead = now;
      readWind();
    }
    // x'' = ω²(target − x) − 2ζω·x', integrated semi-implicitly: stable at
    // any frame rate we will see, and it keeps the overshoot a tween loses.
    velocity += (OMEGA * OMEGA * (target - angle) - 2 * ZETA * OMEGA * velocity) * dt;
    angle += velocity * dt;
    const out = Math.max(-MAX_DEG, Math.min(MAX_DEG, angle + BREATH_DEG * Math.sin((now / 1000) * BREATH_OMEGA)));
    if (mount && now - lastWrite >= WRITE_MS && Math.abs(out - lastWritten) > WRITE_EPS) {
      lastWrite = now;
      lastWritten = out;
      mount.style.rotate = `${out.toFixed(3)}deg`;
    }
  };

  const start = () => {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastWritten = 0;
    mount?.style.removeProperty('rotate');
  };
  // Reduced motion: a still scroll. Followed live, so flipping the OS
  // setting mid-session takes effect without a reload.
  const onMotionPref = () => (reduced.matches ? stop() : start());
  onMotionPref();
  reduced.addEventListener('change', onMotionPref);

  return () => {
    reduced.removeEventListener('change', onMotionPref);
    stop();
  };
}
