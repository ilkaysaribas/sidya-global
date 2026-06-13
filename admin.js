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
  invoiceLines: [],
  session: null,
};

const money = (value, currency = "EUR") => new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: currency || "EUR",
  maximumFractionDigits: 2,
}).format(Number(value || 0));
const number = (value) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 }).format(Number(value || 0));
const date = (value) => value ? new Intl.DateTimeFormat("tr-TR").format(new Date(`${value}T12:00:00`)) : "-";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
})[char]);
const formObject = (form) => Object.fromEntries(new FormData(form).entries());
const today = () => new Date().toISOString().slice(0, 10);

const setStatus = (message = "", error = false) => {
  const target = document.querySelector("#globalStatus");
  target.textContent = message;
  target.style.color = error ? "#b42318" : "#087462";
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

const findBalance = (customerId, currency = "EUR") =>
  state.balances.find((item) => item.id === customerId && (item.currency || currency) === currency)?.balance || 0;

const loadData = async () => {
  setStatus("Veriler güncelleniyor...");
  const db = requireClient();
  const [customers, balances, products, invoices, invoiceItems, ledger] = await Promise.all([
    query(db.from("customers").select("*").order("created_at", { ascending: false })),
    query(db.from("customer_balances").select("*")),
    query(db.from("products").select("*").order("name")),
    query(db.from("invoices").select("*, customers(company,code)").order("invoice_date", { ascending: false }).limit(250)),
    query(db.from("invoice_items").select("product_id,quantity,line_total,products(name)").limit(5000)),
    query(db.from("customer_ledger").select("*").order("transaction_date", { ascending: false }).limit(5000)),
  ]);
  Object.assign(state, { customers, balances, products, invoices, invoiceItems, ledger });
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
    <tr>
      <td>${escapeHtml(item.code)}</td>
      <td><strong>${escapeHtml(item.company)}</strong></td>
      <td>${escapeHtml(item.contact_name || "-")}</td>
      <td>${escapeHtml(item.country || "-")}</td>
      <td>${escapeHtml(item.email || "-")}</td>
      <td>${money(findBalance(item.id, item.currency), item.currency)}</td>
      <td><div class="row-actions">
        <button data-customer-payment="${item.id}">Tahsilat</button>
        <button data-customer-edit="${item.id}">Düzenle</button>
      </div></td>
    </tr>`).join("") : '<tr><td colspan="7" class="empty">Cari kaydı bulunamadı.</td></tr>';
};

const renderProducts = () => {
  const term = document.querySelector("#productSearch").value.trim().toLocaleLowerCase("tr");
  const rows = state.products.filter((item) =>
    [item.sku, item.barcode, item.name, item.brand, item.category].some((value) =>
      String(value || "").toLocaleLowerCase("tr").includes(term)));
  document.querySelector("#productRows").innerHTML = rows.length ? rows.map((item) => {
    const low = Number(item.stock_quantity) <= Number(item.minimum_stock);
    return `<tr>
      <td>${escapeHtml(item.sku || item.barcode || "-")}</td>
      <td><strong>${escapeHtml(item.name)}</strong></td>
      <td>${escapeHtml(item.brand || "-")}</td>
      <td class="${low ? "stock-low" : ""}">${number(item.stock_quantity)} ${escapeHtml(item.unit)}</td>
      <td>${number(item.minimum_stock)}</td>
      <td>${money(item.sale_price, item.currency)}</td>
      <td><div class="row-actions">
        <button data-stock-adjust="${item.id}">Stok hareketi</button>
        <button data-product-edit="${item.id}">Düzenle</button>
      </div></td>
    </tr>`;
  }).join("") : '<tr><td colspan="7" class="empty">Stok kartı bulunamadı.</td></tr>';
};

const renderInvoices = () => {
  document.querySelector("#invoiceRows").innerHTML = state.invoices.length ? state.invoices.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.invoice_no)}</strong></td>
      <td>${date(item.invoice_date)}</td>
      <td>${escapeHtml(item.customers?.company || "-")}</td>
      <td>${escapeHtml(item.currency)}</td>
      <td>${money(item.grand_total, item.currency)}</td>
      <td><span class="badge">${item.status === "posted" ? "Kesildi" : escapeHtml(item.status)}</span></td>
      <td><button data-invoice-print="${item.id}">Yazdır</button></td>
    </tr>`).join("") : '<tr><td colspan="7" class="empty">Henüz fatura bulunmuyor.</td></tr>';
};

