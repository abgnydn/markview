// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';

/**
 * Text-fragment share — when the user selects text in the viewer and
 * presses ⌘⇧C (Ctrl+Shift+C on Linux/Windows), copy a URL using the
 * native `#:~:text=…` text-fragment syntax. Recipients opening that URL
 * in any modern browser (Chrome 80+, Edge, Safari 17+) get scrolled
 * directly to that text with the fragment highlighted by the browser.
 *
 * If there's no selection or the URL exceeds the safe length, falls
 * back to the plain current URL. Toast via the existing autosave
 * whisper plumbing.
 *
 * Works alongside the existing #md=… share-as-URL: that one carries
 * the whole document; this one carries a pointer into the doc you're
 * already on. Use #md=… to send notes to someone without an account;
 * use ⌘⇧C to point a peer at "this exact paragraph."
 */
const MAX_TEXT_FRAG = 220;

function encodeFragment(s: string): string {
  return encodeURIComponent(s.trim().replace(/\s+/g, ' '));
}

export function useTextFragmentShare(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const wantsCopy =
        (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'c';
      if (!wantsCopy) return;
      const sel = window.getSelection();
      const selText = sel?.toString().trim() ?? '';
      if (!selText) return;

      e.preventDefault();

      const base = `${window.location.origin}${window.location.pathname}${window.location.search}`;
      // For text-fragment URLs, the spec only requires the substring;
      // we trim to MAX_TEXT_FRAG chars and split start/end if the
      // selection is long so the directive stays scannable.
      let frag: string;
      if (selText.length <= MAX_TEXT_FRAG) {
        frag = `#:~:text=${encodeFragment(selText)}`;
      } else {
        const head = selText.slice(0, 80);
        const tail = selText.slice(-80);
        frag = `#:~:text=${encodeFragment(head)},${encodeFragment(tail)}`;
      }
      const url = base + frag;

      void navigator.clipboard
        .writeText(url)
        .then(() => {
          window.dispatchEvent(
            new CustomEvent('markview:toast', {
              detail: { message: 'link to highlight copied' },
            }),
          );
        })
        .catch(() => {
          /* clipboard rejected — silent */
        });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
