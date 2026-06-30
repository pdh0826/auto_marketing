import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import {
  buildDailyContentDraftGenerationLlmOutputQualityValidationPreviewResponse,
  type DailyContentDraftGenerationLlmOutputQualityValidationPreviewResponse
} from "@/lib/daily-content-plans/draft-generation-llm-output-quality-validation-preview";
import { prisma } from "@/lib/db/client";

const PATCH_VERSION = "9F-3L";
const FEATURE_FLAG_NAME = "BLOG_DAILY_CONTENT_LLM_OUTPUT_VALIDATION_PERSISTENCE_ENABLED";
const REQUIRED_CONFIRMATION_PHRASE = "I_UNDERSTAND_THIS_PERSISTS_ONE_LLM_OUTPUT_VALIDATION_AUDIT_RESULT_WITHOUT_CONTENT_MUTATION";
const EVENT_TYPE = "llm_output_quality_validation_previewed";
const ARTIFACT_KIND = "llm_output_quality_validation_result";
const NOT_CREATED_STATUS = "not_created_preview_only";
const CREATED_STATUS = "created_audit_only";
const BLOCKED_STATUS = "blocked";
const EXISTING_STATUS = "existing_validation_result_returned";

type PersistenceMode = "preview" | "apply" | "blocked_non_supported_mode";
type ValidationPreviewSummary =
  DailyContentDraftGenerationLlmOutputQualityValidationPreviewResponse["draftGenerationLlmOutputQualityValidationPreviewSummary"];

export interface DailyContentDraftGenerationLlmOutputValidationPersistenceRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
  confirmationPhrase?: unknown;
  idempotencyKey?: unknown;
}

export interface DailyContentDraftGenerationLlmOutputValidationPersistenceResponse
  extends DailyContentDraftGenerationLlmOutputValidationPersistenceSummary {
  checkedAt: string;
  draftGenerationLlmOutputValidationPersistenceSummary: DailyContentDraftGenerationLlmOutputValidationPersistenceSummary;
}

