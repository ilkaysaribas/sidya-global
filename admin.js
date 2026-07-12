const config = window.SIDYA_BACKEND || {};
const publishableKey = config.supabasePublishableKey || config.supabaseAnonKey || "";
const client = config.supabaseUrl && publishableKey && window.supabase
  ? window.supabase.createClient(config.supabaseUrl, publishableKey)
  : null;

const state = {
  customers: [],
  balances: [],
  products: [],
  invoices: [],
  invoiceItems: [],
  ledger: [],
  orders: [],
  movements: [],
  settings: null,
  session: null,
  schemaReady: true,
  selectedCustomers: new Set(),
  selectedProducts: new Set(),
  activeInvoiceId: null,
  editingInvoiceId: null,
  invoiceLines: [],
  contextTarget: null,
  productPage: 1,
  productPageSize: 100,
  productSort: "brand-asc",
  invoiceProductSort: { field: "name", direction: "asc" },
  exchangeRates: { USD: 1, TRY: 32, EUR: 0.92, RUB: 90, GEL: 2.7 },
  exchangeUpdatedAt: null,
};

const ADMIN_EMAILS = ["ilkaysaribas@gmail.com", "sidyaglobal@gmail.com"];

const today = () => new Date().toISOString().slice(0, 10);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
const number = (value) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 }).format(Number(value || 0));
const money = (value, currency = "USD") => new Intl.NumberFormat("tr-TR", { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(Number(value || 0));
const date = (value) => value ? new Date(value).toLocaleDateString("tr-TR") : "-";

const setStatus = (message, error = false) => {
  const target = document.querySelector("#globalStatus");
  if (!target) return;
  target.textContent = message || "";
  target.style.color = error ? "#b42318" : "#087462";
};

const friendlyError = (error) => {
  const message = String(error?.message || error || "Bilinmeyen hata");
  if (/Failed to fetch|NetworkError/i.test(message)) return "Sunucuya ulaşılamadı. İnternet/Vercel/Supabase bağlantısını kontrol edin.";
  if (/JWT|permission|policy|row-level/i.test(message)) return "Yetki hatası. Supabase RLS/policy veya admin yetkisini kontrol edin.";
  return message;
};

const query = async (request) => {
  const { data, error } = await request;
  if (error) throw error;
  return data || [];
};

const safeQuery = async (request, fallback = []) => {
  const { data, error } = await request;
  if (error) return fallback;
  return data || fallback;
};

const formObject = (form) => {
  const result = {};
  new FormData(form).forEach((value, key) => {
    if (result[key] !== undefined) result[key] = Array.isArray(result[key]) ? [...result[key], value] : [result[key], value];
    else result[key] = value;
  });
  form.querySelectorAll("input[type='checkbox']").forEach((input) => { result[input.name] = input.checked; });
  return result;
};

const normalizeCurrency = (value, fallback = "USD") => {
  const raw = String(value || fallback || "USD").trim().toUpperCase();
  if (["TL", "TRY", "TRL", "₺"].includes(raw)) return "TRY";
  if (["USD", "US$", "$", "DOLAR", "DOLLAR"].includes(raw)) return "USD";
  if (["EUR", "EURO", "€"].includes(raw)) return "EUR";
  if (["RUB", "RUBLE", "RUBLE", "RUBLE", "₽"].includes(raw)) return "RUB";
  if (["GEL", "LARI", "LARİ"].includes(raw)) return "GEL";
  if (["SAR", "AED", "GBP"].includes(raw)) return raw;
  throw new Error(`Desteklenmeyen para birimi: ${value}`);
};

const exchangeRate = (currency) => {
  const code = normalizeCurrency(currency);
  if (code === "USD") return 1;
  return Number(state.exchangeRates[code] || 0) || 1;
};

const convertToUsd = (amount, currency) => {
  const value = Number(String(amount || 0).replace(",", "."));
  const code = normalizeCurrency(currency);
  if (code === "USD") return value;
  if (code === "EUR") return value / Math.max(Number(state.exchangeRates.EUR || 0.92), 0.0001);
  if (code === "TRY") return value / Math.max(Number(state.exchangeRates.TRY || 32), 0.0001);
  if (code === "RUB") return value / Math.max(Number(state.exchangeRates.RUB || 90), 0.0001);
  if (code === "GEL") return value / Math.max(Number(state.exchangeRates.GEL || 2.7), 0.0001);
  return value;
};

const convertFromUsd = (usd, currency) => {
  const code = normalizeCurrency(currency);
  const value = Number(usd || 0);
  if (code === "USD") return value;
  return value * exchangeRate(code);
};

const formatCurrencyGroups = (items) => {
  const totals = new Map();
  items.forEach((item) => {
    const currency = item.currency || "USD";
    totals.set(currency, (totals.get(currency) || 0) + Number(item.amount || 0));
  });
  return [...totals.entries()].map(([currency, amount]) => money(amount, currency)).join(" · ") || money(0, "USD");
};

const isSchemaError = (error) => /PGRST205|does not exist|schema cache|relation .* does not exist|42P01|404/i.test(String(error?.message || error));

const verifyAdmin = async (session) => {
  if (!session?.user) return false;
  if (ADMIN_EMAILS.includes(session.user.email)) return true;
  try {
    const admin = await safeQuery(client.from("admin_users").select("user_id").eq("user_id", session.user.id).maybeSingle(), null);
    return !!admin;
  } catch {
    return ADMIN_EMAILS.includes(session.user.email);
  }
};

const showLogin = () => {
  document.querySelector("#loginShell").hidden = false;
  document.querySelector("#appShell").hidden = true;
};

const showApp = (session) => {
  state.session = session;
  document.querySelector("#loginShell").hidden = true;
  document.querySelector("#appShell").hidden = false;
  document.querySelector("#currentUser").textContent = session.user.email;
};

const loadAdminExchangeRates = async () => {
  try {
    const res = await fetch("/api/exchange-rates", { cache: "no-store" });
    if (!res.ok) throw new Error("Kur API yanıt vermedi");
    const data = await res.json();
    const rates = data.rates || data;
    state.exchangeRates = {
      USD: 1,
      TRY: Number(rates.TRY || rates.USDTRY || state.exchangeRates.TRY || 32),
      EUR: Number(rates.EUR || rates.USDEUR || state.exchangeRates.EUR || 0.92),
      RUB: Number(rates.RUB || rates.USDRUB || state.exchangeRates.RUB || 90),
      GEL: Number(rates.GEL || rates.USDGEL || state.exchangeRates.GEL || 2.7),
    };
    state.exchangeUpdatedAt = data.updated_at || new Date().toISOString();
  } catch (error) {
    console.warn("Kur alınamadı, varsayılan kurlar kullanılacak", error);
  }
};

const loadData = async () => {
  if (!client) throw new Error("Supabase bağlantısı bulunamadı. backend-config.js ayarlarını kontrol edin.");
  setStatus("Veriler yükleniyor...");
  const [customers, products, invoices, invoiceItems, ledger, orders, movements, settings, sitePrices] = await Promise.all([
    safeQuery(client.from("customers").select("*").order("created_at", { ascending: false })),
    safeQuery(client.from("products").select("*").neq("active", false).order("brand", { ascending: true }).limit(5000)),
    safeQuery(client.from("invoices").select("*").order("created_at", { ascending: false })),
    safeQuery(client.from("invoice_items").select("*")),
    safeQuery(client.from("customer_ledger").select("*")),
    safeQuery(client.from("site_orders").select("*").order("created_at", { ascending: false })),
    safeQuery(client.from("stock_movements").select("*")),
    safeQuery(client.from("app_settings").select("*").eq("id", "main").maybeSingle(), null),
    safeQuery(client.from("site_catalog_prices").select("publish_key"), null),
  ]);
  state.customers = customers || [];
  state.products = products || [];
  state.invoices = invoices || [];
  state.invoiceItems = invoiceItems || [];
  state.ledger = ledger || [];
  state.orders = orders || [];
  state.movements = movements || [];
  state.settings = settings || null;
  state.schemaReady = sitePrices !== null;
  renderAll();
  document.querySelector("#schemaWarning").hidden = state.schemaReady;
  if (!state.schemaReady) document.querySelector("#schemaWarningText").innerHTML = "Bilgi gönderme özelliğini etkinleştirmek için Supabase SQL Editor'da <code>supabase/bilgi-al-gonder.sql</code> dosyasını bir kez çalıştırın.";
  setStatus("");
};

const customerRole = (item) => {
  const roles = [];
  if (item.is_buyer) roles.push("Alıcı");
  if (item.is_seller) roles.push("Satıcı");
  return roles.join(" / ") || "Cari";
};

const productAveragePrices = (productId) => {
  const lines = state.invoiceItems.filter((item) => item.product_id === productId);
  const purchaseLines = lines.filter((item) => item.line_type === "purchase" || item.invoice_type === "purchase");
  const saleLines = lines.filter((item) => item.line_type === "sale" || item.invoice_type === "sale");
  const avg = (items) => {
    const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    if (!totalQty) return 0;
    return items.reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0), 0) / totalQty;
  };
  return { purchase: avg(purchaseLines), sale: avg(saleLines) };
};

const productUnitPrice = (product, invoiceType, selectedUnit = "adet") => {
  const base = invoiceType === "purchase" ? Number(product.purchase_price || 0) : Number(product.sale_price || 0);
  if (selectedUnit === "koli") return base * Math.max(Number(product.units_per_carton || 1), 1);
  return base;
};

const stockQuantityFor = (quantity, selectedUnit, unitsPerCarton) => selectedUnit === "koli" ? Number(quantity || 0) * Math.max(Number(unitsPerCarton || 1), 1) : Number(quantity || 0);
const formatStockCartons = (stock, unitsPerCarton) => {
  const units = Math.max(Number(unitsPerCarton || 1), 1);
  return `${number(Number(stock || 0) / units)} koli`;
};

