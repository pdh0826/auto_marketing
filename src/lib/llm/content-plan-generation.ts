import type { Prisma } from "@prisma/client";
import { buildOutputFormatPreview, buildSystemPromptPreview, buildUserPromptPreview } from "@/lib/content/content-plan-preview";
import { createLlmCallLog } from "@/lib/db/llm-call-logs";
import { prisma } from "@/lib/db/client";
import { decryptSecret } from "@/lib/llm/secrets";
import { getOpenAiCompletionTokenParameter } from "@/lib/llm/provider-test";
import { safeErrorMessage, redactSensitiveText } from "@/lib/llm/redaction";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";

interface GenerateContentPlanInput {
  contentItemId: string;
}

interface PlanValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface GenerateContentPlanResult {
  candidatePlanJson: Record<string, unknown>;
  validation: PlanValidationResult;
  route: {
    providerName: string;
    modelName: string;
    usedFallback: boolean;
  };
  metadata: {
    latencyMs: number;
    responseSummary: string;
  };
}

interface ProviderCallResult {
  text: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  responseSummary: string;
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

const REQUIRED_FIELDS = ["titleCandidates", "targetKeyword", "searchIntent", "audience", "coreMessage", "outline", "ctaPlan", "mediaPlan", "faq", "risks"];
const ARRAY_FIELDS = ["titleCandidates", "outline", "mediaPlan", "faq", "risks"];
const FINANCIAL_SAFETY_ERROR_PHRASES = [
  "수익 보장",
  "급등 확정",
  "매수 추천",
  "매도 추천",
  "반드시 오른다",
  "무조건 오른다",
  "손실 없음",
  "리스크 없음",
  "원금 보장",
  "수익률 예시",
  "성공 사례",
  "안전하게 매수",
  "안전한 투자",
  "확실한 수익"
];
const FINANCIAL_SAFETY_WARNING_PHRASES = ["무료 체험", "지금 시작", "신뢰할 수 있는 투자", "매수 타이밍을 잡다", "수익률", "성공"];
const INVESTMENT_CONTEXT_KEYWORDS = [
  "투자",
  "주식",
  "종목",
  "매수",
  "매도",
  "급등",
  "투자 인사이트",
  "수익률",
  "포트폴리오",
  "증권",
  "금융",
  "코인",
  "etf",
  "stock",
  "invest",
  "investment",
  "trading",
  "trade"
];

export async function generateContentPlan({ contentItemId }: GenerateContentPlanInput): Promise<GenerateContentPlanResult> {
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

  const route = await prisma.llmTaskRoute.findUnique({
    where: { taskType: "content_plan" },
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
    throw new Error("content_plan route is not ready.");
  }

  if (!route.primaryProvider.isEnabled || !route.primaryModel.isEnabled) {
    throw new Error("Primary provider or model is disabled.");
  }

  const prompt = buildPrompt(contentItem as unknown as ContentItemAdmin, contentItem.assets as unknown as ContentAssetAdmin[]);
  let usedFallback = false;
  let provider = route.primaryProvider;
  let model = route.primaryModel;
  let callResult: ProviderCallResult;

  try {
    callResult = await callProvider(provider, model.name, prompt, route.temperature, route.maxTokens, route.timeoutSeconds);
  } catch (primaryError) {
    if (!route.fallbackProvider || !route.fallbackModel || !route.fallbackProvider.isEnabled || !route.fallbackModel.isEnabled) {
      await recordGenerationLog({
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
          validationErrorCount: 1
        }
      });
      throw new Error(primaryError instanceof Error ? primaryError.message : "Primary provider call failed.");
    }

    usedFallback = true;
    provider = route.fallbackProvider;
    model = route.fallbackModel;
    try {
      callResult = await callProvider(provider, model.name, prompt, route.temperature, route.maxTokens, route.timeoutSeconds);
    } catch (fallbackError) {
      await recordGenerationLog({
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
          validationErrorCount: 1
        }
      });
      throw new Error(fallbackError instanceof Error ? fallbackError.message : "Fallback provider call failed.");
    }
  }

