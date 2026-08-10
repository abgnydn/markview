// SPDX-License-Identifier: Apache-2.0

/**
 * Desktop update check — MANUAL ONLY.
 *
 * The desktop app deliberately never phones home: no background polling,
 * no update pings at launch, nothing on a timer. The cost of that promise
 * is that someone on an old build has no way to learn a fixed one exists,
 * so this module exposes a single function wired to an explicit
 * "Check for updates" menu item. It runs only when the user clicks it.
 *
 * It sends no data about the user or their documents — an unauthenticated
 * GET of the public releases endpoint, which reveals only that someone
 * asked GitHub what the latest MarkView release is.
 */

import { DESKTOP_VERSION, RELEASES_LATEST_URL, isNewerVersion } from '@/lib/version';

const RELEASES_API = 'https://api.github.com/repos/abgnydn/markview/releases/latest';

export interface UpdateCheckResult {
  status: 'update-available' | 'up-to-date' | 'error';
  latest?: string;
  url: string;
}

function toast(message: string): void {
  window.dispatchEvent(new CustomEvent('markview:toast', { detail: { message } }));
}

/** Open a URL in the user's real browser (Tauri) or a new tab (web). */
async function openExternal(url: string): Promise<void> {
  const tauri = (window as unknown as {
    __TAURI__?: { opener?: { openUrl?: (u: string) => Promise<void> } };
  }).__TAURI__;
  if (tauri?.opener?.openUrl) {
    try {
      await tauri.opener.openUrl(url);
      return;
    } catch { /* fall through to window.open */ }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Ask GitHub for the latest desktop release and compare it to this build.
 * Surfaces the outcome as a toast; when an update exists, opens the
 * release page so the user can download it.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  try {
    const res = await fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { tag_name?: string; html_url?: string };
    // Tags look like `desktop-v0.3.1`; strip everything before the number.
    const latest = (data.tag_name ?? '').replace(/^.*?v/, '');
    const url = data.html_url || RELEASES_LATEST_URL;
    if (!latest) throw new Error('no tag in response');

    if (isNewerVersion(latest, DESKTOP_VERSION)) {
      toast(`MarkView ${latest} is available — opening the download page.`);
      void openExternal(url);
      return { status: 'update-available', latest, url };
    }
    toast(`You're on the latest version (${DESKTOP_VERSION}).`);
    return { status: 'up-to-date', latest, url };
  } catch {
    toast('Could not reach GitHub to check for updates.');
    return { status: 'error', url: RELEASES_LATEST_URL };
  }
}
