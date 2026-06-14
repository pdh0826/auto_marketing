import type { Prisma } from "@prisma/client";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { buildDraftMarkdownDryRun } from "@/lib/content/draft-preview";
import { validateDraftMarkdown, type DraftValidationResult } from "@/lib/content/draft-validation";
import { validatePlanJson } from "@/lib/content/plan-validation";
import { createLlmCallLog } from "@/lib/db/llm-call-logs";
import { prisma } from "@/lib/db/client";
import type { LlmTaskRouteAdmin } from "@/lib/llm/admin-types";
import { decryptSecret } from "@/lib/llm/secrets";
import { getOpenAiCompletionTokenParameter } from "@/lib/llm/provider-test";
import { redactSensitiveText, safeErrorMessage } from "@/lib/llm/redaction";

interface GenerateContentDraftInput {
  contentItemId: string;
}

interface ProviderCallResult {
  text: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  responseSummary: string;
}

export interface GenerateContentDraftResult {
  candidateDraftMarkdown: string;
  validation: DraftValidationResult;
  route: {
    providerName: string;
    modelName: string;
    usedFallback: boolean;
  };
  metadata: {
    latencyMs: number;
    responseSummary: string;
    markdownLength: number;
  };
}

class ProviderCallError extends Error {
  responseSummary: string;
  latencyMs: number;

  constructor(message: string, responseSummary: string, latencyMs: number) {
    super(message);
    this.responseSummary = responseSummary;
    this.latencyMs = latencyMs;
  }
}

