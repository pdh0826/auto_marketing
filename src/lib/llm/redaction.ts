const REDACTED = "[REDACTED]";

export function redactSensitiveText(value: string) {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, REDACTED)
    .replace(/\bsk-proj-[A-Za-z0-9_-]{8,}\b/g, REDACTED)
    .replace(/(api[_ -]?key\s*(?:provided|is|=|:)?\s*)(["']?)[A-Za-z0-9._~+/=-]{6,}(["']?)/gi, `$1$2${REDACTED}$3`)
    .replace(/(token\s*(?:is|=|:)?\s*)(["']?)[A-Za-z0-9._~+/=-]{12,}(["']?)/gi, `$1$2${REDACTED}$3`)
    .replace(/(secret\s*(?:is|=|:)?\s*)(["']?)[A-Za-z0-9._~+/=-]{12,}(["']?)/gi, `$1$2${REDACTED}$3`);
}

export function safeErrorMessage(value: string, maxLength = 240) {
  const redacted = redactSensitiveText(value);
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}...` : redacted;
}
