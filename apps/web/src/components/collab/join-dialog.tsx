'use client';

import { useState } from 'react';
import { Users, X } from 'lucide-react';
import { useCollabStore } from '@/stores/collab-store';

export function JoinDialog({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const { joinRoom, isConnecting } = useCollabStore();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    const userName = name.trim() || 'Guest';
    setError(null);
    try {
      await joinRoom(roomId, userName);
    } catch (e) {
      setError('Failed to connect. The host may have stopped sharing.');
    }
  };

  return (
    <div className="collab-dialog-overlay">
      <div className="collab-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="collab-dialog-header">
          <Users size={18} />
          <span>Join Session</span>
          <button className="collab-dialog-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="collab-dialog-body">
          <p className="collab-dialog-desc">
            You&apos;ve been invited to view a shared workspace.
            Enter your name to join.
          </p>
          <input
            className="collab-input"
            type="text"
            placeholder="Your name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            autoFocus
          />
          {error && <p className="collab-error">{error}</p>}
          <button
            className="collab-btn-primary"
            onClick={handleJoin}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting…' : 'Join'}
          </button>
        </div>
      </div>
    </div>
  );
}
