// Service Worker for InsightBooks POS offline support (TC-OFF-007)
const CACHE_NAME = 'insightbooks-pos-v1';
const STATIC_ASSETS = [];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
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
  const { request } = event;

  // Only cache GET requests for navigation and static assets
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never cache Next.js / Turbopack / HMR chunks — stale factories break the app.
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.includes('turbopack') ||
    url.searchParams.has('_rsc')
  ) {
    return;
  }

  // For navigation requests, try network first, fall back to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/pos'))
    );
    return;
  }

  // For static assets, use stale-while-revalidate
  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'image') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
