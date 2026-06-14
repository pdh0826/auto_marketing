import type { BloggerConnectionStatus } from "@/lib/blogger/admin-types";

export const BLOGGER_CONNECTION_STATUSES: BloggerConnectionStatus[] = ["not_configured", "configured", "oauth_required", "connected", "expired", "error"];

const SENSITIVE_INPUT_KEYS = new Set([
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "clientSecret",
  "client_secret",
  "encryptedValue",
  "apiKey",
  "api_key",
  "bearer"
].map((key) => key.toLowerCase()));

const SENSITIVE_VALUE_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/i,
  /\baccess_token\s*=\s*[^&\s]+/i,
  /\brefresh_token\s*=\s*[^&\s]+/i,
  /\bclient_secret\s*=\s*[^&\s]+/i,
  /\bya29\.[A-Za-z0-9._-]+/i
];

export function rejectSensitiveBloggerInput(data: Record<string, unknown>) {
  const sensitiveKey = Object.keys(data).find((key) => SENSITIVE_INPUT_KEYS.has(key.toLowerCase()));
  if (sensitiveKey) {
    throw new Error(`Sensitive field "${sensitiveKey}" is not accepted in Patch 9A Blogger settings.`);
  }

  const sensitiveValueKey = Object.entries(data).find(([, value]) => hasSensitiveValue(value))?.[0];
  if (sensitiveValueKey) {
    throw new Error(`Sensitive token or secret value is not accepted in "${sensitiveValueKey}".`);
  }
}

export function normalizeBloggerConnectionInput(data: Record<string, unknown>) {
  rejectSensitiveBloggerInput(data);

  const status = optionalStatus(data.status);
  const scopes = Array.isArray(data.scopes)
    ? data.scopes.map((scope) => String(scope).trim()).filter(Boolean)
    : typeof data.scopes === "string"
      ? data.scopes.split(/[\n,]/).map((scope) => scope.trim()).filter(Boolean)
      : undefined;

  return {
    blogId: optionalString(data.blogId),
    name: requiredString(data.name, "Connection name is required."),
    status: status ?? "not_configured",
    bloggerBlogId: optionalString(data.bloggerBlogId),
    bloggerBlogName: optionalString(data.bloggerBlogName),
    connectedEmail: optionalString(data.connectedEmail),
    scopes,
    clientSecretRef: optionalString(data.clientSecretRef),
    hasClientSecret: optionalBoolean(data.hasClientSecret) ?? false,
    hasAccessToken: optionalBoolean(data.hasAccessToken) ?? false,
    hasRefreshToken: optionalBoolean(data.hasRefreshToken) ?? false,
    tokenLast4: normalizeLast4(data.tokenLast4),
    lastError: sanitizeBloggerText(data.lastError, "lastError")
  };
}

export function normalizeBloggerConnectionPatchInput(data: Record<string, unknown>) {
  rejectSensitiveBloggerInput(data);
  const patch: Record<string, unknown> = {};

  if ("name" in data) {
    patch.name = requiredString(data.name, "Connection name is required.");
  }
  if ("blogId" in data) {
    patch.blogId = optionalString(data.blogId);
  }
  if ("status" in data) {
    patch.status = optionalStatus(data.status) ?? "not_configured";
  }
  if ("bloggerBlogId" in data) {
    patch.bloggerBlogId = optionalString(data.bloggerBlogId);
  }
  if ("bloggerBlogName" in data) {
    patch.bloggerBlogName = optionalString(data.bloggerBlogName);
  }
  if ("connectedEmail" in data) {
    patch.connectedEmail = optionalString(data.connectedEmail);
  }
  if ("scopes" in data) {
    patch.scopes = Array.isArray(data.scopes)
      ? data.scopes.map((scope) => String(scope).trim()).filter(Boolean)
      : typeof data.scopes === "string"
        ? data.scopes.split(/[\n,]/).map((scope) => scope.trim()).filter(Boolean)
        : [];
  }
  if ("clientSecretRef" in data) {
    patch.clientSecretRef = optionalString(data.clientSecretRef);
  }
  if ("hasClientSecret" in data) {
    patch.hasClientSecret = optionalBoolean(data.hasClientSecret) ?? false;
  }
  if ("hasAccessToken" in data) {
    patch.hasAccessToken = optionalBoolean(data.hasAccessToken) ?? false;
  }
  if ("hasRefreshToken" in data) {
    patch.hasRefreshToken = optionalBoolean(data.hasRefreshToken) ?? false;
  }
  if ("tokenLast4" in data) {
    patch.tokenLast4 = normalizeLast4(data.tokenLast4);
  }
  if ("lastError" in data) {
    patch.lastError = sanitizeBloggerText(data.lastError, "lastError");
  }

  return patch;
}

function requiredString(value: unknown, message: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(message);
  }
  return value.trim();
}

function optionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function sanitizeBloggerText(value: unknown, fieldName: string) {
  const text = optionalString(value);
  if (!text) {
    return null;
  }
  if (hasSensitiveValue(text)) {
    throw new Error(`Sensitive token or secret value is not accepted in "${fieldName}".`);
  }
  return text.slice(0, 500);
}

function optionalBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
}

function optionalStatus(value: unknown): BloggerConnectionStatus | null {
  if (typeof value !== "string" || !value) {
    return null;
  }
  if (!BLOGGER_CONNECTION_STATUSES.includes(value as BloggerConnectionStatus)) {
    throw new Error("Unsupported Blogger connection status.");
  }
  return value as BloggerConnectionStatus;
}

function normalizeLast4(value: unknown) {
  const last4 = optionalString(value);
  if (!last4) {
    return null;
  }
  if (!/^[A-Za-z0-9_-]{4}$/.test(last4)) {
    throw new Error("tokenLast4 must be exactly 4 safe characters.");
  }
  return last4;
}

function hasSensitiveValue(value: unknown): boolean {
  if (typeof value === "string") {
    return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value));
  }
  if (Array.isArray(value)) {
    return value.some((item) => hasSensitiveValue(item));
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => hasSensitiveValue(item));
  }
  return false;
}
