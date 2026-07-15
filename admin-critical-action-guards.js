(() => {
  "use strict";
  if (window.__sidyaCriticalActionGuards) return;
  window.__sidyaCriticalActionGuards = true;

  const guardedSelectors = [
    "[data-einvoice-send]",
    "[data-einvoice-delete]",
    "[data-invoice-delete]",
    "[data-delete-invoice]",
    "[data-action='invoice-delete']",
    "[data-context-action='invoice-delete']",
    "[data-context-action='delete-invoice']",
    "[data-action='delete-invoice']"
  ];

  const confirmed = new WeakSet();

  function textOf(target) {
    return String(target?.textContent || target?.value || "").trim().toLocaleLowerCase("tr-TR");
  }

  function findCriticalTarget(event) {
    const explicit = event.target.closest(guardedSelectors.join(","));
    if (explicit) return explicit;

    const button = event.target.closest("button,a,[role='button'],input[type='button'],input[type='submit']");
    if (!button) return null;

    const label = textOf(button);
    const action = String(button.dataset?.action || button.dataset?.contextAction || "").toLocaleLowerCase("tr-TR");
    const row = button.closest("[data-invoice-row],[data-einvoice-row],[data-draft-row],tr");
    const panel = button.closest('[data-view-panel="invoices"],[data-view-panel="einvoice"],#invoiceDialog,#invoiceForm');

    const looksLikeInvoiceDelete = panel && /sil|delete/.test(label + " " + action) && /fatura|invoice|taslak|draft/.test((row?.textContent || panel?.textContent || "").toLocaleLowerCase("tr-TR"));
    return looksLikeInvoiceDelete ? button : null;
  }

  function confirmMessage(target) {
    if (target.matches?.("[data-einvoice-send]")) {
      return "Bu işlem resmi e-Fatura gönderimi gibi kritik bir adımdır. Devam etmeden önce fatura bilgilerini, cari bilgilerini ve entegrasyon ortamını kontrol ettiniz mi?";
    }
    return "Bu fatura/taslak silme işlemi kritik olabilir. Silmeden önce emin misiniz?";
  }

  document.addEventListener("click", (event) => {
    const target = findCriticalTarget(event);
    if (!target || confirmed.has(target)) return;

    const first = window.confirm(confirmMessage(target));
    if (!first) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }

    const second = window.confirm("Son onay: Bu işlemi gerçekten yapmak istiyor musunuz?");
    if (!second) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }

    confirmed.add(target);
    setTimeout(() => confirmed.delete(target), 5000);
  }, true);
})();
