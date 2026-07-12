const currencyConfig = require("../rfq-currencies.js");

const DEFAULT_SUPABASE_URL = "https://jhjforyykkxklfarjtjl.supabase.co";
const MAX_BODY_SIZE = 4 * 1024 * 1024;
const RFQ_SOURCE = "Sidya Global Website RFQ";
const DEFAULT_RATES_TO_TRY = {
  TRY: 1,
  USD: 32,
  EUR: 35,
  GEL: 12,
  RUB: 0.35,
  AZN: 18.8,
  GBP: 41,
  CNY: 4.4,
  AED: 8.7,
  SAR: 8.5,
  QAR: 8.8,
  KWD: 104,
  IQD: 0.024,
  KZT: 0.07,
  UAH: 0.78,
  MDL: 1.8,
  AMD: 0.083,
  IRR: 0.00076,
};

const RFQ_STATUSES = [
  "new", "under_review", "missing_information", "supplier_price_requested", "pricing_completed", "quote_prepared", "quote_sent", "customer_review", "negotiation", "accepted", "rejected", "expired", "converted_to_proforma", "converted_to_order", "cancelled"
];

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY_SIZE) {
      reject(Object.assign(new Error("RFQ verisi çok büyük."), { statusCode: 413 }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  req.on("error", reject);
});

const parseBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return JSON.parse((await readBody(req)) || "{}");
};

const cleanText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").trim().slice(0, max);
const parsePositiveInt = (value, label) => {
  if (value === "" || value === null || value === undefined) throw Object.assign(new Error(`${label} zorunludur.`), { statusCode: 400 });
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) throw Object.assign(new Error(`${label} yalnızca pozitif tam sayı olabilir.`), { statusCode: 400 });
  const number = Number(text);
  if (!Number.isSafeInteger(number) || number <= 0) throw Object.assign(new Error(`${label} sıfırdan büyük olmalıdır.`), { statusCode: 400 });
  return number;
};
const parseTargetPrice = (value) => {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,4})?$/.test(text)) throw Object.assign(new Error("Hedef koli fiyatı sıfırdan büyük ve en fazla 4 ondalıklı olmalıdır."), { statusCode: 400 });
  const number = Number(text);
  if (!Number.isFinite(number) || number <= 0) throw Object.assign(new Error("Hedef koli fiyatı sıfırdan büyük olmalıdır."), { statusCode: 400 });
  return number;
};
const round = (value, digits = 4) => Number(Number(value || 0).toFixed(digits));
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

const getEnv = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SIDYA_SUPABASE_SERVICE_ROLE_KEY || "";
  return {
    supabaseUrl: (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, ""),
    serviceRoleKey: serviceRoleKey.trim(),
  };
};

const requireEnv = () => {
  const env = getEnv();
  if (!env.serviceRoleKey) throw Object.assign(new Error("SUPABASE_SERVICE_ROLE_KEY eksik."), { statusCode: 501 });
  return env;
};

const supabaseFetch = async (path, options = {}, env = requireEnv()) => {
  const response = await fetch(`${env.supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || `Supabase request failed: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : response.text();
};

const queryProducts = async (items, env) => {
  const ids = [...new Set(items.map((item) => cleanText(item.product_id || item.productId || item.id, 120)).filter(Boolean))];
  if (!ids.length) return new Map();
  const uuidIds = ids.filter(isUuid);
  const textIds = ids.filter((id) => !isUuid(id));
  const found = [];
  if (uuidIds.length) found.push(...await supabaseFetch(`/rest/v1/products?id=in.(${uuidIds.join(",")})&select=*`, { method: "GET" }, env));
  for (const id of textIds.slice(0, 80)) {
    const encoded = encodeURIComponent(id);
    const rows = await supabaseFetch(`/rest/v1/products?or=(catalog_id.eq.${encoded},sku.eq.${encoded},barcode.eq.${encoded})&select=*&limit=1`, { method: "GET" }, env);
    if (rows[0]) found.push(rows[0]);
  }
  return found.reduce((map, product) => {
    [product.id, product.catalog_id, product.sku, product.barcode].filter(Boolean).forEach((key) => map.set(String(key), product));
    return map;
  }, new Map());
};

const buildRatesSnapshot = (body) => {
  const sourceRates = body.exchangeRateSnapshot?.rates || body.exchange_rates || body.rates || {};
  const rates = { ...DEFAULT_RATES_TO_TRY };
  Object.keys(sourceRates).forEach((code) => {
    const normalized = currencyConfig.normalizeCurrency(code, "");
    const value = Number(sourceRates[code]);
    if (normalized && Number.isFinite(value) && value > 0) rates[normalized] = value;
  });
  return {
    source: Object.keys(sourceRates).length ? "client snapshot with server fallback" : "server fallback",
    date: new Date().toISOString().slice(0, 10),
    rates,
  };
};

const findOrCreateLead = async (body, env) => {
  const email = cleanText(body.email, 240).toLowerCase();
  const tax = cleanText(body.registration_number || body.tax_number, 120);
  let rows = [];
  if (email) rows = await supabaseFetch(`/rest/v1/customers?email=eq.${encodeURIComponent(email)}&select=*&limit=1`, { method: "GET" }, env);
  if (!rows.length && tax) rows = await supabaseFetch(`/rest/v1/customers?tax_number=eq.${encodeURIComponent(tax)}&select=*&limit=1`, { method: "GET" }, env);
  if (rows[0]) return rows[0];
  if (!body.company_name && !body.company) return null;
  const created = await supabaseFetch("/rest/v1/customers", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      company: cleanText(body.company_name || body.company, 240),
      contact_name: cleanText(body.contact_name || body.contact, 160),
      email,
      phone: cleanText(body.phone || body.whatsapp, 80),
      country: cleanText(body.country_name || body.country_code || body.country, 120),
      tax_number: tax,
      currency: currencyConfig.normalizeCurrency(body.default_currency, "USD"),
      status: "passive",
      notes: "Lead / doğrulanmamış müşteri. Kaynak: Sidya Global Website RFQ",
    }),
  }, env);
  return created?.[0] || null;
};

