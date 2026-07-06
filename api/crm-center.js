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

const customerFields = ["company_name", "contact_name", "country", "email", "phone", "whatsapp", "source", "interested_products", "status", "last_contact_at", "next_follow_up_at", "notes"];
const cleanCustomer = (body = {}) => customerFields.reduce((acc, key) => {
  if (Object.prototype.hasOwnProperty.call(body, key)) acc[key] = body[key] === "" ? null : body[key];
  return acc;
}, {});

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    await assertAdmin(req);
    const action = req.query.action || "customers";
    if (req.method === "GET" && action === "customers") {
      const rows = await rest("crm_customers?select=*&order=created_at.desc");
      return res.status(200).json({ ok: true, customers: rows || [] });
    }
    if (req.method === "GET" && action === "interactions") {
      const id = String(req.query.customerId || "");
      if (!id) return res.status(400).json({ ok: false, error: "customerId gerekli." });
      const rows = await rest(`crm_interactions?customer_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.desc`);
      return res.status(200).json({ ok: true, interactions: rows || [] });
    }
    if (req.method === "POST" && action === "customer") {
      const payload = cleanCustomer(req.body || {});
      const rows = await rest("crm_customers", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) });
      return res.status(200).json({ ok: true, customer: Array.isArray(rows) ? rows[0] : rows });
    }
    if (req.method === "PATCH" && action === "customer") {
      const id = String((req.body || {}).id || "");
      if (!id) return res.status(400).json({ ok: false, error: "Müşteri id gerekli." });
      const rows = await rest(`crm_customers?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(cleanCustomer(req.body || {})) });
      return res.status(200).json({ ok: true, customer: Array.isArray(rows) ? rows[0] : rows });
    }
    if (req.method === "POST" && action === "interaction") {
      const body = req.body || {};
      if (!body.customer_id) return res.status(400).json({ ok: false, error: "customer_id gerekli." });
      const rows = await rest("crm_interactions", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ customer_id: body.customer_id, type: body.type || "note", direction: body.direction || "internal", subject: body.subject || "Not", body: body.body || "" }) });
      return res.status(200).json({ ok: true, interaction: Array.isArray(rows) ? rows[0] : rows });
    }
    res.status(405).json({ ok: false, error: "Desteklenmeyen CRM işlemi." });
  } catch (error) {
    res.status(error.statusCode || 500).json({ ok: false, error: error.message, details: error.safeDetails || null });
  }
};
