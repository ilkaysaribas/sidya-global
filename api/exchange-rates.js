const TCMB_URL = "https://www.tcmb.gov.tr/kurlar/today.xml";

const wantedCurrencies = {
  USD: "Amerikan Doları",
  EUR: "Euro",
  GEL: "Gürcistan Larisi",
  RUB: "Rus Rublesi",
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

const toNumber = (value = "") => {
  const number = Number.parseFloat(String(value).trim().replace(",", "."));
  return Number.isFinite(number) && number > 0 ? number : null;
};

const readCurrency = (xml, code) => {
  const blockMatch = xml.match(new RegExp(`<Currency[^>]*(?:Kod|CurrencyCode)="${code}"[^>]*>([\\s\\S]*?)<\\/Currency>`));
  if (!blockMatch) return null;

  const block = blockMatch[1];
  const value =
    toNumber(readTag(block, "ForexSelling")) ??
    toNumber(readTag(block, "BanknoteSelling")) ??
    toNumber(readTag(block, "ForexBuying"));

  if (!value) return null;

  return {
    code,
    label: wantedCurrencies[code],
    name: readTag(block, "Isim") || readTag(block, "CurrencyName") || wantedCurrencies[code],
    value,
    sourceField: readTag(block, "ForexSelling") ? "ForexSelling" : readTag(block, "BanknoteSelling") ? "BanknoteSelling" : "ForexBuying",
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
    const parsed = Object.keys(wantedCurrencies)
      .map((code) => readCurrency(xml, code))
      .filter(Boolean);

    const rates = parsed.reduce((acc, item) => {
      acc[item.code] = item.value;
      return acc;
    }, {});

    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.status(200).json({
      source: "TCMB",
      sourceUrl: TCMB_URL,
      date: dateMatch ? dateMatch[1] : "",
      updatedAt: new Date().toISOString(),
      rates,
      rateList: parsed,
      missing: Object.keys(wantedCurrencies).filter((code) => !rates[code]),
    });
  } catch (error) {
    response.setHeader("Cache-Control", "no-store");
    response.status(502).json({
      source: "TCMB",
      error: "TCMB exchange rates could not be loaded",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
};
