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

const jsEscape = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

const localePath = (locale) => `/${locale}/`;
const localeUrl = (locale) => `${baseUrl}${localePath(locale)}`;
const rootUrl = `${baseUrl}/`;
const brandPath = (locale, slug, brandPages) => `/${locale}/${brandPages.locales[locale]?.routeSegment || brandPages.locales.en.routeSegment}/${slug}/`;
const brandUrl = (locale, slug, brandPages) => `${baseUrl}${brandPath(locale, slug, brandPages)}`;

const extractSeoMeta = (html) => {
  const match = html.match(/const seoMeta = (\{[\s\S]*?\});\s*const normalizeLocale/);
  if (!match) throw new Error("SIDYA_SEO_META source object could not be located in index.html");
  return vm.runInNewContext(`(${match[1]})`);
};

const readContentI18n = () => {
  const source = path.join(root, "locales", "content-i18n.json");
  if (!fs.existsSync(source)) throw new Error("Missing locales/content-i18n.json");
  return JSON.parse(fs.readFileSync(source, "utf8"));
};

const readBrandPages = () => {
  const source = path.join(root, "locales", "brand-pages.json");
  if (!fs.existsSync(source)) throw new Error("Missing locales/brand-pages.json");
  return JSON.parse(fs.readFileSync(source, "utf8"));
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildContentI18nScript = (contentI18n) => `<script>
      window.SIDYA_CONTENT_I18N = ${jsEscape(contentI18n)};
    </script>`;

const injectContentI18nScript = (html, contentI18n) => {
  let outputHtml = html.replace(/\s*<script>\s*window\.SIDYA_CONTENT_I18N = [\s\S]*?<\/script>/, "");
  outputHtml = outputHtml.replace(/\s*<script src="script\.js\?v=[^"]+"><\/script>/,
    `\n    ${buildContentI18nScript(contentI18n)}\n    <script src="script.js?v=20260802-3"></script>`);
  return outputHtml;
};

const applyContentToHtml = (html, locale, contentI18n, brandPages = null) => {
  const lang = seoLocales.includes(locale) ? locale : "en";
  const dictionary = { ...(contentI18n.en || {}), ...(contentI18n[lang] || {}) };
  let outputHtml = html;
  for (const [key, value] of Object.entries(dictionary)) {
    const escapedKey = escapeRegExp(key);
    const textPattern = new RegExp(`(<([a-z][\\w:-]*)\\b[^>]*\\sdata-i18n="${escapedKey}"[^>]*>)([\\s\\S]*?)(<\\/\\2>)`, "g");
    outputHtml = outputHtml.replace(textPattern, (_match, open, _tag, _body, close) => `${open}${htmlEscape(value)}${close}`);
    const placeholderPattern = new RegExp(`(<[^>]*\\sdata-i18n-placeholder="${escapedKey}"[^>]*\\splaceholder=")[^"]*(")`, "g");
    outputHtml = outputHtml.replace(placeholderPattern, `$1${htmlEscape(value)}$2`);
    const placeholderBeforeKeyPattern = new RegExp(`(<[^>]*\\splaceholder=")[^"]*("[^>]*\\sdata-i18n-placeholder="${escapedKey}"[^>]*>)`, "g");
    outputHtml = outputHtml.replace(placeholderBeforeKeyPattern, `$1${htmlEscape(value)}$2`);
    const missingPlaceholderPattern = new RegExp(`(<[^>]*\\sdata-i18n-placeholder="${escapedKey}"[^>]*)(>)`, "g");
    outputHtml = outputHtml.replace(missingPlaceholderPattern, (match, open, close) =>
      match.includes(" placeholder=") ? match : `${open} placeholder="${htmlEscape(value)}"${close}`);
  }
  outputHtml = outputHtml.replace(/<button class="([^"]*\blang-option\b[^"]*)" type="button" data-lang="([^"]+)"/g,
    (_match, className, code) => {
      const normalized = className.replace(/\s*\bis-active\b/g, "").trim();
      const nextClass = code === lang ? `${normalized} is-active` : normalized;
      return `<button class="${nextClass}" type="button" data-lang="${code}"`;
    });
  if (brandPages) {
    outputHtml = outputHtml.replace(/<a class="firm-link" href="[^"]*" data-brand-link="([^"]+)"/g,
      (_match, slug) => `<a class="firm-link" href="${brandPath(lang, slug, brandPages)}" data-brand-link="${slug}"`);
  }
  return outputHtml;
};

