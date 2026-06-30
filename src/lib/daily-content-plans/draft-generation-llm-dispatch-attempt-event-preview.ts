import { createHash } from "crypto";
import {
  buildDailyContentDraftGenerationLlmDispatchAttemptReadbackResponse,
  type DailyContentDraftGenerationLlmDispatchAttemptReadbackResponse,
  type DispatchAuditCounts,
  type SafeDispatchAttemptReadback
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-attempt-readback";

const PATCH_VERSION = "9F-3A";
const PREVIEW_MODE = "read_only_draft_generation_llm_dispatch_attempt_event_creation_preview";
const EVENT_PREVIEW_VERSION = "daily_content_draft_generation_llm_dispatch_attempt_event_preview_v0";
const EVENT_TYPE = "dispatch_attempt_created";
const EVENT_STATUS = "recorded_audit_only";

type EventPreviewMode = "preview" | "blocked_non_preview";
type AttemptReadbackSummary =
  DailyContentDraftGenerationLlmDispatchAttemptReadbackResponse["draftGenerationLlmDispatchAttemptReadbackSummary"];

export interface DailyContentDraftGenerationLlmDispatchAttemptEventPreviewRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationLlmDispatchAttemptEventPreviewResponse
  extends DailyContentDraftGenerationLlmDispatchAttemptEventPreviewSummary {
  checkedAt: string;
  draftGenerationLlmDispatchAttemptEventPreviewSummary: DailyContentDraftGenerationLlmDispatchAttemptEventPreviewSummary;
}

export interface DailyContentDraftGenerationLlmDispatchAttemptEventPreviewSummary {
  patchVersion: "9F-3A";
  checked: true;
  mode: EventPreviewMode;
  requestedMode: string;
  previewMode: typeof PREVIEW_MODE;
  eventPreviewOnly: true;
  dryRunOnly: true;
  auditRowsCreatedNow: false;
  auditRowsMutatedNow: false;
  eventInsertAttempted: false;
  targetSummary: AttemptReadbackSummary["targetSummary"];
  persistedApprovalSummary: AttemptReadbackSummary["persistedApprovalSummary"];
  executionGateSummary: AttemptReadbackSummary["executionGateSummary"];
  attemptEventPreviewSummary: AttemptEventPreviewSummary;
  currentSideEffectSummary: DailyContentDraftGenerationLlmDispatchAttemptEventPreviewSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface AttemptEventPreviewSummary {
  eventPreviewVersion: typeof EVENT_PREVIEW_VERSION;
  sourceAttemptReadbackPatchVersion: "9F-2X";
  latestAttemptFound: boolean;
  latestAttemptId: string | null;
  latestAttemptStatus: string | null;
  targetScopedCountsBefore: DispatchAuditCounts;
  targetScopedCountsAfter: DispatchAuditCounts;
  globalCountsBefore: DispatchAuditCounts;
  globalCountsAfter: DispatchAuditCounts;
  eventCandidateReady: boolean;
  eventCreationAllowedInThisPatch: false;
  eventInsertWouldBeBlocked: true;
  duplicateEventDetected: boolean;
  candidateEvent: SafeDispatchEventCandidate | null;
  eventCreationBlockers: string[];
  nextSafePatchCandidate: "9F-3B";
  nextSafePatchPurpose: string;
}

export interface SafeDispatchEventCandidate {
  attemptId: string;
  eventType: typeof EVENT_TYPE;
  eventStatus: typeof EVENT_STATUS;
  eventMessage: string;
  eventPayloadHash: string;
  eventPayloadRedactedJsonWouldBeStored: true;
  rawSecretStored: false;
  rawTokenStored: false;
  providerNetworkCallAttempted: false;
  llmCallAttempted: false;
  contentMutationAttempted: false;
  bloggerWriteAttempted: false;
}

export interface DailyContentDraftGenerationLlmDispatchAttemptEventPreviewSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  auditAttemptMutation: false;
  auditEventMutation: false;
  auditArtifactMutation: false;
  auditRowsCreated: false;
  eventInsertAttempted: false;
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

export async function buildDailyContentDraftGenerationLlmDispatchAttemptEventPreviewResponse(
  rawRequest: DailyContentDraftGenerationLlmDispatchAttemptEventPreviewRequest
): Promise<DailyContentDraftGenerationLlmDispatchAttemptEventPreviewResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const attemptReadback = await buildDailyContentDraftGenerationLlmDispatchAttemptReadbackResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const readbackSummary = attemptReadback.draftGenerationLlmDispatchAttemptReadbackSummary;
  const attemptEventPreviewSummary = buildAttemptEventPreviewSummary(readbackSummary);
  const blockingReasons = new Set<string>(attemptEventPreviewSummary.eventCreationBlockers);

  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_llm_dispatch_attempt_event_preview_is_preview_only");
  }

  const warnings = new Set<string>([
    "draft_generation_llm_dispatch_attempt_event_preview_only",
    "audit_event_insert_disabled_by_patch_policy",
    "provider_call_disabled_by_patch_policy",
    "content_item_mutation_disabled"
  ]);

  const sideEffectSummary = buildSideEffectSummary();
  const summary: DailyContentDraftGenerationLlmDispatchAttemptEventPreviewSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    previewMode: PREVIEW_MODE,
    eventPreviewOnly: true,
    dryRunOnly: true,
    auditRowsCreatedNow: false,
    auditRowsMutatedNow: false,
    eventInsertAttempted: false,
    targetSummary: readbackSummary.targetSummary,
    persistedApprovalSummary: readbackSummary.persistedApprovalSummary,
    executionGateSummary: {
      executionAllowed: false,
      finalDraftGenerationAllowed: false,
      remainingBlockers: readbackSummary.executionGateSummary.remainingBlockers,
      resolvedBlockers: readbackSummary.executionGateSummary.resolvedBlockers
    },
    attemptEventPreviewSummary,
    currentSideEffectSummary: sideEffectSummary,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationLlmDispatchAttemptEventPreviewSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmDispatchAttemptEventPreviewRequest): {
  mode: EventPreviewMode;
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

function buildAttemptEventPreviewSummary(readbackSummary: AttemptReadbackSummary): AttemptEventPreviewSummary {
  const latestAttempt = readbackSummary.dispatchAttemptReadbackSummary.latestTargetAttempt;
  const targetCounts = readbackSummary.dispatchAttemptReadbackSummary.targetScopedCounts;
  const globalCounts = readbackSummary.dispatchAttemptReadbackSummary.globalCounts;
  const eventCreationBlockers = buildEventCreationBlockers({
    auditTablesExist: readbackSummary.dispatchAttemptReadbackSummary.auditTablesExist,
    latestAttempt,
    targetScopedEventCount: targetCounts.events
  });
  const candidateEvent = latestAttempt ? buildCandidateEvent(latestAttempt) : null;

  return {
    eventPreviewVersion: EVENT_PREVIEW_VERSION,
    sourceAttemptReadbackPatchVersion: "9F-2X",
    latestAttemptFound: Boolean(latestAttempt),
    latestAttemptId: latestAttempt?.id ?? null,
    latestAttemptStatus: latestAttempt?.attemptStatus ?? null,
    targetScopedCountsBefore: targetCounts,
    targetScopedCountsAfter: targetCounts,
    globalCountsBefore: globalCounts,
    globalCountsAfter: globalCounts,
    eventCandidateReady: Boolean(candidateEvent) && eventCreationBlockers.length === 1 && eventCreationBlockers[0] === "draft_generation_llm_dispatch_attempt_event_preview_only",
    eventCreationAllowedInThisPatch: false,
    eventInsertWouldBeBlocked: true,
    duplicateEventDetected: targetCounts.events > 0,
    candidateEvent,
    eventCreationBlockers,
    nextSafePatchCandidate: "9F-3B",
    nextSafePatchPurpose: "Gated LLM dispatch attempt event creation persistence, no provider call/no content mutation"
  };
}

function buildEventCreationBlockers(input: {
  auditTablesExist: boolean;
  latestAttempt: SafeDispatchAttemptReadback | null;
  targetScopedEventCount: number;
}) {
  const blockers = new Set<string>(["draft_generation_llm_dispatch_attempt_event_preview_only"]);

  if (!input.auditTablesExist) {
    blockers.add("draft_generation_llm_dispatch_audit_tables_missing");
  }
  if (!input.latestAttempt) {
    blockers.add("dispatch_attempt_not_found");
  }
  if (input.targetScopedEventCount > 0) {
    blockers.add("target_dispatch_event_already_exists");
  }

  return Array.from(blockers);
}

function buildCandidateEvent(attempt: SafeDispatchAttemptReadback): SafeDispatchEventCandidate {
  const payload = {
    patchVersion: PATCH_VERSION,
    eventPreviewVersion: EVENT_PREVIEW_VERSION,
    attemptId: attempt.id,
    attemptPurpose: attempt.attemptPurpose,
    attemptStatus: attempt.attemptStatus,
    requestEnvelopeHash: attempt.requestEnvelopeHash,
    promptSha256: attempt.promptSha256,
    promptVersion: attempt.promptVersion,
    promptQualityChecklistVersion: attempt.promptQualityChecklistVersion,
    dispatchGateVersion: attempt.dispatchGateVersion,
    providerNetworkCallAttempted: false,
    llmCallAttempted: false,
    contentMutationAttempted: false,
    bloggerWriteAttempted: false
  };

  return {
    attemptId: attempt.id,
    eventType: EVENT_TYPE,
    eventStatus: EVENT_STATUS,
    eventMessage: "Dispatch attempt creation was recorded as an audit-only candidate event; no provider, LLM, content, or Blogger side effect is performed.",
    eventPayloadHash: sha256(stableJson(payload)),
    eventPayloadRedactedJsonWouldBeStored: true,
    rawSecretStored: false,
    rawTokenStored: false,
    providerNetworkCallAttempted: false,
    llmCallAttempted: false,
    contentMutationAttempted: false,
    bloggerWriteAttempted: false
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown) {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, sortJsonValue(nestedValue)])
    );
  }
  return value;
}

function buildSideEffectSummary(): DailyContentDraftGenerationLlmDispatchAttemptEventPreviewSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    auditAttemptMutation: false,
    auditEventMutation: false,
    auditArtifactMutation: false,
    auditRowsCreated: false,
    eventInsertAttempted: false,
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
