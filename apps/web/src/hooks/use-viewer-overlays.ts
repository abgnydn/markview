// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';

/**
 * useViewerOverlays — owns the boolean state for the viewer's stack of
 * full-screen overlays (file browser, AI chat) AND wires the keyboard
 * shortcuts that toggle them. Keeps viewer-page lean.
 *
 *   ⌘/Ctrl+J → toggle AI chat
 *
 *  Esc closes whichever overlay is open.
 */
export function useViewerOverlays() {
  const [fileBrowserOpen, setFileBrowserOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);

  // The command palette's "Browse all workspaces & files" entry — the
  // browser was previously reachable only through the ⋮ overflow menu.
  useEffect(() => {
    const open = () => setFileBrowserOpen(true);
    window.addEventListener('markview:open-file-browser', open);
    return () => window.removeEventListener('markview:open-file-browser', open);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isTyping =
        tag === 'input' || tag === 'textarea' ||
        (e.target as HTMLElement | null)?.isContentEditable;

      if (!isTyping && (e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setAiChatOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape' && !e.defaultPrevented) {
        if (aiChatOpen) { e.preventDefault(); setAiChatOpen(false); }
        else if (fileBrowserOpen) { e.preventDefault(); setFileBrowserOpen(false); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aiChatOpen, fileBrowserOpen]);

  return {
    fileBrowserOpen, setFileBrowserOpen,
    aiChatOpen, setAiChatOpen,
  };
}