const renderMetrics = () => {
  const purchaseValue = state.products.reduce((sum, item) => sum + Number(item.purchase_price || 0) * Number(item.stock_quantity || 0), 0);
  const saleValue = state.products.reduce((sum, item) => sum + Number(item.sale_price || 0) * Number(item.stock_quantity || 0), 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthlySales = state.invoices.filter((item) => item.invoice_type === "sale" && String(item.invoice_date || item.created_at).startsWith(thisMonth)).reduce((sum, item) => sum + Number(item.grand_total || 0), 0);
  document.querySelector("#metricPurchaseValue").textContent = money(purchaseValue, "USD");
  document.querySelector("#metricSaleValue").textContent = money(saleValue, "USD");
  document.querySelector("#metricMonthlySales").textContent = money(monthlySales, "USD");
  document.querySelector("#metricOrders").textContent = number(state.orders.filter((item) => item.status !== "converted" && item.status !== "cancelled").length);
  const low = state.products.filter((item) => Number(item.minimum_stock || 0) > 0 && Number(item.stock_quantity || 0) <= Number(item.minimum_stock || 0)).slice(0, 8);
  document.querySelector("#lowStockList").innerHTML = low.length ? low.map((item) => `<div class="compact-row"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.brand || "")}</small></div><span class="stock-low">${number(item.stock_quantity)} adet</span></div>`).join("") : '<p class="empty">Kritik stok yok.</p>';
  document.querySelector("#recentInvoices").innerHTML = state.invoices.slice(0, 8).map((item) => `<div class="compact-row"><div><strong>${escapeHtml(item.invoice_no || item.draft_data?.document_number || "Fatura")}</strong><small>${date(item.invoice_date)} · ${escapeHtml(item.invoice_type)}</small></div><span>${money(item.grand_total, item.currency || "USD")}</span></div>`).join("") || '<p class="empty">Henüz fatura bulunmuyor.</p>';
};

const customerBalance = (customerId) => {
  const rows = state.ledger.filter((item) => item.customer_id === customerId);
  const totals = new Map();
  rows.forEach((row) => {
    const currency = row.currency || "USD";
    totals.set(currency, (totals.get(currency) || 0) + Number(row.debit || 0) - Number(row.credit || 0));
  });
  return totals;
};

const renderCustomers = () => {
  const term = document.querySelector("#customerSearch").value.trim().toLocaleLowerCase("tr");
  const rows = state.customers.filter((item) => [item.code, item.company, item.contact_name, item.email, item.tax_number]
    .some((value) => String(value || "").toLocaleLowerCase("tr").includes(term)));
  document.querySelector("#customerRows").innerHTML = rows.length ? rows.map((item) => {
    const balances = [...customerBalance(item.id).entries()].map(([currency, amount]) => money(amount, currency)).join(" · ") || money(0, item.currency || "USD");
    return `<tr data-customer-row="${item.id}"><td><input type="checkbox" data-customer-select="${item.id}" ${state.selectedCustomers.has(item.id) ? "checked" : ""}></td><td>${escapeHtml(item.code || "-")}</td><td><strong>${escapeHtml(item.company)}</strong><small>${escapeHtml(item.notes || "")}</small></td><td>${customerRole(item)}</td><td>${escapeHtml(item.contact_name || "-")}</td><td>${escapeHtml(item.country || "-")}</td><td>${escapeHtml(item.email || "-")}</td><td>${balances}</td><td class="row-actions"><button data-customer-payment="${item.id}">Tahsilat</button><button data-customer-edit="${item.id}">Düzenle</button></td></tr>`;
  }).join("") : '<tr><td colspan="9" class="empty">Cari bulunamadı.</td></tr>';
  document.querySelector("#selectedCustomerCount").textContent = `${state.selectedCustomers.size} cari seçildi`;
};

const getSortedProducts = () => {
  const term = document.querySelector("#productSearch")?.value.trim().toLocaleLowerCase("tr") || "";
  const [field, direction] = String(state.productSort || "brand-asc").split("-");
  const keyMap = {
    brand: (item) => item.brand || "",
    name: (item) => item.name || "",
    sku: (item) => item.barcode || item.sku || "",
    grammage: (item) => item.grammage || "",
    purchase: (item) => Number(item.purchase_price || 0),
    sale: (item) => Number(item.sale_price || 0),
    stock: (item) => Number(item.stock_quantity || 0),
  };
  return state.products
    .filter((item) => [item.brand, item.barcode, item.sku, item.name, item.grammage, item.category]
      .some((value) => String(value || "").toLocaleLowerCase("tr").includes(term)))
    .sort((a, b) => {
      const av = (keyMap[field] || keyMap.brand)(a);
      const bv = (keyMap[field] || keyMap.brand)(b);
      if (typeof av === "number" || typeof bv === "number") return direction === "desc" ? Number(bv) - Number(av) : Number(av) - Number(bv);
      return direction === "desc" ? String(bv).localeCompare(String(av), "tr") : String(av).localeCompare(String(bv), "tr");
    });
};

const currencyPreview = (usdValue) => {
  const usd = Number(usdValue || 0);
  return `${money(usd, "USD")} · ${money(convertFromUsd(usd, "TRY"), "TRY")} · ${money(convertFromUsd(usd, "EUR"), "EUR")} · ${money(convertFromUsd(usd, "GEL"), "GEL")} · ${money(convertFromUsd(usd, "RUB"), "RUB")}`;
};

const renderProducts = () => {
  const sorted = getSortedProducts();
  const totalPages = Math.max(Math.ceil(sorted.length / state.productPageSize), 1);
  state.productPage = Math.min(Math.max(state.productPage, 1), totalPages);
  const start = (state.productPage - 1) * state.productPageSize;
  const pageRows = sorted.slice(start, start + state.productPageSize);
  document.querySelector("#productRows").innerHTML = pageRows.length ? pageRows.map((item, index) => {
    const averages = productAveragePrices(item.id);
    const averagePurchase = averages.purchase || Number(item.purchase_price || 0);
    const averageSale = averages.sale || Number(item.sale_price || 0);
    const profitIndex = averagePurchase > 0 ? ((averageSale - averagePurchase) / averagePurchase) * 100 : 0;
    const stock = Number(item.stock_quantity || 0);
    const low = Number(item.minimum_stock || 0) > 0 && stock <= Number(item.minimum_stock || 0);
    return `<tr data-product-row="${item.id}"><td>${start + index + 1}</td><td><input type="checkbox" data-product-select="${item.id}" ${state.selectedProducts.has(item.id) ? "checked" : ""}></td><td><strong>${escapeHtml(item.brand || "-")}</strong><small>${escapeHtml(item.category || "")}</small></td><td>${escapeHtml(item.barcode || item.sku || "-")}</td><td><strong>${escapeHtml(item.name)}</strong></td><td>${escapeHtml(item.grammage || "-")}</td><td>${escapeHtml(item.unit || "adet")}</td><td>${number(item.units_per_carton || 1)}</td><td class="${low ? "stock-low" : ""}">${number(stock)}</td><td>${formatStockCartons(stock, item.units_per_carton)}</td><td>${number(item.minimum_stock || 0)}</td><td>${currencyPreview(item.purchase_price)}</td><td>${money(averagePurchase, "USD")}</td><td>${currencyPreview(item.sale_price)}</td><td>${money(averageSale, "USD")}</td><td class="${profitIndex > 0 ? "profit-positive" : profitIndex < 0 ? "profit-negative" : "profit-neutral"}">%${number(profitIndex)}</td><td>%${number(item.vat_rate || 0)}</td><td class="row-actions"><button data-product-price="${item.id}">Fiyat</button><button data-product-edit="${item.id}">Düzenle</button></td></tr>`;
  }).join("") : '<tr><td colspan="18" class="empty">Ürün bulunamadı.</td></tr>';
  renderProductPagination(sorted.length, totalPages);
  document.querySelector("#selectedProductCount").textContent = `${state.selectedProducts.size} ürün seçildi`;
};

const renderProductPagination = (total, totalPages) => {
  const target = document.querySelector("#productPagination");
  if (!target) return;
  if (total <= state.productPageSize) { target.innerHTML = `<span>${number(total)} ürün</span>`; return; }
  const buttons = [];
  for (let page = 1; page <= totalPages; page += 1) {
    if (page === 1 || page === totalPages || Math.abs(page - state.productPage) <= 2) buttons.push(`<button type="button" data-product-page="${page}" ${page === state.productPage ? "disabled" : ""}>${page}</button>`);
    else if (!buttons.at(-1)?.includes("…")) buttons.push("<span>…</span>");
  }
  target.innerHTML = `<button type="button" data-product-page="${state.productPage - 1}" ${state.productPage <= 1 ? "disabled" : ""}>Önceki</button>${buttons.join("")}<button type="button" data-product-page="${state.productPage + 1}" ${state.productPage >= totalPages ? "disabled" : ""}>Sonraki</button><span>${number(total)} ürün</span>`;
};

const renderOrders = () => {
  document.querySelector("#newOrderCount").textContent = state.orders.filter((item) => item.status !== "converted" && item.status !== "cancelled").length;
  document.querySelector("#orderRows").innerHTML = state.orders.length ? state.orders.map((item) => `<tr data-order-row="${item.id}"><td>${escapeHtml(item.order_no || item.id.slice(0, 8))}</td><td>${date(item.created_at)}</td><td><strong>${escapeHtml(item.customer_name || item.company || "-")}</strong><small>${escapeHtml(item.email || item.phone || "")}</small></td><td>${escapeHtml((item.items || [])[0]?.product || "-")}</td><td>${number((item.items || []).reduce((sum, line) => sum + Number(line.cartons || 0), 0))}</td><td><span class="badge">${escapeHtml(item.status || "new")}</span></td><td class="row-actions"><button data-order-convert="${item.id}">Fatura aktar</button><button data-order-detail="${item.id}">Detay</button><button data-order-delete="${item.id}">Sil</button></td></tr>`).join("") : '<tr><td colspan="7" class="empty">Henüz sipariş bulunmuyor.</td></tr>';
};

const renderInvoices = () => {
  document.querySelector("#invoiceRows").innerHTML = state.invoices.length ? state.invoices.map((item) => {
    const customer = state.customers.find((entry) => entry.id === item.customer_id);
    const documentNo = item.draft_data?.document_number || item.invoice_no || "Fatura";
    return `<tr data-invoice-row="${item.id}" data-invoice-open="${item.id}"><td><strong>${escapeHtml(documentNo)}</strong><small>${escapeHtml(item.status || "draft")}</small></td><td>${escapeHtml(item.invoice_type || "-")}</td><td>${date(item.invoice_date)}</td><td>${escapeHtml(customer?.company || "-")}</td><td>${escapeHtml(item.scenario || "-")}</td><td>${money(item.grand_total, item.currency || "USD")}</td><td>${money(item.tax_total, item.currency || "USD")}</td><td class="row-actions"><button data-invoice-print="${item.id}">Yazdır</button><button data-invoice-edit="${item.id}">Düzenle</button><button data-invoice-delete="${item.id}">Sil</button></td></tr>`;
  }).join("") : '<tr><td colspan="8" class="empty">Henüz fatura bulunmuyor.</td></tr>';
};

const renderInvoiceOptions = () => {
  const customerSelect = document.querySelector("#invoiceCustomer");
  const stockSelect = document.querySelector("#stockProduct");
  const paymentCustomerSelect = document.querySelector("#paymentForm [name='customer_id']");
  const customerOptions = state.customers.map((item) => `<option value="${item.id}">${escapeHtml(item.code || "")} ${escapeHtml(item.company)}</option>`).join("");
  if (customerSelect) customerSelect.innerHTML = '<option value="">Cari seç</option>' + customerOptions;
  if (paymentCustomerSelect) paymentCustomerSelect.innerHTML = customerOptions;
  if (stockSelect) stockSelect.innerHTML = state.products.map((item) => `<option value="${item.id}">${escapeHtml(item.barcode || item.sku || "")} ${escapeHtml(item.name)}</option>`).join("");
};

const invoiceLineCalc = (line) => {
  const qty = Number(line.quantity || 0);
  const unitPrice = Number(line.unit_price || 0);
  const d1 = Number(line.discount_1 || 0);
  const d2 = Number(line.discount_2 || 0);
  const d3 = Number(line.discount_3 || 0);
  const taxRate = Number(line.tax_rate || 0);
  let net = qty * unitPrice;
  const discounts = [d1, d2, d3].reduce((amount, rate) => amount * (1 - rate / 100), net);
  const discountTotal = net - discounts;
  const tax = discounts * taxRate / 100;
  return { subtotal: net, discount: discountTotal, net: discounts, tax, total: discounts + tax };
};

const renderInvoiceProductPicker = () => {
  const tbody = document.querySelector("#invoiceProductRows");
  if (!tbody) return;
  const term = document.querySelector("#invoiceProductSearch").value.trim().toLocaleLowerCase("tr");
  const invoiceType = document.querySelector("#invoiceForm").elements.invoice_type.value;
  const invoiceCurrency = document.querySelector("#invoiceForm").elements.currency.value || "USD";
  const sorted = state.products.filter((item) => [item.name, item.brand, item.barcode, item.sku].some((value) => String(value || "").toLocaleLowerCase("tr").includes(term))).sort((a, b) => {
    const field = state.invoiceProductSort.field;
    const direction = state.invoiceProductSort.direction;
    const read = (item) => field === "stock" ? Number(item.stock_quantity || 0) : field === "price" ? productUnitPrice(item, invoiceType) : String(item[field] || "");
    const av = read(a); const bv = read(b);
    if (typeof av === "number" || typeof bv === "number") return direction === "desc" ? Number(bv) - Number(av) : Number(av) - Number(bv);
    return direction === "desc" ? String(bv).localeCompare(String(av), "tr") : String(av).localeCompare(String(bv), "tr");
  }).slice(0, 100);
  tbody.innerHTML = sorted.length ? sorted.map((item) => `<tr data-picker-row="${item.id}"><td>${escapeHtml(item.barcode || item.sku || "-")}</td><td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.brand || "")}</small></td><td>${number(item.stock_quantity || 0)}</td><td><input data-picker-qty type="number" min="0.001" step="0.001" value="1" /></td><td><input data-picker-price type="number" step="0.0001" value="${productUnitPrice(item, invoiceType)}" /></td><td><select data-picker-currency><option ${invoiceCurrency === "USD" ? "selected" : ""}>USD</option><option ${invoiceCurrency === "EUR" ? "selected" : ""}>EUR</option><option ${invoiceCurrency === "TRY" ? "selected" : ""}>TRY</option><option ${invoiceCurrency === "RUB" ? "selected" : ""}>RUB</option><option ${invoiceCurrency === "GEL" ? "selected" : ""}>GEL</option></select></td><td><select data-picker-unit><option value="adet">Adet</option><option value="koli">Koli</option></select></td><td><button data-add-invoice-product="${item.id}">Ekle</button></td></tr>`).join("") : '<tr><td colspan="8" class="empty">Ürün bulunamadı.</td></tr>';
};

const renderInvoiceLines = () => {
  const tbody = document.querySelector("#invoiceLineRows");
  if (!tbody) return;
  let subtotal = 0, discount = 0, tax = 0, total = 0;
  tbody.innerHTML = state.invoiceLines.length ? state.invoiceLines.map((line, index) => {
    const calc = invoiceLineCalc(line);
    subtotal += calc.subtotal; discount += calc.discount; tax += calc.tax; total += calc.total;
    return `<tr><td>${index + 1}</td><td>${escapeHtml(line.barcode || "-")}</td><td>${escapeHtml(line.description)}</td><td>${number(line.available_stock || 0)}</td><td><input data-line-index="${index}" data-line-field="quantity" type="number" step="0.001" value="${line.quantity}" /></td><td><select data-line-index="${index}" data-line-field="selected_unit"><option value="adet" ${line.selected_unit === "adet" ? "selected" : ""}>Adet</option><option value="koli" ${line.selected_unit === "koli" ? "selected" : ""}>Koli</option></select><small>${number(line.stock_quantity)} adet stok etkisi</small></td><td><input data-line-index="${index}" data-line-field="unit_price" type="number" step="0.0001" value="${line.unit_price}" /></td><td><select data-line-index="${index}" data-line-field="currency"><option ${line.currency === "USD" ? "selected" : ""}>USD</option><option ${line.currency === "EUR" ? "selected" : ""}>EUR</option><option ${line.currency === "TRY" ? "selected" : ""}>TRY</option><option ${line.currency === "RUB" ? "selected" : ""}>RUB</option><option ${line.currency === "GEL" ? "selected" : ""}>GEL</option></select></td><td><input data-line-index="${index}" data-line-field="discount_1" type="number" step="0.01" value="${line.discount_1}" /></td><td><input data-line-index="${index}" data-line-field="discount_2" type="number" step="0.01" value="${line.discount_2}" /></td><td><input data-line-index="${index}" data-line-field="discount_3" type="number" step="0.01" value="${line.discount_3}" /></td><td><input data-line-index="${index}" data-line-field="tax_rate" type="number" step="0.01" value="${line.tax_rate}" /></td><td>${money(calc.tax, line.currency)}</td><td><strong>${money(calc.total, line.currency)}</strong></td><td><button data-remove-line="${index}">Sil</button></td></tr>`;
  }).join("") : '<tr><td colspan="15" class="empty">Henüz satır yok.</td></tr>';
  document.querySelector("#invoiceSubtotal").textContent = money(subtotal, document.querySelector("#invoiceForm").elements.currency.value || "USD");
  document.querySelector("#invoiceDiscountTotal").textContent = money(discount, document.querySelector("#invoiceForm").elements.currency.value || "USD");
  document.querySelector("#invoiceTaxTotal").textContent = money(tax, document.querySelector("#invoiceForm").elements.currency.value || "USD");
  document.querySelector("#invoiceGrandTotal").textContent = money(total, document.querySelector("#invoiceForm").elements.currency.value || "USD");
  document.querySelector("#invoiceVatBreakdown").innerHTML = "";
};

const renderReports = () => {
  const sales = state.invoices.filter((i) => i.invoice_type === "sale").reduce((sum, i) => sum + Number(i.grand_total || 0), 0);
  const purchases = state.invoices.filter((i) => i.invoice_type === "purchase").reduce((sum, i) => sum + Number(i.grand_total || 0), 0);
  document.querySelector("#reportSales").textContent = money(sales, "USD");
  document.querySelector("#reportPurchases").textContent = money(purchases, "TRY");
  document.querySelector("#reportStockQty").textContent = number(state.products.reduce((sum, p) => sum + Number(p.stock_quantity || 0), 0));
  document.querySelector("#reportLowStock").textContent = number(state.products.filter((p) => Number(p.minimum_stock || 0) > 0 && Number(p.stock_quantity || 0) <= Number(p.minimum_stock || 0)).length);
  document.querySelector("#balanceReport").innerHTML = state.customers.slice(0, 10).map((item) => `<div class="compact-row"><div><strong>${escapeHtml(item.company)}</strong><small>${customerRole(item)}</small></div><span>${[...customerBalance(item.id).entries()].map(([c, a]) => money(a, c)).join(" · ") || money(0, item.currency || "USD")}</span></div>`).join("") || '<p class="empty">Cari yok.</p>';
  document.querySelector("#salesProductReport").innerHTML = state.products.slice(0, 10).map((item) => `<div class="compact-row"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.brand || "")}</small></div><span>${number(item.stock_quantity || 0)}</span></div>`).join("");
};

const renderSettings = () => {
  if (!state.settings) return;
  const form = document.querySelector("#templateForm");
  ["company_name", "company_tax_number", "company_tax_office", "company_address"].forEach((key) => { if (form.elements[key]) form.elements[key].value = state.settings[key] || ""; });
  form.elements.incoterm.value = state.settings.invoice_template?.incoterm || "";
  form.elements.payment_note.value = state.settings.invoice_template?.payment_note || "";
  document.querySelector("#gibProvider").value = state.settings.gib_provider || "";
};

const renderAll = () => {
  renderMetrics();
  renderCustomers();
  renderProducts();
  renderOrders();
  renderInvoices();
  renderInvoiceOptions();
  renderInvoiceProductPicker();
  renderInvoiceLines();
  renderReports();
  renderSettings();
};

const openEditForm = (dialogId, formId, item = {}) => {
  const form = document.querySelector(`#${formId}`);
  form.reset();
  Object.entries(item || {}).forEach(([key, value]) => {
    if (!form.elements[key]) return;
    const field = form.elements[key];
    if (field.type === "checkbox") field.checked = !!value;
    else field.value = value ?? "";
  });
  if (!item.id && formId === "customerForm") { form.elements.is_buyer.checked = true; form.elements.is_seller.checked = true; }
  document.querySelector(`#${dialogId}`).showModal();
};

const saveCustomer = async (event) => {
  event.preventDefault();
  const values = formObject(event.currentTarget);
  const payload = {
    code: values.code || null,
    company: values.company,
    contact_name: values.contact_name || null,
    email: values.email || null,
    phone: values.phone || null,
    country: values.country || null,
    tax_number: values.tax_number || null,
    tax_office: values.tax_office || null,
    currency: values.currency || "USD",
    is_buyer: !!values.is_buyer,
    is_seller: !!values.is_seller,
    address: values.address || null,
    notes: values.notes || null,
    updated_at: new Date().toISOString(),
  };
  if (values.id) await query(client.from("customers").update(payload).eq("id", values.id).select("id"));
  else await query(client.from("customers").insert(payload).select("id"));
  document.querySelector("#customerDialog").close();
  await loadData();
  setStatus("Cari kartı kaydedildi.");
};

const saveProduct = async (event) => {
  event.preventDefault();
  const values = formObject(event.currentTarget);
  const purchaseCurrency = event.currentTarget.querySelector('[data-price-currency="purchase_price"]')?.value || "USD";
  const saleCurrency = event.currentTarget.querySelector('[data-price-currency="sale_price"]')?.value || "USD";
  const payload = {
    name: values.name,
    brand: values.brand || null,
    sku: values.sku || null,
    barcode: values.barcode || null,
    grammage: values.grammage || null,
    category: values.category || null,
    unit: values.unit || "adet",
    purchase_price: convertToUsd(values.purchase_price, purchaseCurrency),
    sale_price: convertToUsd(values.sale_price, saleCurrency),
    currency: "USD",
    vat_rate: Number(values.vat_rate || 0),
    minimum_stock: Number(values.minimum_stock || 0),
    units_per_carton: Number(values.units_per_carton || 1),
    kg_per_carton: Number(values.kg_per_carton || 0),
    active: true,
    updated_at: new Date().toISOString(),
  };
  if (values.id) await query(client.from("products").update(payload).eq("id", values.id).select("id"));
  else await query(client.from("products").insert(payload).select("id"));
  document.querySelector("#productDialog").close();
  await loadData();
  setStatus("Stok kartı kaydedildi.");
};

const refreshProductPricePreviews = () => {
  document.querySelectorAll("[data-price-preview]").forEach((target) => {
    const field = target.dataset.pricePreview;
    const input = document.querySelector(`#productForm [name="${field}"]`);
    const currency = document.querySelector(`#productForm [data-price-currency="${field}"]`)?.value || "USD";
    if (input) target.textContent = `${money(Number(input.value || 0), normalizeCurrency(currency))} = ${money(convertToUsd(input.value, currency), "USD")} ana fiyat`;
  });
  const priceForm = document.querySelector("#productPriceForm");
  if (priceForm) {
    const purchase = priceForm.elements.purchase_price ? convertToUsd(priceForm.elements.purchase_price.value, priceForm.elements.purchase_currency.value) : 0;
    const sale = priceForm.elements.sale_price ? convertToUsd(priceForm.elements.sale_price.value, priceForm.elements.sale_currency.value) : 0;
    const pp = document.querySelector("#pricePurchasePreview");
    const sp = document.querySelector("#priceSalePreview");
    if (pp) pp.textContent = currencyPreview(purchase);
    if (sp) sp.textContent = currencyPreview(sale);
  }
};

const parseNumberFlexible = (value) => {
  if (value === null || value === undefined || value === "") return null;
  let text = String(value).trim();
  if (!text) return null;
  const hasComma = text.includes(",");
  const hasDot = text.includes(".");
  if (hasComma && hasDot) {
    const lastComma = text.lastIndexOf(",");
    const lastDot = text.lastIndexOf(".");
    if (lastComma > lastDot) text = text.replace(/\./g, "").replace(",", ".");
    else text = text.replace(/,/g, "");
  } else if (hasComma) text = text.replace(",", ".");
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
};

const readCell = (row, aliases) => {
  const keys = Object.keys(row || {});
  const normalized = (s) => String(s || "").toLocaleLowerCase("tr").replace(/\s+/g, "").replace(/[._-]/g, "");
  for (const alias of aliases) {
    const key = keys.find((k) => normalized(k) === normalized(alias));
    if (key) return row[key];
  }
  return undefined;
};

const downloadPriceTemplate = () => {
  const currency = prompt("Şablon para birimi seçin: USD, TRY, EUR, GEL, RUB", "USD") || "USD";
  const code = normalizeCurrency(currency);
  const rows = [
    ["Barkod", "SKU", "Ürün Adı", "Alış Fiyatı", "Alış Para Birimi", "Satış Fiyatı", "Satış Para Birimi", "KDV Oranı", "Koli İçi", "Minimum Stok", "Koli Kg", "Stok Birimi"],
    ["8690000000000", "SKU-001", "Örnek Ürün", "10,50", code, "14,00", code, "20", "12", "0", "8,5", "adet"],
  ];
  csvDownload(`sidya-fiyat-format-${code}.csv`, rows);
};

const importPriceFile = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  setStatus("Excel/CSV fiyat dosyası okunuyor...");
  const beforeCount = state.products.filter((p) => p.active !== false).length;
  let rows = [];
  const text = await file.text();
  if (/\.csv$/i.test(file.name)) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    const headers = lines.shift().split(/[;,]/).map((h) => h.replace(/^\uFEFF/, "").trim().replace(/^"|"$/g, ""));
    rows = lines.map((line) => Object.fromEntries(line.split(/[;,]/).map((v, i) => [headers[i], v.replace(/^"|"$/g, "").trim()])));
  } else if (window.XLSX) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
  } else {
    throw new Error("Excel okuma kütüphanesi yüklenemedi. CSV formatı kullanın.");
  }
  const summary = { read: rows.length, updated: 0, unmatched: 0, invalid: 0, blank: 0, deleted: 0, deactivated: 0, errors: [] };
  const byBarcode = new Map(state.products.map((p) => [String(p.barcode || "").trim(), p]).filter(([k]) => k));
  const bySku = new Map(state.products.map((p) => [String(p.sku || "").trim(), p]).filter(([k]) => k));
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const barcode = String(readCell(row, ["Barkod", "Barcode"]) || "").trim();
    const sku = String(readCell(row, ["SKU", "Stok Kodu", "Ürün Kodu"]) || "").trim();
    if (!barcode && !sku) { summary.blank += 1; continue; }
    const product = (barcode && byBarcode.get(barcode)) || (sku && bySku.get(sku));
    if (!product) { summary.unmatched += 1; summary.errors.push(`Satır ${i + 2}: Barkod/SKU bulunamadı (${barcode || sku})`); continue; }
    const purchaseRaw = readCell(row, ["Alış Fiyatı", "Purchase Price", "Alis Fiyati"]);
    const saleRaw = readCell(row, ["Satış Fiyatı", "Satis Fiyati", "Sale Price"]);
    const purchaseValue = parseNumberFlexible(purchaseRaw);
    const saleValue = parseNumberFlexible(saleRaw);
    const purchaseCurrency = normalizeCurrency(readCell(row, ["Alış Para Birimi", "Alis Para Birimi", "Purchase Currency"]) || "USD");
    const saleCurrency = normalizeCurrency(readCell(row, ["Satış Para Birimi", "Satis Para Birimi", "Sale Currency"]) || "USD");
    const payload = { updated_at: new Date().toISOString() };
    if (purchaseValue !== null) {
      if (purchaseValue < 0) { summary.invalid += 1; summary.errors.push(`Satır ${i + 2}: Alış fiyatı negatif.`); continue; }
      payload.purchase_price = convertToUsd(purchaseValue, purchaseCurrency);
    }
    if (saleValue !== null) {
      if (saleValue < 0) { summary.invalid += 1; summary.errors.push(`Satır ${i + 2}: Satış fiyatı negatif.`); continue; }
      payload.sale_price = convertToUsd(saleValue, saleCurrency);
    }
    const vat = parseNumberFlexible(readCell(row, ["KDV Oranı", "KDV", "VAT"]));
    const units = parseNumberFlexible(readCell(row, ["Koli İçi", "Koli Ici", "Units Per Carton"]));
    const minStock = parseNumberFlexible(readCell(row, ["Minimum Stok", "Min Stock"]));
    const kg = parseNumberFlexible(readCell(row, ["Koli Kg", "Kg Per Carton"]));
    const unit = readCell(row, ["Stok Birimi", "Birim", "Unit"]);
    if (vat !== null) payload.vat_rate = vat;
    if (units !== null) payload.units_per_carton = units;
    if (minStock !== null) payload.minimum_stock = minStock;
    if (kg !== null) payload.kg_per_carton = kg;
    if (unit) payload.unit = String(unit).trim();
    await query(client.from("products").update(payload).eq("id", product.id).select("id"));
    summary.updated += 1;
  }
  await loadData();
  const afterCount = state.products.filter((p) => p.active !== false).length;
  if (afterCount < beforeCount) throw new Error("Güvenlik nedeniyle işlem iptal edildi: fiyat yükleme ürün silmeye/pasife almaya çalıştı.");
  setStatus(`Fiyat yükleme tamamlandı. Okunan: ${summary.read}, güncellenen: ${summary.updated}, eşleşmeyen: ${summary.unmatched}, hatalı: ${summary.invalid}, boş: ${summary.blank}, silinen: 0, pasife alınan: 0.${summary.errors.length ? " Detay: " + summary.errors.slice(0, 5).join(" | ") : ""}`);
  event.target.value = "";
};

