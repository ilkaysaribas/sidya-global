const SOURCES = [
  { id: "tr-tirtakip", label: "Türkiye TIR Takip", url: "https://www.tirtakip.com/" },
  { id: "tr-hopa-arhavi", label: "Hopa TIR Parkı Arhavi Liman Sıra", url: "https://www.hopatirparki.com/tirparki/arhavilimansiragumruklu.asp" },
  { id: "ge-rs-tirpark", label: "Georgia Revenue Service TIR Park", url: "https://www.rs.ge/TirPark-en" },
  { id: "az-customs-live", label: "Azerbaijan Customs Live Queue", url: "https://e.customs.gov.az/for-individuals/live-queue" },
  { id: "ru-rosgranstroy-equeue", label: "Russia Rosgranstroy Electronic Queue", url: "https://equeue.rosgranstroy.gov.ru/" },
  { id: "kz-egov-border", label: "Kazakhstan eGov Border / Customs Services", url: "https://egov.kz/cms/en/categories/customs" },
  { id: "kz-kgd", label: "Kazakhstan State Revenue Committee", url: "https://kgd.gov.kz/en" },
  { id: "ge-tariff", label: "Georgia Commodity Codes", url: "https://www.rs.ge/CommodityCodes-en" },
  { id: "az-customs", label: "Azerbaijan State Customs Committee", url: "https://e.customs.gov.az/" },
];

const checkSource = async (source) => {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const result = await fetch(source.url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "SidyaGlobal/1.0 (+https://sidyaglobal.com)" },
    });
    clearTimeout(timeout);
    return {
      ...source,
      ok: result.ok,
      status: result.status,
      responseMs: Date.now() - startedAt,
    };
  } catch (error) {
    clearTimeout(timeout);
    return {
      ...source,
      ok: false,
      status: 0,
      responseMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

module.exports = async function handler(request, response) {
  try {
    const sources = await Promise.all(SOURCES.map(checkSource));
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.status(200).json({
      updatedAt: new Date().toISOString(),
      note: "This endpoint checks official/live source availability. Queue counts and tariffs must be verified on the linked official pages.",
      sources,
    });
  } catch (error) {
    response.setHeader("Cache-Control", "no-store");
    response.status(502).json({
      error: "Logistics sources could not be checked",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
};
