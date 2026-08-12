const CACHE_NAME = 'markview-v5';
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
    // Cache-first with RUNTIME CACHING: hashed chunks are immutable, so
    // store each successful response. Without the put(), only the shell
    // was ever cached and offline loads died on their first chunk request
    // — "offline-ready" in name only.
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((res) => {
          if (res.ok) {
            // Bounded runtime cache: hashed /assets are always worth
            // keeping (immutable), everything else only under 2 MB with a
            // known size — an unbounded put() of every ok response grew
            // storage forever on long-lived installs (full-res paintings,
            // OG cards, model shards…).
            const path = new URL(event.request.url).pathname;
            const len = Number(res.headers.get('content-length') || 0);
            const cacheable = path.startsWith('/assets/') || (len > 0 && len < 2 * 1024 * 1024);
            if (cacheable) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            }
          }
          return res;
        }).catch((err) => {
          console.error('[SW] Fetch failed:', event.request.url, err);
          throw err;
        });
      })
    );
  }
});