const saveInvoice = async (event) => {
  const form = event.currentTarget;
  const values = formObject(form);
  if (!state.invoiceLines.length) throw new Error("En az bir fatura satırı ekleyin.");
  const currency = values.currency || "USD";
  const linePayloads = state.invoiceLines.map((line) => {
    const calc = invoiceLineCalc(line);
    return { ...line, quantity: Number(line.stock_quantity || line.quantity || 0), unit_price: Number(line.unit_price || 0), line_subtotal: calc.subtotal, line_discount: calc.discount, line_tax: calc.tax, line_total: calc.total };
  });
  const subtotal = linePayloads.reduce((sum, line) => sum + Number(line.line_subtotal || 0), 0);
  const totalDiscount = linePayloads.reduce((sum, line) => sum + Number(line.line_discount || 0), 0);
  const taxTotal = linePayloads.reduce((sum, line) => sum + Number(line.line_tax || 0), 0);
  const grandTotal = linePayloads.reduce((sum, line) => sum + Number(line.line_total || 0), 0);
  const invoiceNo = values.document_number || `INV-${today().replaceAll("-", "")}-${String(state.invoices.length + 1).padStart(3, "0")}`;
  const invoiceData = {
    customer_id: values.customer_id || null,
    invoice_type: values.invoice_type,
    scenario: values.scenario,
    invoice_no: invoiceNo,
    invoice_date: values.invoice_date || today(),
    due_date: values.due_date || null,
    currency,
    subtotal,
    total_discount: totalDiscount,
    tax_total: taxTotal,
    grand_total: grandTotal,
    notes: values.notes || null,
    status: "posted",
    draft_data: { document_number: invoiceNo, payment_note: state.settings?.invoice_template?.payment_note || "" },
    updated_at: new Date().toISOString(),
  };
  let invoice;
  if (state.editingInvoiceId) {
    [invoice] = await query(client.from("invoices").update(invoiceData).eq("id", state.editingInvoiceId).select("*"));
    await query(client.from("invoice_items").delete().eq("invoice_id", state.editingInvoiceId).select("id"));
  } else {
    [invoice] = await query(client.from("invoices").insert(invoiceData).select("*"));
  }
  const items = linePayloads.map((line, index) => ({
    invoice_id: invoice.id,
    product_id: line.product_id,
    line_no: index + 1,
    description: line.description,
    barcode: line.barcode || null,
    quantity: line.quantity,
    unit: line.selected_unit || "adet",
    unit_price: line.unit_price,
    currency: line.currency || currency,
    discount_1: Number(line.discount_1 || 0),
    discount_2: Number(line.discount_2 || 0),
    discount_3: Number(line.discount_3 || 0),
    tax_rate: Number(line.tax_rate || 0),
    line_subtotal: line.line_subtotal,
    line_discount: line.line_discount,
    line_tax: line.line_tax,
    line_total: line.line_total,
  }));
  await query(client.from("invoice_items").insert(items).select("id"));
  for (const line of state.invoiceLines) {
    const direction = values.invoice_type === "purchase" ? 1 : -1;
    const qty = direction * Number(line.stock_quantity || line.quantity || 0);
    await query(client.from("products").update({ stock_quantity: Number(line.available_stock || 0) + qty, updated_at: new Date().toISOString() }).eq("id", line.product_id).select("id"));
    await query(client.from("stock_movements").insert({ product_id: line.product_id, movement_type: values.invoice_type, quantity: qty, reference_type: "invoice", reference_id: invoice.id, unit_cost: Number(line.unit_price || 0), note: invoiceNo }).select("id"));
  }
  document.querySelector("#invoiceDialog").close();
  state.invoiceLines = [];
  await loadData();
  setStatus(`${invoiceNo} kaydedildi ve stok güncellendi.`);
};