export async function generateContentDraft({ contentItemId }: GenerateContentDraftInput): Promise<GenerateContentDraftResult> {
  const contentItem = await prisma.contentItem.findUnique({
    where: { id: contentItemId },
    include: {
      blog: true,
      brandProfile: true,
      assets: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  if (!contentItem) {
    throw new Error("Content item not found.");
  }

  if (!contentItem.planJson || typeof contentItem.planJson !== "object" || Array.isArray(contentItem.planJson)) {
    throw new Error("Saved planJson is required before draft generation.");
  }

  const contentItemForValidation = contentItem as unknown as ContentItemAdmin;
  const assets = contentItem.assets as unknown as ContentAssetAdmin[];
  const planValidation = validatePlanJson(contentItem.planJson as Record<string, unknown>, contentItemForValidation);
  if (!planValidation.ok) {
    throw new Error("Saved planJson did not pass validation.");
  }

  const route = await prisma.llmTaskRoute.findUnique({
    where: { taskType: "content_draft" },
    include: {
      primaryProvider: {
        include: { secrets: true }
      },
      primaryModel: true,
      fallbackProvider: {
        include: { secrets: true }
      },
      fallbackModel: true
    }
  });

  if (!route || !route.isEnabled || !route.primaryProvider || !route.primaryModel) {
    throw new Error("content_draft route is not ready.");
  }

  if (!route.primaryProvider.isEnabled || !route.primaryModel.isEnabled || route.primaryProvider.lastTestStatus !== "success") {
    throw new Error("Primary provider or model is not ready for content_draft.");
  }

  const dryRun = buildDraftMarkdownDryRun(contentItemForValidation, assets, route as unknown as LlmTaskRouteAdmin);
  if (!dryRun.ready) {
    throw new Error("content_draft readiness checks did not pass.");
  }

  let usedFallback = false;
  let provider = route.primaryProvider;
  let model = route.primaryModel;
  let callResult: ProviderCallResult;

  try {
    callResult = await callProvider(provider, model.name, dryRun.promptPreview, route.temperature, route.maxTokens, route.timeoutSeconds);
  } catch (primaryError) {
    if (!route.fallbackProvider || !route.fallbackModel || !route.fallbackProvider.isEnabled || !route.fallbackModel.isEnabled) {
      await recordDraftLog({
        contentItemId,
        providerId: route.primaryProviderId,
        modelId: route.primaryModelId,
        status: "failed",
        latencyMs: primaryError instanceof ProviderCallError ? primaryError.latencyMs : null,
        errorMessage: primaryError instanceof Error ? primaryError.message : "Primary provider call failed.",
        metadata: {
          usedFallback: false,
          apiFormat: route.primaryProvider.apiFormat,
          invocationMode: route.primaryProvider.invocationMode,
          responseSummary: primaryError instanceof ProviderCallError ? primaryError.responseSummary : "provider_call_failed",
          validationOk: false,
          validationWarningCount: 0,
          validationErrorCount: 1,
          markdownLength: 0,
          mediaPlaceholderCount: 0
        }
      });
      throw new Error(primaryError instanceof Error ? primaryError.message : "Primary provider call failed.");
    }

    usedFallback = true;
    provider = route.fallbackProvider;
    model = route.fallbackModel;
    try {
      callResult = await callProvider(provider, model.name, dryRun.promptPreview, route.temperature, route.maxTokens, route.timeoutSeconds);
    } catch (fallbackError) {
      await recordDraftLog({
        contentItemId,
        providerId: route.fallbackProviderId,
        modelId: route.fallbackModelId,
        status: "failed",
        latencyMs: fallbackError instanceof ProviderCallError ? fallbackError.latencyMs : null,
        errorMessage: fallbackError instanceof Error ? fallbackError.message : "Fallback provider call failed.",
        metadata: {
          usedFallback: true,
          apiFormat: provider.apiFormat,
          invocationMode: provider.invocationMode,
          responseSummary: fallbackError instanceof ProviderCallError ? fallbackError.responseSummary : "fallback_provider_call_failed",
          validationOk: false,
          validationWarningCount: 0,
          validationErrorCount: 1,
          markdownLength: 0,
          mediaPlaceholderCount: 0
        }
      });
      throw new Error(fallbackError instanceof Error ? fallbackError.message : "Fallback provider call failed.");
    }
  }

  const candidateDraftMarkdown = callResult.text.trim();
  const validation = validateDraftMarkdown(candidateDraftMarkdown, {
    contentItem: contentItemForValidation,
    assets
  });
  const markdownLength = candidateDraftMarkdown.length;
  const mediaPlaceholderCount = countMediaPlaceholders(candidateDraftMarkdown);

  await recordDraftLog({
    contentItemId,
    providerId: provider.id,
    modelId: model.id,
    status: validation.ok ? "success" : "failed",
    latencyMs: callResult.latencyMs,
    inputTokens: callResult.inputTokens,
    outputTokens: callResult.outputTokens,
    errorMessage: validation.ok ? null : "Generated draftMarkdown did not pass validation.",
    metadata: {
      usedFallback,
      apiFormat: provider.apiFormat,
      invocationMode: provider.invocationMode,
      responseSummary: callResult.responseSummary,
      validationOk: validation.ok,
      validationWarningCount: validation.warnings.length,
      validationErrorCount: validation.errors.length,
      markdownLength,
      mediaPlaceholderCount
    }
  });

  return {
    candidateDraftMarkdown,
    validation,
    route: {
      providerName: provider.name,
      modelName: model.displayName ?? model.name,
      usedFallback
    },
    metadata: {
      latencyMs: callResult.latencyMs,
      responseSummary: callResult.responseSummary,
      markdownLength
    }
  };
}

async function callProvider(
  provider: ProviderWithSecrets,
  model: string,
  prompt: { system: string; user: string; outputFormat: string },
  temperature: number | null,
  maxTokens: number | null,
  timeoutSeconds: number | null
) {
  if (provider.apiFormat === "openai_compatible") {
    return callOpenAiCompatible(provider, model, prompt, temperature, maxTokens, timeoutSeconds);
  }

  if (provider.apiFormat === "ollama_compatible") {
    return callOllamaCompatible(provider, model, prompt, temperature, maxTokens, timeoutSeconds);
  }

  throw new ProviderCallError("Provider API format is not supported for content_draft generation in Patch 8B.", "unsupported_api_format", 0);
}

async function callOpenAiCompatible(
  provider: ProviderWithSecrets,
  model: string,
  prompt: { system: string; user: string; outputFormat: string },
  temperature: number | null,
  maxTokens: number | null,
  timeoutSeconds: number | null
): Promise<ProviderCallResult> {
  const startedAt = Date.now();
  const baseUrl = requireBaseUrl(provider.baseUrl);
  const secret = getProviderApiKey(provider);
  const tokenParameter = getOpenAiCompletionTokenParameter(model);
  const response = await fetchWithTimeout(joinUrl(baseUrl, provider.endpointPath || "/v1/chat/completions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: `${prompt.user}\n\nOutput format:\n${prompt.outputFormat}` }
      ],
      temperature: temperature ?? 0.3,
      [tokenParameter]: maxTokens ?? 2500
    })
  }, timeoutSeconds ?? provider.timeoutSeconds);

  const body = await readJsonOrText(response);
  const latencyMs = Date.now() - startedAt;

  if (!response.ok) {
    throw new ProviderCallError(safeHttpFailureMessage("OpenAI-compatible", response.status), summarizeHttpFailure("openai_compatible", response.status), latencyMs);
  }

  return {
    text: extractOpenAiText(body),
    latencyMs,
    inputTokens: extractUsageToken(body, "prompt_tokens"),
    outputTokens: extractUsageToken(body, "completion_tokens"),
    responseSummary: "openai_chat_completion_received"
  };
}

async function callOllamaCompatible(
  provider: ProviderWithSecrets,
  model: string,
  prompt: { system: string; user: string; outputFormat: string },
  temperature: number | null,
  maxTokens: number | null,
  timeoutSeconds: number | null
): Promise<ProviderCallResult> {
  const startedAt = Date.now();
  const baseUrl = requireBaseUrl(provider.baseUrl);
  const response = await fetchWithTimeout(joinUrl(baseUrl, provider.endpointPath || "/api/generate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: `${prompt.system}\n\nInput:\n${prompt.user}\n\nOutput format:\n${prompt.outputFormat}`,
      stream: false,
      options: {
        temperature: temperature ?? 0.3,
        num_predict: maxTokens ?? 2500
      }
    })
  }, timeoutSeconds ?? provider.timeoutSeconds);

  const body = await readJsonOrText(response);
  const latencyMs = Date.now() - startedAt;

  if (!response.ok) {
    throw new ProviderCallError(safeHttpFailureMessage("Ollama-compatible", response.status), summarizeHttpFailure("ollama_compatible", response.status), latencyMs);
  }

  return {
    text: extractOllamaText(body),
    latencyMs,
    inputTokens: null,
    outputTokens: null,
    responseSummary: "ollama_generate_received"
  };
}

