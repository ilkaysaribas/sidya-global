const config = window.SIDYA_BACKEND || {};
const publishableKey = config.supabasePublishableKey || config.supabaseAnonKey || "";
const client = config.supabaseUrl && publishableKey && window.supabase
  ? window.supabase.createClient(config.supabaseUrl, publishableKey)
  : null;

const state = {
  customers: [],
  balances: [],
  suppliers: [],
  supplierBalances: [],
  products: [],
  invoices: [],
  invoiceItems: [],
  ledger: [],
  orders: [],
  movements: [],
  vat: [],
  settings: {},
  invoiceLines: [],
  selectedProducts: new Set(),
  productSort: "name-asc",
  schemaReady: true,
  session: null,
};

const currencySymbols = { USD: "$", EUR: "€", TRY: "₺", GBP: "£" };
const money = (value, currency = "USD") => new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: currency || "USD",
  maximumFractionDigits: 2,
}).format(Number(value || 0));
const number = (value) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 }).format(Number(value || 0));
const date = (value) => value ? new Intl.DateTimeFormat("tr-TR").format(new Date(`${String(value).slice(0, 10)}T12:00:00`)) : "-";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
})[char]);
const formObject = (form) => Object.fromEntries(new FormData(form).entries());
const today = () => new Date().toISOString().slice(0, 10);
const toUsd = (amount, currency, exchangeRate) =>
  String(currency).toUpperCase() === "USD" ? Number(amount || 0) : Number(amount || 0) / Math.max(Number(exchangeRate || 1), 0.000001);

const setStatus = (message = "", error = false) => {
  const target = document.querySelector("#globalStatus");
  target.textContent = message;
  target.style.color = error ? "#b42318" : "#087462";
};

const isSchemaError = (error) => {
  const message = String(error?.message || "");
  return error?.code === "PGRST204" ||
    error?.code === "PGRST205" ||
    /schema cache|could not find the table|could not find the .* column/i.test(message);
};

const friendlyError = (error) => {
  if (isSchemaError(error)) {
    state.schemaReady = false;
    document.querySelector("#schemaWarning").hidden = false;
    return "Supabase veritabanı henüz güncellenmemiş. Güncel schema.sql dosyasını SQL Editor'da çalıştırın.";
  }
  return error?.message || "İşlem tamamlanamadı.";
};

const requireClient = () => {
  if (!client) throw new Error("Supabase bağlantı ayarları bulunamadı.");
  return client;
};

const query = async (promise) => {
  const { data, error } = await promise;
  if (error) throw error;
  return data || [];
};

const optionalQuery = async (promise, fallback = []) => {
  const { data, error } = await promise;
  if (error) {
    if (isSchemaError(error)) state.schemaReady = false;
    console.warn(error.message || "Optional module is not available yet.");
    return fallback;
  }
  return data ?? fallback;
};

const findBalance = (items, id, currency) =>
  items.find((item) => item.id === id && (item.currency || currency) === currency)?.balance || 0;

const loadData = async () => {
  setStatus("Veriler güncelleniyor...");
  state.schemaReady = true;
  const db = requireClient();
  const [
    customers, balances, suppliers, supplierBalances, products, invoices,
    invoiceItems, ledger, orders, movements, vat, settings,
  ] = await Promise.all([
    query(db.from("customers").select("*").order("created_at", { ascending: false })),
    query(db.from("customer_balances").select("*")),
    optionalQuery(db.from("suppliers").select("*").order("company")),
    optionalQuery(db.from("supplier_balances").select("*")),
    query(db.from("products").select("*").order("name")),
    query(db.from("invoices").select("*").order("invoice_date", { ascending: false }).limit(500)),
    query(db.from("invoice_items").select("product_id,quantity,line_total,invoice_id,products(name),invoices(invoice_type,currency,exchange_rate)").limit(10000)),
    query(db.from("customer_ledger").select("*").order("transaction_date", { ascending: false }).limit(5000)),
    optionalQuery(db.from("site_orders").select("*").order("created_at", { ascending: false }).limit(500)),
    query(db.from("stock_movements").select("*,products(name,sku)").order("created_at", { ascending: false }).limit(250)),
    optionalQuery(db.from("vat_summary").select("*").order("month", { ascending: false })),
    optionalQuery(db.from("app_settings").select("*").eq("id", "main").maybeSingle(), {}),
  ]);
  Object.assign(state, {
    customers, balances, suppliers, supplierBalances, products, invoices,
    invoiceItems, ledger, orders, movements, vat, settings: settings || {},
  });
  document.querySelector("#schemaWarning").hidden = state.schemaReady;
  renderAll();
  setStatus("");
};

const showApp = (session) => {
  state.session = session;
  document.querySelector("#loginShell").hidden = true;
  document.querySelector("#appShell").hidden = false;
  document.querySelector("#currentUser").textContent = session.user.email || "";
};

const showLogin = () => {
  state.session = null;
  document.querySelector("#loginShell").hidden = false;
  document.querySelector("#appShell").hidden = true;
};

