const TCMB_URL = "https://www.tcmb.gov.tr/kurlar/today.xml";
const NBG_URL = "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json";

const wantedCurrencies = {
  USD: "Amerikan DolarÄ±",
  EUR: "Euro",
  GEL: "GÃ¼rcistan Larisi",
  RUB: "Rus Rublesi",
  AZN: "Azerbaycan ManatÄ±",
  SAR: "Suudi Arabistan Riyali",
  AED: "BirleÅŸik Arap Emirlikleri Dirhemi",
  QAR: "Katar Riyali",
  KWD: "Kuveyt DinarÄ±",
  BHD: "Bahreyn DinarÄ±",
  OMR: "Umman Riyali",
};

const REQUIRED_TCMB_CODES = ["USD", "EUR", "RUB"];
const RATE_FIELD_PRIORITY = ["ForexSelling", "BanknoteSelling", "ForexBuying"];
const USD_CROSS_RATES = {
  AZN: 1.7,
  SAR: 3.75,
  AED: 3.6725,
  QAR: 3.64,
  KWD: 0.307,
  BHD: 0.376,
  OMR: 0.3845,
};
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
  if (!block) return null;

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

  if (!rawValue) return null;

  const value = rawValue / unit;
  if (!Number.isFinite(value) || value <= 0) return null;

  return {
    code,
    label: wantedCurrencies[code],
    name: readTag(block, "Isim") || readTag(block, "CurrencyName") || wantedCurrencies[code],
    value,
    unit,
    rawValue,
    sourceField: selectedField,
    source: "TCMB",
  };
};

const readGelFromNbg = async (usdTry) => {
  try {
    const response = await fetch(NBG_URL, { headers: { "User-Agent": "SidyaGlobal/1.0" } });
    if (!response.ok) return null;
    const data = await response.json();
    const currencies = Array.isArray(data?.[0]?.currencies) ? data[0].currencies : [];
    const usdGel = currencies.find((currency) => currency.code === "USD");
    const usdGelValue = toPositiveNumber(usdGel?.rate);
    if (!usdGelValue || !usdTry) return null;
    return {
      code: "GEL",
      label: wantedCurrencies.GEL,
      name: "GEORGIAN LARI",
      value: usdTry / usdGelValue,
      unit: 1,
      rawValue: usdGelValue,
      sourceField: "USD/GEL cross-rate",
      source: "NBG",
      sourceDate: data?.[0]?.date || usdGel?.validFromDate || "",
    };
  } catch (error) {
    console.warn("NBG GEL fallback failed", error.message || error);
    return null;
  }
};

const buildUsdCrossRateFallback = (code, usdTry) => {
  const usdCrossRate = USD_CROSS_RATES[code];
  if (!usdCrossRate || !usdTry) return null;
  return {
    code,
    label: wantedCurrencies[code],
    name: wantedCurrencies[code],
    value: usdTry / usdCrossRate,
    unit: 1,
    rawValue: usdCrossRate,
    sourceField: `USD/${code} cross-rate`,
    source: "USD cross-rate fallback",
  };
};

const validateRates = (rates) => {
  for (const code of REQUIRED_TCMB_CODES) {
    const value = rates[code];
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid exchange rate: ${code}`);
  }

  if (rates.USD < 5 || rates.USD > 250) throw new Error("USD/TRY rate is outside safe range");
  if (rates.EUR < 5 || rates.EUR > 300) throw new Error("EUR/TRY rate is outside safe range");
  if (rates.EUR < rates.USD * 0.5) throw new Error("EUR/TRY rate is inconsistent with USD/TRY");
  if (rates.RUB < 0.01 || rates.RUB > 10) throw new Error("RUB/TRY rate is outside safe range");
  if (rates.GEL !== undefined && (rates.GEL < 0.5 || rates.GEL > 100)) throw new Error("GEL/TRY rate is outside safe range");
  if (rates.AZN !== undefined && (rates.AZN < 1 || rates.AZN > 150)) throw new Error("AZN/TRY rate is outside safe range");
  for (const code of ["SAR", "AED", "QAR"]) {
    if (rates[code] !== undefined && (rates[code] < 1 || rates[code] > 100)) throw new Error(`${code}/TRY rate is outside safe range`);
  }
  for (const code of ["KWD", "BHD", "OMR"]) {
    if (rates[code] !== undefined && (rates[code] < 10 || rates[code] > 500)) throw new Error(`${code}/TRY rate is outside safe range`);
  }
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
    return { ...cached, warning: "Son geÃ§erli kur gÃ¶steriliyor" };
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

const buildPayloadFromXml = async (xml) => {
  const dateMatch = xml.match(/Tarih="([^"]+)"/) || xml.match(/Date="([^"]+)"/);
  const rateList = [];
  const missing = [];

  for (const code of Object.keys(wantedCurrencies)) {
    const item = readCurrency(xml, code);
    if (item) rateList.push(item);
    else missing.push(code);
  }

  const rates = rateList.reduce((acc, item) => {
    acc[item.code] = item.value;
    return acc;
  }, {});

  for (const code of REQUIRED_TCMB_CODES) {
    if (!rates[code]) throw new Error(`TCMB currency code not found: ${code}`);
  }

  if (!rates.GEL) {
    const gel = await readGelFromNbg(rates.USD);
    if (gel) {
      rates.GEL = gel.value;
      rateList.push(gel);
    }
  }

  for (const code of Object.keys(USD_CROSS_RATES)) {
    if (!rates[code]) {
      const fallback = buildUsdCrossRateFallback(code, rates.USD);
      if (fallback) {
        rates[code] = fallback.value;
        rateList.push(fallback);
      }
    }
  }

  validateRates(rates);

  return {
    ok: true,
    base: "TRY",
    source: missing.some((code) => code === "GEL" || USD_CROSS_RATES[code]) ? "TCMB + regional cross-rate fallback" : "TCMB",
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
  response.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const tcmbResponse = await fetch(TCMB_URL, {
      headers: { "User-Agent": "SidyaGlobal/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!tcmbResponse.ok) {
      throw new Error(`TCMB responded with ${tcmbResponse.status}`);
    }

    const xml = await tcmbResponse.text();
    const payload = await buildPayloadFromXml(xml);
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

