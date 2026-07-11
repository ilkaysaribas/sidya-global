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

  var loadArabicCurrencyExtension = function () {
    if (document.getElementById("sidyaArabicCurrencyExtension")) return;
    var script = document.createElement("script");
    script.id = "sidyaArabicCurrencyExtension";
    script.src = "sidya-arabic-currency-extension.js?v=20260711-1";
    script.defer = true;
    document.head.appendChild(script);
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

  var formatTryRate = function (value) {
    var number = parseNumber(value);
    if (!number) return "-";
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(number);
  };

  var findMount = function () {
    return document.querySelector(".topbar") || document.querySelector(".main header") || document.querySelector("#appShell");
  };

  var ensureStrip = function () {
    var strip = document.getElementById("exchangeRateStrip");
    if (strip) return strip;
    strip = document.createElement("div");
    strip.id = "exchangeRateStrip";
    strip.className = "exchange-rate-strip";
    strip.innerHTML = '<strong>Canlı Kur Bilgisi</strong><span data-rate="USD">USD -</span><span data-rate="EUR">EUR -</span><span data-rate="RUB">RUB -</span><span data-rate="GEL">GEL -</span><small id="exchangeRateSource">Kaynak: TCMB</small><button type="button" id="refreshExchangeRatesButton">Kuru yenile</button>';

    if (!document.getElementById("sidyaExchangeRateStyle")) {
      var style = document.createElement("style");
      style.id = "sidyaExchangeRateStyle";
      style.textContent = ".exchange-rate-strip{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 14px;padding:10px 12px;border:1px solid #d8e1ec;border-radius:8px;background:#f8fbff;color:#111827}.exchange-rate-strip span,.exchange-rate-strip button{border:1px solid #d8e1ec;border-radius:6px;background:#fff;padding:7px 10px;font-size:13px}.exchange-rate-strip small{color:#64748b}.exchange-rate-strip button{cursor:pointer;font-weight:700;color:#0f5f78}.exchange-rate-strip .rate-warning{color:#b45309}@media(max-width:760px){.exchange-rate-strip{overflow:auto;flex-wrap:nowrap}.exchange-rate-strip>*{white-space:nowrap}}";
      document.head.appendChild(style);
    }

    var mount = findMount();
    if (mount && mount.parentNode) mount.insertAdjacentElement("afterend", strip);
    return strip;
  };

  var renderStrip = function (payload) {
    var strip = ensureStrip();
    var rates = payload && payload.rates ? payload.rates : {};
    strip.querySelector('[data-rate="USD"]').textContent = "USD " + formatTryRate(rates.USD);
    strip.querySelector('[data-rate="EUR"]').textContent = "EUR " + formatTryRate(rates.EUR);
    strip.querySelector('[data-rate="RUB"]').textContent = "RUB " + formatTryRate(rates.RUB);
    strip.querySelector('[data-rate="GEL"]').textContent = "GEL " + formatTryRate(rates.GEL);

    var updated = payload && (payload.fetched_at || payload.updatedAt || payload.updated_at);
    var dateText = updated ? new Date(updated).toLocaleString("tr-TR") : "-";
    var source = strip.querySelector("#exchangeRateSource");
    source.textContent = "Kaynak: " + (payload.source || "TCMB") + " · Güncelleme: " + dateText + (payload.warning ? " · " + payload.warning : "");
    source.className = payload.fallback ? "rate-warning" : "";
  };

  var loadRawRates = function () {
    return originalFetch("/api/exchange-rates?sidya_raw=1&t=" + Date.now(), { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("Kur API yanıt vermedi");
        return response.json();
      })
      .then(function (payload) {
        if (!validTryRates(payload.rates)) throw new Error("Kur verisi doğrulanamadı");
        window.SIDYA_EXCHANGE_RATES_TRY = payload;
        renderStrip(payload);
        return payload;
      })
      .catch(function (error) {
        var strip = ensureStrip();
        var source = strip.querySelector("#exchangeRateSource");
        source.textContent = "Kur alınamadı: " + (error.message || "Bilinmeyen hata");
        source.className = "rate-warning";
      });
  };

  var bindRefresh = function () {
    ensureStrip();
    document.addEventListener("click", function (event) {
      var button = event.target.closest && event.target.closest("#refreshExchangeRatesButton");
      if (!button) return;
      button.disabled = true;
      button.textContent = "Yenileniyor...";
      loadRawRates().finally(function () {
        button.disabled = false;
        button.textContent = "Kuru yenile";
      });
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      bindRefresh();
      loadRawRates();
    });
  } else {
    bindRefresh();
    loadRawRates();
  }
})();
