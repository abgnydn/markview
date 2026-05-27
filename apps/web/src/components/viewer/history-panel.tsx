// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { X, Clock, RotateCcw, Trash2, Save as SaveIcon, Users, Bookmark, Sparkles } from 'lucide-react';
import {
  listSnapshotsForFile,
  deleteSnapshot,
  formatSnapshotTime,
  createSnapshot,
} from '@/lib/snapshots';
import type { DBSnapshot } from '@/lib/storage/db';

interface HistoryPanelProps {
  fileId: string;
  workspaceId: string;
  currentContent: string;
  /** Called when the user picks a snapshot to restore. The editor then
      writes this content back through Yjs (in collab) or directly. */
  onRestore: (content: string) => void;
  onClose: () => void;
}

const SOURCE_ICON = {
  save: SaveIcon,
  manual: Bookmark,
  auto: Sparkles,
  'collab-join': Users,
} as const;

const SOURCE_LABEL = {
  save: 'saved',
  manual: 'bookmark',
  auto: 'auto',
  'collab-join': 'joined',
} as const;

export function HistoryPanel({ fileId, workspaceId, currentContent, onRestore, onClose }: HistoryPanelProps) {
  const [snapshots, setSnapshots] = useState<DBSnapshot[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const refresh = async () => {
    const rows = await listSnapshotsForFile(fileId);
    setSnapshots(rows);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  // Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleBookmarkCurrent = async () => {
    await createSnapshot(fileId, workspaceId, currentContent, 'manual');
    void refresh();
  };

  const handleRestore = (s: DBSnapshot) => {
    onRestore(s.content);
    onClose();
  };

  const handleDelete = async (s: DBSnapshot) => {
    await deleteSnapshot(s.id);
    if (previewId === s.id) setPreviewId(null);
    void refresh();
  };

  const preview = snapshots.find((s) => s.id === previewId);

  return (
    <div className="history-overlay" onClick={onClose}>
      <div className="history-panel" onClick={(e) => e.stopPropagation()}>
        <div className="history-header">
          <Clock size={14} className="history-header-icon" />
          <span className="history-header-title">History</span>
          <span className="history-header-count">{snapshots.length}</span>
          <button
            className="history-header-action"
            onClick={handleBookmarkCurrent}
            title="Bookmark the current version"
          >
            <Bookmark size={13} />
          </button>
          <button className="history-close" onClick={onClose} title="Close (Esc)">
            <X size={16} />
          </button>
        </div>

        <div className="history-body">
          <ul className="history-list">
            {snapshots.length === 0 && (
              <li className="history-empty">
                No snapshots yet. They&apos;ll be saved automatically on every
                <kbd>⌘S</kbd> and roughly every five minutes while you edit.
              </li>
            )}
            {snapshots.map((s) => {
              const Icon = SOURCE_ICON[s.source] || Sparkles;
              const isPreview = previewId === s.id;
              const isCurrent = s.content === currentContent;
              return (
                <li
                  key={s.id}
                  className={`history-row${isPreview ? ' history-row-active' : ''}${isCurrent ? ' history-row-current' : ''}`}
                >
                  <button
                    className="history-row-main"
                    onClick={() => setPreviewId(isPreview ? null : s.id)}
                  >
                    <Icon size={12} className="history-row-icon" />
                    <span className="history-row-time">{formatSnapshotTime(s.createdAt)}</span>
                    <span className="history-row-source">{s.label || SOURCE_LABEL[s.source]}</span>
                    {typeof s.wordCount === 'number' && (
                      <span className="history-row-meta">{s.wordCount} words</span>
                    )}
                    {isCurrent && <span className="history-row-current-tag">current</span>}
                  </button>
                  {!isCurrent && (
                    <button
                      className="history-row-restore"
                      onClick={() => handleRestore(s)}
                      title="Restore this version"
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                  <button
                    className="history-row-del"
                    onClick={() => handleDelete(s)}
                    title="Delete this snapshot"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              );
            })}
          </ul>

          {preview && (
            <div className="history-preview">
              <div className="history-preview-meta">
                <span>{formatSnapshotTime(preview.createdAt)}</span>
                <span>·</span>
                <span>{SOURCE_LABEL[preview.source]}</span>
              </div>
              <pre className="history-preview-text">{preview.content}</pre>
              {preview.content !== currentContent && (
                <div className="history-preview-actions">
                  <button
                    className="history-restore-btn"
                    onClick={() => handleRestore(preview)}
                  >
                    <RotateCcw size={12} /> Restore this version
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
