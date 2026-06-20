import {
  buildDailyContentDraftGenerationLlmProviderReadinessResponse,
  type DailyContentDraftGenerationLlmProviderReadinessResponse
} from "@/lib/daily-content-plans/draft-generation-llm-provider-readiness";

const PATCH_VERSION = "9F-2O";
const HEALTH_CHECK_PREVIEW_MODE = "read_only_llm_provider_health_check_preview";

type HealthCheckPreviewRequestMode = "preview" | "healthcheck_preview" | "blocked_non_preview";

export interface DailyContentDraftGenerationLlmProviderHealthCheckPreviewRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationLlmProviderHealthCheckPreviewResponse {
  checkedAt: string;
  draftGenerationLlmProviderHealthCheckPreviewSummary: DailyContentDraftGenerationLlmProviderHealthCheckPreviewSummary;
}

export interface DailyContentDraftGenerationLlmProviderHealthCheckPreviewSummary {
  patchVersion: "9F-2O";
  checked: true;
  mode: HealthCheckPreviewRequestMode;
  requestedMode: string;
  healthCheckPreviewMode: typeof HEALTH_CHECK_PREVIEW_MODE;
  dryRunOnly: true;
  llmCompletionAttempted: false;
  promptRendered: false;
  rawPromptStored: false;
  providerHealthCheckAttempted: false;
  providerNetworkCallAttempted: false;
  targetSummary: DailyContentDraftGenerationLlmProviderReadinessSummary["targetSummary"];
  persistedApprovalSummary: DailyContentDraftGenerationLlmProviderReadinessSummary["persistedApprovalSummary"];
  executionGateSummary: DailyContentDraftGenerationLlmProviderReadinessSummary["executionGateSummary"];
  llmProviderReadinessSummary: {
    readinessAllowed: false;
    readinessLevel: "static_config_preview_only";
    taskName: string;
    taskPurpose: string;
    selectedRouteResolved: boolean;
    selectedProviderKey: string | null;
    selectedModelKey: string | null;
    selectedModelDisplayName: string | null;
    providerConfigFound: boolean;
    providerKind: string | null;
    modelConfigFound: boolean;
    rawSecretValueExposed: false;
    sourceReadinessSummary: DailyContentDraftGenerationLlmProviderReadinessSummary["llmProviderReadinessSummary"];
  };
  healthCheckPreviewSummary: {
    healthCheckAllowedNow: false;
    healthCheckModeRequested: string;
    healthCheckExecutionDeferred: true;
    healthCheckKind: "provider_connectivity_preview";
    providerHealthCheckRequiredBeforeExecution: true;
    plannedHealthCheckContract: {
      willUseSelectedProviderFromReadiness: boolean;
      willUseSelectedModelFromReadinessIfRequired: boolean;
      willSendDraftPrompt: false;
      willSendUserContent: false;
      willRequestCompletion: false;
      willCreateLlmCallLog: false;
      willMutateContentItem: false;
      willMutateDraftFields: false;
      willWriteBlogger: false;
      plannedTimeoutMs: 3000;
      plannedRetryCount: 0;
      plannedRedactionPolicy: "presence_only_no_secret_values";
      plannedResultShape: string[];
    };
    providerSpecificPlan: {
      openai: {
        allowedHealthCheckType: "non_completion_connectivity_or_models_metadata_only";
        completionEndpointAllowed: false;
        promptAllowed: false;
        apiKeyValueExposed: false;
      };
      local: {
        allowedHealthCheckType: "local_service_ping_or_version_only";
        generateEndpointAllowed: false;
        promptAllowed: false;
      };
      http: {
        allowedHealthCheckType: "safe_status_or_metadata_endpoint_only";
        completionEndpointAllowed: false;
        promptAllowed: false;
      };
      cli: {
        allowedHealthCheckType: "version_or_presence_check_only";
        promptExecutionAllowed: false;
      };
    };
    healthCheckBlockers: string[];
    healthCheckWarnings: string[];
    nextExecutionPrerequisites: {
      requiresHealthCheckExecutionPatch: true;
      requiresHealthCheckFeatureFlag: true;
      requiresConfirmationPhrase: true;
      requiresIdempotencyKey: true;
      requiresNoPromptNoCompletionContract: true;
      requiresResultRedaction: true;
      requiresTimeout: true;
    };
    currentSideEffectSummary: DailyContentDraftGenerationLlmProviderHealthCheckPreviewSideEffectSummary;
  };
  blockingReasons: string[];
  warnings: string[];
}

