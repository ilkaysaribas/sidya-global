const fs = require("fs");
const path = require("path");
const vm = require("vm");

require("./validate-static");
require("./test-homepage");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "public");
const staticDirectories = ["assets", "templates"];
const staticExtensions = new Set([".html", ".js", ".css", ".json", ".xml", ".txt", ".webmanifest", ".svg", ".ico"]);
const excludedFiles = new Set(["package.json", "package-lock.json", "vercel.json"]);
const baseUrl = "https://www.sidyaglobal.com";
const seoLocales = ["tr", "en", "az", "ka", "ru", "ar"];
const rtlLocales = new Set(["ar"]);

const htmlEscape = (value) => String(value || "")
  .replace(/&/g, "&amp;")
  .replace(/"/g, "&quot;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");

const localePath = (locale) => `/${locale}/`;
const localeUrl = (locale) => `${baseUrl}${localePath(locale)}`;
const rootUrl = `${baseUrl}/`;

const extractSeoMeta = (html) => {
  const match = html.match(/const seoMeta = (\{[\s\S]*?\});\s*const normalizeLocale/);
  if (!match) throw new Error("SIDYA_SEO_META source object could not be located in index.html");
  return vm.runInNewContext(`(${match[1]})`);
};

const buildHreflangLinks = () => [
  ...seoLocales.map((locale) => `<link rel="alternate" hreflang="${locale}" href="${localeUrl(locale)}" />`),
  `<link rel="alternate" hreflang="x-default" href="${rootUrl}" />`,
].join("\n    ");

const queryRedirectScript = `<script>
    (function () {
      const supportedLocales = ${JSON.stringify(seoLocales)};
      const params = new URLSearchParams(window.location.search);
      const lang = String(params.get("lang") || "").toLowerCase().replace("_", "-").split("-")[0];
      if (window.location.pathname === "/" && supportedLocales.includes(lang)) {
        params.delete("lang");
        const target = new URL("/" + lang + "/", window.location.origin);
        const rest = params.toString();
        if (rest) target.search = rest;
        window.location.replace(target.href + window.location.hash);
      }
    })();
    </script>`;

const stripQueryRedirect = (html) => html.replace(/\s*<script>\s*\(function \(\) \{[\s\S]*?window\.location\.replace\(target\.href \+ window\.location\.hash\);[\s\S]*?\}\)\(\);\s*<\/script>/, "");

const applySeoToHtml = (html, locale, seoMeta, options = {}) => {
  const lang = seoLocales.includes(locale) ? locale : "en";
  const meta = seoMeta[lang] || seoMeta.en;
  const canonical = options.root ? rootUrl : localeUrl(lang);
  const dir = rtlLocales.has(lang) ? "rtl" : "ltr";
  let outputHtml = stripQueryRedirect(html);
  outputHtml = outputHtml.replace(/<html([^>]*)>/, (match, attrs) => {
    const cleanAttrs = attrs.replace(/\s+lang="[^"]*"/i, "").replace(/\s+dir="[^"]*"/i, "");
    return `<html${cleanAttrs} lang="${lang}" dir="${dir}">`;
  });
  outputHtml = outputHtml.replace(/<title>[\s\S]*?<\/title>/, `<title>${htmlEscape(meta.title)}</title>`);
  outputHtml = outputHtml.replace(/<meta\s+name="description"\s+content="[\s\S]*?"\s*\/?>/, `<meta name="description" content="${htmlEscape(meta.description)}" />`);
  outputHtml = outputHtml.replace(/<meta name="keywords" content="[^"]*"\s*\/?>/, `<meta name="keywords" content="${htmlEscape(meta.keywords)}" />`);
  outputHtml = outputHtml.replace(/<link rel="canonical" href="[^"]*"\s*\/>(?:\s*<link rel="alternate" hreflang="[^"]+" href="[^"]+" \/>)*/,
    `<link rel="canonical" href="${canonical}" />\n    ${buildHreflangLinks()}`);
  outputHtml = outputHtml.replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${htmlEscape(meta.ogTitle || meta.title)}" />`);
  outputHtml = outputHtml.replace(/<meta\s+property="og:description"\s+content="[\s\S]*?"\s*\/?>/, `<meta property="og:description" content="${htmlEscape(meta.ogDescription || meta.description)}" />`);
  outputHtml = outputHtml.replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${canonical}" />`);
  outputHtml = outputHtml.replace(/<meta name="twitter:card" content="summary_large_image" \/>(?:\s*<meta name="twitter:title" content="[^"]*" \/>)?(?:\s*<meta name="twitter:description" content="[^"]*" \/>)?/,
    `<meta name="twitter:card" content="summary_large_image" />\n    <meta name="twitter:title" content="${htmlEscape(meta.ogTitle || meta.title)}" />\n    <meta name="twitter:description" content="${htmlEscape(meta.ogDescription || meta.description)}" />`);
  if (options.root && !outputHtml.includes("window.location.replace(target.href + window.location.hash)")) {
    outputHtml = outputHtml.replace(/<meta name="yandex-verification" content="" data-tracking-placeholder="yandex-webmaster" \/>/,
      `<meta name="yandex-verification" content="" data-tracking-placeholder="yandex-webmaster" />\n    ${queryRedirectScript}`);
  }
  return outputHtml;
};

