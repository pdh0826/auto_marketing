import type { LlmProviderType } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import {
  buildDailyContentDraftGenerationLlmProviderReadinessResponse,
  type DailyContentDraftGenerationLlmProviderReadinessResponse
} from "@/lib/daily-content-plans/draft-generation-llm-provider-readiness";
import {
  buildDailyContentDraftGenerationPromptQualityChecklistPreviewResponse,
  type DailyContentDraftGenerationPromptQualityChecklistPreviewResponse
} from "@/lib/daily-content-plans/draft-generation-prompt-quality-checklist-preview";
import {
  buildDailyContentDraftGenerationPromptRenderPreviewResponse,
  type DailyContentDraftGenerationPromptRenderPreviewResponse
} from "@/lib/daily-content-plans/draft-generation-prompt-render-preview";

const PATCH_VERSION = "9F-2T";
const PREVIEW_MODE = "read_only_draft_generation_llm_request_envelope_preview";
const ENVELOPE_VERSION = "daily_content_draft_generation_llm_request_envelope_v0";
const REQUEST_PURPOSE = "daily_content_draft_generation";
const SOURCE_PROMPT_PREVIEW_PATCH_VERSION = "9F-2R";
const SOURCE_PROMPT_QUALITY_PATCH_VERSION = "9F-2S";
const DRAFT_GENERATION_TASK_TYPE = "content_draft";
const MAX_MESSAGE_PREVIEW_CHARS = 1800;

type RequestEnvelopePreviewMode = "preview" | "blocked_non_preview";
type ProviderKind = LlmProviderType | "unknown" | null;
type EndpointHostCategory = "openai_api" | "local" | "internal_http" | "cli" | "unknown" | null;
type PayloadShape = "chat_messages" | "responses_input" | "completion_prompt" | "local_cli_args" | "unknown";

export interface DailyContentDraftGenerationLlmRequestEnvelopePreviewRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationLlmRequestEnvelopePreviewResponse
  extends DailyContentDraftGenerationLlmRequestEnvelopePreviewSummary {
  checkedAt: string;
  draftGenerationLlmRequestEnvelopePreviewSummary: DailyContentDraftGenerationLlmRequestEnvelopePreviewSummary;
}

