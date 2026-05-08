'use client';

import type { VaultState } from './vault-store';

/**
 * Encode an entire vault (name + docs) as a shareable URL.
 * Pattern mirrors the existing single-doc URL share — gzip + base64url
 * in the hash fragment, so nothing touches a server.
 */
export async function encodeVaultUrl(state: VaultState): Promise<string> {
  const json = JSON.stringify(state);
  const encoder = new TextEncoder();
  const stream = new Blob([encoder.encode(json)])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));
  const compressed = await new Response(stream).arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(compressed)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/vault#v=${base64}`;
}

export async function decodeVaultUrl(hash: string): Promise<VaultState | null> {
  if (!hash || !hash.includes('v=')) return null;
  try {
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const b64 = params.get('v');
    if (!b64) return null;
    const padded =
      b64.replace(/-/g, '+').replace(/_/g, '/') +
      '==='.slice(0, (4 - (b64.length % 4)) % 4);
    const compressed = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const stream = new Blob([compressed])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));
    const text = await new Response(stream).text();
    const parsed = JSON.parse(text) as VaultState;
    if (!parsed.name || !Array.isArray(parsed.docs)) return null;
    return parsed;
  } catch {
    return null;
  }
}
