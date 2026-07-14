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
const sourceFiles = fs.readdirSync(path.join(root, "api")).filter((file) => file.endsWith(".js"));

const hasVersionedScript = (file) => index.includes(`${file}?v=`);

const assertions = [
  [index.includes('data-lang="ar"'), "Arabic locale control is missing"],
  [hasVersionedScript("sidya-locale-layout-fixes.js"), "Locale module is missing or unversioned"],
  [hasVersionedScript("sidya-proforma-core-fix.js"), "Proforma module is missing or unversioned"],
  [(index.match(/\/api\/backend-config\.js/g) || []).length === 0, "Backend config is loaded twice"],
  [!backendLoader.includes("rfq-site-extension.js"), "Legacy standalone RFQ extension is still active"],
  [!backendLoader.includes("sidya-rtl-hero-fix.js"), "Legacy RTL hero transformer is still active"],
  [worker.includes("sidya-global-v100"), "Service worker cache version was not advanced"],
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
