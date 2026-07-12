const DEFAULT_SUPABASE_URL = "https://jhjforyykkxklfarjtjl.supabase.co";
const MAX_BODY_SIZE = 1024 * 1024;

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY_SIZE) {
      reject(Object.assign(new Error("Sipariş verisi çok büyük."), { statusCode: 413 }));
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
  return JSON.parse((await readBody(req)) || "{}");
};

const cleanText = (value, max = 240) => String(value || "").replace(/[<>]/g, "").trim().slice(0, max);
const cleanNumber = (value) => Math.max(0, Number(value) || 0);
const parseIntCartons = (value) => {
  if (!/^\d+$/.test(String(value || ""))) throw Object.assign(new Error("Koli adedi yalnızca pozitif tam sayı olabilir."), { statusCode: 400 });
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw Object.assign(new Error("Koli adedi sıfırdan büyük olmalıdır."), { statusCode: 400 });
  return number;
};
const parsePrice = (value) => {
  const text = String(value || "").replace(",", ".");
  if (!/^\d+(?:\.\d{1,4})?$/.test(text)) throw Object.assign(new Error("Hedef koli fiyatı en fazla 4 ondalık destekler."), { statusCode: 400 });
  const number = Number(text);
  if (!Number.isFinite(number) || number <= 0) throw Object.assign(new Error("Hedef koli fiyatı sıfırdan büyük olmalıdır."), { statusCode: 400 });
  return number;
};

const supabaseRequest = async (path, options, serviceRoleKey) => {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw Object.assign(new Error(await response.text()), { statusCode: response.status });
  return response.status === 204 ? null : response.json();
};

const mapRfqRow = (row) => {
  const items = Array.isArray(row.items) ? row.items : [];
  const totals = items.reduce((map, item) => {
    const code = item.currency || item.currency_code || "USD";
    map[code] = Number(((map[code] || 0) + Number(item.targetLineTotal || item.target_line_total || 0)).toFixed(4));
    return map;
  }, {});
  return {
    id: row.id,
    rfq_number: row.order_no,
    created_at: row.created_at,
    company_name: row.customer_company,
    contact_name: row.customer_name,
    email: row.customer_email,
    phone: row.customer_phone,
    country_name: row.container_route,
    incoterm: row.transport,
    shipping_method: row.transport,
    urgent: String(row.notes || "").includes("Acil: Evet"),
    status: row.status || "new",
    total_cartons: row.total_cartons,
    estimated_pallets: row.total_pallets,
    estimated_gross_weight_kg: row.total_weight,
    exchange_rate_snapshot: { totals_by_currency: totals, item_count: items.length },
  };
};

const createRfqOrder = async (body, serviceRoleKey, req) => {
  if (!body.consent_privacy || !body.consent_accuracy) throw Object.assign(new Error("KVKK ve doğruluk onayları zorunludur."), { statusCode: 400 });
  const sourceItems = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
  if (!sourceItems.length) throw Object.assign(new Error("RFQ için en az bir ürün seçilmelidir."), { statusCode: 400 });
  const items = sourceItems.map((item) => {
    const cartons = parseIntCartons(item.requested_cartons || item.cartons);
    const price = parsePrice(item.target_unit_price || item.targetPrice);
    const currency = cleanText(item.currency_code || item.currency || "USD", 3).toUpperCase();
    return {
      productId: cleanText(item.product_id || item.productId, 120),
      barcode: cleanText(item.barcode, 80),
      brand: cleanText(item.brand, 120),
      product: cleanText(item.product_name || item.product || item.name, 300),
      cartons,
      unitsPerCarton: cleanNumber(item.unitsPerCarton || item.carton_inner_quantity || 1),
      kgPerCarton: cleanNumber(item.kgPerCarton || item.carton_weight_kg),
      cartonsPerPallet: cleanNumber(item.cartonsPerPallet || item.pallet_carton_quantity),
      targetUnitPrice: price,
      targetLineTotal: Number((cartons * price).toFixed(4)),
      currency,
      customerNote: cleanText(item.customer_note || item.note, 1000),
      specialReviewRequested: Boolean(item.special_review_requested),
    };
  }).filter((item) => item.product && item.cartons > 0);
  if (!items.length) throw Object.assign(new Error("Geçerli RFQ satırı bulunmuyor."), { statusCode: 400 });
  const now = new Date();
  const orderNo = `RFQ-${now.getFullYear()}-${now.toISOString().replace(/\D/g, "").slice(4, 14)}`;
  const totalsByCurrency = items.reduce((map, item) => {
    map[item.currency] = Number(((map[item.currency] || 0) + item.targetLineTotal).toFixed(4));
    return map;
  }, {});
  const totalWeight = items.reduce((sum, item) => sum + item.cartons * item.kgPerCarton, 0);
  const totalPallets = items.reduce((sum, item) => item.cartonsPerPallet ? sum + item.cartons / item.cartonsPerPallet : sum, 0);
  const notes = [
    "Kaynak: Sidya Global Website RFQ",
    `Acil: ${body.urgent ? "Evet" : "Hayır"}`,
    `Para birimi toplamları: ${Object.keys(totalsByCurrency).map((code) => `${code} ${totalsByCurrency[code]}`).join(" | ")}`,
    `Teslim: ${cleanText(body.destination_country, 120)} ${cleanText(body.destination_city_or_port, 120)} ${cleanText(body.incoterm, 20)}`,
    cleanText(body.general_note || body.notes, 1000),
  ].filter(Boolean).join("\n");
  const payload = {
    order_no: orderNo,
    auth_user_id: body.authUserId || null,
    customer_company: cleanText(body.company_name || body.company, 240) || null,
    customer_name: cleanText(body.contact_name || body.contact, 160) || null,
    customer_email: cleanText(body.email, 240) || null,
    customer_phone: cleanText(body.phone || body.whatsapp, 80) || null,
    currency: Object.keys(totalsByCurrency)[0] || "USD",
    transport: cleanText(body.incoterm || body.shipping_method, 40) || null,
    container_route: cleanText(body.destination_country || body.country_name, 80) || null,
    items,
    total_cartons: items.reduce((sum, item) => sum + item.cartons, 0),
    total_pallets: Number(totalPallets.toFixed(2)),
    total_weight: Number(totalWeight.toFixed(2)),
    notes,
    status: "new",
  };
  const data = await supabaseRequest("/rest/v1/site_orders?on_conflict=order_no", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload),
  }, serviceRoleKey);
  return { ok: true, rfq: { id: data[0]?.id, rfq_number: orderNo }, items, summary: { totalsByCurrency } };
};

