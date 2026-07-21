(() => {
  if (window.__sidyaAiAdmin) return;
  window.__sidyaAiAdmin = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (value) => value ? new Date(value).toLocaleString("tr-TR") : "-";
  let leads = [];
  let selected = null;
  let session = null;
  let selectedLeadIds = new Set();
  let deleteContext = { ids: [] };

  function styles() {
    if ($("#sidyaAiAdminStyles")) return;
    const node = document.createElement("style");
    node.id = "sidyaAiAdminStyles";
    node.textContent = `
      .ai-admin-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}
      .ai-admin-metrics article{border:1px solid #dfe3e8;border-radius:10px;background:#fff;padding:14px}
      .ai-admin-metrics span{display:block;color:#667085;font-size:12px}.ai-admin-metrics strong{font-size:24px}
      .ai-admin-tools{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:12px}.ai-admin-tools input,.ai-admin-tools select{border:1px solid #d8e1ec;border-radius:8px;padding:10px;background:#fff}
      .ai-admin-bulk{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid #fecaca;background:#fff7f7;color:#991b1b;border-radius:10px;padding:10px 12px;margin:0 0 12px}
      .ai-admin-bulk[hidden]{display:none}.ai-admin-bulk button{border:1px solid #ef4444;background:#fee2e2;color:#991b1b;border-radius:8px;padding:8px 10px;font-weight:800}.ai-admin-bulk button:hover{background:#ef4444;color:#fff}
      .ai-priority{display:inline-flex;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:800}.ai-priority.urgent{background:#fee2e2;color:#991b1b}.ai-priority.high{background:#ffedd5;color:#9a3412}.ai-priority.normal{background:#e0f2fe;color:#075985}.ai-priority.low{background:#f1f5f9;color:#475569}
      .ai-admin-table tr{cursor:pointer}.ai-admin-table tr:hover{background:#f8fafc}.ai-admin-table th.ai-select-col,.ai-admin-table td.ai-select-col{width:38px;text-align:center}.ai-actions-cell{min-width:132px}.ai-row-actions{display:flex;gap:6px;align-items:center;justify-content:flex-start}.ai-row-actions button{white-space:nowrap}.ai-delete-button{border:1px solid #ef4444;background:#fff5f5;color:#b91c1c;border-radius:7px;padding:6px 8px;font-weight:800}.ai-delete-button:hover{background:#dc2626;border-color:#dc2626;color:#fff}.ai-open-button{border:1px solid #d8e1ec;background:#fff;border-radius:7px;padding:6px 9px}
      .ai-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.ai-detail-card{border:1px solid #e1e5ea;border-radius:10px;padding:12px;background:#fff}.ai-detail-card.full{grid-column:1/-1}.ai-detail-card dt{color:#667085;font-size:11px;margin-top:7px}.ai-detail-card dd{margin:2px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
      .ai-conversation{display:grid;gap:7px;max-height:320px;overflow:auto}.ai-conversation p{margin:0;padding:9px;border-radius:9px;background:#f5f6f7}.ai-conversation p.user{background:#111;color:#fff;margin-left:10%}
      .ai-admin-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:end}.ai-admin-actions label{display:grid;gap:5px}.ai-admin-actions select,.ai-admin-actions textarea{border:1px solid #d8e1ec;border-radius:8px;padding:9px}.ai-admin-note{display:grid;grid-template-columns:1fr auto;gap:8px}.ai-admin-note textarea{min-height:70px}.ai-files{display:flex;gap:8px;flex-wrap:wrap}.ai-files button{border:1px solid #d8e1ec;background:#fff;border-radius:8px;padding:8px}.ai-empty{padding:24px;text-align:center;color:#667085}
      .ai-delete-dialog::backdrop{background:rgba(15,23,42,.55)}.ai-delete-dialog .dialog-form{max-width:520px}.ai-delete-warning{border:1px solid #fecaca;background:#fff7f7;color:#7f1d1d;border-radius:10px;padding:12px;margin:8px 0 0;line-height:1.55}.ai-delete-warning strong{display:block;color:#991b1b;margin-bottom:5px}.ai-dialog-danger{background:#dc2626!important;border-color:#dc2626!important;color:#fff!important}.ai-dialog-danger:disabled{opacity:.7;cursor:wait}.ai-admin-status{min-height:20px;margin:8px 0 12px;font-weight:700}.ai-admin-status.ok{color:#047857}.ai-admin-status.error{color:#b91c1c}.ai-admin-status.warn{color:#9a3412}
      @media(max-width:1000px){.ai-admin-metrics{grid-template-columns:1fr 1fr}.ai-detail-grid{grid-template-columns:1fr}.ai-detail-card.full{grid-column:auto}}
      @media(max-width:650px){.ai-admin-metrics{grid-template-columns:1fr}.ai-admin-tools>*{width:100%}.ai-row-actions{flex-direction:column;align-items:stretch}.ai-actions-cell{min-width:86px}.ai-admin-bulk{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(node);
  }

  function client() {
    const cfg = window.SIDYA_BACKEND || {};
    if (!window.supabase || !cfg.supabaseUrl || !(cfg.supabaseAnonKey || cfg.supabasePublishableKey)) return null;
    if (!window.__sidyaAiAdminClient) window.__sidyaAiAdminClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey || cfg.supabasePublishableKey);
    return window.__sidyaAiAdminClient;
  }

  async function token() {
    const c = client();
    if (!c) throw new Error("Supabase baÄŸlantÄ±sÄ± yok.");
    const result = await c.auth.getSession();
    session = result.data?.session;
    if (!session?.access_token) throw new Error("Admin oturumu bulunamadÄ±.");
    return session.access_token;
  }

  async function api(action, options = {}) {
    const response = await fetch("/api/ai-assistant?action=" + encodeURIComponent("admin-" + action) + (options.query || ""), {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + await token() },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) throw new Error(result.error || "Ä°ÅŸlem baÅŸarÄ±sÄ±z.");
    return result;
  }

  function install() {
    const nav = $("#mainNav"), main = $(".main");
    if (!nav || !main) return false;
    styles();
    if (!nav.querySelector('[data-view="ai-assistant"]')) nav.insertAdjacentHTML("beforeend", "<button data-view='ai-assistant'>AI Asistan Talepleri <span class='nav-count' id='aiLeadCount'>0</span></button>");
    if (!main.querySelector('[data-view-panel="ai-assistant"]')) main.insertAdjacentHTML("beforeend", view());
    nav.addEventListener("click", (event) => {
      const button = event.target.closest('[data-view="ai-assistant"]');
      if (!button) return;
      event.preventDefault();
      showView();
      load();
    });
    $("#aiLeadRefresh")?.addEventListener("click", load);
    ["#aiLeadSearch", "#aiLeadStatus", "#aiLeadPriority"].forEach((s) => $(s)?.addEventListener(s.includes("Search") ? "input" : "change", render));
    $("#aiSelectAll")?.addEventListener("change", toggleAllVisible);
    $("#aiBulkDelete")?.addEventListener("click", () => openDeleteConfirm(Array.from(selectedLeadIds)));
    $("#aiLeadRows")?.addEventListener("change", (event) => {
      const box = event.target.closest("[data-ai-select]");
      if (!box) return;
      if (box.checked) selectedLeadIds.add(box.dataset.aiSelect); else selectedLeadIds.delete(box.dataset.aiSelect);
      updateBulkUi();
    });
    $("#aiLeadRows")?.addEventListener("click", (event) => {
      const deleteButton = event.target.closest("[data-ai-delete]");
      if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();
        openDeleteConfirm([deleteButton.dataset.aiDelete]);
        return;
      }
      const openButton = event.target.closest("[data-ai-open]");
      if (openButton) {
        event.preventDefault();
        event.stopPropagation();
        open(openButton.dataset.aiOpen);
        return;
      }
      if (event.target.closest("button,input,a,label")) return;
      const row = event.target.closest("[data-ai-lead]");
      if (row) open(row.dataset.aiLead);
    });
    $("#aiDeleteCancel")?.addEventListener("click", () => $("#aiDeleteDialog")?.close());
    $("#aiDeleteConfirm")?.addEventListener("click", runDelete);
    return true;
  }

  function view() {
    return "<section class='view' data-view-panel='ai-assistant'><div class='ai-admin-metrics'><article><span>Toplam talep</span><strong id='aiMetricTotal'>0</strong></article><article><span>Yeni</span><strong id='aiMetricNew'>0</strong></article><article><span>YÃ¼ksek / Acil</span><strong id='aiMetricHigh'>0</strong></article><article><span>Teklife dÃ¶nÃ¼ÅŸen</span><strong id='aiMetricQuote'>0</strong></article><article><span>En Ã§ok Ã¼lke</span><strong id='aiMetricCountry'>-</strong></article><article><span>En Ã§ok kategori</span><strong id='aiMetricCategory'>-</strong></article><article><span>Dil daÄŸÄ±lÄ±mÄ±</span><strong id='aiMetricLanguage'>-</strong></article><article><span>Ort. gÃ¶rÃ¼ÅŸme</span><strong id='aiMetricDuration'>0 sn</strong></article></div><div class='panel'><div class='panel-heading'><div><p class='eyebrow'>MÃœÅTERÄ° Ä°LETÄ°ÅÄ°MÄ°</p><h2>AI Asistan Talepleri</h2></div><button class='primary' id='aiLeadRefresh'>Yenile</button></div><p id='aiAdminStatus' class='ai-admin-status' role='status'></p><div class='ai-admin-tools'><input id='aiLeadSearch' type='search' placeholder='Firma, Ã¼lke, Ã¼rÃ¼n veya kiÅŸi ara'><select id='aiLeadStatus'><option value=''>TÃ¼m durumlar</option><option value='new'>Yeni</option><option value='contacted'>Ä°letiÅŸime geÃ§ildi</option><option value='quote_preparing'>Teklif hazÄ±rlanÄ±yor</option><option value='won'>SonuÃ§landÄ±</option><option value='lost'>Kaybedildi</option></select><select id='aiLeadPriority'><option value=''>TÃ¼m Ã¶ncelikler</option><option value='urgent'>Acil</option><option value='high'>YÃ¼ksek</option><option value='normal'>Normal</option><option value='low'>DÃ¼ÅŸÃ¼k</option></select></div><div class='ai-admin-bulk' id='aiBulkBar' hidden><strong id='aiBulkText'>0 talep seÃ§ildi</strong><button type='button' id='aiBulkDelete'>SeÃ§ilenleri Sil (0)</button></div><div class='table-wrap ai-admin-table'><table><thead><tr><th class='ai-select-col'><input id='aiSelectAll' type='checkbox' aria-label='TÃ¼m talepleri seÃ§'></th><th>Tarih</th><th>Ã–ncelik</th><th>Talep tÃ¼rÃ¼</th><th>Firma</th><th>Ãœlke</th><th>ÃœrÃ¼n</th><th>Miktar</th><th>Yetkili</th><th>Telefon</th><th>E-posta</th><th>Durum</th><th>Atanan</th><th class='ai-actions-cell'>Ä°ÅŸlemler</th></tr></thead><tbody id='aiLeadRows'></tbody></table></div></div><dialog id='aiLeadDialog' class='wide-dialog'><div class='dialog-form'><div class='dialog-heading'><div><p class='eyebrow'>AI ASÄ°STAN TALEBÄ°</p><h2 id='aiLeadDialogTitle'>Talep</h2></div><button type='button' data-ai-close>Ã—</button></div><div id='aiLeadDetail' class='ai-empty'>YÃ¼kleniyor...</div><div class='dialog-actions'><button type='button' data-ai-close>Kapat</button></div></div></dialog><dialog id='aiDeleteDialog' class='ai-delete-dialog'><div class='dialog-form'><div class='dialog-heading'><div><p class='eyebrow'>TEHLÄ°KELÄ° Ä°ÅLEM</p><h2>Talep silme onayÄ±</h2></div><button type='button' id='aiDeleteCancelTop'>Ã—</button></div><div id='aiDeleteMessage' class='ai-delete-warning'></div><div class='dialog-actions'><button type='button' id='aiDeleteCancel'>VazgeÃ§</button><button type='button' class='ai-dialog-danger' id='aiDeleteConfirm'>Talebi Sil</button></div></div></dialog></section>";
  }

  function showView() {
    $$("#mainNav [data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === "ai-assistant"));
    $$("[data-view-panel]").forEach((p) => p.classList.toggle("active", p.dataset.viewPanel === "ai-assistant"));
    const title = $("#pageTitle");
    if (title) title.textContent = "AI Asistan Talepleri";
  }

  function setAiStatus(message, type = "ok") {
    const node = $("#aiAdminStatus");
    if (!node) return;
    node.textContent = message || "";
    node.className = "ai-admin-status " + (type || "ok");
    if (message) window.setTimeout(() => { if (node.textContent === message) node.textContent = ""; }, 9000);
  }

  const most = (key) => {
    const counts = {};
    leads.forEach((x) => { const v = x[key] || ""; if (v) counts[v] = (counts[v] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
  };

  function metrics() {
    $("#aiMetricTotal").textContent = leads.length;
    $("#aiMetricNew").textContent = leads.filter((x) => x.lead_status === "new").length;
    $("#aiMetricHigh").textContent = leads.filter((x) => ["high", "urgent"].includes(x.priority)).length;
    $("#aiMetricQuote").textContent = leads.filter((x) => x.converted_to_quote || x.lead_status === "quote_preparing").length;
    $("#aiMetricCountry").textContent = most("country");
    $("#aiMetricCategory").textContent = most("product_category");
    $("#aiMetricLanguage").textContent = most("language");
    $("#aiMetricDuration").textContent = Math.round(leads.reduce((s, x) => s + Number(x.duration_seconds || 0), 0) / Math.max(leads.length, 1)) + " sn";
    const count = $("#aiLeadCount");
    if (count) count.textContent = leads.filter((x) => x.lead_status === "new").length;
  }

  function filtered() {
    const q = ($("#aiLeadSearch")?.value || "").toLowerCase(), status = $("#aiLeadStatus")?.value || "", priority = $("#aiLeadPriority")?.value || "";
    return leads.filter((x) => {
      const hay = [x.company_name, x.country, x.product_name, x.full_name, x.email, x.phone, x.lead_number].join(" ").toLowerCase();
      return (!q || hay.includes(q)) && (!status || x.lead_status === status) && (!priority || x.priority === priority);
    });
  }

  function updateBulkUi() {
    const bar = $("#aiBulkBar"), text = $("#aiBulkText"), button = $("#aiBulkDelete"), all = $("#aiSelectAll");
    const count = selectedLeadIds.size;
    if (bar) bar.hidden = count < 1;
    if (text) text.textContent = count + " talep seÃ§ildi";
    if (button) button.textContent = "SeÃ§ilenleri Sil (" + count + ")";
    const visible = filtered().filter((x) => !String(x.id || "").startsWith("crm:"));
    if (all) {
      all.checked = visible.length > 0 && visible.every((x) => selectedLeadIds.has(x.id));
      all.indeterminate = visible.some((x) => selectedLeadIds.has(x.id)) && !all.checked;
    }
  }

  function toggleAllVisible(event) {
    filtered().forEach((x) => {
      if (String(x.id || "").startsWith("crm:")) return;
      if (event.currentTarget.checked) selectedLeadIds.add(x.id); else selectedLeadIds.delete(x.id);
    });
    render();
  }

  function render() {
    metrics();
    const rows = $("#aiLeadRows"), items = filtered();
    if (!rows) return;
    rows.innerHTML = items.length ? items.map((x) => {
      const isCrm = String(x.id || "").startsWith("crm:");
      const checked = selectedLeadIds.has(x.id) ? " checked" : "";
      const deleteDisabled = isCrm ? " disabled title='CRM kaydÄ± AI talebi deÄŸildir'" : " title='Talebi sil'";
      return "<tr data-ai-lead='" + esc(x.id) + "'><td class='ai-select-col'><input type='checkbox' data-ai-select='" + esc(x.id) + "' aria-label='Talebi seÃ§'" + checked + (isCrm ? " disabled" : "") + "></td><td>" + esc(fmt(x.created_at)) + "</td><td><span class='ai-priority " + esc(x.priority) + "'>" + esc(x.priority) + "</span></td><td>" + esc(x.lead_type) + "</td><td>" + esc(x.company_name || "-") + "</td><td>" + esc(x.country || "-") + "</td><td>" + esc(x.product_name || "-") + "</td><td>" + esc((x.quantity || "-") + " " + (x.quantity_unit || "")) + "</td><td>" + esc(x.full_name || "-") + "</td><td>" + esc(x.phone || x.whatsapp || "-") + "</td><td>" + esc(x.email || "-") + "</td><td>" + esc(x.lead_status) + "</td><td>" + esc(x.assigned_to ? "AtandÄ±" : "-") + "</td><td class='ai-actions-cell'><div class='ai-row-actions'><button type='button' class='ai-open-button' data-ai-open='" + esc(x.id) + "'>AÃ§</button><button type='button' class='ai-delete-button' data-ai-delete='" + esc(x.id) + "'" + deleteDisabled + ">&#128465; Sil</button></div></td></tr>";
    }).join("") : "<tr><td colspan='14' class='ai-empty'>Talep bulunamadÄ±.</td></tr>";
    updateBulkUi();
  }

  async function load() {
    try {
      const result = await api("list");
      leads = result.leads || [];
      selectedLeadIds = new Set(Array.from(selectedLeadIds).filter((id) => leads.some((x) => x.id === id)));
      render();
    } catch (error) {
      const rows = $("#aiLeadRows");
      if (rows) rows.innerHTML = "<tr><td colspan='14' class='ai-empty'>" + esc(error.message) + "</td></tr>";
    }
  }

  function openDeleteConfirm(ids) {
    const cleanIds = [...new Set((ids || []).filter(Boolean))];
    if (!cleanIds.length) return;
    const realIds = cleanIds.filter((id) => !String(id).startsWith("crm:"));
    if (!realIds.length) {
      setAiStatus("Bu kayÄ±t AI Asistan talebi olmadÄ±ÄŸÄ± iÃ§in buradan silinemez.", "warn");
      return;
    }
    deleteContext = { ids: realIds };
    const dialog = $("#aiDeleteDialog"), message = $("#aiDeleteMessage"), button = $("#aiDeleteConfirm");
    if (!dialog || !message || !button) return;
    button.disabled = false;
    button.textContent = realIds.length === 1 ? "Talebi Sil" : "SeÃ§ilenleri Sil";
    if (realIds.length === 1) {
      const lead = leads.find((x) => x.id === realIds[0]) || {};
      message.innerHTML = "<strong>Talebi silmek istediÄŸinize emin misiniz?</strong>Firma: " + esc(lead.company_name || "-") + "<br>Talep tarihi: " + esc(fmt(lead.created_at)) + "<br><br>Bu iÅŸlem geri alÄ±namaz.";
    } else {
      message.innerHTML = "<strong>SeÃ§ilen " + realIds.length + " talebi silmek istediÄŸinize emin misiniz?</strong>Bu iÅŸlem geri alÄ±namaz.";
    }
    dialog.showModal();
  }

  async function runDelete() {
    const button = $("#aiDeleteConfirm"), dialog = $("#aiDeleteDialog");
    if (!deleteContext.ids.length || button?.disabled) return;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Siliniyor...";
    try {
      const result = await api("delete", { method: "POST", body: { ids: deleteContext.ids } });
      const deleted = new Set(result.deletedIds || []);
      if (deleted.size) leads = leads.filter((x) => !deleted.has(x.id));
      selectedLeadIds = new Set(Array.from(selectedLeadIds).filter((id) => !deleted.has(id)));
      render();
      dialog?.close();
      if (result.blockedCount) {
        setAiStatus((result.deletedCount || 0) + " talep silindi. " + result.blockedCount + " talep baÄŸlantÄ±lÄ± kayÄ±t bulunduÄŸu iÃ§in silinemedi.", result.deletedCount ? "warn" : "error");
      } else if (result.deletedCount > 1) {
        setAiStatus(result.deletedCount + " talep baÅŸarÄ±yla silindi.", "ok");
      } else if (result.deletedCount === 1) {
        setAiStatus("Talep baÅŸarÄ±yla silindi.", "ok");
      } else {
        setAiStatus("Talep silinemedi. LÃ¼tfen tekrar deneyin.", "error");
      }
    } catch (error) {
      console.error("AI Asistan talebi silinemedi", error);
      setAiStatus(error.message === "Bu islem icin admin yetkisi gerekli." ? "Bu iÅŸlem iÃ§in yetkiniz bulunmuyor." : "Talep silinemedi. LÃ¼tfen tekrar deneyin.", "error");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = original;
      }
    }
  }

  async function open(id) {
    const dialog = $("#aiLeadDialog"), detail = $("#aiLeadDetail");
    dialog.showModal();
    detail.innerHTML = "YÃ¼kleniyor...";
    try {
      const result = await api("detail", { query: "&id=" + encodeURIComponent(id) });
      selected = result.lead;
      if (!selected) throw new Error("Talep bulunamadÄ±.");
      $("#aiLeadDialogTitle").textContent = selected.lead_number + " Â· " + (selected.company_name || selected.full_name || "Talep");
      detail.innerHTML = detailHtml(result);
      bindDetail(result);
    } catch (error) {
      detail.textContent = error.message;
    }
  }

  function details(values) { return Object.entries(values).map(([k, v]) => "<dt>" + esc(k) + "</dt><dd>" + esc(v || "-") + "</dd>").join(""); }

  function detailHtml(result) {
    const x = result.lead, conversation = Array.isArray(x.conversation_json) ? x.conversation_json : [], wa = String(x.whatsapp || x.phone || "").replace(/\D/g, "");
    return "<div class='ai-detail-grid'><section class='ai-detail-card'>" + details({ "Talep no": x.lead_number, "Kaynak": x.source, "Tarih": fmt(x.created_at), "Ã–ncelik": x.priority, "Durum": x.lead_status, "Dil": x.language }) + "</section><section class='ai-detail-card'>" + details({ "Firma": x.company_name, "Yetkili": x.full_name, "Ãœlke / Åehir": (x.country || "-") + " / " + (x.city || "-"), "E-posta": x.email, "Telefon": x.phone, "WhatsApp": x.whatsapp }) + "</section><section class='ai-detail-card'>" + details({ "Talep tÃ¼rÃ¼": x.lead_type, "ÃœrÃ¼n": x.product_name, "Kategori": x.product_category, "Miktar": (x.quantity || "-") + " " + (x.quantity_unit || ""), "Teslimat": (x.destination_country || "-") + " / " + (x.destination_city || x.destination_port || "-"), "Incoterm": x.incoterm, "Tarih": x.requested_delivery_date, "Hedef fiyat": x.target_price }) + "</section><section class='ai-detail-card'>" + details({ "Ã–zel marka": x.private_label_request, "Sertifika": x.certificate_requirement, "Lojistik": x.logistics_type, "Tercih edilen iletiÅŸim": x.preferred_contact_method, "AÃ§Ä±k rÄ±za": x.consent_given ? "Evet" : "HayÄ±r", "Sayfa": x.page_url }) + "</section><section class='ai-detail-card full'><h3>Yapay zekÃ¢ Ã¶zeti</h3><p>" + esc(x.conversation_summary || "-") + "</p><h3>AÃ§Ä±klama</h3><p>" + esc(x.message || x.product_details || "-") + "</p></section><section class='ai-detail-card full'><h3>KonuÅŸma geÃ§miÅŸi</h3><div class='ai-conversation'>" + conversation.map((m) => "<p class='" + esc(m.role) + "'><strong>" + esc(m.role === "assistant" ? "Sidya AI" : "ZiyaretÃ§i") + ":</strong> " + esc(m.content) + "</p>").join("") + "</div></section><section class='ai-detail-card full'><h3>YÃ¼klenen dosyalar</h3><div class='ai-files'>" + ((result.files || []).map((f) => "<button type='button' data-ai-file='" + esc(f.id) + "'>" + esc(f.original_name) + "</button>").join("") || "Dosya yok.") + "</div></section><section class='ai-detail-card full'><div class='ai-admin-actions'><label>Durum<select id='aiEditStatus'><option value='new'>Yeni</option><option value='contacted'>Ä°letiÅŸime geÃ§ildi</option><option value='quote_preparing'>Teklif hazÄ±rlanÄ±yor</option><option value='won'>SonuÃ§landÄ±</option><option value='lost'>Kaybedildi</option></select></label><label>Ã–ncelik<select id='aiEditPriority'><option>low</option><option>normal</option><option>high</option><option>urgent</option></select></label><label>Atama<select id='aiEditAssigned'><option value=''>AtanmamÄ±ÅŸ</option><option value='me'>Kendime ata</option></select></label><label><input id='aiEditQuote' type='checkbox'> Teklife dÃ¶nÃ¼ÅŸtÃ¼</label><button class='primary' id='aiSaveLead' type='button'>Kaydet</button><a href='mailto:" + esc(x.email || "") + "'>E-posta gÃ¶nder</a>" + (wa ? "<a href='https://wa.me/" + esc(wa) + "' target='_blank' rel='noopener'>WhatsApp</a>" : "") + "</div></section><section class='ai-detail-card full'><h3>Notlar</h3><div>" + ((result.notes || []).map((n) => "<p>" + esc(n.note) + " <small>" + esc(fmt(n.created_at)) + "</small></p>").join("") || "HenÃ¼z not yok.") + "</div><form class='ai-admin-note' id='aiNoteForm'><textarea name='note' placeholder='Ä°Ã§ not ekle' required></textarea><button type='submit'>Notu ekle</button></form></section></div>";
  }

  function bindDetail() {
    $("#aiEditStatus").value = selected.lead_status;
    $("#aiEditPriority").value = selected.priority;
    $("#aiEditAssigned").value = selected.assigned_to ? "me" : "";
    $("#aiEditQuote").checked = Boolean(selected.converted_to_quote);
    $("#aiSaveLead").addEventListener("click", async () => {
      try {
        await api("update", { method: "PATCH", body: { id: selected.id, lead_status: $("#aiEditStatus").value, priority: $("#aiEditPriority").value, assigned_to: $("#aiEditAssigned").value === "me" ? session?.user?.id : null, converted_to_quote: $("#aiEditQuote").checked, last_contacted_at: $("#aiEditStatus").value === "contacted" ? new Date().toISOString() : selected.last_contacted_at } });
        await load();
        await open(selected.id);
      } catch (error) { alert(error.message); }
    });
    $("#aiNoteForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      try { await api("note", { method: "POST", body: { lead_id: selected.id, note: new FormData(event.currentTarget).get("note") } }); await open(selected.id); }
      catch (error) { alert(error.message); }
    });
    $$('[data-ai-file]').forEach((button) => button.addEventListener("click", async () => {
      try { const r = await api("file-url", { query: "&id=" + encodeURIComponent(button.dataset.aiFile) }); window.open(r.url, "_blank", "noopener"); }
      catch (error) { alert(error.message); }
    }));
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-ai-close]")) $("#aiLeadDialog")?.close();
    if (event.target.closest("#aiDeleteCancelTop")) $("#aiDeleteDialog")?.close();
  });
  const timer = setInterval(() => {
    const shell = $("#appShell");
    if (shell && !shell.hidden && window.SIDYA_BACKEND && install()) { clearInterval(timer); load(); }
  }, 500);
})();
