const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const index = read("index.html");
const script = read("script.js");
const admin = read("admin.js");
const backendLoader = read("backend-config.js");
const orderApi = read("api/site-order.js");
const migration = read("supabase/order_requested_pricing.sql");
const vercel = JSON.parse(read("vercel.json"));

assert(index.includes('id="proformaRequestedTotalAmount"'));
assert(index.includes('id="proformaExchangeRates"'));
assert(script.includes("getCurrentCartonPrice"));
assert(script.includes("getRequestedCartonPrice"));
assert(script.includes("proformaRequestedPrices"));
assert(script.includes("currentUnitPrice"));
assert(script.includes("requestedUnitPrice"));
assert(script.includes("priceDifference"));
assert(script.includes("discountPercentage"));
assert(script.includes("PROFORMA_PRODUCT_PAGE_SIZE"));
assert(script.includes("data-proforma-load-more"));
assert(script.includes("proformaPaginationTranslations"));
assert(!script.includes("matches.slice(0, 100)"));
assert(orderApi.includes('select=id,name,sku,barcode,unit,units_per_carton,sale_price,currency,vat_rate'));
assert(orderApi.includes('/rest/v1/site_order_items'));
assert(admin.includes("current_unit_price"));
assert(admin.includes("requested_unit_price"));
assert(admin.includes("exchange_rate_date"));
assert(!backendLoader.includes("admin-rfq-extension.js"));
assert(!backendLoader.includes("rfq-site-extension.js"));
assert(!vercel.rewrites.some((rule) => rule.source === "/request-quote"));
assert(vercel.redirects.some((rule) => rule.source === "/request-quote" && rule.destination.includes("open=proforma")));
[
  "site_order_items",
  "current_unit_price",
  "requested_unit_price",
  "current_total",
  "requested_total",
  "exchange_rate",
  "exchange_rate_date",
  "price_difference",
  "discount_percentage",
].forEach((token) => assert(migration.includes(token), `Migration token missing: ${token}`));

const calculate = (quantity, current, requested) => ({
  currentTotal: quantity * current,
  requestedTotal: quantity * requested,
  difference: quantity * requested - quantity * current,
  discount: current > 0 ? ((current - requested) / current) * 100 : 0,
});
assert.deepStrictEqual(calculate(10, 105, 100), { currentTotal: 1050, requestedTotal: 1000, difference: -50, discount: (5 / 105) * 100 });

console.log("Integrated order pricing tests passed");
