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

const mojibakePattern = /[\u00c3\u00c2]|\u00e2[\u0080-\u009f]/;
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
check(index.includes("script.js?v=20260801-2"), "Homepage script cache key is stale.");
check(index.includes("SIDYA_SEO_META"), "Language-specific SEO metadata map is missing.");
["tr", "en", "az", "ka", "ru", "ar"].forEach((locale) => {
  check(index.includes('"' + locale + '": {'), "SEO metadata is missing for locale: " + locale);
  check(index.includes('hreflang="' + locale + '" href="https://www.sidyaglobal.com/?lang=' + locale + '"'), "hreflang is missing for locale: " + locale);
});
check(index.includes('hreflang="x-default" href="https://www.sidyaglobal.com/?lang=en"'), "x-default hreflang is missing.");
check(index.includes('window.applySidyaSeoMeta'), "Runtime SEO updater is missing.");
check(script.includes('window.applySidyaSeoMeta?.(currentLang)'), "Language switch must refresh SEO metadata.");
check(!mojibakePattern.test(index), "Homepage contains mojibake text.");
check(index.includes("Build: 20260801-2 - Environment: production"), "Production build label must be shown.");
check(!index.includes("Environment: development") && !index.includes("Build: local"), "Development build label must not be exposed.");
check(index.includes("styles.css?v=20260722-2"), "Homepage stylesheet cache key is stale.");

const renderStart = script.indexOf("const renderProducts = () => {");
const renderEnd = script.indexOf("\nconst renderMarkets =", renderStart);
check(renderStart >= 0 && renderEnd > renderStart, "Category renderer could not be located.");
const renderSource = script.slice(renderStart, renderEnd);
check(renderSource.includes("getLocalizedProductCategories()"), "Homepage must render product categories through the safe locale accessor.");
check(renderSource.includes("product-card product-card-"), "Original category cards are not rendered.");
check(renderSource.includes("related-companies"), "Catalog and supplier links are missing from category cards.");
check(renderSource.includes("sampleCatalogCta"), "Original catalog links are not rendered.");
check(!renderSource.includes("catalog-product-card"), "Individual products are still rendered on the homepage.");
check(renderSource.includes("try {") && renderSource.includes("renderProducts critical error"), "Category renderer must be protected by try/catch.");
check(renderSource.includes("Product render error. Index"), "A broken product must not crash the full homepage.");
check(renderSource.includes("Product category list is empty or invalid"), "Invalid product data must show a safe empty state.");
check(script.includes("const asSafeArray") && script.includes("Array.isArray(value)"), "Array map inputs must be normalized with Array.isArray.");
check(script.includes("translatePage renderProducts failed"), "translatePage must not crash if product rendering fails.");

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
check(worker.includes("sidya-global-v128"), "Service worker cache version must be v128.");
check(worker.includes("script.js?v=20260801-2"), "Service worker caches an old homepage script.");
check(worker.includes("styles.css?v=20260722-2"), "Service worker caches an old stylesheet.");
check(worker.includes('url.pathname === "/script.js"'), "Homepage script must use network-first cache handling.");
check(worker.includes('url.pathname === "/styles.css"'), "Homepage stylesheet must use network-first cache handling.");check(index.includes("Turkish Product Sourcing &amp; Export Proforma Platform"), "English SEO title must describe sourcing and proforma.");
check(index.includes("source reliable Turkish products, request proforma offers"), "English SEO description is missing.");
check(index.includes('aria-hidden="true"') && index.includes("inert") && index.includes("data-nosnippet"), "Closed panels must be hidden from assistive tech and snippets.");
check(script.includes("setHiddenPanelState"), "Modal open/close accessibility helper is missing.");
check(read("sidya-locale-layout-fixes.js").includes('"Teklif Al": "Request a Quote"'), "English locale must replace stale Turkish quote CTA.");
check(read("sidya-proforma-core-fix.js").includes('quote: "Request a Quote"'), "Proforma core English quote label is stale.");

check((index.match(/<div\b/g) || []).length === (index.match(/<\/div>/g) || []).length, "HTML div tags are unbalanced.");
check((index.match(/<section\b/g) || []).length === (index.match(/<\/section>/g) || []).length, "HTML section tags are unbalanced.");

console.log(`Homepage regression test passed (${checks.length} checks)`);

check(!index.includes('sidya-ux-upgrades.js?v=20260722-2'), 'UX upgrades script must not block homepage loading.');