const verifyAdmin = async (session) => {
  if (!session) return false;
  const { data, error } = await client.from("admin_users").select("user_id").eq("user_id", session.user.id).maybeSingle();
  return !error && Boolean(data);
};

const boot = async () => {
  if (!client) {
    document.querySelector("#loginStatus").textContent = "Backend bağlantısı yapılandırılmamış.";
    return;
  }
  const { data } = await client.auth.getSession();
  if (await verifyAdmin(data.session)) {
    showApp(data.session);
    await loadData();
  } else {
    if (data.session) await client.auth.signOut();
    showLogin();
  }
};

const renderCustomers = () => {
  const term = document.querySelector("#customerSearch").value.trim().toLocaleLowerCase("tr");
  const rows = state.customers.filter((item) =>
    [item.code, item.company, item.contact_name, item.email, item.tax_number].some((value) =>
      String(value || "").toLocaleLowerCase("tr").includes(term)));
  document.querySelector("#customerRows").innerHTML = rows.length ? rows.map((item) => `
    <tr><td>${escapeHtml(item.code)}</td><td><strong>${escapeHtml(item.company)}</strong></td>
    <td>${escapeHtml(item.contact_name || "-")}</td><td>${escapeHtml(item.country || "-")}</td>
    <td>${escapeHtml(item.email || "-")}</td><td>${money(findBalance(state.balances, item.id, item.currency), item.currency)}</td>
    <td><div class="row-actions"><button data-customer-payment="${item.id}">Tahsilat</button><button data-customer-edit="${item.id}">Düzenle</button></div></td></tr>
  `).join("") : '<tr><td colspan="7" class="empty">Müşteri kaydı bulunamadı.</td></tr>';
};

const renderSuppliers = () => {
  const term = document.querySelector("#supplierSearch").value.trim().toLocaleLowerCase("tr");
  const rows = state.suppliers.filter((item) =>
    [item.code, item.company, item.contact_name, item.tax_number].some((value) =>
      String(value || "").toLocaleLowerCase("tr").includes(term)));
  document.querySelector("#supplierRows").innerHTML = rows.length ? rows.map((item) => `
    <tr><td>${escapeHtml(item.code)}</td><td><strong>${escapeHtml(item.company)}</strong></td>
    <td>${escapeHtml(item.contact_name || "-")}</td><td>${escapeHtml(item.tax_number || "-")}</td>
    <td>${escapeHtml(item.currency)}</td><td>${money(findBalance(state.supplierBalances, item.id, item.currency), item.currency)}</td>
    <td><button data-supplier-edit="${item.id}">Düzenle</button></td></tr>
  `).join("") : '<tr><td colspan="7" class="empty">Tedarikçi kaydı bulunamadı.</td></tr>';
};

const getSortedProducts = () => {
  const term = document.querySelector("#productSearch").value.trim().toLocaleLowerCase("tr");
  const [field, direction] = state.productSort.split("-");
  const filtered = state.products.filter((item) =>
    [item.sku, item.barcode, item.name, item.brand, item.category].some((value) =>
      String(value || "").toLocaleLowerCase("tr").includes(term)));
  const key = {
    name: (item) => item.name || "",
    sku: (item) => item.sku || item.barcode || "",
    brand: (item) => item.brand || "",
    stock: (item) => Number(item.stock_quantity),
    purchase: (item) => Number(item.purchase_price),
    sale: (item) => Number(item.sale_price),
  }[field] || ((item) => item.name || "");
  return filtered.sort((a, b) => {
    const av = key(a);
    const bv = key(b);
    const result = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv), "tr");
    return direction === "desc" ? -result : result;
  });
};

const renderProducts = () => {
  const rows = getSortedProducts();
  document.querySelector("#productRows").innerHTML = rows.length ? rows.map((item) => {
    const low = Number(item.stock_quantity) <= Number(item.minimum_stock);
    return `<tr class="${state.selectedProducts.has(item.id) ? "selected-row" : ""}">
      <td><input type="checkbox" data-product-select="${item.id}" ${state.selectedProducts.has(item.id) ? "checked" : ""} /></td>
      <td>${escapeHtml(item.sku || item.barcode || "-")}</td><td><strong>${escapeHtml(item.name)}</strong></td>
      <td>${escapeHtml(item.brand || "-")}</td><td class="${low ? "stock-low" : ""}">${number(item.stock_quantity)} ${escapeHtml(item.unit)}</td>
      <td>${number(item.minimum_stock)}</td><td>${money(item.purchase_price, "USD")}</td><td>${money(item.sale_price, "USD")}</td>
      <td>%${number(item.vat_rate)}</td><td><button data-product-edit="${item.id}">Düzenle</button></td></tr>`;
  }).join("") : '<tr><td colspan="10" class="empty">Stok kartı bulunamadı.</td></tr>';
};

