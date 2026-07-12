const { decryptSecret } = require("./smtp-crypto");

const DEFAULT_SUPABASE_URL = "https://jhjforyykkxklfarjtjl.supabase.co";
const FIXED_SENDER_NAME = "Sidya Global Export Department";
const FIXED_SENDER_EMAIL = "export@sidyaglobal.com";
const SMTP_TIMEOUT_MS = 15_000;

const readEnv = (...names) => names.map((name) => String(process.env[name] || "").trim()).find(Boolean) || "";
const stripBearer = (value) => String(value || "").trim().replace(/^Bearer\s+/i, "").replace(/^['\"]|['\"]$/g, "").trim();
const supabaseUrl = () => (readEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL") || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
const serviceKey = () => readEnv("SUPABASE_SERVICE_ROLE_KEY", "SIDYA_SUPABASE_SERVICE_ROLE_KEY");
const json = (res, status, body) => res.status(status).json(body);
const parseBody = (req) => typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

async function rest(path, options = {}) {
  const key = serviceKey();
  if (!key) {
    const error = new Error("Sunucu yapılandırması eksik: Supabase service role key bulunamadı.");
    error.statusCode = 501;
    error.code = "SERVER_CONFIG_MISSING";
    throw error;
  }

  const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = text;
  try { data = text ? JSON.parse(text) : null; } catch (_error) {}
  if (!response.ok) {
    const error = new Error("Supabase REST isteği başarısız.");
    error.statusCode = response.status;
    error.code = "SUPABASE_REST_FAILED";
    error.safeDetails = data;
    throw error;
  }
  return data;
}

async function assertAdmin(req) {
  const token = stripBearer(req.headers.authorization);
  if (!token) {
    const error = new Error("Admin oturumu bulunamadı. Lütfen tekrar giriş yapın.");
    error.statusCode = 401;
    error.code = "ADMIN_SESSION_MISSING";
    throw error;
  }

  const key = serviceKey();
  if (!key) {
    const error = new Error("Sunucu yapılandırması eksik: Supabase service role key bulunamadı.");
    error.statusCode = 501;
    error.code = "SERVER_CONFIG_MISSING";
    throw error;
  }

  const response = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const error = new Error("Admin oturumu doğrulanamadı. Lütfen tekrar giriş yapın.");
    error.statusCode = 401;
    error.code = "ADMIN_SESSION_INVALID";
    throw error;
  }

  const user = await response.json();
  const admins = await rest(`admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`);
  if (!Array.isArray(admins) || !admins.length) {
    const error = new Error("Bu işlem için admin yetkisi gerekli.");
    error.statusCode = 403;
    error.code = "ADMIN_REQUIRED";
    throw error;
  }
  return user;
}

async function readMailSettingsRow() {
  try {
    const rows = await rest("mail_settings?id=eq.main&select=*");
    return Array.isArray(rows) && rows[0] ? rows[0] : {};
  } catch (_error) {
    return {};
  }
}

async function loadMailSettings() {
  const row = await readMailSettingsRow();
  const envPassword = readEnv("SMTP_PASSWORD", "MAIL_PASSWORD");
  const encryptedPass = envPassword ? "" : decryptSecret(row.smtp_password);
  const rawPort = readEnv("SMTP_PORT", "MAIL_PORT") || row.smtp_port || 465;
  const port = Number(rawPort) || 465;
  const secureValue = readEnv("SMTP_SECURE", "MAIL_SECURE") || row.smtp_secure;
  const secure = String(secureValue || "").toLowerCase() === "true" || port === 465;

  return {
    host: readEnv("SMTP_HOST", "MAIL_HOST") || row.smtp_host || "smtp.mx.cloudflare.net",
    port,
    secure,
    user: readEnv("SMTP_USER", "MAIL_USER") || row.smtp_user || "api_token",
    pass: envPassword || encryptedPass || "",
    senderName: FIXED_SENDER_NAME,
    senderEmail: FIXED_SENDER_EMAIL,
  };
}

async function logMail({ recipient, subject, status, errorMessage = "", source = "crm" }) {
  try {
    await rest("mail_logs", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        recipient,
        subject,
        status,
        error_message: errorMessage ? String(errorMessage).slice(0, 500) : null,
        source,
        sent_at: new Date().toISOString(),
      }),
    });
  } catch (_error) {}
}

