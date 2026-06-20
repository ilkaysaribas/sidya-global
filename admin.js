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
  vat: [],
  settings: {},
  invoiceLines: [],
  selectedProducts: new Set(),
  selectedCustomers: new Set(),
  productSort: "name-asc", productPage: 1, productPageSize: 100,
  invoiceProductSort: { field: "name", direction: "asc" },
  editingInvoiceId: null,
  schemaReady: true,
  session: null,
  activeInvoiceId: null,
};

const currencySymbols = { USD: "$", EUR: "€", RUB: "₽", TRY: "₺", GBP: "£" };
const invoiceCurrencies = ["USD", "EUR", "RUB", "TRY", "GBP"];
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
    error?.code === "PGRST202" ||
    /schema cache|could not find the table|could not find the .* column|could not find the function/i.test(message);
};

const friendlyError = (error) => {
  if (isSchemaError(error)) {
    state.schemaReady = false;
    document.querySelector("#schemaWarning").hidden = false;
    const functionMissing = error?.code === "PGRST202" || /could not find the function/i.test(String(error?.message || ""));
    document.querySelector("#schemaWarningText").innerHTML = functionMissing
      ? "Fatura düzenleme ve silmeyi etkinleştirmek için Supabase SQL Editor'da <code>supabase/fatura-duzenle-sil.sql</code> dosyasını bir kez çalıştırın. Ardından Yenile'ye basın."
      : "Supabase SQL Editor'da güncel <code>supabase/schema.sql</code> dosyasını çalıştırın. Ardından bu sayfada Yenile'ye basın.";
    if (functionMissing) return "Fatura düzenleme/silme veritabanı güncellemesi eksik. fatura-duzenle-sil.sql dosyasını SQL Editor'da çalıştırın.";
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

const loadAllProducts = async (db) => {
 const pageSize = 1000;
 const allProducts = [];
 for (let from = 0; ; from += pageSize) {
  const { data, error } = await db
   .from("products")
   .select("*")
   .order("name", { ascending: true })
   .range(from, from + pageSize - 1);
  if (error) throw error;
  const page = data || [];
  allProducts.push(...page);
  if (page.length < pageSize) break;
 }
 return allProducts;
};

const loadAllInvoices = async (db) => {
 const pageSize = 1000;
 const rows = [];
 for (let from = 0; ; from += pageSize) {
  const { data, error } = await db.from("invoices").select("*").order("invoice_date", { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw error;
  const page = data || [];
  rows.push(...page);
  if (page.length < pageSize) break;
 }
 return rows;
};

const loadAllInvoiceItems = async (db) => {
 const pageSize = 1000;
 const rows = [];
 for (let from = 0; ; from += pageSize) {
  const { data, error } = await db.from("invoice_items")
   .select("product_id,quantity,stock_quantity,unit,units_per_carton,unit_price,line_subtotal,line_total,invoice_id,products(name),invoices(invoice_type,currency,exchange_rate)")
   .range(from, from + pageSize - 1);
  if (error) {
   if (isSchemaError(error)) state.schemaReady = false;
   console.warn(error.message || "Fatura satırları okunamadı.");
   return rows;
  }
  const page = data || [];
  rows.push(...page);
  if (page.length < pageSize) break;
 }
 return rows;
};

const findBalance = (items, id, currency) =>
  items.find((item) => item.id === id && (item.currency || currency) === currency)?.balance || 0;

const loadData = async () => {
  setStatus("Veriler güncelleniyor...");
  state.schemaReady = true;
  const db = requireClient();
  const [
    customers, balances, products, invoices,
    invoiceItems, ledger, orders, movements, vat, settings,
  ] = await Promise.all([
    query(db.from("customers").select("*").order("created_at", { ascending: false })),
    query(db.from("customer_balances").select("*")),
    loadAllProducts(db),
    loadAllInvoices(db),
    loadAllInvoiceItems(db),
    query(db.from("customer_ledger").select("*").order("transaction_date", { ascending: false }).limit(5000)),
    optionalQuery(db.from("site_orders").select("*").order("created_at", { ascending: false }).limit(500)),
    query(db.from("stock_movements").select("*,products(name,sku)").order("created_at", { ascending: false }).limit(250)),
    optionalQuery(db.from("vat_summary").select("*").order("month", { ascending: false })),
    optionalQuery(db.from("app_settings").select("*").eq("id", "main").maybeSingle(), {}),
  ]);
  Object.assign(state, {
    customers, balances, products, invoices,
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
    <tr class="${state.selectedCustomers.has(item.id) ? "selected-row" : ""}"><td><input type="checkbox" data-customer-select="${item.id}" ${state.selectedCustomers.has(item.id) ? "checked" : ""} /></td><td>${escapeHtml(item.code)}</td><td><strong>${escapeHtml(item.company)}</strong>${item.status === "passive" ? '<small class="passive-label">Pasif</small>' : ""}</td>
    <td>${item.is_buyer && item.is_seller ? "Alıcı + Satıcı" : item.is_seller ? "Satıcı" : "Alıcı"}</td>
    <td>${escapeHtml(item.contact_name || "-")}</td><td>${escapeHtml(item.country || "-")}</td>
    <td>${escapeHtml(item.email || "-")}</td><td>${money(findBalance(state.balances, item.id, item.currency), item.currency)}</td>
    <td><div class="row-actions"><button data-customer-payment="${item.id}">Tahsilat</button><button data-customer-edit="${item.id}">Düzenle</button></div></td></tr>
  `).join("") : '<tr><td colspan="9" class="empty">Cari kaydı bulunamadı.</td></tr>';
  const selectedCount = rows.filter((item) => state.selectedCustomers.has(item.id)).length;
  const selectAll = document.querySelector("#selectAllCustomers");
  selectAll.checked = rows.length > 0 && selectedCount === rows.length;
  selectAll.indeterminate = selectedCount > 0 && selectedCount < rows.length;
  document.querySelector("#selectedCustomerCount").textContent = `${state.selectedCustomers.size} cari seçildi`;
};

const getSortedProducts = () => {
  const term = document.querySelector("#productSearch").value.trim().toLocaleLowerCase("tr");
  const [field, direction] = state.productSort.split("-");
  const filtered = state.products.filter((item) =>
    [item.sku, item.barcode, item.name, item.brand, item.grammage, item.category].some((value) =>
      String(value || "").toLocaleLowerCase("tr").includes(term)));
  const key = {
    name: (item) => item.name || "",
    sku: (item) => item.sku || item.barcode || "",
    brand: (item) => item.brand || "",

 grammage: (item) => item.grammage || "",
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

const formatStockCartons = (stockQuantity, unitsPerCarton) => {
 const stock = Number(stockQuantity || 0);
 const units = Number(unitsPerCarton || 0);
 if (!(units > 0)) return "Koli bilgisi yok";
 const fullCartons = Math.floor(stock / units);
 const remainder = Math.round((stock - (fullCartons * units)) * 1000) / 1000;
 return remainder > 0
  ? `${number(fullCartons)} Koli + ${number(remainder)} Adet`
  : `${number(fullCartons)} Koli`;
};

const productAveragePrices = (productId) => {
 const totals = { purchaseValue: 0, purchaseQuantity: 0, saleValue: 0, saleQuantity: 0 };
 state.invoiceItems.filter((item) => item.product_id === productId).forEach((item) => {
  const type = item.invoices?.invoice_type;
  if (type !== "purchase" && type !== "sale") return;
  const quantity = Math.abs(Number(item.stock_quantity || item.quantity || 0));
  const unitPrice = Number(item.stock_quantity || 0) > 0
    ? Number(item.line_subtotal || 0) / Number(item.stock_quantity)
    : Number(item.unit_price || 0) / (item.unit === "koli" ? Math.max(Number(item.units_per_carton || 1), 1) : 1);
  const usdPrice = toUsd(unitPrice, item.invoices?.currency, item.invoices?.exchange_rate);
  totals[`${type}Value`] += usdPrice * quantity;
  totals[`${type}Quantity`] += quantity;
 });
 return {
  purchase: totals.purchaseQuantity ? totals.purchaseValue / totals.purchaseQuantity : 0,
  sale: totals.saleQuantity ? totals.saleValue / totals.saleQuantity : 0,
 };
};

const renderProductPagination = (totalRows, totalPages) => {
 const target = document.querySelector("#productPagination");
 if (!target) return;
 if (!totalRows) {
  target.innerHTML = "";
  return;
 }
 const currentPage = state.productPage;
 const pageButtons = Array.from({ length: totalPages }, (_, index) => {
  const page = index + 1;
  return `<button type="button" class="pagination-page${page === currentPage ? " active" : ""}" data-product-page="${page}" ${page === currentPage ? 'aria-current="page"' : ""}>${page}</button>`;
 }).join("");
 target.innerHTML = `
  <div class="pagination-summary">Toplam ${number(totalRows)} ürün · Sayfa ${number(currentPage)} / ${number(totalPages)} · Sayfa başına 100 satır</div>
  <div class="pagination-buttons">
   <button type="button" data-product-page="${currentPage - 1}" ${currentPage <= 1 ? "disabled" : ""}>‹ Önceki</button>
   ${pageButtons}
   <button type="button" data-product-page="${currentPage + 1}" ${currentPage >= totalPages ? "disabled" : ""}>Sonraki ›</button>
  </div>`;
};

const renderProducts = () => {
 const filteredRows = getSortedProducts();
 const pageSize = Number(state.productPageSize || 100);
 const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
 state.productPage = Math.min(Math.max(Number(state.productPage || 1), 1), totalPages);
 const startIndex = (state.productPage - 1) * pageSize;
 const rows = filteredRows.slice(startIndex, startIndex + pageSize);
 document.querySelector("#productRows").innerHTML = rows.length ? rows.map((item, index) => {
  const low = Number(item.stock_quantity) <= Number(item.minimum_stock);
  const units = Number(item.units_per_carton || 0);
  const averages = productAveragePrices(item.id);
  const averagePurchase = averages.purchase || Number(item.purchase_price || 0);
  const averageSale = averages.sale || Number(item.sale_price || 0);
  const profitIndex = averagePurchase > 0 ? ((averageSale - averagePurchase) / averagePurchase) * 100 : 0;
  const profitClass = profitIndex > 0 ? "profit-positive" : profitIndex < 0 ? "profit-negative" : "profit-neutral";
  return `<tr class="${state.selectedProducts.has(item.id) ? "selected-row" : ""}" data-product-row="${item.id}" title="Hareketleri görmek için sağ tıklayın">
  <td>${startIndex + index + 1}</td>
  <td><input type="checkbox" data-product-select="${item.id}" ${state.selectedProducts.has(item.id) ? "checked" : ""} /></td>
  <td><strong>${escapeHtml(item.brand || "-")}</strong></td>
  <td>${escapeHtml(item.barcode || item.sku || "-")}</td>
  <td><strong>${escapeHtml(item.name)}</strong></td>
  <td>${escapeHtml(item.grammage || "-")}</td>
  <td>${units > 0 ? number(units) : "-"}</td>
  <td class="${low ? "stock-low" : ""}">${number(item.stock_quantity)} Adet</td>
  <td>${formatStockCartons(item.stock_quantity, units)}</td>
  <td>${number(item.minimum_stock)}</td>
  <td>${money(item.purchase_price, "USD")}</td>
  <td>${money(averagePurchase, "USD")}</td>
  <td>${money(item.sale_price, "USD")}</td>
  <td>${money(averageSale, "USD")}</td>
  <td><span class="profit-index ${profitClass}">%${number(profitIndex)}</span></td>
  <td>%${number(item.vat_rate)}</td>
  <td><div class="row-actions"><button data-product-history="${item.id}">Hareketler</button><button data-product-edit="${item.id}">Düzenle</button><button class="danger" data-product-delete="${item.id}">Sil</button></div></td></tr>`;
 }).join("") : '<tr><td colspan="17" class="empty">Stok kartı bulunamadı.</td></tr>';

 const selectAll = document.querySelector("#selectAllProducts");
 if (selectAll) {
  const selectedCount = rows.filter((item) => state.selectedProducts.has(item.id)).length;
  selectAll.checked = rows.length > 0 && selectedCount === rows.length;
  selectAll.indeterminate = selectedCount > 0 && selectedCount < rows.length;
 }
 renderProductPagination(filteredRows.length, totalPages);
};

const renderOrders = () => {
  const visibleOrders = state.orders.filter((item) => item.status !== "cancelled");
  const newCount = visibleOrders.filter((item) => item.status === "new").length;
  document.querySelector("#newOrderCount").textContent = newCount;
  document.querySelector("#metricOrders").textContent = number(newCount);
  document.querySelector("#orderRows").innerHTML = visibleOrders.length ? visibleOrders.map((item) => `
    <tr><td><strong>${escapeHtml(item.order_no)}</strong></td><td>${date(item.created_at)}</td>
    <td>${escapeHtml(item.customer_company || item.customer_email || "Misafir siparişi")}</td>
    <td>${Array.isArray(item.items) ? item.items.length : 0}</td><td>${number(item.total_cartons)}</td>
    <td><span class="badge ${item.status}">${({ new: "Yeni", reviewing: "İnceleniyor", converted: "Faturaya dönüştü", cancelled: "İptal" })[item.status] || item.status}</span></td>
    <td><div class="row-actions"><button data-order-detail="${item.id}">Detay</button><button class="primary" data-order-convert="${item.id}" ${item.status === "converted" ? "disabled" : ""}>Faturaya aktar</button><button class="danger" data-order-delete="${item.id}">Sil</button></div></td></tr>
  `).join("") : '<tr><td colspan="7" class="empty">Henüz siteden sipariş gelmedi.</td></tr>';
};

const renderInvoices = () => {
  document.querySelector("#invoiceRows").innerHTML = state.invoices.length ? state.invoices.map((item) => {
    const party = state.customers.find((customer) => customer.id === item.customer_id)?.company;
    const typeLabel = ({ purchase: "Alış", sale: "Satış", return: "İade" })[item.invoice_type] || item.invoice_type;
    const documentNumber = item.draft_data?.document_number || item.invoice_no;
    return `<tr class="invoice-list-row" data-invoice-open="${item.id}"><td><strong>${escapeHtml(documentNumber)}</strong>${documentNumber !== item.invoice_no ? `<small>${escapeHtml(item.invoice_no)}</small>` : ""}</td>
      <td><span class="badge">${typeLabel}</span></td>
      <td>${date(item.invoice_date)}</td><td>${escapeHtml(party || "-")}</td>
      <td>${item.scenario === "export" ? "İhracat %0" : "Türkiye"}</td>
      <td>${money(item.grand_total, item.currency)}</td><td>${money(item.tax_total, item.currency)}</td>
      <td><div class="row-actions"><button data-invoice-open="${item.id}">Aç</button><button data-invoice-print="${item.id}">Yazdır</button><button data-invoice-edit="${item.id}">Düzenle</button><button class="danger" data-invoice-delete="${item.id}">Sil</button></div></td></tr>`;
  }).join("") : '<tr><td colspan="8" class="empty">Henüz fatura bulunmuyor.</td></tr>';
};

const openInvoiceDetail = async (invoiceId) => {
  const invoice = state.invoices.find((item) => item.id === invoiceId);
  if (!invoice) throw new Error("Fatura kaydı bulunamadı.");
  const items = await query(client.from("invoice_items").select("*,products(sku,barcode,brand)").eq("invoice_id", invoiceId));
  const customer = state.customers.find((item) => item.id === invoice.customer_id);
  const typeLabel = ({ purchase: "Alış faturası", sale: "Satış faturası", return: "İade faturası" })[invoice.invoice_type] || invoice.invoice_type;
  const documentNumber = invoice.draft_data?.document_number || invoice.invoice_no;
  state.activeInvoiceId = invoiceId;
  document.querySelector("#invoiceDetailHeading").textContent = `${typeLabel} · ${documentNumber}`;
  document.querySelector("#invoiceDetailType").textContent = typeLabel;
  document.querySelector("#invoiceDetailDate").textContent = date(invoice.invoice_date);
  document.querySelector("#invoiceDetailNumber").textContent = documentNumber;
  document.querySelector("#invoiceDetailDueDate").textContent = date(invoice.due_date);
  document.querySelector("#invoiceDetailCustomer").textContent = `${customer?.code || ""} ${customer?.company || "-"}`.trim();
  document.querySelector("#invoiceDetailCurrency").textContent = invoice.currency;
  document.querySelector("#invoiceDetailScenario").textContent = invoice.scenario === "export" ? "İhracat / KDV %0" : "Türkiye / KDV'li";
  document.querySelector("#invoiceDetailStatus").textContent = invoice.status === "posted" ? "Kayıtlı" : invoice.status;
  document.querySelector("#invoiceDetailRows").innerHTML = items.length ? items.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.barcode || item.products?.barcode || item.product_code || item.products?.sku || "-")}</td><td><strong>${escapeHtml(item.description)}</strong><small>${escapeHtml(item.products?.brand || "")}</small></td><td>${item.unit === "koli" ? "Koli" : "Adet"}</td><td>${number(item.quantity)}</td><td>${money(item.unit_price, invoice.currency)}</td><td>${money(item.line_subtotal, invoice.currency)}</td><td>%${number(item.tax_rate)} · ${money(item.line_tax, invoice.currency)}</td><td>%${number(item.discount_1)}</td><td>%${number(item.discount_2)}</td><td>%${number(item.discount_3)}</td><td>${escapeHtml(item.description)}</td></tr>`).join("") : '<tr><td colspan="12" class="empty">Fatura satırı bulunmuyor.</td></tr>';
  document.querySelector("#invoiceDetailNote").textContent = invoice.notes || "-";
  document.querySelector("#invoiceDetailSubtotal").textContent = money(invoice.subtotal, invoice.currency);
  document.querySelector("#invoiceDetailDiscount").textContent = money(invoice.total_discount, invoice.currency);
  document.querySelector("#invoiceDetailTax").textContent = money(invoice.tax_total, invoice.currency);
  document.querySelector("#invoiceDetailGrandTotal").textContent = money(invoice.grand_total, invoice.currency);
  document.querySelector("#invoiceDetailDialog").showModal();
};

const editInvoice = async (invoiceId) => {
  const invoice = state.invoices.find((item) => item.id === invoiceId);
  if (!invoice) throw new Error("Fatura kaydı bulunamadı.");
  const items = await query(client.from("invoice_items").select("*").eq("invoice_id", invoiceId));
  setInvoiceMode(invoice.invoice_type);
  state.editingInvoiceId = invoiceId;
  const form = document.querySelector("#invoiceForm");
  const invoiceCustomer = state.customers.find((item) => item.id === invoice.customer_id);
  if (invoiceCustomer && ![...form.elements.customer_id.options].some((option) => option.value === invoiceCustomer.id)) {
    form.elements.customer_id.insertAdjacentHTML("beforeend", `<option value="${invoiceCustomer.id}">${escapeHtml(invoiceCustomer.code)} · ${escapeHtml(invoiceCustomer.company)}</option>`);
  }
  form.elements.customer_id.value = invoice.customer_id || "";
  form.elements.invoice_date.value = invoice.invoice_date || today();
  form.elements.due_date.value = invoice.due_date || "";
  form.elements.document_number.value = invoice.draft_data?.document_number || "";
  form.elements.scenario.value = invoice.scenario || "domestic";
  form.elements.currency.value = invoice.currency || "USD";
  form.elements.invoice_discount_rate.value = Number(invoice.invoice_discount_rate || 0);
  form.elements.notes.value = invoice.notes || "";
  form.elements.source_order_id.value = invoice.source_order_id || "";
  state.invoiceLines = items.map((item) => {
    const product = state.products.find((entry) => entry.id === item.product_id);
    return {
      product_id: item.product_id,
      name: item.description,
      barcode: item.barcode || product?.barcode,
      sku: item.product_code || product?.sku,
      stock: Number(product?.stock_quantity || 0),
      quantity: Number(item.quantity),
      selected_unit: item.unit === "koli" ? "koli" : "adet",
      units_per_carton: Number(item.units_per_carton || product?.units_per_carton || 1),
      stock_quantity: Number(item.stock_quantity),
      unit_price: Number(item.unit_price),
      tax_rate: Number(item.tax_rate),
      discount_1: Number(item.discount_1 || 0),
      discount_2: Number(item.discount_2 || 0),
      discount_3: Number(item.discount_3 || 0),
    };
  });
  document.querySelector("#invoiceDialogTitle").textContent = `${invoice.draft_data?.document_number || invoice.invoice_no} faturayı düzenle`;
  document.querySelector("#saveInvoiceButton").textContent = "Değişiklikleri kaydet ve stokları güncelle";
  renderInvoiceProductPicker();
  renderInvoiceLines();
  updateInvoiceTermDays();
};

const deleteInvoice = async (invoiceId) => {
  const invoice = state.invoices.find((item) => item.id === invoiceId);
  if (!invoice) throw new Error("Fatura kaydı bulunamadı.");
  const documentNumber = invoice.draft_data?.document_number || invoice.invoice_no;
  if (!confirm(`${documentNumber} faturası silinsin mi? Stok ve cari hareketleri de geri alınacaktır.`)) return;
  await query(client.rpc("delete_invoice_v2", { p_invoice_id: invoiceId }));
  if (state.activeInvoiceId === invoiceId) document.querySelector("#invoiceDetailDialog").close();
  await loadData();
  setStatus(`${documentNumber} faturası ve bağlı stok/cari hareketleri silindi.`);
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
    <div class="compact-row"><div><strong>${escapeHtml(item.draft_data?.document_number || item.invoice_no)}</strong><small>${({ purchase: "Alış", sale: "Satış", return: "İade" })[item.invoice_type] || item.invoice_type} · ${date(item.invoice_date)}</small></div><span>${money(item.grand_total, item.currency)}</span></div>
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
    current.quantity += Number(item.stock_quantity || item.quantity);
    current.total += toUsd(item.line_total, item.invoices?.currency, item.invoices?.exchange_rate);
    productSales.set(item.product_id, current);
  });
  const sorted = [...productSales.values()].sort((a, b) => b.quantity - a.quantity);
  document.querySelector("#salesProductReport").innerHTML = sorted.length ? sorted.slice(0, 12).map((item) => `
    <div class="compact-row"><div><strong>${escapeHtml(item.name)}</strong><small>${number(item.quantity)} adet</small></div><span>${money(item.total, "USD")}</span></div>
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
  const invoiceType = document.querySelector("#invoiceForm").elements.invoice_type.value || "sale";
  const customerSelect = document.querySelector("#invoiceCustomer");
  const selectedCustomer = customerSelect.value;
  const eligibleCustomers = state.customers.filter((item) =>
    item.status !== "passive" && (invoiceType === "purchase" ? item.is_seller !== false : item.is_buyer !== false));
  customerSelect.innerHTML = '<option value="">Cari seçin</option>' + eligibleCustomers.map((item) =>
    `<option value="${item.id}">${escapeHtml(item.code)} · ${escapeHtml(item.company)}</option>`).join("");
  if (eligibleCustomers.some((item) => item.id === selectedCustomer)) customerSelect.value = selectedCustomer;
  const productOptions = '<option value="">Ürün seçin</option>' + state.products.filter((item) => item.active).map((item) =>
    `<option value="${item.id}">${escapeHtml(item.name)} · stok ${number(item.stock_quantity)}</option>`).join("");
  document.querySelector("#stockProduct").innerHTML = productOptions;
  renderInvoiceProductPicker();
};

const refreshInvoiceProducts = async () => {
  const button = document.querySelector("#refreshInvoiceProductsButton");
  button.disabled = true;
  try {
    state.products = await loadAllProducts(client);
    renderProducts();
    renderInvoiceOptions();
    document.querySelector("#invoiceFormStatus").textContent = `${state.products.length} ürün güncellendi.`;
  } finally {
    button.disabled = false;
  }
};

const cartonSize = (product) => Math.max(Number(product?.units_per_carton || 1), 1);
const stockQuantityFor = (quantity, unit, unitsPerCarton) =>
  Number(quantity || 0) * (unit === "koli" ? Math.max(Number(unitsPerCarton || 1), 1) : 1);
const productUnitPrice = (product, invoiceType, unit) => {
  const basePrice = Number(invoiceType === "purchase" ? product.purchase_price : product.sale_price);
  return basePrice * (unit === "koli" ? cartonSize(product) : 1);
};

const renderInvoiceProductPicker = () => {
  const target = document.querySelector("#invoiceProductRows");
  if (!target) return;
  const term = document.querySelector("#invoiceProductSearch")?.value.trim().toLocaleLowerCase("tr") || "";
  const form = document.querySelector("#invoiceForm");
  const invoiceType = form.elements.invoice_type.value || "sale";
  const currency = form.elements.currency.value || "USD";
  const { field, direction } = state.invoiceProductSort;
  const sortValue = {
    barcode: (item) => item.barcode || item.sku || "",
    name: (item) => item.name || "",
    stock: (item) => Number(item.stock_quantity || 0),
    price: (item) => productUnitPrice(item, invoiceType, cartonSize(item) > 1 ? "koli" : "adet"),
  }[field] || ((item) => item.name || "");
  const products = state.products.filter((item) => item.active && [item.barcode, item.sku, item.name, item.brand]
    .some((value) => String(value || "").toLocaleLowerCase("tr").includes(term)))
    .sort((a, b) => {
      const av = sortValue(a); const bv = sortValue(b);
      const result = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv), "tr");
      return direction === "desc" ? -result : result;
    });
  target.innerHTML = products.length ? products.map((product) => {
    const units = cartonSize(product);
    const defaultUnit = units > 1 ? "koli" : "adet";
    const stock = Number(product.stock_quantity || 0);
    return `<tr data-picker-row="${product.id}">
      <td>${escapeHtml(product.barcode || product.sku || "-")}</td>
      <td class="product-name"><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.brand || "")}</small></td>
      <td>${number(stock)} ad.<small>${units > 1 ? `${number(stock / units)} koli` : ""}</small></td>
      <td><input data-picker-quantity type="number" min="0.001" step="0.001" value="1" aria-label="Miktar" /></td>
      <td><input data-picker-price type="number" min="0" step="0.0001" value="${productUnitPrice(product, invoiceType, defaultUnit)}" aria-label="Birim fiyat" /></td>
      <td><select data-picker-currency aria-label="Para birimi">${invoiceCurrencies.map((item) => `<option ${item === currency ? "selected" : ""}>${item}</option>`).join("")}</select></td>
      <td><select data-picker-unit aria-label="Birim"><option value="adet" ${defaultUnit === "adet" ? "selected" : ""}>Adet</option><option value="koli" ${defaultUnit === "koli" ? "selected" : ""}>Koli</option></select></td>
      <td><button type="button" class="primary" data-add-invoice-product="${product.id}">Ekle</button></td>
    </tr>`;
  }).join("") : '<tr><td colspan="8" class="empty">Ürün bulunamadı.</td></tr>';
  document.querySelectorAll("[data-picker-sort]").forEach((button) => {
    button.textContent = button.dataset.pickerSort === field ? (direction === "asc" ? "↑" : "↓") : "↕";
  });
};

const updateInvoiceTermDays = () => {
  const form = document.querySelector("#invoiceForm");
  const start = form.elements.invoice_date.value;
  const end = form.elements.due_date.value;
  const target = document.querySelector("#invoiceTermDays");
  if (!start || !end) { target.textContent = "0 gün"; return; }
  const days = Math.round((new Date(`${end}T12:00:00`) - new Date(`${start}T12:00:00`)) / 86400000);
  target.textContent = days >= 0 ? `${days} gün` : "Geçersiz tarih";
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
    const units = Math.max(Number(line.units_per_carton || 1), 1);
    const stockWarning = form.elements.invoice_type.value === "sale" && Number(line.stock_quantity) > Number(line.stock);
    return `<tr class="${stockWarning ? "stock-warning" : ""}">
      <td>${index + 1}</td><td class="line-barcode">${escapeHtml(line.barcode || line.sku || "-")}</td>
      <td class="line-product"><strong>${escapeHtml(line.name)}</strong><small>${escapeHtml(line.sku || "")}</small></td>
      <td>${number(line.stock)} ad.<small>${units > 1 ? `${number(Number(line.stock) / units)} koli` : ""}</small></td>
      <td><input data-line-index="${index}" data-line-field="quantity" type="number" min="0.001" step="0.001" value="${line.quantity}" /></td>
      <td><select data-line-index="${index}" data-line-field="selected_unit"><option value="adet" ${line.selected_unit === "adet" ? "selected" : ""}>Adet</option><option value="koli" ${line.selected_unit === "koli" ? "selected" : ""}>Koli</option></select></td>
      <td><input data-line-index="${index}" data-line-field="unit_price" type="number" min="0" step="0.0001" value="${line.unit_price}" /></td>
      <td><strong>${escapeHtml(currency)}</strong></td>
      <td><input data-line-index="${index}" data-line-field="discount_1" type="number" min="0" max="100" step="0.01" value="${line.discount_1}" /></td>
      <td><input data-line-index="${index}" data-line-field="discount_2" type="number" min="0" max="100" step="0.01" value="${line.discount_2}" /></td>
      <td><input data-line-index="${index}" data-line-field="discount_3" type="number" min="0" max="100" step="0.01" value="${line.discount_3}" /></td>
      <td><input data-line-index="${index}" data-line-field="tax_rate" type="number" list="vatRates" min="0" max="100" step="0.01" value="${line.tax_rate}" ${scenario === "export" ? "disabled" : ""} /></td>
      <td>${money(calc.tax, currency)}</td><td><strong>${money(calc.total, currency)}</strong></td><td><button type="button" data-remove-line="${index}">Sil</button></td></tr>`;
  }).join("") : '<tr><td colspan="15" class="empty">Yukarıdaki listeden ürün ekleyin.</td></tr>';
  const bottomDiscount = subtotal * Math.min(Math.max(bottomRate, 0), 100) / 100;
  const adjustedTax = subtotal > 0 ? tax * ((subtotal - bottomDiscount) / subtotal) : 0;
  document.querySelector("#invoiceSubtotal").textContent = money(subtotal, currency);
  document.querySelector("#invoiceDiscountTotal").textContent = money(lineDiscount + bottomDiscount, currency);
  document.querySelector("#invoiceTaxTotal").textContent = money(adjustedTax, currency);
  document.querySelector("#invoiceGrandTotal").textContent = money(subtotal - bottomDiscount + adjustedTax, currency);
};

const renderAll = () => {
  renderCustomers();
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
    if (!field) return;
    if (field.type === "checkbox") field.checked = value !== false;
    else field.value = value ?? "";
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

const saveCustomer = async (event) => {
  event.preventDefault();
  const values = formObject(event.currentTarget);
  const id = values.id;
  delete values.id;
  values.is_buyer = event.currentTarget.elements.is_buyer.checked;
  values.is_seller = event.currentTarget.elements.is_seller.checked;
  if (!values.is_buyer && !values.is_seller) {
    throw new Error("Cari en az alıcı veya satıcı olarak işaretlenmelidir.");
  }
  const request = id ? client.from("customers").update(values).eq("id", id) : client.from("customers").insert(values);
  await query(request);
  document.querySelector("#customerDialog").close();
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
 grammage: item.liter || null,
    unit: "adet",
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
  state.editingInvoiceId = null;
  state.invoiceLines = [];
  form.elements.invoice_type.value = type;
  form.elements.invoice_date.value = today();
  form.elements.invoice_discount_rate.value = "0";
  form.elements.source_order_id.value = order?.id || "";
  const purchase = type === "purchase";
  const returnInvoice = type === "return";
  document.querySelector("#invoiceKicker").textContent = purchase ? "ALIŞ FATURASI" : returnInvoice ? "İADE FATURASI" : "SATIŞ FATURASI";
  document.querySelector("#invoiceDialogTitle").textContent = purchase ? "Alış faturası ve stok girişi" : returnInvoice ? "Müşteri iade faturası ve stok girişi" : "Satış / ihracat faturası";
  document.querySelector("#customerField").hidden = false;
  form.elements.customer_id.required = true;
  form.elements.scenario.value = purchase || returnInvoice ? "domestic" : "export";
  form.elements.currency.value = purchase || returnInvoice ? "TRY" : "USD";
  document.querySelector("#saveInvoiceButton").textContent = purchase ? "Alış faturasını işle ve stoğa ekle" : returnInvoice ? "İade faturasını kaydet ve stoğa ekle" : "Satış faturasını kes ve stoktan düş";
  document.querySelector("#invoiceFormStatus").textContent = "";
  document.querySelector("#invoiceProductSearch").value = "";
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
        barcode: product.barcode, sku: product.sku, units_per_carton: cartonSize(product),
        quantity: Number(item.cartons || 1), selected_unit: "koli",
        stock_quantity: stockQuantityFor(Number(item.cartons || 1), "koli", cartonSize(product)),
        unit_price: productUnitPrice(product, "sale", "koli"),
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
  updateInvoiceTermDays();
  const invoiceDialog = document.querySelector("#invoiceDialog");
  if (!invoiceDialog.open) invoiceDialog.showModal();
};

const addInvoiceLine = (button) => {
  const product = state.products.find((item) => item.id === button.dataset.addInvoiceProduct);
  if (!product) throw new Error("Ürün seçin.");
  const form = document.querySelector("#invoiceForm");
  const row = button.closest("[data-picker-row]");
  const quantity = Number(row.querySelector("[data-picker-quantity]").value);
  const selectedUnit = row.querySelector("[data-picker-unit]").value;
  form.elements.currency.value = row.querySelector("[data-picker-currency]").value;
  const unitPrice = Number(row.querySelector("[data-picker-price]").value);
  const unitsPerCarton = cartonSize(product);
  if (!(quantity > 0)) throw new Error("Miktar sıfırdan büyük olmalı.");
  const line = {
    product_id: product.id,
    name: product.name,
    barcode: product.barcode,
    sku: product.sku,
    stock: Number(product.stock_quantity),
    quantity,
    selected_unit: selectedUnit,
    units_per_carton: unitsPerCarton,
    stock_quantity: stockQuantityFor(quantity, selectedUnit, unitsPerCarton),
    unit_price: unitPrice,
    tax_rate: Number(product.vat_rate || 20),
    discount_1: 0,
    discount_2: 0,
    discount_3: 0,
  };
  state.invoiceLines.push(line);
  renderInvoiceLines();
};

const saveInvoice = async (event) => {
  event.preventDefault();
  if (!state.invoiceLines.length) throw new Error("Faturaya en az bir ürün ekleyin.");
  const values = formObject(event.currentTarget);
  const payload = {
    p_invoice_type: values.invoice_type,
    p_customer_id: values.customer_id,
    p_supplier_id: null,
    p_source_order_id: values.source_order_id || null,
    p_invoice_date: values.invoice_date,
    p_due_date: values.due_date || null,
    p_currency: values.currency,
    p_exchange_rate: 1,
    p_scenario: values.scenario,
    p_invoice_discount_rate: Number(values.invoice_discount_rate || 0),
    p_notes: values.notes,
    p_draft_data: {
      document_number: values.document_number,
      payment_note: state.settings.invoice_template?.payment_note || "",
    },
    p_items: state.invoiceLines.map((item) => ({
      product_id: item.product_id, description: item.name, quantity: item.quantity,
      barcode: item.barcode, product_code: item.sku, unit: item.selected_unit,
      stock_quantity: item.stock_quantity, units_per_carton: item.units_per_carton,
      unit_price: item.unit_price, tax_rate: item.tax_rate,
      discount_1: item.discount_1, discount_2: item.discount_2, discount_3: item.discount_3,
    })),
  };
  const editingInvoiceId = state.editingInvoiceId;
  const result = editingInvoiceId
    ? await query(client.rpc("replace_invoice_v2", { p_invoice_id: editingInvoiceId, ...payload }))
    : await query(client.rpc("create_invoice_v2", payload));
  const savedInvoiceId = Array.isArray(result) ? result[0] : result;
  if (!savedInvoiceId) throw new Error("Fatura kimliği alınamadı; kayıt doğrulanamadı.");
  const savedInvoice = await query(client.from("invoices").select("id,invoice_no,invoice_type").eq("id", savedInvoiceId).maybeSingle());
  if (!savedInvoice?.id) throw new Error("Fatura veritabanında doğrulanamadı. Pencere kapatılmadı.");
  await loadData();
  state.invoiceLines = [];
  state.editingInvoiceId = null;
  document.querySelector("#invoiceDialog").close();
  setStatus(`${({ purchase: "Alış", sale: "Satış", return: "İade" })[values.invoice_type]} faturası ${editingInvoiceId ? "güncellendi" : "kaydedildi"}; fatura ve stok kaydı doğrulandı.`);
  return result;
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
  if (!confirm(`${ids.length} cari kalıcı olarak silinsin mi? Hareketi olan cariler silinemez.`)) return;
  try {
    await query(client.from("customers").delete().in("id", ids).select("id"));
  } catch (error) {
    throw new Error(`Cari silinemedi. Faturası veya hesap hareketi olan cariyi pasife alın. ${error.message || ""}`.trim());
  }
  state.selectedCustomers.clear();
  await loadData();
  setStatus(`${ids.length} cari silindi.`);
};

const deleteIncomingOrder = async (orderId) => {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order || !confirm(`${order.order_no} numaralı sipariş silinsin mi?`)) return;
  await query(client.from("site_orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", orderId).select("id"));
  await loadData();
  setStatus(`${order.order_no} numaralı sipariş silindi.`);
};

const openProductHistory = async (productId) => {
  const product = state.products.find((item) => item.id === productId);
  if (!product) throw new Error("Ürün kaydı bulunamadı.");
  const dialog = document.querySelector("#productHistoryDialog");
  const status = document.querySelector("#productHistoryStatus");
  document.querySelector("#productHistoryTitle").textContent = `${product.brand || ""} ${product.name}`.trim();
  document.querySelector("#productHistoryMeta").textContent = `${product.barcode || product.sku || "Barkod yok"} · ${product.grammage || "Gramaj yok"}`;
  document.querySelector("#productHistoryStock").textContent = `${number(product.stock_quantity)} adet`;
  document.querySelector("#productHistoryRows").innerHTML = '<tr><td colspan="10" class="empty">Hareketler yükleniyor...</td></tr>';
  status.textContent = "";
  status.classList.remove("error");
  if (!dialog.open) dialog.showModal();

  try {
    const [items, movements] = await Promise.all([
      query(client.from("invoice_items").select("*").eq("product_id", productId)),
      query(client.from("stock_movements").select("*").eq("product_id", productId).order("created_at", { ascending: true })),
    ]);
    const itemByInvoice = new Map(items.map((item) => [item.invoice_id, item]));
    const averages = productAveragePrices(productId);
    const averagePurchase = averages.purchase || Number(product.purchase_price || 0);
    const averageSale = averages.sale || Number(product.sale_price || 0);
    const profitIndex = averagePurchase > 0 ? ((averageSale - averagePurchase) / averagePurchase) * 100 : 0;
    document.querySelector("#productHistoryAveragePurchase").textContent = money(averagePurchase, "USD");
    document.querySelector("#productHistoryAverageSale").textContent = money(averageSale, "USD");
    const profitTarget = document.querySelector("#productHistoryProfitIndex");
    profitTarget.textContent = `%${number(profitIndex)}`;
    profitTarget.className = profitIndex > 0 ? "profit-positive" : profitIndex < 0 ? "profit-negative" : "profit-neutral";

    const movementTotal = movements.reduce((sum, movement) => sum + Number(movement.quantity || 0), 0);
    let balance = Number(product.stock_quantity || 0) - movementTotal;
    const statementRows = [];
    if (Math.abs(balance) > 0.0001) {
      statementRows.push(`<tr><td>-</td><td>Önceki bakiye</td><td>-</td><td>-</td><td class="statement-in">${balance > 0 ? number(balance) : "-"}</td><td class="statement-out">${balance < 0 ? number(Math.abs(balance)) : "-"}</td><td>-</td><td>-</td><td><strong>${number(balance)}</strong></td><td>Hareket kaydı öncesi stok</td></tr>`);
    }
    movements.forEach((movement) => {
      const quantity = Number(movement.quantity || 0);
      balance += quantity;
      const invoice = movement.reference_type === "invoice" ? state.invoices.find((item) => item.id === movement.reference_id) : null;
      const invoiceItem = invoice ? itemByInvoice.get(invoice.id) : null;
      const customer = invoice ? state.customers.find((item) => item.id === invoice.customer_id) : null;
      const typeLabel = ({ purchase: "Alış", sale: "Satış", sale_cancel: "İade", adjustment_in: "Stok girişi", adjustment_out: "Stok çıkışı", opening: "Açılış" })[movement.movement_type] || movement.movement_type;
      const reference = invoice ? invoice.draft_data?.document_number || invoice.invoice_no : movement.reference_type || "-";
      const unitPrice = invoiceItem ? Number(invoiceItem.unit_price || 0) : Number(movement.unit_cost || 0);
      const currency = invoice?.currency || "USD";
      statementRows.push(`<tr><td>${date(movement.created_at)}</td><td>${escapeHtml(typeLabel)}</td><td>${escapeHtml(reference)}</td><td>${escapeHtml(customer ? `${customer.code} · ${customer.company}` : "-")}</td><td class="statement-in">${quantity > 0 ? number(quantity) : "-"}</td><td class="statement-out">${quantity < 0 ? number(Math.abs(quantity)) : "-"}</td><td>${money(unitPrice, currency)}</td><td>${escapeHtml(currency)}</td><td><strong>${number(balance)}</strong></td><td>${escapeHtml(movement.note || "-")}</td></tr>`);
    });
    document.querySelector("#productHistoryRows").innerHTML = statementRows.length ? statementRows.join("") : '<tr><td colspan="10" class="empty">Bu ürüne ait stok hareketi bulunmuyor.</td></tr>';
  } catch (error) {
    status.classList.add("error");
    status.textContent = friendlyError(error);
    document.querySelector("#productHistoryRows").innerHTML = '<tr><td colspan="10" class="empty">Ekstre yüklenemedi.</td></tr>';
  }
};

const deleteProduct = async (productId) => {
  const product = state.products.find((item) => item.id === productId);
  if (!product || !confirm(`${product.name} stok kartı veritabanından kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`)) return;
  try {
    const deleted = await query(client.from("products").delete().eq("id", productId).select("id"));
    if (!deleted.length) throw new Error("Silme yetkisi alınamadı.");
  } catch (error) {
    if (/foreign key|violates|reference|23503/i.test(String(error.message || error))) {
      throw new Error("Bu ürünün fatura veya stok hareketi bulunduğu için kalıcı olarak silinemez. Geçmiş kayıtların bozulmaması için önce bağlı işlemler düzeltilmelidir.");
    }
    throw error;
  }
  state.selectedProducts.delete(productId);
  await loadData();
  setStatus(`${product.name} kalıcı olarak silindi.`);
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
document.querySelector("#productSearch").addEventListener("input", () => { state.productPage = 1; renderProducts(); });
document.querySelector("#productSort").addEventListener("change", (event) => { state.productSort = event.target.value; state.productPage = 1; renderProducts(); });
document.querySelector("#customerForm").addEventListener("submit", safely(saveCustomer));
document.querySelector("#productForm").addEventListener("submit", safely((event) => saveEntity(event, "products", "productDialog", ["purchase_price", "sale_price", "minimum_stock", "units_per_carton", "kg_per_carton", "vat_rate"])));
document.querySelector("#stockForm").addEventListener("submit", safely(adjustStock));
document.querySelector("#paymentForm").addEventListener("submit", safely(recordPayment));
document.querySelector("#invoiceForm").addEventListener("submit", submitInvoice);
document.querySelector("#templateForm").addEventListener("submit", safely(saveTemplate));
document.querySelector("#importCatalogButton").addEventListener("click", safely(importCatalog));
document.querySelector("#openStockCorrection").addEventListener("click", () => { renderInvoiceOptions(); document.querySelector("#stockDialog").showModal(); });
document.querySelector("#newSaleInvoiceButton").addEventListener("click", () => setInvoiceMode("sale"));
document.querySelector("#newPurchaseInvoiceButton").addEventListener("click", () => setInvoiceMode("purchase"));
document.querySelector("#newReturnInvoiceButton").addEventListener("click", () => setInvoiceMode("return"));
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

document.querySelector("#productRows").addEventListener("contextmenu", (event) => {
  const row = event.target.closest("[data-product-row]");
  if (!row) return;
  event.preventDefault();
  openProductHistory(row.dataset.productRow).catch((error) => setStatus(friendlyError(error), true));
});

document.addEventListener("change", (event) => {
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

document.addEventListener("click", safely(async (event) => {
  const productPageButton = event.target.closest("[data-product-page]");
 if (productPageButton && !productPageButton.disabled) {
  state.productPage = Number(productPageButton.dataset.productPage || 1);
  renderProducts();
  document.querySelector("#productRows")?.closest(".table-wrap")?.scrollIntoView({ block: "start" });
  return;
 }
 const opener = event.target.closest("[data-open-dialog]");
  if (opener) openEditForm(opener.dataset.openDialog, opener.dataset.openDialog.replace("Dialog", "Form"));
  const customerEdit = event.target.closest("[data-customer-edit]");
  if (customerEdit) openEditForm("customerDialog", "customerForm", state.customers.find((item) => item.id === customerEdit.dataset.customerEdit));
 const productEdit = event.target.closest("[data-product-edit]");
  if (productEdit) openEditForm("productDialog", "productForm", state.products.find((item) => item.id === productEdit.dataset.productEdit));
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