export interface DailyContentDraftGenerationLlmOutputValidationPersistenceSummary {
  patchVersion: "9F-3L";
  checked: true;
  mode: PersistenceMode;
  requestedMode: string;
  validationPersistencePatch: true;
  validationPersistenceEvaluated: true;
  validationPersistenceAllowed: boolean;
  validationPersistedNow: boolean;
  existingValidationResultReturned: boolean;
  duplicateValidationResultDetected: boolean;
  targetSummary: ValidationPreviewSummary["targetSummary"];
  persistedApprovalSummary: ValidationPreviewSummary["persistedApprovalSummary"];
  executionGateSummary: ValidationPreviewSummary["executionGateSummary"];
  validationPersistenceSummary: ValidationPersistenceSummary;
  currentSideEffectSummary: DailyContentDraftGenerationLlmOutputValidationPersistenceSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface ValidationPersistenceSummary {
  featureFlagName: typeof FEATURE_FLAG_NAME;
  featureFlagEnabled: boolean;
  confirmationPhraseRequired: true;
  confirmationPhraseMatched: boolean;
  idempotencyKeyRequired: true;
  idempotencyKeyPresent: boolean;
  rawIdempotencyKeyStored: false;
  rawConfirmationPhraseStored: false;
  validationCandidateReady: boolean;
  canPersistValidationNow: boolean;
  validationPersistenceBlockers: string[];
  attemptId: string | null;
  eventId: string | null;
  artifactId: string | null;
  eventType: typeof EVENT_TYPE;
  artifactKind: typeof ARTIFACT_KIND;
  persistenceStatus: typeof NOT_CREATED_STATUS | typeof CREATED_STATUS | typeof BLOCKED_STATUS | typeof EXISTING_STATUS;
  validationHash: string | null;
  validationReady: boolean;
  candidateMarkdownAvailable: boolean;
  blockedCheckCount: number;
  passCheckCount: number;
  attemptsCountBefore: number;
  eventsCountBefore: number;
  artifactsCountBefore: number;
  attemptsCountAfter: number;
  eventsCountAfter: number;
  artifactsCountAfter: number;
  idempotencyKeyHashPreview: string | null;
  confirmationPhraseHashPreview: string | null;
}

export interface DailyContentDraftGenerationLlmOutputValidationPersistenceSideEffectSummary {
  dbRead: true;
  dbWrite: boolean;
  auditAttemptMutation: false;
  auditEventMutation: boolean;
  auditArtifactMutation: boolean;
  auditRowsCreated: boolean;
  validationEventPersistedNow: boolean;
  validationArtifactPersistedNow: boolean;
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

export async function buildDailyContentDraftGenerationLlmOutputValidationPersistenceResponse(
  rawRequest: DailyContentDraftGenerationLlmOutputValidationPersistenceRequest
): Promise<DailyContentDraftGenerationLlmOutputValidationPersistenceResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const preview = await buildDailyContentDraftGenerationLlmOutputQualityValidationPreviewResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const previewSummary = preview.draftGenerationLlmOutputQualityValidationPreviewSummary;
  const candidate = buildValidationCandidate(previewSummary);
  const countsBefore = await readGlobalCounts();
  const featureFlagEnabled = process.env[FEATURE_FLAG_NAME] === "true";
  const confirmationPhraseMatched = request.confirmationPhrase === REQUIRED_CONFIRMATION_PHRASE;
  const idempotencyKeyPresent = Boolean(request.idempotencyKey);
  const idempotencyKeyHash = request.idempotencyKey ? sha256(request.idempotencyKey) : null;
  const confirmationPhraseHash = request.confirmationPhrase ? sha256(request.confirmationPhrase) : null;
  const existingArtifact = candidate
    ? await prisma.blogDailyContentLlmDispatchArtifact.findFirst({
        where: {
          attemptId: candidate.attemptId,
          artifactKind: ARTIFACT_KIND,
          artifactHash: candidate.validationHash
        },
        orderBy: { createdAt: "desc" }
      })
    : null;
  const blockers = buildBlockers({
    mode: request.mode,
    featureFlagEnabled,
    confirmationPhraseMatched,
    idempotencyKeyPresent,
    candidateReady: Boolean(candidate),
    existingArtifact: Boolean(existingArtifact)
  });
  const canPersistValidationNow = request.mode === "apply" && blockers.length === 0;
  let validationPersistedNow = false;
  let existingValidationResultReturned = false;
  let eventId: string | null = null;
  let artifactId: string | null = null;
  let persistenceStatus: ValidationPersistenceSummary["persistenceStatus"] =
    request.mode === "preview" ? NOT_CREATED_STATUS : request.mode === "apply" ? BLOCKED_STATUS : BLOCKED_STATUS;

