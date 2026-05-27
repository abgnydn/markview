// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import type { Atmosphere } from '@/stores/theme-store';

/**
 * useAtmosphereRotation — schedules automatic painting-rotation ticks
 * for the active atmosphere based on the current tempo (hourly, every
 * 5m, every 15m, daily). Returns a `paintingNonce` that bumps every
 * time the painting should be re-picked; pass it to
 * `<PaintingAtmosphere paintingNonce={...} />`.
 *
 * Also listens for the `markview:cycle-painting` window event (fired
 * by the sidebar's next/shuffle buttons) so manual cycling and timed
 * rotation share one nonce source.
 */
export function useAtmosphereRotation(atmosphere: Atmosphere): number {
  const [paintingNonce, setPaintingNonce] = useState(0);

  // Manual cycle event (from sidebar buttons).
  useEffect(() => {
    const onCycle = () => setPaintingNonce((n) => n + 1);
    window.addEventListener('markview:cycle-painting', onCycle);
    return () => window.removeEventListener('markview:cycle-painting', onCycle);
  }, []);

  // Timed rotation — schedules the next tick based on the tempo. Reruns
  // when tempo changes via the `markview:rotation-tempo-changed` event.
  useEffect(() => {
    let timeoutId: number | null = null;
    const schedule = async () => {
      const { getRotationTempo, nextRotationAtMs } = await import('@/components/atmosphere/atmospheres');
      const tempo = getRotationTempo();
      const ms = nextRotationAtMs(tempo);
      if (!Number.isFinite(ms)) return;
      timeoutId = window.setTimeout(() => {
        setPaintingNonce((n) => n + 1);
        void schedule();
      }, Math.max(1000, ms));
    };
    void schedule();
    const onTempoChange = () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      void schedule();
    };
    window.addEventListener('markview:rotation-tempo-changed', onTempoChange);
    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      window.removeEventListener('markview:rotation-tempo-changed', onTempoChange);
    };
  }, [atmosphere]);

  return paintingNonce;
}