const normalizeItem = (item, product, ratesSnapshot, allowBelowMinimum) => {
  const requestedCartons = parsePositiveInt(item.requested_cartons || item.cartons, "Koli adedi");
  const targetUnitPrice = parseTargetPrice(item.target_unit_price || item.targetPrice);
  const currencyCode = currencyConfig.normalizeCurrency(item.currency_code || item.currency, "");
  if (!currencyConfig.byCode[currencyCode]) throw Object.assign(new Error("Para birimi seçilmelidir."), { statusCode: 400 });
  const minCarton = Math.max(Number(product?.minimum_carton_quantity || product?.minimum_stock || item.minimum_carton_quantity || 0), 0);
  const belowMinimum = minCarton > 0 && requestedCartons < minCarton;
  const specialReviewRequested = Boolean(item.special_review_requested || item.specialReviewRequested);
  if (belowMinimum && !allowBelowMinimum && !specialReviewRequested) {
    throw Object.assign(new Error(`Bu ürün için minimum sipariş miktarı ${minCarton} kolidir.`), { statusCode: 400 });
  }
  const unitsPerCarton = Math.max(Number(product?.units_per_carton || item.carton_inner_quantity || item.unitsPerCarton || 1), 1);
  const kgPerCarton = Number(product?.kg_per_carton || item.carton_weight_kg || item.kgPerCarton || 0) || 0;
  const cartonsPerPallet = Number(product?.cartons_per_pallet || item.pallet_carton_quantity || item.cartonsPerPallet || 0) || 0;
  const lineTotal = round(requestedCartons * targetUnitPrice, 4);
  const rateToTry = Number(ratesSnapshot.rates[currencyCode] || 0) || null;
  return {
    product_id: isUuid(product?.id) ? product.id : null,
    product_name_snapshot: cleanText(product?.name || item.product_name || item.name || item.product, 300),
    brand_snapshot: cleanText(product?.brand || item.brand, 160),
    barcode_snapshot: cleanText(product?.barcode || item.barcode, 120),
    sku_snapshot: cleanText(product?.sku || item.sku || item.product_id || item.productId, 120),
    carton_inner_quantity: unitsPerCarton,
    carton_weight_kg: kgPerCarton,
    pallet_carton_quantity: cartonsPerPallet || null,
    minimum_carton_quantity: minCarton || null,
    requested_cartons: requestedCartons,
    requested_units: round(requestedCartons * unitsPerCarton, 3),
    target_unit_price: targetUnitPrice,
    currency_code: currencyCode,
    target_line_total: lineTotal,
    exchange_rate_to_try: rateToTry,
    target_line_total_try: rateToTry ? round(lineTotal * rateToTry, 2) : null,
    customer_note: cleanText(item.customer_note || item.note, 1000),
    below_minimum: belowMinimum,
    special_review_requested: specialReviewRequested,
    missing_logistics_data: !kgPerCarton || !cartonsPerPallet,
  };
};

