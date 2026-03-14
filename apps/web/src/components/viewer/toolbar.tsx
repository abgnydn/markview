'use client';

import React from 'react';
import { Sun, Moon, Monitor, Search, FolderOpen, Plus, Clock, BookOpen, Presentation, Columns2, Edit3, FileCode2, ZoomIn, ZoomOut } from 'lucide-react';
import { useThemeStore } from '@/stores/theme-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { ExportMenu } from './export-menu';

interface ToolbarProps {
  onSearchOpen?: () => void;
  onAddFiles?: () => void;
  readingStats?: { words: number; minutes: number } | null;
  onTogglePresentation?: () => void;
  onToggleSplitView?: () => void;
  onToggleDiffView?: () => void;
  onToggleEditor?: () => void;
}

export function Toolbar({ onAddFiles, readingStats, onTogglePresentation, onToggleSplitView, onToggleDiffView, onToggleEditor }: ToolbarProps) {
  const { mode, setMode, fontSize } = useThemeStore();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace);
  const focusMode = useThemeStore((s) => s.focusMode);

  const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId);

  const cycleTheme = () => {
    const next: Record<string, 'dark' | 'light' | 'system'> = {
      system: 'light',
      light: 'dark',
      dark: 'system',
    };
    setMode(next[mode]);
  };

  const ThemeIcon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor;

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-logo">📄</span>
        <h1 className="toolbar-brand">MarkView</h1>
        {activeWorkspace && (
          <span className="toolbar-workspace-name">{activeWorkspace.title}</span>
        )}
        {readingStats && (
          <div className="toolbar-reading-stats">
            <span className="toolbar-stat">
              <Clock size={12} />
              {readingStats.minutes} min read
            </span>
            <span className="toolbar-stat">
              <BookOpen size={12} />
              {readingStats.words.toLocaleString()} words
            </span>
            {focusMode && (
              <span className="toolbar-focus-badge">Focus</span>
            )}
          </div>
        )}
      </div>

      <div className="toolbar-right">
        {activeWorkspace && (
          <>
            <button
              className="toolbar-btn"
              onClick={onToggleEditor}
              title="Edit markdown (E)"
            >
              <Edit3 size={18} />
            </button>
            <button
              className="toolbar-btn"
              onClick={onToggleSplitView}
              title="Split view"
            >
              <Columns2 size={18} />
            </button>
            <button
              className="toolbar-btn"
              onClick={onToggleDiffView}
              title="Compare files"
            >
              <FileCode2 size={18} />
            </button>
            <button
              className="toolbar-btn"
              onClick={onTogglePresentation}
              title="Presentation mode (P)"
            >
              <Presentation size={18} />
            </button>
            <button
              className="toolbar-btn"
              onClick={onAddFiles}
              title="Add new workspace"
            >
              <Plus size={18} />
            </button>
            <button
              className="toolbar-btn"
              onClick={() => {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
              }}
              title="Search (⌘K)"
            >
              <Search size={18} />
            </button>
            <ExportMenu />
            <button
              className="toolbar-btn"
              onClick={() => deleteWorkspace(activeWorkspaceId!)}
              title="Close workspace"
            >
              <FolderOpen size={18} />
            </button>
          </>
        )}
        <span className="toolbar-font-size">{fontSize}px</span>
        <button
          className="toolbar-btn toolbar-theme-btn"
          onClick={cycleTheme}
          title={`Theme: ${mode}`}
        >
          <ThemeIcon size={18} />
          <span className="toolbar-theme-label">{mode}</span>
        </button>
      </div>
    </header>
  );
}
