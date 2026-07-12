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
    loadScript("sidyaLocaleLayoutFixes", "sidya-locale-layout-fixes.js?v=20260712-2");
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadArabicCurrencyExtension);
  } else {
    loadArabicCurrencyExtension();
  }
})();
