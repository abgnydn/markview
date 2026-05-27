// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { Users, Copy, Check, Square, ChevronDown } from 'lucide-react';
import { useCollabStore } from '@/stores/collab-store';

/**
 * ShareStatus — a single floating collab widget pinned to the bottom-right
 * of the viewport. Replaces the old top-of-viewport presence bar (which
 * fought the toolbar for vertical space) AND the sidebar-only share button
 * (which was hidden whenever the sidebar wasn't open).
 *
 * Collapsed: a small paper-card pill — pulsing violet dot + "Sharing · N".
 * Expanded: shows the share URL, peer avatars, and a Stop button.
 *
 * Inspired by Linear / Obsidian's bottom-right status widgets — keeps the
 * top chrome zen and reading-quiet.
 */
export function ShareStatus() {
  const isActive = useCollabStore((s) => s.isActive);
  const isHost = useCollabStore((s) => s.isHost);
  const peers = useCollabStore((s) => s.peers);
  const roomId = useCollabStore((s) => s.roomId);
  const localUserName = useCollabStore((s) => s.localUserName);
  const setLocalUserName = useCollabStore((s) => s.setLocalUserName);
  const leaveSession = useCollabStore((s) => s.leaveSession);

  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(localUserName);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Reset the draft whenever the store name changes (e.g. user renamed
  // from another tab or load-from-localStorage finished).
  useEffect(() => { setNameDraft(localUserName); }, [localUserName]);

  // Close on click outside.
  useEffect(() => {
    if (!expanded) return;
    const onDown = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [expanded]);

  if (!isActive) return null;
  const peopleCount = peers.length + 1;
  const shareUrl = roomId ? `${window.location.origin}/?room=${roomId}` : '';

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={`collab-status${expanded ? ' collab-status-expanded' : ''}`} ref={cardRef}>
      {!expanded ? (
        <button
          className="collab-status-pill"
          onClick={() => setExpanded(true)}
          title={`${isHost ? 'Sharing' : 'Viewing'} — click to manage`}
        >
          <span className="collab-status-dot" />
          <Users size={12} className="collab-status-icon" />
          <span className="collab-status-text">
            {isHost ? 'Sharing' : 'Viewing'}
          </span>
          <span className="collab-status-count">{peopleCount}</span>
        </button>
      ) : (
        <div className="collab-status-card">
          <div className="collab-status-card-header">
            <span className="collab-status-dot" />
            <span className="collab-status-card-title">
              {isHost ? 'Sharing this workspace' : 'Viewing a shared workspace'}
            </span>
            <button
              className="collab-status-collapse"
              onClick={() => setExpanded(false)}
              title="Collapse"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          <div className="collab-status-people">
            <div
              className="collab-status-avatar"
              title={`${localUserName} (you)`}
              style={{ background: 'var(--zen-accent)' }}
            >
              {localUserName.charAt(0).toUpperCase()}
            </div>
            {peers.map((peer) => (
              <div
                key={peer.id}
                className="collab-status-avatar"
                title={peer.name}
                style={{ background: peer.color }}
              >
                {peer.name.charAt(0).toUpperCase()}
              </div>
            ))}
            <span className="collab-status-people-label">
              {peopleCount} {peopleCount === 1 ? 'person' : 'people'}
            </span>
          </div>

          {/* Your name — click to edit. Broadcasts to peers via awareness. */}
          <div className="collab-status-name-row">
            <span className="collab-status-name-label">You</span>
            {editingName ? (
              <input
                className="collab-status-name-input"
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => {
                  setLocalUserName(nameDraft);
                  setEditingName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setLocalUserName(nameDraft);
                    setEditingName(false);
                  } else if (e.key === 'Escape') {
                    setNameDraft(localUserName);
                    setEditingName(false);
                  }
                }}
                maxLength={40}
              />
            ) : (
              <button
                className="collab-status-name-display"
                onClick={() => setEditingName(true)}
                title="Edit your name"
              >
                {localUserName}
              </button>
            )}
          </div>

          {shareUrl && (
            <div className="collab-status-url-row">
              <code className="collab-status-url" title={shareUrl}>
                {shareUrl}
              </code>
              <button
                className="collab-status-copy"
                onClick={handleCopy}
                title="Copy URL"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
          )}

          <button
            className="collab-status-stop"
            onClick={() => {
              void leaveSession();
              setExpanded(false);
            }}
          >
            <Square size={11} fill="currentColor" />
            {isHost ? 'Stop sharing' : 'Leave session'}
          </button>
        </div>
      )}
    </div>
  );
}
