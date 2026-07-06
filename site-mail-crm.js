(() => {
  if (window.__sidyaSiteMailCrm) return;
  window.__sidyaSiteMailCrm = true;

  const getStatus = (form) => form.querySelector(".form-status") || document.querySelector("#formStatus");
  const text = (form, name) => String(new FormData(form).get(name) || "").trim();

  async function submitToCrm(form) {
    const status = getStatus(form);
    if (status) status.textContent = "Talebiniz CRM'e kaydediliyor...";
    const payload = {
      name: text(form, "name"),
      company: text(form, "company"),
      email: text(form, "email"),
      phone: text(form, "phone"),
      whatsapp: text(form, "whatsapp"),
      country: text(form, "country"),
      product: text(form, "product"),
      message: text(form, "message"),
      source: "website_quote_form",
    };
    const response = await fetch("/api/contact-crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || "CRM kaydı oluşturulamadı.");
    if (status) status.textContent = result.mailSent ? "Talebiniz alındı ve mail olarak iletildi." : "Talebiniz CRM'e kaydedildi. Mail ayarı eksikse panelden tamamlanabilir.";
    form.reset();
  }

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== "quoteForm") return;
    if (window.location.protocol === "file:") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    submitToCrm(form).catch((error) => {
      const status = getStatus(form);
      if (status) status.textContent = `CRM gönderimi başarısız: ${error.message}`;
    });
  }, true);
})();
