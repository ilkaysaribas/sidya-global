const MAX_BODY_SIZE = 8 * 1024 * 1024;
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MAX_FILES = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 8;
const requestBuckets = new Map();

const getClientIp = (req) =>
  String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();

const rateLimit = (req) => {
  const key = getClientIp(req);
  const now = Date.now();
  const bucket = requestBuckets.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  bucket.count += 1;
  requestBuckets.set(key, bucket);
  if (requestBuckets.size > 500) {
    for (const [entryKey, entry] of requestBuckets) {
      if (entry.resetAt <= now) requestBuckets.delete(entryKey);
    }
  }
  return bucket.count <= RATE_LIMIT_MAX;
};

const cleanText = (value, maxLength = 2000) =>
  String(value || "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);

const collectBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        const error = new Error("Request body is too large.");
        error.statusCode = 413;
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

const parseMultipart = (buffer, contentType) => {
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2];
  if (!boundary) throw new Error("Missing multipart boundary.");
  const raw = buffer.toString("latin1");
  const parts = raw.split(`--${boundary}`).slice(1, -1);
  const fields = {};
  const files = [];

  for (const part of parts) {
    const cleanPart = part.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const separatorIndex = cleanPart.indexOf("\r\n\r\n");
    if (separatorIndex === -1) continue;
    const rawHeaders = cleanPart.slice(0, separatorIndex);
    const rawBody = cleanPart.slice(separatorIndex + 4);
    const disposition = rawHeaders.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] || "";
    const name = disposition.match(/name="([^"]+)"/i)?.[1];
    const filename = disposition.match(/filename="([^"]*)"/i)?.[1];
    const mimeType = rawHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1] || "application/octet-stream";
    if (!name) continue;

    if (filename) {
      const fileBuffer = Buffer.from(rawBody, "latin1");
      if (fileBuffer.length > MAX_FILE_SIZE) {
        const error = new Error("Uploaded file is too large.");
        error.statusCode = 413;
        throw error;
      }
      if (fileBuffer.length && files.length < MAX_FILES) {
        files.push({
          filename: cleanText(filename, 180),
          contentType: cleanText(mimeType, 120) || "application/octet-stream",
          content: fileBuffer.toString("base64"),
        });
      }
    } else {
      fields[name] = cleanText(Buffer.from(rawBody, "latin1").toString("utf8"), name === "notes" ? 4000 : 500);
    }
  }

  return { fields, files };
};

const sendResendEmail = async ({ fields, files }) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const error = new Error("RESEND_API_KEY is not configured.");
    error.statusCode = 501;
    throw error;
  }

  const to = process.env.B2B_TO_EMAIL || "info@sidyaglobal.com";
  const from = process.env.B2B_FROM_EMAIL || "Sidya Global <onboarding@sidyaglobal.com>";
  const subject = `B2B buyer onboarding - ${fields.company || "New request"}`;
  const text = [
    "Sidya Global B2B buyer onboarding",
    "",
    `Company: ${fields.company || "-"}`,
    `Authorized contact: ${fields.contact || "-"}`,
    `Email: ${fields.email || "-"}`,
    `Username: ${fields.username || "-"}`,
    `Destination country: ${fields.country || "-"}`,
    `Tax / registration number: ${fields.tax || "-"}`,
    `Incoterm: ${fields.incoterm || "-"}`,
    "",
    "Password: Created by buyer and not included in this email for security.",
    "",
    "Notes:",
    fields.notes || "-",
    "",
    "Uploaded files:",
    ...(files.length ? files.map((file, index) => `${index + 1}. ${file.filename}`) : ["No file uploaded"]),
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      attachments: files.map((file) => ({
        filename: file.filename,
        content: file.content,
        content_type: file.contentType,
      })),
    }),
  });

  if (!response.ok) {
    const error = new Error("B2B email provider rejected the request.");
    error.statusCode = response.status >= 500 ? 502 : response.status;
    throw error;
  }
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!rateLimit(req)) {
    res.status(429).json({ error: "Too many requests. Please try again later." });
    return;
  }

  try {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) throw new Error("Expected multipart/form-data.");
    const body = await collectBody(req);
    const parsed = parseMultipart(body, contentType);
    await sendResendEmail(parsed);
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.statusCode && error.statusCode < 500 ? error.message : "B2B request failed." });
  }
};