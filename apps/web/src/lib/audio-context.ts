// SPDX-License-Identifier: Apache-2.0

/**
 * Shared AudioContext constructor lookup. Safari (pre-14.1 and some WebKit
 * shells) only exposes the prefixed `webkitAudioContext` — this shim was
 * copy-pasted in four places (atmosphere audio, waveform enhancer,
 * constellation sfx, presentation advance-sound) before living here.
 */
export function getAudioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}
