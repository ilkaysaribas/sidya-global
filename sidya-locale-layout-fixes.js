(function () {
  if (window.__sidyaLocaleLayoutFixes) return;
  window.__sidyaLocaleLayoutFixes = true;

  var SUPPORTED_LOCALES = ["tr", "en", "az", "ka", "ru", "ar"];
  var RTL_LOCALES = { ar: true };
  var STORAGE_KEYS = ["sidyaLang", "sidyaLocale", "preferredLanguage", "language"];
  var FALLBACK_ORDER = {
    ar: ["ar", "en"],
    tr: ["tr", "en"],
    en: ["en"],
    az: ["az", "en", "tr"],
    ka: ["ka", "en", "tr"],
    ru: ["ru", "en", "tr"],
  };

  var KEY_FALLBACKS = {
    ar: {
      navProducts: "المنتجات",
      navHome: "المنزل والمعيشة",
      navCleaning: "التنظيف",
      navIndustrial: "الصناعي",
      navProcess: "العملية",
      navMarkets: "الأسواق",
      navCustoms: "الجمارك",
      navProforma: "إنشاء بروفرما",
      navB2B: "دخول بوابة B2B",
      installAppCta: "تطبيق",
      exchangeTitle: "أسعار الصرف الحالية",
      exchangeLoading: "جار التحميل...",
      exchangeUpdated: "تم التحديث",
      exchangeChecked: "تم الفحص",
      exchangeDataDate: "بيانات السعر",
      exchangeUnavailable: "تعذر تحميل أسعار الصرف",
      heroEyebrow: "التنظيف • الصناعي • المنزل والمعيشة • الصحة • العناية الشخصية",
      heroTitle: "بوابتك الموثوقة إلى المنتجات التركية عالية الجودة",
      heroCopy: "تساعد Sidya Global المشترين الدوليين على توريد منتجات عالية الجودة من موردين أتراك موثوقين بسرعة وشفافية واحترافية.",
      heroPrimary: "اطلب عرض سعر",
      heroSecondary: "عرض المنتجات",
      metricCountries: "الأسواق المستهدفة",
      metricCategories: "مجموعات المنتجات",
      metricQuoteValue: "يوم واحد",
      metricQuote: "مدة الرد على العرض",
      supplierSearchKicker: "بحث توريد B2B",
      supplierSearchTitle: "ابحث عن منتجات من تركيا",
      supplierSearchPlaceholder: "ابدأ البحث عن المنتجات أو العلامات أو الفئات",
      productOptionHomeware: "المنزل ونمط الحياة",
      productOptionCleaning: "منتجات التنظيف",
      productOptionFood: "منتجات غذائية",
      productOptionIndustrial: "مستلزمات صناعية",
      productOptionMedical: "منتجات طبية",
      productOptionCosmetics: "مستحضرات التجميل والعناية الشخصية",
      productOptionAutomotive: "السيارات",
      productOptionHardware: "البناء والعدد",
      footerText: "موقع عرض تصديري مقره طرابزون",
    },
    en: {
      navProducts: "Products",
      navHome: "Home & Living",
      navCleaning: "Cleaning",
      navIndustrial: "Industrial",
      navProcess: "Process",
      navMarkets: "Markets",
      navCustoms: "Customs",
      navProforma: "Create Proforma",
      navB2B: "B2B Portal Login",
      installAppCta: "App",
      heroTitle: "Your Trusted Gateway to Reliable Products from Türkiye",
      heroPrimary: "Get a Quote",
      heroSecondary: "View Products",
    },
    tr: {
      navProducts: "Ürünler",
      navHome: "Ev ve Yaşam",
      navCleaning: "Temizlik",
      navIndustrial: "Endüstriyel",
      navProcess: "Süreç",
      navMarkets: "Pazarlar",
      navCustoms: "Gümrük",
      navProforma: "Proforma Oluştur",
      navB2B: "B2B Portal Giriş",
      installAppCta: "Uygulama",
      heroTitle: "Türkiye'den Güvenilir Ürünlere Açılan Kapınız",
      heroPrimary: "Teklif Al",
      heroSecondary: "Ürünleri İncele",
    },
  };

  var EXACT_REPLACEMENTS = {
    ar: {
      "Ürün Bul": "البحث عن منتج",
      "Lojistik": "اللوجستيات",
      "Dolar": "USD",
      "Euro": "EUR",
      "Dolar/TL": "USD/TRY",
      "Manat": "AZN",
      "Ruble": "RUB",
      "Lari": "GEL",
      "Ev ve Yaşam": "المنزل والمعيشة",
      "Temizlik": "التنظيف",
      "Endüstriyel": "الصناعي",
      "Gıda Ürünleri": "منتجات غذائية",
      "Medikal Ürünler": "منتجات طبية",
      "Kozmetik & Kişisel Bakım": "مستحضرات التجميل والعناية الشخصية",
      "Otomotiv": "السيارات",
      "Hırdavat & Yapı": "البناء والعدد",
      "Proforma Oluştur": "إنشاء بروفرما",
      "B2B Portal Giriş": "دخول بوابة B2B",
    },
    en: {
      "Ürün Bul": "Find Products",
      "Lojistik": "Logistics",
      "Ev ve Yaşam": "Home & Living",
      "Temizlik": "Cleaning",
      "Endüstriyel": "Industrial",
      "Gıda Ürünleri": "Food Products",
      "Medikal Ürünler": "Medical Products",
      "Kozmetik & Kişisel Bakım": "Cosmetics & Personal Care",
      "Otomotiv": "Automotive",
      "Hırdavat & Yapı": "Construction & Hardware",
    },
  };

  var CURRENCY_LABELS = {
    TRY: "TRY", USD: "USD", EUR: "EUR", GEL: "GEL", RUB: "RUB", AZN: "AZN", GBP: "GBP", CNY: "CNY", AED: "AED", SAR: "SAR", QAR: "QAR", KWD: "KWD", BHD: "BHD", OMR: "OMR", IQD: "IQD", KZT: "KZT", UAH: "UAH", MDL: "MDL", AMD: "AMD", IRR: "IRR",
  };

  function normalizeLocale(value) {
    var raw = String(value || "").trim();
    if (!raw) return "en";
    var lowered = raw.replace("_", "-").toLowerCase();
    if (lowered === "ge") return "ka";
    var shortCode = lowered.split("-")[0];
    if (shortCode === "ge") return "ka";
    return SUPPORTED_LOCALES.indexOf(shortCode) >= 0 ? shortCode : "en";
  }

  function safeStorageGet(key) {
    try { return window.localStorage && window.localStorage.getItem(key); } catch (error) { return ""; }
  }

  function safeStorageSet(locale) {
    STORAGE_KEYS.forEach(function (key) {
      try { window.localStorage && window.localStorage.setItem(key, locale); } catch (error) {}
    });
  }

  function readLocale() {
    var params = new URLSearchParams(window.location.search);
    var fromUrl = params.get("lang") || params.get("locale");
    if (fromUrl) return normalizeLocale(fromUrl);
    for (var i = 0; i < STORAGE_KEYS.length; i += 1) {
      var stored = safeStorageGet(STORAGE_KEYS[i]);
      if (stored) return normalizeLocale(stored);
    }
    return normalizeLocale(document.documentElement.getAttribute("lang") || "en");
  }

  function getDictionary(locale) {
    var lang = normalizeLocale(locale);
    var base = {};
    try {
      if (typeof content !== "undefined" && content && content[lang]) base = content[lang];
    } catch (error) {}
    return Object.assign({}, KEY_FALLBACKS[lang] || {}, base);
  }

  function firstText(value) {
    return typeof value === "string" && value.trim() ? value : "";
  }

  function getLocalizedText(item, locale, baseKey) {
    if (!item) return "";
    var lang = normalizeLocale(locale);
    var base = baseKey || "name";
    var order = FALLBACK_ORDER[lang] || FALLBACK_ORDER.en;
    for (var i = 0; i < order.length; i += 1) {
      var code = order[i];
      var direct = firstText(item[base + "_" + code]) || firstText(item[base + code.toUpperCase()]);
      if (direct) return direct;
      if (item[base] && typeof item[base] === "object") {
        var nested = firstText(item[base][code]) || firstText(item[base][code.toUpperCase()]);
        if (nested) return nested;
      }
      var fromNames = item.names && typeof item.names === "object" ? firstText(item.names[code]) : "";
      if (fromNames) return fromNames;
      var fromTranslations = item.translations && typeof item.translations === "object" ? firstText(item.translations[code]) : "";
      if (fromTranslations) return fromTranslations;
      var fromI18n = item.i18n && typeof item.i18n === "object" ? firstText(item.i18n[code]) : "";
      if (fromI18n) return fromI18n;
    }
    return firstText(item[base]) || firstText(item.name_en) || firstText(item.title_en) || firstText(item.label_en) || firstText(item.id);
  }

  window.SIDYA_I18N = Object.assign({}, window.SIDYA_I18N || {}, {
    normalizeLocale: normalizeLocale,
    getLocalizedText: getLocalizedText,
    getDictionary: getDictionary,
  });
  window.getLocalizedText = getLocalizedText;

  function ensureStyle() {
    if (document.getElementById("sidyaLocaleLayoutFixStyles")) return;
    var style = document.createElement("style");
    style.id = "sidyaLocaleLayoutFixStyles";
    style.textContent = [
      "html,body{max-width:100%;overflow-x:clip;}",
      "body{width:100%;}",
      "*,*::before,*::after{box-sizing:border-box;}",
      ".site-header,.exchange-rate-bar,.hero,.install-panel,.products-section,.product-grid,.search-panel,.supplier-search,.proforma-section,.b2b-section,.customs-section,.logistics-section,.contact-section,footer{max-width:100%;}",
      ".site-header{width:100%;padding-inline:clamp(12px,3vw,32px);gap:12px;flex-wrap:wrap;align-items:center;}",
      ".brand{min-width:0;flex:0 1 auto;}",
      ".nav-links{min-width:0;max-width:100%;flex:1 1 420px;display:flex;flex-wrap:wrap;justify-content:center;gap:clamp(8px,1.4vw,18px);}",
      ".header-actions{min-width:0;max-width:100%;flex:1 1 320px;display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:6px;overflow:visible;}",
      ".top-contact-links{min-width:0;display:flex;flex-wrap:wrap;gap:6px;}",
      ".lang-switch{display:grid;grid-template-columns:repeat(6,minmax(0,auto));max-width:100%;gap:4px;}",
      ".currency-switch,.currency-switch select,#currencySelector{max-width:100%;min-width:0;}",
      ".products-menu{max-width:min(960px,calc(100vw - 24px));inset-inline-start:auto;inset-inline-end:0;left:auto;right:0;overflow:auto;}",
      ".exchange-rate-bar{width:100%;padding-inline:clamp(12px,3vw,32px);display:flex;flex-wrap:wrap;gap:10px;align-items:center;}",
      ".exchange-rate-list{min-width:0;display:flex;flex-wrap:wrap;gap:8px;}",
      ".exchange-rate-list span{white-space:normal;}",
      ".hero{width:100%;min-width:0;display:grid;overflow:hidden;}",
      ".hero-image{width:100%;height:100%;object-fit:cover;}",
      ".hero-content,.hero-metrics{max-width:min(1180px,calc(100vw - 24px));margin-inline:auto;text-align:start;}",
      ".hero-content{inset-inline:auto;}",
      ".hero-actions,.hero-metrics{display:flex;flex-wrap:wrap;}",
      ".search-panel,.supplier-search,.product-grid,.catalog-grid,.category-grid{min-width:0;max-width:100%;}",
      "[dir='rtl'] body{text-align:start;}",
      "[dir='rtl'] .site-header,[dir='rtl'] .exchange-rate-bar,[dir='rtl'] .hero-content,[dir='rtl'] .hero-metrics{direction:rtl;}",
      "[dir='rtl'] .nav-links,[dir='rtl'] .header-actions,[dir='rtl'] .top-contact-links,[dir='rtl'] .hero-actions{direction:rtl;}",
      "[dir='rtl'] .products-menu{inset-inline-start:0;inset-inline-end:auto;left:0;right:auto;text-align:start;}",
      "[dir='rtl'] input,[dir='rtl'] textarea,[dir='rtl'] select{text-align:start;}",
      "@media (max-width:1180px){.site-header{justify-content:center}.nav-links{order:3;flex-basis:100%;}.header-actions{justify-content:center;flex-basis:100%;}.products-menu{position:absolute;inset-inline-start:50%;inset-inline-end:auto;transform:translateX(-50%);}}",
      "@media (max-width:760px){.site-header{padding-inline:12px}.brand{flex-basis:100%;justify-content:center}.nav-links{gap:8px}.nav-links a{font-size:12px}.header-actions{flex-basis:100%;}.top-contact-links{justify-content:center}.lang-switch{grid-template-columns:repeat(3,minmax(0,1fr));width:100%;}.lang-option{justify-content:center}.hero-content{max-width:calc(100vw - 24px);padding-inline:0}.hero-metrics{max-width:calc(100vw - 24px);gap:8px}.exchange-rate-heading,.exchange-rate-list{width:100%;justify-content:center}.products-menu{max-width:calc(100vw - 16px);}}",
      "@media (max-width:420px){.site-header{gap:8px}.nav-links{justify-content:center}.nav-links a,.install-app-link,.top-contact-links a{font-size:11px}.hero-actions a{width:100%;text-align:center}.hero-metrics>div{min-width:0;flex:1 1 100%;}.exchange-rate-list span{flex:1 1 46%;min-width:0;}}",
    ].join("\n");
    document.head.appendChild(style);
  }

  function applyDocumentDirection(locale) {
    var lang = normalizeLocale(locale);
    var dir = RTL_LOCALES[lang] ? "rtl" : "ltr";
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", dir);
    document.body && document.body.classList.toggle("is-rtl", dir === "rtl");
    document.querySelectorAll(".lang-option").forEach(function (button) {
      var buttonLang = normalizeLocale(button.getAttribute("data-lang"));
      button.classList.toggle("is-active", buttonLang === lang);
      button.setAttribute("aria-pressed", buttonLang === lang ? "true" : "false");
    });
    safeStorageSet(lang);
  }

  function preserveUrlLocale(locale) {
    try {
      var url = new URL(window.location.href);
      url.searchParams.set("lang", normalizeLocale(locale));
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    } catch (error) {}
  }

  function translateDataI18n(locale) {
    var lang = normalizeLocale(locale);
    var dict = getDictionary(lang);
    var fallback = lang === "ar" ? getDictionary("en") : getDictionary("en");
    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      var key = node.getAttribute("data-i18n");
      var value = firstText(dict[key]) || firstText(fallback[key]);
      if (!value) return;
      if (node.tagName === "INPUT" || node.tagName === "TEXTAREA") node.placeholder = value;
      else node.textContent = value;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (node) {
      var key = node.getAttribute("data-i18n-placeholder");
      var value = firstText(dict[key]) || firstText(fallback[key]);
      if (value) node.setAttribute("placeholder", value);
    });
    var supplierSearch = document.getElementById("supplierSearchInput");
    if (supplierSearch) {
      var placeholder = firstText(dict.supplierSearchPlaceholder) || firstText(fallback.supplierSearchPlaceholder);
      if (placeholder) supplierSearch.placeholder = placeholder;
    }
    if (lang === "tr") {
      document.title = "Sidya Global | GTIP, Gümrük Belgeleri ve İhracat Ürünleri";
      var trDescription = document.querySelector("meta[name='description']");
      if (trDescription) trDescription.setAttribute("content", "Sidya Global, alıcıların Türk ürünlerini GTIP / HS kodu rehberi, gümrük evrak listesi, proforma hazırlığı ve ihracat lojistiği desteğiyle temin etmesine yardımcı olur.");
    } else if (lang === "ar") {
      document.title = "Sidya Global | منتجات تركية موثوقة وحلول تصدير";
      var arDescription = document.querySelector("meta[name='description']");
      if (arDescription) arDescription.setAttribute("content", "تساعد Sidya Global المشترين على توريد المنتجات التركية مع دعم رموز HS/GTIP والوثائق الجمركية والبروفرما واللوجستيات.");
    } else if (lang === "en") {
      document.title = "Sidya Global | GTIP, Customs Documents and Export Product Showcase";
    }
  }

  function replaceExactVisibleText(locale) {
    var lang = normalizeLocale(locale);
    var map = EXACT_REPLACEMENTS[lang];
    if (!map) return;
    var selector = "a,button,span,strong,p,h1,h2,h3,h4,label,option,li";
    document.querySelectorAll(selector).forEach(function (node) {
      if (node.children.length) return;
      var text = (node.textContent || "").trim();
      if (!text || !map[text]) return;
      node.textContent = map[text];
    });
  }

  function normalizeCurrencyLabels() {
    document.querySelectorAll("#currencySelector option,.currency-switch option").forEach(function (option) {
      var code = String(option.value || option.textContent || "").trim().toUpperCase();
      if (CURRENCY_LABELS[code]) option.textContent = CURRENCY_LABELS[code];
    });
  }

  function localizeKnownArrays(locale) {
    var lang = normalizeLocale(locale);
    try {
      if (typeof catalogProducts !== "undefined" && Array.isArray(catalogProducts)) {
        catalogProducts.forEach(function (item) {
          var name = getLocalizedText(item, lang, "name");
          var title = getLocalizedText(item, lang, "title");
          if (name) item.displayName = name;
          if (title) item.displayTitle = title;
        });
      }
    } catch (error) {}
  }

  function applyLocale(locale, updateUrl) {
    var lang = normalizeLocale(locale);
    ensureStyle();
    applyDocumentDirection(lang);
    translateDataI18n(lang);
    replaceExactVisibleText(lang);
    normalizeCurrencyLabels();
    localizeKnownArrays(lang);
    if (updateUrl) preserveUrlLocale(lang);
    window.dispatchEvent(new CustomEvent("sidya:locale-applied", { detail: { locale: lang, dir: RTL_LOCALES[lang] ? "rtl" : "ltr" } }));
  }

  window.SIDYA_I18N.applyLocale = applyLocale;

  document.addEventListener("click", function (event) {
    var button = event.target && event.target.closest ? event.target.closest(".lang-option[data-lang]") : null;
    if (!button) return;
    var lang = normalizeLocale(button.getAttribute("data-lang"));
    setTimeout(function () { applyLocale(lang, true); }, 0);
    setTimeout(function () { applyLocale(lang, true); }, 120);
  }, true);

  function boot() {
    applyLocale(readLocale(), false);
    setTimeout(function () { applyLocale(readLocale(), false); }, 150);
    setTimeout(function () { applyLocale(readLocale(), false); }, 600);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  window.addEventListener("popstate", function () { applyLocale(readLocale(), false); });

})();
