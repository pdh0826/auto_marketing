import { createHash } from "crypto";
import {
  buildDailyContentDraftGenerationLlmDispatchAttemptEventPreviewResponse,
  type DailyContentDraftGenerationLlmDispatchAttemptEventPreviewResponse
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-attempt-event-preview";
import { prisma } from "@/lib/db/client";

const PATCH_VERSION = "9F-3B";
const FEATURE_FLAG_NAME = "BLOG_DAILY_CONTENT_LLM_DISPATCH_EVENT_CREATE_ENABLED";
const REQUIRED_CONFIRMATION_PHRASE = "I_UNDERSTAND_THIS_CREATES_ONE_LLM_DISPATCH_AUDIT_EVENT_WITHOUT_PROVIDER_CALL";
const CREATED_EVENT_STATUS = "recorded_audit_only";
const NOT_CREATED_STATUS = "not_created_preview_only";
const BLOCKED_STATUS = "blocked";
const EXISTING_EVENT_STATUS = "existing_event_returned";

type EventCreationMode = "preview" | "apply" | "blocked_non_supported_mode";
type EventPreviewSummary =
  DailyContentDraftGenerationLlmDispatchAttemptEventPreviewResponse["draftGenerationLlmDispatchAttemptEventPreviewSummary"];

export interface DailyContentDraftGenerationLlmDispatchAttemptEventCreationRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
  confirmationPhrase?: unknown;
  idempotencyKey?: unknown;
}

export interface DailyContentDraftGenerationLlmDispatchAttemptEventCreationResponse
  extends DailyContentDraftGenerationLlmDispatchAttemptEventCreationSummary {
  checkedAt: string;
  draftGenerationLlmDispatchAttemptEventCreationSummary: DailyContentDraftGenerationLlmDispatchAttemptEventCreationSummary;
}

export interface DailyContentDraftGenerationLlmDispatchAttemptEventCreationSummary {
  patchVersion: "9F-3B";
  checked: true;
  mode: EventCreationMode;
  requestedMode: string;
  eventCreationPersistencePatch: true;
  eventCreationEvaluated: true;
  eventCreationAllowed: boolean;
  eventCreatedNow: boolean;
  existingEventReturned: boolean;
  duplicateEventDetected: boolean;
  targetSummary: EventPreviewSummary["targetSummary"];
  persistedApprovalSummary: EventPreviewSummary["persistedApprovalSummary"];
  executionGateSummary: EventPreviewSummary["executionGateSummary"];
  eventCreationSummary: EventCreationSummary;
  currentSideEffectSummary: DailyContentDraftGenerationLlmDispatchAttemptEventCreationSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface EventCreationSummary {
  eventCreationFeatureFlagName: typeof FEATURE_FLAG_NAME;
  eventCreationFeatureFlagEnabled: boolean;
  confirmationPhraseRequired: true;
  confirmationPhraseMatched: boolean;
  idempotencyKeyRequired: true;
  idempotencyKeyPresent: boolean;
  rawIdempotencyKeyStored: false;
  idempotencyKeyHashStoredInPayload: boolean;
  rawConfirmationPhraseStored: false;
  confirmationPhraseHashStoredInPayload: boolean;
  eventCandidateReady: boolean;
  canCreateEventNow: boolean;
  eventCreationBlockers: string[];
  attemptId: string | null;
  eventId: string | null;
  eventType: string | null;
  eventStatus: typeof CREATED_EVENT_STATUS | typeof NOT_CREATED_STATUS | typeof BLOCKED_STATUS | typeof EXISTING_EVENT_STATUS;
  attemptsCountBefore: number;
  eventsCountBefore: number;
  artifactsCountBefore: number;
  attemptsCountAfter: number;
  eventsCountAfter: number;
  artifactsCountAfter: number;
  existingEventReturned: boolean;
  eventPayloadHash: string | null;
  idempotencyKeyHashPreview: string | null;
  confirmationPhraseHashPreview: string | null;
}

export interface DailyContentDraftGenerationLlmDispatchAttemptEventCreationSideEffectSummary {
  dbRead: true;
  dbWrite: boolean;
  auditAttemptMutation: false;
  auditEventMutation: boolean;
  auditArtifactMutation: false;
  auditRowsCreated: boolean;
  eventInsertAttempted: boolean;
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

export async function buildDailyContentDraftGenerationLlmDispatchAttemptEventCreationResponse(
  rawRequest: DailyContentDraftGenerationLlmDispatchAttemptEventCreationRequest
): Promise<DailyContentDraftGenerationLlmDispatchAttemptEventCreationResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const preview = await buildDailyContentDraftGenerationLlmDispatchAttemptEventPreviewResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const previewSummary = preview.draftGenerationLlmDispatchAttemptEventPreviewSummary;
  const candidate = previewSummary.attemptEventPreviewSummary.candidateEvent;
  const countsBefore = previewSummary.attemptEventPreviewSummary.globalCountsBefore;
  const featureFlagEnabled = process.env[FEATURE_FLAG_NAME] === "true";
  const confirmationPhraseMatched = request.confirmationPhrase === REQUIRED_CONFIRMATION_PHRASE;
  const idempotencyKeyPresent = Boolean(request.idempotencyKey);
  const idempotencyKeyHash = request.idempotencyKey ? sha256(request.idempotencyKey) : null;
  const confirmationPhraseHash = request.confirmationPhrase ? sha256(request.confirmationPhrase) : null;
  const existingEvent = candidate
    ? await prisma.blogDailyContentLlmDispatchEvent.findFirst({
        where: {
          attemptId: candidate.attemptId,
          eventType: candidate.eventType
        },
        orderBy: { createdAt: "desc" }
      })
    : null;
  const eventCreationBlockers = buildEventCreationBlockers({
    mode: request.mode,
    featureFlagEnabled,
    confirmationPhraseMatched,
    idempotencyKeyPresent,
    eventCandidateReady: previewSummary.attemptEventPreviewSummary.eventCandidateReady,
    existingEvent: Boolean(existingEvent)
  });
  const canCreateEventNow = request.mode === "apply" && eventCreationBlockers.length === 0;
  let eventCreatedNow = false;
  let existingEventReturned = false;
  let eventId: string | null = null;
  let eventStatus: EventCreationSummary["eventStatus"] =
    request.mode === "preview" ? NOT_CREATED_STATUS : request.mode === "apply" ? BLOCKED_STATUS : BLOCKED_STATUS;

