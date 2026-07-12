(function () {
  var locale = new URLSearchParams(location.search).get("lang") || localStorage.getItem("sidyaLang") || document.documentElement.lang || "tr";
  locale = String(locale).toLowerCase().split("-")[0];
  var dict = {
    tr: { title: "Teklif Talebi", nav: "Teklif Talebi", submit: "Teklif Talebini Gönder", target: "Talep Ettiğiniz Koli Fiyatı", carton: "İstenen koli", note: "Ürün notu", total: "Satır toplamı", add: "Bu ürün için fiyat teklif et", min: "Bu ürün için minimum sipariş miktarı {n} kolidir.", special: "Özel değerlendirme talebi", sent: "Teklif talebiniz alındı.", pdf: "PDF", excel: "Excel", missing: "Eksik lojistik veri", approx: "Hesaplamalar yaklaşık değerlerdir." },
    en: { title: "Request for Quotation", nav: "Request a Quote", submit: "Submit RFQ", target: "Your Target Price per Carton", carton: "Requested cartons", note: "Product note", total: "Line total", add: "Request price for this product", min: "Minimum order quantity for this product is {n} cartons.", special: "Special review request", sent: "Your RFQ has been received.", pdf: "PDF", excel: "Excel", missing: "Missing logistics data", approx: "Calculations are approximate." },
    az: { title: "Qiymət Təklifi İstə", nav: "Qiymət Təklifi İstə", submit: "RFQ göndər", target: "Koli üçün hədəf qiymət", carton: "İstənən koli", note: "Məhsul qeydi", total: "Sətir cəmi", add: "Bu məhsul üçün qiymət istə", min: "Bu məhsul üçün minimum sifariş {n} kolidir.", special: "Xüsusi dəyərləndirmə", sent: "Sorğunuz alındı.", pdf: "PDF", excel: "Excel", missing: "Logistika məlumatı yoxdur", approx: "Hesablamalar təxminidir." },
    ka: { title: "ფასის შეთავაზების მოთხოვნა", nav: "ფასის შეთავაზების მოთხოვნა", submit: "RFQ გაგზავნა", target: "სამიზნე ფასი ყუთზე", carton: "ყუთების რაოდენობა", note: "პროდუქტის შენიშვნა", total: "ჯამი", add: "ფასის მოთხოვნა", min: "ამ პროდუქტისთვის მინიმუმი არის {n} ყუთი.", special: "სპეციალური განხილვა", sent: "მოთხოვნა მიღებულია.", pdf: "PDF", excel: "Excel", missing: "ლოგისტიკის მონაცემები აკლია", approx: "გამოთვლები მიახლოებითია." },
    ru: { title: "Запросить предложение", nav: "Запросить предложение", submit: "Отправить RFQ", target: "Целевая цена за короб", carton: "Коробов", note: "Примечание", total: "Итого", add: "Запросить цену", min: "Минимальный заказ для этого товара: {n} коробов.", special: "Особое рассмотрение", sent: "Ваш запрос получен.", pdf: "PDF", excel: "Excel", missing: "Нет логистических данных", approx: "Расчеты приблизительные." }
  };
  var t = function (key) { return (dict[locale] || dict.en)[key] || dict.en[key] || key; };
  var currencies = (window.SIDYA_RFQ_CURRENCIES && window.SIDYA_RFQ_CURRENCIES.activeCurrencies ? window.SIDYA_RFQ_CURRENCIES.activeCurrencies() : [{ code: "USD", symbol: "$", decimal_places: 2 }, { code: "EUR", symbol: "€", decimal_places: 2 }, { code: "TRY", symbol: "₺", decimal_places: 2 }]);
  var catalog = (window.CATALOG_PRODUCTS || window.catalog || []).slice(0, 5000);
  var state = { items: [] };
  var els = {};
  var fallbackLogistics = { "home-products": [1,36,8], "cleaning-products": [12,60,12], "food-products": [12,72,10], "industrial-products": [1,40,14], "medical-products": [24,80,5], "cosmetics-products": [24,72,6], "automotive-products": [1,36,15], "hardware-products": [1,48,18] };

  function escapeHtml(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[c]; }); }
  function productName(product) { return (product.names && (product.names[locale] || product.names.en || product.names.tr)) || product.name || product.product || product.id || "Product"; }
  function productImage(product) { return product.image || product.logo || (product.brand && window.brandLogoMap && window.brandLogoMap[product.brand]) || "assets/app-icon.svg"; }
  function productMeta(product) {
    var fallback = fallbackLogistics[product.category] || [Number(product.unitsPerCarton || 1), Number(product.cartonsPerPallet || 0), Number(product.kgPerCarton || 0)];
    return {
      unitsPerCarton: Number(product.unitsPerCarton || product.units_per_carton || fallback[0] || 1),
      cartonsPerPallet: Number(product.cartonsPerPallet || product.cartons_per_pallet || fallback[1] || 0),
      kgPerCarton: Number(product.kgPerCarton || product.kg_per_carton || fallback[2] || 0),
      minimumCarton: Math.max(Number(product.minimumCarton || product.minimum_carton_quantity || product.moqCartons || 1), 1)
    };
  }
  function normalize(value) { return String(value || "").toLocaleLowerCase("tr-TR").normalize("NFKD").replace(/[\u0300-\u036f]/g, ""); }
  function money(value, code) { return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { style: "currency", currency: code || "USD", maximumFractionDigits: 4 }).format(Number(value || 0)); }
  function saveCart() { localStorage.setItem("sidyaRfqCart", JSON.stringify(state.items)); }
  function loadCart() { try { state.items = JSON.parse(localStorage.getItem("sidyaRfqCart") || "[]"); } catch (_) { state.items = []; } }
  function addProduct(product) {
    var id = product.id || product.catalog_id || product.sku || product.barcode || productName(product);
    if (state.items.some(function (item) { return item.product_id === id; })) return;
    var meta = productMeta(product);
    state.items.push({
      product_id: id,
      product_name: productName(product),
      brand: product.brand || "",
      barcode: product.barcode || "",
      sku: product.sku || id,
      image: productImage(product),
      unitsPerCarton: meta.unitsPerCarton,
      kgPerCarton: meta.kgPerCarton,
      cartonsPerPallet: meta.cartonsPerPallet,
      minimumCarton: meta.minimumCarton,
      requested_cartons: meta.minimumCarton || 1,
      target_unit_price: "",
      currency_code: "USD",
      customer_note: "",
      special_review_requested: false
    });
    saveCart();
    renderLines();
  }
  window.SIDYA_RFQ = window.SIDYA_RFQ || {};
  window.SIDYA_RFQ.addProduct = addProduct;

  function renderCurrencyOptions(selected) {
    return currencies.map(function (item) { var code = item.code || item.currency_code; return '<option value="' + code + '"' + (code === selected ? ' selected' : '') + '>' + code + ' - ' + escapeHtml(item.name || item.currency_name || code) + '</option>'; }).join("");
  }
  function lineTotal(item) { return Number(item.requested_cartons || 0) * Number(String(item.target_unit_price || 0).replace(",", ".")); }
  function renderLines() {
    if (!els.lines) return;
    els.lines.innerHTML = state.items.length ? state.items.map(function (item, index) {
      var belowMin = Number(item.requested_cartons || 0) < Number(item.minimumCarton || 0);
      var complete = Number(item.requested_cartons) > 0 && Number(item.target_unit_price) > 0 && item.currency_code;
      var missingLogistics = !Number(item.kgPerCarton) || !Number(item.cartonsPerPallet);
      return '<article class="rfq-line ' + (belowMin ? 'has-warning' : complete ? 'is-complete' : '') + '" data-index="' + index + '">' +
        '<div class="rfq-line-head"><div class="rfq-line-title"><strong>' + escapeHtml(item.brand) + ' · ' + escapeHtml(item.product_name) + '</strong><small>' + escapeHtml(item.barcode || item.sku || '') + ' · Koli içi: ' + item.unitsPerCarton + ' · Koli kg: ' + (item.kgPerCarton || '-') + ' · Palet koli: ' + (item.cartonsPerPallet || '-') + ' · Min: ' + item.minimumCarton + '</small>' + (missingLogistics ? '<span class="rfq-missing">' + t('missing') + '</span>' : '') + '</div><button class="rfq-danger" type="button" data-remove-line="' + index + '">Sil</button></div>' +
        '<div class="rfq-line-grid"><label>' + t('carton') + '<input data-line-field="requested_cartons" type="number" min="1" step="1" value="' + escapeHtml(item.requested_cartons) + '" required></label><label>' + t('target') + '<input data-line-field="target_unit_price" type="number" min="0.0001" step="0.0001" value="' + escapeHtml(item.target_unit_price) + '" required></label><label>Para birimi<select data-line-field="currency_code">' + renderCurrencyOptions(item.currency_code) + '</select></label><label>' + t('note') + '<input data-line-field="customer_note" value="' + escapeHtml(item.customer_note) + '"></label><div class="rfq-line-total"><small>' + t('total') + '</small><br>' + money(lineTotal(item), item.currency_code) + '</div></div>' +
        (belowMin ? '<div class="rfq-warning">' + t('min').replace('{n}', item.minimumCarton) + ' <label><input data-line-field="special_review_requested" type="checkbox" ' + (item.special_review_requested ? 'checked' : '') + '> ' + t('special') + '</label></div>' : '') +
      '</article>';
    }).join("") : '<p class="rfq-note">Henüz ürün seçilmedi.</p>';
    renderSummary();
  }
  function renderSummary() {
    var totalCartons = state.items.reduce(function (sum, item) { return sum + Number(item.requested_cartons || 0); }, 0);
    var totalUnits = state.items.reduce(function (sum, item) { return sum + Number(item.requested_cartons || 0) * Number(item.unitsPerCarton || 1); }, 0);
    var grossKg = state.items.reduce(function (sum, item) { return sum + Number(item.requested_cartons || 0) * Number(item.kgPerCarton || 0); }, 0);
    var pallets = state.items.reduce(function (sum, item) { return sum + (Number(item.cartonsPerPallet || 0) ? Number(item.requested_cartons || 0) / Number(item.cartonsPerPallet) : 0); }, 0);
    var totals = state.items.reduce(function (map, item) { var code = item.currency_code || 'USD'; map[code] = (map[code] || 0) + lineTotal(item); return map; }, {});
    if (els.summary) els.summary.innerHTML = '<div class="rfq-summary-line"><span>Toplam koli</span><strong>' + totalCartons + '</strong></div><div class="rfq-summary-line"><span>Toplam adet</span><strong>' + totalUnits.toLocaleString() + '</strong></div><div class="rfq-summary-line"><span>Tahmini palet</span><strong>' + pallets.toFixed(2) + '</strong></div><div class="rfq-summary-line"><span>Brüt kg</span><strong>' + grossKg.toFixed(2) + '</strong></div><div class="rfq-summary-line"><span>TIR doluluk</span><strong>' + Math.min(100, grossKg / 24000 * 100).toFixed(1) + '%</strong></div><p class="rfq-note">' + t('approx') + '</p><div class="rfq-currency-totals">' + Object.keys(totals).map(function (code) { return '<span><b>' + code + ' toplamı</b><strong>' + money(totals[code], code) + '</strong></span>'; }).join('') + '</div>';
    if (els.mobile) els.mobile.textContent = 'RFQ Özeti - ' + totalCartons + ' koli';
  }
  function renderProducts(term) {
    var q = normalize(term || "");
    var results = catalog.filter(function (product) {
      var haystack = normalize([productName(product), product.brand, product.barcode, product.sku, product.category, product.sourceCategory, product.liter, product.grammage].join(" "));
      return !q || haystack.includes(q);
    }).slice(0, 40);
    els.results.innerHTML = results.map(function (product) {
      var meta = productMeta(product);
      return '<div class="rfq-product-row"><img src="' + escapeHtml(productImage(product)) + '" alt=""><div><strong>' + escapeHtml(product.brand || '') + ' ' + escapeHtml(productName(product)) + '</strong><small>' + escapeHtml(product.barcode || product.sku || '') + ' · Koli içi: ' + meta.unitsPerCarton + ' · Kg: ' + (meta.kgPerCarton || '-') + ' · Min: ' + meta.minimumCarton + '</small></div><button type="button" data-add-product="' + escapeHtml(product.id || product.catalog_id || product.sku || product.barcode || productName(product)) + '">' + t('add') + '</button></div>';
    }).join("") || '<p class="rfq-note">Sonuç bulunamadı.</p>';
  }
  function collectPayload() {
    var form = new FormData(els.form);
    var payload = {};
    form.forEach(function (value, key) { payload[key] = value; });
    payload.consent_privacy = !!els.form.querySelector('[name="consent_privacy"]:checked');
    payload.consent_commercial = !!els.form.querySelector('[name="consent_commercial"]:checked');
    payload.consent_accuracy = !!els.form.querySelector('[name="consent_accuracy"]:checked');
    payload.items = state.items.map(function (item) { return Object.assign({}, item); });
    payload.lang = locale;
    return payload;
  }
  async function submitRfq(event) {
    event.preventDefault();
    els.status.textContent = "";
    els.status.classList.remove("error");
    if (!state.items.length) return setError("En az bir ürün ekleyin.");
    try {
      var response = await fetch("/api/rfq", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(collectPayload()) });
      var data = await response.json();
      if (!response.ok) throw new Error(data.error || "RFQ gönderilemedi.");
      localStorage.removeItem("sidyaRfqCart");
      els.status.innerHTML = t('sent') + ' <strong>' + escapeHtml(data.rfq && data.rfq.rfq_number || '') + '</strong> <button type="button" class="rfq-secondary" id="rfqPdfButton">' + t('pdf') + '</button> <button type="button" class="rfq-secondary" id="rfqExcelButton">' + t('excel') + '</button>';
      document.getElementById('rfqPdfButton')?.addEventListener('click', printPdf);
      document.getElementById('rfqExcelButton')?.addEventListener('click', downloadExcel);
    } catch (error) { setError(error.message || "RFQ gönderilemedi."); }
  }
  function setError(message) { els.status.textContent = message; els.status.classList.add("error"); }
  function downloadExcel() {
    var rows = state.items.map(function (item) { return { Marka: item.brand, Ürün: item.product_name, Barkod: item.barcode, "Stok kodu": item.sku, "Koli içi": item.unitsPerCarton, "İstenen koli": item.requested_cartons, "Toplam adet": Number(item.requested_cartons || 0) * Number(item.unitsPerCarton || 1), "Hedef koli fiyatı": item.target_unit_price, "Para birimi": item.currency_code, "Satır toplamı": lineTotal(item), Palet: item.cartonsPerPallet, "Brüt kg": Number(item.requested_cartons || 0) * Number(item.kgPerCarton || 0), Not: item.customer_note }; });
    if (window.XLSX) { var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "RFQ"); XLSX.writeFile(wb, "sidya-rfq.xlsx"); }
  }
  function printPdf() {
    var popup = window.open("", "_blank");
    if (!popup) return;
    popup.document.write('<title>Sidya Global RFQ</title><body style="font-family:Arial;padding:24px"><h1>Sidya Global RFQ</h1><table border="1" cellspacing="0" cellpadding="6"><tr><th>Marka</th><th>Ürün</th><th>Koli</th><th>Hedef fiyat</th><th>Toplam</th></tr>' + state.items.map(function (item) { return '<tr><td>' + escapeHtml(item.brand) + '</td><td>' + escapeHtml(item.product_name) + '</td><td>' + item.requested_cartons + '</td><td>' + money(item.target_unit_price, item.currency_code) + '</td><td>' + money(lineTotal(item), item.currency_code) + '</td></tr>'; }).join('') + '</table><p>Bu belge müşterinin fiyat ve miktar talebini gösterir. Sidya Global tarafından düzenlenmiş kesin satış teklifi veya proforma fatura değildir.</p></body>');
    popup.document.close(); popup.print();
  }
  function bind() {
    els.form = document.getElementById("rfqForm");
    els.results = document.getElementById("rfqProductResults");
    els.search = document.getElementById("rfqProductSearch");
    els.lines = document.getElementById("rfqLines");
    els.summary = document.getElementById("rfqSummary");
    els.status = document.getElementById("rfqStatus");
    els.mobile = document.getElementById("rfqMobileSummaryText");
    if (!els.form) return;
    document.title = "Sidya Global | " + t('title');
    els.search.addEventListener("input", function () { renderProducts(els.search.value); });
    els.results.addEventListener("click", function (event) { var id = event.target.getAttribute("data-add-product"); if (!id) return; var product = catalog.find(function (item) { return String(item.id || item.catalog_id || item.sku || item.barcode || productName(item)) === id; }); if (product) addProduct(product); });
    els.lines.addEventListener("input", updateLineFromEvent);
    els.lines.addEventListener("change", updateLineFromEvent);
    els.lines.addEventListener("click", function (event) { var remove = event.target.getAttribute("data-remove-line"); if (remove === null) return; state.items.splice(Number(remove), 1); saveCart(); renderLines(); });
    els.form.addEventListener("submit", submitRfq);
    loadCart(); renderProducts(""); renderLines();
  }
  function updateLineFromEvent(event) {
    var field = event.target.getAttribute("data-line-field");
    if (!field) return;
    var index = Number(event.target.closest(".rfq-line").getAttribute("data-index"));
    if (!state.items[index]) return;
    state.items[index][field] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    saveCart(); renderLines();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
})();
