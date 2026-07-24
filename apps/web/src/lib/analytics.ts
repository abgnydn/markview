// SPDX-License-Identifier: Apache-2.0
//
// Cloudflare Web Analytics — cookieless page-view counting, marketing
// surfaces ONLY (landing, /privacy, /terms, /projects). The editor and
// viewer never load this: MarkView's zero-telemetry promise applies to the
// app, and this beacon must never be reachable from a route that touches
// user documents.
//
// The token is public by design (it ships in the page HTML). Until one is
// set, the hook is a no-op. Get a token: Cloudflare dashboard → Analytics
// & Logs → Web Analytics → Add a site (markview.ai) → copy the token here.

import { useEffect } from 'react';

const BEACON_TOKEN = '';
const BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

/** Load the Cloudflare Web Analytics beacon once. Call only from marketing
 *  pages — never from the viewer/editor. No-op without a token, in dev, and
 *  inside the Tauri desktop shell. */
export function useMarketingBeacon(): void {
  useEffect(() => {
    if (!BEACON_TOKEN) return;
    if (import.meta.env.DEV) return;
    if ('__TAURI_INTERNALS__' in window) return;
    if (document.querySelector(`script[src="${BEACON_SRC}"]`)) return;
    const s = document.createElement('script');
    s.src = BEACON_SRC;
    s.defer = true;
    s.setAttribute('data-cf-beacon', JSON.stringify({ token: BEACON_TOKEN }));
    document.head.appendChild(s);
  }, []);
}
