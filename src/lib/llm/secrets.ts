import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const SECRET_KEY_ENV = "LLM_SECRET_ENCRYPTION_KEY";
const SECRET_VERSION = "v1";

export function getSecretLast4(value: string) {
  const trimmed = value.trim();
  return trimmed.length <= 4 ? trimmed : trimmed.slice(-4);
}

export function encryptSecret(value: string) {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encryptedValue: [SECRET_VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":"),
    keyVersion: SECRET_VERSION
  };
}

export function decryptSecret(encryptedValue: string) {
  const key = getEncryptionKey();
  const [version, iv, tag, ciphertext] = encryptedValue.split(":");

  if (version !== SECRET_VERSION || !iv || !tag || !ciphertext) {
    throw new Error("Unsupported encrypted secret format.");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}

function getEncryptionKey() {
  const rawKey = process.env[SECRET_KEY_ENV];
  if (!rawKey) {
    throw new Error(`${SECRET_KEY_ENV} is required for secret storage and provider tests.`);
  }

  return createHash("sha256").update(rawKey).digest();
}
