const crypto = require("crypto");

const INVALID_KEY_MESSAGE = "SMTP_ENCRYPTION_KEY geçersiz. 32 byte base64 veya 64 karakter hex anahtar kullanın.";
const MISSING_KEY_MESSAGE = "SMTP şifresini kullanmak için SMTP_ENCRYPTION_KEY env değeri gerekli.";

function makeError(message, statusCode = 501) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeKeyInput(raw) {
  let value = String(raw || "").trim();
  value = value.replace(/^[\'\"]|[\'\"]$/g, "").trim();
  value = value.replace(/^base64:/i, "").replace(/^hex:/i, "").trim();
  return value;
}

function parseSmtpEncryptionKey(raw) {
  const value = normalizeKeyInput(raw);
  if (!value) return null;

  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    const key = Buffer.from(value, "hex");
    if (key.length !== 32) throw makeError(INVALID_KEY_MESSAGE);
    return key;
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw makeError(INVALID_KEY_MESSAGE);
  }

  let key;
  try {
    key = Buffer.from(value, "base64");
  } catch (_error) {
    throw makeError(INVALID_KEY_MESSAGE);
  }

  const normalizedInput = value.replace(/=+$/g, "");
  const normalizedEncoded = key.toString("base64").replace(/=+$/g, "");
  if (normalizedEncoded !== normalizedInput || key.length !== 32) {
    throw makeError(INVALID_KEY_MESSAGE);
  }

  return key;
}

function readSmtpEncryptionKey(env = process.env) {
  const raw = env.SMTP_ENCRYPTION_KEY;
  if (!String(raw || "").trim()) {
    console.error("SMTP_ENCRYPTION_KEY is missing");
    return null;
  }
  return parseSmtpEncryptionKey(raw);
}

function smtpEncryptionKeyStatus(env = process.env) {
  const raw = env.SMTP_ENCRYPTION_KEY;
  if (!String(raw || "").trim()) {
    return { present: false, valid: false, error: "SMTP_ENCRYPTION_KEY is missing" };
  }
  try {
    parseSmtpEncryptionKey(raw);
    return { present: true, valid: true, error: "" };
  } catch (error) {
    console.error("SMTP_ENCRYPTION_KEY is invalid", { message: error.message });
    return { present: true, valid: false, error: INVALID_KEY_MESSAGE };
  }
}

function encryptSecret(value, key = readSmtpEncryptionKey()) {
  if (!key) throw makeError(MISSING_KEY_MESSAGE);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptSecret(value, key = readSmtpEncryptionKey()) {
  const text = String(value || "");
  if (!text) return "";
  if (!text.startsWith("enc:v1:")) return "";
  if (!key) throw makeError(MISSING_KEY_MESSAGE);

  try {
    const parts = text.split(":");
    if (parts.length !== 5) throw new Error("Invalid encrypted secret format");
    const [, , ivB64, tagB64, dataB64] = parts;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch (error) {
    console.error("SMTP password decrypt failed", { message: error.message });
    throw makeError("Kayıtlı SMTP şifresi çözülemedi. Lütfen şifreyi yeniden girip kaydedin.", 400);
  }
}

module.exports = {
  INVALID_KEY_MESSAGE,
  MISSING_KEY_MESSAGE,
  normalizeKeyInput,
  parseSmtpEncryptionKey,
  readSmtpEncryptionKey,
  smtpEncryptionKeyStatus,
  encryptSecret,
  decryptSecret,
};
