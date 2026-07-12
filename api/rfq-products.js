const DEFAULT_SUPABASE_URL = "https://jhjforyykkxklfarjtjl.supabase.co";

const env = () => ({
  supabaseUrl: (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, ""),
  serviceRoleKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SIDYA_SUPABASE_SERVICE_ROLE_KEY || "").trim(),
});

const clean = (value, fallback = "") => String(value ?? fallback).replace(/[<>]/g, "").trim();

async function supabaseFetch(path, options = {}) {
  const config = env();
  if (!config.serviceRoleKey) throw Object.assign(new Error("SUPABASE_SERVICE_ROLE_KEY eksik."), { statusCode: 501 });
  const response = await fetch(`${config.supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const error = new Error(await response.text() || `Supabase request failed: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

function normalizeProduct(row) {
  const id = clean(row.publish_key || row.catalog_id || row.id || row.sku || row.barcode);
  const name = clean(row.name || row.product_name || row.title || id, "Product");
  return {
    id,
    catalog_id: clean(row.catalog_id || row.publish_key || id),
    sku: clean(row.sku || row.barcode || row.catalog_id || id),
    barcode: clean(row.barcode || row.sku || ""),
    name,
    names: {
      tr: clean(row.name_tr || row.name || name, name),
      en: clean(row.name_en || row.name || name, name),
      ar: clean(row.name_ar || row.name_en || row.name || name, name),
      az: clean(row.name_az || row.name_en || row.name || name, name),
      ka: clean(row.name_ka || row.name_en || row.name || name, name),
      ru: clean(row.name_ru || row.name_en || row.name || name, name),
    },
    brand: clean(row.brand || ""),
    category: clean(row.category || row.product_category || ""),
    sourceCategory: clean(row.category || ""),
    grammage: clean(row.grammage || row.package_size || ""),
    unitsPerCarton: Math.max(Number(row.units_per_carton || row.carton_inner_quantity || 1), 1),
    kgPerCarton: Number(row.kg_per_carton || row.carton_weight_kg || 0) || 0,
    cartonsPerPallet: Number(row.cartons_per_pallet || row.pallet_carton_quantity || 0) || 0,
    minimumCarton: Math.max(Number(row.minimum_carton_quantity || row.minimum_stock || row.min_cartons || 1), 1),
    sale_price: Number(row.sale_price || 0) || null,
    currency: clean(row.currency || "USD", "USD"),
    active: row.active !== false,
  };
}

async function loadProducts() {
  let rows = [];
  try {
    rows = await supabaseFetch("/rest/v1/site_catalog_prices?active=eq.true&select=*&order=brand.asc,name.asc&limit=1000", { method: "GET" });
  } catch (error) {
    if (![404, 406].includes(error.statusCode)) throw error;
  }
  if (!Array.isArray(rows) || !rows.length) {
    rows = await supabaseFetch("/rest/v1/products?active=eq.true&select=*&order=brand.asc,name.asc&limit=1000", { method: "GET" });
  }
  return rows.map(normalizeProduct).filter((item) => item.id && item.name).slice(0, 1000);
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  try {
    const products = await loadProducts();
    return res.status(200).json({ ok: true, products });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, error: error.message || "Ürün listesi alınamadı." });
  }
};