const aggregate = (items) => {
  const totalsByCurrency = {};
  items.forEach((item) => {
    totalsByCurrency[item.currency_code] = round((totalsByCurrency[item.currency_code] || 0) + item.target_line_total, 4);
  });
  const totalCartons = items.reduce((sum, item) => sum + item.requested_cartons, 0);
  const totalUnits = items.reduce((sum, item) => sum + Number(item.requested_units || 0), 0);
  const grossKg = items.reduce((sum, item) => sum + item.requested_cartons * Number(item.carton_weight_kg || 0), 0);
  const pallets = items.reduce((sum, item) => item.pallet_carton_quantity ? sum + item.requested_cartons / Number(item.pallet_carton_quantity) : sum, 0);
  return {
    totalsByCurrency,
    totalCartons,
    totalUnits: round(totalUnits, 3),
    estimatedPallets: round(pallets, 2),
    estimatedGrossWeightKg: round(grossKg, 2),
    estimatedNetWeightKg: round(grossKg * 0.92, 2),
    estimatedVolumeM3: round(pallets * 1.65, 2),
    truckFillPercent: round(Math.min(100, grossKg / 24000 * 100), 2),
    container20FillPercent: round(Math.min(100, grossKg / 21000 * 100), 2),
    container40hcFillPercent: round(Math.min(100, grossKg / 26500 * 100), 2),
  };
};

const createRfq = async (req) => {
  const env = requireEnv();
  const body = await parseBody(req);
  if (cleanText(body.website, 120)) throw Object.assign(new Error("Spam kontrolü başarısız."), { statusCode: 400 });
  const sourceItems = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
  if (!sourceItems.length) throw Object.assign(new Error("RFQ için en az bir ürün seçilmelidir."), { statusCode: 400 });
  if (!body.consent_privacy) throw Object.assign(new Error("KVKK / gizlilik onayı zorunludur."), { statusCode: 400 });
  if (!body.consent_accuracy) throw Object.assign(new Error("Bilgilerin doğruluğu onayı zorunludur."), { statusCode: 400 });

  const products = await queryProducts(sourceItems, env);
  const ratesSnapshot = buildRatesSnapshot(body);
  const allowBelowMinimum = Boolean(body.allow_below_minimum);
  const items = sourceItems.map((item) => {
    const key = cleanText(item.product_id || item.productId || item.id || item.sku || item.barcode, 120);
    return normalizeItem(item, products.get(key), ratesSnapshot, allowBelowMinimum);
  });
  const summary = aggregate(items);
  const customer = await findOrCreateLead(body, env);
  const requestRows = await supabaseFetch("/rest/v1/rfq_requests", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      customer_id: customer?.id || null,
      company_name: cleanText(body.company_name || body.company, 240),
      contact_name: cleanText(body.contact_name || body.contact, 160),
      email: cleanText(body.email, 240).toLowerCase(),
      phone: cleanText(body.phone, 80),
      whatsapp: cleanText(body.whatsapp, 80),
      country_code: cleanText(body.country_code, 20),
      country_name: cleanText(body.country_name || body.country, 120),
      city: cleanText(body.city, 120),
      registration_number: cleanText(body.registration_number || body.tax_number, 120),
      preferred_language: cleanText(body.preferred_language || body.lang || "tr", 10),
      destination_country: cleanText(body.destination_country, 120),
      destination_city_or_port: cleanText(body.destination_city_or_port, 160),
      incoterm: cleanText(body.incoterm, 20),
      shipping_method: cleanText(body.shipping_method, 80),
      expected_purchase_date: cleanText(body.expected_purchase_date, 20) || null,
      payment_preference: cleanText(body.payment_preference, 120),
      requested_validity_days: Number(body.requested_validity_days || 0) || null,
      general_note: cleanText(body.general_note || body.notes, 2000),
      urgent: Boolean(body.urgent),
      special_review_required: items.some((item) => item.below_minimum || item.special_review_requested),
      total_cartons: summary.totalCartons,
      total_units: summary.totalUnits,
      estimated_pallets: summary.estimatedPallets,
      estimated_gross_weight_kg: summary.estimatedGrossWeightKg,
      estimated_net_weight_kg: summary.estimatedNetWeightKg,
      estimated_volume_m3: summary.estimatedVolumeM3,
      truck_fill_percent: summary.truckFillPercent,
      container_20_fill_percent: summary.container20FillPercent,
      container_40hc_fill_percent: summary.container40hcFillPercent,
      status: "new",
      source: RFQ_SOURCE,
      exchange_rate_date: ratesSnapshot.date,
      exchange_rate_snapshot: { ...ratesSnapshot, totals_by_currency: summary.totalsByCurrency },
      consent_privacy: Boolean(body.consent_privacy),
      consent_commercial: Boolean(body.consent_commercial),
      ip_address: cleanText(req.headers["x-forwarded-for"] || req.socket?.remoteAddress, 120),
      user_agent: cleanText(req.headers["user-agent"], 300),
    }),
  }, env);
  const rfq = requestRows?.[0];
  if (!rfq?.id) throw new Error("RFQ kaydı oluşturulamadı.");
  const itemRows = await supabaseFetch("/rest/v1/rfq_request_items", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(items.map((item) => ({ ...item, rfq_id: rfq.id }))),
  }, env);
  await supabaseFetch("/rest/v1/rfq_status_history", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ rfq_id: rfq.id, previous_status: null, new_status: "new", note: "Website RFQ oluşturuldu." }),
  }, env).catch(() => null);
  return { ok: true, rfq, items: itemRows || [], summary };
};

