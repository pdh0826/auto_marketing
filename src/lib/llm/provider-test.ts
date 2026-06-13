import type { LlmApiFormat, LlmInvocationMode, Prisma } from "@prisma/client";
import { decryptSecret } from "@/lib/llm/secrets";
import { safeErrorMessage, redactSensitiveText } from "@/lib/llm/redaction";
import { createLlmCallLog } from "@/lib/db/llm-call-logs";
import { getLlmProviderForTest } from "@/lib/db/llm-providers";
import { prisma } from "@/lib/db/client";

const TEST_PROMPT = "Return only the word: OK";
const MAX_SUMMARY_LENGTH = 240;

export interface ProviderTestResult {
  ok: boolean;
  status: "success" | "failed";
  message: string;
  latencyMs: number;
  metadata: Record<string, unknown>;
}

export async function testLlmProvider(providerId: string): Promise<ProviderTestResult> {
  const provider = await getLlmProviderForTest(providerId);

  if (!provider) {
    throw new Error("LLM provider not found");
  }

  const startedAt = Date.now();
  let result: ProviderTestResult;

  try {
    if (provider.invocationMode === "cli") {
      result = disabledResult(provider.invocationMode, provider.apiFormat, startedAt, "CLI connection tests are disabled in Patch 7A.");
    } else if (provider.apiFormat === "custom_http" || provider.apiFormat === "custom_cli") {
      result = disabledResult(provider.invocationMode, provider.apiFormat, startedAt, "Custom provider tests are disabled in Patch 7A.");
    } else if (provider.apiFormat === "openai_compatible") {
      result = await testOpenAiCompatible(provider, startedAt);
    } else if (provider.apiFormat === "ollama_compatible") {
      result = await testOllamaCompatible(provider, startedAt);
    } else {
      result = disabledResult(provider.invocationMode, provider.apiFormat, startedAt, "Unsupported provider test format.");
    }
  } catch (error) {
    const message = safeErrorMessage(error instanceof Error ? error.message : "Provider connection test failed.", 500);
    result = {
      ok: false,
      status: "failed",
      message,
      latencyMs: Date.now() - startedAt,
      metadata: {
        ...baseMetadata(provider.invocationMode, provider.apiFormat),
        responseSummary: "provider_test_exception"
      }
    };
  }

  await prisma.llmProvider.update({
    where: { id: provider.id },
    data: {
      lastTestStatus: result.status,
      lastTestedAt: new Date(),
      lastTestError: result.ok ? null : safeErrorMessage(result.message, 500)
    }
  });

  await createLlmCallLog({
    taskType: "provider_test",
    providerId: provider.id,
    status: result.ok ? "success" : "failed",
    latencyMs: result.latencyMs,
    errorMessage: result.ok ? null : safeErrorMessage(result.message, 500),
    metadata: result.metadata as Prisma.InputJsonObject
  });

  return result;
}

