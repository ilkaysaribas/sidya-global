(() => {
  if (window.__sidyaMailSmtpFix) return;
  window.__sidyaMailSmtpFix = true;

  const FIXED_NAME = "Sidya Global Export Department";
  const FIXED_EMAIL = "export@sidyaglobal.com";
  const DEFAULT_SMTP = {
    smtp_host: "smtp.mx.cloudflare.net",
    smtp_port: "465",
    smtp_secure: "true",
    smtp_user: "api_token",
    test_to: "export@sidyaglobal.com",
  };
  const $ = (selector, root = document) => root.querySelector(selector);
  let lastMailStatusCheck = 0;
  let mailCenterBound = false;

  function setStatus(message, isError = false) {
    const status = $("#globalStatus");
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("error", Boolean(isError));
    status.classList.toggle("success", !isError);
  }

  function setMailStatus(message, isError = false) {
    const status = $("#mailSettingsStatus");
    if (!status) return;
    status.textContent = message || "";
    status.style.display = message ? "inline-flex" : "none";
    status.style.alignItems = "center";
    status.style.minHeight = "34px";
    status.style.maxWidth = "100%";
    status.style.padding = message ? "8px 10px" : "0";
    status.style.borderRadius = "8px";
    status.style.border = message ? `1px solid ${isError ? "#fecaca" : "#99f6e4"}` : "0";
    status.style.background = message ? (isError ? "#fff1f2" : "#f0fdfa") : "transparent";
    status.style.color = isError ? "#b91c1c" : "#0f766e";
    status.style.whiteSpace = "normal";
    status.style.overflowWrap = "anywhere";
    if (message) {
      clearTimeout(window.__sidyaMailStatusTimer);
      window.__sidyaMailStatusTimer = setTimeout(() => {
        const current = $("#mailSettingsStatus");
        if (current && current.textContent === message) setMailStatus("");
      }, 9000);
    }
  }

  function explainMailError(error) {
    const raw = String(error?.message || error || "İşlem başarısız.");
    const code = raw.match(/SMTP hata kodu:\s*([A-Z_0-9-]+)/i)?.[1] || raw.match(/\b(EAUTH|EENVELOPE|ECONNECTION|ETIMEDOUT|ESOCKET|ECONNREFUSED)\b/i)?.[1] || "";
    const normalized = code.toUpperCase();
    if (normalized === "EAUTH") return `${raw} SMTP kullanıcı adı veya token doğrulanamadı. Cloudflare tokenini ve kullanıcı adını kontrol edin.`;
    if (normalized === "EENVELOPE") return `${raw} Gönderen adresi veya gönderici domaini SMTP sağlayıcısı tarafından kabul edilmedi.`;
    if (["ECONNECTION", "ETIMEDOUT", "ESOCKET", "ECONNREFUSED"].includes(normalized)) return `${raw} SMTP sunucusuna bağlantı kurulamadı. Host, port ve SSL ayarını kontrol edin.`;
    if (/json/i.test(raw)) return "Sunucudan beklenmeyen yanıt geldi. Lütfen tekrar deneyin.";
    if (/Failed to fetch|NetworkError|Load failed/i.test(raw)) return "Ağ bağlantısı kurulamadı. İnternet veya Vercel API erişimini kontrol edin.";
    return raw;
  }

  function installMailCenterStyles() {
    if ($("#sidyaMailCenterHardeningStyles")) return;
    const style = document.createElement("style");
    style.id = "sidyaMailCenterHardeningStyles";
    style.textContent = `
      .view[data-view-panel="mail-center"],
      .view[data-view-panel="mail-center"] *{direction:ltr!important;text-align:left;box-sizing:border-box;}
      .view[data-view-panel="mail-center"] .panel{max-width:1120px;margin-inline:0 auto;overflow:hidden;}
      .view[data-view-panel="mail-center"] .mail-crm-form{display:grid;gap:14px;width:100%;min-width:0;}
      .view[data-view-panel="mail-center"] .mail-crm-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 16px;align-items:start;width:100%;min-width:0;}
      .view[data-view-panel="mail-center"] .mail-crm-form label{display:grid;gap:6px;min-width:0;font-weight:700;color:#1f2d3d;}
      .view[data-view-panel="mail-center"] .mail-crm-form input,
      .view[data-view-panel="mail-center"] .mail-crm-form select,
      .view[data-view-panel="mail-center"] .mail-crm-form textarea{width:100%;min-width:0;text-align:left!important;direction:ltr!important;}
      .view[data-view-panel="mail-center"] .mail-crm-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;width:100%;min-width:0;}
      .view[data-view-panel="mail-center"] .mail-crm-actions button[disabled]{opacity:.65;cursor:wait;}
      .view[data-view-panel="mail-center"] #mailSettingsStatus{flex:1 1 280px;}
      #mailFixedSenderNote{direction:ltr!important;text-align:left!important;margin:0 0 4px;}
      @media(max-width:760px){.view[data-view-panel="mail-center"] .mail-crm-two{grid-template-columns:1fr}.view[data-view-panel="mail-center"] #mailSettingsStatus{flex-basis:100%;}}
    `;
    document.head.appendChild(style);
  }

  function getBackendConfig() {
    return window.SIDYA_BACKEND || {};
  }

  function getSupabaseClient() {
    if (window.__sidyaProductDeleteClient) return window.__sidyaProductDeleteClient;
    const config = getBackendConfig();
    if (!window.supabase || !config.supabaseUrl || !(config.supabasePublishableKey || config.supabaseAnonKey)) {
      throw new Error("Supabase oturumu hazır değil. Lütfen sayfayı yenileyip tekrar deneyin.");
    }
    window.__sidyaProductDeleteClient = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey || config.supabaseAnonKey);
    return window.__sidyaProductDeleteClient;
  }

  async function getAccessToken() {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session?.access_token) {
      throw new Error("Admin oturumu bulunamadı. Lütfen tekrar giriş yapın.");
    }
    return data.session.access_token;
  }

  async function mailApi(path, options = {}) {
    const token = await getAccessToken();
    const response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
    const text = await response.text();
    let result = {};
    try { result = text ? JSON.parse(text) : {}; } catch (_error) { throw new Error("Sunucudan JSON olarak okunamayan yanıt geldi."); }
    if (!response.ok || result.ok === false) throw new Error(result.error || `HTTP ${response.status} hatası.`);
    return result;
  }

  function fillMailDefaults(form) {
    if (!form) return;
    if (!form.elements.smtp_host.value) form.elements.smtp_host.value = DEFAULT_SMTP.smtp_host;
    if (!form.elements.smtp_port.value || form.elements.smtp_port.value === "587") form.elements.smtp_port.value = DEFAULT_SMTP.smtp_port;
    if (form.elements.smtp_secure) form.elements.smtp_secure.value = DEFAULT_SMTP.smtp_secure;
    if (!form.elements.smtp_user.value) form.elements.smtp_user.value = DEFAULT_SMTP.smtp_user;
    if (form.elements.test_to && !form.elements.test_to.value) form.elements.test_to.value = DEFAULT_SMTP.test_to;
    if (form.elements.sender_name) form.elements.sender_name.value = FIXED_NAME;
    if (form.elements.sender_email) form.elements.sender_email.value = FIXED_EMAIL;
    if (form.elements.smtp_password) form.elements.smtp_password.value = "";
  }

  function applySettingsToForm(settings = {}) {
    const form = $("#mailSettingsForm");
    if (!form) return;
    form.setAttribute("dir", "ltr");
    fillMailDefaults(form);
    if (settings.smtp_host) form.elements.smtp_host.value = settings.smtp_host;
    if (settings.smtp_port) form.elements.smtp_port.value = String(settings.smtp_port);
    if (settings.smtp_secure !== undefined) form.elements.smtp_secure.value = String(Boolean(settings.smtp_secure));
    if (settings.smtp_user) form.elements.smtp_user.value = settings.smtp_user;
    form.elements.sender_name.value = FIXED_NAME;
    form.elements.sender_email.value = FIXED_EMAIL;
    form.elements.sender_name.readOnly = true;
    form.elements.sender_email.readOnly = true;
    form.elements.smtp_password.value = "";
    form.elements.smtp_password.placeholder = settings.hasPassword ? "Şifre kayıtlı, değiştirmeyeceksen boş bırak" : "SMTP şifresi";
  }

  async function loadMailSettingsSafe(showLoaded = false) {
    const form = $("#mailSettingsForm");
    if (!form) return;
    try {
      const result = await mailApi("/api/mail-settings");
      const settings = result.settings || {};
      applySettingsToForm(settings);
      if (settings.invalidEncryptionKey) setMailStatus(settings.encryptionKeyMessage || "SMTP_ENCRYPTION_KEY geçersiz.", true);
      else if (settings.needsEncryptionKey && !settings.usingEnv?.password && settings.hasPassword) setMailStatus("SMTP şifresini kullanmak için SMTP_ENCRYPTION_KEY env değeri gerekli.", true);
      else if (showLoaded) setMailStatus("SMTP ayarları yüklendi.");
      else {
        const current = $("#mailSettingsStatus")?.textContent || "";
        if (/SMTP_ENCRYPTION_KEY|şifreleme|geçersiz|Office/i.test(current)) setMailStatus("");
      }
    } catch (error) {
      fillMailDefaults(form);
      setMailStatus(explainMailError(error), true);
    }
  }

  function setButtonLoading(button, loadingText) {
    if (!button) return () => {};
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = loadingText;
    return () => { button.disabled = false; button.textContent = oldText; };
  }

  async function saveMailSettingsSafe(event) {
    const form = $("#mailSettingsForm");
    if (!form || !event.target.closest("#mailSettingsForm")) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    fillMailDefaults(form);
    const button = event.submitter || form.querySelector('button[type="submit"]');
    const restore = setButtonLoading(button, "Kaydediliyor...");
    setMailStatus("SMTP ayarları kaydediliyor...");
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.smtp_host = payload.smtp_host || DEFAULT_SMTP.smtp_host;
      payload.smtp_port = Number.parseInt(payload.smtp_port || DEFAULT_SMTP.smtp_port, 10);
      payload.smtp_secure = String(payload.smtp_secure) === "true";
      payload.smtp_user = payload.smtp_user || DEFAULT_SMTP.smtp_user;
      payload.sender_name = FIXED_NAME;
      payload.sender_email = FIXED_EMAIL;
      await mailApi("/api/mail-settings", { method: "POST", body: JSON.stringify(payload) });
      form.elements.smtp_password.value = "";
      setMailStatus("SMTP ayarları kaydedildi. Cloudflare ayarları korunuyor.");
      await loadMailSettingsSafe(false);
    } catch (error) {
      setMailStatus(explainMailError(error), true);
    } finally {
      restore();
    }
  }

  async function sendTestMailSafe(event) {
    const button = event.target.closest("#sendTestMailButton");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const form = $("#mailSettingsForm");
    const to = form?.elements.test_to?.value || DEFAULT_SMTP.test_to;
    const restore = setButtonLoading(button, "Gönderiliyor...");
    setMailStatus("Test mail gönderiliyor...");
    try {
      await mailApi("/api/send-mail", { method: "POST", body: JSON.stringify({ to, subject: "Sidya Global Mail Center test", body: "Mail Center test mesajı başarıyla gönderildi.", source: "crm" }) });
      setMailStatus(`Test mail gönderildi: ${to}`);
    } catch (error) {
      setMailStatus(explainMailError(error), true);
    } finally {
      restore();
    }
  }

  function lockSenderFields() {
    const form = $("#mailSettingsForm");
    if (!form) return;
    form.setAttribute("dir", "ltr");
    fillMailDefaults(form);
    const nameInput = form.elements.sender_name;
    const emailInput = form.elements.sender_email;
    if (nameInput) {
      nameInput.value = FIXED_NAME;
      nameInput.readOnly = true;
      nameInput.setAttribute("aria-readonly", "true");
    }
    if (emailInput) {
      emailInput.value = FIXED_EMAIL;
      emailInput.readOnly = true;
      emailInput.setAttribute("aria-readonly", "true");
    }
    if (!$("#mailFixedSenderNote", form)) {
      const note = document.createElement("p");
      note.id = "mailFixedSenderNote";
      note.className = "helper";
      note.textContent = `Aktif gönderici: ${FIXED_NAME} <${FIXED_EMAIL}>. Kişisel Gmail adı veya kişisel mail adresi gönderici olarak kullanılmaz.`;
      form.insertBefore(note, form.firstChild);
    }
  }

  async function refreshMailSettingsStatus(force = false) {
    if (!$("#mailSettingsForm")) return;
    const now = Date.now();
    if (!force && now - lastMailStatusCheck < 5000) return;
    lastMailStatusCheck = now;
    await loadMailSettingsSafe(false);
  }

  function bindMailCenterOverrides() {
    if (mailCenterBound) return;
    mailCenterBound = true;
    document.addEventListener("submit", saveMailSettingsSafe, true);
    document.addEventListener("click", sendTestMailSafe, true);
  }

  function selectedProductIds() {
    return Array.from(document.querySelectorAll("[data-product-select]:checked"))
      .map((input) => String(input.dataset.productSelect || "").trim())
      .filter(Boolean);
  }

  function updateSelectedCount() {
    const count = document.querySelectorAll("[data-product-select]:checked").length;
    const label = $("#selectedProductCount");
    if (label) label.textContent = `${count} ürün seçildi`;
    const selectAll = $("#selectAllProducts");
    if (selectAll && count === 0) selectAll.checked = false;
  }

  function removeProductRows(ids) {
    ids.forEach((id) => {
      const row = document.querySelector(`[data-product-row="${String(id).replace(/"/g, "\\\"")}"]`);
      if (row) row.remove();
    });
    document.querySelectorAll("[data-product-select]:checked").forEach((input) => { input.checked = false; });
    updateSelectedCount();
  }

  async function deleteSelectedProducts(event) {
    const button = event.target.closest("#deleteSelectedProductsButton");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const ids = selectedProductIds();
    if (!ids.length) {
      setStatus("Önce en az bir ürün seçin.", true);
      return;
    }
    if (!confirm(`${ids.length} seçili ürün kalıcı olarak silinsin mi? Bağlı stok/fatura geçmişi varsa işlem durdurulacak.`)) return;

    const restore = setButtonLoading(button, "Siliniyor...");
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/admin-products?action=delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "delete", ids }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || "Ürün silinemedi.");
      const deletedIds = Array.isArray(result.deletedIds) && result.deletedIds.length ? result.deletedIds : ids;
      removeProductRows(deletedIds);
      setStatus(`${result.deletedCount || deletedIds.length} ürün silindi ve liste güncellendi.`);
      window.dispatchEvent(new CustomEvent("sidya:products-deleted", { detail: { ids: deletedIds } }));
    } catch (error) {
      setStatus(error.message || "Ürün silinemedi.", true);
    } finally {
      restore();
    }
  }

  function init() {
    installMailCenterStyles();
    lockSenderFields();
    bindMailCenterOverrides();
    refreshMailSettingsStatus();
  }

  setInterval(init, 700);
  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("click", deleteSelectedProducts, true);
})();