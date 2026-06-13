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

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as { error?: string };
      message = payload.error ?? message;
    } catch {
      const text = await response.text();
      if (text) {
        message = text.slice(0, 240);
      }
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
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