const addInvoiceLine = (button) => {
  const row = button.closest("[data-picker-row]");
  const product = state.products.find((item) => item.id === row.dataset.pickerRow);
  if (!product) return;
  const quantity = Number(row.querySelector("[data-picker-qty]").value || 1);
  const selectedUnit = row.querySelector("[data-picker-unit]").value;
  const stockQty = stockQuantityFor(quantity, selectedUnit, product.units_per_carton);
  state.invoiceLines.push({
    product_id: product.id,
    barcode: product.barcode || product.sku || "",
    description: `${product.brand || ""} ${product.name} ${product.grammage || ""}`.trim(),
    available_stock: Number(product.stock_quantity || 0),
    quantity,
    selected_unit: selectedUnit,
    stock_quantity: stockQty,
    units_per_carton: Number(product.units_per_carton || 1),
    unit_price: Number(row.querySelector("[data-picker-price]").value || 0),
    currency: row.querySelector("[data-picker-currency]").value,
    discount_1: 0,
    discount_2: 0,
    discount_3: 0,
    tax_rate: Number(product.vat_rate || 0),
  });
  renderInvoiceLines();
};

const setInvoiceMode = (type, order = null) => {
  const form = document.querySelector("#invoiceForm");
  form.reset();
  state.editingInvoiceId = null;
  state.invoiceLines = [];
  form.elements.invoice_type.value = type;
  form.elements.invoice_date.value = today();
  form.elements.discount_rate.value = "0";
  form.elements.source_order_id.value = order?.id || "";
  const purchase = type === "purchase";
  const returnInvoice = type === "return";
  document.querySelector("#invoiceKicker").textContent = purchase ? "ALIŞ FATURASI" : returnInvoice ? "İADE FATURASI" : "SATIŞ FATURASI";
  document.querySelector("#invoiceDialogTitle").textContent = purchase ? "Alış faturası ve stok girişi" : returnInvoice ? "Müşteri iade faturası ve stok girişi" : "Satış / ihracat faturası";
  document.querySelector("#customerField").hidden = false;
  form.elements.customer_id.required = true;
  form.elements.scenario.value = purchase || returnInvoice ? "domestic" : "export";
  document.querySelector("#saveInvoiceButton").textContent = purchase ? "Alış faturasını işle ve stoğa ekle" : returnInvoice ? "İade faturasını kaydet ve stoğa ekle" : "Satış faturasını kaydet ve stoktan düş";
  document.querySelector("#invoiceProductSearch").value = "";
  if (order) {
    const customer = state.customers.find((item) => item.email && item.email === order.email) || state.customers[0];
    form.elements.customer_id.value = customer?.id || "";
    (order.items || []).forEach((line) => {
      const product = state.products.find((item) => item.id === line.product_id || item.sku === line.sku || item.name === line.product);
      if (product) state.invoiceLines.push({ product_id: product.id, barcode: product.barcode || product.sku || "", description: `${product.brand || ""} ${product.name}`.trim(), available_stock: Number(product.stock_quantity || 0), quantity: Number(line.cartons || line.quantity || 1), selected_unit: "koli", stock_quantity: stockQuantityFor(line.cartons || line.quantity || 1, "koli", product.units_per_carton), units_per_carton: Number(product.units_per_carton || 1), unit_price: productUnitPrice(product, "sale", "koli"), currency: "USD", discount_1: 0, discount_2: 0, discount_3: 0, tax_rate: form.elements.scenario.value === "export" ? 0 : Number(product.vat_rate || 20) });
    });
  }
  renderInvoiceProductPicker();
  renderInvoiceLines();
  document.querySelector("#invoiceDialog").showModal();
};

