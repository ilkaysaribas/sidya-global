const CACHE_NAME = "sidya-global-v7";

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./offline.html",
  "./styles.css?v=20260601-4",
  "./script.js?v=20260601-4",
  "./manifest.webmanifest",
  "./assets/app-icon.svg",
  "./assets/app-icon-192.png",
  "./assets/app-icon-512.png",
  "./assets/maskable-icon.svg",
  "./assets/sidya-global-hero-clean.jpeg",
  "./assets/abc-logo.jpg",
  "./assets/unilever-logo.svg",
  "./assets/pg-logo.svg",
  "./assets/henkel-logo.svg",
  "./assets/johnson-logo.svg",
  "./assets/evyap-logo.svg",
  "./assets/demet-temizlik-logo.svg",
  "./assets/oncu-salca-logo.svg",
  "./assets/garipler-yapi-market-logo.svg",
  "./assets/flag-tr.svg",
  "./assets/flag-gb.svg",
  "./assets/flag-az.svg",
  "./assets/flag-ge.svg",
  "./assets/flag-ru.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.pathname.endsWith(".pdf")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((response) => response || caches.match("./offline.html"))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === "opaque") {
          return response;
        }

        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    }),
  );
});
