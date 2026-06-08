const CACHE_NAME = "sidya-global-v40";

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./offline.html",
  "./styles.css?v=20260608-4",
  "./catalog-products.generated.js?v=20260601-5",
  "./script.js?v=20260608-4",
  "./manifest.webmanifest",
  "./assets/app-icon.svg",
  "./assets/app-icon-192.png",
  "./assets/app-icon-512.png",
  "./assets/maskable-icon.svg",
  "./assets/sidya-global-hero-wide.jpeg",
  "./assets/icon-instagram.svg",
  "./assets/icon-facebook.svg",
  "./assets/icon-tiktok.svg",
  "./assets/icon-mail.svg",
  "./assets/icon-telegram.svg",
  "./assets/transport-truck.svg",
  "./assets/transport-container.svg",
  "./assets/abc-logo.jpg",
  "./assets/unilever-logo.svg",
  "./assets/pg-logo.svg",
  "./assets/henkel-logo.svg",
  "./assets/johnson-logo.svg",
  "./assets/evyap-logo.svg",
  "./assets/demet-temizlik-logo.svg",
  "./assets/oncu-salca-logo.svg",
  "./assets/garipler-yapi-market-logo.svg",
  "./assets/selpak-logo.svg",
  "./assets/ikihan-medikal-logo.svg",
  "./assets/omron-logo.svg",
  "./assets/hanymish-logo.svg",
  "./assets/scjohnson-logo.svg",
  "./assets/nivea-logo.svg",
  "./assets/sebamed-logo.svg",
  "./assets/vileda-logo.svg",
  "./assets/reckitt-logo.svg",
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

  if (request.method !== "GET" || url.pathname.endsWith(".pdf") || url.pathname.endsWith("/backend-config.js") || url.pathname.startsWith("/api/")) {
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
