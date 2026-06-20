const historyConfig = window.SIDYA_BACKEND || {};
const historyKey = historyConfig.supabasePublishableKey || historyConfig.supabaseAnonKey || "";
const historyClient = historyConfig.supabaseUrl && historyKey && window.supabase
  ? window.supabase.createClient(historyConfig.supabaseUrl, historyKey)
  : null;

const historyEscape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
const historyNumber = (value) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 }).format(Number(value || 0));
const historyMoney = (value, currency = "USD") => new Intl.NumberFormat("tr-TR", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value || 0));
const historyDate = (value) => value ? new Intl.DateTimeFormat("tr-TR").format(new Date(`${String(value).slice(0, 10)}T12:00:00`)) : "-";
const historyQuery = async (promise) => { const { data, error } = await promise; if (error) throw error; return data || []; };
const perPiecePrice = (item) => Number(item.stock_quantity || 0) > 0
  ? Number(item.line_subtotal || 0) / Number(item.stock_quantity)
  : Number(item.unit_price || 0) / (item.unit === "koli" ? Math.max(Number(item.units_per_carton || 1), 1) : 1);

const weightedAverage = (items, invoiceMap) => {
  const totalQuantity = items.reduce((sum, item) => sum + Math.abs(Number(item.stock_quantity || item.quantity || 0)), 0);
  if (!totalQuantity) return 0;
  return items.reduce((sum, item) => {
    const invoice = invoiceMap.get(item.invoice_id) || {};
    const price = invoice.currency === "USD" ? perPiecePrice(item) : perPiecePrice(item) / Math.max(Number(invoice.exchange_rate || 1), 0.000001);
    return sum + price * Math.abs(Number(item.stock_quantity || item.quantity || 0));
  }, 0) / totalQuantity;
};

const bootHistory = async () => {
  const productId = new URLSearchParams(location.search).get("id");
  if (!historyClient || !productId) throw new Error("Ürün bağlantısı geçersiz.");
  const { data: sessionData } = await historyClient.auth.getSession();
  if (!sessionData.session) { location.href = "admin.html"; return; }
  const product = await historyQuery(historyClient.from("products").select("*").eq("id", productId).maybeSingle());
  if (!product?.id) throw new Error("Ürün kaydı bulunamadı.");
  const items = await historyQuery(historyClient.from("invoice_items").select("*").eq("product_id", productId));
  const invoiceIds = [...new Set(items.map((item) => item.invoice_id).filter(Boolean))];
  const invoices = invoiceIds.length ? await historyQuery(historyClient.from("invoices").select("*").in("id", invoiceIds)) : [];
  const customerIds = [...new Set(invoices.map((item) => item.customer_id).filter(Boolean))];
  const customers = customerIds.length ? await historyQuery(historyClient.from("customers").select("id,code,company").in("id", customerIds)) : [];
  const movements = await historyQuery(historyClient.from("stock_movements").select("*").eq("product_id", productId).order("created_at", { ascending: false }));
  const invoiceMap = new Map(invoices.map((item) => [item.id, item]));
  const customerMap = new Map(customers.map((item) => [item.id, item]));
  items.sort((a, b) => String(invoiceMap.get(b.invoice_id)?.invoice_date || "").localeCompare(String(invoiceMap.get(a.invoice_id)?.invoice_date || "")));
  const purchases = items.filter((item) => invoiceMap.get(item.invoice_id)?.invoice_type === "purchase");
  const sales = items.filter((item) => invoiceMap.get(item.invoice_id)?.invoice_type === "sale");
  const averagePurchase = weightedAverage(purchases, invoiceMap) || Number(product.purchase_price || 0);
  const averageSale = weightedAverage(sales, invoiceMap) || Number(product.sale_price || 0);
  const profitIndex = averagePurchase > 0 ? ((averageSale - averagePurchase) / averagePurchase) * 100 : 0;

  document.querySelector("#historyTitle").textContent = `${product.brand || ""} ${product.name}`.trim();
  document.querySelector("#historyMeta").textContent = `${product.barcode || product.sku || "Barkod yok"} · ${product.grammage || "Gramaj yok"}`;
  document.querySelector("#historyStock").textContent = `${historyNumber(product.stock_quantity)} adet`;
  document.querySelector("#historyAveragePurchase").textContent = historyMoney(averagePurchase, "USD");
  document.querySelector("#historyAverageSale").textContent = historyMoney(averageSale, "USD");
  const profitTarget = document.querySelector("#historyProfitIndex");
  profitTarget.textContent = `%${historyNumber(profitIndex)}`;
  profitTarget.className = profitIndex > 0 ? "profit-positive" : profitIndex < 0 ? "profit-negative" : "";

  document.querySelector("#historyInvoiceRows").innerHTML = items.length ? items.map((item) => {
    const invoice = invoiceMap.get(item.invoice_id) || {};
    const customer = customerMap.get(invoice.customer_id);
    const type = ({ purchase: "Alış", sale: "Satış", return: "İade" })[invoice.invoice_type] || invoice.invoice_type || "-";
    return `<tr><td>${historyDate(invoice.invoice_date || item.created_at)}</td><td>${historyEscape(type)}</td><td>${historyEscape(invoice.draft_data?.document_number || invoice.invoice_no || "-")}</td><td>${historyEscape(customer ? `${customer.code} · ${customer.company}` : "-")}</td><td>${historyNumber(item.stock_quantity || item.quantity)} adet</td><td>${historyEscape(item.unit || "adet")}</td><td>${historyMoney(item.unit_price, invoice.currency || "USD")}</td><td>%${historyNumber(item.tax_rate)} · ${historyMoney(item.line_tax, invoice.currency || "USD")}</td><td>${historyMoney(item.line_total, invoice.currency || "USD")}</td></tr>`;
  }).join("") : '<tr><td colspan="9" class="empty">Bu ürüne ait fatura hareketi bulunmuyor.</td></tr>';
  document.querySelector("#historyMovementRows").innerHTML = movements.length ? movements.map((item) => `<tr><td>${historyDate(item.created_at)}</td><td>${historyEscape(({ purchase: "Alış", sale: "Satış", sale_cancel: "İade", adjustment: "Stok düzeltme" })[item.movement_type] || item.movement_type)}</td><td>${historyNumber(item.quantity)}</td><td>${historyMoney(item.unit_cost, "USD")}</td><td>${historyEscape(item.reference_type || "-")}</td><td>${historyEscape(item.note || "-")}</td></tr>`).join("") : '<tr><td colspan="6" class="empty">Stok hareketi bulunmuyor.</td></tr>';
};

document.querySelector("#closeHistoryButton").addEventListener("click", () => { window.close(); if (!window.closed) location.href = "admin.html"; });
bootHistory().catch((error) => { const target = document.querySelector("#historyStatus"); target.classList.add("error"); target.textContent = error.message || "Hareketler yüklenemedi."; });