const renderDashboard = () => {
  const now = today().slice(0, 7);
  const monthly = state.invoices.filter((item) => item.invoice_date?.startsWith(now) && item.currency === "EUR")
    .reduce((sum, item) => sum + Number(item.grand_total), 0);
  const stockValue = state.products.filter((item) => item.currency === "EUR")
    .reduce((sum, item) => sum + Number(item.stock_quantity) * Number(item.sale_price), 0);
  const low = state.products.filter((item) => Number(item.stock_quantity) <= Number(item.minimum_stock));
  document.querySelector("#metricCustomers").textContent = number(state.customers.length);
  document.querySelector("#metricProducts").textContent = number(state.products.filter((item) => item.active).length);
  document.querySelector("#metricStockValue").textContent = money(stockValue);
  document.querySelector("#metricMonthlySales").textContent = money(monthly);
  document.querySelector("#lowStockList").innerHTML = low.length ? low.slice(0, 8).map((item) => `
    <div class="compact-row"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.brand || "")}</small></div><span class="stock-low">${number(item.stock_quantity)} ${escapeHtml(item.unit)}</span></div>
  `).join("") : '<p class="empty">Kritik stok bulunmuyor.</p>';
  document.querySelector("#recentInvoices").innerHTML = state.invoices.length ? state.invoices.slice(0, 8).map((item) => `
    <div class="compact-row"><div><strong>${escapeHtml(item.invoice_no)}</strong><small>${escapeHtml(item.customers?.company || "-")} · ${date(item.invoice_date)}</small></div><span>${money(item.grand_total, item.currency)}</span></div>
  `).join("") : '<p class="empty">Henüz fatura bulunmuyor.</p>';
};

const renderReports = () => {
  const eurSales = state.invoices.filter((item) => item.currency === "EUR" && item.status === "posted")
    .reduce((sum, item) => sum + Number(item.grand_total), 0);
  const stockQty = state.products.reduce((sum, item) => sum + Number(item.stock_quantity), 0);
  const lowCount = state.products.filter((item) => Number(item.stock_quantity) <= Number(item.minimum_stock)).length;
  const receivables = state.balances.filter((item) => item.currency === "EUR").reduce((sum, item) => sum + Math.max(0, Number(item.balance)), 0);
  document.querySelector("#reportSales").textContent = money(eurSales);
  document.querySelector("#reportStockQty").textContent = number(stockQty);
  document.querySelector("#reportLowStock").textContent = number(lowCount);
  document.querySelector("#reportReceivables").textContent = money(receivables);

  const balances = state.balances.filter((item) => Number(item.balance) !== 0)
    .sort((a, b) => Number(b.balance) - Number(a.balance));
  document.querySelector("#balanceReport").innerHTML = balances.length ? balances.slice(0, 12).map((item) => `
    <div class="compact-row"><div><strong>${escapeHtml(item.company)}</strong><small>${escapeHtml(item.code)}</small></div><span>${money(item.balance, item.currency || "EUR")}</span></div>
  `).join("") : '<p class="empty">Açık bakiye bulunmuyor.</p>';

  const productSales = new Map();
  state.invoiceItems.forEach((item) => {
    const current = productSales.get(item.product_id) || { name: item.products?.name || "-", quantity: 0, total: 0 };
    current.quantity += Number(item.quantity);
    current.total += Number(item.line_total);
    productSales.set(item.product_id, current);
  });
  const sorted = [...productSales.values()].sort((a, b) => b.quantity - a.quantity);
  document.querySelector("#salesProductReport").innerHTML = sorted.length ? sorted.slice(0, 12).map((item) => `
    <div class="compact-row"><div><strong>${escapeHtml(item.name)}</strong><small>${number(item.quantity)} birim/koli</small></div><span>${money(item.total)}</span></div>
  `).join("") : '<p class="empty">Satış verisi bulunmuyor.</p>';
};

