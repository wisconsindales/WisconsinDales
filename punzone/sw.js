// Pun Zone Service Worker (dev-friendly + offline shell)
const CACHE_NAME = "punzone-cache-v3";

// Cache the core "app shell"
const APP_SHELL = [
  "/punzone/",
  "/punzone/index.html",
  "/punzone/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// Install: cache the shell and activate immediately
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

// Activate: remove old caches and take control immediately
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null))
    );
    await self.clients.claim();
  })());
});

// Fetch strategy:
// - For the game page: network-first (so your edits show quickly)
// - For the shell assets/icons: cache-first (fast + offline)
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle requests for this origin
  if (url.origin !== self.location.origin) return;

  // Only handle the Pun Zone scope + icons
  const isPunZone = url.pathname.startsWith("/punzone/");
  const isIcon = url.pathname === "/icon-192.png" || url.pathname === "/icon-512.png";

  if (!(isPunZone || isIcon)) return;

  // Network-first for HTML (so you see updates fast)
  const isHTML =
    event.request.mode === "navigate" ||
    (event.request.headers.get("accept") || "").includes("text/html");

  if (isHTML) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, fresh.clone());
        return fresh;
      } catch (err) {
        // Offline fallback to cached shell
        const cached = await caches.match("/punzone/index.html");
        return cached || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // Cache-first for everything else in scope
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;

    const fresh = await fetch(event.request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(event.request, fresh.clone());
    return fresh;
  })());
});