const renderOrders = () => {
  const newCount = state.orders.filter((item) => item.status === "new").length;
  document.querySelector("#newOrderCount").textContent = newCount;
  document.querySelector("#metricOrders").textContent = number(newCount);
  document.querySelector("#orderRows").innerHTML = state.orders.length ? state.orders.map((item) => `
    <tr><td><strong>${escapeHtml(item.order_no)}</strong></td><td>${date(item.created_at)}</td>
    <td>${escapeHtml(item.customer_company || item.customer_email || "Misafir siparişi")}</td>
    <td>${Array.isArray(item.items) ? item.items.length : 0}</td><td>${number(item.total_cartons)}</td>
    <td><span class="badge ${item.status}">${({ new: "Yeni", reviewing: "İnceleniyor", converted: "Faturaya dönüştü", cancelled: "İptal" })[item.status] || item.status}</span></td>
    <td><div class="row-actions"><button data-order-detail="${item.id}">Detay</button><button class="primary" data-order-convert="${item.id}" ${item.status === "converted" ? "disabled" : ""}>Faturaya aktar</button></div></td></tr>
  `).join("") : '<tr><td colspan="7" class="empty">Henüz siteden sipariş gelmedi.</td></tr>';
};

const renderInvoices = () => {
  document.querySelector("#invoiceRows").innerHTML = state.invoices.length ? state.invoices.map((item) => {
    const party = item.invoice_type === "purchase"
      ? state.suppliers.find((supplier) => supplier.id === item.supplier_id)?.company
      : state.customers.find((customer) => customer.id === item.customer_id)?.company;
    return `<tr><td><strong>${escapeHtml(item.invoice_no)}</strong></td>
      <td><span class="badge">${item.invoice_type === "purchase" ? "Alış" : "Satış"}</span></td>
      <td>${date(item.invoice_date)}</td><td>${escapeHtml(party || "-")}</td>
      <td>${item.scenario === "export" ? "İhracat %0" : "Türkiye"}</td>
      <td>${money(item.grand_total, item.currency)}</td><td>${money(item.tax_total, item.currency)}</td>
      <td><button data-invoice-print="${item.id}">Taslak / Yazdır</button></td></tr>`;
  }).join("") : '<tr><td colspan="8" class="empty">Henüz fatura bulunmuyor.</td></tr>';
};

const renderMovements = () => {
  document.querySelector("#movementRows").innerHTML = state.movements.length ? state.movements.map((item) => `
    <tr><td>${date(item.created_at)}</td><td>${escapeHtml(item.products?.name || "-")}</td>
    <td>${escapeHtml(item.movement_type)}</td><td class="${Number(item.quantity) < 0 ? "stock-low" : ""}">${number(item.quantity)}</td>
    <td>${escapeHtml(item.reference_type || "-")}</td><td>${escapeHtml(item.note || "-")}</td></tr>
  `).join("") : '<tr><td colspan="6" class="empty">Stok hareketi bulunmuyor.</td></tr>';
};

const renderDashboard = () => {
  const currentMonth = today().slice(0, 7);
  const purchaseValue = state.products.reduce((sum, item) => sum + Number(item.stock_quantity) * Number(item.purchase_price), 0);
  const saleValue = state.products.reduce((sum, item) => sum + Number(item.stock_quantity) * Number(item.sale_price), 0);
  const monthlySales = state.invoices.filter((item) => item.invoice_type === "sale" && item.invoice_date?.startsWith(currentMonth))
    .reduce((sum, item) => sum + toUsd(item.grand_total, item.currency, item.exchange_rate), 0);
  const low = state.products.filter((item) => Number(item.stock_quantity) <= Number(item.minimum_stock));
  document.querySelector("#metricPurchaseValue").textContent = money(purchaseValue, "USD");
  document.querySelector("#metricSaleValue").textContent = money(saleValue, "USD");
  document.querySelector("#metricMonthlySales").textContent = money(monthlySales, "USD");
  document.querySelector("#lowStockList").innerHTML = low.length ? low.slice(0, 10).map((item) => `
    <div class="compact-row"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.brand || "")}</small></div><span class="stock-low">${number(item.stock_quantity)} ${escapeHtml(item.unit)}</span></div>
  `).join("") : '<p class="empty">Kritik stok bulunmuyor.</p>';
  document.querySelector("#recentInvoices").innerHTML = state.invoices.length ? state.invoices.slice(0, 10).map((item) => `
    <div class="compact-row"><div><strong>${escapeHtml(item.invoice_no)}</strong><small>${item.invoice_type === "purchase" ? "Alış" : "Satış"} · ${date(item.invoice_date)}</small></div><span>${money(item.grand_total, item.currency)}</span></div>
  `).join("") : '<p class="empty">Henüz fatura bulunmuyor.</p>';
};

const renderVat = () => {
  const totals = state.vat.reduce((sum, item) => ({
    input: sum.input + Number(item.input_vat),
    output: sum.output + Number(item.output_vat),
    exportSales: sum.exportSales + Number(item.export_sales),
  }), { input: 0, output: 0, exportSales: 0 });
  document.querySelector("#vatInput").textContent = money(totals.input, "TRY");
  document.querySelector("#vatOutput").textContent = money(totals.output, "TRY");
  document.querySelector("#vatRefund").textContent = money(Math.max(0, totals.input - totals.output), "TRY");
  document.querySelector("#vatExportSales").textContent = money(totals.exportSales, "USD");
  document.querySelector("#vatExportReference").textContent = money(totals.exportSales * 0.2, "USD");
  document.querySelector("#vatRows").innerHTML = state.vat.length ? state.vat.map((item) => `
    <tr><td>${date(item.month)}</td><td>${money(item.input_vat, "TRY")}</td><td>${money(item.output_vat, "TRY")}</td>
    <td>${money(Number(item.input_vat) - Number(item.output_vat), "TRY")}</td><td>${money(item.export_sales, "USD")}</td></tr>
  `).join("") : '<tr><td colspan="5" class="empty">KDV hareketi bulunmuyor.</td></tr>';
};

