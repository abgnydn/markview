// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';

/**
 * useViewerOverlays — owns the boolean state for the viewer's stack of
 * full-screen overlays (graph view, file browser, AI chat) AND wires
 * the keyboard shortcuts that toggle them. Keeps viewer-page lean.
 *
 *   `\`     → toggle graph view (skipped when typing)
 *   ⌘/Ctrl+J → toggle AI chat
 *
 *  Esc closes whichever overlay is open.
 */
export function useViewerOverlays() {
  const [vaultOpen, setVaultOpen] = useState(false);
  const [fileBrowserOpen, setFileBrowserOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isTyping =
        tag === 'input' || tag === 'textarea' ||
        (e.target as HTMLElement | null)?.isContentEditable;

      if (!isTyping && e.key === '\\') {
        e.preventDefault();
        setVaultOpen((v) => !v);
        return;
      }
      // `c` (non-typing, no modifier) toggles cards mode — alternative
      // to the linear scroll where each H2 becomes a swipeable card.
      if (!isTyping && !e.metaKey && !e.ctrlKey && !e.altKey && e.key === 'c') {
        e.preventDefault();
        setCardsOpen((v) => !v);
        return;
      }
      if (!isTyping && (e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setAiChatOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        if (cardsOpen) { e.preventDefault(); setCardsOpen(false); }
        else if (vaultOpen) { e.preventDefault(); setVaultOpen(false); }
        else if (aiChatOpen) { e.preventDefault(); setAiChatOpen(false); }
        else if (fileBrowserOpen) { e.preventDefault(); setFileBrowserOpen(false); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [vaultOpen, aiChatOpen, fileBrowserOpen, cardsOpen]);

  return {
    vaultOpen, setVaultOpen,
    fileBrowserOpen, setFileBrowserOpen,
    aiChatOpen, setAiChatOpen,
    cardsOpen, setCardsOpen,
  };
}