  let candidatePlanJson: Record<string, unknown>;
  try {
    candidatePlanJson = parsePlanJsonCandidate(callResult.text);
  } catch (parseError) {
    await recordGenerationLog({
      contentItemId,
      providerId: provider.id,
      modelId: model.id,
      status: "failed",
      latencyMs: callResult.latencyMs,
      inputTokens: callResult.inputTokens,
      outputTokens: callResult.outputTokens,
      errorMessage: parseError instanceof Error ? parseError.message : "Generated response could not be parsed as JSON.",
      metadata: {
        usedFallback,
        apiFormat: provider.apiFormat,
        invocationMode: provider.invocationMode,
        responseSummary: "json_parse_failed",
        validationOk: false,
        validationWarningCount: 0,
        validationErrorCount: 1
      }
    });
    throw new Error(parseError instanceof Error ? parseError.message : "Generated response could not be parsed as JSON.");
  }
  const validation = validatePlanJson(candidatePlanJson, contentItem as unknown as ContentItemAdmin);

  await recordGenerationLog({
    contentItemId,
    providerId: provider.id,
    modelId: model.id,
    status: validation.ok ? "success" : "failed",
    latencyMs: callResult.latencyMs,
    inputTokens: callResult.inputTokens,
    outputTokens: callResult.outputTokens,
    errorMessage: validation.ok ? null : "Generated planJson did not pass validation.",
    metadata: {
      usedFallback,
      apiFormat: provider.apiFormat,
      invocationMode: provider.invocationMode,
      responseSummary: callResult.responseSummary,
      validationOk: validation.ok,
      validationWarningCount: validation.warnings.length,
      validationErrorCount: validation.errors.length
    }
  });

  return {
    candidatePlanJson,
    validation,
    route: {
      providerName: provider.name,
      modelName: model.displayName ?? model.name,
      usedFallback
    },
    metadata: {
      latencyMs: callResult.latencyMs,
      responseSummary: callResult.responseSummary
    }
  };
}

function buildPrompt(contentItem: ContentItemAdmin, assets: ContentAssetAdmin[]) {
  return {
    system: buildSystemPromptPreview(),
    user: buildUserPromptPreview(contentItem, assets),
    outputFormat: buildOutputFormatPreview()
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

  throw new ProviderCallError("Provider API format is not supported for content_plan generation in Patch 7C.", "unsupported_api_format", 0);
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
      temperature: temperature ?? 0.2,
      [tokenParameter]: maxTokens ?? 1200
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
        temperature: temperature ?? 0.2,
        num_predict: maxTokens ?? 1200
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

export function parsePlanJsonCandidate(rawText: string) {
  const trimmed = rawText.trim();
  const candidates = [trimmed, extractFencedJson(trimmed), extractJsonObject(trimmed)].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next safe extraction strategy.
    }
  }

  throw new Error("LLM response did not contain a valid JSON object.");
}

export function validatePlanJson(value: Record<string, unknown>, contentItem?: ContentItemAdmin): PlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in value)) {
      warnings.push(`Missing field: ${field}`);
    }
  }

  for (const field of ARRAY_FIELDS) {
    if (field in value && !Array.isArray(value[field])) {
      warnings.push(`Field should be an array: ${field}`);
    }
  }

  const coreMessage = typeof value.coreMessage === "string" ? value.coreMessage.trim() : "";
  const outline = Array.isArray(value.outline) ? value.outline : [];
  if (!coreMessage && outline.length === 0) {
    errors.push("coreMessage or outline must be present.");
  }

  const safetyValidation = validateFinancialSafety(value, contentItem);
  errors.push(...safetyValidation.errors);
  warnings.push(...safetyValidation.warnings);

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}