const renderReports = () => {
  const sales = state.invoices.filter((item) => item.invoice_type === "sale")
    .reduce((sum, item) => sum + toUsd(item.grand_total, item.currency, item.exchange_rate), 0);
  const purchasesTry = state.invoices.filter((item) => item.invoice_type === "purchase" && item.currency === "TRY")
    .reduce((sum, item) => sum + Number(item.grand_total), 0);
  const stockQty = state.products.reduce((sum, item) => sum + Number(item.stock_quantity), 0);
  const lowCount = state.products.filter((item) => Number(item.stock_quantity) <= Number(item.minimum_stock)).length;
  document.querySelector("#reportSales").textContent = money(sales, "USD");
  document.querySelector("#reportPurchases").textContent = money(purchasesTry, "TRY");
  document.querySelector("#reportStockQty").textContent = number(stockQty);
  document.querySelector("#reportLowStock").textContent = number(lowCount);
  const balances = state.balances.filter((item) => Number(item.balance) !== 0).sort((a, b) => Number(b.balance) - Number(a.balance));
  document.querySelector("#balanceReport").innerHTML = balances.length ? balances.slice(0, 12).map((item) => `
    <div class="compact-row"><div><strong>${escapeHtml(item.company)}</strong><small>${escapeHtml(item.code)}</small></div><span>${money(item.balance, item.currency || "USD")}</span></div>
  `).join("") : '<p class="empty">Açık bakiye bulunmuyor.</p>';
  const productSales = new Map();
  state.invoiceItems.filter((item) => item.invoices?.invoice_type === "sale").forEach((item) => {
    const current = productSales.get(item.product_id) || { name: item.products?.name || "-", quantity: 0, total: 0 };
    current.quantity += Number(item.quantity);
    current.total += toUsd(item.line_total, item.invoices?.currency, item.invoices?.exchange_rate);
    productSales.set(item.product_id, current);
  });
  const sorted = [...productSales.values()].sort((a, b) => b.quantity - a.quantity);
  document.querySelector("#salesProductReport").innerHTML = sorted.length ? sorted.slice(0, 12).map((item) => `
    <div class="compact-row"><div><strong>${escapeHtml(item.name)}</strong><small>${number(item.quantity)} birim/koli</small></div><span>${money(item.total, "USD")}</span></div>
  `).join("") : '<p class="empty">Satış verisi bulunmuyor.</p>';
};

const renderTemplate = () => {
  const form = document.querySelector("#templateForm");
  const template = state.settings.invoice_template || {};
  ["company_name", "company_tax_number", "company_tax_office", "company_address"].forEach((key) => {
    if (form.elements[key]) form.elements[key].value = state.settings[key] || "";
  });
  form.elements.incoterm.value = template.incoterm || "";
  form.elements.payment_note.value = template.payment_note || "";
  document.querySelector("#gibProvider").value = state.settings.gib_provider || "";
};

const renderInvoiceOptions = () => {
  document.querySelector("#invoiceCustomer").innerHTML = '<option value="">Müşteri seçin</option>' + state.customers.map((item) =>
    `<option value="${item.id}">${escapeHtml(item.code)} · ${escapeHtml(item.company)}</option>`).join("");
  document.querySelector("#invoiceSupplier").innerHTML = '<option value="">Tedarikçi seçin</option>' + state.suppliers.map((item) =>
    `<option value="${item.id}">${escapeHtml(item.code)} · ${escapeHtml(item.company)}</option>`).join("");
  const productOptions = '<option value="">Ürün seçin</option>' + state.products.filter((item) => item.active).map((item) =>
    `<option value="${item.id}">${escapeHtml(item.name)} · stok ${number(item.stock_quantity)}</option>`).join("");
  document.querySelector("#invoiceProduct").innerHTML = productOptions;
  document.querySelector("#stockProduct").innerHTML = productOptions;
};

const calculateLine = (line, scenario) => {
  const gross = line.quantity * line.unit_price;
  const net = gross * (1 - line.discount_1 / 100) * (1 - line.discount_2 / 100) * (1 - line.discount_3 / 100);
  const taxRate = scenario === "export" ? 0 : line.tax_rate;
  const tax = net * taxRate / 100;
  return { gross, net, discount: gross - net, tax, total: net + tax, taxRate };
};

