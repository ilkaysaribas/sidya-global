const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const expectedSupabaseRef = "jhjforyykkxklfarjtjl";
const requiredFiles = [
  "index.html",
  "styles.css",
  "script.js",
  "backend-config.js",
  "sidya-locale-layout-fixes.js",
  "sidya-proforma-core-fix.js",
  "api/backend-config.js",
  "api/exchange-rates.js",
  "api/ai-assistant.js",
  "sidya-ai-assistant.js",
  "sidya-ai-assistant.css",
  "admin-ai-assistant.js",
  "lib/smtp-crypto.js",
  "sw.js",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing required file: ${file}`);
}

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const index = read("index.html");
const backendLoader = read("backend-config.js");
const worker = read("sw.js");
const proformaCore = read("sidya-proforma-core-fix.js");
const aiAssistant = read("sidya-ai-assistant.js");
const sourceFiles = fs.readdirSync(path.join(root, "api")).filter((file) => file.endsWith(".js"));

const hasVersionedScript = (file) => index.includes(`${file}?v=`);

const assertions = [
  [index.includes('data-lang="ar"'), "Arabic locale control is missing"],
  [hasVersionedScript("sidya-locale-layout-fixes.js"), "Locale module is missing or unversioned"],
  [hasVersionedScript("sidya-proforma-core-fix.js"), "Proforma module is missing or unversioned"],
  [(index.match(/\/api\/backend-config\.js/g) || []).length === 0, "Backend config is loaded twice"],
  [!backendLoader.includes("rfq-site-extension.js") && !backendLoader.includes("admin-rfq-extension.js"), "Legacy standalone RFQ extension is still active"],
  [index.includes("proformaRequestedTotalAmount") && index.includes("proformaExchangeRates"), "Integrated requested-price summary is missing"],
  [read("script.js").includes("requestedUnitPrice") && read("api/site-order.js").includes("site_order_items"), "Requested prices are not persisted through the order API"],
  [!backendLoader.includes("sidya-rtl-hero-fix.js"), "Legacy RTL hero transformer is still active"],
  [worker.includes("sidya-global-v119"), "Service worker cache version was not advanced"],
  [index.includes("Turkish Product Sourcing &amp; Export Proforma Platform"), "English SEO title is not updated"],
  [index.includes("source reliable Turkish products, request proforma offers"), "English SEO description is not updated"],
  [index.includes('id="proforma"') && index.includes('aria-hidden="true"') && index.includes("inert"), "Hidden modal accessibility state is missing"],
  [index.includes("data-nosnippet"), "Closed modal content should be marked data-nosnippet"],
  [read("script.js").includes("setHiddenPanelState"), "Modal hidden/inert state helper is missing"],
  [read("sidya-locale-layout-fixes.js").includes('"Teklif Al": "Request a Quote"'), "English exact replacement for quote CTA is missing"],
  [read("sidya-proforma-core-fix.js").includes('quote: "Request a Quote"'), "Proforma English quote label is not normalized"],
  [proformaCore.includes("syncDockVisibility") && proformaCore.includes("is-context-visible"), "Proforma dock is not scoped to the active B2B/proforma context"],
  [aiAssistant.includes("setupAssistantDrag") && aiAssistant.includes("POSITION_KEY"), "Sidya AI drag support is missing"],
  [sourceFiles.length <= 12, `Vercel Hobby function limit exceeded: ${sourceFiles.length}/12`],
];

for (const [ok, message] of assertions) {
  if (!ok) throw new Error(message);
}

if (process.env.VALIDATE_PRODUCTION_ENV === "1") {
  const publicUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const publicKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const missing = [];
  if (!publicUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!publicKey) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!serviceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
  if (!publicUrl.includes(`${expectedSupabaseRef}.supabase.co`)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL points to a different Supabase project");
  }
}

console.log(`Static production validation passed (${sourceFiles.length}/12 Vercel functions)`);

if (!index.includes('sidya-ux-upgrades.js?v=20260722-2')) throw new Error('UX upgrades script is missing.');
if (!worker.includes('sidya-global-v119')) throw new Error('Service worker cache version is stale.');





