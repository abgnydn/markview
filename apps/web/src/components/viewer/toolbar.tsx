
import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, Search, FolderOpen, Plus, Clock, BookOpen, Presentation, Columns2, Edit3, FileCode2, Menu, MoreVertical, Palette, Trash2, Network, Sparkles, FilePlus, Upload } from 'lucide-react';
import { useThemeStore } from '@/stores/theme-store';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { ExportMenu } from './export-menu';
import { THEME_PRESETS } from '@/lib/themes/presets';

interface ToolbarProps {
  onSearchOpen?: () => void;
  onAddFiles?: () => void;
  onNewFile?: () => void;
  readingStats?: { words: number; minutes: number } | null;
  onTogglePresentation?: () => void;
  onToggleSplitView?: () => void;
  onToggleDiffView?: () => void;
  onToggleEditor?: () => void;
  onToggleVault?: () => void;
  onOpenFileBrowser?: () => void;
  onOpenAiChat?: () => void;
  onGoHome?: () => void;
  onToggleSidebar?: () => void;
}

export function Toolbar({ onAddFiles, onNewFile, readingStats, onTogglePresentation, onToggleSplitView, onToggleDiffView, onToggleEditor, onToggleVault, onOpenFileBrowser, onOpenAiChat, onGoHome, onToggleSidebar }: ToolbarProps) {
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
  const [showModePicker, setShowModePicker] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);
  const themePickerRef = useRef<HTMLDivElement>(null);
  const modePickerRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Close overflow menu on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setShowOverflow(false);
      }
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) {
        setShowThemePicker(false);
      }
      if (modePickerRef.current && !modePickerRef.current.contains(e.target as Node)) {
        setShowModePicker(false);
      }
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    if (showOverflow || showThemePicker || showModePicker || showAddMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showOverflow, showThemePicker, showModePicker, showAddMenu]);


  const handleClearAll = () => {
    setShowClearConfirm(true);
  };

  const ThemeIcon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor;

  return (
    <>
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
        <button className="toolbar-home-btn" onClick={onGoHome} title="Back to home" aria-label="Back to home">
          <span className="toolbar-mark" aria-hidden="true"><span className="toolbar-mark-m">M</span></span>
          <h1 className="toolbar-brand">MarkView</h1>
        </button>
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
              className="toolbar-btn toolbar-desktop-only"
              onClick={onTogglePresentation}
              title="Presentation mode (P)"
            >
              <Presentation size={18} />
            </button>
            <div className="toolbar-theme-picker-container toolbar-desktop-only" ref={addMenuRef}>
              <button
                className="toolbar-btn"
                onClick={() => setShowAddMenu((v) => !v)}
                title="Add a document"
              >
                <Plus size={18} />
              </button>
              {showAddMenu && (
                <div className="toolbar-theme-picker">
                  <div className="theme-picker-header">Add document</div>
                  <button
                    className="theme-picker-item"
                    onClick={() => { setShowAddMenu(false); onNewFile?.(); }}
                  >
                    <FilePlus size={15} />
                    <span className="theme-picker-name">New file</span>
                  </button>
                  <button
                    className="theme-picker-item"
                    onClick={() => { setShowAddMenu(false); onAddFiles?.(); }}
                  >
                    <Upload size={15} />
                    <span className="theme-picker-name">Upload .md…</span>
                  </button>
                </div>
              )}
            </div>
            {onOpenAiChat && (
              <button
                className="toolbar-btn toolbar-ai-btn"
                onClick={onOpenAiChat}
                title="Chat with this workspace (⌘J)"
              >
                <Sparkles size={18} />
              </button>
            )}

            {/* "More" menu — secondary actions live here on every screen. On
                mobile, the primary actions above fold in too (mobile-group). */}
            <div className="toolbar-overflow-container" ref={overflowRef}>
              <button
                className="toolbar-btn toolbar-overflow-btn"
                onClick={() => setShowOverflow(!showOverflow)}
                title="More actions"
                aria-label="More actions"
                aria-haspopup="menu"
                aria-expanded={showOverflow}
              >
                <MoreVertical size={18} />
              </button>
              {showOverflow && (
                <div className="toolbar-overflow-menu">
                  {/* Primary actions are standalone buttons on desktop; they
                      collapse into the menu on mobile. */}
                  <div className="toolbar-mobile-group">
                    <button className="toolbar-overflow-item" onClick={() => { onTogglePresentation?.(); setShowOverflow(false); }}>
                      <Presentation size={16} /> Presentation
                    </button>
                    <button className="toolbar-overflow-item" onClick={() => { onNewFile?.(); setShowOverflow(false); }}>
                      <FilePlus size={16} /> New file
                    </button>
                    <button className="toolbar-overflow-item" onClick={() => { onAddFiles?.(); setShowOverflow(false); }}>
                      <Upload size={16} /> Upload .md…
                    </button>
                    <hr className="toolbar-overflow-sep" />
                  </div>

                  <button className="toolbar-overflow-item" onClick={() => { onToggleEditor?.(); setShowOverflow(false); }}>
                    <Edit3 size={16} /> Edit file
                  </button>
                  <button className="toolbar-overflow-item" onClick={() => { onToggleSplitView?.(); setShowOverflow(false); }}>
                    <Columns2 size={16} /> Split view
                  </button>
                  <button className="toolbar-overflow-item" onClick={() => { onToggleDiffView?.(); setShowOverflow(false); }}>
                    <FileCode2 size={16} /> Compare diff
                  </button>
                  <ExportMenu variant="menu-item" />
                  <button className="toolbar-overflow-item" onClick={() => { onOpenFileBrowser?.(); setShowOverflow(false); }}>
                    <FolderOpen size={16} /> Browse files
                  </button>
                  {onToggleVault && (
                    <button className="toolbar-overflow-item" onClick={() => { onToggleVault?.(); setShowOverflow(false); }}>
                      <Network size={16} /> Graph view
                    </button>
                  )}
                  <hr className="toolbar-overflow-sep" />
                  <button className="toolbar-overflow-item toolbar-overflow-item-danger" onClick={() => { handleClearAll(); setShowOverflow(false); }}>
                    <Trash2 size={16} /> Clear all
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Theme picker */}
        <div className="toolbar-theme-picker-container toolbar-desktop-only" ref={themePickerRef}>
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

        <span className="toolbar-font-size toolbar-desktop-only">{fontSize}px</span>

        <div className="toolbar-theme-picker-container toolbar-desktop-only" ref={modePickerRef}>
          <button
            className="toolbar-btn toolbar-theme-btn"
            onClick={() => setShowModePicker(!showModePicker)}
            title={`Theme: ${mode}`}
          >
            <ThemeIcon size={18} />
            <span className="toolbar-theme-label">{mode}</span>
          </button>
          {showModePicker && (
            <div className="toolbar-theme-picker">
              <div className="theme-picker-header">Appearance</div>
              {['light', 'dark', 'system'].map((m) => {
                const ItemIcon = m === 'dark' ? Moon : m === 'light' ? Sun : Monitor;
                return (
                  <button
                    key={m}
                    className={`theme-picker-item ${mode === m ? 'theme-picker-active' : ''}`}
                    onClick={() => {
                      setMode(m as 'dark' | 'light' | 'system');
                      setShowModePicker(false);
                    }}
                  >
                    <ItemIcon size={14} style={{ marginRight: 4, color: 'var(--text-secondary)' }} />
                    <span className="theme-picker-name" style={{ textTransform: 'capitalize' }}>{m}</span>
                    {mode === m && <span className="theme-picker-check">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </header>
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear all workspaces"
        description="Permanently remove every workspace from your browser cache. This can't be undone."
        confirmText="Clear all"
        cancelText="Cancel"
        tone="danger"
        onConfirm={() => {
          workspaces.forEach(ws => deleteWorkspace(ws.id));
          if (onGoHome) onGoHome();
          setShowClearConfirm(false);
          setShowOverflow(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </>
  );
}