const renderInvoiceOptions = () => {
  const customer = document.querySelector("#invoiceCustomer");
  const product = document.querySelector("#invoiceProduct");
  customer.innerHTML = '<option value="">Cari seçin</option>' + state.customers.map((item) =>
    `<option value="${item.id}">${escapeHtml(item.code)} · ${escapeHtml(item.company)}</option>`).join("");
  product.innerHTML = '<option value="">Ürün seçin</option>' + state.products.filter((item) => item.active).map((item) =>
    `<option value="${item.id}">${escapeHtml(item.name)} · stok ${number(item.stock_quantity)}</option>`).join("");
};

const renderInvoiceLines = () => {
  let total = 0;
  document.querySelector("#invoiceLineRows").innerHTML = state.invoiceLines.length ? state.invoiceLines.map((line, index) => {
    const lineTotal = line.quantity * line.unit_price * (1 + line.tax_rate / 100);
    total += lineTotal;
    return `<tr>
      <td><strong>${escapeHtml(line.name)}</strong></td><td>${number(line.stock)}</td>
      <td>${number(line.quantity)}</td><td>${money(line.unit_price, document.querySelector("#invoiceForm [name='currency']").value)}</td>
      <td>%${number(line.tax_rate)}</td><td>${money(lineTotal, document.querySelector("#invoiceForm [name='currency']").value)}</td>
      <td><button type="button" data-remove-line="${index}">Sil</button></td>
    </tr>`;
  }).join("") : '<tr><td colspan="7" class="empty">Fatura satırı ekleyin.</td></tr>';
  document.querySelector("#invoiceGrandTotal").textContent = money(total, document.querySelector("#invoiceForm [name='currency']").value);
};

