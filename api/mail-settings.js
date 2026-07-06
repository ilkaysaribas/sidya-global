const DEFAULT_SUPABASE_URL = "https://jhjforyykkxklfarjtjl.supabase.co";

const readEnv = (...names) => names.map((name) => String(process.env[name] || "").trim()).find(Boolean) || "";
const json = (res, status, body) => res.status(status).json(body);
const getSupabaseUrl = () => (readEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL") || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
const getServiceKey = () => readEnv("SUPABASE_SERVICE_ROLE_KEY", "SIDYA_SUPABASE_SERVICE_ROLE_KEY");

async function rest(path, options = {}) {
  const key = getServiceKey();
  if (!key) {
    const error = new Error("SUPABASE_SERVICE_ROLE_KEY eksik.");
    error.statusCode = 501;
    throw error;
  }
  const response = await fetch(`${getSupabaseUrl()}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = text;
  try { data = text ? JSON.parse(text) : null; } catch (_error) {}
  if (!response.ok) {
    const error = new Error("Supabase REST isteği başarısız.");
    error.statusCode = response.status;
    error.safeDetails = data;
    throw error;
  }
  return data;
}

async function assertAdmin(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    const error = new Error("Admin oturumu bulunamadı.");
    error.statusCode = 401;
    throw error;
  }
  const response = await fetch(`${getSupabaseUrl()}/auth/v1/user`, {
    headers: { apikey: getServiceKey(), Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const error = new Error("Admin oturumu doğrulanamadı.");
    error.statusCode = 401;
    throw error;
  }
  const user = await response.json();
  const admins = await rest(`admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`);
  if (!Array.isArray(admins) || !admins.length) {
    const error = new Error("Bu işlem için admin yetkisi gerekli.");
    error.statusCode = 403;
    throw error;
  }
  return user;
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    await assertAdmin(req);
    if (req.method === "GET") {
      const rows = await rest("mail_settings?id=eq.main&select=id,smtp_host,smtp_port,smtp_secure,smtp_user,sender_name,sender_email,updated_at,smtp_password");
      const row = Array.isArray(rows) && rows[0] ? rows[0] : {};
      delete row.smtp_password;
      row.hasPassword = Boolean((Array.isArray(rows) && rows[0] && rows[0].smtp_password) || readEnv("SMTP_PASSWORD", "MAIL_PASSWORD"));
      return json(res, 200, { ok: true, settings: row });
    }
    if (req.method === "POST") {
      const body = req.body || {};
      const currentRows = await rest("mail_settings?id=eq.main&select=smtp_password");
      const current = Array.isArray(currentRows) && currentRows[0] ? currentRows[0] : {};
      const payload = {
        id: "main",
        smtp_host: String(body.smtp_host || "").trim(),
        smtp_port: Number.parseInt(body.smtp_port, 10) || 587,
        smtp_secure: Boolean(body.smtp_secure),
        smtp_user: String(body.smtp_user || "").trim(),
        sender_name: String(body.sender_name || "Sidya Global Export").trim(),
        sender_email: String(body.sender_email || "export@sidyaglobal.com").trim(),
      };
      if (String(body.smtp_password || "").trim()) payload.smtp_password = String(body.smtp_password).trim();
      else if (current.smtp_password) payload.smtp_password = current.smtp_password;
      await rest("mail_settings?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(payload) });
      return json(res, 200, { ok: true, message: "Mail ayarları kaydedildi." });
    }
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    return json(res, error.statusCode || 500, { ok: false, error: error.message, details: error.safeDetails || null });
  }
};
