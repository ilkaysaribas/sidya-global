const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const index = read("index.html");
const script = read("script.js");
const styles = read("styles.css");
const worker = read("sw.js");

new vm.Script(script, { filename: "script.js" });

const checks = [];
const check = (condition, message) => {
  checks.push({ condition: Boolean(condition), message });
  if (!condition) throw new Error(message);
};

check(/<html\s+lang=["']en["']/.test(index), "Homepage must start in English.");
check(index.includes('class="site-container hero-layout"'), "Hero must use the shared container.");
check(/class="site-container">\s*<div class="section-heading products-section-heading"/.test(index), "Category section must use the shared container.");
check(index.includes('id="productGrid"'), "Homepage category grid is missing.");
check(!index.includes('id="productCatalogSearch"'), "Individual product search must not appear on the homepage.");
check(!index.includes('id="catalogLoadMore"'), "Individual product pagination must not appear on the homepage.");
check(index.includes("script.js?v=20260715-4"), "Homepage script cache key is stale.");
check(index.includes("styles.css?v=20260715-4"), "Homepage stylesheet cache key is stale.");

const renderStart = script.indexOf("const renderProducts = () => {");
const renderEnd = script.indexOf("\nconst renderMarkets =", renderStart);
check(renderStart >= 0 && renderEnd > renderStart, "Category renderer could not be located.");
const renderSource = script.slice(renderStart, renderEnd);
check(renderSource.includes("products[currentLang]"), "Homepage must render the original product categories.");
check(renderSource.includes("product-card product-card-"), "Original category cards are not rendered.");
check(renderSource.includes("related-companies"), "Catalog and supplier links are missing from category cards.");
check(renderSource.includes("sampleCatalogCta"), "Original catalog links are not rendered.");
check(!renderSource.includes("catalog-product-card"), "Individual products are still rendered on the homepage.");

check(script.includes('db.rpc("get_public_catalog_products"'), "Proforma is not connected to the safe full catalog RPC.");
check(!script.includes('db.from("site_catalog_prices")'), "The obsolete 92-row price source is still queried.");
check(script.includes("const pageSize = 250"), "Full catalog pagination is missing.");
check(script.includes("while (offset < totalCount)"), "Proforma must load every catalog page.");
check(script.includes("rows.forEach(upsertPublicCatalogProduct)"), "Full catalog rows are not added to the proforma selector.");
check(script.includes("PROFORMA_PRODUCT_PAGE_SIZE = 100"), "Default proforma rendering must stay bounded.");
check(script.includes("data-proforma-load-more"), "Full proforma catalog needs a load-more control.");
check(script.includes("filteredProductCount"), "Proforma must expose the total matching product count.");
check(!script.includes("productCatalogSearchTimer"), "Homepage product search handler is still active.");
check(!script.includes("publishedHomepageProducts"), "Homepage product state is still active.");

check(styles.includes("Homepage categories restored"), "Restored category layout styles are missing.");
check(styles.includes('html[dir="ltr"] main :where('), "LTR alignment guard is missing.");
check(styles.includes("text-align: left !important"), "LTR content must be forced left.");
check(styles.includes('html[dir="rtl"] main :where('), "RTL alignment guard is missing.");
check(styles.includes("text-align: right !important"), "RTL content must remain right aligned.");
check(worker.includes("sidya-global-v115"), "Service worker cache version must be v115.");
check(worker.includes("script.js?v=20260715-4"), "Service worker caches an old homepage script.");
check(worker.includes("styles.css?v=20260715-4"), "Service worker caches an old stylesheet.");
check(worker.includes('url.pathname === "/script.js"'), "Homepage script must use network-first cache handling.");
check(worker.includes('url.pathname === "/styles.css"'), "Homepage stylesheet must use network-first cache handling.");

check((index.match(/<div\b/g) || []).length === (index.match(/<\/div>/g) || []).length, "HTML div tags are unbalanced.");
check((index.match(/<section\b/g) || []).length === (index.match(/<\/section>/g) || []).length, "HTML section tags are unbalanced.");

console.log(`Homepage regression test passed (${checks.length} checks)`);
