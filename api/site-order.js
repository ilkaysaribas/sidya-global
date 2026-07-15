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
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
const cleanCurrency = (value) => {
  const code = cleanText(value || "USD", 3).toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : "USD";
};
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

    const productIds = [...new Set(sourceItems.map((item) => cleanText(item.productId, 120)).filter(isUuid))];
    const productRows = productIds.length
      ? await supabaseRequest(`/rest/v1/products?id=in.(${productIds.join(",")})&select=id,name,sku,barcode,unit,units_per_carton,sale_price,currency,vat_rate`, { method: "GET" }, serviceRoleKey)
      : [];
    const productMap = new Map((productRows || []).map((product) => [product.id, product]));
    const snapshotRateMap = body.exchangeRateSnapshot?.rateMap || {};
    const exchangeDate = cleanText(body.exchangeRateSnapshot?.date || new Date().toISOString().slice(0, 10), 10);
    const items = sourceItems.map((item) => {
      const productId = cleanText(item.productId, 120);
      const productRow = productMap.get(productId);
      const cartons = cleanNumber(item.cartons);
      const unitsPerCarton = productRow ? Math.max(cleanNumber(productRow.units_per_carton), 1) : Math.max(cleanNumber(item.unitsPerCarton), 1);
      const currentUnitPrice = productRow ? cleanNumber(productRow.sale_price) * unitsPerCarton : 0;
      const requestedCandidate = item.requestedUnitPrice ?? item.requested_unit_price;
      const requestedUnitPrice = requestedCandidate === undefined || requestedCandidate === null || requestedCandidate === ""
        ? currentUnitPrice
        : cleanNumber(requestedCandidate);
      const currency = cleanCurrency(productRow?.currency || item.currency);
      const currentTotal = Number((cartons * currentUnitPrice).toFixed(4));
      const requestedTotal = Number((cartons * requestedUnitPrice).toFixed(4));
      return {
        productId: isUuid(productId) ? productId : null,
        productCode: cleanText(productRow?.sku || item.productCode || item.barcode, 80),
        barcode: cleanText(productRow?.barcode || item.barcode, 80),
        brand: cleanText(item.brand, 120),
        product: cleanText(productRow?.name || item.product || item.name, 300),
        cartons,
        quantity: cartons,
        unit: cleanText(item.unit || "koli", 20),
        unitsPerCarton,
        kgPerCarton: cleanNumber(item.kgPerCarton),
        currentUnitPrice,
        requestedUnitPrice,
        currentTotal,
        requestedTotal,
        currency,
        exchangeRate: cleanNumber(snapshotRateMap[currency] || item.exchangeRate || (currency === "TRY" ? 1 : 0)) || 1,
        exchangeRateDate: exchangeDate,
        priceDifference: Number((requestedTotal - currentTotal).toFixed(4)),
        discountPercentage: currentTotal > 0 ? Number((((currentTotal - requestedTotal) / currentTotal) * 100).toFixed(4)) : 0,
        vatRate: cleanNumber(productRow?.vat_rate),
      };
    }).filter((item) => item.product && item.cartons > 0);

    if (!items.length) {
      res.status(400).json({ error: "Geçerli sipariş satırı bulunmuyor." });
      return;
    }

    const now = new Date();
    const orderNo = cleanText(body.orderNo, 80) || `WEB-${now.toISOString().replace(/\D/g, "").slice(0, 17)}`;
    const mainCurrency = cleanCurrency(body.mainCurrency || "USD");
    const mainRate = cleanNumber((body.exchangeRateSnapshot?.rateMap || {})[mainCurrency]) || 1;
    const toMain = (amount, item) => Number(amount || 0) * Number(item.exchangeRate || 1) / mainRate;
    const currentSubtotal = items.reduce((sum, item) => sum + toMain(item.currentTotal, item), 0);
    const requestedSubtotal = items.reduce((sum, item) => sum + toMain(item.requestedTotal, item), 0);
    const safeSnapshot = {
      base: "TRY",
      date: items[0]?.exchangeRateDate || now.toISOString().slice(0, 10),
      rates: Object.fromEntries([...new Set(items.map((item) => item.currency))].map((currency) => [currency, items.find((item) => item.currency === currency)?.exchangeRate || 1])),
      mainCurrency,
    };
    const payload = {
      order_no: orderNo,
      auth_user_id: body.authUserId || null,
      customer_company: cleanText(body.customerCompany, 240) || null,
      customer_name: cleanText(body.customerName, 160) || null,
      customer_email: cleanText(body.customerEmail, 240) || null,
      customer_phone: cleanText(body.customerPhone, 80) || null,
      currency: mainCurrency,
      main_currency: mainCurrency,
      exchange_rate_snapshot: safeSnapshot,
      exchange_rate_date: safeSnapshot.date,
      current_subtotal: Number(currentSubtotal.toFixed(4)),
      requested_subtotal: Number(requestedSubtotal.toFixed(4)),
      price_difference: Number((requestedSubtotal - currentSubtotal).toFixed(4)),
      average_discount_percentage: currentSubtotal > 0 ? Number((((currentSubtotal - requestedSubtotal) / currentSubtotal) * 100).toFixed(4)) : 0,
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

    const orderId = data[0]?.id;
    if (!orderId) throw Object.assign(new Error("Sipariş kaydı oluşturulamadı."), { statusCode: 500 });
    await supabaseRequest(`/rest/v1/site_order_items?order_id=eq.${encodeURIComponent(orderId)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }, serviceRoleKey);
    const normalizedItems = items.map((item) => ({
      order_id: orderId,
      product_id: item.productId,
      product_name: item.product,
      product_code: item.productCode || item.barcode || null,
      quantity: item.quantity,
      unit: item.unit,
      currency: item.currency,
      current_unit_price: item.currentUnitPrice,
      requested_unit_price: item.requestedUnitPrice,
      current_total: item.currentTotal,
      requested_total: item.requestedTotal,
      exchange_rate: item.exchangeRate,
      exchange_rate_date: item.exchangeRateDate,
      price_difference: item.priceDifference,
      discount_percentage: item.discountPercentage,
    }));
    await supabaseRequest("/rest/v1/site_order_items", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(normalizedItems),
    }, serviceRoleKey);

    res.status(200).json({ ok: true, orderId, orderNo, currentSubtotal: payload.current_subtotal, requestedSubtotal: payload.requested_subtotal });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "Sipariş aktarılamadı." });
  }
};
