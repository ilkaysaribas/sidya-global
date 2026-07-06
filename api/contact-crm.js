const nodemailer = require("nodemailer");
const DEFAULT_SUPABASE_URL = "https://jhjforyykkxklfarjtjl.supabase.co";
const readEnv = (...names) => names.map((name) => String(process.env[name] || "").trim()).find(Boolean) || "";
const getSupabaseUrl = () => (readEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL") || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
const getServiceKey = () => readEnv("SUPABASE_SERVICE_ROLE_KEY", "SIDYA_SUPABASE_SERVICE_ROLE_KEY");

async function rest(path, options = {}) {
  const key = getServiceKey();
  if (!key) { const error = new Error("SUPABASE_SERVICE_ROLE_KEY eksik."); error.statusCode = 501; throw error; }
  const response = await fetch(`${getSupabaseUrl()}/rest/v1/${path}`, { ...options, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(options.headers || {}) } });
  const text = await response.text();
  let data = text;
  try { data = text ? JSON.parse(text) : null; } catch (_error) {}
  if (!response.ok) { const error = new Error("Supabase REST isteği başarısız."); error.statusCode = response.status; error.safeDetails = data; throw error; }
  return data;
}

async function loadMailSettings() {
  const rows = await rest("mail_settings?id=eq.main&select=*");
  const row = Array.isArray(rows) && rows[0] ? rows[0] : {};
  return {
    host: readEnv("SMTP_HOST", "MAIL_HOST") || row.smtp_host,
    port: Number(readEnv("SMTP_PORT", "MAIL_PORT") || row.smtp_port || 587),
    secure: String(readEnv("SMTP_SECURE", "MAIL_SECURE") || row.smtp_secure || "").toLowerCase() === "true" || Number(readEnv("SMTP_PORT", "MAIL_PORT") || row.smtp_port) === 465,
    user: readEnv("SMTP_USER", "MAIL_USER") || row.smtp_user,
    pass: readEnv("SMTP_PASSWORD", "MAIL_PASSWORD") || row.smtp_password,
    senderName: readEnv("SMTP_SENDER_NAME", "MAIL_SENDER_NAME") || row.sender_name || "Sidya Global Export",
    senderEmail: readEnv("SMTP_SENDER_EMAIL", "MAIL_SENDER_EMAIL") || row.sender_email || "export@sidyaglobal.com",
  };
}

async function sendNotification(payload) {
  const settings = await loadMailSettings();
  if (!settings.host || !settings.user || !settings.pass) return { ok: false, skipped: true, reason: "SMTP ayarları eksik." };
  const transporter = nodemailer.createTransport({ host: settings.host, port: settings.port, secure: settings.secure, auth: { user: settings.user, pass: settings.pass } });
  const subject = `Sidya Global talep - ${payload.company_name || payload.contact_name || payload.email || "Yeni müşteri"}`;
  const body = [
    `Firma: ${payload.company_name || "-"}`,
    `Yetkili: ${payload.contact_name || "-"}`,
    `E-posta: ${payload.email || "-"}`,
    `Telefon: ${payload.phone || "-"}`,
    `WhatsApp: ${payload.whatsapp || "-"}`,
    `Ülke: ${payload.country || "-"}`,
    `İlgilendiği ürün: ${payload.interested_products || "-"}`,
    "",
    payload.notes || "",
  ].join("\n");
  await transporter.sendMail({ from: `"${settings.senderName}" <${settings.senderEmail}>`, to: "export@sidyaglobal.com", subject, text: body, html: body.replace(/\n/g, "<br>") });
  return { ok: true };
}

const addDays = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
const value = (body, ...keys) => keys.map((key) => body[key]).find((item) => item !== undefined && item !== null && String(item).trim() !== "") || "";

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  try {
    const body = req.body || {};
    const email = String(value(body, "email", "mail") || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: "E-posta gerekli." });
    const payload = {
      company_name: String(value(body, "company", "company_name") || "").trim(),
      contact_name: String(value(body, "name", "contact", "contact_name") || "").trim(),
      country: String(value(body, "country") || "").trim(),
      email,
      phone: String(value(body, "phone", "tel") || "").trim(),
      whatsapp: String(value(body, "whatsapp") || "").trim(),
      source: String(value(body, "source") || "website_contact").trim(),
      interested_products: String(value(body, "product", "interested_products") || "").trim(),
      status: "lead",
      last_contact_at: new Date().toISOString(),
      next_follow_up_at: addDays(15),
      notes: String(value(body, "message", "notes", "body") || "").trim(),
    };

    const existing = await rest(`crm_customers?email=eq.${encodeURIComponent(email)}&select=*`);
    let customer;
    if (Array.isArray(existing) && existing.length) {
      const current = existing[0];
      const update = {
        company_name: payload.company_name || current.company_name,
        contact_name: payload.contact_name || current.contact_name,
        country: payload.country || current.country,
        phone: payload.phone || current.phone,
        whatsapp: payload.whatsapp || current.whatsapp,
        interested_products: payload.interested_products || current.interested_products,
        last_contact_at: payload.last_contact_at,
        next_follow_up_at: current.next_follow_up_at || payload.next_follow_up_at,
        notes: [current.notes, payload.notes].filter(Boolean).join("\n---\n"),
      };
      const rows = await rest(`crm_customers?id=eq.${encodeURIComponent(current.id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(update) });
      customer = Array.isArray(rows) ? rows[0] : rows;
    } else {
      const rows = await rest("crm_customers", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) });
      customer = Array.isArray(rows) ? rows[0] : rows;
    }

    await rest("crm_interactions", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ customer_id: customer.id, type: "form", direction: "inbound", subject: `Website talebi - ${payload.interested_products || "Genel"}`, body: payload.notes }) });
    let mail = { ok: false, skipped: true };
    try { mail = await sendNotification(payload); } catch (error) { mail = { ok: false, error: error.message }; }
    res.status(200).json({ ok: true, customerId: customer.id, mailSent: Boolean(mail.ok), mail });
  } catch (error) {
    res.status(error.statusCode || 500).json({ ok: false, error: error.message, details: error.safeDetails || null });
  }
};
