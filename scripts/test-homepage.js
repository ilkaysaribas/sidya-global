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
check(index.includes('class="site-container">\n          <div class="section-heading products-section-heading"'), "Product section must use the shared container.");
check(index.includes('id="productCatalogSearch"'), "Published product search is missing.");
check(index.includes("script.js?v=20260715-3"), "Homepage script cache key is stale.");
check(index.includes("styles.css?v=20260715-3"), "Homepage stylesheet cache key is stale.");

const renderStart = script.indexOf("const renderProducts = () => {");
const renderEnd = script.indexOf("\nconst renderMarkets =", renderStart);
check(renderStart >= 0 && renderEnd > renderStart, "Product renderer could not be located.");
const renderSource = script.slice(renderStart, renderEnd);
check(renderSource.includes("getPublishedHomepageProducts"), "Homepage must render published products.");
check(!renderSource.includes("products[currentLang]"), "Homepage still renders category definitions instead of products.");
check(renderSource.includes("catalog-product-card"), "Individual product cards are not rendered.");
check(script.includes("await waitForBackendConfig()"), "Published catalog must wait for dynamic backend configuration.");
check(script.includes('db.rpc("get_public_catalog_products"'), "Homepage catalog is not connected to the safe public RPC.");
check(!script.includes('db.from("site_catalog_prices")'), "Homepage still uses the 92-row published price table.");
check(script.includes("p_limit: 48"), "Catalog pagination must request 48 products at a time.");
check(script.includes("publishedCatalogUi.totalCount"), "Catalog must expose the complete active product count.");
check(script.includes('publishedCatalogUi.state = "ready";'), "Product grid is not refreshed after catalog loading.");
check(script.includes("loadPublishedCatalogPrices({ reset: true })"), "Catalog search must restart server-side pagination.");
check(script.includes('publishedCatalogUi.state = "error";'), "Catalog loading errors need a visible fallback.");
check(script.includes('data-catalog-product-id'), "Product cards must connect to the proforma flow.");

check(styles.includes('html[dir="ltr"] .hero-content'), "LTR hero alignment guard is missing.");
check(styles.includes("text-align: left !important"), "LTR content must be forced to the left.");
check(styles.includes('html[dir="rtl"] .hero-content'), "RTL alignment guard is missing.");
check(styles.includes("text-align: right !important"), "RTL content must remain right aligned.");
check(styles.includes(".catalog-product-card"), "Product card styles are missing.");
check(styles.includes("@media (max-width: 768px)"), "Mobile product layout is missing.");
check(worker.includes('sidya-global-v103'), "Service worker cache version must be v103.");
check(worker.includes("script.js?v=20260715-3"), "Service worker caches an old homepage script.");
check(worker.includes("styles.css?v=20260715-3"), "Service worker caches an old stylesheet.");
check(worker.includes('url.pathname === "/script.js"'), "Homepage script must use network-first cache handling.");
check(worker.includes('url.pathname === "/styles.css"'), "Homepage stylesheet must use network-first cache handling.");

check((index.match(/<div\b/g) || []).length === (index.match(/<\/div>/g) || []).length, "HTML div tags are unbalanced.");
check((index.match(/<section\b/g) || []).length === (index.match(/<\/section>/g) || []).length, "HTML section tags are unbalanced.");

console.log(`Homepage regression test passed (${checks.length} checks)`);