function timeoutError() {
  const error = new Error("SMTP bağlantısı zaman aşımına uğradı. Host, port ve SSL ayarını kontrol edin.");
  error.statusCode = 504;
  error.code = "SMTP_TIMEOUT";
  return error;
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(timeoutError()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function smtpErrorInfo(error) {
  const code = String(error?.code || "").toUpperCase();
  const command = String(error?.command || "").toUpperCase();
  const responseCode = Number(error?.responseCode || 0);
  const message = String(error?.message || "");

  if (code === "SMTP_TIMEOUT" || /timeout|timed out/i.test(message)) {
    return { code: "SMTP_TIMEOUT", message: "SMTP bağlantısı zaman aşımına uğradı." };
  }
  if (code === "EAUTH" || responseCode === 534 || responseCode === 535) {
    return { code: "SMTP_AUTH_FAILED", message: "SMTP kimlik doğrulaması başarısız. API token geçersiz veya yetkisiz." };
  }
  if (code === "EENVELOPE" || command === "RCPT TO") {
    return { code: "SMTP_ENVELOPE_FAILED", message: "Alıcı adresi veya gönderim zarfı SMTP sunucusu tarafından reddedildi." };
  }
  if (command === "MAIL FROM" || responseCode === 550 || responseCode === 553) {
    return { code: "SMTP_SENDER_REJECTED", message: "Gönderen adresi veya gönderici domaini kabul edilmedi." };
  }
  if (["ECONNECTION", "ETIMEDOUT", "ESOCKET", "ECONNREFUSED", "ENOTFOUND"].includes(code)) {
    return { code: "SMTP_CONNECTION_FAILED", message: "SMTP sunucusuna bağlantı kurulamadı. Host, port ve SSL ayarını kontrol edin." };
  }
  if (/tls|ssl|certificate|handshake/i.test(message)) {
    return { code: "SMTP_TLS_FAILED", message: "TLS/SSL bağlantısı kurulamadı. Port 465 ve SSL ayarını kontrol edin." };
  }
  return { code: code || "SMTP_SEND_FAILED", message: "E-posta gönderilemedi. Mail Center SMTP ayarlarını kontrol edin." };
}

async function sendSmtpMail({ to, subject, body, source = "crm" }) {
  const nodemailer = require("nodemailer");
  const settings = await loadMailSettings();
  if (!settings.host || !settings.user || !settings.pass) {
    const message = "SMTP ayarları eksik. Mail Center ayarlarını kaydedin veya Vercel env SMTP değerlerini tanımlayın.";
    await logMail({ recipient: to, subject, status: "failed", errorMessage: message, source });
    const error = new Error(message);
    error.statusCode = 400;
    error.code = "SMTP_CONFIG_MISSING";
    throw error;
  }

  console.info("SMTP bağlantısı başlatıldı", { host: settings.host, port: settings.port, secure: settings.secure, source });
  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: { user: settings.user, pass: settings.pass },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
    dnsTimeout: 10_000,
    tls: { minVersion: "TLSv1.2" },
  });

  try {
    const result = await withTimeout(transporter.sendMail({
      from: `"${FIXED_SENDER_NAME}" <${FIXED_SENDER_EMAIL}>`,
      replyTo: FIXED_SENDER_EMAIL,
      to,
      subject,
      text: body || "",
      html: String(body || "").replace(/\n/g, "<br>"),
    }), SMTP_TIMEOUT_MS);
    console.info("SMTP mesaj kabul edildi", { messageId: result?.messageId || "", response: result?.response || "", source });
    await logMail({ recipient: to, subject, status: "sent", source });
    return result || {};
  } catch (error) {
    const info = smtpErrorInfo(error);
    console.error("SMTP send failed", { code: info.code, smtpCode: error?.code || "", command: error?.command || "", responseCode: error?.responseCode || "", source });
    await logMail({ recipient: to, subject, status: "failed", errorMessage: info.message, source });
    const safe = new Error(info.message);
    safe.statusCode = info.code === "SMTP_TIMEOUT" ? 504 : 502;
    safe.code = info.code;
    throw safe;
  }
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return json(res, 405, { ok: false, success: false, message: "POST gerekli.", code: "METHOD_NOT_ALLOWED" });
    }

    await assertAdmin(req);
    const body = parseBody(req);
    const to = String(body.to || "").trim().slice(0, 320);
    const source = ["contact_form", "quote", "crm", "order", "test"].includes(body.source) ? body.source : "crm";
    const isTest = source === "test" || body.test === true;
    const subject = String(isTest ? "Sidya Global SMTP Test" : (body.subject || "")).trim().slice(0, 300);
    const mailBody = String(isTest ? "Sidya Global Mail Center SMTP bağlantısı başarıyla çalışmaktadır." : (body.body || "")).slice(0, 20000);

    if (!to || !subject) {
      return json(res, 400, { ok: false, success: false, message: "Alıcı ve konu gerekli.", code: "VALIDATION_ERROR" });
    }

    const result = await sendSmtpMail({ to, subject, body: mailBody, source });
    return json(res, 200, {
      ok: true,
      success: true,
      message: isTest ? "Test e-postası gönderildi." : "Mail gönderildi.",
      messageId: result.messageId || "",
      sender: `${FIXED_SENDER_NAME} <${FIXED_SENDER_EMAIL}>`,
    });
  } catch (error) {
    return json(res, error.statusCode || 500, {
      ok: false,
      success: false,
      message: error.message || "Mail gönderilemedi.",
      error: error.message || "Mail gönderilemedi.",
      code: error.code || "SERVER_ERROR",
      details: error.safeDetails || null,
    });
  }
};