const PROJECT_REF = "jhjforyykkxklfarjtjl";
const DEFAULT_SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const rateBuckets = new Map();

const readEnv = (...names) => names.map((name) => String(process.env[name] || "").trim()).find(Boolean) || "";
const stripBearer = (value) => String(value || "").trim().replace(/^Bearer\s+/i, "").replace(/^['\"]|['\"]$/g, "").trim();
const supabaseUrl = () => (readEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL") || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
const serviceKey = () => readEnv("SUPABASE_SERVICE_ROLE_KEY", "SIDYA_SUPABASE_SERVICE_ROLE_KEY");

function json(res, status, body) {
  res.status(status).json(body);
}

function parseBody(req) {
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body || {};
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
}

function rateLimit(req, key, limit = 20, windowMs = 60_000) {
  const id = `${key}:${clientIp(req)}`;
  const now = Date.now();
  const current = rateBuckets.get(id) || { count: 0, reset: now + windowMs };
  if (current.reset <= now) {
    current.count = 0;
    current.reset = now + windowMs;
  }
  current.count += 1;
  rateBuckets.set(id, current);
  if (current.count > limit) {
    const error = new Error("Cok fazla istek. Lutfen biraz sonra tekrar deneyin.");
    error.statusCode = 429;
    throw error;
  }
}

async function rest(path, options = {}) {
  const key = serviceKey();
  if (!key) {
    const error = new Error("SUPABASE_SERVICE_ROLE_KEY eksik.");
    error.statusCode = 501;
    throw error;
  }
  const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
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
    const error = new Error("Supabase REST istegi basarisiz.");
    error.statusCode = response.status;
    error.safeDetails = data;
    throw error;
  }
  return data;
}

async function assertAdmin(req) {
  const token = stripBearer(req.headers.authorization);
  if (!token) {
    const error = new Error("Admin oturumu bulunamadi. Lutfen tekrar giris yapin.");
    error.statusCode = 401;
    throw error;
  }
  const key = serviceKey();
  if (!key) {
    const error = new Error("SUPABASE_SERVICE_ROLE_KEY eksik.");
    error.statusCode = 501;
    throw error;
  }
  const response = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const error = new Error("Admin oturumu dogrulanamadi. Lutfen tekrar giris yapin.");
    error.statusCode = 401;
    throw error;
  }
  const user = await response.json();
  const admins = await rest(`admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`);
  if (!Array.isArray(admins) || !admins.length) {
    const error = new Error("Bu islem icin admin yetkisi gerekli.");
    error.statusCode = 403;
    throw error;
  }
  return user;
}

function cleanIds(value) {
  const ids = Array.isArray(value) ? value : [];
  const unique = [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!unique.length) {
    const error = new Error("Once en az bir urun secin.");
    error.statusCode = 400;
    throw error;
  }
  if (unique.length > 100) {
    const error = new Error("Tek seferde en fazla 100 urun silinebilir.");
    error.statusCode = 400;
    throw error;
  }
  return unique;
}

async function firstLinkedRecord(table, productId) {
  try {
    const data = await rest(`${table}?product_id=eq.${encodeURIComponent(productId)}&select=product_id&limit=1`);
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (error) {
    if (error.statusCode === 404) return null;
    throw error;
  }
}

async function findBlockingRelation(ids) {
  const relationChecks = [
    { table: "stock_movements", label: "stok hareketleri" },
    { table: "invoice_items", label: "fatura satirlari" },
    { table: "document_items", label: "belge satirlari" },
  ];
  for (const productId of ids) {
    for (const relation of relationChecks) {
      const linked = await firstLinkedRecord(relation.table, productId);
      if (linked) return { productId, label: relation.label };
    }
  }
  return null;
}

async function deleteProducts(ids) {
  const deletedIds = [];
  for (const productId of ids) {
    const rows = await rest(`products?id=eq.${encodeURIComponent(productId)}&select=id`, {
      method: "DELETE",
      headers: { Prefer: "return=representation" },
    });
    if (Array.isArray(rows) && rows.length) deletedIds.push(productId);
  }
  return deletedIds;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    rateLimit(req, "admin-products-delete", 20, 60_000);
    await assertAdmin(req);
    const body = parseBody(req);
    const action = String(body.action || req.query?.action || "delete").toLowerCase();
    if (action !== "delete") return json(res, 400, { ok: false, error: "Desteklenmeyen islem." });

    const ids = cleanIds(body.ids);
    const blocker = await findBlockingRelation(ids);
    if (blocker) {
      return json(res, 409, {
        ok: false,
        code: "PRODUCT_HAS_LINKED_RECORDS",
        error: `Bu urune bagli ${blocker.label} bulunduğu icin silinemiyor. Stok gecmisi korunmak icin urun karti silinmedi.`,
      });
    }

    const deletedIds = await deleteProducts(ids);
    if (!deletedIds.length) {
      return json(res, 403, { ok: false, error: "Urun silinemedi. Admin yetkisi veya veritabani politikasi islemi engelledi." });
    }

    return json(res, 200, { ok: true, deletedCount: deletedIds.length, deletedIds });
  } catch (error) {
    const details = error?.safeDetails;
    const pgCode = details && typeof details === "object" ? details.code : "";
    const pgMessage = details && typeof details === "object" ? details.message : "";
    console.error("admin-products delete failed", {
      statusCode: error.statusCode || 500,
      message: error.message,
      pgCode,
      pgMessage,
    });
    if (/23503|foreign key|violates|reference/i.test(`${pgCode} ${pgMessage} ${error.message}`)) {
      return json(res, 409, {
        ok: false,
        code: "PRODUCT_HAS_LINKED_RECORDS",
        error: "Bu urune bagli stok hareketleri veya fatura satirlari bulunduğu icin silinemiyor.",
      });
    }
    const status = Number(error.statusCode || 500);
    const safeStatus = status >= 400 && status < 600 ? status : 500;
    const safeMessage = safeStatus >= 500 ? "Urun silinemedi. Sunucu loglarini kontrol edin." : error.message;
    return json(res, safeStatus, { ok: false, error: safeMessage });
  }
};
