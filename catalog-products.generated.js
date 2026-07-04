window.catalog = window.catalog || [];
window.CATALOG_PRODUCTS = window.CATALOG_PRODUCTS || window.catalog;

(function () {
  function ensureInvoiceCompatibility() {
    var form = document.querySelector("#invoiceForm");
    if (form && !form.elements.discount_rate) {
      form.insertAdjacentHTML("beforeend", '<input type="hidden" name="discount_rate" value="0" />');
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureInvoiceCompatibility);
  else ensureInvoiceCompatibility();
  setTimeout(ensureInvoiceCompatibility, 0);
})();

var importCatalog = async function () {
  var source = window.catalog || window.CATALOG_PRODUCTS || window.SIDYA_CATALOG_PRODUCTS || window.catalogProducts || [];
  if (!Array.isArray(source) || !source.length) {
    setStatus("Katalog dosyası boş. Mevcut ürünler korunuyor.");
    return;
  }
  var rows = source.map(function (item) {
    return {
      catalog_id: item.id || item.catalog_id || item.sku || item.barcode,
      sku: item.sku || item.barcode || item.id,
      barcode: item.barcode || null,
      name: (item.names && (item.names.tr || item.names.en)) || item.name || item.id,
      brand: item.brand || null,
      category: item.sourceCategory || item.category || null,
      grammage: item.liter || item.grammage || null,
      unit: "adet",
      units_per_carton: Number(item.unitsPerCarton || item.units_per_carton || 1),
      kg_per_carton: Number(item.kgPerCarton || item.kg_per_carton || 0),
      currency: "USD",
      vat_rate: typeof inferVatRate === "function" ? inferVatRate(item) : 20,
      active: true,
      updated_at: new Date().toISOString(),
    };
  }).filter(function (row) { return row.catalog_id && row.name; });
  setStatus(rows.length + " katalog ürünü aktarılıyor...");
  for (var index = 0; index < rows.length; index += 250) {
    await query(client.from("products").upsert(rows.slice(index, index + 250), { onConflict: "catalog_id" }));
  }
  await loadData();
  setStatus(rows.length + " ürün güncel katalogdan aktarıldı.");
};

var publishSiteData = async function () {
  var publishableProducts = state.products.filter(function (item) {
    return item.active !== false && Number(item.sale_price || 0) > 0;
  });
  if (!publishableProducts.length) throw new Error("Satış fiyatı girilmiş aktif ürün bulunamadı.");
  var rows = publishableProducts.map(function (item) {
    return {
      publish_key: item.catalog_id || "product-" + item.id,
      catalog_id: item.catalog_id || null,
      barcode: item.barcode || item.sku || null,
      name: item.name,
      brand: item.brand || null,
      category: item.category || null,
      grammage: item.grammage || null,
      sale_price: Number(item.sale_price || 0),
      currency: item.currency || "USD",
      units_per_carton: Math.max(Number(item.units_per_carton || 1), 1),
      cartons_per_pallet: null,
      kg_per_carton: Number(item.kg_per_carton || 0) || null,
      active: true,
      updated_by: state.session && state.session.user ? state.session.user.id : null,
      updated_at: new Date().toISOString(),
    };
  });
  setStatus(rows.length + " ürünün satış bilgileri siteye gönderiliyor...");
  for (var index = 0; index < rows.length; index += 250) {
    await query(client.from("site_catalog_prices").upsert(rows.slice(index, index + 250), { onConflict: "publish_key" }));
  }
  setStatus(rows.length + " ürünün satış fiyatı ve koli bilgisi online siteye gönderildi. Mevcut ürünler silinmedi/pasife alınmadı.");
};

var saveProductPrices = async function (event) {
  event.preventDefault();
  var form = event.currentTarget;
  var productId = form.elements.product_id.value;
  var product = state.products.find(function (item) { return item.id === productId; });
  if (!product) throw new Error("Ürün kaydı bulunamadı.");
  var purchasePrice = convertToUsd(form.elements.purchase_price.value, form.elements.purchase_currency.value);
  var salePrice = convertToUsd(form.elements.sale_price.value, form.elements.sale_currency.value);
  await query(client.from("products").update({ purchase_price: purchasePrice, sale_price: salePrice, currency: "USD", updated_at: new Date().toISOString() }).eq("id", product.id).select("id"));
  document.querySelector("#productPriceDialog").close();
  await loadData();
  setStatus(product.name + " fiyatları güncellendi.");
};

var openProductPriceDialog = function (productId) {
  var product = state.products.find(function (item) { return item.id === productId; });
  if (!product) throw new Error("Ürün kaydı bulunamadı.");
  var form = document.querySelector("#productPriceForm");
  form.reset();
  form.elements.product_id.value = product.id;
  form.elements.purchase_price.value = Number(product.purchase_price || 0);
  form.elements.sale_price.value = Number(product.sale_price || 0);
  form.elements.purchase_currency.value = "USD";
  form.elements.sale_currency.value = "USD";
  document.querySelector("#productPriceTitle").textContent = ((product.brand || "") + " " + product.name).trim();
  var info = document.querySelector("#priceRateInfo");
  if (info) info.textContent = "Kayıtta ana fiyat USD olarak saklanır.";
  if (typeof refreshProductPricePreviews === "function") refreshProductPricePreviews();
  document.querySelector("#productPriceDialog").showModal();
};

var openProductStockMovement = function (productId, direction) {
  var product = state.products.find(function (item) { return item.id === productId; });
  if (!product) throw new Error("Ürün kaydı bulunamadı.");
  var form = document.querySelector("#stockForm");
  form.reset();
  form.dataset.direction = direction;
  if (typeof renderInvoiceOptions === "function") renderInvoiceOptions();
  form.elements.product_id.value = productId;
  document.querySelector("#stockDialogTitle").textContent = direction === "in" ? "Manuel stok girişi" : "Manuel stok çıkışı";
  document.querySelector("#stockQuantityLabel").childNodes[0].textContent = direction === "in" ? "Giriş miktarı (adet)" : "Çıkış miktarı (adet)";
  document.querySelector("#saveStockMovementButton").textContent = direction === "in" ? "Stoğa ekle" : "Stoktan çıkar";
  document.querySelector("#stockDialog").showModal();
};

var openProductHistory = async function (productId) {
  var product = state.products.find(function (item) { return item.id === productId; });
  if (!product) throw new Error("Ürün kaydı bulunamadı.");
  alert(product.name + "\nMevcut stok: " + Number(product.stock_quantity || 0));
};

var openCustomerHistory = async function (customerId) {
  var customer = state.customers.find(function (item) { return item.id === customerId; });
  if (!customer) throw new Error("Cari kaydı bulunamadı.");
  alert(customer.company || "Cari hareketleri");
};

var deleteCustomer = async function (customerId) {
  var customer = state.customers.find(function (item) { return item.id === customerId; });
  if (!customer || !confirm((customer.company || "Cari") + " silinsin mi?")) return;
  await query(client.from("customers").delete().eq("id", customerId).select("id"));
  state.selectedCustomers.delete(customerId);
  await loadData();
  setStatus("Cari silindi.");
};

var deleteIncomingOrder = async function (orderId) {
  var order = state.orders.find(function (item) { return item.id === orderId; });
  if (!order || !confirm("Sipariş silinsin mi?")) return;
  await query(client.from("site_orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", orderId).select("id"));
  await loadData();
  setStatus("Sipariş silindi.");
};