export interface DailyContentDraftGenerationLlmRequestEnvelopePreviewSummary {
  patchVersion: "9F-2T";
  checked: true;
  mode: RequestEnvelopePreviewMode;
  requestedMode: string;
  previewMode: typeof PREVIEW_MODE;
  dryRunOnly: true;
  requestEnvelopeBuiltForPreview: true;
  requestEnvelopeStored: false;
  requestWouldBeSent: false;
  llmCallAttempted: false;
  providerNetworkCallAttempted: false;
  providerHealthCheckAttempted: false;
  contentMutationAttempted: false;
  targetSummary: PromptQualitySummary["targetSummary"];
  persistedApprovalSummary: PromptQualitySummary["persistedApprovalSummary"];
  executionGateSummary: PromptQualitySummary["executionGateSummary"];
  requestEnvelopePreviewSummary: RequestEnvelopePreviewSummary;
  currentSideEffectSummary: DailyContentDraftGenerationLlmRequestEnvelopePreviewSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface RequestEnvelopePreviewSummary {
  sourcePromptPreviewPatchVersion: typeof SOURCE_PROMPT_PREVIEW_PATCH_VERSION;
  sourcePromptQualityPatchVersion: typeof SOURCE_PROMPT_QUALITY_PATCH_VERSION;
  sourceProviderReadinessPatchVersion: "9F-2N";
  envelopeVersion: typeof ENVELOPE_VERSION;
  requestPurpose: typeof REQUEST_PURPOSE;
  requestEnvelopeBuiltForPreview: true;
  requestEnvelopeStored: false;
  requestWouldBeSent: false;
  dispatchAllowedNow: false;
  routeResolved: boolean;
  providerKind: ProviderKind;
  providerKey: string | null;
  modelKey: string | null;
  modelDisplayName: string | null;
  payloadShape: PayloadShape;
  promptSha256: string;
  promptCharLength: number;
  promptTokenEstimate: number | null;
  messageCount: number;
  headerValuesExposed: false;
  secretValuesExposed: false;
  endpointValueExposed: false;
  redactionSummary: {
    rawSecretsIncluded: false;
    rawTokensIncluded: false;
    rawEnvValuesIncluded: false;
    oauthCredentialsIncluded: false;
    providerCredentialsIncluded: false;
    authorizationHeaderValueIncluded: false;
    forbiddenPatternScanPassed: boolean;
    forbiddenPatternHitKeys: string[];
  };
  envelopePreview: RequestEnvelopePreview;
  dispatchBlockers: string[];
  warnings: string[];
}

export interface RequestEnvelopePreview {
  route: {
    taskName: typeof REQUEST_PURPOSE;
    providerKey: string | null;
    providerKind: ProviderKind;
    modelKey: string | null;
    modelDisplayName: string | null;
    routeResolved: boolean;
  };
  endpointPreview: {
    endpointKnown: boolean;
    endpointValueExposed: false;
    endpointHostCategory: EndpointHostCategory;
    secretQueryStringRemoved: true;
    networkCallAllowedNow: false;
  };
  headersPreview: {
    headerNamesOnly: true;
    valuesExposed: false;
    requiredHeaderNames: string[];
    redactedHeaderNames: string[];
  };
  payloadPreview: {
    payloadShape: PayloadShape;
    messagesPreview: Array<{
      role: "system" | "user" | "assistant";
      contentPreview: string;
      charLength: number;
      truncated: boolean;
    }>;
    promptSha256: string;
    promptCharLength: number;
    promptTokenEstimate: number | null;
    modelParameters: {
      temperature: number | null;
      maxTokens: number | null;
      topP: number | null;
      presencePenalty: number | null;
      frequencyPenalty: number | null;
    };
    responseFormatPlan: {
      expectedFormat: "markdown_draft";
      draftMarkdownTargetField: "content_items.draftMarkdown";
      draftHtmlTargetField: "content_items.draftHtml";
      outputStorageDeferred: true;
    };
  };
  idempotencyPlan: {
    idempotencyKeyRequiredForFutureDispatch: true;
    idempotencyKeyProvidedNow: false;
    idempotencyKeyStoredNow: false;
  };
  executionGuardPlan: {
    dispatchAllowedNow: false;
    requiredBeforeDispatch: string[];
  };
}

export interface DailyContentDraftGenerationLlmRequestEnvelopePreviewSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  envRead: true;
  secretValueExposed: false;
  promptRenderedForEnvelope: true;
  promptStored: false;
  requestEnvelopeBuiltForPreview: true;
  requestEnvelopeStored: false;
  requestSentToProvider: false;
  providerHealthChecked: false;
  providerNetworkCall: false;
  llmCall: false;
  llmEvaluatorCall: false;
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
  externalSend: false;
}

type PromptRenderSummary = DailyContentDraftGenerationPromptRenderPreviewResponse["draftGenerationPromptRenderPreviewSummary"];
type PromptQualitySummary =
  DailyContentDraftGenerationPromptQualityChecklistPreviewResponse["draftGenerationPromptQualityChecklistPreviewSummary"];
type LlmReadinessSummary =
  DailyContentDraftGenerationLlmProviderReadinessResponse["draftGenerationLlmProviderReadinessSummary"];

