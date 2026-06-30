import {
  buildDailyContentDraftGenerationLlmDispatchAttemptReadbackResponse,
  type DailyContentDraftGenerationLlmDispatchAttemptReadbackResponse,
  type DispatchAuditCounts
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-attempt-readback";
import {
  buildDailyContentDraftGenerationLlmProviderHealthCheckExecutionResponse,
  type DailyContentDraftGenerationLlmProviderHealthCheckExecutionResponse
} from "@/lib/daily-content-plans/draft-generation-llm-provider-health-check-execution";

const PATCH_VERSION = "9F-3F";
const READBACK_MODE = "read_only_draft_generation_llm_provider_health_check_readback";
const READBACK_VERSION = "daily_content_draft_generation_llm_provider_health_check_readback_v0";

type HealthCheckReadbackMode = "preview" | "blocked_non_preview";
type AttemptReadbackSummary =
  DailyContentDraftGenerationLlmDispatchAttemptReadbackResponse["draftGenerationLlmDispatchAttemptReadbackSummary"];
type HealthExecutionSummary =
  DailyContentDraftGenerationLlmProviderHealthCheckExecutionResponse["draftGenerationLlmProviderHealthCheckExecutionSummary"];

export interface DailyContentDraftGenerationLlmProviderHealthCheckReadbackRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationLlmProviderHealthCheckReadbackResponse
  extends DailyContentDraftGenerationLlmProviderHealthCheckReadbackSummary {
  checkedAt: string;
  draftGenerationLlmProviderHealthCheckReadbackSummary: DailyContentDraftGenerationLlmProviderHealthCheckReadbackSummary;
}

export interface DailyContentDraftGenerationLlmProviderHealthCheckReadbackSummary {
  patchVersion: "9F-3F";
  checked: true;
  mode: HealthCheckReadbackMode;
  requestedMode: string;
  readbackMode: typeof READBACK_MODE;
  readbackOnly: true;
  dryRunOnly: true;
  auditRowsCreatedNow: false;
  auditRowsMutatedNow: false;
  providerNetworkCallAttempted: false;
  llmCallAttempted: false;
  contentMutationAttempted: false;
  bloggerWriteAttempted: false;
  targetSummary: AttemptReadbackSummary["targetSummary"];
  persistedApprovalSummary: AttemptReadbackSummary["persistedApprovalSummary"];
  executionGateSummary: AttemptReadbackSummary["executionGateSummary"];
  healthCheckReadbackSummary: HealthCheckReadbackSummary;
  currentSideEffectSummary: DailyContentDraftGenerationLlmProviderHealthCheckReadbackSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface HealthCheckReadbackSummary {
  readbackVersion: typeof READBACK_VERSION;
  sourceHealthCheckExecutionPatchVersion: "9F-2P";
  latestAttemptFound: boolean;
  latestAttemptId: string | null;
  latestAttemptStatus: string | null;
  auditCounts: {
    global: DispatchAuditCounts;
    targetScoped: DispatchAuditCounts;
  };
  persistedHealthCheckReference: {
    persistedReferenceFound: boolean;
    healthCheckReferenceId: string | null;
    healthCheckSummaryHash: string | null;
    persistedResultSource: "dispatch_attempt_fields";
    persistedResultBodyReturned: false;
    rawProviderBodyStoredOrReturned: false;
    rawProviderHeadersStoredOrReturned: false;
    secretOrTokenStoredOrReturned: false;
  };
  transientRunReadback: {
    latestPositiveRunPersistedBy9F3E: false;
    priorHealthCheckWasTransient: true;
    readbackCanProveProviderWasCalledEarlier: false;
    readbackCanProveCurrentProviderGateShape: true;
    healthCheckEventOrArtifactCreationAllowedInThisPatch: false;
  };
  latestAttemptSideEffectMarkers: {
    providerNetworkCallAttempted: boolean;
    llmCallAttempted: boolean;
    llmCompletionReceived: boolean;
    contentMutationAttempted: boolean;
    draftMutationAttempted: boolean;
    bloggerWriteAttempted: boolean;
  } | null;
  currentGateReadback: {
    executionMode: HealthExecutionSummary["executionMode"];
    endpointCategory: HealthExecutionSummary["healthCheckExecutionSummary"]["safeHealthCheckContract"]["endpointCategory"];
    healthCheckExecutionAllowedNow: boolean;
    healthCheckExecutedNow: false;
    providerNetworkCallAttemptedNow: false;
    sanitizedResultReturned: false;
    completionEndpointsForbidden: true;
    responseBodyReturned: false;
    rawHeadersReturned: false;
    secretValueExposed: false;
    gateSummary: HealthExecutionSummary["healthCheckExecutionSummary"]["gateSummary"];
    healthCheckBlockers: string[];
  };
  readbackBlockers: string[];
  nextSafePatchCandidate: "9F-3G";
  nextSafePatchPurpose: string;
}

export interface DailyContentDraftGenerationLlmProviderHealthCheckReadbackSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  auditAttemptMutation: false;
  auditEventMutation: false;
  auditArtifactMutation: false;
  auditRowsCreated: false;
  requestSentToProvider: false;
  providerHealthChecked: false;
  providerNetworkCall: false;
  llmCall: false;
  llmCompletionCall: false;
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

export async function buildDailyContentDraftGenerationLlmProviderHealthCheckReadbackResponse(
  rawRequest: DailyContentDraftGenerationLlmProviderHealthCheckReadbackRequest
): Promise<DailyContentDraftGenerationLlmProviderHealthCheckReadbackResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const [attemptReadback, healthExecutionPreview] = await Promise.all([
    buildDailyContentDraftGenerationLlmDispatchAttemptReadbackResponse({
      mode: "preview",
      planId: request.planId,
      planItemId: request.planItemId,
      contentItemId: request.contentItemId
    }),
    buildDailyContentDraftGenerationLlmProviderHealthCheckExecutionResponse({
      mode: "preview",
      planId: request.planId,
      planItemId: request.planItemId,
      contentItemId: request.contentItemId
    })
  ]);
  const attemptSummary = attemptReadback.draftGenerationLlmDispatchAttemptReadbackSummary;
  const healthExecutionSummary = healthExecutionPreview.draftGenerationLlmProviderHealthCheckExecutionSummary;
  const healthCheckReadbackSummary = buildHealthCheckReadbackSummary(attemptSummary, healthExecutionSummary);
  const blockingReasons = new Set<string>(healthCheckReadbackSummary.readbackBlockers);

  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_llm_provider_health_check_readback_is_preview_only");
  }

  const warnings = new Set<string>([
    "draft_generation_llm_provider_health_check_readback_only",
    "health_check_result_persistence_disabled_by_patch_policy",
    "provider_network_call_disabled_by_patch_policy",
    "llm_completion_disabled_by_patch_policy",
    "content_item_mutation_disabled"
  ]);
  const sideEffectSummary = buildSideEffectSummary();
  const summary: DailyContentDraftGenerationLlmProviderHealthCheckReadbackSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    readbackMode: READBACK_MODE,
    readbackOnly: true,
    dryRunOnly: true,
    auditRowsCreatedNow: false,
    auditRowsMutatedNow: false,
    providerNetworkCallAttempted: false,
    llmCallAttempted: false,
    contentMutationAttempted: false,
    bloggerWriteAttempted: false,
    targetSummary: attemptSummary.targetSummary,
    persistedApprovalSummary: attemptSummary.persistedApprovalSummary,
    executionGateSummary: {
      executionAllowed: false,
      finalDraftGenerationAllowed: false,
      remainingBlockers: attemptSummary.executionGateSummary.remainingBlockers,
      resolvedBlockers: attemptSummary.executionGateSummary.resolvedBlockers
    },
    healthCheckReadbackSummary,
    currentSideEffectSummary: sideEffectSummary,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationLlmProviderHealthCheckReadbackSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmProviderHealthCheckReadbackRequest): {
  mode: HealthCheckReadbackMode;
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

function buildHealthCheckReadbackSummary(attemptSummary: AttemptReadbackSummary, healthExecutionSummary: HealthExecutionSummary): HealthCheckReadbackSummary {
  const latestAttempt = attemptSummary.dispatchAttemptReadbackSummary.latestTargetAttempt;
  const blockers = new Set<string>();

  if (!attemptSummary.dispatchAttemptReadbackSummary.auditTablesExist) {
    blockers.add("draft_generation_llm_dispatch_audit_tables_missing");
  }
  if (!latestAttempt) {
    blockers.add("dispatch_attempt_not_found");
  }
  if (!latestAttempt?.healthCheckReferenceId && !latestAttempt?.healthCheckSummaryHash) {
    blockers.add("health_check_reference_not_persisted");
  }
  blockers.add("health_check_result_is_transient_until_future_audit_patch");

  return {
    readbackVersion: READBACK_VERSION,
    sourceHealthCheckExecutionPatchVersion: "9F-2P",
    latestAttemptFound: Boolean(latestAttempt),
    latestAttemptId: latestAttempt?.id ?? null,
    latestAttemptStatus: latestAttempt?.attemptStatus ?? null,
    auditCounts: {
      global: attemptSummary.dispatchAttemptReadbackSummary.globalCounts,
      targetScoped: attemptSummary.dispatchAttemptReadbackSummary.targetScopedCounts
    },
    persistedHealthCheckReference: {
      persistedReferenceFound: Boolean(latestAttempt?.healthCheckReferenceId || latestAttempt?.healthCheckSummaryHash),
      healthCheckReferenceId: latestAttempt?.healthCheckReferenceId ?? null,
      healthCheckSummaryHash: latestAttempt?.healthCheckSummaryHash ?? null,
      persistedResultSource: "dispatch_attempt_fields",
      persistedResultBodyReturned: false,
      rawProviderBodyStoredOrReturned: false,
      rawProviderHeadersStoredOrReturned: false,
      secretOrTokenStoredOrReturned: false
    },
    transientRunReadback: {
      latestPositiveRunPersistedBy9F3E: false,
      priorHealthCheckWasTransient: true,
      readbackCanProveProviderWasCalledEarlier: false,
      readbackCanProveCurrentProviderGateShape: true,
      healthCheckEventOrArtifactCreationAllowedInThisPatch: false
    },
    latestAttemptSideEffectMarkers: latestAttempt
      ? {
          providerNetworkCallAttempted: latestAttempt.providerNetworkCallAttempted,
          llmCallAttempted: latestAttempt.llmCallAttempted,
          llmCompletionReceived: latestAttempt.llmCompletionReceived,
          contentMutationAttempted: latestAttempt.contentMutationAttempted,
          draftMutationAttempted: latestAttempt.draftMutationAttempted,
          bloggerWriteAttempted: latestAttempt.bloggerWriteAttempted
        }
      : null,
    currentGateReadback: {
      executionMode: healthExecutionSummary.executionMode,
      endpointCategory: healthExecutionSummary.healthCheckExecutionSummary.safeHealthCheckContract.endpointCategory,
      healthCheckExecutionAllowedNow: false,
      healthCheckExecutedNow: false,
      providerNetworkCallAttemptedNow: false,
      sanitizedResultReturned: false,
      completionEndpointsForbidden: true,
      responseBodyReturned: false,
      rawHeadersReturned: false,
      secretValueExposed: false,
      gateSummary: healthExecutionSummary.healthCheckExecutionSummary.gateSummary,
      healthCheckBlockers: healthExecutionSummary.healthCheckExecutionSummary.healthCheckBlockers
    },
    readbackBlockers: Array.from(blockers),
    nextSafePatchCandidate: "9F-3G",
    nextSafePatchPurpose: "Draft-generation LLM dispatch final preflight, no provider call/no LLM call/no content mutation"
  };
}

function buildSideEffectSummary(): DailyContentDraftGenerationLlmProviderHealthCheckReadbackSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    auditAttemptMutation: false,
    auditEventMutation: false,
    auditArtifactMutation: false,
    auditRowsCreated: false,
    requestSentToProvider: false,
    providerHealthChecked: false,
    providerNetworkCall: false,
    llmCall: false,
    llmCompletionCall: false,
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
