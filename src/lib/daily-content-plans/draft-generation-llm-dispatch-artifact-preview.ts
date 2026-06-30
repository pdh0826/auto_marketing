import { createHash } from "crypto";
import {
  buildDailyContentDraftGenerationLlmDispatchAttemptReadbackResponse,
  type DailyContentDraftGenerationLlmDispatchAttemptReadbackResponse,
  type DispatchAuditCounts,
  type SafeDispatchAttemptReadback
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-attempt-readback";

const PATCH_VERSION = "9F-3C";
const PREVIEW_MODE = "read_only_draft_generation_llm_dispatch_artifact_preview";
const ARTIFACT_PREVIEW_VERSION = "daily_content_draft_generation_llm_dispatch_artifact_preview_v0";
const ARTIFACT_KIND = "prompt_request_hash_bundle";
const ARTIFACT_STORAGE_MODE = "hash_only";
const ARTIFACT_REDACTION_STATUS = "redacted_or_hash_only";

type ArtifactPreviewMode = "preview" | "blocked_non_preview";
type AttemptReadbackSummary =
  DailyContentDraftGenerationLlmDispatchAttemptReadbackResponse["draftGenerationLlmDispatchAttemptReadbackSummary"];

export interface DailyContentDraftGenerationLlmDispatchArtifactPreviewRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationLlmDispatchArtifactPreviewResponse
  extends DailyContentDraftGenerationLlmDispatchArtifactPreviewSummary {
  checkedAt: string;
  draftGenerationLlmDispatchArtifactPreviewSummary: DailyContentDraftGenerationLlmDispatchArtifactPreviewSummary;
}

export interface DailyContentDraftGenerationLlmDispatchArtifactPreviewSummary {
  patchVersion: "9F-3C";
  checked: true;
  mode: ArtifactPreviewMode;
  requestedMode: string;
  previewMode: typeof PREVIEW_MODE;
  artifactPreviewOnly: true;
  dryRunOnly: true;
  artifactInsertAttempted: false;
  auditRowsCreatedNow: false;
  auditRowsMutatedNow: false;
  targetSummary: AttemptReadbackSummary["targetSummary"];
  persistedApprovalSummary: AttemptReadbackSummary["persistedApprovalSummary"];
  executionGateSummary: AttemptReadbackSummary["executionGateSummary"];
  artifactPreviewSummary: ArtifactPreviewSummary;
  currentSideEffectSummary: DailyContentDraftGenerationLlmDispatchArtifactPreviewSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface ArtifactPreviewSummary {
  artifactPreviewVersion: typeof ARTIFACT_PREVIEW_VERSION;
  sourceAttemptReadbackPatchVersion: "9F-2X";
  latestAttemptFound: boolean;
  latestAttemptId: string | null;
  latestEventFound: boolean;
  latestEventId: string | null;
  targetScopedCountsBefore: DispatchAuditCounts;
  targetScopedCountsAfter: DispatchAuditCounts;
  globalCountsBefore: DispatchAuditCounts;
  globalCountsAfter: DispatchAuditCounts;
  artifactCandidateReady: boolean;
  artifactCreationAllowedInThisPatch: false;
  artifactInsertWouldBeBlocked: true;
  duplicateArtifactDetected: boolean;
  candidateArtifact: SafeDispatchArtifactCandidate | null;
  artifactPreviewBlockers: string[];
  nextSafePatchCandidate: "9F-3D";
  nextSafePatchPurpose: string;
}

export interface SafeDispatchArtifactCandidate {
  attemptId: string;
  artifactKind: typeof ARTIFACT_KIND;
  artifactHash: string;
  artifactStorageMode: typeof ARTIFACT_STORAGE_MODE;
  artifactRedactionStatus: typeof ARTIFACT_REDACTION_STATUS;
  artifactPreview: string;
  rawPromptStored: false;
  rawRequestBodyStored: false;
  rawResponseBodyStored: false;
  rawCandidateStored: false;
  rawSecretStored: false;
  rawTokenStored: false;
}

export interface DailyContentDraftGenerationLlmDispatchArtifactPreviewSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  auditAttemptMutation: false;
  auditEventMutation: false;
  auditArtifactMutation: false;
  auditRowsCreated: false;
  artifactInsertAttempted: false;
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

export async function buildDailyContentDraftGenerationLlmDispatchArtifactPreviewResponse(
  rawRequest: DailyContentDraftGenerationLlmDispatchArtifactPreviewRequest
): Promise<DailyContentDraftGenerationLlmDispatchArtifactPreviewResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const attemptReadback = await buildDailyContentDraftGenerationLlmDispatchAttemptReadbackResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const readbackSummary = attemptReadback.draftGenerationLlmDispatchAttemptReadbackSummary;
  const artifactPreviewSummary = buildArtifactPreviewSummary(readbackSummary);
  const blockingReasons = new Set<string>(artifactPreviewSummary.artifactPreviewBlockers);

  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_llm_dispatch_artifact_preview_is_preview_only");
  }

  const warnings = new Set<string>([
    "draft_generation_llm_dispatch_artifact_preview_only",
    "audit_artifact_insert_disabled_by_patch_policy",
    "provider_call_disabled_by_patch_policy",
    "content_item_mutation_disabled"
  ]);
  const sideEffectSummary = buildSideEffectSummary();
  const summary: DailyContentDraftGenerationLlmDispatchArtifactPreviewSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    previewMode: PREVIEW_MODE,
    artifactPreviewOnly: true,
    dryRunOnly: true,
    artifactInsertAttempted: false,
    auditRowsCreatedNow: false,
    auditRowsMutatedNow: false,
    targetSummary: readbackSummary.targetSummary,
    persistedApprovalSummary: readbackSummary.persistedApprovalSummary,
    executionGateSummary: {
      executionAllowed: false,
      finalDraftGenerationAllowed: false,
      remainingBlockers: readbackSummary.executionGateSummary.remainingBlockers,
      resolvedBlockers: readbackSummary.executionGateSummary.resolvedBlockers
    },
    artifactPreviewSummary,
    currentSideEffectSummary: sideEffectSummary,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationLlmDispatchArtifactPreviewSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmDispatchArtifactPreviewRequest): {
  mode: ArtifactPreviewMode;
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

function buildArtifactPreviewSummary(readbackSummary: AttemptReadbackSummary): ArtifactPreviewSummary {
  const readback = readbackSummary.dispatchAttemptReadbackSummary;
  const latestAttempt = readback.latestTargetAttempt;
  const latestEvent = readback.latestTargetEvent;
  const candidateArtifact = latestAttempt ? buildCandidateArtifact(latestAttempt) : null;
  const blockers = buildArtifactPreviewBlockers({
    auditTablesExist: readback.auditTablesExist,
    latestAttemptFound: Boolean(latestAttempt),
    latestEventFound: Boolean(latestEvent),
    targetScopedArtifactCount: readback.targetScopedCounts.artifacts
  });

  return {
    artifactPreviewVersion: ARTIFACT_PREVIEW_VERSION,
    sourceAttemptReadbackPatchVersion: "9F-2X",
    latestAttemptFound: Boolean(latestAttempt),
    latestAttemptId: latestAttempt?.id ?? null,
    latestEventFound: Boolean(latestEvent),
    latestEventId: latestEvent?.id ?? null,
    targetScopedCountsBefore: readback.targetScopedCounts,
    targetScopedCountsAfter: readback.targetScopedCounts,
    globalCountsBefore: readback.globalCounts,
    globalCountsAfter: readback.globalCounts,
    artifactCandidateReady: Boolean(candidateArtifact) && blockers.length === 1 && blockers[0] === "draft_generation_llm_dispatch_artifact_preview_only",
    artifactCreationAllowedInThisPatch: false,
    artifactInsertWouldBeBlocked: true,
    duplicateArtifactDetected: readback.targetScopedCounts.artifacts > 0,
    candidateArtifact,
    artifactPreviewBlockers: blockers,
    nextSafePatchCandidate: "9F-3D",
    nextSafePatchPurpose: "Gated LLM dispatch audit artifact persistence, no provider call/no content mutation"
  };
}

function buildArtifactPreviewBlockers(input: {
  auditTablesExist: boolean;
  latestAttemptFound: boolean;
  latestEventFound: boolean;
  targetScopedArtifactCount: number;
}) {
  const blockers = new Set<string>(["draft_generation_llm_dispatch_artifact_preview_only"]);

  if (!input.auditTablesExist) {
    blockers.add("draft_generation_llm_dispatch_audit_tables_missing");
  }
  if (!input.latestAttemptFound) {
    blockers.add("dispatch_attempt_not_found");
  }
  if (!input.latestEventFound) {
    blockers.add("dispatch_attempt_event_not_found");
  }
  if (input.targetScopedArtifactCount > 0) {
    blockers.add("target_dispatch_artifact_already_exists");
  }

  return Array.from(blockers);
}

function buildCandidateArtifact(attempt: SafeDispatchAttemptReadback): SafeDispatchArtifactCandidate {
  const hashBundle = {
    patchVersion: PATCH_VERSION,
    artifactPreviewVersion: ARTIFACT_PREVIEW_VERSION,
    attemptId: attempt.id,
    attemptPurpose: attempt.attemptPurpose,
    attemptStatus: attempt.attemptStatus,
    requestEnvelopeHash: attempt.requestEnvelopeHash,
    promptSha256: attempt.promptSha256,
    promptVersion: attempt.promptVersion,
    promptQualityChecklistVersion: attempt.promptQualityChecklistVersion,
    dispatchGateVersion: attempt.dispatchGateVersion,
    requestBodyStored: attempt.requestBodyStored,
    requestBodyRedacted: attempt.requestBodyRedacted,
    responseBodyStored: attempt.responseBodyStored,
    responseBodyRedacted: attempt.responseBodyRedacted
  };

  return {
    attemptId: attempt.id,
    artifactKind: ARTIFACT_KIND,
    artifactHash: sha256(stableJson(hashBundle)),
    artifactStorageMode: ARTIFACT_STORAGE_MODE,
    artifactRedactionStatus: ARTIFACT_REDACTION_STATUS,
    artifactPreview: `attempt=${attempt.id}; prompt=${attempt.promptSha256.slice(0, 12)}; envelope=${attempt.requestEnvelopeHash.slice(0, 12)}`,
    rawPromptStored: false,
    rawRequestBodyStored: false,
    rawResponseBodyStored: false,
    rawCandidateStored: false,
    rawSecretStored: false,
    rawTokenStored: false
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

function buildSideEffectSummary(): DailyContentDraftGenerationLlmDispatchArtifactPreviewSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    auditAttemptMutation: false,
    auditEventMutation: false,
    auditArtifactMutation: false,
    auditRowsCreated: false,
    artifactInsertAttempted: false,
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
