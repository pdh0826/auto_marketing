import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const BLOGGER_SECRET_KEY_ENV = "BLOGGER_SECRET_ENCRYPTION_KEY";
const BLOGGER_SECRET_VERSION = "v1";
const REDACTED = "[REDACTED]";

const TOKEN_VALUE_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\bya29\.[A-Za-z0-9._-]+/gi,
  /\baccess_token\s*=\s*[^&\s]+/gi,
  /\brefresh_token\s*=\s*[^&\s]+/gi,
  /\bclient_secret\s*=\s*[^&\s]+/gi
];

export function getBloggerSecretLast4(value: string) {
  const trimmed = value.trim();
  return trimmed.length <= 4 ? trimmed : trimmed.slice(-4);
}

export function isBloggerSecretEncryptionConfigured() {
  return Boolean(process.env[BLOGGER_SECRET_KEY_ENV]);
}

export function encryptBloggerSecret(value: string) {
  const key = getBloggerEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encryptedValue: [BLOGGER_SECRET_VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":"),
    keyVersion: BLOGGER_SECRET_VERSION
  };
}

export function decryptBloggerSecret(encryptedValue: string) {
  const key = getBloggerEncryptionKey();
  const [version, iv, tag, ciphertext] = encryptedValue.split(":");

  if (version !== BLOGGER_SECRET_VERSION || !iv || !tag || !ciphertext) {
    throw new Error("Unsupported Blogger encrypted secret format.");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}

export function runBloggerSecretSelfTest() {
  const keyConfigured = isBloggerSecretEncryptionConfigured();

  if (!keyConfigured) {
    return {
      keyConfigured,
      selfTestPassed: false,
      keyVersion: BLOGGER_SECRET_VERSION,
      message: `${BLOGGER_SECRET_KEY_ENV} is not configured. Token exchange remains disabled.`
    };
  }

  const plaintext = `blogger-secret-self-test-${randomBytes(12).toString("hex")}`;
  const encrypted = encryptBloggerSecret(plaintext);
  const decrypted = decryptBloggerSecret(encrypted.encryptedValue);

  return {
    keyConfigured,
    selfTestPassed: decrypted === plaintext,
    keyVersion: encrypted.keyVersion,
    message: decrypted === plaintext ? "Blogger token encryption self-test passed." : "Blogger token encryption self-test failed."
  };
}

export function redactBloggerSecretText(value: string) {
  return TOKEN_VALUE_PATTERNS.reduce((text, pattern) => text.replace(pattern, REDACTED), value)
    .replace(/(token\s*(?:is|=|:)?\s*)(["']?)[A-Za-z0-9._~+/=-]{12,}(["']?)/gi, `$1$2${REDACTED}$3`)
    .replace(/(secret\s*(?:is|=|:)?\s*)(["']?)[A-Za-z0-9._~+/=-]{12,}(["']?)/gi, `$1$2${REDACTED}$3`)
    .replace(/(authorization\s*(?:is|=|:)?\s*)(["']?)[A-Za-z0-9._~+/=-]{12,}(["']?)/gi, `$1$2${REDACTED}$3`);
}

export function safeBloggerSecretError(value: string, maxLength = 240) {
  const redacted = redactBloggerSecretText(value);
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}...` : redacted;
}

function getBloggerEncryptionKey() {
  const rawKey = process.env[BLOGGER_SECRET_KEY_ENV];
  if (!rawKey) {
    throw new Error(`${BLOGGER_SECRET_KEY_ENV} is required for Blogger token storage.`);
  }

  return createHash("sha256").update(rawKey).digest();
}
