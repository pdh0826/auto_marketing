import { createHash } from "crypto";
import {
  buildDailyContentDraftGenerationLlmDispatchArtifactPreviewResponse,
  type DailyContentDraftGenerationLlmDispatchArtifactPreviewResponse
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-artifact-preview";
import { prisma } from "@/lib/db/client";

const PATCH_VERSION = "9F-3D";
const FEATURE_FLAG_NAME = "BLOG_DAILY_CONTENT_LLM_DISPATCH_ARTIFACT_CREATE_ENABLED";
const REQUIRED_CONFIRMATION_PHRASE = "I_UNDERSTAND_THIS_CREATES_ONE_LLM_DISPATCH_AUDIT_ARTIFACT_WITHOUT_PROVIDER_CALL";
const NOT_CREATED_STATUS = "not_created_preview_only";
const CREATED_STATUS = "created_hash_only";
const BLOCKED_STATUS = "blocked";
const EXISTING_STATUS = "existing_artifact_returned";

type ArtifactCreationMode = "preview" | "apply" | "blocked_non_supported_mode";
type ArtifactPreviewSummary =
  DailyContentDraftGenerationLlmDispatchArtifactPreviewResponse["draftGenerationLlmDispatchArtifactPreviewSummary"];

export interface DailyContentDraftGenerationLlmDispatchArtifactCreationRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
  confirmationPhrase?: unknown;
  idempotencyKey?: unknown;
}

export interface DailyContentDraftGenerationLlmDispatchArtifactCreationResponse
  extends DailyContentDraftGenerationLlmDispatchArtifactCreationSummary {
  checkedAt: string;
  draftGenerationLlmDispatchArtifactCreationSummary: DailyContentDraftGenerationLlmDispatchArtifactCreationSummary;
}

export interface DailyContentDraftGenerationLlmDispatchArtifactCreationSummary {
  patchVersion: "9F-3D";
  checked: true;
  mode: ArtifactCreationMode;
  requestedMode: string;
  artifactPersistencePatch: true;
  artifactCreationEvaluated: true;
  artifactCreationAllowed: boolean;
  artifactCreatedNow: boolean;
  existingArtifactReturned: boolean;
  duplicateArtifactDetected: boolean;
  targetSummary: ArtifactPreviewSummary["targetSummary"];
  persistedApprovalSummary: ArtifactPreviewSummary["persistedApprovalSummary"];
  executionGateSummary: ArtifactPreviewSummary["executionGateSummary"];
  artifactCreationSummary: ArtifactCreationSummary;
  currentSideEffectSummary: DailyContentDraftGenerationLlmDispatchArtifactCreationSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface ArtifactCreationSummary {
  artifactCreationFeatureFlagName: typeof FEATURE_FLAG_NAME;
  artifactCreationFeatureFlagEnabled: boolean;
  confirmationPhraseRequired: true;
  confirmationPhraseMatched: boolean;
  idempotencyKeyRequired: true;
  idempotencyKeyPresent: boolean;
  rawIdempotencyKeyStored: false;
  rawConfirmationPhraseStored: false;
  artifactCandidateReady: boolean;
  canCreateArtifactNow: boolean;
  artifactCreationBlockers: string[];
  attemptId: string | null;
  artifactId: string | null;
  artifactKind: string | null;
  artifactStatus: typeof NOT_CREATED_STATUS | typeof CREATED_STATUS | typeof BLOCKED_STATUS | typeof EXISTING_STATUS;
  artifactHash: string | null;
  artifactStorageMode: string | null;
  artifactRedactionStatus: string | null;
  attemptsCountBefore: number;
  eventsCountBefore: number;
  artifactsCountBefore: number;
  attemptsCountAfter: number;
  eventsCountAfter: number;
  artifactsCountAfter: number;
  existingArtifactReturned: boolean;
  idempotencyKeyHashPreview: string | null;
  confirmationPhraseHashPreview: string | null;
}

export interface DailyContentDraftGenerationLlmDispatchArtifactCreationSideEffectSummary {
  dbRead: true;
  dbWrite: boolean;
  auditAttemptMutation: false;
  auditEventMutation: false;
  auditArtifactMutation: boolean;
  auditRowsCreated: boolean;
  artifactInsertAttempted: boolean;
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

export async function buildDailyContentDraftGenerationLlmDispatchArtifactCreationResponse(
  rawRequest: DailyContentDraftGenerationLlmDispatchArtifactCreationRequest
): Promise<DailyContentDraftGenerationLlmDispatchArtifactCreationResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const preview = await buildDailyContentDraftGenerationLlmDispatchArtifactPreviewResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const previewSummary = preview.draftGenerationLlmDispatchArtifactPreviewSummary;
  const candidate = previewSummary.artifactPreviewSummary.candidateArtifact;
  const countsBefore = previewSummary.artifactPreviewSummary.globalCountsBefore;
  const featureFlagEnabled = process.env[FEATURE_FLAG_NAME] === "true";
  const confirmationPhraseMatched = request.confirmationPhrase === REQUIRED_CONFIRMATION_PHRASE;
  const idempotencyKeyPresent = Boolean(request.idempotencyKey);
  const idempotencyKeyHash = request.idempotencyKey ? sha256(request.idempotencyKey) : null;
  const confirmationPhraseHash = request.confirmationPhrase ? sha256(request.confirmationPhrase) : null;
  const existingArtifact = candidate
    ? await prisma.blogDailyContentLlmDispatchArtifact.findFirst({
        where: {
          attemptId: candidate.attemptId,
          artifactKind: candidate.artifactKind,
          artifactHash: candidate.artifactHash
        },
        orderBy: { createdAt: "desc" }
      })
    : null;
  const artifactCreationBlockers = buildArtifactCreationBlockers({
    mode: request.mode,
    featureFlagEnabled,
    confirmationPhraseMatched,
    idempotencyKeyPresent,
    artifactCandidateReady: previewSummary.artifactPreviewSummary.artifactCandidateReady,
    existingArtifact: Boolean(existingArtifact)
  });
  const canCreateArtifactNow = request.mode === "apply" && artifactCreationBlockers.length === 0;
  let artifactCreatedNow = false;
  let existingArtifactReturned = false;
  let artifactId: string | null = null;
  let artifactStatus: ArtifactCreationSummary["artifactStatus"] =
    request.mode === "preview" ? NOT_CREATED_STATUS : request.mode === "apply" ? BLOCKED_STATUS : BLOCKED_STATUS;

