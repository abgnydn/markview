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

/**
 * The version of the RUNNING build.
 *
 * DESKTOP_VERSION (lib/version.ts) is bumped *after* the desktop binary is
 * built and published, so the compiled bundle always embeds the *previous*
 * release's number — using it here made every shipped build think it was one
 * version behind and show a permanent, bogus "update available". Instead ask
 * Tauri for the version baked into the app at build time from
 * tauri.conf.json, which is always this exact build's number. Falls back to
 * DESKTOP_VERSION when the runtime API is absent (the web/PWA context, where
 * this manual check isn't reachable anyway). `withGlobalTauri: true` puts the
 * API on `window.__TAURI__`, so no `@tauri-apps/api` import is bundled.
 */
async function getRunningVersion(): Promise<string> {
  const tauri = (window as unknown as {
    __TAURI__?: { app?: { getVersion?: () => Promise<string> } };
  }).__TAURI__;
  if (tauri?.app?.getVersion) {
    try {
      const v = await tauri.app.getVersion();
      if (v) return v;
    } catch { /* fall through to the compile-time constant */ }
  }
  return DESKTOP_VERSION;
}

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

    const running = await getRunningVersion();
    if (isNewerVersion(latest, running)) {
      toast(`MarkView ${latest} is available — opening the download page.`);
      void openExternal(url);
      return { status: 'update-available', latest, url };
    }
    toast(`You're on the latest version (${running}).`);
    return { status: 'up-to-date', latest, url };
  } catch {
    toast('Could not reach GitHub to check for updates.');
    return { status: 'error', url: RELEASES_LATEST_URL };
  }
}
