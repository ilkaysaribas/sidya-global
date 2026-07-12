(function () {
  if (window.__sidyaProformaCoreFix) return;
  window.__sidyaProformaCoreFix = true;

  var CART_KEY = "sidya:guest-proforma:v2";
  var SUPPORTED_LOCALES = ["tr", "en", "az", "ka", "ru", "ar"];
  var RTL = { ar: true, fa: true, ur: true, he: true };
  var PRODUCT_LABELS = {
    tr: {
      navFind: "ÃœrÃ¼n Bul", navLogistics: "Lojistik", navProforma: "Proforma OluÅŸtur",
      quote: "Teklif Ver", add: "Proformaya Ekle", whatsapp: "WhatsApp ile Sor",
      related: "Ä°lgili firmalar / Kataloglar", price: "SatÄ±ÅŸ fiyatÄ±", target: "Teklif fiyatÄ±nÄ±z", qty: "Koli", currency: "Para birimi",
      panel: "Proforma Ã–zeti", empty: "HenÃ¼z Ã¼rÃ¼n eklenmedi.", totalCartons: "Toplam koli", totalPallets: "Tahmini palet", totalKg: "Tahmini kg", productTotal: "ÃœrÃ¼n toplamÄ±", invalid: "SÄ±fÄ±rdan bÃ¼yÃ¼k bir fiyat girin.", ratesError: "Kur bilgisi ÅŸu anda alÄ±namÄ±yor.", ratesLoading: "GÃ¼ncel TCMB kurlarÄ± yÃ¼kleniyor...",
      productsTitle: "Ã–ne Ã§Ä±kan Ã¼rÃ¼n gruplarÄ±", supplierTitle: "TÃ¼rkiye'den ÃœrÃ¼n Bul", supplierCopy: "ÃœrÃ¼n adÄ± yazarak kategori, marka, minimum sipariÅŸ ve yÃ¼kleme notlarÄ±nÄ± gÃ¶rÃ¼n."
    },
    en: {
      navFind: "Find Products", navLogistics: "Logistics", navProforma: "Create Proforma",
      quote: "Make Offer", add: "Add to Proforma", whatsapp: "Ask on WhatsApp",
      related: "Related companies / Catalogs", price: "Sales price", target: "Your offer price", qty: "Cartons", currency: "Currency",
      panel: "Proforma Summary", empty: "No product added yet.", totalCartons: "Total cartons", totalPallets: "Estimated pallets", totalKg: "Estimated kg", productTotal: "Product total", invalid: "Enter a price greater than zero.", ratesError: "Exchange rates are currently unavailable.", ratesLoading: "Loading current TCMB rates...",
      productsTitle: "Featured product groups", supplierTitle: "Find Products from Turkiye", supplierCopy: "Type a product name to see matching categories, brands, minimum order and loading notes."
    },
    ar: {
      navFind: "Ø§Ù„Ø¨Ø­Ø« Ø¹Ù† Ù…Ù†ØªØ¬", navLogistics: "Ø§Ù„Ù„ÙˆØ¬Ø³ØªÙŠØ§Øª", navProforma: "Ø¥Ù†Ø´Ø§Ø¡ Ø¨Ø±ÙˆÙØ±Ù…Ø§",
      quote: "Ù‚Ø¯Ù‘Ù… Ø³Ø¹Ø±Ø§Ù‹", add: "Ø£Ø¶Ù Ø¥Ù„Ù‰ Ø§Ù„Ø¨Ø±ÙˆÙØ±Ù…Ø§", whatsapp: "Ø§Ø³Ø£Ù„ Ø¹Ø¨Ø± ÙˆØ§ØªØ³Ø§Ø¨",
      related: "Ø§Ù„Ø´Ø±ÙƒØ§Øª ÙˆØ§Ù„ÙƒØªØ§Ù„ÙˆØ¬Ø§Øª Ø°Ø§Øª Ø§Ù„ØµÙ„Ø©", price: "Ø³Ø¹Ø± Ø§Ù„Ø¨ÙŠØ¹", target: "Ø³Ø¹Ø± Ø¹Ø±Ø¶Ùƒ", qty: "ÙƒØ±Ø§ØªÙŠÙ†", currency: "Ø§Ù„Ø¹Ù…Ù„Ø©",
      panel: "Ù…Ù„Ø®Øµ Ø§Ù„Ø¨Ø±ÙˆÙØ±Ù…Ø§", empty: "Ù„Ù… ØªØªÙ… Ø¥Ø¶Ø§ÙØ© Ù…Ù†ØªØ¬Ø§Øª Ø¨Ø¹Ø¯.", totalCartons: "Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„ÙƒØ±Ø§ØªÙŠÙ†", totalPallets: "Ø§Ù„Ù…Ù†ØµØ§Øª Ø§Ù„ØªÙ‚Ø¯ÙŠØ±ÙŠØ©", totalKg: "Ø§Ù„ÙˆØ²Ù† Ø§Ù„ØªÙ‚Ø¯ÙŠØ±ÙŠ", productTotal: "Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª", invalid: "Ø£Ø¯Ø®Ù„ Ø³Ø¹Ø±Ø§Ù‹ Ø£ÙƒØ¨Ø± Ù…Ù† ØµÙØ±.", ratesError: "Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø¬Ù„Ø¨ Ø£Ø³Ø¹Ø§Ø± Ø§Ù„ØµØ±Ù Ø­Ø§Ù„ÙŠØ§Ù‹.", ratesLoading: "Ø¬Ø§Ø± ØªØ­Ù…ÙŠÙ„ Ø£Ø³Ø¹Ø§Ø± TCMB Ø§Ù„Ø­Ø§Ù„ÙŠØ©...",
      productsTitle: "Ù…Ø¬Ù…ÙˆØ¹Ø§Øª Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª Ø§Ù„Ù…Ù…ÙŠØ²Ø©", supplierTitle: "Ø§Ø¨Ø­Ø« Ø¹Ù† Ù…Ù†ØªØ¬Ø§Øª Ù…Ù† ØªØ±ÙƒÙŠØ§", supplierCopy: "Ø§ÙƒØªØ¨ Ø§Ø³Ù… Ø§Ù„Ù…Ù†ØªØ¬ Ù„Ø¹Ø±Ø¶ Ø§Ù„ÙØ¦Ø§Øª ÙˆØ§Ù„Ø¹Ù„Ø§Ù…Ø§Øª ÙˆØ§Ù„Ø­Ø¯ Ø§Ù„Ø£Ø¯Ù†Ù‰ Ù„Ù„Ø·Ù„Ø¨ ÙˆÙ…Ù„Ø§Ø­Ø¸Ø§Øª Ø§Ù„ØªØ­Ù…ÙŠÙ„."
    }
  };
  var CATEGORY_TEXT = {
    "home-products": { tr: ["Ev ve YaÅŸam ÃœrÃ¼nleri", "Seramik, mutfak gereÃ§leri, dekoratif Ã¼rÃ¼nler ve ev yaÅŸam Ã¼rÃ¼nleri."], en: ["Home and Lifestyle", "Ceramics, kitchenware, decorative products and curated home goods."], ar: ["Ù…Ù†ØªØ¬Ø§Øª Ø§Ù„Ù…Ù†Ø²Ù„ ÙˆØ§Ù„Ù…Ø¹ÙŠØ´Ø©", "Ø§Ù„Ø³ÙŠØ±Ø§Ù…ÙŠÙƒ ÙˆØ£Ø¯ÙˆØ§Øª Ø§Ù„Ù…Ø·Ø¨Ø® ÙˆØ§Ù„Ù…Ù†ØªØ¬Ø§Øª Ø§Ù„Ø²Ø®Ø±ÙÙŠØ© ÙˆØ§Ù„Ø³Ù„Ø¹ Ø§Ù„Ù…Ù†Ø²Ù„ÙŠØ©."] },
    "cleaning-products": { tr: ["Temizlik ÃœrÃ¼nleri", "Deterjan, hijyen, kiÅŸisel bakÄ±m ve ev temizlik Ã¼rÃ¼nlerinde gÃ¼venilir marka tedariki."], en: ["Cleaning Products", "Detergents, hygiene, personal care and home cleaning products from trusted brands."], ar: ["Ù…Ù†ØªØ¬Ø§Øª Ø§Ù„ØªÙ†Ø¸ÙŠÙ", "ØªÙˆØ±ÙŠØ¯ Ù…ÙˆØ«ÙˆÙ‚ Ù„Ù„Ù…Ù†Ø¸ÙØ§Øª ÙˆÙ…Ù†ØªØ¬Ø§Øª Ø§Ù„Ù†Ø¸Ø§ÙØ© ÙˆØ§Ù„Ø¹Ù†Ø§ÙŠØ© Ø§Ù„Ø´Ø®ØµÙŠØ© ÙˆØªÙ†Ø¸ÙŠÙ Ø§Ù„Ù…Ù†Ø²Ù„."] },
    "food-products": { tr: ["GÄ±da ÃœrÃ¼nleri", "Paketli gÄ±da, sos, salÃ§a, atÄ±ÅŸtÄ±rmalÄ±k ve market Ã¼rÃ¼nleri."], en: ["Food Products", "Packaged food, sauces, tomato paste, snacks and grocery products."], ar: ["Ù…Ù†ØªØ¬Ø§Øª ØºØ°Ø§Ø¦ÙŠØ©", "Ø£ØºØ°ÙŠØ© Ù…Ø¹Ø¨Ø£Ø© ÙˆØµÙ„ØµØ§Øª ÙˆÙ…Ø¹Ø¬ÙˆÙ† Ø·Ù…Ø§Ø·Ù… ÙˆÙˆØ¬Ø¨Ø§Øª Ø®ÙÙŠÙØ© ÙˆÙ…Ù†ØªØ¬Ø§Øª Ø¨Ù‚Ø§Ù„Ø©."] },
    "industrial-products": { tr: ["EndÃ¼striyel Sarf", "Sarf malzemeleri, temizlik sarfÄ±, ambalaj ve operasyon destek Ã¼rÃ¼nleri."], en: ["Industrial Supplies", "Consumables, cleaning supplies, packaging and operational materials."], ar: ["Ù…Ø³ØªÙ„Ø²Ù…Ø§Øª ØµÙ†Ø§Ø¹ÙŠØ©", "Ù…ÙˆØ§Ø¯ Ø§Ø³ØªÙ‡Ù„Ø§ÙƒÙŠØ© ÙˆÙ…Ø³ØªÙ„Ø²Ù…Ø§Øª ØªÙ†Ø¸ÙŠÙ ÙˆØªØºÙ„ÙŠÙ ÙˆÙ…ÙˆØ§Ø¯ ØªØ´ØºÙŠÙ„."] },
    "medical-products": { tr: ["Medikal ÃœrÃ¼nler", "SaÄŸlÄ±k, hijyen ve medikal Ã¼rÃ¼n kataloglarÄ± iÃ§in tedarik seÃ§enekleri."], en: ["Medical Products", "Healthcare, hygiene and medical product catalog sourcing options."], ar: ["Ù…Ù†ØªØ¬Ø§Øª Ø·Ø¨ÙŠØ©", "Ø®ÙŠØ§Ø±Ø§Øª ØªÙˆØ±ÙŠØ¯ Ù„Ù…Ù†ØªØ¬Ø§Øª Ø§Ù„Ø±Ø¹Ø§ÙŠØ© Ø§Ù„ØµØ­ÙŠØ© ÙˆØ§Ù„Ù†Ø¸Ø§ÙØ© ÙˆØ§Ù„ÙƒØªØ§Ù„ÙˆØ¬Ø§Øª Ø§Ù„Ø·Ø¨ÙŠØ©."] },
    "cosmetics-products": { tr: ["Kozmetik ve KiÅŸisel BakÄ±m", "Cilt bakÄ±mÄ±, saÃ§ bakÄ±mÄ±, aÄŸÄ±z bakÄ±m, gÃ¼zellik ve kiÅŸisel bakÄ±m Ã¼rÃ¼nlerinde toptan tedarik."], en: ["Cosmetics and Personal Care", "Skin care, hair care, oral care, beauty and personal care products for retail and wholesale channels."], ar: ["Ù…Ø³ØªØ­Ø¶Ø±Ø§Øª Ø§Ù„ØªØ¬Ù…ÙŠÙ„ ÙˆØ§Ù„Ø¹Ù†Ø§ÙŠØ© Ø§Ù„Ø´Ø®ØµÙŠØ©", "ØªÙˆØ±ÙŠØ¯ Ù„Ù„Ø¹Ù†Ø§ÙŠØ© Ø¨Ø§Ù„Ø¨Ø´Ø±Ø© ÙˆØ§Ù„Ø´Ø¹Ø± ÙˆØ§Ù„ÙÙ… ÙˆÙ…Ù†ØªØ¬Ø§Øª Ø§Ù„Ø¬Ù…Ø§Ù„ ÙˆØ§Ù„Ø¹Ù†Ø§ÙŠØ© Ø§Ù„Ø´Ø®ØµÙŠØ©."] },
    "automotive-products": { tr: ["Otomotiv", "Yedek parÃ§a, bakÄ±m Ã¼rÃ¼nleri, oto kimyasallarÄ±, aksesuar ve ihracata uygun otomotiv Ã¼rÃ¼nleri."], en: ["Automotive", "Spare parts, maintenance products, fluids, accessories and export-ready automotive supply options."], ar: ["Ø§Ù„Ø³ÙŠØ§Ø±Ø§Øª", "Ù‚Ø·Ø¹ ØºÙŠØ§Ø± ÙˆÙ…Ù†ØªØ¬Ø§Øª ØµÙŠØ§Ù†Ø© ÙˆØ³ÙˆØ§Ø¦Ù„ ÙˆØ¥ÙƒØ³Ø³ÙˆØ§Ø±Ø§Øª ÙˆØ®ÙŠØ§Ø±Ø§Øª ØªÙˆØ±ÙŠØ¯ Ø¬Ø§Ù‡Ø²Ø© Ù„Ù„ØªØµØ¯ÙŠØ±."] },
    "hardware-products": { tr: ["YapÄ± HÄ±rdavat", "El aletleri, baÄŸlantÄ± elemanlarÄ±, yapÄ± malzemeleri, tamir ve hÄ±rdavat Ã¼rÃ¼nleri."], en: ["Construction and Hardware", "Hand tools, fasteners, building supplies, repair materials and hardware product sourcing."], ar: ["Ø§Ù„Ø¨Ù†Ø§Ø¡ ÙˆØ§Ù„Ø¹Ø¯Ø¯", "Ø£Ø¯ÙˆØ§Øª ÙŠØ¯ÙˆÙŠØ© ÙˆÙ…Ø«Ø¨ØªØ§Øª ÙˆÙ…ÙˆØ§Ø¯ Ø¨Ù†Ø§Ø¡ ÙˆÙ…Ù†ØªØ¬Ø§Øª Ø¥ØµÙ„Ø§Ø­ ÙˆØ¹Ø¯Ø¯."] }
  };

  function locale() {
    var params = new URLSearchParams(location.search);
    var value = params.get("lang") || document.documentElement.lang || localStorage.getItem("sidyaLang") || "en";
    value = String(value).toLowerCase().replace("_", "-").split("-")[0];
    return SUPPORTED_LOCALES.indexOf(value) >= 0 ? value : "en";
  }
  function labels() { return PRODUCT_LABELS[locale()] || PRODUCT_LABELS.en; }
  function dir() { return RTL[locale()] ? "rtl" : "ltr"; }
  function formatNumber(value, max) {
    return new Intl.NumberFormat(locale() === "tr" ? "tr-TR" : locale() === "ar" ? "ar" : "en-US", { maximumFractionDigits: max || 2 }).format(value || 0);
  }
  function money(value, currency) {
    try { return new Intl.NumberFormat(locale() === "tr" ? "tr-TR" : locale() === "ar" ? "ar" : "en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(value || 0); }
    catch (_) { return formatNumber(value, 2) + " " + (currency || "USD"); }
  }
  function readCart() {
    try { var data = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); return Array.isArray(data) ? data : []; } catch (_) { return []; }
  }
  function writeCart(items) { try { localStorage.setItem(CART_KEY, JSON.stringify(items.slice(0, 200))); } catch (_) {} }
  function productIdFromText(text) {
    return String(text || "product").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "product";
  }
  function parsePrice(text) {
    var match = String(text || "").replace(/\s/g, "").match(/([0-9]+(?:[.,][0-9]+)?)/);
    return match ? Number(match[1].replace(",", ".")) || 0 : 0;
  }
  function rowProduct(row) {
    var title = row.querySelector("strong")?.textContent?.trim() || row.querySelector("h3")?.textContent?.trim() || "Sidya Global product";
    var brand = row.querySelector(".proforma-brand-logo")?.getAttribute("alt")?.replace(/\s*logo\s*$/i, "") || row.querySelector("span")?.textContent?.split("Â·")?.[0]?.trim() || "Sidya Global";
    var qtyInput = row.querySelector("input[type='number']");
    var qty = Math.max(parseInt(qtyInput?.value || "1", 10) || 1, 1);
    var priceText = row.querySelector("dl")?.textContent || "";
    return { id: row.querySelector("[data-product-id]")?.getAttribute("data-product-id") || productIdFromText(brand + " " + title), title: title, brand: brand, qty: qty, unitPrice: parsePrice(priceText), currency: "USD", source: "catalog" };
  }
  function upsertCart(item) {
    var items = readCart();
    var existing = items.find(function (entry) { return entry.id === item.id; });
    if (existing) {
      existing.qty = Math.max(1, Number(existing.qty || 0) + Number(item.qty || 1));
      existing.unitPrice = item.unitPrice || existing.unitPrice || 0;
      existing.currency = item.currency || existing.currency || "USD";
    } else {
      items.push(Object.assign({ qty: 1, unitPrice: 0, offerPrice: 0, currency: "USD", kgPerCarton: 0, cartonsPerPallet: 0 }, item));
    }
    writeCart(items);
    renderDock();
  }
  function updateCart(id, patch) {
    var items = readCart().map(function (item) { return item.id === id ? Object.assign({}, item, patch) : item; });
    writeCart(items.filter(function (item) { return Number(item.qty) > 0; }));
    renderDock();
  }

  function ensureStyle() {
    if (document.getElementById("sidyaProformaCoreFixStyle")) return;
    var style = document.createElement("style");
    style.id = "sidyaProformaCoreFixStyle";
    style.textContent = [
      "html,body{width:100%;max-width:100%;overflow-x:clip}",
      ".site-header{overflow:visible!important;z-index:80}.nav-item{position:static}.has-dropdown>.products-menu{position:fixed!important;top:calc(var(--sidya-header-bottom,48px));left:clamp(12px,2vw,24px)!important;right:clamp(12px,2vw,24px)!important;inset-inline:auto!important;width:auto!important;min-width:0!important;max-width:none!important;max-height:min(72vh,620px);overflow:auto;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));transform:translateY(0)!important;z-index:120}",
      "html[dir='rtl'] .has-dropdown>.products-menu{direction:rtl;text-align:start}.has-dropdown:not(:hover):not(:focus-within)>.products-menu:not(.is-open){opacity:0;pointer-events:none}.has-dropdown:hover>.products-menu,.has-dropdown:focus-within>.products-menu,.has-dropdown>.products-menu.is-open{opacity:1;pointer-events:auto}",
      ".section-heading{max-width:1180px;margin-inline:auto;text-align:start!important;display:grid;gap:8px}.section-heading>p{max-width:680px;margin-inline:0 auto!important}html[dir='rtl'] .section-heading>p{margin-inline:auto 0!important}.supplier-search-box{margin-inline:auto auto;width:min(880px,100%)}@media(min-width:900px){.supplier-search-box{margin-inline:0 auto}html[dir='rtl'] .supplier-search-box{margin-inline:auto 0}}",
      ".related-companies>strong{display:none!important}.related-companies{display:grid;gap:8px;position:relative;overflow:visible!important}.related-companies-toggle{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-height:36px;padding:8px 10px;border:1px solid rgba(23,23,23,.12);border-radius:8px;background:#fff;color:#171717;font-weight:900;cursor:pointer}.related-companies-toggle::after{content:'âŒ„';transition:transform .16s ease}.related-companies.is-open .related-companies-toggle::after{transform:rotate(180deg)}.related-companies-panel{display:none!important;position:static!important;max-height:260px;overflow:auto}.related-companies.is-open .related-companies-panel{display:grid!important;gap:6px}.product-card{overflow:visible}.sidya-rfq-card-actions{position:relative;z-index:1}",
      ".sidya-live-proforma-dock{position:fixed;top:calc(var(--sidya-header-bottom,96px) + 14px);right:14px;z-index:70;width:min(360px,calc(100vw - 28px));max-height:calc(100vh - var(--sidya-header-bottom,96px) - 28px);display:grid;grid-template-rows:auto minmax(0,1fr) auto;border:1px solid rgba(23,23,23,.14);border-radius:8px;background:#fff;box-shadow:0 18px 42px rgba(0,0,0,.18);overflow:hidden}.sidya-live-proforma-dock.is-empty{display:none}.sidya-dock-header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;background:#242424;color:#fff}.sidya-dock-header strong{font-size:.95rem}.sidya-dock-toggle{border:0;background:rgba(255,255,255,.14);color:#fff;border-radius:999px;min-height:30px;padding:0 10px;cursor:pointer}.sidya-dock-lines{display:grid;gap:8px;padding:10px;overflow:auto}.sidya-dock-line{display:grid;gap:7px;padding:10px;border:1px solid rgba(23,23,23,.1);border-radius:8px;background:#f8f8f8}.sidya-dock-line strong{font-size:.86rem}.sidya-dock-controls{display:grid;grid-template-columns:70px 1fr 92px 32px;gap:6px;align-items:center}.sidya-dock-controls input,.sidya-dock-controls select{min-width:0;height:34px;border:1px solid rgba(23,23,23,.18);border-radius:7px;padding:0 8px}.sidya-dock-remove{height:34px;border:0;border-radius:7px;background:#3d3d3d;color:#fff;cursor:pointer}.sidya-dock-totals{display:grid;gap:6px;padding:12px 14px;border-top:1px solid rgba(23,23,23,.1);background:#fff}.sidya-dock-totals span{display:flex;justify-content:space-between;gap:8px;font-size:.82rem}.sidya-offer-inline{display:grid;grid-template-columns:minmax(0,1fr)110px auto;gap:8px;margin-top:8px;padding:8px;border:1px solid rgba(196,160,90,.42);border-radius:8px;background:#fffaf0}.sidya-offer-inline input,.sidya-offer-inline select{min-height:34px;border:1px solid rgba(23,23,23,.18);border-radius:7px;padding:0 8px}.sidya-offer-inline button{border:0;border-radius:7px;background:#242424;color:#fff;font-weight:850;padding:0 10px;cursor:pointer}.sidya-field-error{color:#b42318;font-size:.78rem}.exchange-rate-list{min-width:0;max-width:100%;overflow-x:auto;scrollbar-width:thin}.exchange-rate-list span{white-space:nowrap;flex:0 0 auto}",
      "html[dir='rtl'] .sidya-live-proforma-dock{right:auto;left:14px;direction:rtl;text-align:start}@media(max-width:920px){.sidya-live-proforma-dock{top:auto;left:10px!important;right:10px!important;bottom:10px;width:auto;max-height:58vh}.sidya-live-proforma-dock.is-collapsed{grid-template-rows:auto}.sidya-live-proforma-dock.is-collapsed .sidya-dock-lines,.sidya-live-proforma-dock.is-collapsed .sidya-dock-totals{display:none}.site-header{flex-wrap:wrap}.nav-links{overflow-x:auto;max-width:100%;justify-content:flex-start}.header-actions{max-width:100%;flex-wrap:wrap}}",
      "@media(max-width:560px){.sidya-dock-controls{grid-template-columns:64px 1fr 76px 32px}.sidya-offer-inline{grid-template-columns:1fr 90px}.sidya-offer-inline button{grid-column:1/-1;min-height:34px}.products-menu{grid-template-columns:1fr!important}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function setHeaderMetric() {
    var header = document.querySelector(".site-header");
    var rates = document.querySelector(".exchange-rate-bar");
    var bottom = (header?.getBoundingClientRect().height || 48) + (rates?.getBoundingClientRect().height || 0);
    document.documentElement.style.setProperty("--sidya-header-bottom", Math.ceil(bottom) + "px");
  }

  function applyLocaleIsolation() {
    var lang = locale();
    document.documentElement.lang = lang;
    document.documentElement.dir = dir();
    var l = labels();
    var navFind = Array.from(document.querySelectorAll(".nav-links>a")).find(function (a) { return /ÃœrÃ¼n Bul|Find Products|Ø§Ù„Ø¨Ø­Ø«/.test(a.textContent || ""); });
    if (navFind) navFind.textContent = l.navFind;
    var logistics = document.getElementById("openLogisticsCenter");
    if (logistics) logistics.textContent = l.navLogistics;
    document.querySelectorAll('[data-i18n="navProforma"],#sidyaRfqNavLink').forEach(function (node) { node.textContent = l.navProforma; node.setAttribute("href", "#proforma"); });
    var productsTitle = document.getElementById("products-title");
    if (productsTitle) productsTitle.textContent = l.productsTitle;
    var supplierTitle = document.getElementById("supplier-search-title");
    if (supplierTitle) supplierTitle.textContent = l.supplierTitle;
    var supplierCopy = document.querySelector(".supplier-search-heading>p");
    if (supplierCopy) supplierCopy.textContent = l.supplierCopy;
    Object.keys(CATEGORY_TEXT).forEach(function (id) {
      var card = document.getElementById(id);
      var text = CATEGORY_TEXT[id][lang] || CATEGORY_TEXT[id].en;
      if (!card || !text) return;
      var h = card.querySelector("h3");
      var p = card.querySelector("p");
      if (h) h.textContent = text[0];
      if (p) p.textContent = text[1];
    });
    document.querySelectorAll(".product-card img,.proforma-brand-logo,.partner-logo,.brand img").forEach(function (img) { img.style.transform = "none"; });
  }

  function setupRelatedAccordions() {
    document.querySelectorAll(".related-companies").forEach(function (wrap, index) {
      if (wrap.dataset.clickAccordion === "true") return;
      var title = wrap.querySelector("strong")?.textContent?.trim() || labels().related;
      var panel = wrap.querySelector("div");
      if (!panel) return;
      var id = "related-panel-" + index + "-" + Math.random().toString(36).slice(2, 7);
      panel.id = panel.id || id;
      panel.classList.add("related-companies-panel");
      var button = document.createElement("button");
      button.type = "button";
      button.className = "related-companies-toggle";
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", panel.id);
      button.textContent = title;
      button.addEventListener("click", function () {
        var open = !wrap.classList.contains("is-open");
        wrap.classList.toggle("is-open", open);
        button.setAttribute("aria-expanded", open ? "true" : "false");
      });
      wrap.insertBefore(button, panel);
      wrap.dataset.clickAccordion = "true";
    });
  }

  function normalizeActions() {
    var l = labels();
    document.querySelectorAll("#sidyaRfqNavLink").forEach(function (link) { link.href = "#proforma"; link.textContent = l.navProforma; });
    document.querySelectorAll(".sidya-rfq-proforma").forEach(function (a) { a.href = "#proforma"; a.textContent = l.add; });
    document.querySelectorAll(".sidya-rfq-offer").forEach(function (a) { a.href = "#proforma"; a.textContent = l.quote; });
    document.querySelectorAll(".sidya-rfq-whatsapp").forEach(function (a) { a.textContent = l.whatsapp; });
  }

  function ensureDock() {
    var dock = document.getElementById("sidyaLiveProformaDock");
    if (dock) return dock;
    dock = document.createElement("aside");
    dock.id = "sidyaLiveProformaDock";
    dock.className = "sidya-live-proforma-dock is-empty";
    dock.innerHTML = '<div class="sidya-dock-header"><strong></strong><button class="sidya-dock-toggle" type="button">âˆ’</button></div><div class="sidya-dock-lines"></div><div class="sidya-dock-totals"></div>';
    document.body.appendChild(dock);
    dock.querySelector(".sidya-dock-toggle").addEventListener("click", function () { dock.classList.toggle("is-collapsed"); });
    dock.addEventListener("input", function (event) {
      var line = event.target.closest("[data-cart-id]");
      if (!line) return;
      var id = line.dataset.cartId;
      if (event.target.matches("[data-cart-qty]")) updateCart(id, { qty: Math.max(parseInt(event.target.value || "1", 10) || 1, 1) });
      if (event.target.matches("[data-cart-offer]")) updateCart(id, { offerPrice: Math.max(Number(String(event.target.value).replace(",", ".")) || 0, 0) });
    });
    dock.addEventListener("change", function (event) {
      var line = event.target.closest("[data-cart-id]");
      if (line && event.target.matches("[data-cart-currency]")) updateCart(line.dataset.cartId, { currency: event.target.value || "USD" });
    });
    dock.addEventListener("click", function (event) {
      var remove = event.target.closest(".sidya-dock-remove");
      if (!remove) return;
      updateCart(remove.closest("[data-cart-id]").dataset.cartId, { qty: 0 });
    });
    return dock;
  }

  function renderDock() {
    var dock = ensureDock();
    var items = readCart();
    var l = labels();
    dock.classList.toggle("is-empty", !items.length);
    dock.querySelector(".sidya-dock-header strong").textContent = l.panel + " - " + items.reduce(function (s, i) { return s + Number(i.qty || 0); }, 0) + " " + l.qty;
    dock.querySelector(".sidya-dock-lines").innerHTML = items.length ? items.map(function (item) {
      var unit = Number(item.offerPrice || item.unitPrice || 0);
      var total = unit * Number(item.qty || 0);
      return '<article class="sidya-dock-line" data-cart-id="' + item.id + '"><strong>' + item.title + '</strong><small>' + item.brand + '</small><div class="sidya-dock-controls"><input data-cart-qty type="number" min="1" step="1" value="' + Number(item.qty || 1) + '" aria-label="' + l.qty + '"><input data-cart-offer type="number" min="0" step="0.0001" value="' + Number(item.offerPrice || 0) + '" placeholder="' + l.target + '" aria-label="' + l.target + '"><select data-cart-currency aria-label="' + l.currency + '">' + ["USD", "EUR", "TRY", "GEL", "RUB", "AZN", "GBP", "AED", "SAR", "QAR", "KWD"].map(function (c) { return '<option value="' + c + '"' + ((item.currency || "USD") === c ? " selected" : "") + '>' + c + '</option>'; }).join("") + '</select><button type="button" class="sidya-dock-remove" aria-label="Remove">Ã—</button></div><small>' + money(total, item.currency || "USD") + '</small></article>';
    }).join("") : '<p class="proforma-empty">' + l.empty + '</p>';
    var totals = new Map();
    var totalCartons = 0;
    items.forEach(function (item) { var q = Number(item.qty || 0); totalCartons += q; var unit = Number(item.offerPrice || item.unitPrice || 0); if (unit > 0) totals.set(item.currency || "USD", (totals.get(item.currency || "USD") || 0) + unit * q); });
    dock.querySelector(".sidya-dock-totals").innerHTML = '<span><b>' + l.totalCartons + '</b><strong>' + formatNumber(totalCartons, 0) + '</strong></span><span><b>' + l.totalPallets + '</b><strong>' + formatNumber(totalCartons / 60, 2) + '</strong></span><span><b>' + l.totalKg + '</b><strong>' + formatNumber(totalCartons * 10, 0) + ' kg</strong></span><span><b>' + l.productTotal + '</b><strong>' + ([].slice.call(totals.entries()).map(function (entry) { return money(entry[1], entry[0]); }).join(' Â· ') || '-') + '</strong></span>';
  }

  function openInlineOffer(row) {
    var existing = row.querySelector(".sidya-offer-inline");
    if (existing) { existing.remove(); return; }
    var l = labels();
    var box = document.createElement("div");
    box.className = "sidya-offer-inline";
    box.innerHTML = '<input type="number" min="0" step="0.0001" placeholder="' + l.target + '"><select><option>USD</option><option>EUR</option><option>TRY</option><option>GEL</option><option>RUB</option><option>AZN</option></select><button type="button">' + l.quote + '</button><small class="sidya-field-error" hidden>' + l.invalid + '</small>';
    row.appendChild(box);
    box.querySelector("button").addEventListener("click", function () {
      var value = Number(String(box.querySelector("input").value).replace(",", "."));
      if (!(value > 0)) { box.querySelector(".sidya-field-error").hidden = false; return; }
      var product = rowProduct(row);
      product.offerPrice = value;
      product.currency = box.querySelector("select").value || "USD";
      upsertCart(product);
      box.remove();
    });
    box.querySelector("input").focus();
  }

  function bindClicks() {
    if (document.documentElement.dataset.sidyaCoreClickBound === "true") return;
    document.documentElement.dataset.sidyaCoreClickBound = "true";
    document.addEventListener("click", function (event) {
      var rfqNav = event.target.closest("#sidyaRfqNavLink");
      if (rfqNav) { event.preventDefault(); document.querySelector("#openGuestProforma")?.click(); return; }
      var offer = event.target.closest(".sidya-rfq-offer");
      if (offer) {
        event.preventDefault();
        var card = offer.closest(".product-card,article");
        var inner = card?.querySelector(".product-quote-button");
        if (inner) inner.click(); else document.querySelector("#openGuestProforma")?.click();
        return;
      }
      var add = event.target.closest(".sidya-rfq-proforma");
      if (add) { event.preventDefault(); var b = add.closest(".product-card")?.querySelector(".product-quote-button"); if (b) b.click(); else document.querySelector("#openGuestProforma")?.click(); return; }
      var rowAdd = event.target.closest(".proforma-add-button");
      if (rowAdd) { setTimeout(function () { var row = rowAdd.closest(".proforma-product-row"); if (row) upsertCart(rowProduct(row)); }, 0); }
      var rowOffer = event.target.closest(".sidya-row-offer-button");
      if (rowOffer) { event.preventDefault(); openInlineOffer(rowOffer.closest(".proforma-product-row")); }
    }, true);
  }

  function addOfferButtonsToRows() {
    document.querySelectorAll(".proforma-product-row").forEach(function (row) {
      if (row.querySelector(".sidya-row-offer-button")) return;
      var button = document.createElement("button");
      button.type = "button";
      button.className = "proforma-add-button sidya-row-offer-button";
      button.textContent = labels().quote;
      row.appendChild(button);
    });
  }

  function normalizeExchangePayload(payload) {
    var list = Array.isArray(payload?.rateList) ? payload.rateList : Array.isArray(payload?.rates) ? payload.rates : [];
    if (!list.length && payload?.rates && typeof payload.rates === "object") {
      list = Object.keys(payload.rates).map(function (code) { return { code: code, label: code, value: payload.rates[code], source: payload.source || "TCMB" }; });
    }
    return list.filter(function (rate) { return Number(rate.value) > 0; }).slice(0, 8);
  }
  async function loadRates() {
    var updated = document.getElementById("exchangeUpdated");
    var list = document.getElementById("exchangeRateList");
    if (!updated || !list || location.protocol === "file:") return;
    updated.textContent = labels().ratesLoading;
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 9000);
    try {
      var res = await fetch("/api/exchange-rates?t=" + Date.now(), { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var payload = await res.json();
      var rates = normalizeExchangePayload(payload);
      if (!rates.length) throw new Error("empty rates");
      list.innerHTML = rates.map(function (rate) { return '<span>' + (rate.code || rate.label) + '/TRY <strong>' + formatNumber(rate.value, 4) + ' TL</strong></span>'; }).join("");
      updated.textContent = (locale() === "tr" ? "GÃ¼ncellendi" : locale() === "ar" ? "ØªÙ… Ø§Ù„ØªØ­Ø¯ÙŠØ«" : "Updated") + ": " + new Date(payload.updatedAt || payload.fetched_at || Date.now()).toLocaleString(locale() === "tr" ? "tr-TR" : "en-GB") + " Â· " + (payload.source || "TCMB");
    } catch (error) {
      updated.textContent = labels().ratesError;
      list.innerHTML = '<span>USD/TRY <strong>-</strong></span><span>EUR/TRY <strong>-</strong></span>';
    } finally {
      clearTimeout(timer);
    }
  }

  function boot() {
    ensureStyle();
    setHeaderMetric();
    applyLocaleIsolation();
    setupRelatedAccordions();
    normalizeActions();
    renderDock();
    addOfferButtonsToRows();
    bindClicks();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true }); else boot();
  window.addEventListener("resize", setHeaderMetric);
  window.addEventListener("sidya:locale-applied", function () { setTimeout(function () { applyLocaleIsolation(); normalizeActions(); setupRelatedAccordions(); renderDock(); loadRates(); }, 0); });
  document.addEventListener("click", function (event) { if (event.target.closest(".lang-option")) setTimeout(function () { applyLocaleIsolation(); normalizeActions(); setupRelatedAccordions(); renderDock(); loadRates(); }, 160); }, true);
  setTimeout(loadRates, 250);
})();

