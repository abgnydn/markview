/**
 * useBrainDocs — hook that returns live VaultDoc[] from apps/hub.
 *
 * - Polls /api/brain/docs every 10s so frontmatter updates (cost, context, status)
 *   show up in the orbit.
 * - Subscribes to /api/brain/events so session docs can pulse on tool_use events.
 *   Pulse state is exposed as a ref keyed by pid; vault-orbit reads it each frame.
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchBrainDocs,
  subscribeBrainEvents,
  type FleetEvent,
} from '@/lib/brain-hub-client';
import type { VaultDoc } from './vault-store';

export interface PulseMap {
  /** pid → last pulse timestamp (ms since epoch). Mutated in place. */
  current: Map<number, number>;
  /** Bump this to force re-render when pulse TTLs expire. */
  tick: number;
}

export interface UseBrainDocsResult {
  docs: VaultDoc[];
  loading: boolean;
  error: string | null;
  pulses: React.MutableRefObject<Map<number, number>>;
  pulseTick: number;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL_MS = 10_000;
const PULSE_EXPIRE_TICK_MS = 250;

export function useBrainDocs(): UseBrainDocsResult {
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pulseTick, setPulseTick] = useState(0);
  const pulses = useRef<Map<number, number>>(new Map());

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const fresh = await fetchBrainDocs();
      setDocs(fresh);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Polling loop
  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  // Pulse expiration — force a tick every 250ms so rings fade out even
  // if no new event arrives.
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [pid, ts] of pulses.current) {
        if (now - ts > 800) {
          pulses.current.delete(pid);
          changed = true;
        }
      }
      if (changed) setPulseTick((t) => t + 1);
    }, PULSE_EXPIRE_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  // Live SSE events → pulses
  useEffect(() => {
    const close = subscribeBrainEvents((ev: FleetEvent) => {
      const now = Date.now();
      let changed = false;
      for (const pid of ev.pids ?? []) {
        pulses.current.set(pid, now);
        changed = true;
      }
      if (changed) setPulseTick((t) => t + 1);
    });
    return close;
  }, []);

  return useMemo(
    () => ({ docs, loading, error, pulses, pulseTick, refresh }),
    [docs, loading, error, pulseTick, refresh],
  );
}
