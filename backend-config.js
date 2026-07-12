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
  if (window.__sidyaFeatureExtensionLoader) return;
  window.__sidyaFeatureExtensionLoader = true;

  var isAdminPage = function () {
    var path = String(location.pathname || "").replace(/\/+$/, "");
    return path === "/admin" || path === "/admin.html";
  };

  var forceAdminLtr = function () {
    if (!isAdminPage()) return;
    document.documentElement.setAttribute("lang", "tr");
    document.documentElement.setAttribute("dir", "ltr");
    document.documentElement.classList.add("admin-ltr-root");
    document.documentElement.classList.remove("is-rtl", "rtl");
    if (document.body) {
      document.body.setAttribute("dir", "ltr");
      document.body.classList.add("admin-ltr-body");
      document.body.classList.remove("is-rtl", "rtl");
    }
  };

  var loadScript = function (id, src) {
    if (document.getElementById(id)) return;
    var script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.defer = true;
    document.head.appendChild(script);
  };

  var loadExtensions = function () {
    if (isAdminPage()) {
      forceAdminLtr();
      loadScript("sidyaAdminLtrGuard", "admin-ltr-guard.js?v=20260712-2");
      loadScript("sidyaAdminRfqExtension", "admin-rfq-extension.js?v=20260712-1");
    }
  };

  forceAdminLtr();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadExtensions);
  } else {
    loadExtensions();
  }
})();
