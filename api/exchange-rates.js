const TCMB_URL = "https://www.tcmb.gov.tr/kurlar/today.xml";

const wantedCurrencies = {
  USD: "Amerikan Doları",
  EUR: "Euro",
  GEL: "Gürcistan Larisi",
  RUB: "Rus Rublesi",
};

const RATE_FIELD_PRIORITY = ["ForexSelling", "BanknoteSelling", "ForexBuying"];
const CACHE_SETTING_ID = "main";
const CACHE_KEY = "exchange_rates";

const decodeXml = (value = "") =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

const readTag = (block, tag) => {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match ? decodeXml(match[1].trim()) : "";
};

const toPositiveNumber = (value = "") => {
  const normalized = String(value).trim().replace(/\s/g, "").replace(",", ".");
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const parseTcmbDate = (value = "") => {
  const raw = String(value || "").trim();
  const dot = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dot) return `${dot[3]}-${dot[2]}-${dot[1]}`;
  const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slash) return `${slash[3]}-${slash[1]}-${slash[2]}`;
  return raw;
};

const readCurrencyBlock = (xml, code) => {
  const blockMatch = xml.match(new RegExp(`<Currency[^>]*(?:Kod|CurrencyCode)="${code}"[^>]*>([\\s\\S]*?)<\\/Currency>`));
  return blockMatch ? blockMatch[1] : "";
};

const readCurrency = (xml, code) => {
  const block = readCurrencyBlock(xml, code);
  if (!block) throw new Error(`TCMB currency code not found: ${code}`);

  const unit = toPositiveNumber(readTag(block, "Unit")) || 1;
  let selectedField = "";
  let rawValue = null;

  for (const field of RATE_FIELD_PRIORITY) {
    const candidate = toPositiveNumber(readTag(block, field));
    if (candidate) {
      selectedField = field;
      rawValue = candidate;
      break;
    }
  }

  if (!rawValue) throw new Error(`TCMB rate value not found: ${code}`);

  const value = rawValue / unit;
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid TCMB rate for ${code}`);

  return {
    code,
    label: wantedCurrencies[code],
    name: readTag(block, "Isim") || readTag(block, "CurrencyName") || wantedCurrencies[code],
    value,
    unit,
    rawValue,
    sourceField: selectedField,
  };
};

const validateRates = (rates) => {
  const required = Object.keys(wantedCurrencies);
  for (const code of required) {
    const value = rates[code];
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid exchange rate: ${code}`);
  }

  if (rates.USD < 5 || rates.USD > 250) throw new Error("USD/TRY rate is outside safe range");
  if (rates.EUR < 5 || rates.EUR > 300) throw new Error("EUR/TRY rate is outside safe range");
  if (rates.EUR < rates.USD * 0.5) throw new Error("EUR/TRY rate is inconsistent with USD/TRY");
  if (rates.RUB < 0.01 || rates.RUB > 10) throw new Error("RUB/TRY rate is outside safe range");
  if (rates.GEL < 0.5 || rates.GEL > 100) throw new Error("GEL/TRY rate is outside safe range");
};

const supabaseConfig = () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
  key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SIDYA_SUPABASE_SERVICE_ROLE_KEY || "",
});

const supabaseRequest = async (path, options = {}) => {
  const { url, key } = supabaseConfig();
  if (!url || !key) return null;
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/${path}`;
  const result = await fetch(endpoint, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!result.ok) throw new Error(`Supabase cache request failed: ${result.status}`);
  if (result.status === 204) return null;
  return result.json();
};

const readCachedPayload = async () => {
  try {
    const rows = await supabaseRequest(`app_settings?id=eq.${encodeURIComponent(CACHE_SETTING_ID)}&select=invoice_template`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const template = Array.isArray(rows) ? rows[0]?.invoice_template : rows?.invoice_template;
    const cached = template?.[CACHE_KEY];
    if (!cached?.rates) return null;
    validateRates(cached.rates);
    return { ...cached, warning: "Son geçerli kur gösteriliyor" };
  } catch (error) {
    console.warn("Exchange rate cache read failed", error.message || error);
    return null;
  }
};

const writeCachedPayload = async (payload) => {
  try {
    const rows = await supabaseRequest(`app_settings?id=eq.${encodeURIComponent(CACHE_SETTING_ID)}&select=invoice_template`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const current = (Array.isArray(rows) ? rows[0]?.invoice_template : rows?.invoice_template) || {};
    await supabaseRequest(`app_settings?id=eq.${encodeURIComponent(CACHE_SETTING_ID)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        invoice_template: {
          ...current,
          [CACHE_KEY]: payload,
        },
        updated_at: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.warn("Exchange rate cache write failed", error.message || error);
  }
};

const buildPayloadFromXml = (xml) => {
  const dateMatch = xml.match(/Tarih="([^"]+)"/) || xml.match(/Date="([^"]+)"/);
  const rateList = Object.keys(wantedCurrencies).map((code) => readCurrency(xml, code));
  const rates = rateList.reduce((acc, item) => {
    acc[item.code] = item.value;
    return acc;
  }, {});
  validateRates(rates);

  return {
    ok: true,
    base: "TRY",
    source: "TCMB",
    sourceUrl: TCMB_URL,
    rate_type: "ForexSelling",
    rate_field_priority: RATE_FIELD_PRIORITY,
    date: parseTcmbDate(dateMatch ? dateMatch[1] : ""),
    fetched_at: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rates,
    rateList,
    missing: Object.keys(wantedCurrencies).filter((code) => !rates[code]),
  };
};

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    const tcmbResponse = await fetch(TCMB_URL, {
      headers: { "User-Agent": "SidyaGlobal/1.0" },
    });

    if (!tcmbResponse.ok) {
      throw new Error(`TCMB responded with ${tcmbResponse.status}`);
    }

    const xml = await tcmbResponse.text();
    const payload = buildPayloadFromXml(xml);
    await writeCachedPayload(payload);
    response.status(200).json(payload);
  } catch (error) {
    const cached = await readCachedPayload();
    if (cached) {
      response.status(200).json({
        ...cached,
        ok: true,
        fallback: true,
        error: "TCMB exchange rates could not be loaded",
        detail: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    response.status(502).json({
      ok: false,
      source: "TCMB",
      error: "TCMB exchange rates could not be loaded",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
};