window.SIDYA_BACKEND = {
  supabaseUrl: "https://jhjforyykkxklfarjtjl.supabase.co",
  supabaseAnonKey: "sb_publishable_obANQZIOM1xpMIBsJPZcoA__6TGFYBc",
  storageBucket: "b2b-documents",
};

(function () {
  const cfg = window.SIDYA_BACKEND || {};
  const money = (value) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(Number(value || 0));
  const num = (value) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 }).format(Number(value || 0));
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  const today = () => new Date().toISOString().slice(0, 10);

  const state = {
    db: null,
    products: [],
    customers: [],
    receivables: [],
    payables: [],
    assets: [],
    lines: [{ id: crypto.randomUUID(), product_id: "", cartons: 1, direct_expense: 0 }]
  };

  function formValues(form) {
    const out = {};
    new FormData(form).forEach((value, key) => { out[key] = value; });
    ["usd_rate", "eur_rate", "gel_rate", "support_rate", "direct_expense"].forEach((key) => out[key] = Number(out[key] || 0));
    return out;
  }

  function rateFor(currency, header) {
    const code = String(currency || "TRY").toUpperCase();
    if (code === "TRY") return 1;
    if (code === "EUR") return Number(header.eur_rate || 1);
    if (code === "GEL") return Number(header.gel_rate || 1);
    return Number(header.usd_rate || 1);
  }

  function lineCalc(line, header) {
    const product = state.products.find((item) => item.id === line.product_id) || {};
    const cartons = Number(line.cartons || 0);
    const unitsPerCarton = Number(line.units_per_carton || product.units_per_carton || 1) || 1;
    const totalUnits = cartons * unitsPerCarton;
    const vatRate = Number(line.vat_rate ?? product.vat_rate ?? 0);
    const purchaseUnitVatIncluded = Number(line.purchase_unit_vat_included || product.purchase_price_vat_included || product.purchase_price || 0);
    const purchaseVatIncluded = totalUnits * purchaseUnitVatIncluded;
    const purchaseVatExcluded = purchaseVatIncluded / (1 + vatRate / 100);
    const vatReceivable = purchaseVatIncluded - purchaseVatExcluded;
    const saleCurrency = String(line.sale_currency || product.sale_currency || "USD").toUpperCase();
    const saleCartonPrice = Number(line.sale_carton_price || product.sale_carton_price || (Number(product.sale_price || 0) * unitsPerCarton) || 0);
    const exchangeRate = Number(line.exchange_rate || rateFor(saleCurrency, header));
    const grossSaleTry = saleCartonPrice * cartons * exchangeRate;
    const supportRate = Number(line.support_rate ?? (product.support_eligible ? (product.support_rate || header.support_rate || 0) : 0));
    const supportReceivable = grossSaleTry * supportRate / 100;
    const directExpense = Number(line.direct_expense || 0);
    const netProfit = grossSaleTry + vatReceivable + supportReceivable - purchaseVatIncluded - directExpense;
    return { product, cartons, unitsPerCarton, totalUnits, vatRate, purchaseUnitVatIncluded, purchaseVatIncluded, purchaseVatExcluded, vatReceivable, saleCurrency, saleCartonPrice, exchangeRate, grossSaleTry, supportRate, supportReceivable, directExpense, netProfit, profitRate: purchaseVatIncluded > 0 ? netProfit / purchaseVatIncluded : 0 };
  }

  function totals(header) {
    const calcLines = state.lines.map((line) => lineCalc(line, header));
    const total = calcLines.reduce((acc, item) => {
      acc.sale += item.grossSaleTry;
      acc.purchase += item.purchaseVatIncluded;
      acc.vat += item.vatReceivable;
      acc.support += item.supportReceivable;
      acc.lineExpense += item.directExpense;
      acc.net += item.netProfit;
      return acc;
    }, { sale: 0, purchase: 0, vat: 0, support: 0, lineExpense: 0, net: 0 });
    total.direct = total.lineExpense + Number(header.direct_expense || 0);
    total.net -= Number(header.direct_expense || 0);
    total.rate = total.purchase > 0 ? total.net / total.purchase : 0;
    return total;
  }

  async function loadCommercialData() {
    if (!state.db && window.supabase && cfg.supabaseUrl && (cfg.supabasePublishableKey || cfg.supabaseAnonKey)) {
      state.db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey || cfg.supabaseAnonKey);
    }
    if (!state.db) return;
    const safe = async (q) => {
      const { data, error } = await q;
      if (error) return [];
      return data || [];
    };
    const [products, customers, receivables, payables, assets] = await Promise.all([
      safe(state.db.from("products").select("*").order("name", { ascending: true }).limit(2000)),
      safe(state.db.from("customers").select("*").order("company", { ascending: true }).limit(1000)),
      safe(state.db.from("receivables").select("*").limit(2000)),
      safe(state.db.from("payables").select("*").limit(2000)),
      safe(state.db.from("assets").select("*").limit(1000))
    ]);
    Object.assign(state, { products, customers, receivables, payables, assets });
  }

  function injectShell() {
    const nav = document.querySelector("#mainNav");
    if (nav && !nav.querySelector('[data-view="profit-documents"]')) {
      nav.insertAdjacentHTML("beforeend", '<button data-view="profit-documents">Sipariş / Kârlılık</button><button data-view="closing">Cari Kapanış</button><a class="nav-crm-link" href="crm.html">Global CRM</a>');
    } else if (nav && !nav.querySelector(".nav-crm-link")) {
      nav.insertAdjacentHTML("beforeend", '<a class="nav-crm-link" href="crm.html">Global CRM</a>');
    }
    const main = document.querySelector("main.main");
    if (main && !document.querySelector('[data-view-panel="profit-documents"]')) {
      main.insertAdjacentHTML("beforeend", `
        <section class="view" data-view-panel="profit-documents">
          <form class="profit-workspace" id="profitDocumentForm">
            <div class="panel profit-head"><div class="panel-heading"><div><p class="eyebrow">SİPARİŞ / FATURA</p><h2>Belge oluştur ve kârlılığı gör</h2></div><button class="primary" type="submit">Kaydet</button></div>
              <div class="form-grid dense-grid"><label>Belge tipi<select name="document_type"><option value="order">Sipariş</option><option value="invoice">Fatura</option></select></label><label>Belge no<input name="document_no" /></label><label>Tarih<input name="document_date" type="date" /></label><label>Cari<select id="profitCustomer" name="customer_id" required></select></label><label>Vade tarihi<input id="profitDueDate" name="due_date" type="date" /></label><label>Depo<input name="warehouse" /></label><label>Ödeme tipi<select name="payment_type"><option>Vadeli</option><option>Peşin</option><option>Havale</option><option>POS</option></select></label><label>Durum<select name="status"><option value="draft">Taslak</option><option value="posted">Faturalaştı / stok düş</option></select></label><label>Satış kanalı<input name="sales_channel" /></label><label>USD kur<input name="usd_rate" type="number" step="0.0001" value="1" /></label><label>EUR kur<input name="eur_rate" type="number" step="0.0001" value="1" /></label><label>GEL kur<input name="gel_rate" type="number" step="0.0001" value="1" /></label><label>Döviz destek %<input name="support_rate" type="number" step="0.01" value="3" /></label><label>Direkt gider TL<input name="direct_expense" type="number" step="0.01" value="0" /></label></div>
            </div>
            <div class="profit-grid"><div class="panel"><div class="panel-heading"><h2>Ürün satırları</h2><button type="button" id="addProfitLineButton">Satır ekle</button></div><div class="table-wrap profit-lines"><table><thead><tr><th>Ürün</th><th>Koli</th><th>Koli içi</th><th>Toplam</th><th>Satış</th><th>Kur</th><th>Alış</th><th>KDV</th><th>Destek</th><th>Gider</th><th>Net kâr</th><th></th></tr></thead><tbody id="profitLineRows"></tbody></table></div></div><aside class="panel profit-summary"><div class="panel-heading"><h2>Canlı özet</h2></div><div id="profitSummaryCards" class="summary-card-list"></div></aside></div>
          </form>
        </section>
        <section class="view" data-view-panel="closing">
          <div class="metric-grid"><article><span>Varlıklar</span><strong id="closingAssets">₺0</strong><small>Kasa, banka, POS, stok, demirbaş</small></article><article><span>Alacaklar</span><strong id="closingReceivables">₺0</strong><small>Müşteri, KDV, destek, şahıs</small></article><article><span>Borçlar</span><strong id="closingPayables">₺0</strong><small>Tedarikçi, çek, kredi, vergi</small></article><article><span>Net kapanış</span><strong id="closingNet">₺0</strong><small>Kilit vurursak kalan</small></article></div>
          <div class="closing-grid"><article class="panel"><div class="panel-heading"><h2>Varlık dökümü</h2></div><div id="assetBreakdown" class="compact-list"></div></article><article class="panel"><div class="panel-heading"><h2>Alacak dökümü</h2></div><div id="receivableBreakdown" class="compact-list"></div></article><article class="panel"><div class="panel-heading"><h2>Borç dökümü</h2></div><div id="payableBreakdown" class="compact-list"></div></article><article class="panel"><div class="panel-heading"><h2>Vade raporu</h2></div><div class="table-wrap"><table><thead><tr><th>Durum</th><th>Alacak</th><th>Borç</th><th>Net</th></tr></thead><tbody id="dueReportRows"></tbody></table></div></article></div>
        </section>`);
    }
    if (!document.querySelector("#commercialRuntimeStyles")) {
      document.head.insertAdjacentHTML("beforeend", `<style id="commercialRuntimeStyles">.profit-workspace{display:grid;gap:18px}.profit-head .dense-grid{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}.profit-grid{display:grid;grid-template-columns:minmax(0,1fr)300px;gap:18px;align-items:start}.profit-lines table{min-width:1180px}.profit-lines td small{display:block;color:#64748b;margin-top:4px}.profit-lines input,.profit-lines select{width:100%;min-width:86px}.profit-summary{position:sticky;top:18px}.summary-card-list{display:grid;gap:10px}.summary-card-list article{border:1px solid #d9e2ec;border-radius:8px;padding:10px 12px;background:#fff}.summary-card-list span{display:block;color:#64748b;font-size:12px}.summary-card-list strong{display:block;margin-top:4px;font-size:18px}.profit-positive{color:#047857}.profit-negative{color:#b91c1c}.closing-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.nav-crm-link{display:block;margin-top:6px;padding:12px 14px;border-radius:10px;background:#0f766e;color:#fff!important;text-decoration:none;font-weight:800}@media(max-width:1100px){.profit-grid,.closing-grid{grid-template-columns:1fr}.profit-summary{position:static}}</style>`);
    }
  }

  function renderProfit() {
    const form = document.querySelector("#profitDocumentForm");
    if (!form) return;
    if (!form.elements.document_date.value) form.elements.document_date.value = today();
    if (!form.elements.document_no.value) form.elements.document_no.value = `SG-${today().replaceAll("-", "")}-001`;
    const selectedCustomer = form.elements.customer_id.value;
    form.elements.customer_id.innerHTML = ['<option value="">Cari seç</option>', ...state.customers.map((item) => `<option value="${item.id}">${esc(item.company)}${item.due_days ? ` · ${item.due_days} gün` : ""}</option>`)].join("");
    form.elements.customer_id.value = selectedCustomer;
    const productOptions = ['<option value="">Ürün seç</option>', ...state.products.map((item) => `<option value="${item.id}">${esc(item.product_code || item.sku || item.barcode || "")} ${esc(item.name || "")}</option>`)].join("");
    const header = formValues(form);
    document.querySelector("#profitLineRows").innerHTML = state.lines.map((line) => {
      const calc = lineCalc(line, header);
      return `<tr data-profit-line="${line.id}"><td><select data-profit-field="product_id">${productOptions}</select><small>${esc(calc.product.barcode || "")}</small></td><td><input data-profit-field="cartons" type="number" step="0.001" value="${line.cartons || 0}"></td><td><input data-profit-field="units_per_carton" type="number" step="1" value="${calc.unitsPerCarton}"></td><td>${num(calc.totalUnits)}</td><td><input data-profit-field="sale_carton_price" type="number" step="0.0001" value="${calc.saleCartonPrice}"><small>${calc.saleCurrency}</small></td><td><input data-profit-field="exchange_rate" type="number" step="0.0001" value="${calc.exchangeRate}"></td><td>${money(calc.purchaseVatIncluded)}</td><td>${money(calc.vatReceivable)}</td><td><input data-profit-field="support_rate" type="number" step="0.01" value="${calc.supportRate}"><small>${money(calc.supportReceivable)}</small></td><td><input data-profit-field="direct_expense" type="number" step="0.01" value="${calc.directExpense}"></td><td class="${calc.netProfit >= 0 ? "profit-positive" : "profit-negative"}">${money(calc.netProfit)}<small>%${num(calc.profitRate * 100)}</small></td><td><button type="button" data-remove-profit-line="${line.id}">Sil</button></td></tr>`;
    }).join("");
    state.lines.forEach((line) => { const row = document.querySelector(`[data-profit-line="${line.id}"]`); if (row) row.querySelector('[data-profit-field="product_id"]').value = line.product_id || ""; });
    const t = totals(header);
    document.querySelector("#profitSummaryCards").innerHTML = [["Toplam satış", money(t.sale)], ["Toplam alış maliyeti", money(t.purchase)], ["KDV alacağı", money(t.vat)], ["Destek alacağı", money(t.support)], ["Direkt gider", money(t.direct)], ["Net kâr", money(t.net), t.net >= 0 ? "profit-positive" : "profit-negative"], ["Kâr oranı", `%${num(t.rate * 100)}`], ["Müşteri alacağı", money(t.sale)], ["Devlet/KDV alacağı", money(t.vat + t.support)]].map(([label, value, cls]) => `<article><span>${label}</span><strong class="${cls || ""}">${value}</strong></article>`).join("");
  }

  function renderClosing() {
    if (!document.querySelector("#closingNet")) return;
    const openReceivables = state.receivables.filter((x) => x.status !== "closed" && x.status !== "cancelled");
    const openPayables = state.payables.filter((x) => x.status !== "closed" && x.status !== "cancelled");
    const activeAssets = state.assets.filter((x) => x.active !== false);
    const sum = (items, field) => items.reduce((a, b) => a + Number(b[field] || 0), 0);
    const assetTotal = sum(activeAssets, "amount_try");
    const receivableTotal = sum(openReceivables, "remaining_try");
    const payableTotal = sum(openPayables, "remaining_try");
    document.querySelector("#closingAssets").textContent = money(assetTotal);
    document.querySelector("#closingReceivables").textContent = money(receivableTotal);
    document.querySelector("#closingPayables").textContent = money(payableTotal);
    document.querySelector("#closingNet").textContent = money(assetTotal + receivableTotal - payableTotal);
    const breakdown = (selector, items, key, field) => {
      const grouped = items.reduce((acc, item) => { acc[item[key] || "diğer"] = (acc[item[key] || "diğer"] || 0) + Number(item[field] || 0); return acc; }, {});
      document.querySelector(selector).innerHTML = Object.entries(grouped).length ? Object.entries(grouped).map(([name, amount]) => `<div><strong>${esc(name)}</strong><span>${money(amount)}</span></div>`).join("") : '<p class="empty">Kayıt yok.</p>';
    };
    breakdown("#assetBreakdown", activeAssets, "asset_type", "amount_try");
    breakdown("#receivableBreakdown", openReceivables, "receivable_type", "remaining_try");
    breakdown("#payableBreakdown", openPayables, "payable_type", "remaining_try");
    const bucket = (d) => !d ? "Vade girilmedi" : d < today() ? "Vadesi geçmiş" : d === today() ? "Bugün" : "Vadesi gelmemiş";
    document.querySelector("#dueReportRows").innerHTML = ["Vadesi geçmiş", "Bugün", "Vadesi gelmemiş", "Vade girilmedi"].map((b) => {
      const r = sum(openReceivables.filter((x) => bucket(x.due_date) === b), "remaining_try");
      const p = sum(openPayables.filter((x) => bucket(x.due_date) === b), "remaining_try");
      return `<tr><td>${b}</td><td>${money(r)}</td><td>${money(p)}</td><td>${money(r - p)}</td></tr>`;
    }).join("");
  }

  async function saveDocument(event) {
    event.preventDefault();
    if (!state.db) throw new Error("Supabase bağlantısı yok.");
    const header = formValues(event.currentTarget);
    const items = state.lines.filter((line) => line.product_id).map((line) => {
      const c = lineCalc(line, header);
      return { product_id: line.product_id, cartons: c.cartons, units_per_carton: c.unitsPerCarton, vat_rate: c.vatRate, purchase_unit_vat_included: c.purchaseUnitVatIncluded, sale_currency: c.saleCurrency, sale_carton_price: c.saleCartonPrice, exchange_rate: c.exchangeRate, support_rate: c.supportRate, direct_expense: c.directExpense };
    });
    if (!items.length) throw new Error("En az bir ürün satırı seçin.");
    const { error } = await state.db.rpc("post_document_v1", { payload: { header, items } });
    if (error) throw error;
    state.lines = [{ id: crypto.randomUUID(), product_id: "", cartons: 1, direct_expense: 0 }];
    event.currentTarget.reset();
    await loadCommercialData();
    renderProfit();
    renderClosing();
    const status = document.querySelector("#globalStatus");
    if (status) status.textContent = "Sipariş/fatura kaydedildi.";
  }

  function downloadPriceTemplate(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const rows = [
      ["Barkod", "Alış Fiyatı", "Alış Para Birimi", "Satış Fiyatı", "Satış Para Birimi", "KDV Oranı", "Koli İçi", "Minimum Stok", "Koli Kg", "Stok Birimi"],
      ["8690511000983", "10,50", "USD", "14,00", "USD", "20", "9", "0", "12,5", "adet"]
    ];
    const csv = "\uFEFF" + rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `sidya-fiyat-guncelleme-taslak-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function bind() {
    document.querySelector("#profitDocumentForm")?.addEventListener("submit", (event) => saveDocument(event).catch((error) => alert(error.message || error)));
    document.querySelector("#addProfitLineButton")?.addEventListener("click", () => { state.lines.push({ id: crypto.randomUUID(), product_id: "", cartons: 1, direct_expense: 0 }); renderProfit(); });
    document.addEventListener("input", (event) => { if (event.target.closest("#profitDocumentForm")) renderProfit(); });
    document.addEventListener("change", (event) => {
      const field = event.target.closest("[data-profit-field]");
      if (!field) return;
      const row = field.closest("[data-profit-line]");
      const line = state.lines.find((item) => item.id === row?.dataset.profitLine);
      if (!line) return;
      line[field.dataset.profitField] = field.dataset.profitField === "product_id" ? field.value : Number(field.value || 0);
      renderProfit();
    });
    document.addEventListener("click", (event) => {
      const remove = event.target.closest("[data-remove-profit-line]");
      if (remove) { state.lines = state.lines.filter((line) => line.id !== remove.dataset.removeProfitLine); if (!state.lines.length) state.lines = [{ id: crypto.randomUUID(), product_id: "", cartons: 1, direct_expense: 0 }]; renderProfit(); }
    });
    document.querySelector("#downloadPriceTemplateButton")?.addEventListener("click", downloadPriceTemplate, true);
  }

  async function init() {
    injectShell();
    bind();
    await loadCommercialData();
    renderProfit();
    renderClosing();
  }

  window.addEventListener("load", () => setTimeout(() => init().catch((error) => console.warn("Commercial runtime module", error)), 600));
})();