const listRfq = async (req) => {
  const env = requireEnv();
  const url = new URL(req.url, "https://sidyaglobal.com");
  const status = cleanText(url.searchParams.get("status"), 40);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 250);
  const statusFilter = status && RFQ_STATUSES.includes(status) ? `&status=eq.${encodeURIComponent(status)}` : "";
  const rows = await supabaseFetch(`/rest/v1/rfq_requests?select=*&order=created_at.desc&limit=${limit}${statusFilter}`, { method: "GET" }, env);
  return { ok: true, rfqs: rows || [] };
};

const getRfq = async (id) => {
  const env = requireEnv();
  const rows = await supabaseFetch(`/rest/v1/rfq_requests?id=eq.${encodeURIComponent(id)}&select=*`, { method: "GET" }, env);
  const rfq = rows?.[0];
  if (!rfq) throw Object.assign(new Error("RFQ bulunamadı."), { statusCode: 404 });
  const items = await supabaseFetch(`/rest/v1/rfq_request_items?rfq_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.asc`, { method: "GET" }, env);
  return { ok: true, rfq, items: items || [] };
};

const patchRfq = async (id, req) => {
  const env = requireEnv();
  const body = await parseBody(req);
  const patch = {};
  if (body.status && RFQ_STATUSES.includes(body.status)) patch.status = body.status;
  if (body.assigned_user_id !== undefined) patch.assigned_user_id = body.assigned_user_id || null;
  if (body.note !== undefined) patch.general_note = cleanText(body.note, 2000);
  patch.updated_at = new Date().toISOString();
  const rows = await supabaseFetch(`/rest/v1/rfq_requests?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch),
  }, env);
  return { ok: true, rfq: rows?.[0] };
};

const convertToProforma = async (id) => {
  const env = requireEnv();
  const detail = await getRfq(id);
  if (detail.rfq.converted_proforma_id) throw Object.assign(new Error("Bu RFQ daha önce proformaya dönüştürülmüş."), { statusCode: 409 });
  const orderNo = `RFQ-PROFORMA-${detail.rfq.rfq_number || id}`;
  const payload = {
    order_no: orderNo,
    customer_company: detail.rfq.company_name,
    customer_name: detail.rfq.contact_name,
    customer_email: detail.rfq.email,
    customer_phone: detail.rfq.phone || detail.rfq.whatsapp,
    currency: detail.items[0]?.currency_code || "USD",
    transport: detail.rfq.shipping_method,
    items: detail.items.map((item) => ({
      productId: item.product_id || item.sku_snapshot,
      barcode: item.barcode_snapshot,
      brand: item.brand_snapshot,
      product: item.product_name_snapshot,
      cartons: item.requested_cartons,
      unitsPerCarton: item.carton_inner_quantity,
      kgPerCarton: item.carton_weight_kg,
      targetUnitPrice: item.target_unit_price,
      currency: item.currency_code,
      sourceRfqId: id,
    })),
    total_cartons: detail.rfq.total_cartons,
    total_pallets: detail.rfq.estimated_pallets,
    total_weight: detail.rfq.estimated_gross_weight_kg,
    notes: `RFQ referansı: ${detail.rfq.rfq_number || id}`,
    source_rfq_id: id,
    status: "new",
  };
  const rows = await supabaseFetch("/rest/v1/site_orders?on_conflict=order_no", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload),
  }, env);
  const order = rows?.[0];
  await supabaseFetch(`/rest/v1/rfq_requests?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "converted_to_proforma", converted_proforma_id: order?.id || null, updated_at: new Date().toISOString() }),
  }, env);
  return { ok: true, order, orderNo };
};

module.exports = { createRfq, listRfq, getRfq, patchRfq, convertToProforma, parseBody, RFQ_STATUSES, RFQ_SOURCE, currencyConfig };