const renderInvoiceLines = () => {
  const form = document.querySelector("#invoiceForm");
  const currency = form.elements.currency.value || "USD";
  const scenario = form.elements.scenario.value;
  const bottomRate = Number(form.elements.invoice_discount_rate.value || 0);
  let subtotal = 0;
  let lineDiscount = 0;
  let tax = 0;
  document.querySelector("#invoiceLineRows").innerHTML = state.invoiceLines.length ? state.invoiceLines.map((line, index) => {
    const calc = calculateLine(line, scenario);
    subtotal += calc.net;
    lineDiscount += calc.discount;
    tax += calc.tax;
    return `<tr><td><strong>${escapeHtml(line.name)}</strong></td><td>${number(line.stock)}</td><td>${number(line.quantity)}</td>
      <td>${money(line.unit_price, currency)}</td><td>%${number(line.discount_1)} / %${number(line.discount_2)} / %${number(line.discount_3)}</td>
      <td>%${number(calc.taxRate)}</td><td>${money(calc.total, currency)}</td><td><button type="button" data-remove-line="${index}">Sil</button></td></tr>`;
  }).join("") : '<tr><td colspan="8" class="empty">Fatura satırı ekleyin.</td></tr>';
  const bottomDiscount = subtotal * Math.min(Math.max(bottomRate, 0), 100) / 100;
  const adjustedTax = subtotal > 0 ? tax * ((subtotal - bottomDiscount) / subtotal) : 0;
  document.querySelector("#invoiceSubtotal").textContent = money(subtotal, currency);
  document.querySelector("#invoiceDiscountTotal").textContent = money(lineDiscount + bottomDiscount, currency);
  document.querySelector("#invoiceTaxTotal").textContent = money(adjustedTax, currency);
  document.querySelector("#invoiceGrandTotal").textContent = money(subtotal - bottomDiscount + adjustedTax, currency);
};

const renderAll = () => {
  renderCustomers();
  renderSuppliers();
  renderProducts();
  renderOrders();
  renderInvoices();
  renderMovements();
  renderDashboard();
  renderVat();
  renderReports();
  renderTemplate();
  renderInvoiceOptions();
  renderInvoiceLines();
};

const openEditForm = (dialogId, formId, data = {}) => {
  const form = document.querySelector(`#${formId}`);
  form.reset();
  Object.entries(data).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (field) field.value = value ?? "";
  });
  document.querySelector(`#${dialogId}`).showModal();
};

const saveEntity = async (event, table, dialogId, numericFields = []) => {
  event.preventDefault();
  const values = formObject(event.currentTarget);
  const id = values.id;
  delete values.id;
  numericFields.forEach((key) => { values[key] = Number(values[key] || 0); });
  const request = id ? client.from(table).update(values).eq("id", id) : client.from(table).insert(values);
  await query(request);
  document.querySelector(`#${dialogId}`).close();
  await loadData();
};

const adjustStock = async (event) => {
  event.preventDefault();
  const values = formObject(event.currentTarget);
  await query(client.rpc("adjust_stock", {
    p_product_id: values.product_id,
    p_quantity: Number(values.quantity),
    p_note: `DENETİM DÜZELTMESİ: ${values.note}`,
  }));
  document.querySelector("#stockDialog").close();
  await loadData();
};

const recordPayment = async (event) => {
  event.preventDefault();
  const values = formObject(event.currentTarget);
  await query(client.rpc("record_customer_payment", {
    p_customer_id: values.customer_id,
    p_amount: Number(values.amount),
    p_currency: values.currency,
    p_payment_date: values.payment_date,
    p_description: values.description,
  }));
  document.querySelector("#paymentDialog").close();
  await loadData();
};