const editInvoice = async (invoiceId) => {
  const invoice = state.invoices.find((item) => item.id === invoiceId);
  if (!invoice) throw new Error("Fatura kaydı bulunamadı.");
  setInvoiceMode(invoice.invoice_type || "sale");
  state.editingInvoiceId = invoiceId;
  const form = document.querySelector("#invoiceForm");
  form.elements.customer_id.value = invoice.customer_id || "";
  form.elements.invoice_date.value = invoice.invoice_date || today();
  form.elements.due_date.value = invoice.due_date || "";
  form.elements.document_number.value = invoice.draft_data?.document_number || invoice.invoice_no || "";
  form.elements.scenario.value = invoice.scenario || "export";
  form.elements.currency.value = invoice.currency || "USD";
  form.elements.notes.value = invoice.notes || "";
  const items = await query(client.from("invoice_items").select("*").eq("invoice_id", invoiceId));
  state.invoiceLines = items.map((item) => {
    const product = state.products.find((p) => p.id === item.product_id) || {};
    return { product_id: item.product_id, barcode: item.barcode || product.barcode || product.sku || "", description: item.description, available_stock: Number(product.stock_quantity || 0), quantity: Number(item.quantity || 0), selected_unit: item.unit || "adet", stock_quantity: Number(item.quantity || 0), units_per_carton: Number(product.units_per_carton || 1), unit_price: Number(item.unit_price || 0), currency: item.currency || invoice.currency || "USD", discount_1: Number(item.discount_1 || 0), discount_2: Number(item.discount_2 || 0), discount_3: Number(item.discount_3 || 0), tax_rate: Number(item.tax_rate || 0) };
  });
  renderInvoiceLines();
};

const deleteInvoice = async (invoiceId) => {
  const invoice = state.invoices.find((item) => item.id === invoiceId);
  if (!invoice || !confirm(`${invoice.invoice_no} silinsin mi?`)) return;
  await query(client.from("invoices").delete().eq("id", invoiceId).select("id"));
  await loadData();
  setStatus("Fatura silindi.");
};

