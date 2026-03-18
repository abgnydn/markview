'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, Search, FolderOpen, Plus, Clock, BookOpen, Presentation, Columns2, Edit3, FileCode2, Menu, MoreVertical, Palette } from 'lucide-react';
import { useThemeStore } from '@/stores/theme-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { ExportMenu } from './export-menu';
import { THEME_PRESETS } from '@/lib/themes/presets';

interface ToolbarProps {
  onSearchOpen?: () => void;
  onAddFiles?: () => void;
  readingStats?: { words: number; minutes: number } | null;
  onTogglePresentation?: () => void;
  onToggleSplitView?: () => void;
  onToggleDiffView?: () => void;
  onToggleEditor?: () => void;
  onGoHome?: () => void;
  onToggleSidebar?: () => void;
}

export function Toolbar({ onAddFiles, readingStats, onTogglePresentation, onToggleSplitView, onToggleDiffView, onToggleEditor, onGoHome, onToggleSidebar }: ToolbarProps) {
  const { mode, setMode, fontSize } = useThemeStore();
  const colorScheme = useThemeStore((s) => s.colorScheme);
  const setColorScheme = useThemeStore((s) => s.setColorScheme);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace);
  const focusMode = useThemeStore((s) => s.focusMode);

  const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId);

  const [showOverflow, setShowOverflow] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);
  const themePickerRef = useRef<HTMLDivElement>(null);

  // Close overflow menu on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setShowOverflow(false);
      }
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) {
        setShowThemePicker(false);
      }
    };
    if (showOverflow || showThemePicker) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showOverflow, showThemePicker]);

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
        {onToggleSidebar && (
          <button
            className="toolbar-btn toolbar-hamburger"
            onClick={onToggleSidebar}
            title="Toggle sidebar"
            aria-label="Toggle sidebar"
          >
            <Menu size={20} />
          </button>
        )}
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
            {/* Primary actions — always visible */}
            <button
              className="toolbar-btn"
              onClick={() => {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
              }}
              title="Search (⌘K)"
            >
              <Search size={18} />
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

            {/* Secondary actions — hidden on mobile, shown in overflow menu */}
            <button
              className="toolbar-btn toolbar-secondary"
              onClick={onToggleEditor}
              title="Edit markdown (E)"
            >
              <Edit3 size={18} />
            </button>
            <button
              className="toolbar-btn toolbar-secondary"
              onClick={onToggleSplitView}
              title="Split view"
            >
              <Columns2 size={18} />
            </button>
            <button
              className="toolbar-btn toolbar-secondary"
              onClick={onToggleDiffView}
              title="Compare files"
            >
              <FileCode2 size={18} />
            </button>
            <span className="toolbar-secondary">
              <ExportMenu />
            </span>
            <button
              className="toolbar-btn toolbar-secondary"
              onClick={onGoHome}
              title="Home"
            >
              <FolderOpen size={18} />
            </button>

            {/* Overflow menu button — mobile only */}
            <div className="toolbar-overflow-container" ref={overflowRef}>
              <button
                className="toolbar-btn toolbar-overflow-btn"
                onClick={() => setShowOverflow(!showOverflow)}
                title="More actions"
                aria-label="More actions"
              >
                <MoreVertical size={18} />
              </button>
              {showOverflow && (
                <div className="toolbar-overflow-menu">
                  <button className="toolbar-overflow-item" onClick={() => { onToggleEditor?.(); setShowOverflow(false); }}>
                    <Edit3 size={16} /> Edit
                  </button>
                  <button className="toolbar-overflow-item" onClick={() => { onToggleSplitView?.(); setShowOverflow(false); }}>
                    <Columns2 size={16} /> Split View
                  </button>
                  <button className="toolbar-overflow-item" onClick={() => { onToggleDiffView?.(); setShowOverflow(false); }}>
                    <FileCode2 size={16} /> Compare
                  </button>
                  <button className="toolbar-overflow-item" onClick={() => { onGoHome?.(); setShowOverflow(false); }}>
                    <FolderOpen size={16} /> Home
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Theme picker */}
        <div className="toolbar-theme-picker-container" ref={themePickerRef}>
          <button
            className="toolbar-btn toolbar-theme-picker-btn"
            onClick={() => setShowThemePicker(!showThemePicker)}
            title="Color scheme"
          >
            <Palette size={18} />
          </button>
          {showThemePicker && (
            <div className="toolbar-theme-picker">
              <div className="theme-picker-header">Color Scheme</div>
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className={`theme-picker-item ${colorScheme === preset.id ? 'theme-picker-active' : ''}`}
                  onClick={() => {
                    setColorScheme(preset.id);
                    setShowThemePicker(false);
                  }}
                >
                  <span className="theme-picker-swatch" style={{
                    background: `linear-gradient(135deg, ${preset.dark['--bg-primary'] || '#0d1117'} 50%, ${preset.dark['--accent-blue'] || '#58a6ff'} 50%)`,
                  }} />
                  <span className="theme-picker-name">{preset.emoji} {preset.name}</span>
                  {colorScheme === preset.id && <span className="theme-picker-check">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

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
