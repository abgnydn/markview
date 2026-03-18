'use client';

import React, { useEffect } from 'react';
import { History, RotateCcw, Trash2, Clock } from 'lucide-react';
import { useVersionStore, type VersionEntry } from '@/stores/version-store';

interface VersionHistoryPanelProps {
  fileId: string;
  currentContent: string;
  onRestore: (content: string) => void;
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function sourceLabel(source: VersionEntry['source']): string {
  switch (source) {
    case 'editor': return 'Editor save';
    case 'auto': return 'Auto-save';
    case 'manual': return 'Snapshot';
  }
}

export function VersionHistoryPanel({ fileId, currentContent, onRestore }: VersionHistoryPanelProps) {
  const versions = useVersionStore((s) => s.versions);
  const isLoading = useVersionStore((s) => s.isLoading);
  const selectedVersion = useVersionStore((s) => s.selectedVersion);
  const loadVersions = useVersionStore((s) => s.loadVersions);
  const selectVersion = useVersionStore((s) => s.selectVersion);
  const deleteVer = useVersionStore((s) => s.deleteVersion);
  const saveVersion = useVersionStore((s) => s.saveVersion);

  useEffect(() => {
    loadVersions(fileId);
    return () => selectVersion(null);
  }, [fileId, loadVersions, selectVersion]);

  const handleRestore = (version: VersionEntry) => {
    // Save current as a version before restoring
    saveVersion(fileId, version.filename, currentContent, 'auto');
    onRestore(version.content);
    selectVersion(null);
  };

  if (isLoading) {
    return (
      <div className="version-panel">
        <div className="version-panel-header">
          <History size={14} />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="version-panel">
      <div className="version-panel-header">
        <History size={14} />
        <span>Version History ({versions.length})</span>
      </div>
      {versions.length === 0 ? (
        <div className="version-panel-empty">
          <Clock size={20} />
          <span>No versions yet</span>
          <span className="version-panel-hint">Versions are saved when you edit files</span>
        </div>
      ) : (
        <div className="version-panel-list">
          {versions.map((v) => (
            <div
              key={v.id}
              className={`version-panel-item ${selectedVersion?.id === v.id ? 'active' : ''}`}
              onClick={() => selectVersion(selectedVersion?.id === v.id ? null : v)}
            >
              <div className="version-panel-item-header">
                <span className="version-panel-time">{formatTimeAgo(v.timestamp)}</span>
                <span className="version-panel-source">{sourceLabel(v.source)}</span>
              </div>
              <div className="version-panel-item-meta">
                <span>{v.content.length.toLocaleString()} chars</span>
              </div>
              {selectedVersion?.id === v.id && (
                <div className="version-panel-item-actions">
                  <button
                    className="version-restore-btn"
                    onClick={(e) => { e.stopPropagation(); handleRestore(v); }}
                  >
                    <RotateCcw size={12} />
                    Restore
                  </button>
                  <button
                    className="version-delete-btn"
                    onClick={(e) => { e.stopPropagation(); deleteVer(v.id, fileId); }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
