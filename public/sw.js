// MindLoop Service Worker — v2
const CACHE = "mindloop-v2";

// App shell — pages to cache on install
const SHELL = [
  "./",
  "./tests/",
  "./history/",
  "./learn/",
];

// ── Install: pre-cache app shell ───────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll(SHELL).catch(() => {
        // Non-fatal: some shells might 404 in dev
      });
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ─────────────────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: stale-while-revalidate for navigation, cache-first for assets ───────
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Skip non-GET and cross-origin
  if (e.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // Skip Mistral API and other external calls
  if (!url.pathname.startsWith(self.registration.scope.replace(self.location.origin, ""))) return;

  // Navigation requests: network-first, fall back to cached shell
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match("./") || caches.match(e.request))
    );
    return;
  }

  // Assets: cache-first
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (!res || res.status !== 200 || res.type === "opaque") return res;
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return res;
      });
    })
  );
});
