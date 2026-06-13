export interface ApiResult<T> {
  data: T;
}

export async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers
    }
  });

  const rawText = await response.text();
  const payload = parseJsonPayload(rawText);

  if (!response.ok) {
    const message = readErrorMessage(payload, rawText, response.status);
    throw new Error(message);
  }

  return payload as T;
}

function parseJsonPayload(rawText: string) {
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return null;
  }
}

function readErrorMessage(payload: unknown, rawText: string, status: number) {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }

  if (rawText) {
    return rawText.slice(0, 240);
  }

  return `Request failed with status ${status}`;
}

export function optionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseListInput(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatListInput(value: string[]) {
  return value.join("\n");
}

export function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}
