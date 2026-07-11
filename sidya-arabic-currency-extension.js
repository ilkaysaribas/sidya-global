(function () {
  if (window.__sidyaArabicCurrencyExtension) return;
  window.__sidyaArabicCurrencyExtension = true;

  var supportedLanguages = ["tr", "en", "ru", "ka", "az", "ar"];
  var supportedCurrencies = ["TRY", "USD", "EUR", "RUB", "GEL", "AZN", "SAR", "AED", "QAR", "KWD", "BHD", "OMR"];
  var locales = { tr: "tr-TR", en: "en-US", ru: "ru-RU", ka: "ka-GE", az: "az-AZ", ar: "ar-SA" };
  var fallbackTryRates = { USD: 32.5, EUR: 35, RUB: 0.36, GEL: 12, AZN: 19.1, SAR: 8.67, AED: 8.85, QAR: 8.93, KWD: 106, BHD: 86.2, OMR: 84.5, TRY: 1 };
  var currentLanguage = localStorage.getItem("sidyaLang") || "en";
  var currentCurrency = localStorage.getItem("sidyaCurrency") || "USD";
  var applying = false;

  var ar = {
    navProducts: "المنتجات",
    navHome: "المنزل والمعيشة",
    navCleaning: "مواد التنظيف",
    navIndustrial: "المستلزمات الصناعية",
    navProcess: "العملية",
    navMarkets: "الأسواق",
    navCustoms: "الجمارك",
    navProforma: "إنشاء عرض مبدئي",
    navB2B: "دخول بوابة B2B",
    exchangeTitle: "أسعار الصرف الحالية",
    exchangeLoading: "جار التحميل...",
    exchangeChecked: "آخر فحص",
    exchangeDataDate: "تاريخ البيانات",
    exchangeUnavailable: "تعذر تحميل أسعار الصرف",
    installAppCta: "التطبيق",
    heroEyebrow: "تنظيف • صناعي • منزل ومعيشة • صحة • عناية شخصية",
    heroTitle: "بوابتك الموثوقة إلى منتجات عالية الجودة من تركيا",
    heroCopy: "تساعد Sidya Global المشترين الدوليين على توريد منتجات موثوقة من موردين أتراك بسرعة وشفافية واحترافية.",
    heroPrimary: "اطلب عرض سعر",
    heroSecondary: "عرض المنتجات",
    metricCountries: "الأسواق المستهدفة",
    metricCategories: "مجموعات المنتجات",
    metricQuoteValue: "يوم واحد",
    metricQuote: "مدة تجهيز العرض",
    trustOne: "شبكة موردين أتراك موثوقة",
    trustTwo: "خيارات تسليم FOB و CIF و EXW",
    trustThree: "إعداد عروض مبدئية بشفافية",
    trustFour: "دعم كتالوج متعدد اللغات",
    supplierSearchKicker: "بحث توريد B2B",
    supplierSearchTitle: "ابحث عن منتجات من تركيا",
    supplierSearchCopy: "اكتب اسم المنتج لعرض الفئات والعلامات والحد الأدنى للطلب وملاحظات التحميل.",
    supplierSearchLabel: "بحث منتجات للمشتري",
    supplierSearchPlaceholder: "مثال: منظف، شامبو، أدوات منزلية",
    b2bKicker: "بوابة التصدير B2B",
    b2bTitle: "تسجيل المشترين واستلام المستندات ومتابعة الامتثال التصديري.",
    b2bCopy: "سجّل المشترين، اجمع المستندات المطلوبة، وتابع مسار التصدير من العرض المبدئي إلى التخليص الجمركي.",
    guestProformaTitle: "إنشاء عرض مبدئي بدون تسجيل",
    guestProformaCopy: "افتح شاشة الطلب مباشرة، اختر المنتجات واحسب الكراتين والطبليات والوزن.",
    guestProformaCta: "إنشاء طلب عرض مبدئي",
    b2bStepOne: "التحقق من المشتري",
    b2bStepOneCopy: "يتم فحص هوية الشركة والتسجيل الضريبي والتفويض وسوق الوجهة قبل فتح ملف العميل.",
    b2bStepTwo: "مراجعة المنتج ورمز HS",
    b2bStepTwoCopy: "تتم مطابقة المنتجات مع رموز HS والشهادات والقيود ومتطلبات الاستيراد حسب الدولة.",
    b2bStepThree: "اعتماد العرض والدفع",
    b2bStepThreeCopy: "يتم تأكيد شروط Incoterm والعملة والدفع وخطة الطبليات ووزن التحميل ومسؤولية التسليم.",
    b2bStepFour: "ملف الجمارك والمنشأ",
    b2bStepFourCopy: "تُجهز الفاتورة وقائمة التعبئة ووثيقة النقل وشهادة المنشأ والمستندات المطلوبة بالتسلسل.",
    productsKicker: "الكتالوج",
    productsTitle: "مجموعات المنتجات المميزة",
    productOptionFood: "منتجات غذائية",
    productOptionMedical: "منتجات طبية",
    productOptionCosmetics: "مستحضرات وعناية شخصية",
    productOptionAutomotive: "السيارات",
    productOptionHardware: "البناء والعدد",
    proformaKicker: "منصة العروض المبدئية",
    proformaOrderTitle: "إنشاء طلب عرض مبدئي",
    proformaOrderCopy: "افتح محدد المنتجات، ابحث حسب العلامة أو اسم المنتج، أدخل عدد الكراتين وأضف البنود إلى الإجمالي.",
    proformaTransportTitle: "اختر نوع التحميل",
    proformaTransportTruck: "شاحنة TIR",
    proformaTransportContainer: "حاوية",
    proformaOpenProducts: "إنشاء طلب عرض مبدئي",
    proformaSearchLabel: "بحث المنتج",
    proformaSummaryTitle: "إجمالي العرض المبدئي",
    proformaEmpty: "لم تتم إضافة أي منتج بعد.",
    proformaTotalCartons: "إجمالي الكراتين",
    proformaTotalPallets: "عدد الطبليات التقديري",
    proformaTotalWeight: "الوزن الإجمالي التقديري",
    proformaExcelCta: "تنزيل Excel",
    proformaMailCta: "إرسال بالبريد",
    proformaWhatsappCta: "إرسال عبر واتساب",
    proformaTelegramCta: "إرسال عبر تيليغرام",
    customsKicker: "منصة الجمارك",
    customsTitle: "مكتب متابعة كامل لملف جمارك التصدير",
    customsCopy: "خطط ملف التصدير من التحقق من المشتري إلى البيان الجمركي وتسليم الشحنة وإغلاق الأرشيف.",
    customsCoreDocsTitle: "مستندات جمارك التصدير المطلوبة",
    gtipTitle: "دراسة أولية لرمز HS/GTIP حسب المنتج",
    customsPlannerTitle: "مخطط مسار التصدير",
    b2bRegisterTitle: "تسجيل مشتري",
    b2bRegisterCopy: "أدخل بيانات المشتري وأرفق مستندات الشركة والاستيراد وأرسل طلب الانضمام مباشرة.",
    b2bAuthTitle: "تسجيل الدخول أو إنشاء حساب",
    b2bAuthCopy: "تسجيل المشتري ينشئ سجل عميل فقط. لوحة العمليات تستخدم حساب مدير منفصل.",
    b2bEmailRegisterHint: "لا يتم إنشاء مستخدمي نظام جدد للمشترين تلقائياً.",
    b2bAuthEmail: "البريد الإلكتروني للحساب",
    b2bAuthPassword: "كلمة المرور",
    b2bSignIn: "تسجيل الدخول",
    b2bSignUp: "تسجيل",
    b2bNewRegistrationTitle: "تسجيل مشتري جديد",
    b2bCompany: "الاسم القانوني للشركة",
    b2bContact: "الشخص المفوض",
    b2bEmail: "البريد الإلكتروني التجاري",
    b2bTax: "الرقم الضريبي / رقم التسجيل",
    b2bDocuments: "تحميل مستندات الشركة والاستيراد",
    b2bNoFiles: "لم يتم اختيار ملفات.",
    b2bNotes: "المنتجات وملاحظات السوق ومتطلبات الجمارك",
    b2bSubmit: "إنشاء سجل المشتري",
    marketsKicker: "الأسواق المستهدفة",
    marketsTitle: "جاهزون للأسواق القريبة والشمالية والشرقية من تركيا.",
    marketsCopy: "تجهز Sidya Global عروضاً للمشترين في أوروبا والقوقاز ومنطقة البحر الأسود وآسيا الوسطى والشرق الأوسط.",
    contactKicker: "عرض السعر والاجتماع",
    contactTitle: "أرسل طلب الشراء بسرعة.",
    contactCopy: "النموذج يجهز مسودة بريدية لطلبك. يمكنك أيضاً التواصل معنا مباشرة عبر تيليغرام أو البريد.",
    formName: "الاسم الكامل",
    formCompany: "الشركة",
    formEmail: "البريد الإلكتروني",
    formProduct: "المنتج المطلوب",
    formProductPlaceholder: "اختر",
    formMessage: "تفاصيل الطلب",
    formSubmit: "إنشاء مسودة عرض",
    introKicker: "من نحن",
    introTitle: "تربط Sidya Global التوريد الموثوق بالأسواق المناسبة.",
    introCopy: "Sidya Global منصة تجارية للتصدير مقرها طرابزون، تركيا، تربط المصنعين وشركاء العلامات بالمشترين الدوليين.",
    missionTitle: "مهمتنا",
    missionCopy: "مساعدة المشترين للوصول بسرعة إلى المنتجات المناسبة والموردين الموثوقين وعمليات تصدير شفافة.",
    visionTitle: "رؤيتنا",
    visionCopy: "جعل المنتجات التركية علامات قوية ومستدامة ومفضلة في الأسواق الإقليمية والعالمية.",
    footerText: "موقع عرض تصديري مقره طرابزون"
  };

  var productCards = {
    "home-products": ["منتجات المنزل والمعيشة", "سيراميك، أدوات مطبخ، منتجات ديكور وسلع منزلية مختارة."],
    "cleaning-products": ["مواد التنظيف", "منظفات، منتجات نظافة، عناية شخصية وتنظيف منزلي من علامات موثوقة."],
    "food-products": ["منتجات غذائية", "أغذية معبأة، صلصات، معجون طماطم، وجبات خفيفة ومنتجات بقالة."],
    "industrial-products": ["مستلزمات صناعية", "مواد استهلاكية، مستلزمات تنظيف، تغليف ومنتجات دعم تشغيلي."],
    "medical-products": ["منتجات طبية", "خيارات توريد للمنتجات الصحية ومنتجات النظافة والكتالوجات الطبية."],
    "cosmetics-products": ["مستحضرات وعناية شخصية", "عناية بالبشرة والشعر والفم ومنتجات تجميل لقنوات التجزئة والجملة."],
    "automotive-products": ["السيارات", "قطع غيار، منتجات صيانة، سوائل، إكسسوارات وخيارات توريد جاهزة للتصدير."],
    "hardware-products": ["البناء والعدد", "عدد يدوية، مثبتات، مواد بناء، مستلزمات إصلاح ومنتجات حديدية."]
  };

  window.SIDYA_MAIL_I18N = window.SIDYA_MAIL_I18N || { senderName: "Sidya Global Export Department", templates: { ar: { b2bSubject: "تم استلام طلب B2B الخاص بكم لدى Sidya Global", b2bGreeting: "مرحباً", b2bBody: "تم استلام طلب B2B الخاص بكم. سيقوم فريقنا بمراجعة المستندات وطلب المنتجات.", b2bFooter: "Sidya Global Export Department" } } };

  function getUrlLanguage() {
    try { return new URLSearchParams(window.location.search).get("lang"); } catch (error) { return null; }
  }

  function setDirection(lang) {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    if (document.body) document.body.classList.toggle("is-rtl", lang === "ar");
  }

  function ensureStyle() {
    if (document.getElementById("sidyaArabicCurrencyStyle")) return;
    var style = document.createElement("style");
    style.id = "sidyaArabicCurrencyStyle";
    style.textContent = "html[dir='rtl'] body{direction:rtl;text-align:right}html[dir='rtl'] input,html[dir='rtl'] textarea,html[dir='rtl'] select{text-align:right}html[dir='rtl'] table{direction:rtl}html[dir='rtl'] .site-header,html[dir='rtl'] .nav-links,html[dir='rtl'] .header-actions,html[dir='rtl'] .top-contact-links,html[dir='rtl'] .exchange-rate-bar,html[dir='rtl'] .exchange-rate-list,html[dir='rtl'] .hero-actions{direction:rtl}html[dir='rtl'] .products-menu{left:auto;right:0;text-align:right}.currency-switch{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 8px;border:1px solid rgba(255,255,255,.18);border-radius:8px;color:rgba(255,255,255,.86);background:rgba(255,255,255,.1)}.currency-switch select{min-height:28px;border:0;color:inherit;background:transparent;font-weight:850;cursor:pointer}.currency-switch option{color:#171717}.lang-switch{grid-template-columns:repeat(6,minmax(46px,auto))}.selected-currency-rate{outline:1px solid rgba(196,160,90,.45)}@media(max-width:760px){.currency-switch{display:flex;width:100%;order:3}.header-actions{grid-template-columns:repeat(2,minmax(0,1fr))}}";
    document.head.appendChild(style);
  }

  function ensureLanguageButton() {
    var switcher = document.querySelector(".lang-switch");
    if (!switcher || switcher.querySelector('[data-lang="ar"]')) return;
    var button = document.createElement("button");
    button.className = "lang-option";
    button.type = "button";
    button.dataset.lang = "ar";
    button.setAttribute("aria-label", "العربية");
    button.innerHTML = "<span aria-hidden='true'>SA</span> العربية";
    switcher.appendChild(button);
  }

  function ensureCurrencySelector() {
    if (document.getElementById("currencySelector")) return;
    var actions = document.querySelector(".header-actions") || document.querySelector(".topbar-user") || document.querySelector(".topbar");
    if (!actions) return;
    var wrap = document.createElement("div");
    wrap.className = "currency-switch";
    wrap.setAttribute("aria-label", "Currency selection");
    wrap.innerHTML = "<span aria-hidden='true'>💱</span><select id='currencySelector' aria-label='Currency'>" + supportedCurrencies.map(function (code) {
      return "<option" + (code === currentCurrency ? " selected" : "") + ">" + code + "</option>";
    }).join("") + "</select>";
    var install = actions.querySelector && actions.querySelector(".install-app-link");
    if (install) actions.insertBefore(wrap, install); else actions.appendChild(wrap);
  }

  function getRates() {
    var payload = window.SIDYA_EXCHANGE_RATES_TRY || {};
    var rates = payload.rates || payload.tryRates || {};
    return Object.assign({}, fallbackTryRates, rates);
  }

  function formatMoney(value, currency) {
    try {
      return new Intl.NumberFormat(locales[currentLanguage] || "en-US", { style: "currency", currency: currency, maximumFractionDigits: ["KWD", "BHD", "OMR"].indexOf(currency) > -1 ? 3 : 2 }).format(Number(value || 0));
    } catch (error) {
      return String(value || 0) + " " + currency;
    }
  }

  function convertFromUsd(value, currency) {
    var rates = getRates();
    var usdTry = Number(rates.USD || fallbackTryRates.USD);
    var targetTry = currency === "TRY" ? 1 : Number(rates[currency] || fallbackTryRates[currency]);
    return usdTry && targetTry ? Number(value || 0) * usdTry / targetTry : Number(value || 0);
  }

  function renderCurrencyHints() {
    var list = document.getElementById("exchangeRateList") || document.getElementById("exchangeRateStrip");
    if (!list) return;
    var existing = list.querySelector(".selected-currency-rate");
    if (existing) existing.remove();
    if (currentCurrency === "TRY") return;
    var rates = getRates();
    var rate = rates[currentCurrency] || fallbackTryRates[currentCurrency];
    if (!rate) return;
    var row = document.createElement("span");
    row.className = "selected-currency-rate";
    row.innerHTML = currentCurrency + "/TRY <strong>" + formatMoney(rate, "TRY") + "</strong>";
    list.insertBefore(row, list.firstChild);
  }

  function translateArabicDom() {
    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      var key = node.getAttribute("data-i18n");
      if (ar[key]) node.textContent = ar[key];
    });
    var supplierSearch = document.getElementById("supplierSearchInput");
    if (supplierSearch) supplierSearch.placeholder = ar.supplierSearchPlaceholder;
    Object.keys(productCards).forEach(function (id) {
      document.querySelectorAll('[data-category-id="' + id + '"], #' + id + ', [href="#' + id + '"]').forEach(function (node) {
        var card = node.closest("article") || node.closest(".product-card") || node.parentElement;
        if (!card) return;
        var h = card.querySelector("h3,h2,strong");
        var p = card.querySelector("p");
        if (h) h.textContent = productCards[id][0];
        if (p) p.textContent = productCards[id][1];
      });
    });
  }

  function setActiveLanguageButton() {
    document.querySelectorAll(".lang-option").forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.lang === currentLanguage);
    });
  }

  function applyLanguage(lang) {
    if (supportedLanguages.indexOf(lang) === -1) lang = "en";
    currentLanguage = lang;
    localStorage.setItem("sidyaLang", lang);
    setDirection(lang);
    setActiveLanguageButton();
    if (lang === "ar") translateArabicDom();
  }

  function bindEvents() {
    document.addEventListener("click", function (event) {
      var langButton = event.target.closest && event.target.closest(".lang-option");
      if (langButton && langButton.dataset.lang) {
        localStorage.setItem("sidyaLang", langButton.dataset.lang);
        setTimeout(function () { applyLanguage(langButton.dataset.lang); }, 0);
      }
    });
    document.addEventListener("change", function (event) {
      if (event.target && event.target.id === "currencySelector") {
        currentCurrency = String(event.target.value || "USD").toUpperCase();
        if (supportedCurrencies.indexOf(currentCurrency) === -1) currentCurrency = "USD";
        localStorage.setItem("sidyaCurrency", currentCurrency);
        renderCurrencyHints();
      }
    });
  }

  function expandAdminCurrencySelects() {
    document.querySelectorAll("select").forEach(function (select) {
      var options = Array.from(select.options).map(function (option) { return option.value || option.textContent; });
      if (options.indexOf("USD") === -1 || options.indexOf("EUR") === -1) return;
      supportedCurrencies.forEach(function (code) {
        if (options.indexOf(code) === -1) {
          var option = document.createElement("option");
          option.textContent = code;
          option.value = code;
          select.appendChild(option);
        }
      });
    });
  }

  function boot() {
    if (applying) return;
    applying = true;
    ensureStyle();
    ensureLanguageButton();
    ensureCurrencySelector();
    expandAdminCurrencySelects();
    var requested = getUrlLanguage();
    if (supportedLanguages.indexOf(requested) > -1) currentLanguage = requested;
    if (supportedCurrencies.indexOf(currentCurrency) === -1) currentCurrency = "USD";
    var selector = document.getElementById("currencySelector");
    if (selector) selector.value = currentCurrency;
    applyLanguage(currentLanguage);
    renderCurrencyHints();
    applying = false;
  }

  bindEvents();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  new MutationObserver(function () {
    if (applying) return;
    if (currentLanguage === "ar") setTimeout(boot, 0);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