const renderAll = () => {
  renderCustomers();
  renderProducts();
  renderInvoices();
  renderDashboard();
  renderReports();
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

const saveCustomer = async (event) => {
  event.preventDefault();
  const values = formObject(event.currentTarget);
  const id = values.id;
  delete values.id;
  const request = id
    ? client.from("customers").update(values).eq("id", id)
    : client.from("customers").insert(values);
  await query(request);
  document.querySelector("#customerDialog").close();
  await loadData();
};

const saveProduct = async (event) => {
  event.preventDefault();
  const values = formObject(event.currentTarget);
  const id = values.id;
  delete values.id;
  ["purchase_price", "sale_price", "minimum_stock", "units_per_carton", "kg_per_carton"].forEach((key) => {
    values[key] = Number(values[key] || 0);
  });
  const request = id
    ? client.from("products").update(values).eq("id", id)
    : client.from("products").insert(values);
  await query(request);
  document.querySelector("#productDialog").close();
  await loadData();
};

const adjustStock = async (event) => {
  event.preventDefault();
  const values = formObject(event.currentTarget);
  await query(client.rpc("adjust_stock", {
    p_product_id: values.product_id,
    p_quantity: Number(values.quantity),
    p_note: values.note,
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

const importCatalog = async () => {
  const catalog = Array.isArray(window.SIDYA_CATALOG_PRODUCTS) ? window.SIDYA_CATALOG_PRODUCTS : [];
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
  }));
  setStatus(`${rows.length} katalog ürünü aktarılıyor...`);
  for (let index = 0; index < rows.length; index += 300) {
    await query(client.from("products").upsert(rows.slice(index, index + 300), { onConflict: "catalog_id" }));
  }
  await loadData();
  setStatus("Site kataloğu stok kartlarına aktarıldı.");
};

const addInvoiceLine = () => {
  const product = state.products.find((item) => item.id === document.querySelector("#invoiceProduct").value);
  if (!product) throw new Error("Ürün seçin.");
  const quantity = Number(document.querySelector("#invoiceQuantity").value);
  const unitPrice = Number(document.querySelector("#invoicePrice").value || product.sale_price);
  const taxRate = Number(document.querySelector("#invoiceTax").value || 0);
  if (!(quantity > 0)) throw new Error("Miktar sıfırdan büyük olmalı.");
  const existing = state.invoiceLines.find((item) => item.product_id === product.id);
  if (existing) {
    existing.quantity += quantity;
    existing.unit_price = unitPrice;
    existing.tax_rate = taxRate;
  } else {
    state.invoiceLines.push({
      product_id: product.id,
      name: product.name,
      stock: Number(product.stock_quantity),
      quantity,
      unit_price: unitPrice,
      tax_rate: taxRate,
    });
  }
  renderInvoiceLines();
};

const saveInvoice = async (event) => {
  event.preventDefault();
  if (!state.invoiceLines.length) throw new Error("Faturaya en az bir ürün ekleyin.");
  const values = formObject(event.currentTarget);
  await query(client.rpc("create_invoice", {
    p_customer_id: values.customer_id,
    p_invoice_date: values.invoice_date,
    p_due_date: values.due_date || null,
    p_currency: values.currency,
    p_exchange_rate: Number(values.exchange_rate),
    p_notes: values.notes,
    p_items: state.invoiceLines.map((item) => ({
      product_id: item.product_id,
      description: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      tax_rate: item.tax_rate,
    })),
  }));
  state.invoiceLines = [];
  document.querySelector("#invoiceDialog").close();
  await loadData();
  setStatus("Fatura kesildi ve stoklar güncellendi.");
};

const printInvoice = async (invoiceId) => {
  const invoice = state.invoices.find((item) => item.id === invoiceId);
  const items = await query(client.from("invoice_items").select("*").eq("invoice_id", invoiceId));
  const customer = state.customers.find((item) => item.id === invoice.customer_id);
  const popup = window.open("", "_blank", "width=900,height=760");
  popup.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(invoice.invoice_no)}</title>
    <style>body{font-family:Arial,sans-serif;color:#18212b;padding:42px}header{display:flex;justify-content:space-between;border-bottom:3px solid #176b87;padding-bottom:20px}h1{margin:0;color:#0d1b2a}.meta{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin:28px 0}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}.right{text-align:right}.total{margin:24px 0 0 auto;width:320px;font-size:18px}.note{margin-top:36px;color:#667085}@media print{button{display:none}}</style></head><body>
    <header><div><h1>İHRACAT YÖNETİMİ</h1><p>Ticari Fatura / Commercial Invoice</p></div><div><strong>${escapeHtml(invoice.invoice_no)}</strong><p>${date(invoice.invoice_date)}</p></div></header>
    <section class="meta"><div><strong>ALICI</strong><h2>${escapeHtml(customer?.company || "")}</h2><p>${escapeHtml(customer?.address || "")}<br>${escapeHtml(customer?.country || "")}<br>Vergi No: ${escapeHtml(customer?.tax_number || "-")}</p></div><div><strong>FATURA BİLGİLERİ</strong><p>Vade: ${date(invoice.due_date)}<br>Para birimi: ${escapeHtml(invoice.currency)}<br>Kur: ${number(invoice.exchange_rate)}</p></div></section>
    <table><thead><tr><th>Ürün</th><th class="right">Miktar</th><th class="right">Birim fiyat</th><th class="right">Vergi</th><th class="right">Toplam</th></tr></thead><tbody>${items.map((item) => `<tr><td>${escapeHtml(item.description)}</td><td class="right">${number(item.quantity)}</td><td class="right">${money(item.unit_price, invoice.currency)}</td><td class="right">%${number(item.tax_rate)}</td><td class="right">${money(item.line_total, invoice.currency)}</td></tr>`).join("")}</tbody></table>
    <div class="total"><p>Ara toplam: <strong>${money(invoice.subtotal, invoice.currency)}</strong></p><p>Vergi: <strong>${money(invoice.tax_total, invoice.currency)}</strong></p><p>Genel toplam: <strong>${money(invoice.grand_total, invoice.currency)}</strong></p></div>
    <p class="note">${escapeHtml(invoice.notes || "")}</p><button onclick="window.print()">Yazdır / PDF kaydet</button></body></html>`);
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
    setStatus(error.message || "İşlem tamamlanamadı.", true);
  }
};

document.querySelector("#loginForm").addEventListener("submit", safely(async (event) => {
  event.preventDefault();
  const email = document.querySelector("#loginEmail").value.trim();
  const password = document.querySelector("#loginPassword").value;
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!await verifyAdmin(data.session)) {
    await client.auth.signOut();
    throw new Error("Bu hesabın yönetim paneli yetkisi yok.");
  }
  showApp(data.session);
  await loadData();
}));

document.querySelector("#signOutButton").addEventListener("click", safely(async () => {
  await client.auth.signOut();
  showLogin();
}));
document.querySelector("#refreshButton").addEventListener("click", safely(loadData));
document.querySelector("#customerSearch").addEventListener("input", renderCustomers);
document.querySelector("#productSearch").addEventListener("input", renderProducts);
document.querySelector("#customerForm").addEventListener("submit", safely(saveCustomer));
document.querySelector("#productForm").addEventListener("submit", safely(saveProduct));
document.querySelector("#stockForm").addEventListener("submit", safely(adjustStock));
document.querySelector("#paymentForm").addEventListener("submit", safely(recordPayment));
document.querySelector("#invoiceForm").addEventListener("submit", safely(saveInvoice));
document.querySelector("#importCatalogButton").addEventListener("click", safely(importCatalog));
document.querySelector("#addInvoiceLine").addEventListener("click", safely(addInvoiceLine));
document.querySelector("#invoiceProduct").addEventListener("change", () => {
  const product = state.products.find((item) => item.id === document.querySelector("#invoiceProduct").value);
  document.querySelector("#invoicePrice").value = product?.sale_price || "";
});
document.querySelector("#invoiceForm [name='currency']").addEventListener("change", renderInvoiceLines);

document.querySelector("#mainNav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (!button) return;
  document.querySelectorAll("#mainNav [data-view], .view").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  document.querySelector(`[data-view-panel="${button.dataset.view}"]`).classList.add("active");
  document.querySelector("#pageTitle").textContent = button.textContent;
});

document.addEventListener("click", safely(async (event) => {
  const opener = event.target.closest("[data-open-dialog]");
  if (opener) openEditForm(opener.dataset.openDialog, opener.dataset.openDialog.replace("Dialog", "Form"));

  const customerEdit = event.target.closest("[data-customer-edit]");
  if (customerEdit) openEditForm("customerDialog", "customerForm", state.customers.find((item) => item.id === customerEdit.dataset.customerEdit));

  const productEdit = event.target.closest("[data-product-edit]");
  if (productEdit) openEditForm("productDialog", "productForm", state.products.find((item) => item.id === productEdit.dataset.productEdit));

  const stockAdjust = event.target.closest("[data-stock-adjust]");
  if (stockAdjust) {
    const product = state.products.find((item) => item.id === stockAdjust.dataset.stockAdjust);
    openEditForm("stockDialog", "stockForm", { product_id: product.id });
    document.querySelector("#stockProductName").textContent = `${product.name} · Mevcut stok: ${number(product.stock_quantity)} ${product.unit}`;
  }

  const payment = event.target.closest("[data-customer-payment]");
  if (payment) {
    const customer = state.customers.find((item) => item.id === payment.dataset.customerPayment);
    openEditForm("paymentDialog", "paymentForm", { customer_id: customer.id, currency: customer.currency, payment_date: today() });
    document.querySelector("#paymentCustomerName").textContent = `${customer.code} · ${customer.company}`;
  }

  const removeLine = event.target.closest("[data-remove-line]");
  if (removeLine) {
    state.invoiceLines.splice(Number(removeLine.dataset.removeLine), 1);
    renderInvoiceLines();
  }

  const print = event.target.closest("[data-invoice-print]");
  if (print) await printInvoice(print.dataset.invoicePrint);
}));

document.querySelector("#newInvoiceButton").addEventListener("click", () => {
  state.invoiceLines = [];
  openEditForm("invoiceDialog", "invoiceForm", { invoice_date: today(), exchange_rate: 1, currency: "EUR" });
  renderInvoiceOptions();
  renderInvoiceLines();
});

document.querySelector("#exportCustomersButton").addEventListener("click", () => csvDownload("cari-bakiyeler.csv", [
  ["Cari kod", "Firma", "Para birimi", "Bakiye"],
  ...state.balances.map((item) => [item.code, item.company, item.currency || "EUR", item.balance]),
]));
document.querySelector("#exportStockButton").addEventListener("click", () => csvDownload("stok-listesi.csv", [
  ["SKU", "Barkod", "Ürün", "Marka", "Stok", "Birim", "Minimum stok", "Satış fiyatı", "Para birimi"],
  ...state.products.map((item) => [item.sku, item.barcode, item.name, item.brand, item.stock_quantity, item.unit, item.minimum_stock, item.sale_price, item.currency]),
]));

boot().catch((error) => {
  document.querySelector("#loginStatus").textContent = error.message || "Panel başlatılamadı.";
});
