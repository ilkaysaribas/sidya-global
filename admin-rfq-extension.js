(function () {
  if (window.__sidyaAdminRfqExtension) return;
  window.__sidyaAdminRfqExtension = true;
  var statusLabels = {
    new: "Yeni Talep", under_review: "İnceleniyor", missing_information: "Eksik Bilgi", supplier_price_requested: "Tedarikçi Fiyatı Bekleniyor", pricing_completed: "Fiyatlandırma Tamamlandı", quote_prepared: "Teklif Hazırlandı", quote_sent: "Teklif Gönderildi", customer_review: "Müşteri İncelemesinde", negotiation: "Pazarlık", accepted: "Kabul Edildi", rejected: "Reddedildi", expired: "Süresi Doldu", converted_to_proforma: "Proformaya Dönüştürüldü", converted_to_order: "Siparişe Dönüştürüldü", cancelled: "İptal Edildi"
  };
  var state = { rfqs: [], detail: null };
  function esc(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[c]; }); }
  function money(value, currency) { return new Intl.NumberFormat("tr-TR", { style: "currency", currency: currency || "USD", maximumFractionDigits: 4 }).format(Number(value || 0)); }
  function date(value) { return value ? new Date(value).toLocaleString("tr-TR") : "-"; }
  function totalsText(rfq) { var totals = rfq.exchange_rate_snapshot && rfq.exchange_rate_snapshot.totals_by_currency || {}; return Object.keys(totals).map(function (code) { return money(totals[code], code); }).join(" · ") || "-"; }
  function inject() {
    var nav = document.getElementById("mainNav");
    var main = document.querySelector(".main");
    if (!nav || !main || document.querySelector('[data-view="rfq"]')) return;
    var button = document.createElement("button");
    button.setAttribute("data-view", "rfq");
    button.innerHTML = 'Teklif Talepleri / RFQ <span class="nav-count" id="rfqNewCount">0</span>';
    nav.insertBefore(button, nav.querySelector('[data-view="customers"]'));
    var section = document.createElement("section");
    section.className = "view";
    section.setAttribute("data-view-panel", "rfq");
    section.innerHTML = '<div class="panel"><div class="panel-heading"><div><p class="eyebrow">RFQ</p><h2>Teklif Talepleri</h2></div><button class="primary" id="refreshRfqButton">Yenile</button></div><div class="table-tools"><input class="search" id="rfqSearch" type="search" placeholder="RFQ no, firma, ülke, ürün veya durum ara" /><select id="rfqStatusFilter"><option value="">Tüm durumlar</option>' + Object.keys(statusLabels).map(function (key) { return '<option value="' + key + '">' + statusLabels[key] + '</option>'; }).join('') + '</select></div><div class="table-wrap"><table><thead><tr><th>RFQ no</th><th>Tarih</th><th>Şirket</th><th>Yetkili</th><th>Ülke</th><th>Ürün</th><th>Koli</th><th>Para birimleri</th><th>Hedef toplam</th><th>Teslim</th><th>Acil</th><th>Durum</th><th>Aksiyonlar</th></tr></thead><tbody id="rfqRows"></tbody></table></div></div><dialog id="rfqDetailDialog" class="wide-dialog"><div class="dialog-form"><div class="dialog-heading"><div><p class="eyebrow">RFQ DETAY</p><h2 id="rfqDetailTitle">RFQ</h2><p class="helper" id="rfqDetailMeta"></p></div><button type="button" data-rfq-close>×</button></div><div id="rfqDetailBody"></div><div class="dialog-actions"><button type="button" data-rfq-close>Kapat</button><button type="button" id="rfqConvertProforma" class="primary">Proformaya dönüştür</button></div></div></dialog>';
    main.appendChild(section);
    bindNav(button);
    bindEvents();
    ensureStyle();
    loadRfqs();
  }
  function ensureStyle() {
    if (document.getElementById("adminRfqStyle")) return;
    var style = document.createElement("style");
    style.id = "adminRfqStyle";
    style.textContent = ".rfq-urgent{color:#b42318;font-weight:900}.rfq-status-new{background:#fff4df;color:#9a5b00}.rfq-status-converted_to_proforma,.rfq-status-accepted{background:#e8f7f3;color:#087462}.rfq-status-rejected,.rfq-status-cancelled{background:#feeceb;color:#b42318}.rfq-detail-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}.rfq-detail-grid article{padding:12px;border:1px solid var(--line);border-radius:10px;background:#f8fafb}.rfq-detail-grid span{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;font-weight:800}.rfq-profit-ok{color:#087462;font-weight:900}.rfq-profit-warn{color:#b54708;font-weight:900}.rfq-profit-bad{color:#b42318;font-weight:900}@media(max-width:900px){.rfq-detail-grid{grid-template-columns:1fr}}";
    document.head.appendChild(style);
  }
  function bindNav(button) {
    button.addEventListener("click", function () {
      document.querySelectorAll("#mainNav button").forEach(function (b) { b.classList.toggle("active", b === button); });
      document.querySelectorAll("[data-view-panel]").forEach(function (panel) { panel.classList.toggle("active", panel.getAttribute("data-view-panel") === "rfq"); });
      var title = document.getElementById("pageTitle"); if (title) title.textContent = "Teklif Talepleri / RFQ";
      loadRfqs();
    });
  }
  function bindEvents() {
    document.addEventListener("click", function (event) {
      var id = event.target.getAttribute("data-rfq-detail");
      if (id) openDetail(id);
      if (event.target.matches("[data-rfq-close]")) document.getElementById("rfqDetailDialog")?.close();
    });
    document.getElementById("refreshRfqButton")?.addEventListener("click", loadRfqs);
    document.getElementById("rfqSearch")?.addEventListener("input", renderRows);
    document.getElementById("rfqStatusFilter")?.addEventListener("change", renderRows);
    document.getElementById("rfqConvertProforma")?.addEventListener("click", convertCurrent);
  }
  async function loadRfqs() {
    try {
      var response = await fetch("/api/admin/rfq?limit=200", { cache: "no-store" });
      var data = await response.json();
      if (!response.ok) throw new Error(data.error || "RFQ listesi alınamadı");
      state.rfqs = data.rfqs || [];
      renderRows();
    } catch (error) {
      var rows = document.getElementById("rfqRows");
      if (rows) rows.innerHTML = '<tr><td colspan="13" class="empty">' + esc(error.message) + '<br><small>Supabase migration için supabase/rfq.sql çalıştırılmalı.</small></td></tr>';
    }
  }
  function renderRows() {
    var rows = document.getElementById("rfqRows");
    if (!rows) return;
    var term = (document.getElementById("rfqSearch")?.value || "").toLocaleLowerCase("tr");
    var filter = document.getElementById("rfqStatusFilter")?.value || "";
    var list = state.rfqs.filter(function (rfq) {
      if (filter && rfq.status !== filter) return false;
      return [rfq.rfq_number, rfq.company_name, rfq.contact_name, rfq.country_name, rfq.status, totalsText(rfq)].join(" ").toLocaleLowerCase("tr").includes(term);
    });
    var newCount = state.rfqs.filter(function (rfq) { return rfq.status === "new"; }).length;
    var count = document.getElementById("rfqNewCount"); if (count) count.textContent = newCount;
    rows.innerHTML = list.length ? list.map(function (rfq) {
      var snapshot = rfq.exchange_rate_snapshot || {};
      return '<tr><td><strong>' + esc(rfq.rfq_number) + '</strong></td><td>' + date(rfq.created_at) + '</td><td>' + esc(rfq.company_name || '-') + '</td><td>' + esc(rfq.contact_name || '-') + '</td><td>' + esc(rfq.country_name || '-') + '</td><td>' + esc(snapshot.item_count || '-') + '</td><td>' + esc(rfq.total_cartons || 0) + '</td><td>' + esc(Object.keys(snapshot.totals_by_currency || {}).join(', ') || '-') + '</td><td>' + esc(totalsText(rfq)) + '</td><td>' + esc(rfq.incoterm || rfq.shipping_method || '-') + '</td><td>' + (rfq.urgent ? '<span class="rfq-urgent">Acil</span>' : '-') + '</td><td><span class="badge rfq-status-' + esc(rfq.status) + '">' + esc(statusLabels[rfq.status] || rfq.status) + '</span></td><td><button data-rfq-detail="' + esc(rfq.id) + '">Detay</button></td></tr>';
    }).join("") : '<tr><td colspan="13" class="empty">RFQ bulunamadı.</td></tr>';
  }
  async function openDetail(id) {
    var response = await fetch('/api/admin/rfq/' + encodeURIComponent(id), { cache: 'no-store' });
    var data = await response.json();
    if (!response.ok) { alert(data.error || 'RFQ açılamadı'); return; }
    state.detail = data;
    var rfq = data.rfq;
    document.getElementById("rfqDetailTitle").textContent = rfq.rfq_number || "RFQ";
    document.getElementById("rfqDetailMeta").textContent = [rfq.company_name, rfq.contact_name, rfq.email, rfq.phone].filter(Boolean).join(" · ");
    document.getElementById("rfqDetailBody").innerHTML = renderDetail(data);
    document.getElementById("rfqDetailDialog").showModal();
  }
  function marginClass(item) {
    var cost = Number(item.product_cost || 0);
    var target = Number(item.target_unit_price || 0);
    if (cost && target < cost) return ['rfq-profit-bad', 'Müşterinin hedef fiyatı mevcut maliyetin altındadır.'];
    if (cost && target && ((target - cost) / target * 100) < 10) return ['rfq-profit-warn', 'Talep edilen fiyat minimum kâr marjının altındadır.'];
    return ['rfq-profit-ok', 'Hedef fiyat ticari değerlendirme için uygundur.'];
  }
  function renderDetail(data) {
    var rfq = data.rfq;
    var items = data.items || [];
    return '<div class="rfq-detail-grid"><article><span>Müşteri</span><strong>' + esc(rfq.company_name || '-') + '</strong><p>' + esc(rfq.contact_name || '-') + '<br>' + esc(rfq.email || '-') + '</p></article><article><span>Sevkiyat</span><strong>' + esc(rfq.destination_country || '-') + '</strong><p>' + esc(rfq.destination_city_or_port || '-') + '<br>' + esc(rfq.incoterm || '-') + ' / ' + esc(rfq.shipping_method || '-') + '</p></article><article><span>Toplam</span><strong>' + esc(rfq.total_cartons || 0) + ' koli</strong><p>' + totalsText(rfq) + '<br>Palet: ' + esc(rfq.estimated_pallets || 0) + ' · Kg: ' + esc(rfq.estimated_gross_weight_kg || 0) + '</p></article></div><div class="table-wrap"><table><thead><tr><th>Ürün</th><th>Barkod</th><th>Koli</th><th>Hedef fiyat</th><th>Toplam</th><th>TL karşılığı</th><th>Uyarı</th><th>Not</th></tr></thead><tbody>' + items.map(function (item) { var cls = marginClass(item); return '<tr><td><strong>' + esc(item.brand_snapshot || '') + ' ' + esc(item.product_name_snapshot || '') + '</strong><small>' + (item.missing_logistics_data ? 'Eksik lojistik veri' : '') + '</small></td><td>' + esc(item.barcode_snapshot || item.sku_snapshot || '-') + '</td><td>' + esc(item.requested_cartons) + '</td><td>' + money(item.target_unit_price, item.currency_code) + '</td><td>' + money(item.target_line_total, item.currency_code) + '</td><td>' + (item.target_line_total_try ? money(item.target_line_total_try, 'TRY') : '-') + '</td><td><span class="' + cls[0] + '">' + cls[1] + '</span>' + (item.below_minimum ? '<br><span class="rfq-profit-warn">Minimum altı özel değerlendirme</span>' : '') + '</td><td>' + esc(item.customer_note || '-') + '</td></tr>'; }).join('') + '</tbody></table></div><p class="helper">Tedarikçiye fiyat sor, teklif hazırla, müşteriye e-posta gönder, WhatsApp mesajı oluştur ve not/görev işlemleri bu RFQ kaydı üzerinden izlenir.</p>';
  }
  async function convertCurrent() {
    if (!state.detail?.rfq?.id) return;
    if (!confirm('Bu RFQ mevcut site proforma sipariş akışına aktarılacak. Devam edilsin mi?')) return;
    var response = await fetch('/api/admin/rfq/' + encodeURIComponent(state.detail.rfq.id) + '?action=convert-to-proforma', { method: 'POST' });
    var data = await response.json();
    if (!response.ok) { alert(data.error || 'Dönüştürülemedi'); return; }
    alert('Proforma taslağı oluşturuldu: ' + (data.orderNo || ''));
    document.getElementById("rfqDetailDialog")?.close();
    loadRfqs();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inject); else inject();
})();
