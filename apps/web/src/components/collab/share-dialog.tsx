'use client';

import { useState } from 'react';
import { Share2, Copy, Check, X } from 'lucide-react';
import { useCollabStore } from '@/stores/collab-store';
import { useWorkspaceStore } from '@/stores/workspace-store';

export function ShareDialog({ onClose }: { onClose: () => void }) {
  const { shareWorkspace, isActive, shareUrl, leaveSession } = useCollabStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    try {
      await shareWorkspace(activeWorkspaceId);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStop = () => {
    leaveSession();
    onClose();
  };

  return (
    <div className="collab-dialog-overlay" onClick={onClose}>
      <div className="collab-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="collab-dialog-header">
          <Share2 size={18} />
          <span>Share Workspace</span>
          <button className="collab-dialog-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {!isActive ? (
          <div className="collab-dialog-body">
            <p className="collab-dialog-desc">
              Share your workspace via peer-to-peer connection.
              No server — documents transfer directly between browsers.
            </p>
            <button
              className="collab-btn-primary"
              onClick={handleShare}
              disabled={loading || !activeWorkspaceId}
            >
              {loading ? 'Starting…' : 'Start Sharing'}
            </button>
          </div>
        ) : (
          <div className="collab-dialog-body">
            <p className="collab-dialog-desc">
              Your workspace is being shared. Send this link to collaborators:
            </p>
            <div className="collab-share-url-box">
              <code className="collab-share-url">{shareUrl}</code>
              <button className="collab-btn-icon" onClick={handleCopy} title="Copy link">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <button className="collab-btn-danger" onClick={handleStop}>
              Stop Sharing
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
