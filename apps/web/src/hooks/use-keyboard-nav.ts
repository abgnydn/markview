'use client';

import { useEffect } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useThemeStore } from '@/stores/theme-store';

export function useKeyboardNav() {
  const files = useWorkspaceStore((s) => s.files);
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);
  const toggleFocusMode = useThemeStore((s) => s.toggleFocusMode);
  const increaseFontSize = useThemeStore((s) => s.increaseFontSize);
  const decreaseFontSize = useThemeStore((s) => s.decreaseFontSize);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isInput) return;

      // F to toggle focus mode
      if (e.key === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggleFocusMode();
        return;
      }

      // / to open search
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
        return;
      }

      // ⌘+/⌘- for font size
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        increaseFontSize();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        decreaseFontSize();
        return;
      }

      // ↑/↓ or k/j to navigate files (only j when not focus mode key)
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (!files.length || !activeFileId) return;
        const currentIdx = files.findIndex((f) => f.id === activeFileId);
        if (currentIdx === -1) return;

        let nextIdx: number;
        if (e.key === 'ArrowDown') {
          nextIdx = Math.min(currentIdx + 1, files.length - 1);
        } else {
          nextIdx = Math.max(currentIdx - 1, 0);
        }

        if (nextIdx !== currentIdx) {
          e.preventDefault();
          setActiveFile(files[nextIdx].id);
        }
        return;
      }

      // 1-9 to switch workspaces
      if (e.key >= '1' && e.key <= '9' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const idx = parseInt(e.key) - 1;
        if (idx < workspaces.length) {
          e.preventDefault();
          switchWorkspace(workspaces[idx].id);
        }
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [files, activeFileId, setActiveFile, workspaces, switchWorkspace, toggleFocusMode, increaseFontSize, decreaseFontSize]);
}
