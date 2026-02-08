// Pun Zone Service Worker (game shell + offline-friendly)
const CACHE_NAME = "punzone-cache-v5";

const APP_SHELL = [
  "/punzone/",
  "/punzone/index.html",
  "/punzone/manifest.json",
  "/punzone/jokes.json",
  "/icon-192.png",
  "/icon-512.png",

  // Optional sounds (add these files to /punzone/)
  "/punzone/correct.wav",
  "/punzone/wrong.wav",
  "/punzone/tick.wav"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;
  const inScope = url.pathname.startsWith("/punzone/") || url.pathname.startsWith("/icon-");
  if (!inScope) return;

  const isHTML =
    event.request.mode === "navigate" ||
    (event.request.headers.get("accept") || "").includes("text/html");

  // Network-first for HTML/JSON so updates come through fast
  const isJSON = (event.request.headers.get("accept") || "").includes("application/json") || url.pathname.endsWith(".json");

  if (isHTML || isJSON) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(event.request);
        return cached || caches.match("/punzone/index.html");
      }
    })());
    return;
  }

  // Cache-first for assets (icons/sounds)
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;

    const fresh = await fetch(event.request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(event.request, fresh.clone());
    return fresh;
  })());
});
