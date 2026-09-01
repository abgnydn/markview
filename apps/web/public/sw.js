// Bumped to v6 to evict entries the old cache-first fetch handler had frozen
// permanently (see below) — without this the fix only helps new installs.
const CACHE_NAME = 'markview-v6';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  // Precache the app shell resiliently — addAll() rejects the whole install
  // if any single URL 404s (which would leave the SW inactive and the app
  // with no offline at all), so add each independently and tolerate misses.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests from the same origin
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return; // Let the browser handle cross-origin and POST requests directly
  }

  // Network-first for navigation; refresh the cached app-shell on every
  // successful load so the offline copy never goes stale (a stale '/'
  // references hashed chunk URLs that may have been evicted → broken
  // offline). Fall back to the cached shell when the network is down.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/'))
    );
  } else {
    // Two kinds of asset live under this branch and they need opposite
    // policies.
    //
    // /assets/* is hashed build output: the URL changes whenever the bytes
    // do, so a cache hit can be trusted forever and never needs revalidating.
    //
    // Everything else (/atmospheres/*.jpg, /atmospheres/audio/*.opus,
    // /manifest.json …) has a STABLE url and mutable bytes. Serving those
    // cache-first meant that once a client had a copy it could never get
    // another one: CACHE_NAME is a constant that no deploy changes, so the
    // entry was pinned for the life of the install. A corrected painting or
    // a re-mastered audio loop would ship to production and simply never
    // reach anyone who already had the old one. Those get
    // stale-while-revalidate instead — the cached copy is still served
    // immediately, but the network refreshes it for the next load.
    const path = new URL(event.request.url).pathname;
    const immutable = path.startsWith('/assets/');

    // Bounded runtime cache: hashed /assets are always worth keeping,
    // everything else only under 2 MB with a known size — an unbounded put()
    // of every ok response grew storage forever on long-lived installs
    // (full-res paintings, OG cards, model shards…).
    const fetchAndCache = () => fetch(event.request).then((res) => {
      if (res.ok) {
        const len = Number(res.headers.get('content-length') || 0);
        if (immutable || (len > 0 && len < 2 * 1024 * 1024)) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
      }
      return res;
    });

    if (immutable) {
      event.respondWith(
        caches.match(event.request).then((cached) => cached || fetchAndCache().catch((err) => {
          console.error('[SW] Fetch failed:', event.request.url, err);
          throw err;
        }))
      );
      return;
    }

    // Started synchronously, and its lifetime extended explicitly: a
    // revalidation kicked off from inside the respondWith chain can be killed
    // when the worker is torn down, which is exactly the case where the stale
    // entry would survive another round.
    const network = fetchAndCache();
    event.waitUntil(network.catch(() => {}));
    event.respondWith(
      caches.match(event.request).then((cached) => cached || network.catch((err) => {
        console.error('[SW] Fetch failed:', event.request.url, err);
        throw err;
      }))
    );
  }
});
