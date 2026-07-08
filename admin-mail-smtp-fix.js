(() => {
  if (window.__sidyaMailSmtpFix) return;
  window.__sidyaMailSmtpFix = true;

  const FIXED_NAME = "Sidya Global Export Department";
  const FIXED_EMAIL = "export@sidyaglobal.com";
  const $ = (selector, root = document) => root.querySelector(selector);

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

  function init() { lockSenderFields(); }
  setInterval(init, 700);
  document.addEventListener("DOMContentLoaded", init);
})();
