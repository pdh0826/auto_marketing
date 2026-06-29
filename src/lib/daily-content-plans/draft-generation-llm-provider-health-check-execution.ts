import { prisma } from "@/lib/db/client";
import {
  buildDailyContentDraftGenerationLlmProviderHealthCheckPreviewResponse,
  type DailyContentDraftGenerationLlmProviderHealthCheckPreviewResponse
} from "@/lib/daily-content-plans/draft-generation-llm-provider-health-check-preview";

const PATCH_VERSION = "9F-2P";
const EXECUTION_MODE = "gated_llm_provider_health_check_execution";
const TASK_TYPE = "content_draft";
const CONFIRMATION_PHRASE = "I_UNDERSTAND_THIS_WILL_CALL_LLM_PROVIDER_HEALTHCHECK_ONLY";
const HEALTHCHECK_EXECUTION_FLAG = "BLOG_DAILY_CONTENT_LLM_PROVIDER_HEALTHCHECK_EXECUTION_ENABLED";
const NETWORK_CALL_FLAG = "BLOG_DAILY_CONTENT_LLM_PROVIDER_NETWORK_CALLS_ENABLED";
const HEALTHCHECK_TIMEOUT_MS = 3000;

type HealthCheckExecutionRequestMode = "preview" | "healthcheck_execute" | "blocked_unsupported_mode";
type EndpointCategory = "provider_metadata" | "provider_models_list" | "provider_version" | "provider_tags" | "provider_health";
type StatusCodeClass = "2xx" | "3xx" | "4xx" | "5xx" | "network_error" | "timeout" | "unknown";

export interface DailyContentDraftGenerationLlmProviderHealthCheckExecutionRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
  confirmationPhrase?: unknown;
  idempotencyKey?: unknown;
}

export interface DailyContentDraftGenerationLlmProviderHealthCheckExecutionResponse {
  checkedAt: string;
  draftGenerationLlmProviderHealthCheckExecutionSummary: DailyContentDraftGenerationLlmProviderHealthCheckExecutionSummary;
}

export interface DailyContentDraftGenerationLlmProviderHealthCheckExecutionSummary {
  patchVersion: "9F-2P";
  checked: true;
  executionMode: typeof EXECUTION_MODE;
  dryRunOnly: false;
  targetSummary: HealthCheckPreviewSummary["targetSummary"];
  persistedApprovalSummary: HealthCheckPreviewSummary["persistedApprovalSummary"];
  executionGateSummary: HealthCheckPreviewSummary["executionGateSummary"];
  healthCheckExecutionSummary: {
    requestedMode: string;
    mode: HealthCheckExecutionRequestMode;
    healthCheckExecutionAllowedNow: boolean;
    healthCheckExecuted: boolean;
    providerNetworkCallAttempted: boolean;
    llmCompletionAttempted: false;
    promptRendered: false;
    promptStored: false;
    gateSummary: {
      healthCheckFeatureFlagEnabled: boolean;
      providerNetworkCallsFeatureFlagEnabled: boolean;
      confirmationPhraseSatisfied: boolean;
      idempotencyKeyPresent: boolean;
      providerRouteResolved: boolean;
      providerConfigFound: boolean;
      modelCandidateResolved: boolean;
      requiredEnvPresent: boolean;
      supportedHealthCheckProviderKind: boolean;
    };
    healthCheckBlockers: string[];
    safeHealthCheckContract: {
      endpointCategory: EndpointCategory | null;
      completionEndpointsForbidden: true;
      responseBodyReturned: false;
      rawHeadersReturned: false;
      secretValueExposed: false;
      timeoutMs: 3000;
      retries: 0;
    };
    sanitizedHealthCheckResult: SanitizedHealthCheckResult | null;
    currentSideEffectSummary: DailyContentDraftGenerationLlmProviderHealthCheckExecutionSideEffectSummary;
  };
  blockingReasons: string[];
  warnings: string[];
}

