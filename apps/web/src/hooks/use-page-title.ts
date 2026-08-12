// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';

const DEFAULT_TITLE = 'MarkView — Markdown editor that stays on your machine';

/**
 * Set document.title for a client-routed page, restoring the default on
 * unmount. The prerendered HTML already carries correct titles for
 * crawlers; this keeps the TAB title honest during client-side
 * navigation (/projects → /p/x used to keep the previous page's title in
 * tab, history, and bookmarks).
 */
export function usePageTitle(title: string | null): void {
  useEffect(() => {
    if (!title) return;
    document.title = title;
    return () => { document.title = DEFAULT_TITLE; };
  }, [title]);
}
