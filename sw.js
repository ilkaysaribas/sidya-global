const CACHE_NAME = "sidya-global-v98";

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./request-quote.html",
  "./offline.html",
  "./styles.css?v=20260613-4",
  "./rfq.css?v=20260712-1",
  "./catalog-products.generated.js?v=20260614-1",
  "./script.js?v=20260621-1",
  "./rfq-currencies.js?v=20260712-1",
  "./rfq-site-extension.js?v=20260712-1",
  "./rfq.js?v=20260712-1",
  "./sidya-arabic-currency-extension.js?v=20260711-1",
  "./sidya-locale-layout-fixes.js?v=20260712-2",
  "./sidya-rtl-hero-fix.js?v=20260712-2",
  "./sidya-proforma-core-fix.js?v=20260712-2",
  "./admin-ltr-guard.js?v=20260712-1",
  "./assets/xlsx.full.min.js",
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
  "./assets/icon-whatsapp.svg",
  "./assets/transport-truck.svg",
  "./assets/transport-container.svg",
  "./assets/category-home.svg",
  "./assets/category-cleaning.svg",
  "./assets/category-food.svg",
  "./assets/category-industrial.svg",
  "./assets/category-medical.svg",
  "./assets/category-cosmetics.svg",
  "./assets/category-automotive.svg",
  "./assets/category-hardware.svg",
  "./assets/category-home-crop.png",
  "./assets/category-cleaning-crop.png",
  "./assets/category-food-crop.png",
  "./assets/category-industrial-crop.png",
  "./assets/category-medical-crop.png",
  "./assets/category-cosmetics-crop.png",
  "./assets/category-automotive-crop.png",
  "./assets/category-hardware-crop.png",
  "./assets/abc-logo.jpg",
  "./assets/unilever-logo.svg",
  "./assets/pg-logo.svg",
  "./assets/henkel-logo.svg",
  "./assets/johnson-logo.svg",
  "./assets/evyap-logo.svg",
  "./assets/demet-temizlik-logo.svg",
  "./assets/oncu-salca-logo.svg",
  "./assets/heinz-logo.svg",
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
    const navigationRequest = url.pathname === "/admin.html" || url.pathname === "/request-quote"
      ? new Request(request, { cache: "no-store" })
      : request;
    event.respondWith(
      fetch(navigationRequest)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((response) => response || caches.match("./offline.html"))),
    );
    return;
  }

  if (
    url.pathname === "/catalog-products.generated.js" ||
    url.pathname === "/admin.js" ||
    url.pathname === "/admin.css" ||
    url.pathname === "/rfq.js" ||
    url.pathname === "/rfq.css" ||
    url.pathname === "/rfq-currencies.js" ||
    url.pathname === "/rfq-site-extension.js" ||
    url.pathname === "/admin-rfq-extension.js" ||
    url.pathname === "/admin-ltr-guard.js" ||
    url.pathname === "/sidya-arabic-currency-extension.js" ||
    url.pathname === "/sidya-locale-layout-fixes.js" ||
    url.pathname === "/sidya-rtl-hero-fix.js" ||
    url.pathname === "/sidya-proforma-core-fix.js"
  ) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request)),
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