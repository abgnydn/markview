'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Columns2 } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { MarkdownRenderer } from './markdown-renderer';
import { db } from '@/lib/storage/db';

interface SplitViewProps {
  mainFileId: string;
  onClose: () => void;
}

export function SplitView({ mainFileId, onClose }: SplitViewProps) {
  const files = useWorkspaceStore((s) => s.files);
  const [secondFileId, setSecondFileId] = useState<string | null>(null);
  const [secondContent, setSecondContent] = useState<string | null>(null);

  // Get files excluding the main one
  const otherFiles = useMemo(
    () => files.filter((f) => f.id !== mainFileId),
    [files, mainFileId]
  );

  // Load second file content
  useEffect(() => {
    if (!secondFileId) {
      setSecondContent(null);
      return;
    }
    let cancelled = false;
    db.files.get(secondFileId).then((file) => {
      if (!cancelled && file) setSecondContent(file.content);
    });
    return () => { cancelled = true; };
  }, [secondFileId]);

  // Default to first other file
  useEffect(() => {
    if (!secondFileId && otherFiles.length > 0) {
      setSecondFileId(otherFiles[0].id);
    }
  }, [otherFiles, secondFileId]);

  const secondFile = files.find((f) => f.id === secondFileId);

  return (
    <div className="split-view">
      <div className="split-view-header">
        <span className="split-view-title">
          <Columns2 size={14} /> Split View
        </span>
        <select
          className="split-view-select"
          value={secondFileId || ''}
          onChange={(e) => setSecondFileId(e.target.value)}
        >
          {otherFiles.map((f) => (
            <option key={f.id} value={f.id}>
              {f.displayName || f.filename}
            </option>
          ))}
        </select>
        <button className="split-view-close" onClick={onClose} title="Close split view">
          <X size={16} />
        </button>
      </div>
      <div className="split-view-content">
        {secondContent ? (
          <div className="split-view-pane">
            <div className="split-view-pane-header">{secondFile?.displayName || secondFile?.filename}</div>
            <div className="split-view-pane-body">
              <MarkdownRenderer content={secondContent} />
            </div>
          </div>
        ) : (
          <div className="split-view-empty">
            <p>Select a file to compare</p>
          </div>
        )}
      </div>
    </div>
  );
}