module.exports = async (req, res) => {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!serviceRoleKey) {
      res.status(501).json({ error: "Sipariş aktarım servisi yapılandırılmamış." });
      return;
    }

    if (req.method === "GET") {
      const url = new URL(req.url, "https://sidyaglobal.com");
      if (url.searchParams.get("rfq") === "1") {
        const id = url.searchParams.get("id");
        if (id) {
          const rows = await supabaseRequest(`/rest/v1/site_orders?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, { method: "GET" }, serviceRoleKey);
          const row = rows[0];
          if (!row) return res.status(404).json({ error: "RFQ bulunamadı." });
          return res.status(200).json({ ok: true, rfq: mapRfqRow(row), items: (row.items || []).map((item) => ({
            product_name_snapshot: item.product,
            brand_snapshot: item.brand,
            barcode_snapshot: item.barcode,
            sku_snapshot: item.productId,
            requested_cartons: item.cartons,
            target_unit_price: item.targetUnitPrice,
            currency_code: item.currency,
            target_line_total: item.targetLineTotal,
            carton_inner_quantity: item.unitsPerCarton,
            carton_weight_kg: item.kgPerCarton,
            customer_note: item.customerNote,
          })) });
        }
        const rows = await supabaseRequest("/rest/v1/site_orders?order_no=like.RFQ-*&select=*&order=created_at.desc&limit=200", { method: "GET" }, serviceRoleKey);
        return res.status(200).json({ ok: true, rfqs: (rows || []).map(mapRfqRow) });
      }
      res.setHeader("Allow", "GET, POST");
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const body = await parseBody(req);
    if (body.type === "rfq") {
      const result = await createRfqOrder(body, serviceRoleKey, req);
      res.status(200).json(result);
      return;
    }

    const sourceItems = Array.isArray(body.items) ? body.items.slice(0, 250) : [];
    if (!sourceItems.length) {
      res.status(400).json({ error: "Siparişte ürün bulunmuyor." });
      return;
    }

    const items = sourceItems.map((item) => ({
      productId: cleanText(item.productId, 120),
      barcode: cleanText(item.barcode, 80),
      brand: cleanText(item.brand, 120),
      product: cleanText(item.product || item.name, 300),
      cartons: cleanNumber(item.cartons),
      unitsPerCarton: cleanNumber(item.unitsPerCarton),
      kgPerCarton: cleanNumber(item.kgPerCarton),
    })).filter((item) => item.product && item.cartons > 0);

    if (!items.length) {
      res.status(400).json({ error: "Geçerli sipariş satırı bulunmuyor." });
      return;
    }

    const now = new Date();
    const orderNo = cleanText(body.orderNo, 80) || `WEB-${now.toISOString().replace(/\D/g, "").slice(0, 17)}`;
    const payload = {
      order_no: orderNo,
      auth_user_id: body.authUserId || null,
      customer_company: cleanText(body.customerCompany, 240) || null,
      customer_name: cleanText(body.customerName, 160) || null,
      customer_email: cleanText(body.customerEmail, 240) || null,
      customer_phone: cleanText(body.customerPhone, 80) || null,
      currency: "USD",
      transport: cleanText(body.transport, 40) || null,
      container_route: cleanText(body.containerRoute, 40) || null,
      items,
      total_cartons: items.reduce((sum, item) => sum + item.cartons, 0),
      total_pallets: cleanNumber(body.totalPallets),
      total_weight: cleanNumber(body.totalWeight),
      notes: cleanText(body.notes, 1000) || null,
    };

    const data = await supabaseRequest("/rest/v1/site_orders?on_conflict=order_no", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(payload),
    }, serviceRoleKey);

    res.status(200).json({ ok: true, orderId: data[0]?.id, orderNo });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "Sipariş aktarılamadı." });
  }
};
