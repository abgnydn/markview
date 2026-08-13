// SPDX-License-Identifier: Apache-2.0

/**
 * Room id/secret + share-URL helpers — deliberately free of any yjs /
 * y-webrtc import. The landing page needs `getRoomIdFromUrl` to decide
 * whether to show the join dialog, and importing it from y-provider used
 * to drag the entire collab stack (yjs + y-webrtc + simple-peer ≈ 64 KB
 * gz) into every cold landing load. Keep this module dependency-light.
 */

export function generateRoomId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `mkv-${id}`;
}

/** Generate the room secret carried in the URL *fragment*. Fragments are
 *  never sent to any server (ours included), so only holders of the full
 *  link can decrypt the room's signaling exchange. */
export function generateRoomSecret(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Extract room ID from URL */
export function getRoomIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('room');
}

/** Extract the room secret from the URL fragment (`#k=...`). Absent on
 *  links minted before secrets existed — those rooms join unencrypted. */
export function getRoomSecretFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const m = /(?:^#|&)k=([A-Za-z0-9_-]+)/.exec(window.location.hash);
  return m ? m[1] : null;
}

/** Build share URL from room ID + secret. The secret rides the fragment. */
export function getShareUrl(roomId: string, secret?: string): string {
  if (typeof window === 'undefined') return '';
  const base = window.location.origin;
  return secret ? `${base}?room=${roomId}#k=${secret}` : `${base}?room=${roomId}`;
}
