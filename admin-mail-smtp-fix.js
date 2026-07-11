(() => {
  if (window.__sidyaMailSmtpFix) return;
  window.__sidyaMailSmtpFix = true;

  const FIXED_NAME = "Sidya Global Export Department";
  const FIXED_EMAIL = "export@sidyaglobal.com";
  const $ = (selector, root = document) => root.querySelector(selector);

  function setStatus(message, isError = false) {
    const status = $("#globalStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("error", Boolean(isError));
    status.classList.toggle("success", !isError);
  }

  function lockSenderFields() {
    const form = $("#mailSettingsForm");
    if (!form) return;
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
    form.addEventListener("submit", () => {
      if (form.elements.sender_name) form.elements.sender_name.value = FIXED_NAME;
      if (form.elements.sender_email) form.elements.sender_email.value = FIXED_EMAIL;
    }, true);
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

    const previousText = button.textContent;
    button.disabled = true;
    button.textContent = "Siliniyor...";
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/admin-products?action=delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "delete", ids }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || "Ürün silinemedi.");
      }
      const deletedIds = Array.isArray(result.deletedIds) && result.deletedIds.length ? result.deletedIds : ids;
      removeProductRows(deletedIds);
      setStatus(`${result.deletedCount || deletedIds.length} ürün silindi ve liste güncellendi.`);
      window.dispatchEvent(new CustomEvent("sidya:products-deleted", { detail: { ids: deletedIds } }));
    } catch (error) {
      setStatus(error.message || "Ürün silinemedi.", true);
    } finally {
      button.disabled = false;
      button.textContent = previousText;
    }
  }

  function init() { lockSenderFields(); }
  setInterval(init, 700);
  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("click", deleteSelectedProducts, true);
})();
