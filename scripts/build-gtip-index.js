const fs = require("fs");
const https = require("https");
const path = require("path");
const JSZip = require("jszip");
const xlsx = require("xlsx");

// Builds a reusable static GTIP search index from the official Turkish Ministry of Trade TGTC workbook.
// This is a manual/per-periodic data preparation command; the normal static build only copies the
// committed data/gtip-index.json file and never downloads from the external source.

const root = path.resolve(__dirname, "..");
const outputPath = path.join(root, "data", "gtip-index.json");
const sourceUrl = "https://ticaret.gov.tr/data/5dee4b8813b876e93804be6f/2026%20TGTC.zip";

const metadata = {
  sourceName: "T.C. Ticaret Bakanlığı - İstatistik Pozisyonlarına Bölünmüş Türk Gümrük Tarife Cetveli",
  sourceUrl,
  dataYear: "2026",
  decisionNumber: "10781",
  decisionDate: "2025-12-30",
  downloadedAt: new Date().toISOString(),
  licenseNote: "Resmi TGTC verisinden ön bilgi amaçlı statik arama indeksi üretilmiştir; bağlayıcı sınıflandırma için resmi TARA ve uzman kontrolü gerekir.",
};

const normalizeSearchText = (value) =>
  String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i")
    .replace(/\u011f/g, "g")
    .replace(/\u00fc/g, "u")
    .replace(/\u015f/g, "s")
    .replace(/\u00f6/g, "o")
    .replace(/\u00e7/g, "c")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const compactText = (value) =>
  String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeCode = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 2 || digits.length > 12) return "";
  return digits;
};

const downloadBuffer = (url) =>
  new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
          response.resume();
          downloadBuffer(new URL(response.headers.location, url).href).then(resolve, reject);
          return;
        }
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`Download failed with HTTP ${response.statusCode}`));
          return;
        }
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });

const cellLooksLikeDescription = (text) => {
  if (!text || text.length < 3) return false;
  if (/^[\d\s.,/-]+$/.test(text)) return false;
  if (/^(gtip|kod|code|pozisyon|fasıl|tarife)$/i.test(text)) return false;
  return true;
};

const extractRecordsFromRows = (rows) => {
  const records = [];
  const seen = new Set();

  rows.forEach((row) => {
    const cells = row.map(compactText).filter(Boolean);
    if (cells.length < 2) return;

    const code = cells.map(normalizeCode).find(Boolean);
    if (!code) return;

    const description = cells
      .filter((cell) => normalizeCode(cell) !== code)
      .filter(cellLooksLikeDescription)
      .sort((a, b) => b.length - a.length)[0];

    if (!description) return;
    const dedupeKey = `${code}|${description}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    records.push({
      code,
      description,
      chapter: code.length >= 2 ? code.slice(0, 2) : "",
      heading: code.length >= 4 ? code.slice(0, 4) : "",
      subheading: code.length >= 6 ? code.slice(0, 6) : "",
      search: normalizeSearchText(`${code} ${description}`),
    });
  });

  return records;
};

const main = async () => {
  console.log(`Downloading official TGTC ZIP: ${sourceUrl}`);
  const zipBuffer = await downloadBuffer(sourceUrl);
  console.log(`Downloaded ${zipBuffer.length} bytes`);

  const zip = await JSZip.loadAsync(zipBuffer);
  const workbookEntries = Object.values(zip.files)
    .filter((entry) =>
      !entry.dir &&
      /2026 TGTC\/2026 TGTC\//i.test(entry.name) &&
      /\.(xlsx|xls)$/i.test(entry.name) &&
      !path.basename(entry.name).startsWith("~$"),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  if (!workbookEntries.length) throw new Error("No tariff Excel workbook found in the official TGTC ZIP");

  console.log(`Parsing ${workbookEntries.length} tariff workbooks`);
  const allRecords = [];
  for (const workbookEntry of workbookEntries) {
    const workbookBuffer = await workbookEntry.async("nodebuffer");
    const workbook = xlsx.read(workbookBuffer, { type: "buffer", cellDates: false, raw: false });
    const workbookRecords = workbook.SheetNames.flatMap((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      return extractRecordsFromRows(rows);
    });
    allRecords.push(...workbookRecords);
  }

  const seenRecords = new Set();
  const records = allRecords
    .filter((record) => record.description && record.code)
    .filter((record) => {
      const key = `${record.code}|${record.description}`;
      if (seenRecords.has(key)) return false;
      seenRecords.add(key);
      return true;
    })
    .sort((a, b) => a.code.localeCompare(b.code, "tr") || a.description.localeCompare(b.description, "tr"));

  const payload = {
    metadata: {
      ...metadata,
      workbookFiles: workbookEntries.map((entry) => entry.name),
      recordCount: records.length,
    },
    records,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload)}\n`, "utf8");
  const size = fs.statSync(outputPath).size;
  console.log(`GTIP index written: ${path.relative(root, outputPath)}`);
  console.log(`Records: ${records.length}`);
  console.log(`Size: ${size} bytes`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