  if (request.mode === "apply" && existingEvent && featureFlagEnabled && confirmationPhraseMatched && idempotencyKeyPresent) {
    existingEventReturned = true;
    eventId = existingEvent.id;
    eventStatus = EXISTING_EVENT_STATUS;
  } else if (canCreateEventNow && candidate && idempotencyKeyHash && confirmationPhraseHash) {
    const created = await prisma.blogDailyContentLlmDispatchEvent.create({
      data: {
        attemptId: candidate.attemptId,
        eventType: candidate.eventType,
        eventStatus: candidate.eventStatus,
        eventMessage: candidate.eventMessage,
        eventPayloadRedactedJson: {
          patchVersion: PATCH_VERSION,
          eventPayloadHash: candidate.eventPayloadHash,
          idempotencyKeyHash,
          confirmationPhraseHash,
          rawIdempotencyKeyStored: false,
          rawConfirmationPhraseStored: false,
          rawSecretStored: false,
          rawTokenStored: false,
          providerNetworkCallAttempted: false,
          llmCallAttempted: false,
          contentMutationAttempted: false,
          bloggerWriteAttempted: false
        },
        rawSecretStored: false,
        rawTokenStored: false
      }
    });
    eventCreatedNow = true;
    eventId = created.id;
    eventStatus = CREATED_EVENT_STATUS;
  }

