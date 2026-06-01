const TCMB_URL = "https://www.tcmb.gov.tr/kurlar/today.xml";
const NBG_URL = "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json";

const wantedCurrencies = {
  USD: "Dolar",
  EUR: "Euro",
  AZN: "Manat",
  RUB: "Ruble",
  GEL: "Lari",
};

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

const readCurrency = (xml, code) => {
  const blockMatch = xml.match(new RegExp(`<Currency[^>]*(?:Kod|CurrencyCode)="${code}"[^>]*>([\\s\\S]*?)<\\/Currency>`));
  if (!blockMatch) return null;
  const block = blockMatch[1];
  const value = Number.parseFloat(readTag(block, "ForexSelling").replace(",", "."));
  if (!Number.isFinite(value)) return null;
  return {
    code,
    label: wantedCurrencies[code],
    name: readTag(block, "Isim") || readTag(block, "CurrencyName"),
    value,
  };
};

const readLariFromNbg = async (usdTry) => {
  const response = await fetch(NBG_URL, {
    headers: { "User-Agent": "SidyaGlobal/1.0" },
  });

  if (!response.ok) return null;

  const data = await response.json();
  const currencies = Array.isArray(data?.[0]?.currencies) ? data[0].currencies : [];
  const usdGel = currencies.find((currency) => currency.code === "USD");
  const usdGelValue = Number(usdGel?.rate);

  if (!Number.isFinite(usdGelValue) || !Number.isFinite(usdTry)) return null;

  return {
    code: "GEL",
    label: "Lari",
    name: "GEORGIAN LARI",
    value: usdTry / usdGelValue,
    crossRate: {
      source: "National Bank of Georgia",
      usdGel: usdGelValue,
      date: data?.[0]?.date || usdGel?.validFromDate || "",
    },
  };
};

module.exports = async function handler(request, response) {
  try {
    const tcmbResponse = await fetch(TCMB_URL, {
      headers: { "User-Agent": "SidyaGlobal/1.0" },
    });

    if (!tcmbResponse.ok) {
      throw new Error(`TCMB responded with ${tcmbResponse.status}`);
    }

    const xml = await tcmbResponse.text();
    const dateMatch = xml.match(/Tarih="([^"]+)"/) || xml.match(/Date="([^"]+)"/);
    const rates = Object.keys(wantedCurrencies).map((code) => readCurrency(xml, code)).filter(Boolean);
    const usd = rates.find((rate) => rate.code === "USD");

    if (usd) {
      rates.splice(2, 0, { ...usd, code: "USDTRY", label: "Dolar/TL" });
      const lari = await readLariFromNbg(usd.value);
      if (lari) rates.push(lari);
    }

    response.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
    response.status(200).json({
      source: "Türkiye Cumhuriyet Merkez Bankası + National Bank of Georgia",
      date: dateMatch ? dateMatch[1] : "",
      updatedAt: new Date().toISOString(),
      rates,
    });
  } catch (error) {
    response.setHeader("Cache-Control", "no-store");
    response.status(502).json({
      error: "TCMB exchange rates could not be loaded",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
};
