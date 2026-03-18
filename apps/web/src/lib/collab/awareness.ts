'use client';

import type { WebrtcProvider } from 'y-webrtc';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PeerInfo {
  id: number;
  name: string;
  color: string;
  activeFileId: string | null;
}

interface AwarenessUserState {
  user?: {
    name?: string;
    color?: string;
    activeFileId?: string | null;
  };
}

// Curated palette for peer colors
const PEER_COLORS = [
  '#818cf8', // indigo
  '#34d399', // emerald
  '#f472b6', // pink
  '#fbbf24', // amber
  '#60a5fa', // blue
  '#a78bfa', // violet
  '#fb923c', // orange
  '#2dd4bf', // teal
];

// ---------------------------------------------------------------------------
// Awareness helpers
// ---------------------------------------------------------------------------

/** Set local user info in the awareness protocol */
export function setLocalUser(
  provider: WebrtcProvider,
  name: string,
  activeFileId: string | null = null
): void {
  const awareness = provider.awareness;
  const clientId = awareness.clientID;
  const color = PEER_COLORS[clientId % PEER_COLORS.length];

  awareness.setLocalStateField('user', {
    name,
    color,
    activeFileId,
  });
}

/** Update which file the local user is viewing */
export function setLocalActiveFile(
  provider: WebrtcProvider,
  activeFileId: string | null
): void {
  const awareness = provider.awareness;
  const current = awareness.getLocalState() as AwarenessUserState | null;
  if (current?.user) {
    awareness.setLocalStateField('user', {
      ...(current.user as Record<string, unknown>),
      activeFileId,
    });
  }
}

/** Get all connected peers (excluding self) */
export function getConnectedPeers(provider: WebrtcProvider): PeerInfo[] {
  const awareness = provider.awareness;
  const localId = awareness.clientID;
  const peers: PeerInfo[] = [];

  awareness.getStates().forEach((rawState, clientId) => {
    if (clientId === localId) return;
    const state = rawState as AwarenessUserState;
    if (!state.user) return;

    peers.push({
      id: clientId,
      name: state.user.name || 'Anonymous',
      color: state.user.color || PEER_COLORS[clientId % PEER_COLORS.length],
      activeFileId: state.user.activeFileId || null,
    });
  });

  return peers;
}

/** Subscribe to awareness changes (peers joining/leaving, file changes) */
export function onAwarenessChange(
  provider: WebrtcProvider,
  callback: (peers: PeerInfo[]) => void
): () => void {
  const handler = () => callback(getConnectedPeers(provider));
  provider.awareness.on('change', handler);
  return () => provider.awareness.off('change', handler);
}
