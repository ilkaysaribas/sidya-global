(() => {
  "use strict";
  if (window.__sidyaEInvoiceReadiness) return;
  window.__sidyaEInvoiceReadiness = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const statusLabels = { draft: "Taslak", ready: "Hazır", blocked: "Kilitli", queued: "Kuyrukta", sent: "Gönderildi", failed: "Hatalı", cancelled: "İptal" };
  let client = null;
  let invoices = [];
  let customers = [];
  let drafts = [];
  let settings = null;

  function appReady() {
    const shell = $("#appShell");
    return Boolean(shell && !shell.hidden);
  }

  function getClient() {
    if (client) return client;
    if (window.__sidyaSupabaseClient) return window.__sidyaSupabaseClient;
    const cfg = window.SIDYA_BACKEND || {};
    const key = cfg.supabasePublishableKey || cfg.supabaseAnonKey;
    if (!window.supabase || !cfg.supabaseUrl || !key) return null;
    client = window.supabase.createClient(cfg.supabaseUrl, key, { auth: { storageKey: "sidya-admin-auth" } });
    window.__sidyaSupabaseClient = client;
    window.sidyaSupabaseClient = client;
    return client;
  }

  async function q(builder) {
    const result = await builder;
    if (result.error) throw result.error;
    return result.data;
  }

  function setGlobal(message, isError = false) {
    const el = $("#globalStatus");
    if (!el) return;
    el.hidden = false;
    el.textContent = message || "";
    el.style.color = isError ? "#b91c1c" : "#047857";
  }

  function setLocal(message, isError = false) {
    const el = $("#einvoiceStatus");
    if (!el) return;
    el.textContent = message || "";
    el.hidden = !message;
    el.className = `einvoice-status ${isError ? "is-error" : "is-ok"}`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function escapeXml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[ch]));
  }

  function money(value, currency = "TRY") {
    const amount = Number(value || 0);
    try {
      return new Intl.NumberFormat("tr-TR", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0);
    } catch (_error) {
      return `${currency} ${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`;
    }
  }

  function installStyles() {
    if ($("#sidyaEInvoiceStyles")) return;
    const style = document.createElement("style");
    style.id = "sidyaEInvoiceStyles";
    style.textContent = `
      .view[data-view-panel="einvoice"]{direction:ltr;text-align:left;min-width:0}.einvoice-grid{display:grid;gap:16px}.einvoice-alert{border:1px solid #f59e0b;background:#fffbeb;color:#92400e;border-radius:10px;padding:12px}.einvoice-status{border-radius:10px;padding:10px 12px;margin:0 0 12px}.einvoice-status.is-ok{border:1px solid #99f6e4;background:#f0fdfa;color:#0f766e}.einvoice-status.is-error{border:1px solid #fecaca;background:#fff1f2;color:#b91c1c}.einvoice-form{display:grid;gap:12px}.einvoice-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.einvoice-form label{display:grid;gap:6px;font-weight:700;color:#1f2d3d}.einvoice-form input,.einvoice-form select,.einvoice-form textarea{width:100%;min-width:0;border:1px solid #d8e1ec;border-radius:8px;padding:10px;background:#fff}.einvoice-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.einvoice-table table{min-width:1050px;border-collapse:collapse}.einvoice-table th,.einvoice-table td{border:1px solid #d8e1ec;padding:8px 9px;vertical-align:top}.einvoice-table th{background:#f1f5f9}.einvoice-muted{color:#64748b;font-size:12px}.einvoice-badge{display:inline-flex;align-items:center;border:1px solid #d8e1ec;border-radius:999px;padding:4px 8px;background:#f8fafc;font-size:12px}.einvoice-badge.blocked{border-color:#fecaca;background:#fff1f2;color:#b91c1c}.einvoice-badge.ready{border-color:#99f6e4;background:#f0fdfa;color:#0f766e}.einvoice-xml-preview{white-space:pre-wrap;max-height:360px;overflow:auto;background:#0f172a;color:#e2e8f0;border-radius:10px;padding:12px;font-family:ui-monospace,Consolas,monospace;font-size:12px}.einvoice-panel-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.einvoice-panel-head h2{margin:0}@media(max-width:980px){.einvoice-form-grid{grid-template-columns:1fr}.einvoice-panel-head{display:grid}.einvoice-actions button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function installView() {
    const nav = $("#mainNav");
    if (nav && !$('[data-view="einvoice"]', nav)) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.view = "einvoice";
      button.textContent = "e-Fatura Hazırlık";
      nav.appendChild(button);
    }

    const main = $(".main");
    if (!main || $('[data-view-panel="einvoice"]')) return;
    const section = document.createElement("section");
    section.className = "view";
    section.dataset.viewPanel = "einvoice";
    section.innerHTML = `
      <div class="einvoice-grid">
        <div class="einvoice-alert"><strong>Resmi gönderim kilidi aktif.</strong> Bu modül bugün fatura kesmez; sadece e-Fatura hazırlığı, UBL taslağı ve entegrasyon ayarlarını yönetir. Resmi gönderim için GİB/özel entegratör test onayı ve Mali Mühür süreçleri tamamlanmadan gönderim kapalı kalır.</div>
        <p id="einvoiceStatus" class="einvoice-status" hidden></p>
        <article class="panel">
          <div class="einvoice-panel-head"><div><p class="eyebrow">RESMİ E-FATURA HAZIRLIK</p><h2>Entegrasyon ayarları</h2><p class="helper">GİB e-Fatura Portal, doğrudan entegrasyon veya özel entegratör modeline geçiş için gerekli alanları hazırlar. Parola/sertifika dosyası bu ekranda saklanmaz; sadece güvenli secret referansı tutulur.</p></div><button type="button" id="einvoiceReloadButton">Yenile</button></div>
          <form id="einvoiceSettingsForm" class="einvoice-form">
            <div class="einvoice-form-grid">
              <label>Ortam<select name="environment"><option value="test">Test</option><option value="production">Resmi/Production</option></select></label>
              <label>Yöntem<select name="provider_type"><option value="private_integrator">Özel entegratör</option><option value="gib_direct">GİB doğrudan entegrasyon</option><option value="portal_reference">GİB portal referansı</option></select></label>
              <label>Durum<select name="integration_status"><option value="draft">Taslak</option><option value="configured">Yapılandırıldı</option><option value="verified">Test onaylı</option><option value="blocked">Kilitli</option></select></label>
              <label>Şirket unvanı<input name="company_title" autocomplete="organization" /></label>
              <label>VKN/TCKN<input name="company_tax_number" inputmode="numeric" /></label>
              <label>Vergi dairesi<input name="company_tax_office" /></label>
              <label class="full">Şirket adresi<textarea name="company_address" rows="3"></textarea></label>
              <label>Gönderici birim alias<input name="sender_unit_alias" placeholder="urn:mail:..." /></label>
              <label>Posta kutusu alias<input name="postbox_alias" placeholder="urn:mail:..." /></label>
              <label>Entegratör endpoint<input name="endpoint_url" placeholder="https://..." /></label>
              <label>Entegratör kullanıcı<input name="integrator_username" /></label>
              <label>Secret referansı<input name="secret_reference" placeholder="Vercel env / kasa adı" /></label>
              <label>Sertifika/Mali Mühür alias<input name="certificate_alias" /></label>
              <label>XSLT profil id<input name="xslt_profile_id" /></label>
              <label>Resmi gönderim<select name="send_enabled"><option value="false">Kapalı</option><option value="true">Açık</option></select></label>
              <label class="full">Not<textarea name="notes" rows="3"></textarea></label>
            </div>
            <div class="einvoice-actions"><button class="primary" type="submit">Ayarları kaydet</button><button type="button" id="einvoiceLockSendButton">Resmi gönderim kilidini kontrol et</button></div>
          </form>
        </article>
        <article class="panel">
          <div class="einvoice-panel-head"><div><p class="eyebrow">FATURA KAYITLARI</p><h2>UBL taslağı oluştur</h2><p class="helper">Mevcut fatura kayıtlarından GİB gönderimi olmayan hazırlık taslağı üretir. Stok, cari veya fatura kaydını değiştirmez.</p></div></div>
          <div class="table-wrap einvoice-table"><table><thead><tr><th>Fatura</th><th>Cari</th><th>Tarih</th><th>Senaryo</th><th>Tutar</th><th>İşlem</th></tr></thead><tbody id="einvoiceInvoiceRows"></tbody></table></div>
        </article>
        <article class="panel">
          <div class="einvoice-panel-head"><div><p class="eyebrow">E-FATURA TASLAKLARI</p><h2>UBL ve gönderim durumu</h2></div></div>
          <div class="table-wrap einvoice-table"><table><thead><tr><th>Taslak no</th><th>Durum</th><th>Fatura</th><th>Uyarı</th><th>Oluşturma</th><th>İşlem</th></tr></thead><tbody id="einvoiceDraftRows"></tbody></table></div>
          <pre id="einvoiceXmlPreview" class="einvoice-xml-preview" hidden></pre>
        </article>
      </div>`;
    main.appendChild(section);
  }

  function customerName(id) {
    const c = customers.find((item) => String(item.id) === String(id));
    return c?.company || c?.company_name || c?.contact_name || c?.email || "-";
  }

  function fillSettingsForm() {
    const form = $("#einvoiceSettingsForm");
    if (!form || !settings) return;
    Object.entries(settings).forEach(([key, value]) => {
      if (!form.elements[key]) return;
      form.elements[key].value = value == null ? "" : String(value);
    });
    if (form.elements.send_enabled) form.elements.send_enabled.value = String(Boolean(settings.send_enabled));
  }

  function renderInvoices() {
    const body = $("#einvoiceInvoiceRows");
    if (!body) return;
    if (!invoices.length) {
      body.innerHTML = '<tr><td colspan="6" class="einvoice-muted">Kayıtlı fatura bulunamadı.</td></tr>';
      return;
    }
    body.innerHTML = invoices.map((invoice) => {
      const no = invoice.invoice_no || invoice.document_number || invoice.id?.slice(0, 8) || "-";
      const date = invoice.invoice_date || invoice.created_at || "";
      const scenario = invoice.scenario || invoice.invoice_type || "-";
      const total = money(invoice.grand_total || invoice.total || 0, invoice.currency || "TRY");
      return `<tr><td><strong>${escapeHtml(no)}</strong><div class="einvoice-muted">${escapeHtml(invoice.status || "kayıtlı")}</div></td><td>${escapeHtml(customerName(invoice.customer_id))}</td><td>${escapeHtml(String(date).slice(0, 10))}</td><td>${escapeHtml(scenario)}</td><td>${escapeHtml(total)}</td><td><button type="button" data-einvoice-draft="${escapeHtml(invoice.id)}">Taslak UBL oluştur</button></td></tr>`;
    }).join("");
  }

  function renderDrafts() {
    const body = $("#einvoiceDraftRows");
    if (!body) return;
    if (!drafts.length) {
      body.innerHTML = '<tr><td colspan="6" class="einvoice-muted">Henüz e-fatura taslağı yok.</td></tr>';
      return;
    }
    body.innerHTML = drafts.map((draft) => {
      const badgeClass = draft.status === "blocked" ? "blocked" : draft.status === "ready" ? "ready" : "";
      const warnings = Array.isArray(draft.validation_warnings) ? draft.validation_warnings.join("; ") : (draft.send_block_reason || "-");
      return `<tr><td><strong>${escapeHtml(draft.draft_no)}</strong></td><td><span class="einvoice-badge ${badgeClass}">${escapeHtml(statusLabels[draft.status] || draft.status)}</span></td><td>${escapeHtml(draft.invoice_id || "-")}</td><td>${escapeHtml(warnings || "-")}</td><td>${escapeHtml(String(draft.created_at || "").slice(0, 16).replace("T", " "))}</td><td class="einvoice-actions"><button type="button" data-einvoice-preview="${escapeHtml(draft.id)}">Önizle</button><button type="button" data-einvoice-download="${escapeHtml(draft.id)}">UBL indir</button><button type="button" data-einvoice-ready="${escapeHtml(draft.id)}">Hazır işaretle</button><button type="button" class="danger" data-einvoice-send="${escapeHtml(draft.id)}">Resmi gönder</button></td></tr>`;
    }).join("");
  }

  async function loadData() {
    const db = getClient();
    if (!db) throw new Error("Supabase bağlantısı hazır değil.");
    const [settingsRows, invoiceRows, customerRows, draftRows] = await Promise.all([
      q(db.from("einvoice_settings").select("*").eq("id", "main").limit(1)),
      q(db.from("invoices").select("*").order("created_at", { ascending: false }).limit(100)),
      q(db.from("customers").select("id,company,company_name,contact_name,email,tax_number,tax_office,country").limit(1000)),
      q(db.from("einvoice_drafts").select("*").order("created_at", { ascending: false }).limit(100)),
    ]);
    settings = settingsRows?.[0] || { id: "main", environment: "test", provider_type: "private_integrator", integration_status: "draft", send_enabled: false };
    invoices = invoiceRows || [];
    customers = customerRows || [];
    drafts = draftRows || [];
    fillSettingsForm();
    renderInvoices();
    renderDrafts();
  }

  function validateSettingsForSend() {
    const missing = [];
    if (!settings?.company_title) missing.push("şirket unvanı");
    if (!settings?.company_tax_number) missing.push("VKN/TCKN");
    if (!settings?.sender_unit_alias) missing.push("gönderici birim alias");
    if (!settings?.postbox_alias) missing.push("posta kutusu alias");
    if (!settings?.endpoint_url && settings?.provider_type !== "portal_reference") missing.push("entegratör endpoint");
    if (!settings?.secret_reference && settings?.provider_type !== "portal_reference") missing.push("secret referansı");
    if (settings?.integration_status !== "verified") missing.push("test onayı");
    if (!settings?.send_enabled) missing.push("resmi gönderim kilidi");
    return missing;
  }

  async function saveSettings(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.id = "main";
    payload.send_enabled = payload.send_enabled === "true";
    const db = getClient();
    await q(db.from("einvoice_settings").upsert(payload, { onConflict: "id" }).select().single());
    setLocal("e-Fatura entegrasyon ayarları kaydedildi.");
    await loadData();
  }

  function buildUbl(invoice, items) {
    const customer = customers.find((item) => String(item.id) === String(invoice.customer_id)) || {};
    const no = invoice.invoice_no || invoice.document_number || `SIDYA-${String(invoice.id || Date.now()).slice(0, 8)}`;
    const issueDate = String(invoice.invoice_date || new Date().toISOString()).slice(0, 10);
    const currency = invoice.currency || "TRY";
    const lines = (items || []).map((item, index) => {
      const name = item.product_name || item.name || item.description || `Kalem ${index + 1}`;
      const qty = Number(item.quantity || item.qty || 1) || 1;
      const price = Number(item.unit_price || item.price || 0) || 0;
      const total = Number(item.line_total || item.total || qty * price) || 0;
      return `    <cac:InvoiceLine>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="NIU">${qty}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${escapeXml(currency)}">${total.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:Item><cbc:Name>${escapeXml(name)}</cbc:Name></cac:Item>
      <cac:Price><cbc:PriceAmount currencyID="${escapeXml(currency)}">${price.toFixed(2)}</cbc:PriceAmount></cac:Price>
    </cac:InvoiceLine>`;
    }).join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Sidya Global e-Fatura hazırlık taslağıdır. Mali Mühür ile imzalanmamış ve GİB'e gönderilmemiştir. -->
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>TR1.2</cbc:CustomizationID>
  <cbc:ProfileID>${escapeXml(invoice.scenario || "TICARIFATURA")}</cbc:ProfileID>
  <cbc:ID>${escapeXml(no)}</cbc:ID>
  <cbc:IssueDate>${escapeXml(issueDate)}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>${escapeXml(invoice.invoice_type === "return" ? "IADE" : "SATIS")}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${escapeXml(currency)}</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${escapeXml(settings?.company_title || "Sidya Global")}</cbc:Name></cac:PartyName>
      <cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>${escapeXml(settings?.company_tax_office || "")}</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${escapeXml(customer.company || customer.company_name || customer.contact_name || "")}</cbc:Name></cac:PartyName>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${escapeXml(currency)}">${Number(invoice.subtotal || 0).toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="${escapeXml(currency)}">${Number(invoice.grand_total || invoice.total || 0).toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${escapeXml(currency)}">${Number(invoice.grand_total || invoice.total || 0).toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${lines}
</Invoice>`;
  }

  async function createDraft(invoiceId) {
    const db = getClient();
    const invoice = invoices.find((item) => String(item.id) === String(invoiceId));
    if (!invoice) throw new Error("Fatura kaydı bulunamadı.");
    let items = [];
    try { items = await q(db.from("invoice_items").select("*").eq("invoice_id", invoiceId)); } catch (_error) { items = []; }
    const no = invoice.invoice_no || invoice.document_number || `SIDYA-${String(invoice.id).slice(0, 8)}`;
    const warnings = [];
    if (!settings?.company_tax_number) warnings.push("Şirket VKN/TCKN eksik.");
    if (!invoice.customer_id) warnings.push("Cari bilgisi eksik.");
    if (!items.length) warnings.push("Fatura satırı bulunamadı; UBL taslağı kontrol edilmeli.");
    const ubl = buildUbl(invoice, items);
    const payload = {
      invoice_id: invoice.id,
      draft_no: no,
      scenario: invoice.scenario || "commercial",
      invoice_type: invoice.invoice_type || "sale",
      status: warnings.length ? "blocked" : "draft",
      currency: invoice.currency || "TRY",
      issue_date: invoice.invoice_date || null,
      customer_id: invoice.customer_id || null,
      ubl_xml: ubl,
      validation_warnings: warnings,
      send_block_reason: warnings.length ? warnings.join(" ") : "Resmi gönderim kilidi açık değil.",
    };
    await q(db.from("einvoice_drafts").upsert(payload, { onConflict: "invoice_id" }).select().single());
    setLocal("UBL taslağı oluşturuldu. Bu kayıt resmi olarak gönderilmedi.");
    await loadData();
  }

  async function markReady(draftId) {
    const db = getClient();
    const draft = drafts.find((item) => String(item.id) === String(draftId));
    if (!draft) throw new Error("Taslak bulunamadı.");
    const missing = validateSettingsForSend().filter((item) => item !== "resmi gönderim kilidi");
    const payload = missing.length
      ? { status: "blocked", send_block_reason: `Gönderime hazır değil: ${missing.join(", ")}.` }
      : { status: "ready", send_block_reason: "Resmi gönderim ayrıca onay gerektirir." };
    await q(db.from("einvoice_drafts").update(payload).eq("id", draftId).select().single());
    await q(db.from("einvoice_events").insert({ draft_id: draftId, event_type: payload.status === "ready" ? "marked_ready" : "blocked", message: payload.send_block_reason }));
    setLocal(payload.status === "ready" ? "Taslak gönderime hazır işaretlendi; resmi gönderim kilidi ayrıca kontrol edilir." : payload.send_block_reason, payload.status !== "ready");
    await loadData();
  }

  async function officialSend(draftId) {
    const db = getClient();
    const missing = validateSettingsForSend();
    const reason = missing.length
      ? `Resmi gönderim kilitli. Eksik: ${missing.join(", ")}.`
      : "Backend GİB/özel entegratör gönderim adaptörü henüz bağlanmadı; bu modül hazırlık ve UBL üretimi için aktiftir.";
    await q(db.from("einvoice_drafts").update({ status: "blocked", send_block_reason: reason }).eq("id", draftId).select().single());
    await q(db.from("einvoice_events").insert({ draft_id: draftId, event_type: "official_send_blocked", message: reason }));
    setLocal(reason, true);
    await loadData();
  }

  function previewDraft(draftId) {
    const draft = drafts.find((item) => String(item.id) === String(draftId));
    const pre = $("#einvoiceXmlPreview");
    if (!draft || !pre) return;
    pre.hidden = false;
    pre.textContent = draft.ubl_xml || "UBL içeriği bulunamadı.";
    pre.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function downloadDraft(draftId) {
    const draft = drafts.find((item) => String(item.id) === String(draftId));
    if (!draft) return;
    const blob = new Blob([draft.ubl_xml || ""], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${draft.draft_no || "e-fatura-taslak"}.xml`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleClick(event) {
    const draftButton = event.target.closest("[data-einvoice-draft]");
    const previewButton = event.target.closest("[data-einvoice-preview]");
    const downloadButton = event.target.closest("[data-einvoice-download]");
    const readyButton = event.target.closest("[data-einvoice-ready]");
    const sendButton = event.target.closest("[data-einvoice-send]");
    const reloadButton = event.target.closest("#einvoiceReloadButton");
    const lockButton = event.target.closest("#einvoiceLockSendButton");
    if (!draftButton && !previewButton && !downloadButton && !readyButton && !sendButton && !reloadButton && !lockButton) return;
    event.preventDefault();
    try {
      if (draftButton) await createDraft(draftButton.dataset.einvoiceDraft);
      if (previewButton) previewDraft(previewButton.dataset.einvoicePreview);
      if (downloadButton) downloadDraft(downloadButton.dataset.einvoiceDownload);
      if (readyButton) await markReady(readyButton.dataset.einvoiceReady);
      if (sendButton) await officialSend(sendButton.dataset.einvoiceSend);
      if (reloadButton) { await loadData(); setLocal("e-Fatura hazırlık verileri yenilendi."); }
      if (lockButton) {
        const missing = validateSettingsForSend();
        setLocal(missing.length ? `Resmi gönderim kapalı. Eksik: ${missing.join(", ")}.` : "Resmi gönderim kilidi açılabilir durumda; backend gönderim adaptörü ayrıca bağlanmalı.", Boolean(missing.length));
      }
    } catch (error) {
      console.error("e-Fatura hazırlık işlemi başarısız", error);
      setLocal(error.message || "e-Fatura işlemi tamamlanamadı.", true);
    }
  }

  async function boot() {
    if (!appReady()) return;
    installStyles();
    installView();
    const form = $("#einvoiceSettingsForm");
    if (form && !form.dataset.bound) {
      form.dataset.bound = "1";
      form.addEventListener("submit", saveSettings);
    }
    document.removeEventListener("click", handleClick, true);
    document.addEventListener("click", handleClick, true);
    try {
      await loadData();
    } catch (error) {
      console.warn("e-Fatura tabloları hazır değil", error);
      setLocal("e-Fatura tabloları henüz kurulmamış. /api/mail-crm-migration?run=sidya-mail-crm-run-20260706&scope=einvoice endpoint'i veya supabase/e-invoice-readiness.sql çalıştırılmalı.", true);
    }
  }

  const timer = setInterval(() => {
    if (appReady()) boot();
  }, 1200);
  document.addEventListener("DOMContentLoaded", boot);
  window.addEventListener("sidya:admin-ready", boot);
  setTimeout(() => clearInterval(timer), 60_000);
})();