export interface DailyContentDraftGenerationLlmProviderHealthCheckPreviewSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  envRead: true;
  secretValueExposed: false;
  providerHealthCheck: false;
  providerNetworkCall: false;
  llmCompletion: false;
  llmCall: false;
  llmCallLogMutation: false;
  promptRendered: false;
  rawPromptStored: false;
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

type DailyContentDraftGenerationLlmProviderReadinessSummary =
  DailyContentDraftGenerationLlmProviderReadinessResponse["draftGenerationLlmProviderReadinessSummary"];

export async function buildDailyContentDraftGenerationLlmProviderHealthCheckPreviewResponse(
  rawRequest: DailyContentDraftGenerationLlmProviderHealthCheckPreviewRequest
): Promise<DailyContentDraftGenerationLlmProviderHealthCheckPreviewResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const readinessResponse = await buildDailyContentDraftGenerationLlmProviderReadinessResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const readinessSummary = readinessResponse.draftGenerationLlmProviderReadinessSummary;
  const healthCheckBlockers = buildHealthCheckBlockers(request.mode);
  const healthCheckWarnings = buildHealthCheckWarnings(request.mode);
  const blockingReasons = new Set<string>([
    ...readinessSummary.executionGateSummary.remainingBlockers,
    ...readinessSummary.llmProviderReadinessSummary.readinessBlockers,
    ...healthCheckBlockers
  ]);

  if (request.mode === "blocked_non_preview") {
    blockingReasons.add("draft_generation_llm_provider_health_check_preview_is_preview_only");
  }

  return {
    checkedAt: checkedAt.toISOString(),
    draftGenerationLlmProviderHealthCheckPreviewSummary: {
      patchVersion: PATCH_VERSION,
      checked: true,
      mode: request.mode,
      requestedMode: request.requestedMode,
      healthCheckPreviewMode: HEALTH_CHECK_PREVIEW_MODE,
      dryRunOnly: true,
      llmCompletionAttempted: false,
      promptRendered: false,
      rawPromptStored: false,
      providerHealthCheckAttempted: false,
      providerNetworkCallAttempted: false,
      targetSummary: readinessSummary.targetSummary,
      persistedApprovalSummary: readinessSummary.persistedApprovalSummary,
      executionGateSummary: readinessSummary.executionGateSummary,
      llmProviderReadinessSummary: {
        readinessAllowed: false,
        readinessLevel: "static_config_preview_only",
        taskName: readinessSummary.llmProviderReadinessSummary.taskName,
        taskPurpose: readinessSummary.llmProviderReadinessSummary.taskPurpose,
        selectedRouteResolved: readinessSummary.llmProviderReadinessSummary.routeResolutionPlan.selectedRouteResolved,
        selectedProviderKey: readinessSummary.llmProviderReadinessSummary.routeResolutionPlan.selectedProviderKey,
        selectedModelKey: readinessSummary.llmProviderReadinessSummary.routeResolutionPlan.selectedModelKey,
        selectedModelDisplayName: readinessSummary.llmProviderReadinessSummary.routeResolutionPlan.selectedModelDisplayName,
        providerConfigFound: readinessSummary.llmProviderReadinessSummary.providerConfigPlan.providerConfigFound,
        providerKind: readinessSummary.llmProviderReadinessSummary.providerConfigPlan.providerKind,
        modelConfigFound: readinessSummary.llmProviderReadinessSummary.modelConfigPlan.modelConfigFound,
        rawSecretValueExposed: false,
        sourceReadinessSummary: readinessSummary.llmProviderReadinessSummary
      },
      healthCheckPreviewSummary: {
        healthCheckAllowedNow: false,
        healthCheckModeRequested: request.requestedMode,
        healthCheckExecutionDeferred: true,
        healthCheckKind: "provider_connectivity_preview",
        providerHealthCheckRequiredBeforeExecution: true,
        plannedHealthCheckContract: {
          willUseSelectedProviderFromReadiness: readinessSummary.llmProviderReadinessSummary.routeResolutionPlan.selectedRouteResolved,
          willUseSelectedModelFromReadinessIfRequired: readinessSummary.llmProviderReadinessSummary.modelConfigPlan.modelCandidateResolved,
          willSendDraftPrompt: false,
          willSendUserContent: false,
          willRequestCompletion: false,
          willCreateLlmCallLog: false,
          willMutateContentItem: false,
          willMutateDraftFields: false,
          willWriteBlogger: false,
          plannedTimeoutMs: 3000,
          plannedRetryCount: 0,
          plannedRedactionPolicy: "presence_only_no_secret_values",
          plannedResultShape: ["providerKey", "providerKind", "connectivityStatus", "authStatus", "modelVisibilityStatus", "latencyMs", "checkedAt"]
        },
        providerSpecificPlan: buildProviderSpecificPlan(),
        healthCheckBlockers,
        healthCheckWarnings,
        nextExecutionPrerequisites: {
          requiresHealthCheckExecutionPatch: true,
          requiresHealthCheckFeatureFlag: true,
          requiresConfirmationPhrase: true,
          requiresIdempotencyKey: true,
          requiresNoPromptNoCompletionContract: true,
          requiresResultRedaction: true,
          requiresTimeout: true
        },
        currentSideEffectSummary: buildSideEffectSummary()
      },
      blockingReasons: Array.from(blockingReasons),
      warnings: [
        "healthcheck_preview_only",
        "provider_network_call_not_attempted_in_9F_2O",
        "llm_completion_disabled_by_patch_policy",
        "prompt_rendering_disabled_by_patch_policy",
        "content_item_mutation_disabled",
        "blogger_write_disabled"
      ]
    }
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmProviderHealthCheckPreviewRequest): {
  mode: HealthCheckPreviewRequestMode;
  requestedMode: string;
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
} {
  const requestedMode = getString(rawRequest.mode) ?? "preview";
  const allowedMode = requestedMode === "preview" || requestedMode === "healthcheck_preview";

  return {
    mode: allowedMode ? requestedMode : "blocked_non_preview",
    requestedMode,
    planId: getString(rawRequest.planId),
    planItemId: getString(rawRequest.planItemId),
    contentItemId: getString(rawRequest.contentItemId)
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildHealthCheckBlockers(mode: HealthCheckPreviewRequestMode) {
  const blockers = new Set<string>([
    "llm_provider_healthcheck_feature_flag_disabled",
    "healthcheck_confirmation_phrase_missing",
    "healthcheck_idempotency_key_missing",
    "llm_completion_disabled_by_patch_policy",
    "content_mutation_disabled_by_patch_policy"
  ]);

  if (mode === "blocked_non_preview") {
    blockers.add("draft_generation_llm_provider_health_check_preview_is_preview_only");
  }

  return Array.from(blockers);
}

function buildHealthCheckWarnings(mode: HealthCheckPreviewRequestMode) {
  const warnings = new Set<string>([
    "healthcheck_execution_deferred_to_next_patch",
    "provider_network_call_not_attempted_in_9F_2O",
    "llm_completion_not_attempted",
    "draft_prompt_not_rendered_or_stored"
  ]);

  if (mode === "healthcheck_preview") {
    warnings.add("healthcheck_preview_requested_but_execution_blocked_by_design");
  }

  if (mode === "blocked_non_preview") {
    warnings.add("unsupported_mode_blocked_by_preview_only_policy");
  }

  return Array.from(warnings);
}

function buildProviderSpecificPlan() {
  return {
    openai: {
      allowedHealthCheckType: "non_completion_connectivity_or_models_metadata_only" as const,
      completionEndpointAllowed: false as const,
      promptAllowed: false as const,
      apiKeyValueExposed: false as const
    },
    local: {
      allowedHealthCheckType: "local_service_ping_or_version_only" as const,
      generateEndpointAllowed: false as const,
      promptAllowed: false as const
    },
    http: {
      allowedHealthCheckType: "safe_status_or_metadata_endpoint_only" as const,
      completionEndpointAllowed: false as const,
      promptAllowed: false as const
    },
    cli: {
      allowedHealthCheckType: "version_or_presence_check_only" as const,
      promptExecutionAllowed: false as const
    }
  };
}

function buildSideEffectSummary(): DailyContentDraftGenerationLlmProviderHealthCheckPreviewSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    envRead: true,
    secretValueExposed: false,
    providerHealthCheck: false,
    providerNetworkCall: false,
    llmCompletion: false,
    llmCall: false,
    llmCallLogMutation: false,
    promptRendered: false,
    rawPromptStored: false,
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
