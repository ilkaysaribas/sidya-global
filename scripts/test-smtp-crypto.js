const assert = require("assert");
const crypto = require("crypto");
const {
  parseSmtpEncryptionKey,
  encryptSecret,
  decryptSecret,
} = require("../lib/smtp-crypto");

const key = crypto.randomBytes(32);
const hex = key.toString("hex");
const base64 = key.toString("base64");

assert.strictEqual(parseSmtpEncryptionKey(hex).length, 32, "64 char hex key should be accepted");
assert.strictEqual(parseSmtpEncryptionKey(hex.toUpperCase()).length, 32, "uppercase hex key should be accepted");
assert.strictEqual(parseSmtpEncryptionKey(base64).length, 32, "32 byte base64 key should be accepted");
assert.strictEqual(parseSmtpEncryptionKey(`  ${base64}\n`).length, 32, "trimmed base64 key should be accepted");
assert.strictEqual(parseSmtpEncryptionKey(`"${base64}"`).length, 32, "quoted base64 key should be accepted after trimming quotes");
assert.strictEqual(parseSmtpEncryptionKey(`base64:${base64}`).length, 32, "base64: prefix should be accepted");
assert.strictEqual(parseSmtpEncryptionKey(`hex:${hex}`).length, 32, "hex: prefix should be accepted");

assert.throws(() => parseSmtpEncryptionKey("a".repeat(62)), /SMTP_ENCRYPTION_KEY geçersiz/, "62 char alphanumeric key should be rejected");
assert.throws(() => parseSmtpEncryptionKey("not-valid-base64***"), /SMTP_ENCRYPTION_KEY geçersiz/, "invalid base64 should be rejected");
assert.throws(() => parseSmtpEncryptionKey(Buffer.from("short").toString("base64")), /SMTP_ENCRYPTION_KEY geçersiz/, "base64 decoded length other than 32 should be rejected");

const encrypted = encryptSecret("smtp-secret-value", key);
assert.notStrictEqual(encrypted.includes("smtp-secret-value"), true, "encrypted value must not contain plaintext");
assert.strictEqual(decryptSecret(encrypted, key), "smtp-secret-value", "encrypt/decrypt round trip should work");

console.log("SMTP crypto tests passed");
