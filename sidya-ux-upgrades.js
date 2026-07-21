(() => {
  "use strict";
  const UX_VERSION = "20260722-ux-1";
  const DAY = 24 * 60 * 60 * 1000;
  const installDismissKey = "sidyaInstallPanelDismissedUntil";
  const locale = () => document.documentElement.lang || new URLSearchParams(location.search).get("lang") || "en";
  const dict = {
    en: { step1: "Market & loading", step2: "Products", step3: "Summary", next: "Continue to product selection", back: "Back to products", category: "Category", brand: "Brand", allCategories: "All categories", allBrands: "All brands", sample: "Request Sample", notNow: "Not now", clear: "Clear", moderate: "Moderate", busy: "Busy", proformaSheet: "Company & Terms" },
    tr: { step1: "Pazar ve yükleme", step2: "Ürünler", step3: "Özet", next: "Ürün seçimine devam et", back: "Ürünlere dön", category: "Kategori", brand: "Marka", allCategories: "Tüm kategoriler", allBrands: "Tüm markalar", sample: "Numune Talep Et", notNow: "Şimdi değil", clear: "Rahat", moderate: "Orta", busy: "Yoğun", proformaSheet: "Firma ve Şartlar" },
    ar: { step1: "السوق والتحميل", step2: "المنتجات", step3: "الملخص", next: "المتابعة إلى اختيار المنتجات", back: "العودة إلى المنتجات", category: "الفئة", brand: "العلامة", allCategories: "كل الفئات", allBrands: "كل العلامات", sample: "طلب عينة", notNow: "ليس الآن", clear: "سلس", moderate: "متوسط", busy: "مزدحم", proformaSheet: "الشركة والشروط" },
  };
  const t = (key) => (dict[locale()] || dict.en)[key] || dict.en[key] || key;
  const isDismissed = () => { try { return Date.now() < Number(localStorage.getItem(installDismissKey) || 0); } catch (_) { return false; } };
  const rememberDismissal = () => { try { localStorage.setItem(installDismissKey, String(Date.now() + 7 * DAY)); } catch (_) {} };
  const hidePanel = (panel) => { if (!panel) return; panel.hidden = true; panel.setAttribute("aria-hidden", "true"); panel.setAttribute("inert", ""); };

  const enhanceInstallPanel = () => {
    const panel = document.querySelector("#installPanel");
    if (!panel || panel.dataset.uxEnhanced) return;
    panel.dataset.uxEnhanced = UX_VERSION;
    const close = panel.querySelector(".install-panel-close");
    if (close) { close.innerHTML = "&times;"; close.setAttribute("aria-label", "Close install guide"); close.addEventListener("click", () => { rememberDismissal(); hidePanel(panel); }, true); }
    const actions = panel.querySelector(".install-panel-actions");
    if (actions && !actions.querySelector("[data-install-dismiss]")) {
      const dismiss = document.createElement("button");
      dismiss.type = "button"; dismiss.className = "install-dismiss-link"; dismiss.dataset.installDismiss = ""; dismiss.textContent = t("notNow");
      dismiss.addEventListener("click", () => { rememberDismissal(); hidePanel(panel); }); actions.appendChild(dismiss);
    }
    panel.addEventListener("click", (event) => { if (event.target === panel) { rememberDismissal(); hidePanel(panel); } }, true);
    if (isDismissed()) hidePanel(panel);
  };

  let activeStep = 1;
  const setStep = (step) => {
    activeStep = Number(step) || 1;
    document.querySelectorAll("[data-ux-proforma-step]").forEach((panel) => { const on = Number(panel.dataset.uxProformaStep) === activeStep; panel.hidden = !on; panel.classList.toggle("is-active", on); });
    document.querySelectorAll("[data-ux-step-target]").forEach((button) => { const on = Number(button.dataset.uxStepTarget) === activeStep; button.classList.toggle("is-active", on); button.setAttribute("aria-current", on ? "step" : "false"); });
    if (activeStep === 2) setTimeout(() => document.querySelector("#proformaSearch")?.focus(), 40);
  };
  const populateFilters = () => {
    const list = document.querySelector("#proformaProductList"); const brandSelect = document.querySelector("#uxProformaBrand");
    if (!list || !brandSelect) return;
    const rows = [...list.querySelectorAll(".proforma-product-row")];
    const brands = [...new Set(rows.map((row) => row.querySelector("div span")?.textContent?.split("·")?.[0]?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
    if (brandSelect.options.length <= 1) brandSelect.innerHTML = `<option value="">${t("allBrands")}</option>${brands.map((brand) => `<option value="${brand.replace(/"/g, "&quot;")}">${brand}</option>`).join("")}`;
  };
  const applyFilters = () => {
    const brand = document.querySelector("#uxProformaBrand")?.value || "";
    document.querySelectorAll("#proformaProductList .proforma-product-row").forEach((row) => { const rowBrand = row.querySelector("div span")?.textContent?.split("·")?.[0]?.trim() || ""; row.hidden = Boolean(brand && rowBrand !== brand); });
  };
  const enhanceProformaWizard = () => {
    const proforma = document.querySelector("#proforma"); const picker = document.querySelector(".proforma-picker"); const panel = document.querySelector("#proformaProductPanel"); const summary = document.querySelector("#proformaOrderSummary");
    if (!proforma || !picker || !panel || !summary || proforma.dataset.uxWizard) return;
    proforma.dataset.uxWizard = UX_VERSION;
    const wizard = document.createElement("nav"); wizard.className = "proforma-wizard"; wizard.setAttribute("aria-label", "Proforma steps");
    wizard.innerHTML = [1,2,3].map((s) => `<button type="button" data-ux-step-target="${s}"><span>${s}</span><strong>${t(`step${s}`)}</strong></button>`).join("");
    document.querySelector(".proforma-screen-dialog .section-heading")?.after(wizard);
    picker.dataset.uxProformaStep = "1"; picker.classList.add("proforma-step-panel"); panel.dataset.uxProformaStep = "2"; panel.classList.add("proforma-step-panel"); summary.dataset.uxProformaStep = "3"; summary.classList.add("proforma-step-panel");
    const filters = document.createElement("div"); filters.className = "proforma-filter-row"; filters.innerHTML = `<label><span>${t("category")}</span><select id="uxProformaCategory"><option value="">${t("allCategories")}</option></select></label><label><span>${t("brand")}</span><select id="uxProformaBrand"><option value="">${t("allBrands")}</option></select></label>`; panel.prepend(filters);
    document.querySelector("#uxProformaBrand")?.addEventListener("change", applyFilters); document.querySelector("#uxProformaCategory")?.addEventListener("change", applyFilters);
    const openButton = document.querySelector("#openProformaProducts"); if (openButton) openButton.textContent = t("next");
    openButton?.addEventListener("click", () => { panel.hidden = false; populateFilters(); setStep(2); }, true);
    wizard.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { if (button.dataset.uxStepTarget === "2") panel.hidden = false; if (button.dataset.uxStepTarget === "3") summary.hidden = false; populateFilters(); setStep(button.dataset.uxStepTarget); }));
    const back = document.createElement("button"); back.type = "button"; back.className = "proforma-back-button"; back.textContent = t("back"); back.addEventListener("click", () => setStep(2)); summary.appendChild(back);
    setStep(1);
  };
  const enhanceCatalogAccordion = () => {
    document.querySelectorAll(".related-companies:not([data-ux-accordion])").forEach((box) => { box.dataset.uxAccordion = UX_VERSION; const title = box.querySelector("strong")?.textContent || "Catalogs"; const content = box.querySelector(":scope > div"); if (!content) return; const details = document.createElement("details"); details.className = box.className; details.dataset.uxAccordion = UX_VERSION; const summary = document.createElement("summary"); summary.textContent = title; details.append(summary, content); box.replaceWith(details); });
    document.querySelectorAll(".related-company:not([data-ux-sample])").forEach((company) => { company.dataset.uxSample = UX_VERSION; const sample = document.createElement("a"); sample.className = "sample-action"; sample.href = "#contact"; sample.textContent = t("sample"); company.appendChild(sample); });
  };
  const enhanceLogistics = () => document.querySelectorAll(".density-pill:not([data-ux-status])").forEach((pill) => { pill.dataset.uxStatus = UX_VERSION; if (pill.classList.contains("density-red")) pill.textContent = t("busy"); else if (pill.classList.contains("density-yellow")) pill.textContent = t("moderate"); else pill.textContent = t("clear"); });
  const enhanceXlsxTemplate = () => {
    if (!window.XLSX?.utils || !window.XLSX?.write || window.XLSX.__sidyaUxTemplatePatched) return;
    const originalWrite = window.XLSX.write.bind(window.XLSX);
    window.XLSX.write = (workbook, options) => {
      try {
        const isProforma = Array.isArray(workbook?.SheetNames) && workbook.SheetNames.includes("Proforma Order");
        if (isProforma && !workbook.SheetNames.includes(t("proformaSheet"))) {
          const terms = window.XLSX.utils.aoa_to_sheet([
            ["Sidya Global Proforma Request"],
            ["Generated", new Date().toLocaleString("tr-TR")],
            ["Website", "sidyaglobal.com"],
            ["Email", "export@sidyaglobal.com"],
            ["Bank / SWIFT Information", "To be completed by Sidya Global sales team"],
            ["Stamp / Signature", ""],
            ["Corporate Footer", "Sidya Global | Turkish Product Sourcing & Export Proforma Platform"],
          ]);
          terms["!cols"] = [{ wch: 28 }, { wch: 72 }];
          workbook.Sheets[t("proformaSheet")] = terms;
          workbook.SheetNames = [t("proformaSheet"), ...workbook.SheetNames];
        }
      } catch (error) {
        console.warn("Sidya proforma template enhancement skipped", error);
      }
      return originalWrite(workbook, options);
    };
    window.XLSX.__sidyaUxTemplatePatched = true;
  };
  const enhanceExcelDownload = () => { const button = document.querySelector("#downloadProformaExcel"); if (!button || button.dataset.uxExcel) return; button.dataset.uxExcel = UX_VERSION; button.addEventListener("click", () => window.dispatchEvent(new CustomEvent("sidya:proforma-template-note", { detail: { sheet: t("proformaSheet"), version: UX_VERSION } })), true); };
  const run = () => { enhanceInstallPanel(); enhanceProformaWizard(); enhanceCatalogAccordion(); enhanceLogistics(); enhanceXlsxTemplate(); enhanceExcelDownload(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true }); else run();
  window.addEventListener("sidya:locale-applied", run);
  new MutationObserver(() => { enhanceCatalogAccordion(); enhanceLogistics(); populateFilters(); }).observe(document.documentElement, { childList: true, subtree: true });
})();