const openInvoiceDetail = async (invoiceId) => {
  state.activeInvoiceId = invoiceId;
  const invoice = state.invoices.find((item) => item.id === invoiceId);
  if (!invoice) throw new Error("Fatura bulunamadı.");
  const customer = state.customers.find((item) => item.id === invoice.customer_id);
  const items = await query(client.from("invoice_items").select("*,products(sku,barcode)").eq("invoice_id", invoiceId));
  document.querySelector("#invoiceDetailHeading").textContent = invoice.draft_data?.document_number || invoice.invoice_no || "Fatura";
  document.querySelector("#invoiceDetailStatus").textContent = invoice.status || "Kayıtlı";
  document.querySelector("#invoiceDetailType").textContent = invoice.invoice_type || "-";
  document.querySelector("#invoiceDetailDate").textContent = date(invoice.invoice_date);
  document.querySelector("#invoiceDetailNumber").textContent = invoice.draft_data?.document_number || invoice.invoice_no || "-";
  document.querySelector("#invoiceDetailDueDate").textContent = date(invoice.due_date);
  document.querySelector("#invoiceDetailCustomer").textContent = customer?.company || "-";
  document.querySelector("#invoiceDetailCurrency").textContent = invoice.currency || "USD";
  document.querySelector("#invoiceDetailScenario").textContent = invoice.scenario || "-";
  document.querySelector("#invoiceDetailRows").innerHTML = items.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.barcode || item.products?.barcode || item.products?.sku || "-")}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.unit || "adet")}</td><td>${number(item.quantity)}</td><td>${money(item.unit_price, item.currency || invoice.currency)}</td><td>${money(item.line_subtotal, item.currency || invoice.currency)}</td><td>${money(item.line_tax, item.currency || invoice.currency)}</td><td>%${number(item.discount_1)}</td><td>%${number(item.discount_2)}</td><td>%${number(item.discount_3)}</td><td>${escapeHtml(item.notes || "-")}</td></tr>`).join("");
  document.querySelector("#invoiceDetailNote").textContent = invoice.notes || "-";
  document.querySelector("#invoiceDetailSubtotal").textContent = money(invoice.subtotal, invoice.currency);
  document.querySelector("#invoiceDetailDiscount").textContent = money(invoice.total_discount, invoice.currency);
  document.querySelector("#invoiceDetailTax").textContent = money(invoice.tax_total, invoice.currency);
  document.querySelector("#invoiceDetailGrandTotal").textContent = money(invoice.grand_total, invoice.currency);
  document.querySelector("#invoiceDetailDialog").showModal();
};

const updateInvoiceTermDays = () => {
  const form = document.querySelector("#invoiceForm");
  const out = document.querySelector("#invoiceTermDays");
  if (!form.elements.invoice_date.value || !form.elements.due_date.value) { out.textContent = "0 gün"; return; }
  const diff = Math.round((new Date(form.elements.due_date.value) - new Date(form.elements.invoice_date.value)) / 86400000);
  out.textContent = `${diff} gün`;
};

const refreshInvoiceProducts = async () => {
  await loadData();
  renderInvoiceProductPicker();
  setStatus("Ürün listesi yenilendi.");
};

const recordPayment = async (event) => {
  event.preventDefault();
  const values = formObject(event.currentTarget);
  await query(client.from("customer_ledger").insert({
    customer_id: values.customer_id,
    transaction_type: "payment",
    transaction_date: values.payment_date || today(),
    currency: values.currency || "USD",
    debit: 0,
    credit: Number(values.amount || 0),
    description: values.description || "Tahsilat / ödeme",
  }).select("id"));
  document.querySelector("#paymentDialog").close();
  await loadData();
  setStatus("Tahsilat/ödeme kaydedildi.");
};

const adjustStock = async (event) => {
  event.preventDefault();
  const values = formObject(event.currentTarget);
  const product = state.products.find((item) => item.id === values.product_id);
  if (!product) throw new Error("Ürün bulunamadı.");
  const direction = event.currentTarget.dataset.direction === "out" ? -1 : 1;
  const qty = direction * Number(values.quantity || 0);
  await query(client.from("products").update({ stock_quantity: Number(product.stock_quantity || 0) + qty, updated_at: new Date().toISOString() }).eq("id", product.id).select("id"));
  await query(client.from("stock_movements").insert({ product_id: product.id, movement_type: qty > 0 ? "adjustment_in" : "adjustment_out", quantity: qty, reference_type: "manual", note: values.note }).select("id"));
  document.querySelector("#stockDialog").close();
  await loadData();
  setStatus("Manuel stok düzeltmesi kaydedildi.");
};

const updateSelectedCustomers = async (status) => {
  const ids = [...state.selectedCustomers];
  if (!ids.length) throw new Error("Önce en az bir cari seçin.");
  await query(client.from("customers").update({ status, updated_at: new Date().toISOString() }).in("id", ids).select("id"));
  state.selectedCustomers.clear();
  await loadData();
  setStatus(`${ids.length} cari ${status === "active" ? "aktif" : "pasif"} yapıldı.`);
};

const deleteSelectedCustomers = async () => {
  const ids = [...state.selectedCustomers];
  if (!ids.length) throw new Error("Önce en az bir cari seçin.");
  if (!confirm(`${ids.length} seçili cari kalıcı olarak silinsin mi?`)) return;
  await query(client.from("customers").delete().in("id", ids).select("id"));
  state.selectedCustomers.clear();
  await loadData();
  setStatus(`${ids.length} cari silindi.`);
};

const deleteProduct = async (productId) => {
  const product = state.products.find((item) => item.id === productId);
  if (!product || !confirm(`${product.name} stok kartı veritabanından kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`)) return;
  try {
    const deleted = await query(client.from("products").delete().eq("id", productId).select("id"));
    if (!deleted.length) throw new Error("Silme yetkisi alınamadı.");
  } catch (error) {
    if (/foreign key|violates|reference|23503/i.test(String(error.message || error))) {
      if (!confirm("Bu ürünün fatura veya stok geçmişi var; geçmiş bozulmadan kalıcı silinemez. Ürünü arşivleyip stok ve site listelerinden kaldıralım mı?")) return;
      await query(client.from("products").update({ active: false, updated_at: new Date().toISOString() }).eq("id", productId).select("id"));
      state.selectedProducts.delete(productId);
      await loadData();
      setStatus(`${product.name} arşivlendi ve aktif listelerden kaldırıldı.`);
      return;
    }
    throw error;
  }
  state.selectedProducts.delete(productId);
  await loadData();
  setStatus(`${product.name} kalıcı olarak silindi.`);
};

const deleteSelectedProducts = async () => {
  const ids = [...state.selectedProducts];
  if (!ids.length) throw new Error("Önce en az bir ürün seçin.");
  if (!confirm(`${ids.length} seçili ürün silinsin mi? Fatura geçmişi olan ürünler güvenlik için arşivlenecektir.`)) return;
  let deleted = 0;
  let archived = 0;
  for (const productId of ids) {
    try {
      const result = await query(client.from("products").delete().eq("id", productId).select("id"));
      if (result.length) { deleted += 1; continue; }
      throw new Error("Silme yetkisi alınamadı.");
    } catch (error) {
      if (!/foreign key|violates|reference|23503/i.test(String(error.message || error))) throw error;
      await query(client.from("products").update({ active: false, updated_at: new Date().toISOString() }).eq("id", productId).select("id"));
      archived += 1;
    }
  }
  state.selectedProducts.clear();
  await loadData();
  setStatus(`${deleted} ürün silindi${archived ? `, ${archived} ürün geçmişi korumak için arşivlendi` : ""}.`);
};

const hideRowContextMenu = () => {
  const menu = document.querySelector("#rowContextMenu");
  menu.hidden = true;
  state.contextTarget = null;
};

const showRowContextMenu = (type, id, x, y) => {
  const menu = document.querySelector("#rowContextMenu");
  const actionsTarget = document.querySelector("#rowContextActions");
  const record = type === "customer"
    ? state.customers.find((item) => item.id === id)
    : type === "product"
      ? state.products.find((item) => item.id === id)
      : state.invoices.find((item) => item.id === id);
  if (!record) return;
  state.contextTarget = { type, id };
  const title = type === "customer" ? record.company : type === "product" ? record.name : record.draft_data?.document_number || record.invoice_no;
  document.querySelector("#rowContextTitle").textContent = title;
  const actions = {
    customer: [
      ["Hareketler / Ekstre", "customer-history", "primary"], ["Düzenle", "customer-edit"],
      ["Tahsilat / Ödeme", "customer-payment"], [record.status === "passive" ? "Aktif yap" : "Pasif yap", "customer-status"],
      ["Sil", "customer-delete", "danger"],
    ],
    product: [
      ["Hareketler / Ekstre", "product-history", "primary"], ["Düzenle", "product-edit"],
      ["Fiyat gir", "product-price"], ["Stok girişi", "stock-in"], ["Stok çıkışı", "stock-out"],
      ["Sil", "product-delete", "danger"],
    ],
    invoice: [
      ["Faturayı aç", "invoice-open", "primary"], ["Düzenle", "invoice-edit"],
      ["Yazdır", "invoice-print"], ["Sil", "invoice-delete", "danger"],
    ],
  }[type];
  actionsTarget.innerHTML = actions.map(([label, action, className = ""]) => `<button type="button" class="${className}" data-context-action="${action}">${label}</button>`).join("");
  menu.hidden = false;
  const rect = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
};

const submitInvoice = async (event) => {
  event.preventDefault();
  const status = document.querySelector("#invoiceFormStatus");
  const button = document.querySelector("#saveInvoiceButton");
  status.classList.remove("error");
  status.textContent = "Fatura kaydediliyor ve stok güncelleniyor...";
  button.disabled = true;
  try {
    await saveInvoice(event);
  } catch (error) {
    status.classList.add("error");
    status.textContent = friendlyError(error);
    setStatus(friendlyError(error), true);
  } finally {
    button.disabled = false;
  }
};

const saveTemplate = async (event) => {
  event.preventDefault();
  const values = formObject(event.currentTarget);
  await query(client.from("app_settings").upsert({
    id: "main",
    company_name: values.company_name,
    company_tax_number: values.company_tax_number,
    company_tax_office: values.company_tax_office,
    company_address: values.company_address,
    default_currency: "USD",
    gib_provider: document.querySelector("#gibProvider").value || null,
    invoice_template: { incoterm: values.incoterm, payment_note: values.payment_note },
    updated_at: new Date().toISOString(),
  }));
  await loadData();
  setStatus("İhracat fatura taslağı kaydedildi.");
};

const printInvoice = async (invoiceId) => {
  const invoice = state.invoices.find((item) => item.id === invoiceId);
  const items = await query(client.from("invoice_items").select("*,products(sku,barcode)").eq("invoice_id", invoiceId));
  const party = state.customers.find((item) => item.id === invoice.customer_id);
  const settings = state.settings || {};
  const popup = window.open("", "_blank", "width=1000,height=800");
  if (!popup) throw new Error("Fatura penceresi açılamadı. Tarayıcı açılır pencere iznini kontrol edin.");
  const companyBlock = `<strong>${escapeHtml(settings.company_name || "FİRMA BİLGİLERİ")}</strong>
    <p>${escapeHtml(settings.company_address || "")}<br>Vergi Dairesi: ${escapeHtml(settings.company_tax_office || "-")}<br>VKN: ${escapeHtml(settings.company_tax_number || "-")}</p>`;
  const partyBlock = `<strong>${escapeHtml(party?.company || "CARİ")}</strong>
    <p>${escapeHtml(party?.address || "")}<br>${escapeHtml(party?.country || "")}<br>Vergi Dairesi: ${escapeHtml(party?.tax_office || "-")}<br>VKN: ${escapeHtml(party?.tax_number || "-")}</p>`;
  const incomingInvoice = invoice.invoice_type === "purchase" || invoice.invoice_type === "return";
  const seller = incomingInvoice ? partyBlock : companyBlock;
  const buyer = incomingInvoice ? companyBlock : partyBlock;
  const documentNumber = invoice.draft_data?.document_number || invoice.invoice_no;
  popup.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(invoice.invoice_no)}</title>
    <style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#18212b;margin:0;font-size:11px}header{display:flex;justify-content:space-between;border-bottom:2px solid #17202a;padding-bottom:12px}h1{margin:0;font-size:24px}.invoice-label{text-align:right}.invoice-label strong{display:block;font-size:16px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0}.card{min-height:105px;padding:12px;border:1px solid #cfd6dc}.card h3{margin:0 0 8px;font-size:10px;color:#667085}.card p{line-height:1.45;margin:5px 0}.invoice-info{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin-bottom:14px;background:#cfd6dc;border:1px solid #cfd6dc}.invoice-info div{padding:8px;background:#fff}.invoice-info span{display:block;color:#667085;font-size:9px;margin-bottom:3px}table{width:100%;border-collapse:collapse}th,td{padding:6px 5px;border:1px solid #d9dee3;text-align:left;font-size:9px;vertical-align:top}th{background:#f1f3f5}.right{text-align:right}.center{text-align:center}.total{margin:14px 0 0 auto;width:330px;border-top:2px solid #17202a}.total p{display:flex;justify-content:space-between;margin:0;padding:6px;border-bottom:1px solid #dde2e6}.total p:last-child{font-size:13px}.note{margin-top:18px;padding:10px;border:1px solid #dde2e6;color:#475467;white-space:pre-line}.warning{padding:8px;background:#fff4e5;color:#8a4b08}.barcode{font-family:Consolas,monospace}.print-button{margin-top:18px;padding:10px 16px}@media print{.print-button,.warning{display:none}}</style></head><body>
    <p class="warning">Düzenlenebilir taslak belgedir. GİB'e gönderilmemiştir.</p>
    <header><div><h1>e-FATURA TASLAĞI</h1><p>${invoice.invoice_type === "purchase" ? "ALIŞ FATURASI" : invoice.invoice_type === "return" ? "İADE FATURASI" : invoice.scenario === "export" ? "COMMERCIAL EXPORT INVOICE" : "SATIŞ FATURASI"}</p></div><div class="invoice-label"><strong>${escapeHtml(documentNumber)}</strong><span>${date(invoice.invoice_date)}</span></div></header>
    <section class="meta"><div class="card"><h3>SATICI</h3>${seller}</div><div class="card"><h3>ALICI</h3>${buyer}</div></section>
    <section class="invoice-info"><div><span>FATURA TARİHİ</span><strong>${date(invoice.invoice_date)}</strong></div><div><span>VADE TARİHİ</span><strong>${date(invoice.due_date)}</strong></div><div><span>SENARYO</span><strong>${invoice.scenario === "export" ? "İhracat / KDV %0" : "Türkiye"}</strong></div><div><span>PARA BİRİMİ</span><strong>${escapeHtml(invoice.currency)}</strong></div></section>
    <table><thead><tr><th>#</th><th>Barkod / Ürün Kodu</th><th>Mal / Hizmet</th><th class="right">Miktar</th><th class="right">Birim Fiyat</th><th class="right">İsk. 1/2/3</th><th class="right">KDV</th><th class="right">KDV Tutarı</th><th class="right">Tutar</th></tr></thead>
    <tbody>${items.map((item, index) => `<tr><td>${index + 1}</td><td class="barcode">${escapeHtml(item.barcode || item.products?.barcode || item.product_code || item.products?.sku || "-")}</td><td>${escapeHtml(item.description)}</td><td class="right">${number(item.quantity)} ${item.unit === "koli" ? "Koli" : "Adet"}</td><td class="right">${money(item.unit_price, invoice.currency)}</td><td class="right">%${number(item.discount_1)} / %${number(item.discount_2)} / %${number(item.discount_3)}</td><td class="right">%${number(item.tax_rate)}</td><td class="right">${money(item.line_tax, invoice.currency)}</td><td class="right">${money(item.line_total, invoice.currency)}</td></tr>`).join("")}</tbody></table>
    <div class="total"><p><span>Ara toplam</span><strong>${money(invoice.subtotal, invoice.currency)}</strong></p><p><span>Toplam iskonto</span><strong>${money(invoice.total_discount, invoice.currency)}</strong></p><p><span>KDV</span><strong>${money(invoice.tax_total, invoice.currency)}</strong></p><p><span>Genel toplam</span><strong>${money(invoice.grand_total, invoice.currency)}</strong></p></div>
    <p class="note"><strong>Açıklama:</strong><br>${escapeHtml(invoice.notes || "-")}<br>${escapeHtml(invoice.draft_data?.payment_note || "")}</p><button class="print-button" onclick="window.print()">Yazdır / PDF kaydet</button></body></html>`);
  popup.document.close();
};

