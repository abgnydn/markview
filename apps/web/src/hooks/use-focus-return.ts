// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from 'react';

/**
 * Return focus to whatever had it before an overlay opened.
 *
 * Every overlay in the app (editor, palette, search, history, graph, AI
 * chat, dialogs) used to drop focus on <body> when closed, forcing
 * keyboard users to re-tab from the top of a mostly hover-hidden UI.
 *
 * Overlays that mount-when-open pass `true`; always-mounted surfaces
 * (command palette) pass their open flag.
 */
export function useFocusReturn(active: boolean): void {
  const prevRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!active) return;
    prevRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      // The previous element may be gone (menu item that closed); only
      // restore when it is still in the document.
      const prev = prevRef.current;
      if (prev && document.contains(prev)) prev.focus();
    };
  }, [active]);
}
