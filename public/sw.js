/*
 * DormDrop service worker — basic offline support.
 *
 * Strategy: network-first for page navigations, falling back to a cached
 * offline page when the network is unavailable. We deliberately do NOT cache
 * the app shell / API responses, to avoid serving stale data — this is just a
 * graceful "you're offline" experience, not full offline functionality.
 */
const CACHE = "dormdrop-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only handle top-level page navigations.
  if (request.method !== "GET" || request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(() => caches.match(OFFLINE_URL)),
  );
});
