(function () {
  if (window.__sidyaLocaleLayoutFixes) return;
  window.__sidyaLocaleLayoutFixes = true;

  var SUPPORTED_LOCALES = ["tr", "en", "az", "ka", "ru", "ar"];
  var RTL_LOCALES = { ar: true };
  var FALLBACK_ORDER = {
    ar: ["ar", "en"],
    tr: ["tr", "en"],
    en: ["en", "tr"],
    az: ["az", "en", "tr"],
    ka: ["ka", "en", "tr"],
    ru: ["ru", "en", "tr"]
  };

  var AR_STATIC_REPLACEMENTS = {
    "Ev ve Yaşam": "المنزل والمعيشة",
    "Temizlik": "مواد التنظيف",
    "Endüstriyel": "المستلزمات الصناعية",
    "Gıda Ürünleri": "منتجات غذائية",
    "Medikal Ürünler": "منتجات طبية",
    "Kozmetik & Kişisel Bakım": "مستحضرات وعناية شخصية",
    "Otomotiv": "السيارات",
    "Hırdavat & Yapı": "البناء والعدد",
    "Ürünler": "المنتجات",
    "Süreç": "العملية",
    "Pazarlar": "الأسواق",
    "Gümrük": "الجمارك",
    "Proforma Oluştur": "إنشاء عرض مبدئي",
    "B2B Portal Girişi": "دخول بوابة B2B",
    "Lojistik": "اللوجستيات",
    "Canlı Kur Bilgisi": "أسعار الصرف الحالية",
    "Kuru yenile": "تحديث الأسعار",
    "Kaynak": "المصدر",
    "Güncelleme": "آخر تحديث",
    "Amerikan Doları": "USD",
    "Rus Rublesi": "RUB",
    "Gürcistan Larisi": "GEL",
    "Azerbaycan Manatı": "AZN",
    "Suudi Arabistan Riyali": "SAR",
    "Birleşik Arap Emirlikleri Dirhemi": "AED",
    "Katar Riyali": "QAR",
    "Kuveyt Dinarı": "KWD",
    "Bahreyn Dinarı": "BHD",
    "Umman Riyali": "OMR"
  };

  function normalizeLocale(value) {
    var raw = String(value || "").trim().replace("_", "-").toLowerCase();
    if (!raw) return "en";
    var short = raw.split("-")[0];
    if (short === "ge") short = "ka";
    return SUPPORTED_LOCALES.indexOf(short) > -1 ? short : "en";
  }

  function readLocale() {
    var queryLang = "";
    try { queryLang = new URLSearchParams(window.location.search).get("lang") || ""; } catch (error) {}
    return normalizeLocale(queryLang || localStorage.getItem("sidyaLang") || document.documentElement.lang || "en");
  }

  function pickLocalizedValue(item, locale, base) {
    if (!item) return "";
    var order = FALLBACK_ORDER[normalizeLocale(locale)] || FALLBACK_ORDER.en;
    for (var index = 0; index < order.length; index += 1) {
      var lang = order[index];
      var direct = item[base + "_" + lang] || item[base + lang.toUpperCase()];
      if (direct && String(direct).trim()) return String(direct).trim();
      if (item[base] && typeof item[base] === "object") {
        var nested = item[base][lang] || item[base][lang.toUpperCase()];
        if (nested && String(nested).trim()) return String(nested).trim();
      }
      if (item.names && item.names[lang] && String(item.names[lang]).trim()) return String(item.names[lang]).trim();
      if (item.translations && item.translations[lang]) {
        var translated = item.translations[lang][base] || item.translations[lang].name || item.translations[lang].title;
        if (translated && String(translated).trim()) return String(translated).trim();
      }
      if (item.i18n && item.i18n[lang]) {
        var i18nValue = item.i18n[lang][base] || item.i18n[lang].name || item.i18n[lang].title;
        if (i18nValue && String(i18nValue).trim()) return String(i18nValue).trim();
      }
    }
    var safe = item[base] || item.name_en || item.title_en || item.label_en || item.id || "";
    return safe ? String(safe).trim() : "";
  }

  window.SIDYA_I18N = window.SIDYA_I18N || {};
  window.SIDYA_I18N.normalizeLocale = normalizeLocale;
  window.SIDYA_I18N.getLocalizedText = function (item, locale, field) {
    return pickLocalizedValue(item, locale, field || "name") || "";
  };
  window.getLocalizedText = window.SIDYA_I18N.getLocalizedText;

  function ensureStyle() {
    if (document.getElementById("sidyaLocaleLayoutFixStyle")) return;
    var style = document.createElement("style");
    style.id = "sidyaLocaleLayoutFixStyle";
    style.textContent = [
      "html,body{max-width:100%;overflow-x:clip}",
      "body{width:100%}",
      ".site-header,.exchange-rate-bar{width:100%;max-width:100%;padding-inline:clamp(12px,3.2vw,38px)}",
      ".site-header{flex-wrap:wrap;align-items:center;row-gap:8px;overflow:visible}",
      ".brand{min-width:0;flex:0 0 auto}",
      ".nav-links{min-width:0;flex:1 1 420px;flex-wrap:wrap;justify-content:center;row-gap:4px;text-align:start}",
      ".header-actions{min-width:0;max-width:100%;flex:1 1 320px;flex-wrap:wrap;justify-content:flex-end;gap:6px;overflow:visible}",
      ".top-contact-links{min-width:0;flex-wrap:wrap;justify-content:inherit}",
      ".lang-switch{min-width:0;max-width:100%;display:grid;grid-template-columns:repeat(6,minmax(34px,auto));gap:4px}",
      ".currency-switch{min-width:0;max-width:100%;flex:0 1 auto}",
      ".currency-switch select{max-width:92px;min-width:64px;text-overflow:ellipsis}",
      ".install-app-link{flex:0 0 auto;max-width:100%}",
      ".products-menu{inset-inline-start:0;left:auto;right:auto;max-width:calc(100vw - 24px);overflow:auto}",
      "html[dir='rtl'] .products-menu{inset-inline-start:auto;inset-inline-end:0;text-align:start}",
      ".customs-nav-item .customs-menu{inset-inline-start:0;left:auto;right:auto}",
      "html[dir='rtl'] .customs-nav-item .customs-menu{inset-inline-start:auto;inset-inline-end:0}",
      ".exchange-rate-bar{flex-wrap:wrap;align-items:flex-start;overflow:visible}",
      ".exchange-rate-heading{min-width:min(150px,100%)}",
      ".exchange-rate-list{min-width:0;max-width:100%;flex:1 1 420px;justify-content:flex-end;overflow:visible}",
      ".exchange-rate-list span{min-width:0;max-width:100%;white-space:normal;text-align:start;overflow-wrap:anywhere}",
      ".hero,.hero-inner,.hero-content,.hero-card,.section,.section-inner,main,footer{max-width:100%}",
      "html[dir='rtl'] .hero,html[dir='rtl'] .hero-content{text-align:start}",
      "html[dir='rtl'] .hero-actions{justify-content:flex-start}",
      "html[dir='rtl'] .site-header,html[dir='rtl'] .nav-links,html[dir='rtl'] .header-actions,html[dir='rtl'] .exchange-rate-bar,html[dir='rtl'] .exchange-rate-list{direction:rtl}",
      "html:not([dir='rtl']) .site-header,html:not([dir='rtl']) .nav-links,html:not([dir='rtl']) .header-actions,html:not([dir='rtl']) .exchange-rate-bar,html:not([dir='rtl']) .exchange-rate-list{direction:ltr}",
      "@media(max-width:1180px){.site-header{justify-content:center}.brand{flex:1 1 100%;justify-content:center}.nav-links{order:2;flex-basis:100%;justify-content:center}.header-actions{order:3;flex-basis:100%;justify-content:center}}",
      "@media(max-width:760px){.site-header{padding-inline:12px}.nav-links{gap:8px;font-size:.78rem}.header-actions{display:flex;width:100%;justify-content:center}.top-contact-links{width:100%;justify-content:center}.lang-switch{grid-template-columns:repeat(3,minmax(42px,1fr));width:min(240px,100%)}.currency-switch{width:auto;order:0}.exchange-rate-list{justify-content:flex-start}.products-menu{position:fixed;inset-inline:12px;top:92px;grid-template-columns:1fr;max-height:70vh;min-width:0;width:auto}}",
      "@media(max-width:420px){.nav-links{justify-content:flex-start;overflow-x:auto;overscroll-behavior-inline:contain;padding-block-end:2px}.nav-links a,.has-dropdown>a{white-space:nowrap}.header-actions{justify-content:flex-start}.top-contact-links{justify-content:flex-start}.exchange-rate-list{display:grid;grid-template-columns:1fr 1fr;width:100%}.exchange-rate-list span{padding-inline:8px}.install-app-link{min-width:0}.products-menu{top:118px}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function applyDocumentDirection(locale) {
    var lang = normalizeLocale(locale);
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL_LOCALES[lang] ? "rtl" : "ltr";
    if (document.body) document.body.classList.toggle("is-rtl", lang === "ar");
    try { localStorage.setItem("sidyaLang", lang); } catch (error) {}
    document.querySelectorAll("[dir]").forEach(function (node) {
      if (node !== document.documentElement && node.hasAttribute("data-sidya-added-dir")) node.removeAttribute("dir");
    });
    document.querySelectorAll(".lang-option").forEach(function (button) {
      button.classList.toggle("is-active", normalizeLocale(button.dataset.lang || button.textContent) === lang);
    });
  }

  function preserveUrlLocale(locale) {
    try {
      var url = new URL(window.location.href);
      url.searchParams.set("lang", normalizeLocale(locale));
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    } catch (error) {}
  }

  function localizeCatalogArrays(locale) {
    var lang = normalizeLocale(locale);
    [window.catalog, window.CATALOG_PRODUCTS, window.SIDYA_CATALOG_PRODUCTS, window.catalogProducts].forEach(function (list) {
      if (!Array.isArray(list)) return;
      list.forEach(function (item) {
        if (!item || item.__sidyaOriginalName) return;
        item.__sidyaOriginalName = item.name;
        item.__sidyaOriginalCategory = item.category || item.sourceCategory;
      });
      list.forEach(function (item) {
        if (!item) return;
        var localizedName = pickLocalizedValue(item, lang, "name");
        if (localizedName) item.name = localizedName;
        var localizedCategory = pickLocalizedValue(item, lang, "category");
        if (localizedCategory) item.category = localizedCategory;
      });
    });
  }

  function replaceArabicStaticText() {
    if (normalizeLocale(document.documentElement.lang) !== "ar") return;
    var keys = Object.keys(AR_STATIC_REPLACEMENTS).sort(function (a, b) { return b.length - a.length; });
    document.querySelectorAll("a,button,span,strong,h1,h2,h3,h4,p,label,small,option").forEach(function (node) {
      if (!node || node.children.length) return;
      var text = String(node.textContent || "").trim();
      if (!text) return;
      var replacement = AR_STATIC_REPLACEMENTS[text];
      if (replacement) {
        node.textContent = replacement;
        return;
      }
      keys.forEach(function (key) {
        if (node.textContent && node.textContent.indexOf(key) > -1) {
          node.textContent = node.textContent.replace(key, AR_STATIC_REPLACEMENTS[key]);
        }
      });
    });
  }

  function normalizeCurrencyLabels() {
    document.querySelectorAll("#currencySelector option").forEach(function (option) {
      var value = String(option.value || option.textContent || "").trim().toUpperCase();
      if (/^[A-Z]{3}$/.test(value)) {
        option.value = value;
        option.textContent = value;
      }
    });
  }

  function applyLocale(locale, updateUrl) {
    var lang = normalizeLocale(locale);
    ensureStyle();
    applyDocumentDirection(lang);
    localizeCatalogArrays(lang);
    normalizeCurrencyLabels();
    if (lang === "ar") replaceArabicStaticText();
    if (updateUrl) preserveUrlLocale(lang);
  }

  function bindLanguageClicks() {
    document.addEventListener("click", function (event) {
      var button = event.target.closest && event.target.closest(".lang-option");
      if (!button) return;
      var lang = normalizeLocale(button.dataset.lang || button.getAttribute("lang") || button.textContent);
      if (SUPPORTED_LOCALES.indexOf(lang) === -1) return;
      setTimeout(function () { applyLocale(lang, true); }, 0);
    }, true);
  }

  function boot() {
    applyLocale(readLocale(), false);
  }

  ensureStyle();
  bindLanguageClicks();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  window.addEventListener("popstate", function () { applyLocale(readLocale(), false); });
  var pending = false;
  new MutationObserver(function () {
    if (pending) return;
    pending = true;
    setTimeout(function () {
      pending = false;
      applyLocale(readLocale(), false);
    }, 60);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
