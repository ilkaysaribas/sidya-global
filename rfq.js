(function () {
  var params = new URLSearchParams(location.search);
  var locale = (params.get("lang") || localStorage.getItem("sidyaLang") || document.documentElement.lang || "tr").toLowerCase().split("-")[0];
  var dict = {
    tr: { title: "Teklif Talebi", add: "Bu ürün için fiyat teklif et", submit: "Teklif Talebini Gönder", target: "Talep Ettiğiniz Koli Fiyatı", carton: "İstenen koli", currency: "Para birimi", note: "Ürün notu", total: "Satır toplamı", empty: "Henüz ürün seçilmedi.", noResult: "Sonuç bulunamadı. Arama metniyle özel ürün satırı ekleyebilirsiniz.", custom: "Arama metniyle özel ürün ekle", sent: "Teklif talebiniz alındı.", missing: "Eksik lojistik veri", approx: "Hesaplamalar yaklaşık değerlerdir.", min: "Bu ürün için minimum sipariş miktarı {n} kolidir.", special: "Özel değerlendirme talebi", addAtLeastOne: "En az bir ürün ekleyin.", submitError: "RFQ gönderilemedi.", pdf: "PDF", excel: "Excel" },
    en: { title: "Request for Quotation", add: "Request price for this product", submit: "Submit RFQ", target: "Your Target Price per Carton", carton: "Requested cartons", currency: "Currency", note: "Product note", total: "Line total", empty: "No product selected yet.", noResult: "No result found. You can add a custom line with the search text.", custom: "Add custom product", sent: "Your RFQ has been received.", missing: "Missing logistics data", approx: "Calculations are approximate.", min: "Minimum order quantity for this product is {n} cartons.", special: "Special review request", addAtLeastOne: "Add at least one product.", submitError: "RFQ could not be submitted.", pdf: "PDF", excel: "Excel" },
    ar: { title: "طلب عرض سعر", add: "اطلب سعرا لهذا المنتج", submit: "إرسال طلب العرض", target: "السعر المستهدف لكل كرتون", carton: "عدد الكراتين", currency: "العملة", note: "ملاحظة المنتج", total: "إجمالي السطر", empty: "لم يتم اختيار منتج بعد.", noResult: "لا توجد نتائج. يمكنك إضافة سطر مخصص بنص البحث.", custom: "إضافة منتج مخصص", sent: "تم استلام طلب عرض السعر.", missing: "بيانات لوجستية ناقصة", approx: "الحسابات تقريبية.", min: "الحد الأدنى لهذا المنتج هو {n} كرتون.", special: "طلب تقييم خاص", addAtLeastOne: "أضف منتجا واحدا على الأقل.", submitError: "تعذر إرسال الطلب.", pdf: "PDF", excel: "Excel" }
  };
  var t = function (key) { return (dict[locale] || dict.en)[key] || dict.en[key] || key; };
  var currencies = window.SIDYA_RFQ_CURRENCIES && window.SIDYA_RFQ_CURRENCIES.activeCurrencies ? window.SIDYA_RFQ_CURRENCIES.activeCurrencies() : [{ code: "USD", name: "US Dollar" }, { code: "EUR", name: "Euro" }, { code: "TRY", name: "Turkish Lira" }];
  var catalog = (window.CATALOG_PRODUCTS || window.catalog || window.SIDYA_CATALOG_PRODUCTS || []).slice(0, 5000);
  var fallbackLogistics = { "home-products": [1,36,8], "cleaning-products": [12,60,12], "food-products": [12,72,10], "industrial-products": [1,40,14], "medical-products": [24,80,5], "cosmetics-products": [24,72,6], "automotive-products": [1,36,15], "hardware-products": [1,48,18] };
  var state = { items: [] };
  var els = {};

  function esc(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[c]; }); }
  function normalize(value) { return String(value || "").toLocaleLowerCase("tr-TR").normalize("NFKD").replace(/[\u0300-\u036f]/g, ""); }
  function productName(product) { return (product.names && (product.names[locale] || (locale === "ar" ? product.names.en : product.names.tr) || product.names.en)) || product.name || product.product || product.id || "Product"; }
  function productKey(product) { return String(product.id || product.catalog_id || product.sku || product.barcode || productName(product)); }
  function productMeta(product) {
    var fallback = fallbackLogistics[product.category] || [Number(product.unitsPerCarton || 1), Number(product.cartonsPerPallet || 0), Number(product.kgPerCarton || 0)];
    return {
      unitsPerCarton: Number(product.unitsPerCarton || product.units_per_carton || fallback[0] || 1),
      cartonsPerPallet: Number(product.cartonsPerPallet || product.cartons_per_pallet || fallback[1] || 0),
      kgPerCarton: Number(product.kgPerCarton || product.kg_per_carton || fallback[2] || 0),
      minimumCarton: Math.max(Number(product.minimumCarton || product.minimum_carton_quantity || product.moqCartons || 1), 1)
    };
  }
  function money(value, code) { return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { style: "currency", currency: code || "USD", maximumFractionDigits: 4 }).format(Number(value || 0)); }
  function saveCart() { localStorage.setItem("sidyaRfqCart", JSON.stringify(state.items)); }
  function loadCart() { try { state.items = JSON.parse(localStorage.getItem("sidyaRfqCart") || "[]"); } catch (_) { state.items = []; } }
  function customProduct(name) { return { id: "custom-" + normalize(name).replace(/\s+/g, "-"), name: name || "Custom product", brand: "", sku: name || "custom", category: "industrial-products", unitsPerCarton: 1, cartonsPerPallet: 0, kgPerCarton: 0, minimumCarton: 1 }; }
  function addProduct(product) {
    var id = productKey(product);
    if (state.items.some(function (item) { return item.product_id === id; })) return;
    var meta = productMeta(product);
    state.items.push({ product_id: id, product_name: productName(product), brand: product.brand || "", barcode: product.barcode || "", sku: product.sku || id, unitsPerCarton: meta.unitsPerCarton, kgPerCarton: meta.kgPerCarton, cartonsPerPallet: meta.cartonsPerPallet, minimumCarton: meta.minimumCarton, requested_cartons: meta.minimumCarton || 1, target_unit_price: "", currency_code: "USD", customer_note: "", special_review_requested: false });
    saveCart();
    renderLines();
  }
  window.SIDYA_RFQ = window.SIDYA_RFQ || {}; window.SIDYA_RFQ.addProduct = addProduct;

  function currencyOptions(selected) { return currencies.map(function (item) { var code = item.code || item.currency_code; return '<option value="' + code + '"' + (code === selected ? ' selected' : '') + '>' + code + ' - ' + esc(item.name || item.currency_name || code) + '</option>'; }).join(""); }
  function lineTotal(item) { return Number(item.requested_cartons || 0) * Number(String(item.target_unit_price || 0).replace(",", ".")); }
  function renderProducts(term) {
    if (!els.results) return;
    var q = normalize(term || "");
    var results = catalog.filter(function (product) { return !q || normalize([productName(product), product.brand, product.barcode, product.sku, product.category, product.grammage].join(" ")).includes(q); }).slice(0, 40);
    var html = results.map(function (product) { var meta = productMeta(product); return '<div class="rfq-product-row"><img src="assets/app-icon.svg" alt=""><div><strong>' + esc(product.brand || '') + ' ' + esc(productName(product)) + '</strong><small>' + esc(product.barcode || product.sku || '') + ' · Koli içi: ' + meta.unitsPerCarton + ' · Kg: ' + (meta.kgPerCarton || '-') + ' · Min: ' + meta.minimumCarton + '</small></div><button type="button" data-add-product="' + esc(productKey(product)) + '">' + t('add') + '</button></div>'; }).join("");
    if (!html) html = '<p class="rfq-note">' + t('noResult') + '</p>' + (term ? '<button class="rfq-secondary" type="button" data-add-custom="1">' + t('custom') + '</button>' : '');
    els.results.innerHTML = html;
  }
  function renderLines() {
    if (!els.lines) return;
    els.lines.innerHTML = state.items.length ? state.items.map(function (item, index) {
      var belowMin = Number(item.requested_cartons || 0) < Number(item.minimumCarton || 0);
      var complete = Number(item.requested_cartons) > 0 && Number(item.target_unit_price) > 0 && item.currency_code;
      var missing = !Number(item.kgPerCarton) || !Number(item.cartonsPerPallet);
      return '<article class="rfq-line ' + (belowMin ? 'has-warning' : complete ? 'is-complete' : '') + '" data-index="' + index + '"><div class="rfq-line-head"><div class="rfq-line-title"><strong>' + esc(item.brand) + ' · ' + esc(item.product_name) + '</strong><small>' + esc(item.barcode || item.sku || '') + ' · Koli içi: ' + item.unitsPerCarton + ' · Koli kg: ' + (item.kgPerCarton || '-') + ' · Palet koli: ' + (item.cartonsPerPallet || '-') + ' · Min: ' + item.minimumCarton + '</small>' + (missing ? '<span class="rfq-missing">' + t('missing') + '</span>' : '') + '</div><button class="rfq-danger" type="button" data-remove-line="' + index + '">Sil</button></div><div class="rfq-line-grid"><label>' + t('carton') + '<input data-line-field="requested_cartons" type="number" min="1" step="1" value="' + esc(item.requested_cartons) + '" required></label><label>' + t('target') + '<input data-line-field="target_unit_price" type="number" min="0.0001" step="0.0001" value="' + esc(item.target_unit_price) + '" required></label><label>' + t('currency') + '<select data-line-field="currency_code">' + currencyOptions(item.currency_code) + '</select></label><label>' + t('note') + '<input data-line-field="customer_note" value="' + esc(item.customer_note) + '"></label><div class="rfq-line-total"><small>' + t('total') + '</small><br>' + money(lineTotal(item), item.currency_code) + '</div></div>' + (belowMin ? '<div class="rfq-warning">' + t('min').replace('{n}', item.minimumCarton) + ' <label><input data-line-field="special_review_requested" type="checkbox" ' + (item.special_review_requested ? 'checked' : '') + '> ' + t('special') + '</label></div>' : '') + '</article>';
    }).join("") : '<p class="rfq-note">' + t('empty') + '</p>';
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
  function collectPayload() { var form = new FormData(els.form); var payload = { type: "rfq" }; form.forEach(function (value, key) { payload[key] = value; }); payload.consent_privacy = !!els.form.querySelector('[name="consent_privacy"]:checked'); payload.consent_commercial = !!els.form.querySelector('[name="consent_commercial"]:checked'); payload.consent_accuracy = !!els.form.querySelector('[name="consent_accuracy"]:checked'); payload.items = state.items.map(function (item) { return Object.assign({}, item); }); payload.lang = locale; return payload; }
  async function submitRfq(event) { event.preventDefault(); els.status.textContent = ""; els.status.classList.remove("error"); if (!state.items.length) return setError(t('addAtLeastOne')); try { var response = await fetch("/api/site-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(collectPayload()) }); var data = await response.json(); if (!response.ok) throw new Error(data.error || t('submitError')); localStorage.removeItem("sidyaRfqCart"); els.status.innerHTML = t('sent') + ' <strong>' + esc(data.rfq && data.rfq.rfq_number || '') + '</strong> <button type="button" class="rfq-secondary" id="rfqPdfButton">' + t('pdf') + '</button> <button type="button" class="rfq-secondary" id="rfqExcelButton">' + t('excel') + '</button>'; document.getElementById('rfqPdfButton')?.addEventListener('click', printPdf); document.getElementById('rfqExcelButton')?.addEventListener('click', downloadExcel); } catch (error) { setError(error.message || t('submitError')); } }
  function setError(message) { els.status.textContent = message; els.status.classList.add("error"); }
  function downloadExcel() { if (!window.XLSX) return; var rows = state.items.map(function (item) { return { Marka: item.brand, Urun: item.product_name, Barkod: item.barcode, StokKodu: item.sku, KoliIci: item.unitsPerCarton, IstenenKoli: item.requested_cartons, ToplamAdet: Number(item.requested_cartons || 0) * Number(item.unitsPerCarton || 1), HedefKoliFiyati: item.target_unit_price, ParaBirimi: item.currency_code, SatirToplami: lineTotal(item), Palet: item.cartonsPerPallet, BrutKg: Number(item.requested_cartons || 0) * Number(item.kgPerCarton || 0), Not: item.customer_note }; }); var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "RFQ"); XLSX.writeFile(wb, "sidya-rfq.xlsx"); }
  function printPdf() { var popup = window.open("", "_blank"); if (!popup) return; popup.document.write('<title>Sidya Global RFQ</title><body style="font-family:Arial;padding:24px"><h1>Sidya Global RFQ</h1><table border="1" cellspacing="0" cellpadding="6"><tr><th>Marka</th><th>Ürün</th><th>Koli</th><th>Hedef fiyat</th><th>Toplam</th></tr>' + state.items.map(function (item) { return '<tr><td>' + esc(item.brand) + '</td><td>' + esc(item.product_name) + '</td><td>' + item.requested_cartons + '</td><td>' + money(item.target_unit_price, item.currency_code) + '</td><td>' + money(lineTotal(item), item.currency_code) + '</td></tr>'; }).join('') + '</table><p>Bu belge müşterinin fiyat ve miktar talebini gösterir. Sidya Global tarafından düzenlenmiş kesin satış teklifi veya proforma fatura değildir.</p></body>'); popup.document.close(); popup.print(); }
  function bind() {
    els.form = document.getElementById("rfqForm"); els.results = document.getElementById("rfqProductResults"); els.search = document.getElementById("rfqProductSearch"); els.lines = document.getElementById("rfqLines"); els.summary = document.getElementById("rfqSummary"); els.status = document.getElementById("rfqStatus"); els.mobile = document.getElementById("rfqMobileSummaryText"); if (!els.form) return;
    document.title = "Sidya Global | " + t('title');
    els.search.addEventListener("input", function () { renderProducts(els.search.value); });
    els.results.addEventListener("click", function (event) { var id = event.target.getAttribute("data-add-product"); if (id) { var product = catalog.find(function (item) { return productKey(item) === id; }); if (product) addProduct(product); } if (event.target.getAttribute("data-add-custom")) addProduct(customProduct(els.search.value)); });
    els.lines.addEventListener("input", updateLineFromEvent); els.lines.addEventListener("change", updateLineFromEvent); els.lines.addEventListener("click", function (event) { var remove = event.target.getAttribute("data-remove-line"); if (remove === null) return; state.items.splice(Number(remove), 1); saveCart(); renderLines(); }); els.form.addEventListener("submit", submitRfq);
    loadCart(); var productParam = params.get("product"); if (productParam && !state.items.length) addProduct(customProduct(productParam)); renderProducts(""); renderLines();
  }
  function updateLineFromEvent(event) { var field = event.target.getAttribute("data-line-field"); if (!field) return; var index = Number(event.target.closest(".rfq-line").getAttribute("data-index")); if (!state.items[index]) return; state.items[index][field] = event.target.type === "checkbox" ? event.target.checked : event.target.value; saveCart(); renderLines(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
})();
