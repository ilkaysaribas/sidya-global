const TCMB_URL = "https://www.tcmb.gov.tr/kurlar/today.xml";
const RATE_FIELDS = ["ForexSelling", "BanknoteSelling", "ForexBuying"];
const WANTED = {
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  RUB: "Russian Ruble",
  AZN: "Azerbaijani Manat",
};
const USD_CROSS = {
  GEL: { value: 2.72, name: "Georgian Lari", source: "USD/GEL regional fallback" },
  AED: { value: 3.6725, name: "UAE Dirham", source: "USD/AED cross-rate fallback" },
  SAR: { value: 3.75, name: "Saudi Riyal", source: "USD/SAR cross-rate fallback" },
  QAR: { value: 3.64, name: "Qatari Riyal", source: "USD/QAR cross-rate fallback" },
  KWD: { value: 0.307, name: "Kuwaiti Dinar", source: "USD/KWD cross-rate fallback" },
};

const decodeXml = (value = "") => value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const tag = (block, name) => {
  const match = block.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`));
  return match ? decodeXml(match[1].trim()) : "";
};
const number = (value) => {
  const parsed = Number.parseFloat(String(value || "").trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const blockFor = (xml, code) => {
  const match = xml.match(new RegExp(`<Currency[^>]*(?:Kod|CurrencyCode)="${code}"[^>]*>([\\s\\S]*?)<\\/Currency>`));
  return match ? match[1] : "";
};
const parseDate = (xml) => {
  const raw = (xml.match(/Tarih="([^"]+)"/) || xml.match(/Date="([^"]+)"/) || [])[1] || "";
  const dot = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dot) return `${dot[3]}-${dot[2]}-${dot[1]}`;
  return raw;
};
const parseCurrency = (xml, code) => {
  const block = blockFor(xml, code);
  if (!block) return null;
  const unit = number(tag(block, "Unit")) || 1;
  let raw = null;
  let sourceField = "";
  for (const field of RATE_FIELDS) {
    raw = number(tag(block, field));
    if (raw) {
      sourceField = field;
      break;
    }
  }
  if (!raw) return null;
  const value = raw / unit;
  return {
    code,
    label: WANTED[code] || code,
    name: tag(block, "CurrencyName") || tag(block, "Isim") || WANTED[code] || code,
    value,
    unit,
    rawValue: raw,
    source: "TCMB",
    sourceField,
  };
};
const validate = (rates) => {
  if (!(rates.USD > 5 && rates.USD < 250)) throw new Error("Invalid USD/TRY rate");
  if (!(rates.EUR > 5 && rates.EUR < 300)) throw new Error("Invalid EUR/TRY rate");
};

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8500);
  try {
    const tcmb = await fetch(TCMB_URL, {
      signal: controller.signal,
      headers: { "User-Agent": "SidyaGlobal/1.0" },
    });
    if (!tcmb.ok) throw new Error(`TCMB responded with ${tcmb.status}`);
    const xml = await tcmb.text();
    const rateList = Object.keys(WANTED).map((code) => parseCurrency(xml, code)).filter(Boolean);
    const rates = Object.fromEntries(rateList.map((item) => [item.code, item.value]));
    validate(rates);
    Object.entries(USD_CROSS).forEach(([code, fallback]) => {
      if (!rates[code] && rates.USD) {
        rates[code] = rates.USD / fallback.value;
        rateList.push({
          code,
          label: fallback.name,
          name: fallback.name,
          value: rates[code],
          unit: 1,
          rawValue: fallback.value,
          source: fallback.source,
          sourceField: fallback.source,
        });
      }
    });
    response.status(200).json({
      ok: true,
      base: "TRY",
      source: rateList.some((item) => item.source !== "TCMB") ? "TCMB + cross-rate fallback" : "TCMB",
      sourceUrl: TCMB_URL,
      rate_type: "ForexSelling",
      date: parseDate(xml),
      updatedAt: new Date().toISOString(),
      rates,
      rateList,
    });
  } catch (error) {
    response.status(502).json({
      ok: false,
      source: "TCMB",
      error: "Exchange rates are currently unavailable.",
      detail: error instanceof Error ? error.message : String(error),
      updatedAt: new Date().toISOString(),
      rates: {},
      rateList: [],
    });
  } finally {
    clearTimeout(timeout);
  }
};
