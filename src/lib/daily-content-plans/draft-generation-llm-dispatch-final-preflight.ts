import {
  buildDailyContentDraftGenerationLlmDispatchAttemptReadbackResponse,
  type DailyContentDraftGenerationLlmDispatchAttemptReadbackResponse
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-attempt-readback";
import {
  buildDailyContentDraftGenerationLlmProviderHealthCheckReadbackResponse,
  type DailyContentDraftGenerationLlmProviderHealthCheckReadbackResponse
} from "@/lib/daily-content-plans/draft-generation-llm-provider-health-check-readback";
import {
  buildDailyContentDraftGenerationLlmProviderReadinessResponse,
  type DailyContentDraftGenerationLlmProviderReadinessResponse
} from "@/lib/daily-content-plans/draft-generation-llm-provider-readiness";
import {
  buildDailyContentDraftGenerationLlmRequestEnvelopePreviewResponse,
  type DailyContentDraftGenerationLlmRequestEnvelopePreviewResponse
} from "@/lib/daily-content-plans/draft-generation-llm-request-envelope-preview";
import {
  buildDailyContentDraftGenerationPromptQualityChecklistPreviewResponse,
  type DailyContentDraftGenerationPromptQualityChecklistPreviewResponse
} from "@/lib/daily-content-plans/draft-generation-prompt-quality-checklist-preview";

const PATCH_VERSION = "9F-3G";
const PREFLIGHT_MODE = "read_only_draft_generation_llm_dispatch_final_preflight";
const PREFLIGHT_VERSION = "daily_content_draft_generation_llm_dispatch_final_preflight_v0";

type FinalPreflightMode = "preview" | "blocked_non_preview";
type AttemptReadbackSummary =
  DailyContentDraftGenerationLlmDispatchAttemptReadbackResponse["draftGenerationLlmDispatchAttemptReadbackSummary"];
type PromptQualitySummary =
  DailyContentDraftGenerationPromptQualityChecklistPreviewResponse["draftGenerationPromptQualityChecklistPreviewSummary"];
type RequestEnvelopeSummary =
  DailyContentDraftGenerationLlmRequestEnvelopePreviewResponse["draftGenerationLlmRequestEnvelopePreviewSummary"];
type ProviderReadinessSummary =
  DailyContentDraftGenerationLlmProviderReadinessResponse["draftGenerationLlmProviderReadinessSummary"];
type HealthCheckReadbackSummary =
  DailyContentDraftGenerationLlmProviderHealthCheckReadbackResponse["draftGenerationLlmProviderHealthCheckReadbackSummary"];

export interface DailyContentDraftGenerationLlmDispatchFinalPreflightRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationLlmDispatchFinalPreflightResponse
  extends DailyContentDraftGenerationLlmDispatchFinalPreflightSummary {
  checkedAt: string;
  draftGenerationLlmDispatchFinalPreflightSummary: DailyContentDraftGenerationLlmDispatchFinalPreflightSummary;
}

export interface DailyContentDraftGenerationLlmDispatchFinalPreflightSummary {
  patchVersion: "9F-3G";
  checked: true;
  mode: FinalPreflightMode;
  requestedMode: string;
  preflightMode: typeof PREFLIGHT_MODE;
  readOnly: true;
  dryRunOnly: true;
  dispatchExecutionAllowedInThisPatch: false;
  providerNetworkCallAttempted: false;
  llmCallAttempted: false;
  contentMutationAttempted: false;
  bloggerWriteAttempted: false;
  targetSummary: AttemptReadbackSummary["targetSummary"];
  persistedApprovalSummary: AttemptReadbackSummary["persistedApprovalSummary"];
  executionGateSummary: AttemptReadbackSummary["executionGateSummary"];
  finalPreflightSummary: FinalPreflightSummary;
  currentSideEffectSummary: DailyContentDraftGenerationLlmDispatchFinalPreflightSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface FinalPreflightSummary {
  preflightVersion: typeof PREFLIGHT_VERSION;
  latestAttemptId: string | null;
  finalPreflightReadyForPlanLock: boolean;
  readyForLlmDispatchExecution: false;
  dispatchExecutionWouldBeBlocked: true;
  attemptAuditReady: boolean;
  eventAuditReady: boolean;
  artifactAuditReady: boolean;
  promptQualityReady: boolean;
  requestEnvelopeReady: boolean;
  providerRouteReady: boolean;
  providerHealthCheckReferenceFound: boolean;
  providerHealthCheckResultStillTransient: boolean;
  idempotencyPolicyReady: boolean;
  confirmationPolicyReady: boolean;
  checks: Array<{
    key: string;
    status: "pass" | "blocked" | "warn";
    label: string;
    detail: string;
    blockerCode?: string;
  }>;
  blockers: string[];
  nextRequiredInputs: string[];
  nextSafePatchCandidate: "9F-3H";
  nextSafePatchPurpose: string;
}

export interface DailyContentDraftGenerationLlmDispatchFinalPreflightSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  envRead: true;
  secretValueExposed: false;
  promptRenderedForPreflight: true;
  promptStored: false;
  requestEnvelopeBuiltForPreview: true;
  requestEnvelopeStored: false;
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

export async function buildDailyContentDraftGenerationLlmDispatchFinalPreflightResponse(
  rawRequest: DailyContentDraftGenerationLlmDispatchFinalPreflightRequest
): Promise<DailyContentDraftGenerationLlmDispatchFinalPreflightResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const [attemptReadback, promptQuality, requestEnvelope, providerReadiness, healthCheckReadback] = await Promise.all([
    buildDailyContentDraftGenerationLlmDispatchAttemptReadbackResponse({
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
    buildDailyContentDraftGenerationLlmRequestEnvelopePreviewResponse({
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
    buildDailyContentDraftGenerationLlmProviderHealthCheckReadbackResponse({
      mode: "preview",
      planId: request.planId,
      planItemId: request.planItemId,
      contentItemId: request.contentItemId
    })
  ]);
  const attemptSummary = attemptReadback.draftGenerationLlmDispatchAttemptReadbackSummary;
  const promptQualitySummary = promptQuality.draftGenerationPromptQualityChecklistPreviewSummary;
  const requestEnvelopeSummary = requestEnvelope.draftGenerationLlmRequestEnvelopePreviewSummary;
  const providerReadinessSummary = providerReadiness.draftGenerationLlmProviderReadinessSummary;
  const healthCheckReadbackSummary = healthCheckReadback.draftGenerationLlmProviderHealthCheckReadbackSummary;
  const finalPreflightSummary = buildFinalPreflightSummary({
    attemptSummary,
    promptQualitySummary,
    requestEnvelopeSummary,
    providerReadinessSummary,
    healthCheckReadbackSummary
  });
  const blockingReasons = new Set<string>(finalPreflightSummary.blockers);

  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_llm_dispatch_final_preflight_is_preview_only");
  }

  const warnings = new Set<string>([
    "draft_generation_llm_dispatch_final_preflight_read_only",
    "dispatch_execution_disabled_by_patch_policy",
    "provider_call_disabled_by_patch_policy",
    "llm_call_disabled_by_patch_policy",
    "content_item_mutation_disabled"
  ]);
  const sideEffectSummary = buildSideEffectSummary();
  const summary: DailyContentDraftGenerationLlmDispatchFinalPreflightSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    preflightMode: PREFLIGHT_MODE,
    readOnly: true,
    dryRunOnly: true,
    dispatchExecutionAllowedInThisPatch: false,
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
    finalPreflightSummary,
    currentSideEffectSummary: sideEffectSummary,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationLlmDispatchFinalPreflightSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmDispatchFinalPreflightRequest): {
  mode: FinalPreflightMode;
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

function buildFinalPreflightSummary(input: {
  attemptSummary: AttemptReadbackSummary;
  promptQualitySummary: PromptQualitySummary;
  requestEnvelopeSummary: RequestEnvelopeSummary;
  providerReadinessSummary: ProviderReadinessSummary;
  healthCheckReadbackSummary: HealthCheckReadbackSummary;
}): FinalPreflightSummary {
  const attemptReadback = input.attemptSummary.dispatchAttemptReadbackSummary;
  const latestAttempt = attemptReadback.latestTargetAttempt;
  const promptQuality = input.promptQualitySummary.promptQualityChecklistSummary;
  const envelope = input.requestEnvelopeSummary.requestEnvelopePreviewSummary;
  const providerReadiness = input.providerReadinessSummary.llmProviderReadinessSummary;
  const healthReadback = input.healthCheckReadbackSummary.healthCheckReadbackSummary;
  const attemptAuditReady =
    Boolean(latestAttempt) &&
    latestAttempt?.attemptStatus === "created_pending_dispatch_gate" &&
    !latestAttempt.providerNetworkCallAttempted &&
    !latestAttempt.llmCallAttempted &&
    !latestAttempt.contentMutationAttempted &&
    !latestAttempt.bloggerWriteAttempted;
  const eventAuditReady = attemptReadback.targetScopedCounts.events === 1;
  const artifactAuditReady = attemptReadback.targetScopedCounts.artifacts === 1;
  const promptQualityReady = promptQuality.qualityGatePassed;
  const requestEnvelopeReady =
    envelope.requestEnvelopeBuiltForPreview &&
    !envelope.requestEnvelopeStored &&
    !envelope.requestWouldBeSent &&
    envelope.redactionSummary.forbiddenPatternScanPassed &&
    envelope.routeResolved;
  const providerRouteReady =
    providerReadiness.routeResolutionPlan.selectedRouteResolved &&
    providerReadiness.providerConfigPlan.providerConfigFound &&
    providerReadiness.modelConfigPlan.modelCandidateResolved;
  const providerHealthCheckReferenceFound = healthReadback.persistedHealthCheckReference.persistedReferenceFound;
  const providerHealthCheckResultStillTransient = healthReadback.transientRunReadback.priorHealthCheckWasTransient;
  const idempotencyPolicyReady = true;
  const confirmationPolicyReady = true;
  const checks = [
    buildCheck("attempt_audit", attemptAuditReady, "Dispatch attempt audit row", latestAttempt ? `attempt=${latestAttempt.id}` : "attempt missing", "dispatch_attempt_not_ready"),
    buildCheck("event_audit", eventAuditReady, "Dispatch event audit row", `events=${attemptReadback.targetScopedCounts.events}`, "dispatch_event_not_ready"),
    buildCheck("artifact_audit", artifactAuditReady, "Dispatch artifact audit row", `artifacts=${attemptReadback.targetScopedCounts.artifacts}`, "dispatch_artifact_not_ready"),
    buildCheck("prompt_quality", promptQualityReady, "Prompt quality checklist", `failCount=${promptQuality.failCount}`, "prompt_quality_not_ready"),
    buildCheck("request_envelope", requestEnvelopeReady, "Request envelope preview", `promptSha256=${envelope.promptSha256}`, "request_envelope_not_ready"),
    buildCheck("provider_route", providerRouteReady, "Provider route/model readiness", providerReadiness.routeResolutionPlan.selectedProviderKey ?? "-", "provider_route_not_ready"),
    buildCheck(
      "provider_health_reference",
      providerHealthCheckReferenceFound,
      "Provider health-check reference/hash",
      healthReadback.persistedHealthCheckReference.healthCheckSummaryHash ?? "-",
      "provider_health_check_reference_missing"
    ),
    {
      key: "provider_health_result_persistence",
      status: providerHealthCheckResultStillTransient ? ("warn" as const) : ("pass" as const),
      label: "Provider health-check result persistence",
      detail: providerHealthCheckResultStillTransient ? "latest health-check network result was transient; no raw provider result persisted" : "persisted result reference available",
      blockerCode: providerHealthCheckResultStillTransient ? "provider_health_check_result_transient" : undefined
    },
    buildCheck("idempotency_policy", idempotencyPolicyReady, "Idempotency policy", "future dispatch must provide an idempotency key", "idempotency_policy_not_ready"),
    buildCheck("confirmation_policy", confirmationPolicyReady, "Confirmation policy", "future dispatch must provide exact confirmation phrase", "confirmation_policy_not_ready")
  ];
  const blockers = checks.filter((check) => check.status === "blocked").map((check) => check.blockerCode ?? `${check.key}_blocked`);
  blockers.push("dispatch_execution_disabled_by_patch_policy");
  const finalPreflightReadyForPlanLock = blockers.length === 1 && blockers[0] === "dispatch_execution_disabled_by_patch_policy";

  return {
    preflightVersion: PREFLIGHT_VERSION,
    latestAttemptId: latestAttempt?.id ?? null,
    finalPreflightReadyForPlanLock,
    readyForLlmDispatchExecution: false,
    dispatchExecutionWouldBeBlocked: true,
    attemptAuditReady,
    eventAuditReady,
    artifactAuditReady,
    promptQualityReady,
    requestEnvelopeReady,
    providerRouteReady,
    providerHealthCheckReferenceFound,
    providerHealthCheckResultStillTransient,
    idempotencyPolicyReady,
    confirmationPolicyReady,
    checks,
    blockers,
    nextRequiredInputs: ["dispatch execution feature flag", "exact confirmation phrase", "idempotency key", "separate plan lock"],
    nextSafePatchCandidate: "9F-3H",
    nextSafePatchPurpose: "LLM dispatch execution plan lock, no provider call/no LLM call/no content mutation"
  };
}

function buildCheck(key: string, passed: boolean, label: string, detail: string, blockerCode: string) {
  return {
    key,
    status: passed ? ("pass" as const) : ("blocked" as const),
    label,
    detail,
    blockerCode: passed ? undefined : blockerCode
  };
}

function buildSideEffectSummary(): DailyContentDraftGenerationLlmDispatchFinalPreflightSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    envRead: true,
    secretValueExposed: false,
    promptRenderedForPreflight: true,
    promptStored: false,
    requestEnvelopeBuiltForPreview: true,
    requestEnvelopeStored: false,
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