export interface SanitizedHealthCheckResult {
  attempted: true;
  success: boolean;
  statusCodeClass: StatusCodeClass;
  elapsedMs: number;
  providerKind: string;
  endpointCategory: EndpointCategory;
  errorCategory: string | null;
  rawBodyExposed: false;
  rawHeadersExposed: false;
  secretValueExposed: false;
}

export interface DailyContentDraftGenerationLlmProviderHealthCheckExecutionSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  envRead: true;
  secretValueExposed: false;
  providerHealthChecked: boolean;
  providerNetworkCall: boolean;
  llmCall: false;
  llmCompletionCall: false;
  llmCallLogMutation: false;
  contentItemMutation: false;
  draftMarkdownMutation: false;
  draftHtmlMutation: false;
  bloggerWrite: false;
  bloggerDraftSave: false;
  bloggerPublish: false;
  scheduledPublish: false;
  oauthReconnect: false;
  tokenRefresh: false;
  publishApprovalMutation: false;
  publishAttemptMutation: false;
  externalSend: boolean;
}

type HealthCheckPreviewSummary =
  DailyContentDraftGenerationLlmProviderHealthCheckPreviewResponse["draftGenerationLlmProviderHealthCheckPreviewSummary"];

export async function buildDailyContentDraftGenerationLlmProviderHealthCheckExecutionResponse(
  rawRequest: DailyContentDraftGenerationLlmProviderHealthCheckExecutionRequest
): Promise<DailyContentDraftGenerationLlmProviderHealthCheckExecutionResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const [previewResponse, route] = await Promise.all([
    buildDailyContentDraftGenerationLlmProviderHealthCheckPreviewResponse({
      mode: "preview",
      planId: request.planId,
      planItemId: request.planItemId,
      contentItemId: request.contentItemId
    }),
    prisma.llmTaskRoute.findUnique({
      where: { taskType: TASK_TYPE },
      include: {
        primaryProvider: true,
        primaryModel: true
      }
    })
  ]);
  const previewSummary = previewResponse.draftGenerationLlmProviderHealthCheckPreviewSummary;
  const provider = route?.primaryProvider ?? null;
  const primaryModel = route?.primaryModel ?? null;
  const endpointPlan = buildEndpointPlan(provider);
  const gateSummary = {
    healthCheckFeatureFlagEnabled: process.env[HEALTHCHECK_EXECUTION_FLAG] === "true",
    providerNetworkCallsFeatureFlagEnabled: process.env[NETWORK_CALL_FLAG] === "true",
    confirmationPhraseSatisfied: request.confirmationPhrase === CONFIRMATION_PHRASE,
    idempotencyKeyPresent: Boolean(request.idempotencyKey),
    providerRouteResolved: previewSummary.llmProviderReadinessSummary.selectedRouteResolved,
    providerConfigFound: previewSummary.llmProviderReadinessSummary.providerConfigFound,
    modelCandidateResolved: Boolean(primaryModel?.isEnabled),
    requiredEnvPresent: previewSummary.llmProviderReadinessSummary.sourceReadinessSummary.secretAndEnvReadiness.missingRequiredEnvVars.length === 0,
    supportedHealthCheckProviderKind: Boolean(endpointPlan)
  };
  const blockers = buildBlockers(request, gateSummary, endpointPlan);
  const healthCheckExecutionAllowedNow = request.mode === "healthcheck_execute" && blockers.length === 0;
  const sanitizedHealthCheckResult = healthCheckExecutionAllowedNow && endpointPlan ? await runSafeProviderHealthCheck(endpointPlan) : null;
  const healthCheckExecuted = Boolean(sanitizedHealthCheckResult);
  const providerNetworkCallAttempted = Boolean(sanitizedHealthCheckResult);
  const sideEffectSummary = buildSideEffectSummary(providerNetworkCallAttempted);

  return {
    checkedAt: checkedAt.toISOString(),
    draftGenerationLlmProviderHealthCheckExecutionSummary: {
      patchVersion: PATCH_VERSION,
      checked: true,
      executionMode: EXECUTION_MODE,
      dryRunOnly: false,
      targetSummary: previewSummary.targetSummary,
      persistedApprovalSummary: previewSummary.persistedApprovalSummary,
      executionGateSummary: previewSummary.executionGateSummary,
      healthCheckExecutionSummary: {
        requestedMode: request.requestedMode,
        mode: request.mode,
        healthCheckExecutionAllowedNow,
        healthCheckExecuted,
        providerNetworkCallAttempted,
        llmCompletionAttempted: false,
        promptRendered: false,
        promptStored: false,
        gateSummary,
        healthCheckBlockers: blockers,
        safeHealthCheckContract: {
          endpointCategory: endpointPlan?.endpointCategory ?? null,
          completionEndpointsForbidden: true,
          responseBodyReturned: false,
          rawHeadersReturned: false,
          secretValueExposed: false,
          timeoutMs: HEALTHCHECK_TIMEOUT_MS,
          retries: 0
        },
        sanitizedHealthCheckResult,
        currentSideEffectSummary: sideEffectSummary
      },
      blockingReasons: Array.from(new Set([...previewSummary.executionGateSummary.remainingBlockers, ...blockers])),
      warnings: buildWarnings(request.mode, providerNetworkCallAttempted)
    }
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmProviderHealthCheckExecutionRequest): {
  mode: HealthCheckExecutionRequestMode;
  requestedMode: string;
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
  confirmationPhrase: string | null;
  idempotencyKey: string | null;
} {
  const requestedMode = getString(rawRequest.mode) ?? "preview";
  return {
    mode: requestedMode === "preview" || requestedMode === "healthcheck_execute" ? requestedMode : "blocked_unsupported_mode",
    requestedMode,
    planId: getString(rawRequest.planId),
    planItemId: getString(rawRequest.planItemId),
    contentItemId: getString(rawRequest.contentItemId),
    confirmationPhrase: getString(rawRequest.confirmationPhrase),
    idempotencyKey: getString(rawRequest.idempotencyKey)
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildBlockers(
  request: { mode: HealthCheckExecutionRequestMode },
  gateSummary: DailyContentDraftGenerationLlmProviderHealthCheckExecutionSummary["healthCheckExecutionSummary"]["gateSummary"],
  endpointPlan: EndpointPlan | null
) {
  const blockers = new Set<string>();

  if (request.mode === "blocked_unsupported_mode") {
    blockers.add("draft_generation_llm_provider_health_check_execution_mode_not_allowed");
  }
  if (request.mode === "preview") {
    blockers.add("healthcheck_execution_not_requested");
  }
  if (!gateSummary.healthCheckFeatureFlagEnabled) {
    blockers.add("llm_provider_healthcheck_execution_feature_flag_disabled");
  }
  if (!gateSummary.providerNetworkCallsFeatureFlagEnabled) {
    blockers.add("llm_provider_network_call_feature_flag_disabled");
  }
  if (!gateSummary.confirmationPhraseSatisfied) {
    blockers.add("confirmation_phrase_missing");
  }
  if (!gateSummary.idempotencyKeyPresent) {
    blockers.add("idempotency_key_missing");
  }
  if (!gateSummary.providerRouteResolved) {
    blockers.add("llm_provider_route_not_configured_for_draft_generation");
  }
  if (!gateSummary.providerConfigFound) {
    blockers.add("llm_provider_config_not_found");
  }
  if (!gateSummary.modelCandidateResolved) {
    blockers.add("llm_model_candidate_not_resolved");
  }
  if (!gateSummary.requiredEnvPresent) {
    blockers.add("llm_required_env_missing");
  }
  if (!gateSummary.supportedHealthCheckProviderKind) {
    blockers.add(endpointPlan?.unsupportedReason ?? "llm_provider_health_check_not_supported_for_provider_kind");
  }

  return Array.from(blockers);
}

type EndpointPlan = {
  providerKind: string;
  endpointCategory: EndpointCategory;
  url: string;
  unsupportedReason?: string;
};

function buildEndpointPlan(provider: { providerType: string; apiFormat: string; invocationMode: string; baseUrl: string | null } | null): EndpointPlan | null {
  if (!provider) {
    return null;
  }
  if (provider.invocationMode === "cli" || provider.providerType === "cli") {
    return null;
  }
  const baseUrl = provider.baseUrl?.trim();
  if (!baseUrl) {
    return null;
  }
  if (provider.providerType === "local" || provider.providerType === "local_http" || provider.apiFormat === "ollama_compatible") {
    return {
      providerKind: provider.providerType,
      endpointCategory: "provider_version",
      url: joinUrl(baseUrl, "/api/version")
    };
  }
  if (provider.providerType === "openai" || provider.apiFormat === "openai_compatible") {
    return {
      providerKind: provider.providerType,
      endpointCategory: "provider_models_list",
      url: joinUrl(baseUrl, "/v1/models")
    };
  }
  return null;
}

async function runSafeProviderHealthCheck(endpointPlan: EndpointPlan): Promise<SanitizedHealthCheckResult> {
  const startedAt = Date.now();
  try {
    const response = await fetchWithTimeout(endpointPlan.url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });
    return {
      attempted: true,
      success: response.ok,
      statusCodeClass: statusCodeClass(response.status),
      elapsedMs: Date.now() - startedAt,
      providerKind: endpointPlan.providerKind,
      endpointCategory: endpointPlan.endpointCategory,
      errorCategory: response.ok ? null : "http_error",
      rawBodyExposed: false,
      rawHeadersExposed: false,
      secretValueExposed: false
    };
  } catch (error) {
    return {
      attempted: true,
      success: false,
      statusCodeClass: error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error",
      elapsedMs: Date.now() - startedAt,
      providerKind: endpointPlan.providerKind,
      endpointCategory: endpointPlan.endpointCategory,
      errorCategory: error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error",
      rawBodyExposed: false,
      rawHeadersExposed: false,
      secretValueExposed: false
    };
  }
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTHCHECK_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function statusCodeClass(status: number): StatusCodeClass {
  if (status >= 200 && status < 300) {
    return "2xx";
  }
  if (status >= 300 && status < 400) {
    return "3xx";
  }
  if (status >= 400 && status < 500) {
    return "4xx";
  }
  if (status >= 500 && status < 600) {
    return "5xx";
  }
  return "unknown";
}

function joinUrl(baseUrl: string, endpointPath: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`;
  return `${normalizedBase}${normalizedPath}`;
}

function buildSideEffectSummary(providerNetworkCallAttempted: boolean): DailyContentDraftGenerationLlmProviderHealthCheckExecutionSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    envRead: true,
    secretValueExposed: false,
    providerHealthChecked: providerNetworkCallAttempted,
    providerNetworkCall: providerNetworkCallAttempted,
    llmCall: false,
    llmCompletionCall: false,
    llmCallLogMutation: false,
    contentItemMutation: false,
    draftMarkdownMutation: false,
    draftHtmlMutation: false,
    bloggerWrite: false,
    bloggerDraftSave: false,
    bloggerPublish: false,
    scheduledPublish: false,
    oauthReconnect: false,
    tokenRefresh: false,
    publishApprovalMutation: false,
    publishAttemptMutation: false,
    externalSend: providerNetworkCallAttempted
  };
}

function buildWarnings(mode: HealthCheckExecutionRequestMode, providerNetworkCallAttempted: boolean) {
  const warnings = new Set<string>([
    "llm_completion_disabled_by_patch_policy",
    "prompt_rendering_disabled_by_patch_policy",
    "llm_call_log_mutation_disabled",
    "content_item_mutation_disabled",
    "blogger_write_disabled"
  ]);
  if (mode === "preview") {
    warnings.add("healthcheck_execution_preview_only");
  }
  if (mode === "blocked_unsupported_mode") {
    warnings.add("unsupported_mode_blocked");
  }
  if (!providerNetworkCallAttempted) {
    warnings.add("provider_network_call_not_attempted");
  }
  return Array.from(warnings);
}