export async function buildDailyContentDraftGenerationLlmRequestEnvelopePreviewResponse(
  rawRequest: DailyContentDraftGenerationLlmRequestEnvelopePreviewRequest
): Promise<DailyContentDraftGenerationLlmRequestEnvelopePreviewResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const [promptRenderResponse, promptQualityResponse, llmReadinessResponse, routeMetadata] = await Promise.all([
    buildDailyContentDraftGenerationPromptRenderPreviewResponse({
      mode: "preview",
      planId: request.planId,
      planItemId: request.planItemId,
      contentItemId: request.contentItemId
    }),
    buildDailyContentDraftGenerationPromptQualityChecklistPreviewResponse({
      mode: "preview",
      planId: request.planId,
      planItemId: request.planItemId,
      contentItemId: request.contentItemId
    }),
    buildDailyContentDraftGenerationLlmProviderReadinessResponse({
      mode: "preview",
      planId: request.planId,
      planItemId: request.planItemId,
      contentItemId: request.contentItemId
    }),
    loadSafeRouteMetadata()
  ]);

  const promptRender = promptRenderResponse.draftGenerationPromptRenderPreviewSummary;
  const promptQuality = promptQualityResponse.draftGenerationPromptQualityChecklistPreviewSummary;
  const llmReadiness = llmReadinessResponse.draftGenerationLlmProviderReadinessSummary;
  const envelopePreviewSummary = buildRequestEnvelopePreviewSummary({
    promptRender,
    promptQuality,
    llmReadiness,
    routeMetadata
  });
  const blockingReasons = new Set<string>(promptQuality.executionGateSummary.remainingBlockers);

  for (const blocker of promptQuality.promptQualityChecklistSummary.qualityGateBlockingReasons) {
    blockingReasons.add(blocker);
  }
  for (const blocker of llmReadiness.llmProviderReadinessSummary.readinessBlockers) {
    blockingReasons.add(blocker);
  }
  for (const blocker of envelopePreviewSummary.dispatchBlockers) {
    blockingReasons.add(blocker);
  }
  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_llm_request_envelope_preview_is_preview_only");
  }

  const warnings = new Set<string>([
    "draft_generation_llm_request_envelope_preview_only",
    "request_envelope_not_stored",
    "request_not_sent_to_provider",
    "llm_call_disabled_by_patch_policy",
    "content_item_mutation_disabled"
  ]);
  for (const warning of promptQuality.warnings) {
    warnings.add(warning);
  }
  for (const warning of llmReadiness.warnings) {
    warnings.add(warning);
  }
  for (const warning of envelopePreviewSummary.warnings) {
    warnings.add(warning);
  }

  const summary: DailyContentDraftGenerationLlmRequestEnvelopePreviewSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    previewMode: PREVIEW_MODE,
    dryRunOnly: true,
    requestEnvelopeBuiltForPreview: true,
    requestEnvelopeStored: false,
    requestWouldBeSent: false,
    llmCallAttempted: false,
    providerNetworkCallAttempted: false,
    providerHealthCheckAttempted: false,
    contentMutationAttempted: false,
    targetSummary: promptQuality.targetSummary,
    persistedApprovalSummary: promptQuality.persistedApprovalSummary,
    executionGateSummary: {
      executionAllowed: false,
      finalDraftGenerationAllowed: false,
      remainingBlockers: promptQuality.executionGateSummary.remainingBlockers,
      resolvedBlockers: promptQuality.executionGateSummary.resolvedBlockers
    },
    requestEnvelopePreviewSummary: envelopePreviewSummary,
    currentSideEffectSummary: buildSideEffectSummary(),
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationLlmRequestEnvelopePreviewSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmRequestEnvelopePreviewRequest): {
  mode: RequestEnvelopePreviewMode;
  requestedMode: string;
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
} {
  const requestedMode = getString(rawRequest.mode) ?? "preview";
  return {
    mode: requestedMode === "preview" ? "preview" : "blocked_non_preview",
    requestedMode,
    planId: getString(rawRequest.planId),
    planItemId: getString(rawRequest.planItemId),
    contentItemId: getString(rawRequest.contentItemId)
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function loadSafeRouteMetadata() {
  const route = await prisma.llmTaskRoute.findUnique({
    where: { taskType: DRAFT_GENERATION_TASK_TYPE },
    select: {
      isEnabled: true,
      temperature: true,
      maxTokens: true,
      primaryProvider: {
        select: {
          id: true,
          providerType: true,
          baseUrl: true,
          endpointPath: true,
          isEnabled: true
        }
      },
      primaryModel: {
        select: {
          id: true,
          name: true,
          displayName: true,
          isEnabled: true
        }
      }
    }
  });

  return {
    routeResolved: Boolean(route?.isEnabled && route.primaryProvider?.isEnabled && route.primaryModel?.isEnabled),
    providerKey: route?.primaryProvider?.id ?? null,
    providerKind: route?.primaryProvider?.providerType ?? null,
    modelKey: route?.primaryModel?.id ?? null,
    modelDisplayName: route?.primaryModel?.displayName ?? route?.primaryModel?.name ?? null,
    temperature: route?.temperature ?? null,
    maxTokens: route?.maxTokens ?? null,
    endpointKnown: Boolean(route?.primaryProvider?.baseUrl || route?.primaryProvider?.endpointPath)
  };
}

function buildRequestEnvelopePreviewSummary(input: {
  promptRender: PromptRenderSummary;
  promptQuality: PromptQualitySummary;
  llmReadiness: LlmReadinessSummary;
  routeMetadata: Awaited<ReturnType<typeof loadSafeRouteMetadata>>;
}): RequestEnvelopePreviewSummary {
  const routePlan = input.llmReadiness.llmProviderReadinessSummary.routeResolutionPlan;
  const providerPlan = input.llmReadiness.llmProviderReadinessSummary.providerConfigPlan;
  const providerKind = input.routeMetadata.providerKind ?? providerPlan.providerKind ?? null;
  const providerKey = input.routeMetadata.providerKey ?? routePlan.selectedProviderKey;
  const modelKey = input.routeMetadata.modelKey ?? routePlan.selectedModelKey;
  const modelDisplayName = input.routeMetadata.modelDisplayName ?? routePlan.selectedModelDisplayName;
  const routeResolved = input.routeMetadata.routeResolved || routePlan.selectedRouteResolved;
  const payloadShape = resolvePayloadShape(providerKind);
  const promptSummary = input.promptRender.promptRenderPreviewSummary;
  const messagesPreview = buildMessagesPreview(input.promptRender, payloadShape);
  const envelopePreview: RequestEnvelopePreview = {
    route: {
      taskName: REQUEST_PURPOSE,
      providerKey,
      providerKind,
      modelKey,
      modelDisplayName,
      routeResolved
    },
    endpointPreview: {
      endpointKnown: input.routeMetadata.endpointKnown || Boolean(providerKind),
      endpointValueExposed: false,
      endpointHostCategory: resolveEndpointHostCategory(providerKind),
      secretQueryStringRemoved: true,
      networkCallAllowedNow: false
    },
    headersPreview: {
      headerNamesOnly: true,
      valuesExposed: false,
      requiredHeaderNames: buildRequiredHeaderNames(providerKind),
      redactedHeaderNames: buildRedactedHeaderNames(providerKind)
    },
    payloadPreview: {
      payloadShape,
      messagesPreview,
      promptSha256: promptSummary.promptSha256,
      promptCharLength: promptSummary.promptCharLength,
      promptTokenEstimate: promptSummary.estimatedPromptTokens,
      modelParameters: {
        temperature: input.routeMetadata.temperature,
        maxTokens: input.routeMetadata.maxTokens,
        topP: null,
        presencePenalty: null,
        frequencyPenalty: null
      },
      responseFormatPlan: {
        expectedFormat: "markdown_draft",
        draftMarkdownTargetField: "content_items.draftMarkdown",
        draftHtmlTargetField: "content_items.draftHtml",
        outputStorageDeferred: true
      }
    },
    idempotencyPlan: {
      idempotencyKeyRequiredForFutureDispatch: true,
      idempotencyKeyProvidedNow: false,
      idempotencyKeyStoredNow: false
    },
    executionGuardPlan: {
      dispatchAllowedNow: false,
      requiredBeforeDispatch: [
        "llm_execution_feature_flag",
        "content_mutation_feature_flag",
        "draft_generation_write_feature_flag",
        "confirmation_phrase",
        "idempotency_key",
        "provider_health_check_passed",
        "prompt_quality_gate_passed"
      ]
    }
  };
  const dispatchBlockers = Array.from(
    new Set([
      ...input.promptQuality.executionGateSummary.remainingBlockers,
      ...input.promptQuality.promptQualityChecklistSummary.qualityGateBlockingReasons,
      ...input.llmReadiness.llmProviderReadinessSummary.readinessBlockers
    ])
  );
  const forbiddenPatternHitKeys = scanForbiddenPatternKeys(envelopePreview);

  return {
    sourcePromptPreviewPatchVersion: SOURCE_PROMPT_PREVIEW_PATCH_VERSION,
    sourcePromptQualityPatchVersion: SOURCE_PROMPT_QUALITY_PATCH_VERSION,
    sourceProviderReadinessPatchVersion: "9F-2N",
    envelopeVersion: ENVELOPE_VERSION,
    requestPurpose: REQUEST_PURPOSE,
    requestEnvelopeBuiltForPreview: true,
    requestEnvelopeStored: false,
    requestWouldBeSent: false,
    dispatchAllowedNow: false,
    routeResolved,
    providerKind,
    providerKey,
    modelKey,
    modelDisplayName,
    payloadShape,
    promptSha256: promptSummary.promptSha256,
    promptCharLength: promptSummary.promptCharLength,
    promptTokenEstimate: promptSummary.estimatedPromptTokens,
    messageCount: messagesPreview.length,
    headerValuesExposed: false,
    secretValuesExposed: false,
    endpointValueExposed: false,
    redactionSummary: {
      rawSecretsIncluded: false,
      rawTokensIncluded: false,
      rawEnvValuesIncluded: false,
      oauthCredentialsIncluded: false,
      providerCredentialsIncluded: false,
      authorizationHeaderValueIncluded: false,
      forbiddenPatternScanPassed: forbiddenPatternHitKeys.length === 0,
      forbiddenPatternHitKeys
    },
    envelopePreview,
    dispatchBlockers,
    warnings: buildEnvelopeWarnings({
      routeResolved,
      providerKind,
      qualityGatePassed: input.promptQuality.promptQualityChecklistSummary.qualityGatePassed,
      forbiddenPatternHitKeys
    })
  };
}

function resolvePayloadShape(providerKind: ProviderKind): PayloadShape {
  if (providerKind === "openai" || providerKind === "external_http") {
    return "chat_messages";
  }
  if (providerKind === "local" || providerKind === "local_http") {
    return "completion_prompt";
  }
  if (providerKind === "cli") {
    return "local_cli_args";
  }
  return "unknown";
}

function resolveEndpointHostCategory(providerKind: ProviderKind): EndpointHostCategory {
  if (providerKind === "openai") {
    return "openai_api";
  }
  if (providerKind === "local" || providerKind === "local_http") {
    return "local";
  }
  if (providerKind === "external_http") {
    return "internal_http";
  }
  if (providerKind === "cli") {
    return "cli";
  }
  return providerKind ? "unknown" : null;
}

function buildRequiredHeaderNames(providerKind: ProviderKind) {
  if (providerKind === "openai" || providerKind === "external_http") {
    return ["content-type", "credential-header-redacted"];
  }
  if (providerKind === "local" || providerKind === "local_http") {
    return ["content-type"];
  }
  return [];
}

function buildRedactedHeaderNames(providerKind: ProviderKind) {
  if (providerKind === "openai" || providerKind === "external_http") {
    return ["credential-header-redacted"];
  }
  return [];
}

function buildMessagesPreview(promptRender: PromptRenderSummary, payloadShape: PayloadShape) {
  const promptSummary = promptRender.promptRenderPreviewSummary;
  const systemSection = promptSummary.promptSections.find((section) => section.key === "system_role_and_safety");
  const systemPreview = truncatePreview(systemSection?.previewText ?? "Daily content draft generation safety and format instructions.");
  const userPreview = truncatePreview(promptSummary.fullPromptPreview);

  if (payloadShape === "completion_prompt" || payloadShape === "local_cli_args") {
    return [
      {
        role: "user" as const,
        contentPreview: userPreview.value,
        charLength: promptSummary.fullPromptPreview.length,
        truncated: userPreview.truncated
      }
    ];
  }

  return [
    {
      role: "system" as const,
      contentPreview: systemPreview.value,
      charLength: systemSection?.previewText.length ?? systemPreview.value.length,
      truncated: systemPreview.truncated
    },
    {
      role: "user" as const,
      contentPreview: userPreview.value,
      charLength: promptSummary.fullPromptPreview.length,
      truncated: userPreview.truncated
    }
  ];
}

function truncatePreview(value: string) {
  if (value.length <= MAX_MESSAGE_PREVIEW_CHARS) {
    return { value, truncated: false };
  }
  return {
    value: `${value.slice(0, MAX_MESSAGE_PREVIEW_CHARS)}\n[truncated for request envelope preview]`,
    truncated: true
  };
}

function scanForbiddenPatternKeys(value: unknown) {
  const text = JSON.stringify(value);
  const patterns: Array<{ key: string; pattern: string }> = [
    { key: "openai_key_prefix", pattern: "sk-" },
    { key: "bearer_header_value", pattern: "Bearer " },
    { key: "oauth_refresh_token_literal", pattern: "refresh_token" },
    { key: "oauth_access_token_literal", pattern: "access_token" },
    { key: "openai_env_assignment", pattern: "OPENAI_API_KEY=" },
    { key: "generic_api_env_assignment", pattern: "API_KEY=" },
    { key: "password_env_assignment", pattern: "PASSWORD=" },
    { key: "secret_env_assignment", pattern: "SECRET=" },
    { key: "authorization_header_line", pattern: "Authorization:" }
  ];
  return patterns.filter((entry) => text.includes(entry.pattern)).map((entry) => entry.key);
}

function buildEnvelopeWarnings(input: {
  routeResolved: boolean;
  providerKind: ProviderKind;
  qualityGatePassed: boolean;
  forbiddenPatternHitKeys: string[];
}) {
  const warnings = new Set<string>(["request_envelope_preview_not_a_dispatch", "request_body_not_stored", "request_body_not_sent"]);
  if (!input.routeResolved) {
    warnings.add("llm_route_not_resolved_for_future_dispatch");
  }
  if (!input.providerKind) {
    warnings.add("llm_provider_kind_unknown");
  }
  if (!input.qualityGatePassed) {
    warnings.add("prompt_quality_gate_not_passed");
  }
  if (input.forbiddenPatternHitKeys.length > 0) {
    warnings.add("request_envelope_forbidden_pattern_detected");
  }
  return Array.from(warnings);
}

function buildSideEffectSummary(): DailyContentDraftGenerationLlmRequestEnvelopePreviewSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    envRead: true,
    secretValueExposed: false,
    promptRenderedForEnvelope: true,
    promptStored: false,
    requestEnvelopeBuiltForPreview: true,
    requestEnvelopeStored: false,
    requestSentToProvider: false,
    providerHealthChecked: false,
    providerNetworkCall: false,
    llmCall: false,
    llmEvaluatorCall: false,
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
    externalSend: false
  };
}