const buildHreflangLinks = () => [
  ...seoLocales.map((locale) => `<link rel="alternate" hreflang="${locale}" href="${localeUrl(locale)}" />`),
  `<link rel="alternate" hreflang="x-default" href="${rootUrl}" />`,
].join("\n    ");

const buildBrandHreflangLinks = (brand, brandPages) => [
  ...seoLocales.map((locale) => `<link rel="alternate" hreflang="${locale}" href="${brandUrl(locale, brand.slug, brandPages)}" />`),
  `<link rel="alternate" hreflang="x-default" href="${brandUrl("en", brand.slug, brandPages)}" />`,
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

const applySeoToHtml = (html, locale, seoMeta, contentI18n, brandPages = null, options = {}) => {
  const lang = seoLocales.includes(locale) ? locale : "en";
  const meta = seoMeta[lang] || seoMeta.en;
  const canonical = options.root ? rootUrl : localeUrl(lang);
  const dir = rtlLocales.has(lang) ? "rtl" : "ltr";
  let outputHtml = stripQueryRedirect(html);
  outputHtml = injectContentI18nScript(outputHtml, contentI18n);
  outputHtml = applyContentToHtml(outputHtml, lang, contentI18n, brandPages);
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

const buildBrandPageHtml = (brand, locale, brandPages) => {
  const lang = seoLocales.includes(locale) ? locale : "en";
  const dir = rtlLocales.has(lang) ? "rtl" : "ltr";
  const localeCopy = brandPages.locales[lang] || brandPages.locales.en;
  const page = localeCopy.pages[brand.slug];
  if (!page) throw new Error(`Missing brand page copy for ${lang}/${brand.slug}`);
  const canonical = brandUrl(lang, brand.slug, brandPages);
  return [
    "<!doctype html>",
    `<html lang="${lang}" dir="${dir}">`,
    "  <head>",
    "    <meta charset=\"UTF-8\" />",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    `    <title>${htmlEscape(page.title)}</title>`,
    `    <meta name="description" content="${htmlEscape(page.metaDescription)}" />`,
    "    <meta name=\"robots\" content=\"index, follow\" />",
    `    <link rel="canonical" href="${canonical}" />`,
    `    ${buildBrandHreflangLinks(brand, brandPages)}`,
    `    <meta property="og:title" content="${htmlEscape(page.title)}" />`,
    `    <meta property="og:description" content="${htmlEscape(page.metaDescription)}" />`,
    "    <meta property=\"og:type\" content=\"website\" />",
    `    <meta property="og:url" content="${canonical}" />`,
    "    <link rel=\"stylesheet\" href=\"/styles.css?v=20260802-3\" />",
    "  </head>",
    `  <body class="brand-page-body">`,
    "    <main class=\"brand-page-shell\">",
    `      <a class="brand-page-back" href="/${lang}/" data-i18n="brandBackCta">${htmlEscape(localeCopy.backCta)}</a>`,
    "      <section class=\"brand-page-card\" aria-labelledby=\"brand-page-title\">",
    `        <p class="section-kicker" data-i18n="brandPageEyebrow">${htmlEscape(localeCopy.eyebrow)}</p>`,
    `        <p class="brand-page-category" data-i18n="brandPageCategory">${htmlEscape(page.categoryName || localeCopy.categoryName)}</p>`,
    `        <h1 id="brand-page-title" data-i18n="brandPageTitle">${htmlEscape(brand.name)}</h1>`,
    `        <p class="brand-page-lead" data-i18n="brandPageIntro">${htmlEscape(page.intro)}</p>`,
    `        <p data-i18n="brandPageDetails">${htmlEscape(page.details)}</p>`,
    `        <p data-i18n="brandPageLogistics">${htmlEscape(page.logistics)}</p>`,
    "        <div class=\"brand-page-actions\">",
    `          <a class="hero-action primary" href="/${lang}/?open=proforma" data-i18n="brandProformaCta">${htmlEscape(localeCopy.proformaCta)}</a>`,
    `          <a class="hero-action secondary" href="/${lang}/#contact" data-i18n="brandQuoteCta">${htmlEscape(localeCopy.quoteCta)}</a>`,
    `          <a class="brand-page-official" href="${htmlEscape(brand.officialUrl)}" target="_blank" rel="noopener" data-i18n="brandOfficialCta">${htmlEscape(localeCopy.officialCta)}</a>`,
    "        </div>",
    "      </section>",
    "    </main>",
    "  </body>",
    "</html>",
  ].join("\n");
};

const validateBrandPageHtml = (html, brand, locale, brandPages) => {
  const copy = brandPages.locales[locale] || brandPages.locales.en;
  const page = copy.pages[brand.slug];
  const checks = [
    [html.includes(`<html lang="${locale}"`), `Missing brand html lang for ${locale}/${brand.slug}`],
    [html.includes(`<title>${htmlEscape(page.title)}</title>`), `Missing brand title for ${locale}/${brand.slug}`],
    [html.includes(`href="${brandUrl(locale, brand.slug, brandPages)}"`), `Missing brand canonical/hreflang for ${locale}/${brand.slug}`],
    [html.includes(`data-i18n="brandPageTitle">${htmlEscape(brand.name)}`), `Missing brand visible title for ${locale}/${brand.slug}`],
    [html.includes(`data-i18n="brandPageIntro">${htmlEscape(page.intro)}`), `Missing brand intro for ${locale}/${brand.slug}`],
    [html.includes(`data-i18n="brandOfficialCta">${htmlEscape(copy.officialCta)}`), `Missing official CTA for ${locale}/${brand.slug}`],
    [html.includes(brand.officialUrl), `Missing official URL for ${locale}/${brand.slug}`],
  ];
  for (const [ok, message] of checks) if (!ok) throw new Error(message);
};
const validateLocalizedHtml = (html, locale, seoMeta, contentI18n, options = {}) => {
  const meta = seoMeta[locale] || seoMeta.en;
  const copy = { ...(contentI18n.en || {}), ...(contentI18n[locale] || {}) };
  const canonical = options.root ? rootUrl : localeUrl(locale);
  const checks = [
    [new RegExp(`<html[^>]*lang="${locale}"`).test(html), `Missing html lang for ${locale}`],
    [html.includes(`<title>${htmlEscape(meta.title)}</title>`), `Missing localized title for ${locale}`],
    [html.includes(`content="${htmlEscape(meta.description)}"`), `Missing localized description for ${locale}`],
    [html.includes(`property="og:title" content="${htmlEscape(meta.ogTitle || meta.title)}"`), `Missing localized og:title for ${locale}`],
    [html.includes(`property="og:url" content="${canonical}"`), `Missing localized og:url for ${locale}`],
    [seoLocales.every((code) => html.includes(`hreflang="${code}" href="${localeUrl(code)}"`)), `Incomplete hreflang tags for ${locale}`],
    [html.includes(`hreflang="x-default" href="${rootUrl}"`), `Missing x-default hreflang for ${locale}`],
    [html.includes(htmlEscape(copy.heroTitle)), `Missing localized hero body for ${locale}`],
    [html.includes(htmlEscape(copy.navProducts)), `Missing localized nav body for ${locale}`],
    [html.includes(htmlEscape(copy.footerText)), `Missing localized footer body for ${locale}`],
    [html.includes(htmlEscape(copy.gtipTitle)), "Missing localized GTIP body"],
    [html.includes(htmlEscape(copy.customsPlannerTitle)), "Missing localized route planner body"],
    [html.includes(htmlEscape(copy.customsDocsTitle)), "Missing localized customs output body"],
    [html.includes(htmlEscape(copy.marketsTitle)), "Missing localized target markets title"],
    [html.includes(htmlEscape(copy.marketGeorgia)) && html.includes(htmlEscape(copy.marketKazakhstan)), "Missing localized target market country names"],
    [html.includes(htmlEscape(copy.b2bRegisterTitle)) && html.includes(htmlEscape(copy.b2bChecklistTitle)), "Missing localized B2B registration modal body"],
    [html.includes(htmlEscape(copy.customerDashboardTitle)) && html.includes(htmlEscape(copy.customerHistoryEmpty)), "Missing localized customer portal modal body"],
    [html.includes(htmlEscape(copy.catalogProformaTitle)) && html.includes(htmlEscape(copy.catalogProformaViewSummary)), "Missing localized category proforma modal body"],
    [html.includes(`data-i18n-placeholder="catalogProformaSearchPlaceholder" placeholder="${htmlEscape(copy.catalogProformaSearchPlaceholder)}"`) || html.includes(`placeholder="${htmlEscape(copy.catalogProformaSearchPlaceholder)}" data-i18n-placeholder="catalogProformaSearchPlaceholder"`), "Missing localized category proforma search placeholder"],
    [locale === "ar" ? /<html[^>]*dir="rtl"/.test(html) : /<html[^>]*dir="ltr"/.test(html), `Missing localized direction for ${locale}`],
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
const contentI18n = readContentI18n();
const brandPages = readBrandPages();
const rootIndex = applySeoToHtml(sourceIndex, "en", seoMeta, contentI18n, brandPages, { root: true });
fs.writeFileSync(indexPath, rootIndex, "utf8");
validateLocalizedHtml(rootIndex, "en", seoMeta, contentI18n, { root: true });

for (const locale of seoLocales) {
  const localizedDir = path.join(output, locale);
  fs.mkdirSync(localizedDir, { recursive: true });
  const localizedHtml = applySeoToHtml(sourceIndex, locale, seoMeta, contentI18n, brandPages);
  fs.writeFileSync(path.join(localizedDir, "index.html"), localizedHtml, "utf8");
  validateLocalizedHtml(localizedHtml, locale, seoMeta, contentI18n);
}

const sitemapUrls = [rootUrl, ...seoLocales.map(localeUrl)];
for (const brand of brandPages.brands) {
  for (const locale of seoLocales) {
    const localizedDir = path.join(output, locale, brandPages.locales[locale]?.routeSegment || brandPages.locales.en.routeSegment, brand.slug);
    fs.mkdirSync(localizedDir, { recursive: true });
    const brandHtml = buildBrandPageHtml(brand, locale, brandPages);
    fs.writeFileSync(path.join(localizedDir, "index.html"), brandHtml, "utf8");
    validateBrandPageHtml(brandHtml, brand, locale, brandPages);
    sitemapUrls.push(brandUrl(locale, brand.slug, brandPages));
  }
}
const sitemap = [
  "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
  "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
  ...sitemapUrls.map((url) => `  <url><loc>${htmlEscape(url)}</loc></url>`),
  "</urlset>",
  "",
].join("\n");
fs.writeFileSync(path.join(output, "sitemap.xml"), sitemap, "utf8");

console.log(`Static output generated in public/ with localized SEO pages: ${seoLocales.map((locale) => `/${locale}/`).join(", ")} and ${brandPages.brands.length * seoLocales.length} brand pages`);