const loadFreshCatalog = async () => {
  const response = await fetch(`/catalog-products.generated.js?fresh=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Güncel katalog dosyası alınamadı.");
  const source = await response.text();
  const sandbox = {};
  Function("window", source)(sandbox);
  return Array.isArray(sandbox.SIDYA_CATALOG_PRODUCTS) ? sandbox.SIDYA_CATALOG_PRODUCTS : [];
};

const inferVatRate = (item) => {
  const text = `${item.sourceCategory || ""} ${item.category || ""} ${item.names?.tr || ""}`.toLocaleLowerCase("tr");
  if (/hasta bezi|yetişkin bezi|adult diaper/.test(text)) return 10;
  if (/gıda|food|çikolata|salça|yağ|içecek|kahve|şeker/.test(text)) return 1;
  return 20;
};

const importCatalog = async () => {
  if (!state.schemaReady) throw new Error("SCHEMA_UPDATE_REQUIRED");
  const catalog = await loadFreshCatalog();
  if (!catalog.length) throw new Error("Site kataloğu bulunamadı.");
  const rows = catalog.map((item) => ({
    catalog_id: item.id,
    sku: item.barcode || item.id,
    barcode: item.barcode || null,
    name: item.names?.tr || item.names?.en || item.name || item.id,
    brand: item.brand || null,
    category: item.sourceCategory || item.category || null,
    units_per_carton: Number(item.unitsPerCarton || 1),
    kg_per_carton: Number(item.kgPerCarton || 0),
    currency: "USD",
    vat_rate: inferVatRate(item),
  }));
  setStatus(`${rows.length} katalog ürünü aktarılıyor...`);
  for (let index = 0; index < rows.length; index += 250) {
    await query(client.from("products").upsert(rows.slice(index, index + 250), { onConflict: "catalog_id" }));
  }
  await loadData();
  setStatus(`${rows.length} ürün güncel katalogdan aktarıldı.`);
};

const setInvoiceMode = (type, order = null) => {
  const form = document.querySelector("#invoiceForm");
  form.reset();
  state.invoiceLines = [];
  form.elements.invoice_type.value = type;
  form.elements.invoice_date.value = today();
  form.elements.exchange_rate.value = "1";
  form.elements.invoice_discount_rate.value = "0";
  form.elements.source_order_id.value = order?.id || "";
  const purchase = type === "purchase";
  document.querySelector("#invoiceKicker").textContent = purchase ? "ALIŞ FATURASI" : "SATIŞ FATURASI";
  document.querySelector("#invoiceDialogTitle").textContent = purchase ? "Tedarikçi faturası ve stok girişi" : "Satış / ihracat faturası";
  document.querySelector("#customerField").hidden = purchase;
  document.querySelector("#supplierField").hidden = !purchase;
  form.elements.customer_id.required = !purchase;
  form.elements.supplier_id.required = purchase;
  form.elements.scenario.value = purchase ? "domestic" : "export";
  form.elements.currency.value = purchase ? "TRY" : "USD";
  document.querySelector("#saveInvoiceButton").textContent = purchase ? "Alış faturasını işle ve stoğa ekle" : "Satış faturasını kes ve stoktan düş";
  const template = state.settings.invoice_template || {};
  form.elements.incoterm.value = template.incoterm || "";
  if (order) {
    const matchedCustomer = state.customers.find((item) =>
      (order.customer_id && item.id === order.customer_id) ||
      (order.customer_email && item.email?.toLowerCase() === order.customer_email.toLowerCase()));
    if (matchedCustomer) form.elements.customer_id.value = matchedCustomer.id;
    const items = Array.isArray(order.items) ? order.items : [];
    state.invoiceLines = items.map((item) => {
      const product = state.products.find((entry) =>
        entry.catalog_id === item.productId || (item.barcode && entry.barcode === item.barcode));
      return product ? {
        product_id: product.id, name: product.name, stock: Number(product.stock_quantity),
        quantity: Number(item.cartons || 1), unit_price: Number(product.sale_price || 0),
        tax_rate: Number(product.vat_rate || 20), discount_1: 0, discount_2: 0, discount_3: 0,
      } : null;
    }).filter(Boolean);
    form.elements.notes.value = `Web siparişi: ${order.order_no}`;
  }
  renderInvoiceOptions();
  if (order) {
    const matchedCustomer = state.customers.find((item) =>
      (order.customer_id && item.id === order.customer_id) ||
      (order.customer_email && item.email?.toLowerCase() === order.customer_email.toLowerCase()));
    if (matchedCustomer) form.elements.customer_id.value = matchedCustomer.id;
  }
  renderInvoiceLines();
  document.querySelector("#invoiceDialog").showModal();
};

const addInvoiceLine = () => {
  const product = state.products.find((item) => item.id === document.querySelector("#invoiceProduct").value);
  if (!product) throw new Error("Ürün seçin.");
  const form = document.querySelector("#invoiceForm");
  const purchase = form.elements.invoice_type.value === "purchase";
  const quantity = Number(document.querySelector("#invoiceQuantity").value);
  const unitPrice = Number(document.querySelector("#invoicePrice").value || (purchase ? product.purchase_price : product.sale_price));
  if (!(quantity > 0)) throw new Error("Miktar sıfırdan büyük olmalı.");
  const line = {
    product_id: product.id,
    name: product.name,
    stock: Number(product.stock_quantity),
    quantity,
    unit_price: unitPrice,
    tax_rate: Number(document.querySelector("#invoiceTax").value || product.vat_rate || 20),
    discount_1: Number(document.querySelector("#invoiceDiscount1").value || 0),
    discount_2: Number(document.querySelector("#invoiceDiscount2").value || 0),
    discount_3: Number(document.querySelector("#invoiceDiscount3").value || 0),
  };
  state.invoiceLines.push(line);
  renderInvoiceLines();
};

const saveInvoice = async (event) => {
  event.preventDefault();
  if (!state.invoiceLines.length) throw new Error("Faturaya en az bir ürün ekleyin.");
  const values = formObject(event.currentTarget);
  const result = await query(client.rpc("create_invoice_v2", {
    p_invoice_type: values.invoice_type,
    p_customer_id: values.invoice_type === "sale" ? values.customer_id : null,
    p_supplier_id: values.invoice_type === "purchase" ? values.supplier_id : null,
    p_source_order_id: values.source_order_id || null,
    p_invoice_date: values.invoice_date,
    p_due_date: values.due_date || null,
    p_currency: values.currency,
    p_exchange_rate: Number(values.exchange_rate),
    p_scenario: values.scenario,
    p_invoice_discount_rate: Number(values.invoice_discount_rate || 0),
    p_notes: values.notes,
    p_draft_data: {
      incoterm: values.incoterm,
      payment_note: state.settings.invoice_template?.payment_note || "",
    },
    p_items: state.invoiceLines.map((item) => ({
      product_id: item.product_id, description: item.name, quantity: item.quantity,
      unit_price: item.unit_price, tax_rate: item.tax_rate,
      discount_1: item.discount_1, discount_2: item.discount_2, discount_3: item.discount_3,
    })),
  }));
  state.invoiceLines = [];
  document.querySelector("#invoiceDialog").close();
  await loadData();
  setStatus(`${values.invoice_type === "purchase" ? "Alış" : "Satış"} faturası kaydedildi; stok otomatik güncellendi.`);
  return result;
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
  const items = await query(client.from("invoice_items").select("*").eq("invoice_id", invoiceId));
  const party = invoice.invoice_type === "purchase"
    ? state.suppliers.find((item) => item.id === invoice.supplier_id)
    : state.customers.find((item) => item.id === invoice.customer_id);
  const settings = state.settings || {};
  const popup = window.open("", "_blank", "width=1000,height=800");
  const partyTitle = invoice.invoice_type === "purchase" ? "TEDARİKÇİ" : "ALICI / BUYER";
  popup.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(invoice.invoice_no)}</title>
    <style>body{font-family:Arial,sans-serif;color:#18212b;padding:38px}header{display:flex;justify-content:space-between;border-bottom:3px solid #176b87;padding-bottom:18px}h1{margin:0;color:#0d1b2a}.meta{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin:25px 0}table{width:100%;border-collapse:collapse}th,td{padding:9px;border-bottom:1px solid #ddd;text-align:left;font-size:12px}.right{text-align:right}.total{margin:22px 0 0 auto;width:360px}.total p{display:flex;justify-content:space-between}.note{margin-top:30px;color:#667085}.warning{padding:10px;background:#fff4e5;color:#8a4b08}@media print{button,.warning{display:none}}</style></head><body>
    <p class="warning">Düzenlenebilir taslak belgedir. GİB'e gönderilmemiştir.</p>
    <header><div><h1>${escapeHtml(settings.company_name || "İHRACAT YÖNETİMİ")}</h1><p>${invoice.invoice_type === "purchase" ? "Alış Faturası" : "Commercial Export Invoice"}</p></div><div><strong>${escapeHtml(invoice.invoice_no)}</strong><p>${date(invoice.invoice_date)}</p></div></header>
    <section class="meta"><div><strong>${partyTitle}</strong><h2>${escapeHtml(party?.company || "")}</h2><p>${escapeHtml(party?.address || "")}<br>${escapeHtml(party?.country || "")}<br>Vergi No: ${escapeHtml(party?.tax_number || "-")}</p></div>
    <div><strong>FATURA BİLGİLERİ</strong><p>Senaryo: ${invoice.scenario === "export" ? "İhracat / KDV %0" : "Türkiye"}<br>Para birimi: ${escapeHtml(invoice.currency)}<br>Kur: ${number(invoice.exchange_rate)}<br>Incoterm: ${escapeHtml(invoice.draft_data?.incoterm || "-")}</p></div></section>
    <table><thead><tr><th>Ürün</th><th class="right">Miktar</th><th class="right">Birim fiyat</th><th class="right">İsk. 1/2/3</th><th class="right">KDV</th><th class="right">Toplam</th></tr></thead>
    <tbody>${items.map((item) => `<tr><td>${escapeHtml(item.description)}</td><td class="right">${number(item.quantity)}</td><td class="right">${money(item.unit_price, invoice.currency)}</td><td class="right">%${number(item.discount_1)} / %${number(item.discount_2)} / %${number(item.discount_3)}</td><td class="right">%${number(item.tax_rate)}</td><td class="right">${money(item.line_total, invoice.currency)}</td></tr>`).join("")}</tbody></table>
    <div class="total"><p><span>Ara toplam</span><strong>${money(invoice.subtotal, invoice.currency)}</strong></p><p><span>Toplam iskonto</span><strong>${money(invoice.total_discount, invoice.currency)}</strong></p><p><span>KDV</span><strong>${money(invoice.tax_total, invoice.currency)}</strong></p><p><span>Genel toplam</span><strong>${money(invoice.grand_total, invoice.currency)}</strong></p></div>
    <p class="note">${escapeHtml(invoice.notes || "")}<br>${escapeHtml(invoice.draft_data?.payment_note || "")}</p><button onclick="window.print()">Yazdır / PDF kaydet</button></body></html>`);
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
}));