async function testOpenAiCompatible(provider: TestProvider, startedAt: number): Promise<ProviderTestResult> {
  const baseUrl = requireBaseUrl(provider.baseUrl);
  const endpointPath = provider.endpointPath || "/v1/chat/completions";
  const model = requireModel(provider.defaultModel);
  const secret = getApiKey(provider);
  const response = await fetchWithTimeout(joinUrl(baseUrl, endpointPath), {
    method: "POST",
    headers: {
      ...safeHeaderObject(provider.headersJson),
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`
    },
    body: JSON.stringify(buildOpenAiCompatibleTestBody(model))
  }, provider.timeoutSeconds);

  const body = await readJsonOrText(response);
  const latencyMs = Date.now() - startedAt;
  const summary = response.ok ? summarizeOpenAiResponse(body) : summarizeHttpFailure("openai_compatible", response.status);
  const failureMessage = safeProviderFailureMessage("OpenAI-compatible", response.status);

  return {
    ok: response.ok,
    status: response.ok ? "success" : "failed",
    message: response.ok ? "OpenAI-compatible provider connection test succeeded." : failureMessage,
    latencyMs,
    metadata: {
      ...baseMetadata(provider.invocationMode, provider.apiFormat),
      httpStatus: response.status,
      responseSummary: summary,
      latencyMs
    }
  };
}

async function testOllamaCompatible(provider: TestProvider, startedAt: number): Promise<ProviderTestResult> {
  const baseUrl = requireBaseUrl(provider.baseUrl);
  const endpointPath = provider.endpointPath || "/api/generate";
  const model = requireModel(provider.defaultModel);
  const response = await fetchWithTimeout(joinUrl(baseUrl, endpointPath), {
    method: "POST",
    headers: {
      ...safeHeaderObject(provider.headersJson),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt: TEST_PROMPT,
      stream: false
    })
  }, provider.timeoutSeconds);

  const body = await readJsonOrText(response);
  const latencyMs = Date.now() - startedAt;
  const summary = response.ok ? summarizeOllamaResponse(body) : summarizeHttpFailure("ollama_compatible", response.status);
  const failureMessage = safeProviderFailureMessage("Ollama-compatible", response.status);

  return {
    ok: response.ok,
    status: response.ok ? "success" : "failed",
    message: response.ok ? "Ollama-compatible provider connection test succeeded." : failureMessage,
    latencyMs,
    metadata: {
      ...baseMetadata(provider.invocationMode, provider.apiFormat),
      httpStatus: response.status,
      responseSummary: summary,
      latencyMs
    }
  };
}

function disabledResult(invocationMode: LlmInvocationMode, apiFormat: LlmApiFormat, startedAt: number, message: string): ProviderTestResult {
  return {
    ok: false,
    status: "failed",
    message,
    latencyMs: Date.now() - startedAt,
    metadata: {
      ...baseMetadata(invocationMode, apiFormat),
      responseSummary: message,
      latencyMs: Date.now() - startedAt
    }
  };
}

function getApiKey(provider: TestProvider) {
  const apiKeySecret = provider.secrets.find((secret) => secret.secretKind === "api_key");
  if (!apiKeySecret) {
    throw new Error("API key secret is required for OpenAI-compatible provider tests.");
  }
  return decryptSecret(apiKeySecret.encryptedValue);
}

function requireBaseUrl(baseUrl: string | null) {
  if (!baseUrl) {
    throw new Error("baseUrl is required for provider connection tests.");
  }
  return baseUrl;
}

function requireModel(defaultModel: string | null) {
  if (!defaultModel) {
    throw new Error("defaultModel is required for provider connection tests.");
  }
  return defaultModel;
}

function joinUrl(baseUrl: string, endpointPath: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutSeconds: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonOrText(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json() as Promise<unknown>;
  }
  return response.text();
}

function safeHeaderObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, entry]) => typeof entry === "string" && !isSensitiveHeaderName(key))
      .map(([key, entry]) => [key, entry as string])
  );
}

function isSensitiveHeaderName(value: string) {
  const normalized = value.toLowerCase();
  return normalized === "authorization" || normalized === "proxy-authorization" || normalized.includes("api-key") || normalized.includes("token");
}

export function buildOpenAiCompatibleTestBody(model: string) {
  return {
    model,
    messages: [{ role: "user", content: TEST_PROMPT }],
    temperature: 0,
    [getOpenAiCompletionTokenParameter(model)]: 8
  };
}

export function getOpenAiCompletionTokenParameter(model: string): "max_tokens" | "max_completion_tokens" {
  const normalized = model.trim().toLowerCase();

  if (usesMaxCompletionTokens(normalized)) {
    return "max_completion_tokens";
  }

  return "max_tokens";
}

function usesMaxCompletionTokens(model: string) {
  return (
    model === "gpt-5" ||
    model.startsWith("gpt-5.") ||
    model.startsWith("gpt-5-") ||
    model === "o1" ||
    model.startsWith("o1-") ||
    model === "o3" ||
    model.startsWith("o3-") ||
    model === "o4" ||
    model.startsWith("o4-")
  );
}

function summarizeOpenAiResponse(value: unknown) {
  if (value && typeof value === "object") {
    const objectValue = value as { choices?: unknown[]; object?: unknown; error?: unknown };
    if (objectValue.error) {
      return "openai_error";
    }
    return truncate(`object=${String(objectValue.object ?? "unknown")}; choices=${Array.isArray(objectValue.choices) ? objectValue.choices.length : 0}`);
  }
  return truncate(String(value));
}

function summarizeOllamaResponse(value: unknown) {
  if (value && typeof value === "object") {
    const objectValue = value as { done?: unknown; model?: unknown; error?: unknown };
    if (objectValue.error) {
      return "ollama_error";
    }
    return truncate(`model=${String(objectValue.model ?? "unknown")}; done=${String(objectValue.done ?? "unknown")}`);
  }
  return truncate(String(value));
}

function truncate(value: string) {
  const redacted = redactSensitiveText(value);
  return redacted.length > MAX_SUMMARY_LENGTH ? `${redacted.slice(0, MAX_SUMMARY_LENGTH)}...` : redacted;
}

function safeProviderFailureMessage(label: string, status: number) {
  if (status === 401 || status === 403) {
    return `${label} provider test failed with HTTP ${status}. Authentication failed. Check the API key.`;
  }
  if (status === 400) {
    return `${label} provider test failed with HTTP ${status}. Check provider parameters.`;
  }
  if (status === 404) {
    return `${label} provider test failed with HTTP ${status}. Endpoint or model was not found.`;
  }
  return `${label} provider test failed with HTTP ${status}.`;
}

function summarizeHttpFailure(apiFormat: LlmApiFormat, status: number) {
  if (status === 401 || status === 403) {
    return "authentication_failed";
  }
  if (status === 400) {
    return "parameter_error";
  }
  if (status === 404) {
    return apiFormat === "ollama_compatible" ? "not_found_or_model_unavailable" : "not_found";
  }
  if (status >= 500) {
    return "provider_server_error";
  }
  return "provider_http_error";
}

function baseMetadata(invocationMode: LlmInvocationMode, apiFormat: LlmApiFormat) {
  return {
    purpose: "provider_connection_test",
    invocationMode,
    apiFormat
  };
}

type TestProvider = NonNullable<Awaited<ReturnType<typeof getLlmProviderForTest>>>;
