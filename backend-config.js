window.SIDYA_BACKEND = window.SIDYA_BACKEND || {
  supabaseUrl: "",
  supabaseAnonKey: "",
  supabasePublishableKey: "",
  storageBucket: "b2b-documents",
  configured: false,
};

(function () {
  if (window.__sidyaBackendDynamicConfigLoader) return;
  window.__sidyaBackendDynamicConfigLoader = true;
  if (location.protocol === "file:") return;
  if (document.getElementById("sidyaBackendDynamicConfig")) return;
  var script = document.createElement("script");
  script.id = "sidyaBackendDynamicConfig";
  script.src = "/api/backend-config.js";
  script.defer = true;
  document.head.appendChild(script);
})();

(function () {
  if (window.__sidyaArabicCurrencyExtensionLoader) return;
  window.__sidyaArabicCurrencyExtensionLoader = true;

  var loadScript = function (id, src) {
    if (document.getElementById(id)) return;
    var script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.defer = true;
    document.head.appendChild(script);
  };

  var loadArabicCurrencyExtension = function () {
    loadScript("sidyaArabicCurrencyExtension", "sidya-arabic-currency-extension.js?v=20260711-1");
    loadScript("sidyaLocaleLayoutFixes", "sidya-locale-layout-fixes.js?v=20260712-1");
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadArabicCurrencyExtension);
  } else {
    loadArabicCurrencyExtension();
  }
})();

(function () {
  if (window.__sidyaExchangeRateBridge) return;
  window.__sidyaExchangeRateBridge = true;

  var originalFetch = window.fetch ? window.fetch.bind(window) : null;
  if (!originalFetch) return;
  window.__sidyaOriginalFetch = originalFetch;

  var parseNumber = function (value) {
    var number = Number(String(value || "").replace(",", "."));
    return Number.isFinite(number) && number > 0 ? number : 0;
  };

  var validTryRates = function (rates) {
    var usd = parseNumber(rates && rates.USD);
    var eur = parseNumber(rates && rates.EUR);
    var rub = parseNumber(rates && rates.RUB);
    var gel = parseNumber(rates && rates.GEL);
    return usd > 5 && eur > 5 && eur > usd * 0.5 && rub > 0.01 && rub < 10 && gel > 0.5;
  };

  var toLegacyRates = function (payload) {
    var rates = payload && payload.rates ? payload.rates : {};
    var usd = parseNumber(rates.USD);
    var eur = parseNumber(rates.EUR);
    var rub = parseNumber(rates.RUB);
    var gel = parseNumber(rates.GEL);
    if (!validTryRates(rates)) return payload;

    var legacyRates = {
      USD: 1,
      TRY: usd,
      USDTRY: usd,
      EUR: usd / eur,
      USDEUR: usd / eur,
      RUB: usd / rub,
      USDRUB: usd / rub,
      GEL: usd / gel,
      USDGEL: usd / gel,
    };

    Object.keys(rates).forEach(function (code) {
      var tryRate = parseNumber(rates[code]);
      if (!tryRate || code === "USD" || code === "TRY") return;
      legacyRates[code] = usd / tryRate;
      legacyRates["USD" + code] = usd / tryRate;
    });

    return Object.assign({}, payload, {
      tryRates: rates,
      rates: legacyRates,
      updated_at: payload.fetched_at || payload.updatedAt || new Date().toISOString(),
    });
  };

  var isExchangeRateRequest = function (input) {
    var url = typeof input === "string" ? input : input && input.url;
    return typeof url === "string" && url.indexOf("/api/exchange-rates") !== -1 && url.indexOf("sidya_raw=1") === -1;
  };

  window.fetch = function (input, init) {
    if (!isExchangeRateRequest(input)) return originalFetch(input, init);

    return originalFetch(input, init).then(function (response) {
      var clone = response.clone();
      return clone.json().then(function (payload) {
        var legacyPayload = toLegacyRates(payload);
        return new Response(JSON.stringify(legacyPayload), {
          status: response.status,
          statusText: response.statusText,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      }).catch(function () {
        return response;
      });
    });
  };

  originalFetch("/api/exchange-rates?sidya_raw=1&t=" + Date.now(), { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("Kur API yanıt vermedi");
      return response.json();
    })
    .then(function (payload) {
      if (validTryRates(payload.rates)) window.SIDYA_EXCHANGE_RATES_TRY = payload;
    })
    .catch(function () {});
})();

(function () {
  if (window.__sidyaCurrencySeoNormalizer) return;
  window.__sidyaCurrencySeoNormalizer = true;

  var supportedCurrencies = ["TRY", "USD", "EUR", "RUB", "GEL", "AZN", "SAR", "AED", "QAR", "KWD", "BHD", "OMR"];
  var aliases = {
    "AMERIKAN DOLARI": "USD",
    "AMERİKAN DOLARI": "USD",
    "DENEMEK": "USD",
    "EURO": "EUR",
    "OVMAK": "RUB",
    "RUS RUBLESI": "RUB",
    "RUS RUBLESİ": "RUB",
    "JEL": "GEL",
    "GURCISTAN LARISI": "GEL",
    "GÜRCİSTAN LARİSİ": "GEL"
  };

  var normalizeCode = function (value) {
    var raw = String(value || "").trim();
    var upper = raw.toLocaleUpperCase("tr-TR");
    return aliases[upper] || (supportedCurrencies.indexOf(upper) > -1 ? upper : raw);
  };

  var normalizeCurrencySelect = function (select) {
    if (!select || select.__sidyaCurrencyNormalized) return;
    var seen = {};
    Array.from(select.options || []).forEach(function (option) {
      var code = normalizeCode(option.value || option.textContent);
      if (supportedCurrencies.indexOf(code) === -1) code = normalizeCode(option.textContent);
      if (supportedCurrencies.indexOf(code) === -1) return;
      option.value = code;
      option.textContent = code;
      seen[code] = true;
    });
    supportedCurrencies.forEach(function (code) {
      if (seen[code]) return;
      var option = document.createElement("option");
      option.value = code;
      option.textContent = code;
      select.appendChild(option);
      seen[code] = true;
    });
    select.__sidyaCurrencyNormalized = true;
  };

  var normalizeCurrencySelectors = function () {
    Array.from(document.querySelectorAll("select")).forEach(function (select) {
      var values = Array.from(select.options || []).map(function (option) {
        return normalizeCode(option.value || option.textContent);
      });
      if (select.id === "currencySelector" || values.indexOf("USD") > -1 || values.indexOf("EUR") > -1) {
        normalizeCurrencySelect(select);
      }
    });
  };

  var ensureSeoLinks = function () {
    if (!document.querySelector('link[rel="alternate"][hreflang="ar"]')) {
      var link = document.createElement("link");
      link.rel = "alternate";
      link.hreflang = "ar";
      link.href = "https://sidyaglobal.com/?lang=ar";
      document.head.appendChild(link);
    }
    if (!document.querySelector('link[rel="alternate"][hreflang="x-default"]')) {
      var fallback = document.createElement("link");
      fallback.rel = "alternate";
      fallback.hreflang = "x-default";
      fallback.href = "https://sidyaglobal.com/";
      document.head.appendChild(fallback);
    }
  };

  var run = function () {
    normalizeCurrencySelectors();
    ensureSeoLinks();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
  new MutationObserver(run).observe(document.documentElement, { childList: true, subtree: true });
})();
