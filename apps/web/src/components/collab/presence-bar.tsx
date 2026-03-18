'use client';

import { useCollabStore } from '@/stores/collab-store';

export function PresenceBar() {
  const { isActive, isHost, peers, localUserName, roomId, leaveSession } = useCollabStore();

  if (!isActive) return null;

  const totalPeople = peers.length + 1; // +1 for self

  return (
    <div className="collab-presence-bar">
      <div className="collab-presence-status">
        <span className="collab-presence-dot" />
        <span className="collab-presence-label">
          {isHost ? 'Sharing' : 'Viewing'} · {totalPeople} {totalPeople === 1 ? 'person' : 'people'}
        </span>
      </div>
      <div className="collab-presence-avatars">
        {/* Self */}
        <div
          className="collab-avatar"
          title={`${localUserName} (you)`}
          style={{ background: '#818cf8' }}
        >
          {localUserName.charAt(0).toUpperCase()}
        </div>
        {/* Peers */}
        {peers.map((peer) => (
          <div
            key={peer.id}
            className="collab-avatar"
            title={peer.name}
            style={{ background: peer.color }}
          >
            {peer.name.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
      <button
        className="collab-leave-btn"
        onClick={leaveSession}
        title={isHost ? 'Stop sharing' : 'Leave session'}
      >
        {isHost ? 'Stop' : 'Leave'}
      </button>
    </div>
  );
}