  if (request.mode === "apply" && existingArtifact && featureFlagEnabled && confirmationPhraseMatched && idempotencyKeyPresent) {
    existingArtifactReturned = true;
    artifactId = existingArtifact.id;
    artifactStatus = EXISTING_STATUS;
  } else if (canCreateArtifactNow && candidate) {
    const created = await prisma.blogDailyContentLlmDispatchArtifact.create({
      data: {
        attemptId: candidate.attemptId,
        artifactKind: candidate.artifactKind,
        artifactHash: candidate.artifactHash,
        artifactStorageMode: candidate.artifactStorageMode,
        artifactRedactionStatus: candidate.artifactRedactionStatus,
        artifactPreview: candidate.artifactPreview,
        rawSecretStored: false,
        rawTokenStored: false
      }
    });
    artifactCreatedNow = true;
    artifactId = created.id;
    artifactStatus = CREATED_STATUS;
  }

  const responseBlockers = existingArtifactReturned ? [] : artifactCreationBlockers;
  const countsAfter = await readGlobalCounts();
  const sideEffectSummary = buildSideEffectSummary(artifactCreatedNow);
  const summary: DailyContentDraftGenerationLlmDispatchArtifactCreationSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    artifactPersistencePatch: true,
    artifactCreationEvaluated: true,
    artifactCreationAllowed: canCreateArtifactNow || existingArtifactReturned,
    artifactCreatedNow,
    existingArtifactReturned,
    duplicateArtifactDetected: Boolean(existingArtifact),
    targetSummary: previewSummary.targetSummary,
    persistedApprovalSummary: previewSummary.persistedApprovalSummary,
    executionGateSummary: {
      executionAllowed: false,
      finalDraftGenerationAllowed: false,
      remainingBlockers: previewSummary.executionGateSummary.remainingBlockers,
      resolvedBlockers: previewSummary.executionGateSummary.resolvedBlockers
    },
    artifactCreationSummary: {
      artifactCreationFeatureFlagName: FEATURE_FLAG_NAME,
      artifactCreationFeatureFlagEnabled: featureFlagEnabled,
      confirmationPhraseRequired: true,
      confirmationPhraseMatched,
      idempotencyKeyRequired: true,
      idempotencyKeyPresent,
      rawIdempotencyKeyStored: false,
      rawConfirmationPhraseStored: false,
      artifactCandidateReady: previewSummary.artifactPreviewSummary.artifactCandidateReady,
      canCreateArtifactNow,
      artifactCreationBlockers: responseBlockers,
      attemptId: candidate?.attemptId ?? null,
      artifactId,
      artifactKind: candidate?.artifactKind ?? null,
      artifactStatus,
      artifactHash: candidate?.artifactHash ?? null,
      artifactStorageMode: candidate?.artifactStorageMode ?? null,
      artifactRedactionStatus: candidate?.artifactRedactionStatus ?? null,
      attemptsCountBefore: countsBefore.attempts,
      eventsCountBefore: countsBefore.events,
      artifactsCountBefore: countsBefore.artifacts,
      attemptsCountAfter: countsAfter.attempts,
      eventsCountAfter: countsAfter.events,
      artifactsCountAfter: countsAfter.artifacts,
      existingArtifactReturned,
      idempotencyKeyHashPreview: idempotencyKeyHash,
      confirmationPhraseHashPreview: confirmationPhraseHash
    },
    currentSideEffectSummary: sideEffectSummary,
    blockingReasons: responseBlockers,
    warnings: buildWarnings(request.mode, artifactCreatedNow, existingArtifactReturned)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationLlmDispatchArtifactCreationSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmDispatchArtifactCreationRequest): {
  mode: ArtifactCreationMode;
  requestedMode: string;
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
  confirmationPhrase: string | null;
  idempotencyKey: string | null;
} {
  const requestedMode = getString(rawRequest.mode) ?? "preview";
  return {
    mode: requestedMode === "preview" || requestedMode === "apply" ? requestedMode : "blocked_non_supported_mode",
    requestedMode,
    planId: getString(rawRequest.planId),
    planItemId: getString(rawRequest.planItemId),
    contentItemId: getString(rawRequest.contentItemId),
    confirmationPhrase: getString(rawRequest.confirmationPhrase),
    idempotencyKey: getString(rawRequest.idempotencyKey)
  };
}

function buildArtifactCreationBlockers(input: {
  mode: ArtifactCreationMode;
  featureFlagEnabled: boolean;
  confirmationPhraseMatched: boolean;
  idempotencyKeyPresent: boolean;
  artifactCandidateReady: boolean;
  existingArtifact: boolean;
}) {
  const blockers = new Set<string>();

  if (input.mode !== "preview" && input.mode !== "apply") {
    blockers.add("draft_generation_llm_dispatch_artifact_creation_mode_not_allowed");
  }
  if (input.mode === "preview") {
    blockers.add("draft_generation_llm_dispatch_artifact_creation_preview_only");
  }
  if (!input.artifactCandidateReady) {
    blockers.add("dispatch_artifact_candidate_not_ready");
  }
  if (input.mode === "apply" && !input.featureFlagEnabled) {
    blockers.add("llm_dispatch_artifact_create_feature_flag_disabled");
  }
  if (input.mode === "apply" && !input.confirmationPhraseMatched) {
    blockers.add("confirmation_phrase_missing_or_mismatch");
  }
  if (input.mode === "apply" && !input.idempotencyKeyPresent) {
    blockers.add("idempotency_key_missing");
  }
  if (input.mode === "apply" && input.existingArtifact) {
    blockers.add("target_dispatch_artifact_already_exists");
  }

  return Array.from(blockers);
}

async function readGlobalCounts() {
  const [attempts, events, artifacts] = await Promise.all([
    prisma.blogDailyContentLlmDispatchAttempt.count(),
    prisma.blogDailyContentLlmDispatchEvent.count(),
    prisma.blogDailyContentLlmDispatchArtifact.count()
  ]);
  return { attempts, events, artifacts };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function buildSideEffectSummary(artifactCreatedNow: boolean): DailyContentDraftGenerationLlmDispatchArtifactCreationSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: artifactCreatedNow,
    auditAttemptMutation: false,
    auditEventMutation: false,
    auditArtifactMutation: artifactCreatedNow,
    auditRowsCreated: artifactCreatedNow,
    artifactInsertAttempted: artifactCreatedNow,
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

function buildWarnings(mode: ArtifactCreationMode, artifactCreatedNow: boolean, existingArtifactReturned: boolean) {
  const warnings = ["provider_call_disabled_by_patch_policy", "content_item_mutation_disabled", "blogger_write_disabled_by_patch_policy"];
  if (mode === "preview") {
    warnings.push("draft_generation_llm_dispatch_artifact_creation_preview_only");
  }
  if (artifactCreatedNow) {
    warnings.push("audit_artifact_row_created_without_provider_call");
  }
  if (existingArtifactReturned) {
    warnings.push("existing_dispatch_artifact_returned_without_insert");
  }
  return warnings;
}