const validateLocalizedHtml = (html, locale, seoMeta, options = {}) => {
  const meta = seoMeta[locale] || seoMeta.en;
  const canonical = options.root ? rootUrl : localeUrl(locale);
  const checks = [
    [new RegExp(`<html[^>]*lang="${locale}"`).test(html), `Missing html lang for ${locale}`],
    [html.includes(`<title>${htmlEscape(meta.title)}</title>`), `Missing localized title for ${locale}`],
    [html.includes(`content="${htmlEscape(meta.description)}"`), `Missing localized description for ${locale}`],
    [html.includes(`property="og:title" content="${htmlEscape(meta.ogTitle || meta.title)}"`), `Missing localized og:title for ${locale}`],
    [html.includes(`property="og:url" content="${canonical}"`), `Missing localized og:url for ${locale}`],
    [seoLocales.every((code) => html.includes(`hreflang="${code}" href="${localeUrl(code)}"`)), `Incomplete hreflang tags for ${locale}`],
    [html.includes(`hreflang="x-default" href="${rootUrl}"`), `Missing x-default hreflang for ${locale}`],
  ];
  for (const [ok, message] of checks) if (!ok) throw new Error(message);
};

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (!entry.isFile() || excludedFiles.has(entry.name)) continue;
  if (!staticExtensions.has(path.extname(entry.name))) continue;
  fs.copyFileSync(path.join(root, entry.name), path.join(output, entry.name));
}

for (const directory of staticDirectories) {
  const source = path.join(root, directory);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(output, directory), { recursive: true });
}

const indexPath = path.join(output, "index.html");
const sourceIndex = fs.readFileSync(indexPath, "utf8");
const seoMeta = extractSeoMeta(sourceIndex);
const rootIndex = applySeoToHtml(sourceIndex, "en", seoMeta, { root: true });
fs.writeFileSync(indexPath, rootIndex, "utf8");
validateLocalizedHtml(rootIndex, "en", seoMeta, { root: true });

for (const locale of seoLocales) {
  const localizedDir = path.join(output, locale);
  fs.mkdirSync(localizedDir, { recursive: true });
  const localizedHtml = applySeoToHtml(sourceIndex, locale, seoMeta);
  fs.writeFileSync(path.join(localizedDir, "index.html"), localizedHtml, "utf8");
  validateLocalizedHtml(localizedHtml, locale, seoMeta);
}

console.log(`Static output generated in public/ with localized SEO pages: ${seoLocales.map((locale) => `/${locale}/`).join(", ")}`);
