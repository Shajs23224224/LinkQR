const CACHE_NAME = "linkqr-pwa-v1";
const APP_BASE = self.registration.scope;
const APP_BASE_PATH = new URL(APP_BASE).pathname;
const OFFLINE_URL = new URL("offline.html", APP_BASE).href;
const STATIC_ASSET_PATTERN = /\.(?:js|css|svg|png|webp|ico|webmanifest|woff2?)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await self.skipWaiting();
    const cache = await caches.open(CACHE_NAME);
    const shellResponse = await fetch(APP_BASE, { cache: "reload" });
    if (!shellResponse.ok) throw new Error("LinkQR shell could not be cached.");
    const shellHtml = await shellResponse.clone().text();
    await cache.put(APP_BASE, shellResponse);

    const offlineResponse = await fetch(OFFLINE_URL, { cache: "reload" });
    if (!offlineResponse.ok) throw new Error("LinkQR offline fallback could not be cached.");
    await cache.put(OFFLINE_URL, offlineResponse);

    const assetUrls = new Set();
    for (const match of shellHtml.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
      try {
        const assetUrl = new URL(match[1], APP_BASE);
        if (assetUrl.origin !== self.location.origin ||
            !assetUrl.pathname.startsWith(APP_BASE_PATH) ||
            !STATIC_ASSET_PATTERN.test(assetUrl.pathname)) continue;
        assetUrls.add(assetUrl.href);
      } catch {
        // Skip malformed optional shell links.
      }
    }

    await Promise.all([...assetUrls].map(async (assetUrl) => {
      const isCritical = /\.(?:js|css)$/i.test(new URL(assetUrl).pathname);
      try {
        const response = await fetch(assetUrl, { cache: "reload" });
        if (response.ok) await cache.put(assetUrl, response);
        else if (isCritical) throw new Error("A critical LinkQR asset could not be cached.");
      } catch (error) {
        if (isCritical) throw error;
      }
    }));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((name) => name.startsWith("linkqr-pwa-") && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin ||
      !requestUrl.pathname.startsWith(APP_BASE_PATH)) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(APP_BASE, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(APP_BASE)) ||
          (await caches.match(OFFLINE_URL)) ||
          Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type !== "opaque") {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return (await caches.match(OFFLINE_URL)) || Response.error();
    }
  })());
});
