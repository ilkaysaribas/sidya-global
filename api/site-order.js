const DEFAULT_SUPABASE_URL = "https://jhjforyykkxklfarjtjl.supabase.co";
const MAX_BODY_SIZE = 1024 * 1024;

const readBody = (req) =>
  new Promise((resolve, reject) => {
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

const cleanText = (value, max = 240) => String(value || "").trim().slice(0, max);
const cleanNumber = (value) => Math.max(0, Number(value) || 0);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!serviceRoleKey) {
      res.status(501).json({ error: "Sipariş aktarım servisi yapılandırılmamış." });
      return;
    }

    const body = await parseBody(req);
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

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
    const response = await fetch(`${supabaseUrl}/rest/v1/site_orders?on_conflict=order_no`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw Object.assign(new Error(await response.text()), { statusCode: response.status });
    const data = await response.json();
    res.status(200).json({ ok: true, orderId: data[0]?.id, orderNo });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "Sipariş aktarılamadı." });
  }
};