document.querySelector("#signOutButton").addEventListener("click", safely(async () => { await client.auth.signOut(); showLogin(); }));
document.querySelector("#refreshButton").addEventListener("click", safely(loadData));
document.querySelector("#customerSearch").addEventListener("input", renderCustomers);
document.querySelector("#supplierSearch").addEventListener("input", renderSuppliers);
document.querySelector("#productSearch").addEventListener("input", renderProducts);
document.querySelector("#productSort").addEventListener("change", (event) => { state.productSort = event.target.value; renderProducts(); });
document.querySelector("#customerForm").addEventListener("submit", safely((event) => saveEntity(event, "customers", "customerDialog")));
document.querySelector("#supplierForm").addEventListener("submit", safely((event) => saveEntity(event, "suppliers", "supplierDialog")));
document.querySelector("#productForm").addEventListener("submit", safely((event) => saveEntity(event, "products", "productDialog", ["purchase_price", "sale_price", "minimum_stock", "units_per_carton", "kg_per_carton", "vat_rate"])));
document.querySelector("#stockForm").addEventListener("submit", safely(adjustStock));
document.querySelector("#paymentForm").addEventListener("submit", safely(recordPayment));
document.querySelector("#invoiceForm").addEventListener("submit", safely(saveInvoice));
document.querySelector("#templateForm").addEventListener("submit", safely(saveTemplate));
document.querySelector("#importCatalogButton").addEventListener("click", safely(importCatalog));
document.querySelector("#openStockCorrection").addEventListener("click", () => { renderInvoiceOptions(); document.querySelector("#stockDialog").showModal(); });
document.querySelector("#addInvoiceLine").addEventListener("click", safely(addInvoiceLine));
document.querySelector("#newSaleInvoiceButton").addEventListener("click", () => setInvoiceMode("sale"));
document.querySelector("#newPurchaseInvoiceButton").addEventListener("click", () => setInvoiceMode("purchase"));
document.querySelector("#invoiceForm [name='currency']").addEventListener("change", renderInvoiceLines);
document.querySelector("#invoiceForm [name='scenario']").addEventListener("change", renderInvoiceLines);
document.querySelector("#invoiceForm [name='invoice_discount_rate']").addEventListener("input", renderInvoiceLines);
document.querySelector("#invoiceProduct").addEventListener("change", () => {
  const product = state.products.find((item) => item.id === document.querySelector("#invoiceProduct").value);
  if (!product) return;
  const purchase = document.querySelector("#invoiceForm [name='invoice_type']").value === "purchase";
  document.querySelector("#invoicePrice").value = purchase ? product.purchase_price : product.sale_price;
  document.querySelector("#invoiceTax").value = product.vat_rate ?? 20;
});
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