const csvDownload = (filename, rows) => {
  const csv = "\uFEFF" + rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

const safely = (handler) => async (event) => {
  try {
    setStatus("");
    await handler(event);
  } catch (error) {
    console.error(error);
    if (error.message === "SCHEMA_UPDATE_REQUIRED") {
      state.schemaReady = false;
      document.querySelector("#schemaWarning").hidden = false;
      setStatus("Önce Supabase veritabanı güncellemesini tamamlayın.", true);
      return;
    }
    setStatus(friendlyError(error), true);
  }
};

const boot = async () => {
  if (!client) throw new Error("Supabase istemcisi kurulamadı. backend-config.js dosyasını kontrol edin.");
  await loadAdminExchangeRates();
  const { data } = await client.auth.getSession();
  if (await verifyAdmin(data.session)) {
    showApp(data.session);
    await loadData();
  } else showLogin();
};

document.querySelector("#loginForm").addEventListener("submit", safely(async (event) => {
  event.preventDefault();
  const { data, error } = await client.auth.signInWithPassword({
    email: document.querySelector("#loginEmail").value.trim(),
    password: document.querySelector("#loginPassword").value,
  });
  if (error) throw error;
  if (!await verifyAdmin(data.session)) {
    await client.auth.signOut();
    throw new Error("Bu hesabın yönetim paneli yetkisi yok.");
  }
  showApp(data.session);
  await loadData();
  await loadAdminExchangeRates();
}));

document.querySelector("#signOutButton").addEventListener("click", safely(async () => { await client.auth.signOut(); showLogin(); }));
if (typeof importCatalog === "function") document.querySelector("#receiveSiteDataButton").addEventListener("click", safely(importCatalog));
if (typeof publishSiteData === "function") document.querySelector("#sendSiteDataButton").addEventListener("click", safely(publishSiteData));
document.querySelector("#customerSearch").addEventListener("input", renderCustomers);
document.querySelector("#productSearch").addEventListener("input", () => { state.productPage = 1; renderProducts(); });
document.querySelector("#productSort").addEventListener("change", (event) => { state.productSort = event.target.value; state.productPage = 1; renderProducts(); });
document.querySelector("#customerForm").addEventListener("submit", safely(saveCustomer));
document.querySelector("#productForm").addEventListener("submit", safely(saveProduct));
document.querySelector("#productPriceForm").addEventListener("submit", safely(saveProductPrices));
document.querySelector("#downloadPriceTemplateButton").addEventListener("click", downloadPriceTemplate);
document.querySelector("#priceImportFile").addEventListener("change", safely(importPriceFile));
document.querySelector("#stockForm").addEventListener("submit", safely(adjustStock));
document.querySelector("#paymentForm").addEventListener("submit", safely(recordPayment));
document.querySelector("#invoiceForm").addEventListener("submit", submitInvoice);
document.querySelector("#templateForm").addEventListener("submit", safely(saveTemplate));
if (typeof importCatalog === "function") document.querySelector("#importCatalogButton").addEventListener("click", safely(importCatalog));
document.querySelector("#openStockCorrection").addEventListener("click", () => { renderInvoiceOptions(); document.querySelector("#stockDialog").showModal(); });
document.querySelector("#newSaleInvoiceButton").addEventListener("click", () => setInvoiceMode("sale"));
document.querySelector("#newPurchaseInvoiceButton").addEventListener("click", () => setInvoiceMode("purchase"));
document.querySelector("#newReturnInvoiceButton").addEventListener("click", () => setInvoiceMode("return"));
document.querySelector("#invoiceNewCustomerButton").addEventListener("click", () => {
  const form = document.querySelector("#customerForm");
  openEditForm("customerDialog", "customerForm");
  form.dataset.invoiceContext = "true";
  form.elements.is_seller.checked = true;
  form.elements.is_buyer.checked = true;
});
document.querySelector("#customerDialog").addEventListener("close", () => {
  delete document.querySelector("#customerForm").dataset.invoiceContext;
});
document.querySelector("#invoiceType").addEventListener("change", (event) => setInvoiceMode(event.target.value));
document.querySelector("#invoiceDetailPrint").addEventListener("click", safely(async () => {
  if (state.activeInvoiceId) await printInvoice(state.activeInvoiceId);
}));
document.querySelector("#invoiceForm [name='currency']").addEventListener("change", renderInvoiceLines);
document.querySelector("#invoiceForm [name='scenario']").addEventListener("change", renderInvoiceLines);
document.querySelector("#invoiceForm [name='invoice_discount_rate']").addEventListener("input", renderInvoiceLines);
document.querySelector("#invoiceProductSearch").addEventListener("input", renderInvoiceProductPicker);
document.querySelector("#refreshInvoiceProductsButton").addEventListener("click", safely(refreshInvoiceProducts));
document.querySelector("#invoiceForm [name='invoice_date']").addEventListener("change", updateInvoiceTermDays);
document.querySelector("#invoiceForm [name='due_date']").addEventListener("change", updateInvoiceTermDays);
document.querySelector("#selectAllCustomers").addEventListener("change", (event) => {
  state.selectedCustomers.clear();
  if (event.target.checked) {
    const term = document.querySelector("#customerSearch").value.trim().toLocaleLowerCase("tr");
    state.customers.filter((item) => [item.code, item.company, item.contact_name, item.email, item.tax_number]
      .some((value) => String(value || "").toLocaleLowerCase("tr").includes(term)))
      .forEach((item) => state.selectedCustomers.add(item.id));
  }
  renderCustomers();
});
document.querySelector("#activateCustomersButton").addEventListener("click", safely(() => updateSelectedCustomers("active")));
document.querySelector("#deactivateCustomersButton").addEventListener("click", safely(() => updateSelectedCustomers("passive")));
document.querySelector("#deleteCustomersButton").addEventListener("click", safely(deleteSelectedCustomers));
document.querySelector("#deleteSelectedProductsButton").addEventListener("click", safely(deleteSelectedProducts));
document.querySelector("#selectAllProducts").addEventListener("change", (event) => {
  state.selectedProducts.clear();
  if (event.target.checked) getSortedProducts().forEach((item) => state.selectedProducts.add(item.id));
  renderProducts();
});

document.querySelector("#mainNav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (!button) return;
  document.querySelectorAll("#mainNav [data-view], .view").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  document.querySelector(`[data-view-panel="${button.dataset.view}"]`).classList.add("active");
  document.querySelector("#pageTitle").textContent = button.childNodes[0].textContent.trim();
});

document.addEventListener("click", (event) => {
  const closeButton = event.target.closest("[data-close-dialog]");
  if (!closeButton) return;
  event.preventDefault();
  event.stopPropagation();
  closeButton.closest("dialog")?.close();
}, true);

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

document.addEventListener("contextmenu", (event) => {
  const customerRow = event.target.closest("[data-customer-row]");
  const productRow = event.target.closest("[data-product-row]");
  const invoiceRow = event.target.closest("[data-invoice-row]");
  const row = customerRow || productRow || invoiceRow;
  if (!row) return;
  event.preventDefault();
  showRowContextMenu(customerRow ? "customer" : productRow ? "product" : "invoice", customerRow?.dataset.customerRow || productRow?.dataset.productRow || invoiceRow.dataset.invoiceRow, event.clientX, event.clientY);
});

