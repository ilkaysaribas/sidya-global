const MAX_BODY_SIZE = 12 * 1024 * 1024;
const DEFAULT_SUPABASE_URL = "https://jhjforyykkxklfarjtjl.supabase.co";

const collectBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        reject(new Error("Request body is too large."));
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
      const content = Buffer.from(rawBody, "latin1");
      if (content.length) files.push({ filename, contentType: mimeType, content });
    } else {
      fields[name] = Buffer.from(rawBody, "latin1").toString("utf8").trim();
    }
  }

  return { fields, files };
};

const parseJsonBody = async (req) => {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  const body = await collectBody(req);
  return JSON.parse(body.toString("utf8") || "{}");
};

const readSupabaseServerEnv = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const missingEnv = [];

  if (!serviceRoleKey) missingEnv.push("SUPABASE_SERVICE_ROLE_KEY");

  return { supabaseUrl, serviceRoleKey, missingEnv };
};

const requireEnv = () => {
  const { supabaseUrl, serviceRoleKey, missingEnv } = readSupabaseServerEnv();

  if (missingEnv.length) {
    console.error(`Missing B2B registration environment variables: ${missingEnv.join(", ")}`);
    const error = new Error("B2B registration backend is missing required environment variables.");
    error.statusCode = 501;
    error.missing = missingEnv;
    throw error;
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    serviceRoleKey,
  };
};

const getEnvStatus = () => {
  const { missingEnv } = readSupabaseServerEnv();
  const required = ["SUPABASE_SERVICE_ROLE_KEY"];
  return {
    ok: missingEnv.length === 0,
    required,
    missing: missingEnv,
  };
};

const supabaseFetch = async ({ path, method = "GET", body, headers = {}, supabaseUrl, serviceRoleKey }) => {
  const response = await fetch(`${supabaseUrl}${path}`, {
    method,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...headers,
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || `Supabase request failed: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : response.text();
};

const safeStorageName = (name) =>
  String(name || "document")
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "document";

const createUser = async ({ fields, supabaseUrl, serviceRoleKey }) => {
  const email = fields.email;
  const password = fields.password;
  if (!email || !password) {
    const error = new Error("E-posta ve şifre zorunludur.");
    error.statusCode = 400;
    throw error;
  }

  const metadata = {
    company: fields.company || "",
    contact: fields.contact || "",
  };

  try {
    return await supabaseFetch({
      supabaseUrl,
      serviceRoleKey,
      path: "/auth/v1/admin/users",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      }),
    });
  } catch (error) {
    const message = String(error.message || "");
    if (!message.includes("already") && !message.includes("registered")) throw error;
    const existingUserError = new Error("Bu e-posta ile bir hesap zaten mevcut. Lütfen mevcut şifrenizle giriş yapın.");
    existingUserError.statusCode = 409;
    throw existingUserError;
  }
};

const uploadFiles = async ({ files, userId, supabaseUrl, serviceRoleKey }) => {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "b2b-documents";
  const uploadedPaths = [];

  for (const file of files) {
    const path = `${userId}/${Date.now()}-${crypto.randomUUID()}-${safeStorageName(file.filename)}`;
    await supabaseFetch({
      supabaseUrl,
      serviceRoleKey,
      path: `/storage/v1/object/${bucket}/${encodeURIComponent(path).replace(/%2F/g, "/")}`,
      method: "POST",
      headers: {
        "Content-Type": file.contentType,
        "x-upsert": "false",
      },
      body: file.content,
    });
    uploadedPaths.push(path);
  }

  return uploadedPaths;
};

const saveRequest = async ({ fields, userId = null, documentPaths, supabaseUrl, serviceRoleKey }) => {
  const rows = await supabaseFetch({
    supabaseUrl,
    serviceRoleKey,
    path: "/rest/v1/b2b_onboarding_requests",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      user_id: userId,
      company: fields.company || "",
      contact: fields.contact || "",
      email: fields.email || "",
      username: (fields.email || "").split("@")[0] || fields.email || "",
      country: fields.country || "",
      tax_number: fields.tax || "",
      incoterm: fields.incoterm || "",
      notes: fields.notes || "",
      document_paths: documentPaths,
      status: "new",
    }),
  });
  return rows?.[0];
};

module.exports = async (req, res) => {
  if (req.method === "GET") {
    const status = getEnvStatus();
    if (!status.ok) console.error(`Missing B2B registration environment variables: ${status.missing.join(", ")}`);
    res.status(status.ok ? 200 : 501).json(status);
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { supabaseUrl, serviceRoleKey } = requireEnv();
    const contentType = req.headers["content-type"] || "";
    if (contentType.includes("application/json")) {
      const fields = await parseJsonBody(req);
      const request = await saveRequest({ fields, documentPaths: [], supabaseUrl, serviceRoleKey });
      res.status(200).json({ ok: true, requestId: request?.id });
      return;
    }

    if (!contentType.includes("multipart/form-data")) {
      const invalidTypeError = new Error("Expected application/json or multipart/form-data.");
      invalidTypeError.statusCode = 415;
      throw invalidTypeError;
    }

    const body = await collectBody(req);
    const { fields, files } = parseMultipart(body, contentType);
    if (!fields.company || !fields.contact || !fields.email) {
      const validationError = new Error("Firma, yetkili ve e-posta zorunludur.");
      validationError.statusCode = 400;
      throw validationError;
    }
    const uploadFolder = `registrations/${Date.now()}-${crypto.randomUUID()}`;
    const documentPaths = await uploadFiles({ files, userId: uploadFolder, supabaseUrl, serviceRoleKey });
    const request = await saveRequest({ fields, documentPaths, supabaseUrl, serviceRoleKey });

    res.status(200).json({ ok: true, requestId: request?.id });
  } catch (error) {
    const message = String(error.message || "");
    console.error(`B2B registration failed: ${message || "Unknown error"}`);
    res.status(error.statusCode || 500).json({
      error: message || "B2B kaydı oluşturulamadı.",
      missing: Array.isArray(error.missing) ? error.missing : undefined,
    });
  }
};