function validateFinancialSafety(value: Record<string, unknown>, contentItem?: ContentItemAdmin): Pick<PlanValidationResult, "errors" | "warnings"> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const serializedPlan = JSON.stringify(value);
  const errorMatches = findPhraseMatches(serializedPlan, FINANCIAL_SAFETY_ERROR_PHRASES);
  const warningMatches = findPhraseMatches(serializedPlan, FINANCIAL_SAFETY_WARNING_PHRASES).filter(
    (warningPhrase) => !errorMatches.some((errorPhrase) => errorPhrase.includes(warningPhrase) || warningPhrase.includes(errorPhrase))
  );
  const strictInvestmentServicePromotion = isStrictInvestmentServicePromotion(contentItem);

  for (const phrase of errorMatches) {
    errors.push(`Financial/investment safety blocked phrase: "${phrase}"`);
  }

  for (const phrase of warningMatches) {
    if (strictInvestmentServicePromotion) {
      errors.push(`Investment service promotion safety phrase requires removal: "${phrase}"`);
    } else {
      warnings.push(`Financial/investment safety caution phrase: "${phrase}"`);
    }
  }

  return { errors, warnings };
}

function findPhraseMatches(value: string, phrases: string[]) {
  const normalized = value.toLowerCase();
  return phrases.filter((phrase) => normalized.includes(phrase.toLowerCase()));
}

function isStrictInvestmentServicePromotion(contentItem?: ContentItemAdmin) {
  if (contentItem?.mode !== "service_promotion" || !contentItem.brandProfile) {
    return false;
  }

  return INVESTMENT_CONTEXT_KEYWORDS.some((keyword) => buildInvestmentContextText(contentItem).includes(keyword.toLowerCase()));
}

function buildInvestmentContextText(contentItem: ContentItemAdmin) {
  const brandProfile = contentItem.brandProfile;
  const fields = [
    contentItem.title,
    contentItem.targetKeyword,
    contentItem.sourceMemo,
    brandProfile?.name,
    brandProfile?.serviceName,
    brandProfile?.shortDescription,
    brandProfile?.longDescription,
    brandProfile?.riskDisclaimer,
    ...(brandProfile?.targetUsers ?? []),
    ...(brandProfile?.coreFeatures ?? []),
    ...(brandProfile?.problemsSolved ?? []),
    ...(brandProfile?.forbiddenPhrases ?? []),
    ...(brandProfile?.preferredPhrases ?? [])
  ];

  return fields
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

function extractFencedJson(value: string) {
  const match = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return match?.[1]?.trim() ?? null;
}

function extractJsonObject(value: string) {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  return value.slice(start, end + 1);
}

function getProviderApiKey(provider: ProviderWithSecrets) {
  const apiKeySecret = provider.secrets.find((secret) => secret.secretKind === "api_key");
  if (!apiKeySecret) {
    throw new ProviderCallError("API key secret is required for OpenAI-compatible content_plan generation.", "missing_api_key_secret", 0);
  }
  return decryptSecret(apiKeySecret.encryptedValue);
}

async function recordGenerationLog(input: {
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
  };
}) {
  await createLlmCallLog({
    taskType: "content_plan",
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
      purpose: "content_plan_generation",
      usedFallback: input.metadata.usedFallback,
      apiFormat: input.metadata.apiFormat,
      invocationMode: input.metadata.invocationMode,
      responseSummary: input.metadata.responseSummary,
      validationOk: input.metadata.validationOk,
      validationWarningCount: input.metadata.validationWarningCount,
      validationErrorCount: input.metadata.validationErrorCount
    } as Prisma.InputJsonObject
  });
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

function safeHttpFailureMessage(label: string, status: number) {
  if (status === 401 || status === 403) {
    return `${label} content_plan generation failed with HTTP ${status}. Authentication failed. Check the provider credentials.`;
  }
  if (status === 400) {
    return `${label} content_plan generation failed with HTTP ${status}. Check provider parameters.`;
  }
  if (status === 404) {
    return `${label} content_plan generation failed with HTTP ${status}. Endpoint or model was not found.`;
  }
  return `${label} content_plan generation failed with HTTP ${status}.`;
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
