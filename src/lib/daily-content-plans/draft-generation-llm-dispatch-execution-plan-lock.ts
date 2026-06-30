import { createHash } from "crypto";
import {
  buildDailyContentDraftGenerationLlmDispatchFinalPreflightResponse,
  type DailyContentDraftGenerationLlmDispatchFinalPreflightResponse
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-final-preflight";

const PATCH_VERSION = "9F-3H";
const LOCK_MODE = "read_only_draft_generation_llm_dispatch_execution_plan_lock";
const LOCK_VERSION = "daily_content_draft_generation_llm_dispatch_execution_plan_lock_v0";
const SOURCE_FINAL_PREFLIGHT_PATCH_VERSION = "9F-3G";

type ExecutionPlanLockMode = "preview" | "blocked_non_preview";
type FinalPreflightSummary =
  DailyContentDraftGenerationLlmDispatchFinalPreflightResponse["draftGenerationLlmDispatchFinalPreflightSummary"];

export interface DailyContentDraftGenerationLlmDispatchExecutionPlanLockRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationLlmDispatchExecutionPlanLockResponse
  extends DailyContentDraftGenerationLlmDispatchExecutionPlanLockSummary {
  checkedAt: string;
  draftGenerationLlmDispatchExecutionPlanLockSummary: DailyContentDraftGenerationLlmDispatchExecutionPlanLockSummary;
}

export interface DailyContentDraftGenerationLlmDispatchExecutionPlanLockSummary {
  patchVersion: "9F-3H";
  checked: true;
  mode: ExecutionPlanLockMode;
  requestedMode: string;
  lockMode: typeof LOCK_MODE;
  readOnly: true;
  dryRunOnly: true;
  lockPersistenceAllowedInThisPatch: false;
  lockPersistedNow: false;
  dispatchExecutionAllowedInThisPatch: false;
  providerNetworkCallAttempted: false;
  llmCallAttempted: false;
  contentMutationAttempted: false;
  bloggerWriteAttempted: false;
  targetSummary: FinalPreflightSummary["targetSummary"];
  persistedApprovalSummary: FinalPreflightSummary["persistedApprovalSummary"];
  executionGateSummary: FinalPreflightSummary["executionGateSummary"];
  executionPlanLockSummary: ExecutionPlanLockSummary;
  currentSideEffectSummary: DailyContentDraftGenerationLlmDispatchExecutionPlanLockSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface ExecutionPlanLockSummary {
  lockVersion: typeof LOCK_VERSION;
  sourceFinalPreflightPatchVersion: typeof SOURCE_FINAL_PREFLIGHT_PATCH_VERSION;
  latestAttemptId: string | null;
  finalPreflightReadyForPlanLock: boolean;
  planLockCandidateReady: boolean;
  planLockWouldBePersistedByFuturePatch: true;
  planLockPersisted: false;
  planLockPersistenceReason: "read_only_lock_candidate_only";
  lockHash: string | null;
  lockHashAlgorithm: "sha256";
  canonicalization: "stable_json_v1";
  lockEnvelope: {
    attemptId: string | null;
    planId: string | null;
    planItemId: string;
    contentItemId: string | null;
    preflightVersion: string;
    promptReady: boolean;
    requestEnvelopeReady: boolean;
    providerRouteReady: boolean;
    healthCheckReferenceFound: boolean;
    idempotencyPolicyReady: boolean;
    confirmationPolicyReady: boolean;
  } | null;
  planLockBlockers: string[];
  nextRequiredInputs: string[];
  nextSafePatchCandidate: "9F-3I";
  nextSafePatchPurpose: string;
}

export interface DailyContentDraftGenerationLlmDispatchExecutionPlanLockSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  envRead: true;
  secretValueExposed: false;
  promptRenderedForPlanLock: true;
  promptStored: false;
  requestEnvelopeBuiltForPreview: true;
  requestEnvelopeStored: false;
  planLockPersisted: false;
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

export async function buildDailyContentDraftGenerationLlmDispatchExecutionPlanLockResponse(
  rawRequest: DailyContentDraftGenerationLlmDispatchExecutionPlanLockRequest
): Promise<DailyContentDraftGenerationLlmDispatchExecutionPlanLockResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const finalPreflight = await buildDailyContentDraftGenerationLlmDispatchFinalPreflightResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const finalPreflightSummary = finalPreflight.draftGenerationLlmDispatchFinalPreflightSummary;
  const executionPlanLockSummary = buildExecutionPlanLockSummary(finalPreflightSummary);
  const blockingReasons = new Set<string>(executionPlanLockSummary.planLockBlockers);

  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_llm_dispatch_execution_plan_lock_is_preview_only");
  }

  const warnings = new Set<string>([
    "draft_generation_llm_dispatch_execution_plan_lock_read_only",
    "plan_lock_persistence_disabled_by_patch_policy",
    "dispatch_execution_disabled_by_patch_policy",
    "provider_call_disabled_by_patch_policy",
    "llm_call_disabled_by_patch_policy",
    "content_item_mutation_disabled"
  ]);
  const sideEffectSummary = buildSideEffectSummary();
  const summary: DailyContentDraftGenerationLlmDispatchExecutionPlanLockSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    lockMode: LOCK_MODE,
    readOnly: true,
    dryRunOnly: true,
    lockPersistenceAllowedInThisPatch: false,
    lockPersistedNow: false,
    dispatchExecutionAllowedInThisPatch: false,
    providerNetworkCallAttempted: false,
    llmCallAttempted: false,
    contentMutationAttempted: false,
    bloggerWriteAttempted: false,
    targetSummary: finalPreflightSummary.targetSummary,
    persistedApprovalSummary: finalPreflightSummary.persistedApprovalSummary,
    executionGateSummary: finalPreflightSummary.executionGateSummary,
    executionPlanLockSummary,
    currentSideEffectSummary: sideEffectSummary,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationLlmDispatchExecutionPlanLockSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmDispatchExecutionPlanLockRequest): {
  mode: ExecutionPlanLockMode;
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

function buildExecutionPlanLockSummary(finalPreflightSummary: FinalPreflightSummary): ExecutionPlanLockSummary {
  const preflight = finalPreflightSummary.finalPreflightSummary;
  const planLockCandidateReady = preflight.finalPreflightReadyForPlanLock;
  const lockEnvelope = planLockCandidateReady
    ? {
        attemptId: preflight.latestAttemptId,
        planId: finalPreflightSummary.targetSummary.planId,
        planItemId: finalPreflightSummary.targetSummary.planItemId,
        contentItemId: finalPreflightSummary.targetSummary.contentItemId,
        preflightVersion: preflight.preflightVersion,
        promptReady: preflight.promptQualityReady,
        requestEnvelopeReady: preflight.requestEnvelopeReady,
        providerRouteReady: preflight.providerRouteReady,
        healthCheckReferenceFound: preflight.providerHealthCheckReferenceFound,
        idempotencyPolicyReady: preflight.idempotencyPolicyReady,
        confirmationPolicyReady: preflight.confirmationPolicyReady
      }
    : null;
  const planLockBlockers = new Set<string>();

  if (!preflight.finalPreflightReadyForPlanLock) {
    planLockBlockers.add("final_preflight_not_ready_for_plan_lock");
  }
  if (!lockEnvelope) {
    planLockBlockers.add("execution_plan_lock_candidate_not_ready");
  }
  planLockBlockers.add("plan_lock_persistence_disabled_by_patch_policy");

  return {
    lockVersion: LOCK_VERSION,
    sourceFinalPreflightPatchVersion: SOURCE_FINAL_PREFLIGHT_PATCH_VERSION,
    latestAttemptId: preflight.latestAttemptId,
    finalPreflightReadyForPlanLock: preflight.finalPreflightReadyForPlanLock,
    planLockCandidateReady,
    planLockWouldBePersistedByFuturePatch: true,
    planLockPersisted: false,
    planLockPersistenceReason: "read_only_lock_candidate_only",
    lockHash: lockEnvelope ? sha256(stableStringify({ lockVersion: LOCK_VERSION, lockEnvelope })) : null,
    lockHashAlgorithm: "sha256",
    canonicalization: "stable_json_v1",
    lockEnvelope,
    planLockBlockers: Array.from(planLockBlockers),
    nextRequiredInputs: ["explicit LLM dispatch approval", "dispatch feature flag", "exact confirmation phrase", "idempotency key"],
    nextSafePatchCandidate: "9F-3I",
    nextSafePatchPurpose: "Gated single LLM dispatch, no content mutation/no Blogger write"
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function buildSideEffectSummary(): DailyContentDraftGenerationLlmDispatchExecutionPlanLockSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    envRead: true,
    secretValueExposed: false,
    promptRenderedForPlanLock: true,
    promptStored: false,
    requestEnvelopeBuiltForPreview: true,
    requestEnvelopeStored: false,
    planLockPersisted: false,
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
