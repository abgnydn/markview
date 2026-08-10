// SPDX-License-Identifier: Apache-2.0

import { useCollabStore } from '@/stores/collab-store';
import { useWorkspaceStore } from '@/stores/workspace-store';

/**
 * PresenceAvatars (R19) — tiny italic-serif initials of every other
 * peer in the room, clustered above the ShareStatus pill in the
 * bottom-right. Each avatar uses the peer's chosen color; clicking
 * jumps your viewport to that peer's active file (if you have it).
 *
 * Renders nothing when not in a collab room or no peers connected.
 */
export function PresenceAvatars() {
  const isActive = useCollabStore((s) => s.isActive);
  const isHost = useCollabStore((s) => s.isHost);
  const peers = useCollabStore((s) => s.peers);
  const setSyncedActiveFile = useCollabStore((s) => s.setSyncedActiveFile);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);

  if (!isActive || peers.length === 0) return null;

  // getConnectedPeers already excludes self by clientID — filtering by
  // display name here would just hide other peers who share your name.
  const others = peers;

  // Following a peer means jumping to their file in the SHARED doc: for
  // guests that's the synced store; for the host the shared ids are their
  // own local file ids, so the workspace store works directly.
  const follow = (fileId: string) => {
    if (isHost) void setActiveFile(fileId);
    else setSyncedActiveFile(fileId);
  };

  return (
    <div className="mv-presence-cluster" role="group" aria-label="Connected peers">
      {others.slice(0, 6).map((p) => {
        const initial = (p.name || '?').trim().charAt(0).toUpperCase() || '?';
        return (
          <button
            key={p.id}
            type="button"
            className="mv-presence-avatar"
            style={{
              ['--peer-color' as string]: p.color,
              borderColor: p.color,
              color: p.color,
            }}
            title={`${p.name}${p.activeFileId ? ' — click to follow' : ''}`}
            onClick={() => { if (p.activeFileId) follow(p.activeFileId); }}
          >
            {initial}
          </button>
        );
      })}
      {others.length > 6 && (
        <span className="mv-presence-overflow" title={`+${others.length - 6} more peers`}>
          +{others.length - 6}
        </span>
      )}
    </div>
  );
}
