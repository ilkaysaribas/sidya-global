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

async function assertAdmin(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) { const error = new Error("Admin oturumu bulunamadı."); error.statusCode = 401; throw error; }
  const response = await fetch(`${getSupabaseUrl()}/auth/v1/user`, { headers: { apikey: getServiceKey(), Authorization: `Bearer ${token}` } });
  if (!response.ok) { const error = new Error("Admin oturumu doğrulanamadı."); error.statusCode = 401; throw error; }
  const user = await response.json();
  const admins = await rest(`admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`);
  if (!Array.isArray(admins) || !admins.length) { const error = new Error("Bu işlem için admin yetkisi gerekli."); error.statusCode = 403; throw error; }
  return user;
}

async function loadSettings() {
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

async function sendMail({ to, subject, body }) {
  const settings = await loadSettings();
  if (!settings.host || !settings.user || !settings.pass) {
    const error = new Error("SMTP ayarları eksik. Mail Center > SMTP ayarlarını kaydedin.");
    error.statusCode = 400;
    throw error;
  }
  const transporter = nodemailer.createTransport({ host: settings.host, port: settings.port, secure: settings.secure, auth: { user: settings.user, pass: settings.pass } });
  return transporter.sendMail({ from: `"${settings.senderName}" <${settings.senderEmail}>`, to, subject, text: body, html: String(body || "").replace(/\n/g, "<br>") });
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  try {
    await assertAdmin(req);
    const { to, subject, body, customerId, type } = req.body || {};
    if (!to || !subject) return res.status(400).json({ ok: false, error: "Alıcı ve konu gerekli." });
    await sendMail({ to, subject, body: body || "" });
    if (customerId) {
      await rest("crm_interactions", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ customer_id: customerId, type: type || "email", direction: "outbound", subject, body: body || "" }) });
      await rest(`crm_customers?id=eq.${encodeURIComponent(customerId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_contact_at: new Date().toISOString() }) });
    }
    res.status(200).json({ ok: true, message: "Mail gönderildi." });
  } catch (error) {
    res.status(error.statusCode || 500).json({ ok: false, error: error.message, details: error.safeDetails || null });
  }
};