document.addEventListener("click", safely(async (event) => {
  const opener = event.target.closest("[data-open-dialog]");
  if (opener) openEditForm(opener.dataset.openDialog, opener.dataset.openDialog.replace("Dialog", "Form"));
  const customerEdit = event.target.closest("[data-customer-edit]");
  if (customerEdit) openEditForm("customerDialog", "customerForm", state.customers.find((item) => item.id === customerEdit.dataset.customerEdit));
  const supplierEdit = event.target.closest("[data-supplier-edit]");
  if (supplierEdit) openEditForm("supplierDialog", "supplierForm", state.suppliers.find((item) => item.id === supplierEdit.dataset.supplierEdit));
  const productEdit = event.target.closest("[data-product-edit]");
  if (productEdit) openEditForm("productDialog", "productForm", state.products.find((item) => item.id === productEdit.dataset.productEdit));
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
  const sortHeader = event.target.closest("[data-product-sort]");
  if (sortHeader) {
    const field = sortHeader.dataset.productSort;
    state.productSort = state.productSort === `${field}-asc` ? `${field}-desc` : `${field}-asc`;
    document.querySelector("#productSort").value = state.productSort;
    renderProducts();
  }
  const removeLine = event.target.closest("[data-remove-line]");
  if (removeLine) { state.invoiceLines.splice(Number(removeLine.dataset.removeLine), 1); renderInvoiceLines(); }
  const print = event.target.closest("[data-invoice-print]");
  if (print) await printInvoice(print.dataset.invoicePrint);
  const convert = event.target.closest("[data-order-convert]");
  if (convert) setInvoiceMode("sale", state.orders.find((item) => item.id === convert.dataset.orderConvert));
  const detail = event.target.closest("[data-order-detail]");
  if (detail) {
    const order = state.orders.find((item) => item.id === detail.dataset.orderDetail);
    alert((order.items || []).map((item, index) => `${index + 1}. ${item.brand || ""} ${item.product}: ${item.cartons} koli`).join("\n"));
  }
}));

document.querySelector("#exportCustomersButton").addEventListener("click", () => csvDownload("cari-bakiyeler.csv", [
  ["Cari kod", "Firma", "Para birimi", "Bakiye"],
  ...state.balances.map((item) => [item.code, item.company, item.currency || "USD", item.balance]),
]));
document.querySelector("#exportStockButton").addEventListener("click", () => csvDownload("stok-listesi.csv", [
  ["SKU", "Barkod", "Ürün", "Marka", "Stok", "Birim", "Minimum stok", "Alış USD", "Satış USD", "KDV"],
  ...state.products.map((item) => [item.sku, item.barcode, item.name, item.brand, item.stock_quantity, item.unit, item.minimum_stock, item.purchase_price, item.sale_price, item.vat_rate]),
]));

boot().catch((error) => {
  document.querySelector("#loginStatus").textContent = error.message || "Panel başlatılamadı.";
});