  const responseBlockers = existingEventReturned ? [] : eventCreationBlockers;
  const countsAfter = await readGlobalCounts();
  const sideEffectSummary = buildSideEffectSummary(eventCreatedNow);
  const summary: DailyContentDraftGenerationLlmDispatchAttemptEventCreationSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    eventCreationPersistencePatch: true,
    eventCreationEvaluated: true,
    eventCreationAllowed: canCreateEventNow || existingEventReturned,
    eventCreatedNow,
    existingEventReturned,
    duplicateEventDetected: Boolean(existingEvent),
    targetSummary: previewSummary.targetSummary,
    persistedApprovalSummary: previewSummary.persistedApprovalSummary,
    executionGateSummary: {
      executionAllowed: false,
      finalDraftGenerationAllowed: false,
      remainingBlockers: previewSummary.executionGateSummary.remainingBlockers,
      resolvedBlockers: previewSummary.executionGateSummary.resolvedBlockers
    },
    eventCreationSummary: {
      eventCreationFeatureFlagName: FEATURE_FLAG_NAME,
      eventCreationFeatureFlagEnabled: featureFlagEnabled,
      confirmationPhraseRequired: true,
      confirmationPhraseMatched,
      idempotencyKeyRequired: true,
      idempotencyKeyPresent,
      rawIdempotencyKeyStored: false,
      idempotencyKeyHashStoredInPayload: eventCreatedNow,
      rawConfirmationPhraseStored: false,
      confirmationPhraseHashStoredInPayload: eventCreatedNow,
      eventCandidateReady: previewSummary.attemptEventPreviewSummary.eventCandidateReady,
      canCreateEventNow,
      eventCreationBlockers: responseBlockers,
      attemptId: candidate?.attemptId ?? null,
      eventId,
      eventType: candidate?.eventType ?? null,
      eventStatus,
      attemptsCountBefore: countsBefore.attempts,
      eventsCountBefore: countsBefore.events,
      artifactsCountBefore: countsBefore.artifacts,
      attemptsCountAfter: countsAfter.attempts,
      eventsCountAfter: countsAfter.events,
      artifactsCountAfter: countsAfter.artifacts,
      existingEventReturned,
      eventPayloadHash: candidate?.eventPayloadHash ?? null,
      idempotencyKeyHashPreview: idempotencyKeyHash,
      confirmationPhraseHashPreview: confirmationPhraseHash
    },
    currentSideEffectSummary: sideEffectSummary,
    blockingReasons: responseBlockers,
    warnings: buildWarnings(request.mode, eventCreatedNow, existingEventReturned)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationLlmDispatchAttemptEventCreationSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmDispatchAttemptEventCreationRequest): {
  mode: EventCreationMode;
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

function buildEventCreationBlockers(input: {
  mode: EventCreationMode;
  featureFlagEnabled: boolean;
  confirmationPhraseMatched: boolean;
  idempotencyKeyPresent: boolean;
  eventCandidateReady: boolean;
  existingEvent: boolean;
}) {
  const blockers = new Set<string>();

  if (input.mode !== "preview" && input.mode !== "apply") {
    blockers.add("draft_generation_llm_dispatch_attempt_event_creation_mode_not_allowed");
  }
  if (input.mode === "preview") {
    blockers.add("draft_generation_llm_dispatch_attempt_event_creation_preview_only");
  }
  if (!input.eventCandidateReady) {
    blockers.add("dispatch_attempt_event_candidate_not_ready");
  }
  if (input.mode === "apply" && !input.featureFlagEnabled) {
    blockers.add("llm_dispatch_event_create_feature_flag_disabled");
  }
  if (input.mode === "apply" && !input.confirmationPhraseMatched) {
    blockers.add("confirmation_phrase_missing_or_mismatch");
  }
  if (input.mode === "apply" && !input.idempotencyKeyPresent) {
    blockers.add("idempotency_key_missing");
  }
  if (input.mode === "apply" && input.existingEvent) {
    blockers.add("target_dispatch_event_already_exists");
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

function buildSideEffectSummary(eventCreatedNow: boolean): DailyContentDraftGenerationLlmDispatchAttemptEventCreationSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: eventCreatedNow,
    auditAttemptMutation: false,
    auditEventMutation: eventCreatedNow,
    auditArtifactMutation: false,
    auditRowsCreated: eventCreatedNow,
    eventInsertAttempted: eventCreatedNow,
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

function buildWarnings(mode: EventCreationMode, eventCreatedNow: boolean, existingEventReturned: boolean) {
  const warnings = ["provider_call_disabled_by_patch_policy", "content_item_mutation_disabled", "blogger_write_disabled_by_patch_policy"];
  if (mode === "preview") {
    warnings.push("draft_generation_llm_dispatch_attempt_event_creation_preview_only");
  }
  if (eventCreatedNow) {
    warnings.push("audit_event_row_created_without_provider_call");
  }
  if (existingEventReturned) {
    warnings.push("existing_dispatch_event_returned_without_insert");
  }
  return warnings;
}