  if (request.mode === "apply" && existingArtifact && featureFlagEnabled && confirmationPhraseMatched && idempotencyKeyPresent) {
    existingValidationResultReturned = true;
    artifactId = existingArtifact.id;
    persistenceStatus = EXISTING_STATUS;
  } else if (canPersistValidationNow && candidate && idempotencyKeyHash && confirmationPhraseHash) {
    const [event, artifact] = await prisma.$transaction([
      prisma.blogDailyContentLlmDispatchEvent.create({
        data: {
          attemptId: candidate.attemptId,
          eventType: EVENT_TYPE,
          eventStatus: "validation_preview_recorded_redacted",
          eventMessage: "LLM output quality validation preview recorded. Full candidate text was not stored.",
          eventPayloadRedactedJson: {
            patchVersion: PATCH_VERSION,
            validationHash: candidate.validationHash,
            validationReady: candidate.validationReady,
            candidateMarkdownAvailable: candidate.candidateMarkdownAvailable,
            blockedCheckCount: candidate.blockedCheckCount,
            passCheckCount: candidate.passCheckCount,
            idempotencyKeyHash,
            confirmationPhraseHash,
            rawPromptStored: false,
            rawResponseStored: false,
            fullCandidateStored: false,
            rawSecretStored: false,
            rawTokenStored: false
          } as Prisma.InputJsonObject,
          rawSecretStored: false,
          rawTokenStored: false
        }
      }),
      prisma.blogDailyContentLlmDispatchArtifact.create({
        data: {
          attemptId: candidate.attemptId,
          artifactKind: ARTIFACT_KIND,
          artifactHash: candidate.validationHash,
          artifactStorageMode: "hash_only",
          artifactRedactionStatus: "redacted_or_hash_only",
          artifactPreview: stableStringify(candidate.artifactPreview),
          rawSecretStored: false,
          rawTokenStored: false
        }
      })
    ]);
    eventId = event.id;
    artifactId = artifact.id;
    validationPersistedNow = true;
    persistenceStatus = CREATED_STATUS;
  }