document.querySelector("#rowContextMenu").addEventListener("click", safely(async (event) => {
  const button = event.target.closest("[data-context-action]");
  const target = state.contextTarget;
  if (!button || !target) return;
  const action = button.dataset.contextAction;
  hideRowContextMenu();
  if (action === "customer-history") await openCustomerHistory(target.id);
  if (action === "customer-edit") openEditForm("customerDialog", "customerForm", state.customers.find((item) => item.id === target.id));
  if (action === "customer-payment") {
    const customer = state.customers.find((item) => item.id === target.id);
    openEditForm("paymentDialog", "paymentForm", { customer_id: customer.id, currency: customer.currency, payment_date: today() });
    document.querySelector("#paymentCustomerName").textContent = `${customer.code} · ${customer.company}`;
  }
  if (action === "customer-status") {
    const customer = state.customers.find((item) => item.id === target.id);
    state.selectedCustomers = new Set([target.id]);
    await updateSelectedCustomers(customer.status === "passive" ? "active" : "passive");
  }
  if (action === "customer-delete") await deleteCustomer(target.id);
  if (action === "product-history") await openProductHistory(target.id);
  if (action === "product-edit") openEditForm("productDialog", "productForm", state.products.find((item) => item.id === target.id));
  if (action === "product-price") openProductPriceDialog(target.id);
  if (action === "stock-in") openProductStockMovement(target.id, "in");
  if (action === "stock-out") openProductStockMovement(target.id, "out");
  if (action === "product-delete") await deleteProduct(target.id);
  if (action === "invoice-open") await openInvoiceDetail(target.id);
  if (action === "invoice-edit") await editInvoice(target.id);
  if (action === "invoice-print") await printInvoice(target.id);
  if (action === "invoice-delete") await deleteInvoice(target.id);
}));

document.addEventListener("click", (event) => {
  if (!event.target.closest("#rowContextMenu")) hideRowContextMenu();
});
window.addEventListener("scroll", hideRowContextMenu, true);
window.addEventListener("resize", hideRowContextMenu);

document.addEventListener("change", (event) => {
  if (event.target.closest("[data-price-currency], #productPriceForm select")) {
    refreshProductPricePreviews();
  }
  const pickerCurrency = event.target.closest("[data-picker-currency]");
  if (pickerCurrency) {
    document.querySelector("#invoiceForm").elements.currency.value = pickerCurrency.value;
    document.querySelectorAll("[data-picker-currency]").forEach((select) => { select.value = pickerCurrency.value; });
    renderInvoiceLines();
  }
  const pickerUnit = event.target.closest("[data-picker-unit]");
  if (pickerUnit) {
    const row = pickerUnit.closest("[data-picker-row]");
    const product = state.products.find((item) => item.id === row.dataset.pickerRow);
    const invoiceType = document.querySelector("#invoiceForm").elements.invoice_type.value;
    row.querySelector("[data-picker-price]").value = productUnitPrice(product, invoiceType, pickerUnit.value);
  }
  const field = event.target.closest("[data-line-field]");
  if (!field) return;
  const line = state.invoiceLines[Number(field.dataset.lineIndex)];
  if (!line) return;
  if (field.dataset.lineField === "selected_unit") {
    const previousUnit = line.selected_unit;
    line.selected_unit = field.value;
    if (previousUnit !== line.selected_unit) {
      line.unit_price = previousUnit === "adet"
        ? Number(line.unit_price) * Math.max(Number(line.units_per_carton), 1)
        : Number(line.unit_price) / Math.max(Number(line.units_per_carton), 1);
    }
  } else {
    line[field.dataset.lineField] = Number(field.value || 0);
  }
  line.stock_quantity = stockQuantityFor(line.quantity, line.selected_unit, line.units_per_carton);
  renderInvoiceLines();
});

document.addEventListener("input", (event) => {
  if (event.target.closest("#productForm [name='purchase_price'], #productForm [name='sale_price'], #productPriceForm input")) {
    refreshProductPricePreviews();
  }
});

document.addEventListener("click", safely(async (event) => {
  const productPageButton = event.target.closest("[data-product-page]");
 if (productPageButton && !productPageButton.disabled) {
  state.productPage = Number(productPageButton.dataset.productPage || 1);
  renderProducts();
  document.querySelector("#productRows")?.closest(".table-wrap")?.scrollIntoView({ block: "start" });
  return;
 }
 const opener = event.target.closest("[data-open-dialog]");
  if (opener) {
    if (opener.dataset.openDialog === "customerDialog") delete document.querySelector("#customerForm").dataset.invoiceContext;
    openEditForm(opener.dataset.openDialog, opener.dataset.openDialog.replace("Dialog", "Form"));
  }
  const customerEdit = event.target.closest("[data-customer-edit]");
  if (customerEdit) openEditForm("customerDialog", "customerForm", state.customers.find((item) => item.id === customerEdit.dataset.customerEdit));
 const productEdit = event.target.closest("[data-product-edit]");
  if (productEdit) openEditForm("productDialog", "productForm", state.products.find((item) => item.id === productEdit.dataset.productEdit));
  const productPrice = event.target.closest("[data-product-price]");
  if (productPrice) openProductPriceDialog(productPrice.dataset.productPrice);
  const productHistory = event.target.closest("[data-product-history]");
  if (productHistory) await openProductHistory(productHistory.dataset.productHistory);
  const productDelete = event.target.closest("[data-product-delete]");
  if (productDelete) await deleteProduct(productDelete.dataset.productDelete);
  const payment = event.target.closest("[data-customer-payment]");
  if (payment) {
    const customer = state.customers.find((item) => item.id === payment.dataset.customerPayment);
    openEditForm("paymentDialog", "paymentForm", { customer_id: customer.id, currency: customer.currency, payment_date: today() });
    document.querySelector("#paymentCustomerName").textContent = `${customer.code} · ${customer.company}`;
  }
  const productSelect = event.target.closest("[data-product-select]");
  if (productSelect) {
    productSelect.checked ? state.selectedProducts.add(productSelect.dataset.productSelect) : state.selectedProducts.delete(productSelect.dataset.productSelect);
    renderProducts();
  }
  const customerSelect = event.target.closest("[data-customer-select]");
  if (customerSelect) {
    customerSelect.checked ? state.selectedCustomers.add(customerSelect.dataset.customerSelect) : state.selectedCustomers.delete(customerSelect.dataset.customerSelect);
    renderCustomers();
  }
  const sortHeader = event.target.closest("[data-product-sort]");
  if (sortHeader) {
    const field = sortHeader.dataset.productSort;
    state.productSort = state.productSort === `${field}-asc` ? `${field}-desc` : `${field}-asc`;
    document.querySelector("#productSort").value = state.productSort;
    state.productPage = 1; renderProducts();
  }
  const addProduct = event.target.closest("[data-add-invoice-product]");
  if (addProduct) addInvoiceLine(addProduct);
  const removeLine = event.target.closest("[data-remove-line]");
  if (removeLine) { state.invoiceLines.splice(Number(removeLine.dataset.removeLine), 1); renderInvoiceLines(); }
  const print = event.target.closest("[data-invoice-print]");
  if (print) await printInvoice(print.dataset.invoicePrint);
  const invoiceEdit = event.target.closest("[data-invoice-edit]");
  if (invoiceEdit) await editInvoice(invoiceEdit.dataset.invoiceEdit);
  const invoiceDelete = event.target.closest("[data-invoice-delete]");
  if (invoiceDelete) await deleteInvoice(invoiceDelete.dataset.invoiceDelete);
  const invoiceOpen = event.target.closest("[data-invoice-open]");
  if (invoiceOpen && !event.target.closest("[data-invoice-print],[data-invoice-edit],[data-invoice-delete]")) await openInvoiceDetail(invoiceOpen.dataset.invoiceOpen);
  const convert = event.target.closest("[data-order-convert]");
  if (convert) setInvoiceMode("sale", state.orders.find((item) => item.id === convert.dataset.orderConvert));
  const detail = event.target.closest("[data-order-detail]");
  if (detail) {
    const order = state.orders.find((item) => item.id === detail.dataset.orderDetail);
    alert((order.items || []).map((item, index) => `${index + 1}. ${item.brand || ""} ${item.product}: ${item.cartons} koli`).join("\n"));
  }
  const pickerSort = event.target.closest("[data-picker-sort]");
  if (pickerSort) {
    const field = pickerSort.dataset.pickerSort;
    state.invoiceProductSort = {
      field,
      direction: state.invoiceProductSort.field === field && state.invoiceProductSort.direction === "asc" ? "desc" : "asc",
    };
    renderInvoiceProductPicker();
  }
  const deleteOrder = event.target.closest("[data-order-delete]");
  if (deleteOrder) await deleteIncomingOrder(deleteOrder.dataset.orderDelete);
}));

document.querySelector("#exportCustomersButton").addEventListener("click", () => csvDownload("cari-bakiyeler.csv", [
  ["Cari kod", "Firma", "Para birimi", "Bakiye"],
  ...state.balances.map((item) => [item.code, item.company, item.currency || "USD", item.balance]),
]));
document.querySelector("#exportStockButton").addEventListener("click", () => csvDownload("stok-listesi.csv", [
 ["Sıra No", "Marka", "Barkod", "Ürün İsmi", "Gramaj", "Koli İçi", "Stok Adet", "Stok Koli", "Minimum Stok", "Adet Alış USD", "Ortalama Alış USD", "Adet Satış USD", "Ortalama Satış USD", "Kâr Endeksi %", "KDV"],
 ...state.products.map((item, index) => {
  const averages = productAveragePrices(item.id);
  const averagePurchase = averages.purchase || Number(item.purchase_price || 0);
  const averageSale = averages.sale || Number(item.sale_price || 0);
  return [
  index + 1,
  item.brand,
  item.barcode || item.sku,
  item.name,
  item.grammage,
  Number(item.units_per_carton || 0) || "",
  item.stock_quantity,
  formatStockCartons(item.stock_quantity, item.units_per_carton),
  item.minimum_stock,
  item.purchase_price,
  averagePurchase,
  item.sale_price,
  averageSale,
  averagePurchase > 0 ? ((averageSale - averagePurchase) / averagePurchase) * 100 : 0,
  item.vat_rate,
 ];
 }),
]));

boot().catch((error) => {
  document.querySelector("#loginStatus").textContent = error.message || "Panel başlatılamadı.";
});
