(function () {
  if (window.__sidyaRfqSiteExtension) return;
  window.__sidyaRfqSiteExtension = true;
  var labels = {
    tr: "Teklif Talebi",
    en: "Request a Quote",
    az: "Qiymət Təklifi İstə",
    ka: "ფასის შეთავაზების მოთხოვნა",
    ru: "Запросить предложение",
    ar: "طلب عرض سعر"
  };
  function lang() {
    return (document.documentElement.lang || localStorage.getItem("sidyaLang") || "en").toLowerCase().split("-")[0];
  }
  function label() { return labels[lang()] || labels.en; }
  function requestUrl(product) {
    var url = new URL("/request-quote", location.origin);
    url.searchParams.set("lang", lang());
    if (product) url.searchParams.set("product", product);
    return url.pathname + url.search;
  }
  function injectNav() {
    var nav = document.querySelector(".nav-links");
    if (!nav) return;
    var existing = document.getElementById("sidyaRfqNavLink");
    if (!existing) {
      existing = document.createElement("a");
      existing.id = "sidyaRfqNavLink";
      var before = document.querySelector('[data-i18n="navProforma"]');
      nav.insertBefore(existing, before || null);
    }
    existing.href = requestUrl();
    existing.textContent = label();
  }
  function updateHeroCtas() {
    document.querySelectorAll('[data-i18n="heroPrimary"], [data-i18n="proformaOpenProducts"], [data-i18n="guestProformaCta"]').forEach(function (link) {
      if (!link.dataset.originalHref) link.dataset.originalHref = link.getAttribute("href") || "#";
      if (link.matches('[data-i18n="heroPrimary"]')) {
        link.href = requestUrl();
        link.textContent = label();
      }
    });
  }
  function productIdentity(card) {
    return card.getAttribute("data-product-id") || card.getAttribute("id") || card.querySelector("[data-product-id]")?.getAttribute("data-product-id") || card.querySelector("strong,h3,h2")?.textContent?.trim() || "";
  }
  function injectProductActions() {
    var cards = document.querySelectorAll(".catalog-product-card,.product-card,[data-catalog-product],.product-grid article");
    cards.forEach(function (card) {
      if (card.querySelector(".sidya-rfq-card-actions")) return;
      var productId = productIdentity(card);
      var actions = document.createElement("div");
      actions.className = "sidya-rfq-card-actions";
      actions.innerHTML = '<a class="sidya-rfq-proforma" href="#catalog-proforma">Ürünü Proformaya Ekle</a><a class="sidya-rfq-offer" href="' + requestUrl(productId) + '">Bu Ürün İçin Fiyat Teklif Et</a><a class="sidya-rfq-whatsapp" target="_blank" rel="noopener" href="https://wa.me/905514894481?text=' + encodeURIComponent('Sidya Global ürün sorusu: ' + productId) + '">WhatsApp ile Sor</a>';
      card.appendChild(actions);
    });
  }
  function ensureStyle() {
    if (document.getElementById("sidyaRfqSiteStyle")) return;
    var style = document.createElement("style");
    style.id = "sidyaRfqSiteStyle";
    style.textContent = ".sidya-rfq-card-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.sidya-rfq-card-actions a{padding:8px 10px;border-radius:8px;border:1px solid rgba(23,23,23,.12);background:#fff;color:#171717;font-size:.78rem;font-weight:850;text-decoration:none}.sidya-rfq-card-actions .sidya-rfq-offer{background:#242424;color:#fff;border-color:#242424}@media(max-width:640px){.sidya-rfq-card-actions a{flex:1 1 100%;text-align:center}}";
    document.head.appendChild(style);
  }
  function boot() {
    ensureStyle();
    injectNav();
    updateHeroCtas();
    injectProductActions();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  window.addEventListener("sidya:locale-applied", boot);
  new MutationObserver(function () { window.clearTimeout(window.__sidyaRfqMutationTimer); window.__sidyaRfqMutationTimer = window.setTimeout(boot, 150); }).observe(document.documentElement, { childList: true, subtree: true });
})();