  const responseBlockers = existingValidationResultReturned ? [] : blockers;
  const countsAfter = await readGlobalCounts();
  const sideEffectSummary = buildSideEffectSummary(validationPersistedNow);
  const summary: DailyContentDraftGenerationLlmOutputValidationPersistenceSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    validationPersistencePatch: true,
    validationPersistenceEvaluated: true,
    validationPersistenceAllowed: canPersistValidationNow || existingValidationResultReturned,
    validationPersistedNow,
    existingValidationResultReturned,
    duplicateValidationResultDetected: Boolean(existingArtifact),
    targetSummary: previewSummary.targetSummary,
    persistedApprovalSummary: previewSummary.persistedApprovalSummary,
    executionGateSummary: previewSummary.executionGateSummary,
    validationPersistenceSummary: {
      featureFlagName: FEATURE_FLAG_NAME,
      featureFlagEnabled,
      confirmationPhraseRequired: true,
      confirmationPhraseMatched,
      idempotencyKeyRequired: true,
      idempotencyKeyPresent,
      rawIdempotencyKeyStored: false,
      rawConfirmationPhraseStored: false,
      validationCandidateReady: Boolean(candidate),
      canPersistValidationNow,
      validationPersistenceBlockers: responseBlockers,
      attemptId: candidate?.attemptId ?? null,
      eventId,
      artifactId,
      eventType: EVENT_TYPE,
      artifactKind: ARTIFACT_KIND,
      persistenceStatus,
      validationHash: candidate?.validationHash ?? null,
      validationReady: candidate?.validationReady ?? false,
      candidateMarkdownAvailable: candidate?.candidateMarkdownAvailable ?? false,
      blockedCheckCount: candidate?.blockedCheckCount ?? 0,
      passCheckCount: candidate?.passCheckCount ?? 0,
      attemptsCountBefore: countsBefore.attempts,
      eventsCountBefore: countsBefore.events,
      artifactsCountBefore: countsBefore.artifacts,
      attemptsCountAfter: countsAfter.attempts,
      eventsCountAfter: countsAfter.events,
      artifactsCountAfter: countsAfter.artifacts,
      idempotencyKeyHashPreview: idempotencyKeyHash,
      confirmationPhraseHashPreview: confirmationPhraseHash
    },
    currentSideEffectSummary: sideEffectSummary,
    blockingReasons: responseBlockers,
    warnings: buildWarnings(request.mode, validationPersistedNow, existingValidationResultReturned)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationLlmOutputValidationPersistenceSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmOutputValidationPersistenceRequest): {
  mode: PersistenceMode;
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

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildValidationCandidate(previewSummary: ValidationPreviewSummary) {
  const attemptId = previewSummary.outputQualityValidationSummary.latestAttemptId;
  if (!attemptId) {
    return null;
  }
  const payload = {
    patchVersion: PATCH_VERSION,
    sourcePatchVersion: previewSummary.patchVersion,
    validationVersion: previewSummary.outputQualityValidationSummary.validationVersion,
    latestAttemptId: attemptId,
    responseHashPrefix: previewSummary.outputQualityValidationSummary.responseHashPrefix,
    responseLength: previewSummary.outputQualityValidationSummary.responseLength,
    validationReady: previewSummary.outputQualityValidationSummary.validationReady,
    candidateMarkdownAvailable: previewSummary.outputQualityValidationSummary.candidateMarkdownAvailable,
    canRunFullMarkdownValidation: previewSummary.outputQualityValidationSummary.canRunFullMarkdownValidation,
    blockedCheckCount: previewSummary.outputQualityValidationSummary.blockedCount,
    passCheckCount: previewSummary.outputQualityValidationSummary.passCount,
    checkStatuses: previewSummary.outputQualityValidationSummary.checks.map((check) => ({
      key: check.key,
      status: check.status,
      required: check.required
    })),
    rawPromptStored: false,
    rawResponseStored: false,
    fullCandidateStored: false,
    rawSecretStored: false,
    rawTokenStored: false
  };
  return {
    attemptId,
    validationHash: sha256(stableStringify(payload)),
    validationReady: previewSummary.outputQualityValidationSummary.validationReady,
    candidateMarkdownAvailable: previewSummary.outputQualityValidationSummary.candidateMarkdownAvailable,
    blockedCheckCount: previewSummary.outputQualityValidationSummary.blockedCount,
    passCheckCount: previewSummary.outputQualityValidationSummary.passCount,
    artifactPreview: payload
  };
}

function buildBlockers(input: {
  mode: PersistenceMode;
  featureFlagEnabled: boolean;
  confirmationPhraseMatched: boolean;
  idempotencyKeyPresent: boolean;
  candidateReady: boolean;
  existingArtifact: boolean;
}) {
  const blockers = new Set<string>();
  if (input.mode === "blocked_non_supported_mode") {
    blockers.add("draft_generation_llm_output_validation_persistence_mode_not_allowed");
  }
  if (input.mode === "preview") {
    blockers.add("draft_generation_llm_output_validation_persistence_preview_only");
  }
  if (!input.featureFlagEnabled) {
    blockers.add("draft_generation_llm_output_validation_persistence_feature_flag_disabled");
  }
  if (!input.confirmationPhraseMatched) {
    blockers.add("confirmation_phrase_missing_or_mismatch");
  }
  if (!input.idempotencyKeyPresent) {
    blockers.add("idempotency_key_missing");
  }
  if (!input.candidateReady) {
    blockers.add("draft_generation_llm_output_validation_candidate_missing");
  }
  if (input.existingArtifact) {
    blockers.add("draft_generation_llm_output_validation_result_already_persisted");
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

function buildSideEffectSummary(persisted: boolean): DailyContentDraftGenerationLlmOutputValidationPersistenceSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: persisted,
    auditAttemptMutation: false,
    auditEventMutation: persisted,
    auditArtifactMutation: persisted,
    auditRowsCreated: persisted,
    validationEventPersistedNow: persisted,
    validationArtifactPersistedNow: persisted,
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

function buildWarnings(mode: PersistenceMode, persisted: boolean, existingReturned: boolean) {
  const warnings = new Set<string>([
    "draft_generation_llm_output_validation_persistence_does_not_mutate_content_items",
    "blogger_write_disabled_by_patch_policy",
    "raw_prompt_response_and_candidate_not_stored"
  ]);
  if (mode === "preview") {
    warnings.add("validation_persistence_preview_only");
  }
  if (persisted) {
    warnings.add("validation_result_persisted_as_audit_only");
  }
  if (existingReturned) {
    warnings.add("existing_validation_result_returned");
  }
  return Array.from(warnings);
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
