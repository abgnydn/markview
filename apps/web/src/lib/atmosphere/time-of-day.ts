// SPDX-License-Identifier: Apache-2.0

/**
 * Time-of-day tint — paints a CSS filter overlay on top of the active
 * atmosphere that shifts the scene's color temperature by the local
 * clock. Same painting, different hour-of-day mood.
 *
 *   05:00–08:00  dawn      — warm pink wash, slight sepia
 *   08:00–17:00  day       — neutral, no tint
 *   17:00–20:00  dusk      — amber + slight desaturation
 *   20:00–05:00  night     — blue shift, deeper contrast
 *
 * Writes `--atm-time-tint` on `<html>`. The atmosphere image picks
 * this up via CSS. Updates every 15 min while the page is open + on
 * visibilitychange so a long-running tab catches the next phase.
 *
 * Override: setting `<html data-time-tint="off">` disables the layer.
 */

export type TimeTintMode = 'auto' | 'off' | 'dawn' | 'day' | 'dusk' | 'night';

const TINTS: Record<Exclude<TimeTintMode, 'auto' | 'off'>, string> = {
  dawn:  'sepia(0.18) hue-rotate(-10deg) saturate(1.05) brightness(1.04)',
  day:   'none',
  dusk:  'sepia(0.22) hue-rotate(14deg) saturate(1.1) brightness(0.95)',
  night: 'hue-rotate(-22deg) saturate(0.85) brightness(0.78) contrast(1.05)',
};

let mode: TimeTintMode = 'auto';
try {
  const saved = localStorage.getItem('markview-time-tint') as TimeTintMode | null;
  if (saved) mode = saved;
} catch {
  /* ignore */
}

let updateHandle: number | null = null;

function phaseForHour(h: number): Exclude<TimeTintMode, 'auto' | 'off'> {
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}

function apply() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'off') {
    root.style.setProperty('--atm-time-tint', 'none');
    root.setAttribute('data-time-phase', 'off');
    return;
  }
  const phase = mode === 'auto' ? phaseForHour(new Date().getHours()) : mode;
  root.style.setProperty('--atm-time-tint', TINTS[phase]);
  root.setAttribute('data-time-phase', phase);
}

/** Call once on app boot. Sets the var + schedules quarter-hour updates. */
export function initTimeOfDayTint() {
  apply();
  if (updateHandle !== null) window.clearInterval(updateHandle);
  updateHandle = window.setInterval(apply, 15 * 60 * 1000);
  // Catch phase transitions when the tab returns to focus.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) apply();
  });
}

export function setTimeTintMode(next: TimeTintMode) {
  mode = next;
  try { localStorage.setItem('markview-time-tint', next); } catch { /* ignore */ }
  apply();
}

export function getTimeTintMode(): TimeTintMode {
  return mode;
}

export function currentTimeTintPhase(): string {
  if (mode === 'off') return 'off';
  if (mode === 'auto') return phaseForHour(new Date().getHours());
  return mode;
}
