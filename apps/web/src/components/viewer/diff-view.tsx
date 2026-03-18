'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, FileCode2 } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { db } from '@/lib/storage/db';

interface DiffViewProps {
  fileAId: string;
  onClose: () => void;
}

interface DiffLine {
  type: 'same' | 'add' | 'remove' | 'info';
  content: string;
  lineA?: number;
  lineB?: number;
}

function computeDiff(textA: string, textB: string): DiffLine[] {
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const n = linesA.length;
  const m = linesB.length;

  // For very large files, use a simpler approach
  if (n * m > 1_000_000) {
    // Fallback: line-by-line comparison
    const maxLen = Math.max(n, m);
    for (let i = 0; i < maxLen; i++) {
      if (i < n && i < m) {
        if (linesA[i] === linesB[i]) {
          result.push({ type: 'same', content: linesA[i], lineA: i + 1, lineB: i + 1 });
        } else {
          result.push({ type: 'remove', content: linesA[i], lineA: i + 1 });
          result.push({ type: 'add', content: linesB[i], lineB: i + 1 });
        }
      } else if (i < n) {
        result.push({ type: 'remove', content: linesA[i], lineA: i + 1 });
      } else {
        result.push({ type: 'add', content: linesB[i], lineB: i + 1 });
      }
    }
    return result;
  }

  // LCS table
  const dp: number[][] = Array(n + 1).fill(null).map(() => Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  let i = n, j = m;
  const stack: DiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      stack.push({ type: 'same', content: linesA[i - 1], lineA: i, lineB: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: 'add', content: linesB[j - 1], lineB: j });
      j--;
    } else if (i > 0) {
      stack.push({ type: 'remove', content: linesA[i - 1], lineA: i });
      i--;
    }
  }

  return stack.reverse();
}

export function DiffView({ fileAId, onClose }: DiffViewProps) {
  const files = useWorkspaceStore((s) => s.files);
  const activeFileContent = useWorkspaceStore((s) => s.activeFileContent);
  const [fileBId, setFileBId] = useState<string | null>(null);
  const [contentB, setContentB] = useState<string | null>(null);

  const otherFiles = useMemo(
    () => files.filter((f) => f.id !== fileAId),
    [files, fileAId]
  );

  const fileA = files.find((f) => f.id === fileAId);
  const fileB = files.find((f) => f.id === fileBId);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!fileBId) { setContentB(null); return; }
    let cancelled = false;
    db.files.get(fileBId).then((f) => {
      if (!cancelled && f) setContentB(f.content);
    });
    return () => { cancelled = true; };
  }, [fileBId]);

  useEffect(() => {
    if (!fileBId && otherFiles.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFileBId(otherFiles[0].id);
    }
  }, [otherFiles, fileBId]);

  const diff = useMemo(() => {
    if (!activeFileContent || !contentB) return [];
    return computeDiff(activeFileContent, contentB);
  }, [activeFileContent, contentB]);

  const stats = useMemo(() => {
    const adds = diff.filter((d) => d.type === 'add').length;
    const removes = diff.filter((d) => d.type === 'remove').length;
    return { adds, removes };
  }, [diff]);

  return (
    <div className="diff-view-overlay">
      <div className="diff-view-container">
        <div className="diff-view-header">
          <div className="diff-view-title">
            <FileCode2 size={16} />
            <span>Comparing Files</span>
          </div>
          <div className="diff-view-files">
            <span className="diff-view-file-a">{fileA?.displayName || fileA?.filename}</span>
            <span className="diff-view-vs">vs</span>
            <select
              className="diff-view-select"
              value={fileBId || ''}
              onChange={(e) => setFileBId(e.target.value)}
            >
              {otherFiles.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.displayName || f.filename}
                </option>
              ))}
            </select>
          </div>
          <div className="diff-view-stats">
            <span className="diff-stat-add">+{stats.adds}</span>
            <span className="diff-stat-remove">-{stats.removes}</span>
          </div>
          <button className="diff-view-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="diff-view-body">
          <pre className="diff-view-code">
            {diff.map((line, i) => (
              <div
                key={i}
                className={`diff-line diff-line-${line.type}`}
              >
                <span className="diff-line-num">
                  {line.lineA || ' '}
                </span>
                <span className="diff-line-num">
                  {line.lineB || ' '}
                </span>
                <span className="diff-line-marker">
                  {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                </span>
                <span className="diff-line-content">{line.content}</span>
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}
