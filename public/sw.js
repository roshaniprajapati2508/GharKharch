// GharKharch service worker (spec section 41, 74).
//
// Scope, deliberately: cache static assets so the app shell loads instantly
// and survives brief connectivity drops, and show a friendly offline page if
// a navigation request fails with no cache to fall back on. It does NOT try
// to cache or replay API/data requests - Supabase reads/writes always need a
// real round trip, and the actual offline capability for adding an expense
// while offline is handled client-side by src/lib/offline/offline-queue.ts
// (IndexedDB), not by this worker. Per spec: "Do NOT compromise data
// integrity for a fake offline experience."

const CACHE_NAME = "gharkharch-static-v1";
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never intercept mutations - those go straight to the network (or the IndexedDB queue) untouched

  const url = new URL(request.url);

  // Never cache API/data calls, Server Actions, or Supabase requests.
  if (url.pathname.startsWith("/api/") || request.headers.get("Next-Action")) return;

  // Static, hashed Next.js assets and app icons: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return res;
      }))
    );
    return;
  }

  // Page navigations: network-first, falling back to the offline page only
  // when there is truly no connectivity - never serve a stale cached page of
  // financial data as if it were current.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((res) => res ?? Response.error()))
    );
  }
});
