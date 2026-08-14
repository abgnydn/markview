// SPDX-License-Identifier: Apache-2.0

/**
 * Persistent-storage request. Every user document lives in IndexedDB
 * (`lib/storage/db.ts`), which is *best-effort* storage by default —
 * browsers may evict the whole origin under storage pressure, and Safari
 * clears it after 7 days without a visit. For a local-first editor that is
 * silent data loss, so we ask the browser for the persistent bucket.
 *
 * Timing matters: the answer is scored on site engagement in Chromium and
 * shows a permission prompt in Firefox, so we ask only once the user
 * actually has documents to lose — never on a first landing-page visit.
 * See the call sites in `stores/workspace-store.ts`.
 *
 * Everything here is best-effort and silent. `navigator.storage` is absent
 * in older browsers and some webviews (the Tauri shell runs WKWebView on
 * macOS), so every step is feature-checked and nothing may ever throw — a
 * failure here must not take a document write down with it.
 */

/** Remembers across sessions that the browser already said yes. */
const GRANTED_KEY = 'mv-storage-persisted';

/** At most one request per page session, however many writes come through. */
let attempted = false;

/**
 * Safari is the engine where a refused request means real data loss (the
 * 7-day eviction window), so it's the only one worth a console note.
 * Chromium/Firefox derivatives all carry "Safari" in their UA — exclude them.
 */
function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /safari/i.test(ua) && !/chrome|chromium|crios|fxios|edg|android/i.test(ua);
}

function rememberGranted(): void {
  try {
    localStorage.setItem(GRANTED_KEY, '1');
  } catch {
    /* private mode / disabled storage — we just ask again next session */
  }
}

/**
 * Ask the browser to make this origin's storage persistent. Safe to call
 * from any write path: it runs at most once per session, skips the call
 * entirely once granted, and resolves quietly on every failure mode.
 *
 * Fire-and-forget at the call site — Firefox's prompt only resolves once
 * the user answers it, and no document write should wait on that.
 */
export async function ensurePersistentStorage(): Promise<void> {
  if (attempted) return;
  attempted = true;

  try {
    const manager = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (!manager || typeof manager.persist !== 'function') return;

    // Granted in an earlier session — nothing to ask for.
    try {
      if (localStorage.getItem(GRANTED_KEY) === '1') return;
    } catch {
      /* unreadable storage — fall through and just ask */
    }

    // Cheap and prompt-less: the origin may already be persisted (Chromium
    // grants it on engagement, Safari on bookmark) even with our flag gone.
    if (typeof manager.persisted === 'function' && (await manager.persisted())) {
      rememberGranted();
      return;
    }

    if (await manager.persist()) {
      rememberGranted();
      return;
    }

    // Denied or undecided: no flag is written, so the next qualifying write
    // in a later session asks again (engagement scores climb over time).
    if (
      isSafari() &&
      typeof manager.persisted === 'function' &&
      !(await manager.persisted())
    ) {
      console.warn(
        '[storage] persistent storage was not granted — Safari may evict MarkView documents after 7 days without a visit. Bookmarking the site (or adding it to the Home Screen) makes storage persistent.',
      );
    }
  } catch {
    /* feature detection lied, or the call rejected — never break a write */
  }
}
