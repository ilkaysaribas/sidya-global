const DEFAULT_SUPABASE_URL = "https://jhjforyykkxklfarjtjl.supabase.co";
const MAX_BODY_SIZE = 128 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 12;
const requestBuckets = new Map();

const readEnv = (...names) => {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }
  return "";
};

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

const getAllowedOrigin = (req) => {
  const origin = String(req.headers.origin || "");
  if (!origin) return "";
  try {
    const host = new URL(origin).hostname;
    if (host === "sidyaglobal.com" || host === "www.sidyaglobal.com" || host.endsWith(".vercel.app")) return origin;
  } catch (_error) {
    return "";
  }
  return "";
};

const setCorsHeaders = (req, res) => {
  const origin = getAllowedOrigin(req);
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

const readBody = (req) =>
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

const cleanText = (value, maxLength = 4000) =>
  String(value || "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);

const parseMultipart = (buffer, contentType) => {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) return {};
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const raw = buffer.toString("utf8");
  const fields = {};

  for (const part of raw.split(`--${boundary}`)) {
    if (!part || part === "--\r\n" || part === "--") continue;
    const [rawHeaders, ...bodyParts] = part.split("\r\n\r\n");
    if (!rawHeaders || !bodyParts.length) continue;
    const nameMatch = rawHeaders.match(/name="([^"]+)"/i);
    if (!nameMatch) continue;
    const value = bodyParts.join("\r\n\r\n").replace(/\r\n--$/, "").replace(/\r\n$/, "");
    fields[nameMatch[1]] = value;
  }

  return fields;
};

const parseRequestBody = async (req) => {
  const contentType = String(req.headers["content-type"] || "");
  const buffer = await readBody(req);
  if (!buffer.length) return {};

  if (contentType.includes("application/json")) {
    return JSON.parse(buffer.toString("utf8"));
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(buffer.toString("utf8")));
  }

  if (contentType.includes("multipart/form-data")) {
    return parseMultipart(buffer, contentType);
  }

  return {};
};

const writeInformationMessage = async (payload) => {
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL") || DEFAULT_SUPABASE_URL;
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY", "SIDYA_SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceRoleKey) {
    const error = new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
    error.statusCode = 501;
    throw error;
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/information_messages`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_error) {
    data = null;
  }

  if (!response.ok) {
    const error = new Error("Information message could not be saved.");
    error.statusCode = response.status;
    throw error;
  }

  return data;
};

module.exports = async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  if (!rateLimit(req)) {
    res.status(429).json({ ok: false, error: "Too many requests. Please try again later." });
    return;
  }

  try {
    const body = await parseRequestBody(req);
    const product = cleanText(body.product, 200);
    const message = cleanText(body.message);
    const payload = {
      name: cleanText(body.name, 200),
      email: cleanText(body.email, 320),
      phone: cleanText(body.phone, 80),
      company: cleanText(body.company, 240),
      message: product ? `Product: ${product}\n\n${message}` : message,
      source: cleanText(body.source || (product ? `quote-form:${product}` : "quote-form"), 240),
    };

    if (!payload.email && !payload.phone) {
      res.status(400).json({ ok: false, error: "Email or phone is required." });
      return;
    }

    if (!payload.message) {
      res.status(400).json({ ok: false, error: "Message is required." });
      return;
    }

    const data = await writeInformationMessage(payload);
    res.status(200).json({ ok: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.statusCode && error.statusCode < 500 ? error.message : "Information message failed.",
    });
  }
};