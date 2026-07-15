(() => {
  if (window.__sidyaMailCrmAdmin) return;
  window.__sidyaMailCrmAdmin = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const fmtDate = (value) => value ? new Date(value).toLocaleString("tr-TR") : "-";
  const isoDate = (value) => value ? new Date(value).toISOString().slice(0, 10) : "";
  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  let customers = [];
  let selectedCustomer = null;

  function setStatus(message, isError = false) {
    const el = $("#globalStatus");
    if (!el) return;
    el.textContent = message || "";
    el.style.color = isError ? "#b91c1c" : "#0f766e";
  }

  function setButtonLoading(button, isLoading, loadingText = "İşleniyor...") {
    if (!button) return;
    if (isLoading) {
      button.dataset.originalText = button.textContent || "";
      button.disabled = true;
      button.textContent = loadingText;
      return;
    }
    button.disabled = false;
    if (button.dataset.originalText) button.textContent = button.dataset.originalText;
  }

  function installStyles() {
    if ($("#sidyaMailCrmStyles")) return;
    const style = document.createElement("style");
    style.id = "sidyaMailCrmStyles";
    style.textContent = `
      .mail-crm-grid{display:grid;grid-template-columns:minmax(320px,420px) minmax(0,1fr);gap:18px;align-items:start;direction:ltr}.mail-crm-form{display:grid;gap:12px;direction:ltr;text-align:left}.mail-crm-form label{display:grid;gap:6px;font-weight:700;color:#1f2d3d;text-align:left}.mail-crm-form input,.mail-crm-form select,.mail-crm-form textarea{width:100%;min-width:0;border:1px solid #d8e1ec;border-radius:8px;padding:10px;background:#fff;text-align:left;direction:ltr}.mail-crm-form textarea{min-height:92px}.mail-crm-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.mail-crm-actions button[disabled]{opacity:.65;cursor:wait}.mail-crm-list{display:grid;gap:8px;max-height:620px;overflow:auto}.mail-crm-card{border:1px solid #d8e1ec;border-radius:8px;padding:12px;background:#fff;text-align:left;display:grid;gap:4px}.mail-crm-card:hover,.mail-crm-card.is-active{border-color:#137c96;background:#f0fbff}.mail-crm-card strong{font-size:14px}.mail-crm-card span{font-size:12px;color:#5d6b7a}.mail-crm-detail{display:grid;gap:14px;direction:ltr;text-align:left}.mail-crm-detail-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.mail-crm-badges{display:flex;gap:8px;flex-wrap:wrap}.mail-crm-badge{border:1px solid #d8e1ec;border-radius:999px;padding:5px 9px;background:#f8fafc;font-size:12px}.mail-crm-badge.due{border-color:#f59e0b;background:#fffbeb;color:#92400e}.mail-crm-interactions{display:grid;gap:8px;max-height:320px;overflow:auto}.mail-crm-interaction{border-left:3px solid #137c96;background:#f8fafc;padding:10px;border-radius:6px}.mail-crm-interaction small{color:#64748b}.mail-crm-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.mail-crm-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}.mail-crm-metrics article{border:1px solid #d8e1ec;border-radius:8px;background:#fff;padding:12px}.mail-crm-metrics span{display:block;color:#64748b;font-size:12px}.mail-crm-metrics strong{font-size:22px}.mail-crm-empty{padding:20px;border:1px dashed #cbd5e1;border-radius:8px;color:#64748b;background:#f8fafc}.mail-crm-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.mail-crm-toolbar input,.mail-crm-toolbar select{border:1px solid #d8e1ec;border-radius:8px;padding:10px;background:#fff}.mail-crm-toolbar input{min-width:260px}.mail-crm-warning{border:1px solid #fca5a5;background:#fff1f2;color:#991b1b;border-radius:8px;padding:12px;margin-bottom:12px}#mainNav [data-view='mail-center'],#mainNav [data-view='crm-center']{position:relative}@media(max-width:900px){.mail-crm-grid,.mail-crm-two{grid-template-columns:1fr}.mail-crm-metrics{grid-template-columns:1fr}.mail-crm-toolbar input{min-width:0;width:100%}}
    `;
    document.head.appendChild(style);
  }

  function getClient() {
    const cfg = window.SIDYA_BACKEND || {};
    const key = cfg.supabaseAnonKey || cfg.supabasePublishableKey;
    if (!window.supabase || !cfg.supabaseUrl || !key) return null;
    if (window.__sidyaSupabaseClient) return window.__sidyaSupabaseClient;
    if (window.sidyaSupabaseClient) {
      window.__sidyaSupabaseClient = window.sidyaSupabaseClient;
      return window.__sidyaSupabaseClient;
    }
    window.__sidyaSupabaseClient = window.supabase.createClient(cfg.supabaseUrl, key, { auth: { storageKey: "sidya-admin-auth" } });
    window.sidyaSupabaseClient = window.__sidyaSupabaseClient;
    return window.__sidyaSupabaseClient;
  }

  async function token() {
    const client = getClient();
    if (!client) throw new Error("Supabase bağlantısı bulunamadı.");
    const { data } = await client.auth.getSession();
    if (!data?.session?.access_token) throw new Error("Admin oturumu bulunamadı.");
    return data.session.access_token;
  }

  async function api(path, options = {}) {
    let response;
    try {
      response = await fetch(path, {
        ...options,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}`, ...(options.headers || {}) },
      });
    } catch (error) {
      console.error("CRM API network error", { path, message: error?.message || String(error) });
      throw new Error("Sunucuya ulaşılamadı. İnternet bağlantısını veya canlı API durumunu kontrol edin.");
    }

    const text = await response.text();
    let result = {};
    try {
      result = text ? JSON.parse(text) : {};
    } catch (error) {
      console.error("CRM API invalid JSON", { path, status: response.status, body: text.slice(0, 500), message: error?.message || String(error) });
      throw new Error("Sunucudan geçersiz yanıt geldi. İşlem sonucu okunamadı.");
    }

    if (!response.ok || result.ok === false || result.success === false) {
      const message = result.message || result.error || `İşlem başarısız. HTTP ${response.status}`;
      console.error("CRM API failed", { path, status: response.status, code: result.code || "", message, details: result.details || null });
      throw new Error(message);
    }
    return result;
  }

  function installNavAndViews() {
    const nav = $("#mainNav");
    const main = $(".main");
    if (!nav || !main) return;
    if (!$('[data-view="mail-center"]', nav)) nav.insertAdjacentHTML("beforeend", '<button data-view="mail-center">Mail Center</button>');
    if (!$('[data-view="crm-center"]', nav)) nav.insertAdjacentHTML("beforeend", '<button data-view="crm-center">CRM <span class="nav-count" id="crmFollowCount">0</span></button>');
    if (!$('[data-view-panel="mail-center"]', main)) main.insertAdjacentHTML("beforeend", mailCenterView());
    if (!$('[data-view-panel="crm-center"]', main)) main.insertAdjacentHTML("beforeend", crmView());
  }

  function mailCenterView() {
    return `<section class="view" data-view-panel="mail-center"><div class="panel"><div class="panel-heading"><div><p class="eyebrow">MAIL CENTER</p><h2>SMTP ayarları</h2></div></div><p class="helper">Tüm müşteri mailleri export@sidyaglobal.com üzerinden gönderilir. SMTP şifresi kaydedilir ama geri gösterilmez.</p><form class="mail-crm-form" id="mailSettingsForm"><div class="mail-crm-two"><label>SMTP host<input name="smtp_host" placeholder="smtp.mx.cloudflare.net" /></label><label>SMTP port<input name="smtp_port" type="number" value="465" /></label><label>SMTP secure<select name="smtp_secure"><option value="true">SSL / 465</option><option value="false">STARTTLS / 587</option></select></label><label>SMTP user<input name="smtp_user" autocomplete="username" placeholder="api_token" /></label><label>SMTP password<input name="smtp_password" type="password" autocomplete="new-password" placeholder="Kayıtlıysa boş bırak" /></label><label>Gönderen adı<input name="sender_name" value="Sidya Global Export Department" readonly /></label><label>Gönderen e-posta<input name="sender_email" type="email" value="export@sidyaglobal.com" readonly /></label><label>Test mail alıcısı<input name="test_to" type="email" value="export@sidyaglobal.com" /></label></div><div class="mail-crm-actions"><button class="primary" type="submit">Ayarları kaydet</button><button type="button" id="sendTestMailButton">Test mail gönder</button><span id="mailSettingsStatus" class="helper"></span></div></form></div></section>`;
  }

  function crmView() {
    return `<section class="view" data-view-panel="crm-center"><div class="mail-crm-metrics"><article><span>Toplam müşteri</span><strong id="crmMetricTotal">0</strong></article><article><span>Bekleyen follow-up</span><strong id="crmMetricDue">0</strong></article><article><span>Bugün iletişim</span><strong id="crmMetricToday">0</strong></article></div><div id="crmSchemaWarning" class="mail-crm-warning" hidden>Mail Center / CRM tabloları henüz kurulmamış. <code>/api/mail-crm-migration?run=sidya-mail-crm-run-20260706</code> endpoint'i veya <code>supabase/mail-center-crm.sql</code> çalıştırılmalı.</div><div class="mail-crm-grid"><div class="panel"><div class="panel-heading"><div><p class="eyebrow">CRM</p><h2>Müşteriler</h2></div><button class="primary" id="crmRefreshButton">Yenile</button></div><div class="mail-crm-toolbar"><input id="crmSearch" type="search" placeholder="Firma, kişi, e-posta veya ülke ara" /><select id="crmStatusFilter"><option value="">Tüm durumlar</option><option value="lead">Lead</option><option value="follow_up_1">Follow-up 1</option><option value="follow_up_2">Follow-up 2</option><option value="final_follow_up">Final follow-up</option><option value="quoted">Teklif gönderildi</option><option value="won">Kazanıldı</option><option value="lost">Kaybedildi</option></select></div><div class="mail-crm-list" id="crmCustomerList"></div></div><div class="panel mail-crm-detail" id="crmDetail"><div class="mail-crm-empty">Bir müşteri seçin; mail geçmişi, notlar ve teklif gönderme alanı burada açılacak.</div></div></div></section>`;
  }

  async function loadMailSettings() {
    const form = $("#mailSettingsForm");
    const status = $("#mailSettingsStatus");
    if (!form) return;
    try {
      const result = await api("/api/backend-config?mailCrm=mail-settings");
      const s = result.settings || {};
      form.elements.smtp_host.value = s.smtp_host || "smtp.mx.cloudflare.net";
      form.elements.smtp_port.value = s.smtp_port || 465;
      form.elements.smtp_secure.value = String(Boolean(s.smtp_secure || Number(s.smtp_port) === 465));
      form.elements.smtp_user.value = s.smtp_user || "api_token";
      form.elements.sender_name.value = "Sidya Global Export Department";
      form.elements.sender_email.value = "export@sidyaglobal.com";
      form.elements.smtp_password.value = "";
      form.elements.smtp_password.placeholder = s.hasPassword ? "Şifre kayıtlı, değiştirmeyeceksen boş bırak" : "SMTP şifresi";
      if (status) status.textContent = s.hasPassword ? "Kaydedilmiş SMTP parolası mevcut." : "SMTP parolası henüz kayıtlı değil.";
    } catch (error) {
      if (status) status.textContent = error.message;
      console.error("Mail settings load failed", error);
    }
  }

  async function saveMailSettings(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = event.submitter || form.querySelector('button[type="submit"]');
    const status = $("#mailSettingsStatus");
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.smtp_secure = payload.smtp_secure === "true";
    try {
      setButtonLoading(button, true, "Kaydediliyor...");
      if (status) status.textContent = "Ayarlar kaydediliyor...";
      await api("/api/backend-config?mailCrm=mail-settings", { method: "POST", body: JSON.stringify(payload) });
      if (status) status.textContent = "Ayarlar kaydedildi.";
      form.elements.smtp_password.value = "";
      await loadMailSettings();
    } catch (error) {
      if (status) status.textContent = error.message;
      console.error("Mail settings save failed", error);
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function sendTestMail(event) {
    const button = event?.currentTarget || $("#sendTestMailButton");
    const form = $("#mailSettingsForm");
    const status = $("#mailSettingsStatus");
    const to = form?.elements.test_to?.value || "export@sidyaglobal.com";
    try {
      setButtonLoading(button, true, "Test mail gönderiliyor...");
      if (status) status.textContent = "Test mail gönderiliyor...";
      await api("/api/backend-config?mailCrm=send-mail", { method: "POST", body: JSON.stringify({ to, source: "test", test: true }) });
      if (status) status.textContent = "Test e-postası gönderildi. Gelen kutusu ve spam klasörünü kontrol edin.";
    } catch (error) {
      if (status) status.textContent = error.message;
      console.error("Test mail failed", error);
    } finally {
      setButtonLoading(button, false);
    }
  }

  function renderMetrics() {
    const now = new Date();
    const due = customers.filter((c) => c.next_follow_up_at && new Date(c.next_follow_up_at) <= now).length;
    const todayCount = customers.filter((c) => String(c.last_contact_at || "").slice(0, 10) === today()).length;
    $("#crmMetricTotal") && ($("#crmMetricTotal").textContent = customers.length);
    $("#crmMetricDue") && ($("#crmMetricDue").textContent = due);
    $("#crmMetricToday") && ($("#crmMetricToday").textContent = todayCount);
    $("#crmFollowCount") && ($("#crmFollowCount").textContent = due);
  }

  function filteredCustomers() {
    const q = ($("#crmSearch")?.value || "").toLowerCase().trim();
    const status = $("#crmStatusFilter")?.value || "";
    return customers.filter((c) => {
      const hay = [c.company_name, c.contact_name, c.email, c.country, c.phone, c.whatsapp].join(" ").toLowerCase();
      return (!q || hay.includes(q)) && (!status || c.status === status);
    });
  }

  function renderCustomerList() {
    const list = $("#crmCustomerList");
    if (!list) return;
    const rows = filteredCustomers();
    if (!rows.length) { list.innerHTML = '<div class="mail-crm-empty">CRM müşterisi bulunamadı.</div>'; return; }
    list.innerHTML = rows.map((c) => {
      const due = c.next_follow_up_at && new Date(c.next_follow_up_at) <= new Date();
      return `<button class="mail-crm-card ${selectedCustomer?.id === c.id ? "is-active" : ""}" data-crm-customer="${c.id}"><strong>${escapeHtml(c.company_name || c.contact_name || c.email || "İsimsiz müşteri")}</strong><span>${escapeHtml(c.email || "-")} • ${escapeHtml(c.country || "-")}</span><span>${escapeHtml(c.status || "lead")} • Takip: ${fmtDate(c.next_follow_up_at)}</span>${due ? '<span class="mail-crm-badge due">Follow-up zamanı</span>' : ""}</button>`;
    }).join("");
  }

  async function loadCustomers() {
    try {
      const result = await api("/api/crm-center?action=customers");
      customers = result.customers || [];
      $("#crmSchemaWarning") && ($("#crmSchemaWarning").hidden = true);
      renderMetrics();
      renderCustomerList();
    } catch (error) {
      customers = [];
      renderMetrics();
      renderCustomerList();
      if ($("#crmSchemaWarning")) $("#crmSchemaWarning").hidden = false;
      setStatus(error.message, true);
      console.error("CRM customers load failed", error);
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  async function openCustomer(id) {
    selectedCustomer = customers.find((c) => c.id === id) || null;
    renderCustomerList();
    if (!selectedCustomer) return;
    const detail = $("#crmDetail");
    detail.innerHTML = detailTemplate(selectedCustomer);
    bindDetailEvents();
    await loadInteractions(id);
  }

  function detailTemplate(c) {
    return `<div class="mail-crm-detail-head"><div><p class="eyebrow">MÜŞTERİ KARTI</p><h2>${escapeHtml(c.company_name || c.contact_name || c.email)}</h2><div class="mail-crm-badges"><span class="mail-crm-badge">${escapeHtml(c.email || "-")}</span><span class="mail-crm-badge">${escapeHtml(c.phone || c.whatsapp || "-")}</span><span class="mail-crm-badge">Kaynak: ${escapeHtml(c.source || "-")}</span></div></div></div><form class="mail-crm-form" id="crmCustomerForm"><input type="hidden" name="id" value="${c.id || ""}" /><div class="mail-crm-two"><label>Firma<input name="company_name" value="${escapeHtml(c.company_name)}" /></label><label>Yetkili<input name="contact_name" value="${escapeHtml(c.contact_name)}" /></label><label>Ülke<input name="country" value="${escapeHtml(c.country)}" /></label><label>E-posta<input name="email" type="email" value="${escapeHtml(c.email)}" /></label><label>Telefon<input name="phone" value="${escapeHtml(c.phone)}" /></label><label>WhatsApp<input name="whatsapp" value="${escapeHtml(c.whatsapp)}" /></label><label>Durum<select name="status"><option value="lead">Lead</option><option value="follow_up_1">Follow-up 1</option><option value="follow_up_2">Follow-up 2</option><option value="final_follow_up">Final Follow-up</option><option value="quoted">Teklif gönderildi</option><option value="won">Kazanıldı</option><option value="lost">Kaybedildi</option></select></label><label>Follow-up tarihi<input name="next_follow_up_at" type="date" value="${isoDate(c.next_follow_up_at)}" /></label></div><label>İlgilendiği ürünler<input name="interested_products" value="${escapeHtml(c.interested_products)}" /></label><label>Notlar<textarea name="notes">${escapeHtml(c.notes)}</textarea></label><div class="mail-crm-actions"><button class="primary" type="submit">Müşteriyi kaydet</button><button type="button" data-follow-days="15">Follow-up 1 (+15)</button><button type="button" data-follow-days="30">Follow-up 2 (+30)</button><button type="button" data-follow-days="60">Final (+60)</button></div></form><div class="mail-crm-two"><form class="mail-crm-form" id="crmMailForm"><h3>Mail / teklif gönder</h3><label>Konu<input name="subject" value="Sidya Global teklif ve ürün bilgilendirmesi" /></label><label>Mesaj<textarea name="body">Merhaba,

Talebiniz için teşekkür ederiz. İlgilendiğiniz ürünlerle ilgili teklif detaylarını paylaşmak isteriz.

Saygılarımızla,
Sidya Global Export</textarea></label><div class="mail-crm-actions"><button class="primary" type="submit">Mail gönder</button><button type="button" id="crmQuoteButton">Teklif şablonu</button></div></form><form class="mail-crm-form" id="crmNoteForm"><h3>Not ekle</h3><label>Not<textarea name="body"></textarea></label><button type="submit">Notu kaydet</button></form></div><div><h3>Mail / işlem geçmişi</h3><div class="mail-crm-interactions" id="crmInteractionList"><div class="mail-crm-empty">Yükleniyor...</div></div></div>`;
  }

  function bindDetailEvents() {
    const form = $("#crmCustomerForm");
    if (form) {
      form.elements.status.value = selectedCustomer.status || "lead";
      form.addEventListener("submit", saveCustomer);
      $$('[data-follow-days]', form).forEach((button) => button.addEventListener("click", () => { form.elements.next_follow_up_at.value = addDays(Number(button.dataset.followDays)); }));
    }
    $("#crmMailForm")?.addEventListener("submit", sendCustomerMail);
    $("#crmNoteForm")?.addEventListener("submit", addNote);
    $("#crmQuoteButton")?.addEventListener("click", () => {
      const mailForm = $("#crmMailForm");
      mailForm.elements.subject.value = "Sidya Global proforma teklif";
      mailForm.elements.body.value = `Merhaba ${selectedCustomer.contact_name || ""},\n\nTalebinize istinaden ürün ve proforma teklif detaylarını hazırlıyoruz. Ürün, koli ve sevkiyat bilgilerini teyit ederseniz aynı gün dönüş yapacağız.\n\nSaygılarımızla,\nSidya Global Export`;
    });
  }

  function customerPayloadFromForm(form) {
    const payload = Object.fromEntries(new FormData(form).entries());
    if (payload.next_follow_up_at) payload.next_follow_up_at = new Date(`${payload.next_follow_up_at}T12:00:00`).toISOString();
    else payload.next_follow_up_at = null;
    return payload;
  }

  async function persistCustomerForm({ reopen = false } = {}) {
    const form = $("#crmCustomerForm");
    if (!form) throw new Error("Müşteri formu bulunamadı.");
    const payload = customerPayloadFromForm(form);
    const hasId = Boolean(payload.id);
    const result = await api("/api/crm-center?action=customer", { method: hasId ? "PATCH" : "POST", body: JSON.stringify(payload) });
    selectedCustomer = result.customer;
    await loadCustomers();
    if (selectedCustomer?.id) {
      selectedCustomer = customers.find((c) => c.id === selectedCustomer.id) || selectedCustomer;
      if (reopen) await openCustomer(selectedCustomer.id);
    }
    return selectedCustomer;
  }

  async function saveCustomer(event) {
    event.preventDefault();
    const button = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
    try {
      setButtonLoading(button, true, "Kaydediliyor...");
      await persistCustomerForm({ reopen: true });
      setStatus("Müşteri başarıyla kaydedildi.");
    } catch (error) {
      console.error("CRM customer save failed", error);
      setStatus(error.message, true);
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function loadInteractions(id) {
    const list = $("#crmInteractionList");
    if (!list) return;
    try {
      const result = await api(`/api/crm-center?action=interactions&customerId=${encodeURIComponent(id)}`);
      const rows = result.interactions || [];
      list.innerHTML = rows.length ? rows.map((item) => `<article class="mail-crm-interaction"><strong>${escapeHtml(item.subject || item.type)}</strong><small> ${escapeHtml(item.type)} / ${escapeHtml(item.direction)} • ${fmtDate(item.created_at)}</small><p>${escapeHtml(item.body || "")}</p></article>`).join("") : '<div class="mail-crm-empty">Henüz işlem geçmişi yok.</div>';
    } catch (error) {
      list.innerHTML = `<div class="mail-crm-empty">${escapeHtml(error.message)}</div>`;
      console.error("CRM interactions load failed", error);
    }
  }

  async function sendCustomerMail(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = event.submitter || form.querySelector('button[type="submit"]');
    const payload = Object.fromEntries(new FormData(form).entries());
    let customer;
    try {
      setButtonLoading(button, true, "Kaydediliyor...");
      setStatus("Müşteri kaydediliyor...");
      customer = await persistCustomerForm({ reopen: false });
      setStatus("Müşteri başarıyla kaydedildi. Mail gönderiliyor...");
    } catch (error) {
      console.error("CRM customer save before mail failed", error);
      setStatus(error.message, true);
      setButtonLoading(button, false);
      return;
    }

    try {
      setButtonLoading(button, true, "Mail gönderiliyor...");
      await api("/api/backend-config?mailCrm=send-mail", { method: "POST", body: JSON.stringify({ to: customer.email, subject: payload.subject, body: payload.body, customerId: customer.id, type: payload.subject.toLowerCase().includes("teklif") ? "quote" : "email" }) });
      setStatus("Müşteri başarıyla kaydedildi. Mail gönderildi ve müşteri geçmişine işlendi.");
      await loadInteractions(customer.id);
      await loadCustomers();
    } catch (error) {
      console.error("CRM mail send failed after customer save", error);
      setStatus(`Müşteri kaydedildi ancak mail gönderilemedi: ${error.message}`, true);
      if (customer?.id) await loadInteractions(customer.id);
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function addNote(event) {
    event.preventDefault();
    const button = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
    const body = new FormData(event.currentTarget).get("body");
    try {
      setButtonLoading(button, true, "Kaydediliyor...");
      await api("/api/crm-center?action=interaction", { method: "POST", body: JSON.stringify({ customer_id: selectedCustomer.id, type: "note", direction: "internal", subject: "Not", body }) });
      event.currentTarget.reset();
      await loadInteractions(selectedCustomer.id);
      setStatus("Not müşteri geçmişine eklendi.");
    } catch (error) {
      console.error("CRM note save failed", error);
      setStatus(error.message, true);
    } finally {
      setButtonLoading(button, false);
    }
  }

  function bindEvents() {
    $("#mailSettingsForm")?.addEventListener("submit", saveMailSettings);
    $("#sendTestMailButton")?.addEventListener("click", sendTestMail);
    $("#crmRefreshButton")?.addEventListener("click", loadCustomers);
    $("#crmSearch")?.addEventListener("input", renderCustomerList);
    $("#crmStatusFilter")?.addEventListener("change", renderCustomerList);
    $("#crmCustomerList")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-crm-customer]");
      if (button) openCustomer(button.dataset.crmCustomer);
    });
    $("#mainNav")?.addEventListener("click", (event) => {
      const view = event.target.closest("[data-view]")?.dataset.view;
      if (view === "mail-center") loadMailSettings();
      if (view === "crm-center") loadCustomers();
    });
  }

  function init() {
    const shell = $("#appShell");
    if (!shell || shell.hidden || !window.SIDYA_BACKEND) return false;
    document.documentElement.setAttribute("dir", "ltr");
    document.body.setAttribute("dir", "ltr");
    installStyles();
    installNavAndViews();
    bindEvents();
    loadCustomers();
    return true;
  }

  const timer = setInterval(() => { if (init()) clearInterval(timer); }, 500);
  document.addEventListener("DOMContentLoaded", init);
})();