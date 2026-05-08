/**
 * Brain Hub client — client-side fetch helpers for apps/hub (Hono server on :3100).
 *
 * Used by pages that want to render live vault + session data instead of the
 * localStorage demo vault. Runs entirely in the browser; apps/web stays static.
 */

'use client';

import type { VaultDoc } from '@/components/vault/vault-store';

const DEFAULT_BASE = 'http://127.0.0.1:3100';

export function brainHubBase(): string {
  if (typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search).get('hub');
    if (q) return q.replace(/\/$/, '');
  }
  return process.env.NEXT_PUBLIC_BRAIN_HUB_URL ?? DEFAULT_BASE;
}

export interface BrainHubDoc extends VaultDoc {
  // Matches the server's /api/brain/docs shape (VaultDoc + brain extras).
  // VaultDoc already carries the optional brain-extra fields.
  _dummy?: undefined;
}

export async function fetchBrainDocs(signal?: AbortSignal): Promise<VaultDoc[]> {
  const res = await fetch(`${brainHubBase()}/api/brain/docs`, {
    cache: 'no-store',
    signal,
  });
  if (!res.ok) throw new Error(`hub fetch failed: ${res.status}`);
  const j = (await res.json()) as { docs: VaultDoc[] };
  return j.docs ?? [];
}

export interface FleetEvent {
  ts: number;
  slug: string;
  pids: number[];
  tool: string;
}

/** Open an EventSource to /api/brain/events; returns a close() fn. */
export function subscribeBrainEvents(onEvent: (ev: FleetEvent) => void): () => void {
  const base = brainHubBase();
  let closed = false;
  let es: EventSource | null = null;
  const connect = (): void => {
    if (closed) return;
    es = new EventSource(`${base}/api/brain/events`);
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as FleetEvent;
        onEvent(ev);
      } catch {
        /* ignore malformed */
      }
    };
    es.onerror = () => {
      es?.close();
      if (!closed) setTimeout(connect, 3_000);
    };
  };
  connect();
  return () => {
    closed = true;
    es?.close();
  };
}

export async function focusIterm(pid: number): Promise<{ ok: boolean; result: string }> {
  try {
    const res = await fetch(`${brainHubBase()}/api/brain/focus/${pid}`, { method: 'POST' });
    if (!res.ok) return { ok: false, result: `HTTP ${res.status}` };
    return (await res.json()) as { ok: boolean; result: string };
  } catch (e) {
    return { ok: false, result: String(e) };
  }
}