async function recordDraftLog(input: {
  contentItemId: string;
  providerId: string | null;
  modelId: string | null;
  status: "success" | "failed";
  latencyMs: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  errorMessage?: string | null;
  metadata: {
    usedFallback: boolean;
    apiFormat: string;
    invocationMode: string;
    responseSummary: string;
    validationOk: boolean;
    validationWarningCount: number;
    validationErrorCount: number;
    markdownLength: number;
    mediaPlaceholderCount: number;
  };
}) {
  await createLlmCallLog({
    taskType: "content_draft",
    contentItemId: input.contentItemId,
    providerId: input.providerId,
    modelId: input.modelId,
    status: input.status,
    latencyMs: input.latencyMs,
    inputTokens: input.inputTokens ?? null,
    outputTokens: input.outputTokens ?? null,
    estimatedCost: null,
    errorMessage: input.errorMessage ? safeErrorMessage(input.errorMessage, 500) : null,
    metadata: {
      purpose: "content_draft_generation",
      usedFallback: input.metadata.usedFallback,
      apiFormat: input.metadata.apiFormat,
      invocationMode: input.metadata.invocationMode,
      responseSummary: input.metadata.responseSummary,
      validationOk: input.metadata.validationOk,
      validationWarningCount: input.metadata.validationWarningCount,
      validationErrorCount: input.metadata.validationErrorCount,
      markdownLength: input.metadata.markdownLength,
      mediaPlaceholderCount: input.metadata.mediaPlaceholderCount
    } as Prisma.InputJsonObject
  });
}

function getProviderApiKey(provider: ProviderWithSecrets) {
  const apiKeySecret = provider.secrets.find((secret) => secret.secretKind === "api_key");
  if (!apiKeySecret) {
    throw new ProviderCallError("API key secret is required for OpenAI-compatible content_draft generation.", "missing_api_key_secret", 0);
  }
  return decryptSecret(apiKeySecret.encryptedValue);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutSeconds: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderCallError("Provider call timed out.", "timeout", timeoutSeconds * 1000);
    }
    throw new ProviderCallError(error instanceof Error ? safeErrorMessage(error.message) : "Provider call failed.", "network_error", 0);
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonOrText(response: Response) {
  const rawText = await response.text();
  if (!rawText) {
    return null;
  }
  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return rawText;
  }
}

function extractOpenAiText(body: unknown) {
  const choices = body && typeof body === "object" && "choices" in body ? (body as { choices?: Array<{ message?: { content?: unknown }; text?: unknown }> }).choices : null;
  const content = choices?.[0]?.message?.content ?? choices?.[0]?.text;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenAI-compatible response did not contain content.");
  }
  return content;
}

function extractOllamaText(body: unknown) {
  const response = body && typeof body === "object" && "response" in body ? (body as { response?: unknown }).response : null;
  if (typeof response !== "string" || !response.trim()) {
    throw new Error("Ollama-compatible response did not contain response text.");
  }
  return response;
}

function extractUsageToken(body: unknown, key: "prompt_tokens" | "completion_tokens") {
  const usage = body && typeof body === "object" && "usage" in body ? (body as { usage?: Record<string, unknown> }).usage : null;
  const value = usage?.[key];
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null;
}

function countMediaPlaceholders(markdown: string) {
  return markdown.match(/<!--\s*media:/gi)?.length ?? 0;
}

function requireBaseUrl(value: string | null) {
  if (!value) {
    throw new ProviderCallError("Provider baseUrl is required.", "missing_base_url", 0);
  }
  return value;
}

function joinUrl(baseUrl: string, endpointPath: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`;
  return `${normalizedBase}${normalizedPath}`;
}

function safeHttpFailureMessage(label: string, status: number) {
  if (status === 401 || status === 403) {
    return `${label} content_draft generation failed with HTTP ${status}. Authentication failed. Check the provider credentials.`;
  }
  if (status === 400) {
    return `${label} content_draft generation failed with HTTP ${status}. Check provider parameters.`;
  }
  if (status === 404) {
    return `${label} content_draft generation failed with HTTP ${status}. Endpoint or model was not found.`;
  }
  return `${label} content_draft generation failed with HTTP ${status}.`;
}

function summarizeHttpFailure(apiFormat: string, status: number) {
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
  return redactSensitiveText("provider_http_error");
}

type ProviderWithSecrets = NonNullable<Awaited<ReturnType<typeof prisma.llmProvider.findUnique>>> & {
  secrets: Array<{ secretKind: string; encryptedValue: string }>;
};
