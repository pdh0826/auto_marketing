import { createHash } from "crypto";
import {
  buildDailyContentDraftGenerationLlmDispatchAttemptCreationGatePreviewResponse,
  type DailyContentDraftGenerationLlmDispatchAttemptCreationGatePreviewResponse
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-attempt-creation-gate-preview";
import { buildDailyContentDraftGenerationLlmRequestEnvelopePreviewResponse } from "@/lib/daily-content-plans/draft-generation-llm-request-envelope-preview";
import { buildDailyContentDraftGenerationPromptQualityChecklistPreviewResponse } from "@/lib/daily-content-plans/draft-generation-prompt-quality-checklist-preview";
import { prisma } from "@/lib/db/client";

const PATCH_VERSION = "9F-2Z";
const ATTEMPT_PURPOSE = "draft_generation_execution";
const CREATED_ATTEMPT_STATUS = "created_pending_dispatch_gate";
const NOT_CREATED_STATUS = "not_created_preview_only";
const BLOCKED_STATUS = "blocked";
const EXISTING_ATTEMPT_STATUS = "existing_attempt_returned";
const FEATURE_FLAG_NAME = "BLOG_DAILY_CONTENT_LLM_DISPATCH_ATTEMPT_CREATE_ENABLED";
const REQUIRED_CONFIRMATION_PHRASE = "I_UNDERSTAND_THIS_CREATES_ONE_LLM_DISPATCH_AUDIT_ATTEMPT_WITHOUT_PROVIDER_CALL";
const DISPATCH_GATE_VERSION = "daily_content_draft_generation_llm_dispatch_gate_v0";

type AttemptCreationMode = "preview" | "apply" | "blocked_non_supported_mode";
type GatePreviewSummary =
  DailyContentDraftGenerationLlmDispatchAttemptCreationGatePreviewResponse["draftGenerationLlmDispatchAttemptCreationGatePreviewSummary"];

export interface DailyContentDraftGenerationLlmDispatchAttemptCreationRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
  confirmationPhrase?: unknown;
  idempotencyKey?: unknown;
}

export interface DailyContentDraftGenerationLlmDispatchAttemptCreationResponse
  extends DailyContentDraftGenerationLlmDispatchAttemptCreationSummary {
  checkedAt: string;
  draftGenerationLlmDispatchAttemptCreationSummary: DailyContentDraftGenerationLlmDispatchAttemptCreationSummary;
}

export interface DailyContentDraftGenerationLlmDispatchAttemptCreationSummary {
  patchVersion: "9F-2Z";
  checked: true;
  mode: AttemptCreationMode;
  requestedMode: string;
  creationPersistencePatch: true;
  attemptCreationEvaluated: true;
  attemptCreationAllowed: boolean;
  attemptCreatedNow: boolean;
  existingAttemptReturned: boolean;
  duplicateIdempotencyKey: boolean;
  targetSummary: GatePreviewSummary["targetSummary"];
  persistedApprovalSummary: GatePreviewSummary["persistedApprovalSummary"];
  executionGateSummary: {
    executionAllowed: false;
    finalDraftGenerationAllowed: false;
    remainingBlockers: string[];
    resolvedBlockers: string[];
  };
  attemptCreationSummary: AttemptCreationSummary;
  currentSideEffectSummary: DailyContentDraftGenerationLlmDispatchAttemptCreationSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface AttemptCreationSummary {
  attemptCreationFeatureFlagName: typeof FEATURE_FLAG_NAME;
  attemptCreationFeatureFlagEnabled: boolean;
  confirmationPhraseRequired: true;
  confirmationPhraseMatched: boolean;
  idempotencyKeyRequired: true;
  idempotencyKeyPresent: boolean;
  rawIdempotencyKeyStored: false;
  idempotencyKeyHashStored: true;
  rawConfirmationPhraseStored: false;
  confirmationPhraseHashStored: true;
  canCreateAttemptNow: boolean;
  creationBlockers: string[];
  attemptId: string | null;
  attemptStatus: typeof CREATED_ATTEMPT_STATUS | typeof NOT_CREATED_STATUS | typeof BLOCKED_STATUS | typeof EXISTING_ATTEMPT_STATUS;
  attemptsCountBefore: number;
  attemptsCountAfter: number;
  eventsCountAfter: number;
  artifactsCountAfter: number;
  existingAttemptReturned: boolean;
  duplicateIdempotencyKey: boolean;
  requestEnvelopeHash: string | null;
  idempotencyKeyHashPreview: string | null;
  confirmationPhraseHashPreview: string | null;
}

export interface DailyContentDraftGenerationLlmDispatchAttemptCreationSideEffectSummary {
  dbRead: true;
  dbWrite: boolean;
  auditAttemptMutation: boolean;
  auditEventMutation: false;
  auditArtifactMutation: false;
  auditRowsCreated: boolean;
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

export async function buildDailyContentDraftGenerationLlmDispatchAttemptCreationResponse(
  rawRequest: DailyContentDraftGenerationLlmDispatchAttemptCreationRequest
): Promise<DailyContentDraftGenerationLlmDispatchAttemptCreationResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const [gatePreview, requestEnvelope, promptQuality, countsBefore] = await Promise.all([
    buildDailyContentDraftGenerationLlmDispatchAttemptCreationGatePreviewResponse({
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
    buildDailyContentDraftGenerationPromptQualityChecklistPreviewResponse({
      mode: "preview",
      planId: request.planId,
      planItemId: request.planItemId,
      contentItemId: request.contentItemId
    }),
    readAttemptCounts()
  ]);
  const gateSummary = gatePreview.draftGenerationLlmDispatchAttemptCreationGatePreviewSummary;
  const requestEnvelopeSummary = requestEnvelope.draftGenerationLlmRequestEnvelopePreviewSummary.requestEnvelopePreviewSummary;
  const promptQualitySummary = promptQuality.draftGenerationPromptQualityChecklistPreviewSummary.promptQualityChecklistSummary;
  const attemptCreateFlagEnabled = process.env[FEATURE_FLAG_NAME] === "true";
  const confirmationPhraseMatched = request.confirmationPhrase === REQUIRED_CONFIRMATION_PHRASE;
  const idempotencyKeyPresent = Boolean(request.idempotencyKey);
  const idempotencyKeyHash = request.idempotencyKey ? sha256(request.idempotencyKey) : null;
  const confirmationPhraseHash = request.confirmationPhrase ? sha256(request.confirmationPhrase) : null;
  const requestEnvelopeHash = sha256(
    stableJson({
      patchVersion: PATCH_VERSION,
      targetSummary: gateSummary.targetSummary,
      providerKey: requestEnvelopeSummary.providerKey,
      providerKind: requestEnvelopeSummary.providerKind,
      modelKey: requestEnvelopeSummary.modelKey,
      modelDisplayName: requestEnvelopeSummary.modelDisplayName,
      promptSha256: requestEnvelopeSummary.promptSha256,
      promptVersion: promptQualitySummary.promptVersion,
      promptQualityChecklistVersion: promptQualitySummary.checklistVersion,
      dispatchGateVersion: DISPATCH_GATE_VERSION,
      attemptCreationGateVersion: gateSummary.attemptCreationGatePreviewSummary.gateVersion,
      requestEnvelopeVersion: requestEnvelopeSummary.envelopeVersion,
      requestPurpose: requestEnvelopeSummary.requestPurpose
    })
  );
  const existingDuplicate =
    idempotencyKeyHash && request.planItemId && request.contentItemId
      ? await prisma.blogDailyContentLlmDispatchAttempt.findFirst({
          where: {
            planItemId: request.planItemId,
            contentItemId: request.contentItemId,
            attemptPurpose: ATTEMPT_PURPOSE,
            idempotencyKeyHash
          },
          orderBy: { createdAt: "desc" }
        })
      : null;
  const latestTargetAttempt = gateSummary.attemptCreationGatePreviewSummary.latestTargetAttempt;
  const creationBlockers = buildCreationBlockers({
    mode: request.mode,
    attemptCreateFlagEnabled,
    confirmationPhraseMatched,
    idempotencyKeyPresent,
    gateSummary,
    existingDuplicate: Boolean(existingDuplicate),
    latestTargetAttemptExists: Boolean(latestTargetAttempt)
  });
  const canCreateAttemptNow = request.mode === "apply" && creationBlockers.length === 0;
  let attemptCreatedNow = false;
  let existingAttemptReturned = false;
  let duplicateIdempotencyKey = false;
  let attemptId: string | null = null;
  let attemptStatus: AttemptCreationSummary["attemptStatus"] =
    request.mode === "preview" ? NOT_CREATED_STATUS : request.mode === "apply" ? BLOCKED_STATUS : BLOCKED_STATUS;

  if (request.mode === "apply" && existingDuplicate && canReturnDuplicate({ attemptCreateFlagEnabled, confirmationPhraseMatched, idempotencyKeyPresent, gateSummary })) {
    existingAttemptReturned = true;
    duplicateIdempotencyKey = true;
    attemptId = existingDuplicate.id;
    attemptStatus = EXISTING_ATTEMPT_STATUS;
  } else if (canCreateAttemptNow && request.planId && request.planItemId && request.contentItemId && gateSummary.persistedApprovalSummary.approvalId && idempotencyKeyHash && confirmationPhraseHash) {
    const created = await prisma.blogDailyContentLlmDispatchAttempt.create({
      data: {
        planId: request.planId,
        planItemId: request.planItemId,
        contentItemId: request.contentItemId,
        operatorApprovalId: gateSummary.persistedApprovalSummary.approvalId,
        idempotencyKeyHash,
        attemptPurpose: ATTEMPT_PURPOSE,
        attemptStatus: CREATED_ATTEMPT_STATUS,
        providerKey: requestEnvelopeSummary.providerKey,
        providerKind: requestEnvelopeSummary.providerKind,
        modelKey: requestEnvelopeSummary.modelKey,
        modelDisplayName: requestEnvelopeSummary.modelDisplayName,
        requestEnvelopeHash,
        promptSha256: requestEnvelopeSummary.promptSha256,
        promptVersion: promptQualitySummary.promptVersion,
        promptQualityChecklistVersion: promptQualitySummary.checklistVersion,
        dispatchGateVersion: DISPATCH_GATE_VERSION,
        healthCheckSummaryHash: sha256(
          stableJson({
            providerHealthCheckSatisfiedNow: gateSummary.attemptCreationGatePreviewSummary.providerHealthCheckSatisfiedNow,
            providerNetworkCallAttempted: false
          })
        ),
        confirmationPhraseHash,
        requestBodyStored: false,
        requestBodyRedacted: true,
        responseBodyStored: false,
        responseBodyRedacted: true,
        rawSecretStored: false,
        rawTokenStored: false,
        providerNetworkCallAttempted: false,
        llmCallAttempted: false,
        llmCompletionReceived: false,
        contentMutationAttempted: false,
        draftMutationAttempted: false,
        bloggerWriteAttempted: false,
        metadata: {
          patchVersion: PATCH_VERSION,
          sourceGatePreviewPatchVersion: "9F-2Y",
          attemptCreationGateVersion: gateSummary.attemptCreationGatePreviewSummary.gateVersion,
          dispatchGateVersion: DISPATCH_GATE_VERSION,
          createdFor: "daily_content_draft_generation_dispatch_attempt_audit_only",
          providerCallAllowed: false,
          llmCallAllowed: false,
          contentMutationAllowed: false,
          bloggerWriteAllowed: false,
          rawIdempotencyKeyStored: false,
          rawConfirmationPhraseStored: false
        }
      }
    });
    attemptCreatedNow = true;
    attemptId = created.id;
    attemptStatus = CREATED_ATTEMPT_STATUS;
  }

  const countsAfter = await readAttemptCounts();
  const sideEffectSummary = buildSideEffectSummary(attemptCreatedNow);
  const summary: DailyContentDraftGenerationLlmDispatchAttemptCreationSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    creationPersistencePatch: true,
    attemptCreationEvaluated: true,
    attemptCreationAllowed: canCreateAttemptNow || existingAttemptReturned,
    attemptCreatedNow,
    existingAttemptReturned,
    duplicateIdempotencyKey,
    targetSummary: gateSummary.targetSummary,
    persistedApprovalSummary: gateSummary.persistedApprovalSummary,
    executionGateSummary: {
      executionAllowed: false,
      finalDraftGenerationAllowed: false,
      remainingBlockers: gateSummary.executionGateSummary.remainingBlockers,
      resolvedBlockers: gateSummary.executionGateSummary.resolvedBlockers
    },
    attemptCreationSummary: {
      attemptCreationFeatureFlagName: FEATURE_FLAG_NAME,
      attemptCreationFeatureFlagEnabled: attemptCreateFlagEnabled,
      confirmationPhraseRequired: true,
      confirmationPhraseMatched,
      idempotencyKeyRequired: true,
      idempotencyKeyPresent,
      rawIdempotencyKeyStored: false,
      idempotencyKeyHashStored: true,
      rawConfirmationPhraseStored: false,
      confirmationPhraseHashStored: true,
      canCreateAttemptNow,
      creationBlockers,
      attemptId,
      attemptStatus,
      attemptsCountBefore: countsBefore.attempts,
      attemptsCountAfter: countsAfter.attempts,
      eventsCountAfter: countsAfter.events,
      artifactsCountAfter: countsAfter.artifacts,
      existingAttemptReturned,
      duplicateIdempotencyKey,
      requestEnvelopeHash,
      idempotencyKeyHashPreview: idempotencyKeyHash,
      confirmationPhraseHashPreview: confirmationPhraseHash
    },
    currentSideEffectSummary: sideEffectSummary,
    blockingReasons: creationBlockers,
    warnings: buildWarnings(request.mode, attemptCreatedNow, existingAttemptReturned)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationLlmDispatchAttemptCreationSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmDispatchAttemptCreationRequest): {
  mode: AttemptCreationMode;
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

function buildCreationBlockers(input: {
  mode: AttemptCreationMode;
  attemptCreateFlagEnabled: boolean;
  confirmationPhraseMatched: boolean;
  idempotencyKeyPresent: boolean;
  gateSummary: GatePreviewSummary;
  existingDuplicate: boolean;
  latestTargetAttemptExists: boolean;
}) {
  const blockers = new Set<string>();
  const target = input.gateSummary.targetSummary;

  if (input.mode !== "preview" && input.mode !== "apply") {
    blockers.add("draft_generation_llm_dispatch_attempt_creation_mode_not_allowed");
  }
  if (input.mode === "preview") {
    blockers.add("draft_generation_llm_dispatch_attempt_creation_preview_only");
  }
  if (input.mode === "apply" && !input.attemptCreateFlagEnabled) {
    blockers.add("llm_dispatch_attempt_create_feature_flag_disabled");
  }
  if (input.mode === "apply" && !input.confirmationPhraseMatched) {
    blockers.add("confirmation_phrase_missing_or_mismatch");
  }
  if (input.mode === "apply" && !input.idempotencyKeyPresent) {
    blockers.add("idempotency_key_missing");
  }
  if (!target.linkedFixtureFound) {
    blockers.add("linked_content_fixture_not_found");
  }
  if (!target.linkedFixtureMatchesPlanItem) {
    blockers.add("linked_content_item_mismatch");
  }
  if (target.fixtureStatus !== "planned") {
    blockers.add("content_item_not_planned");
  }
  if (!target.fixtureHasNoDraftMarkdown) {
    blockers.add("draft_markdown_already_exists");
  }
  if (!target.fixtureHasNoDraftHtml) {
    blockers.add("draft_html_already_exists");
  }
  if (!input.gateSummary.persistedApprovalSummary.operatorApprovalSatisfied || !input.gateSummary.persistedApprovalSummary.approvalId) {
    blockers.add("operator_approval_missing");
  }
  if (!input.gateSummary.attemptCreationGatePreviewSummary.auditTablesExist) {
    blockers.add("dispatch_audit_tables_missing");
  }
  if (input.mode === "apply" && input.latestTargetAttemptExists && !input.existingDuplicate) {
    blockers.add("target_dispatch_attempt_already_exists");
  }

  return Array.from(blockers);
}

function canReturnDuplicate(input: {
  attemptCreateFlagEnabled: boolean;
  confirmationPhraseMatched: boolean;
  idempotencyKeyPresent: boolean;
  gateSummary: GatePreviewSummary;
}) {
  return (
    input.attemptCreateFlagEnabled &&
    input.confirmationPhraseMatched &&
    input.idempotencyKeyPresent &&
    input.gateSummary.persistedApprovalSummary.operatorApprovalSatisfied &&
    input.gateSummary.attemptCreationGatePreviewSummary.auditTablesExist
  );
}

async function readAttemptCounts() {
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

function buildSideEffectSummary(attemptCreatedNow: boolean): DailyContentDraftGenerationLlmDispatchAttemptCreationSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: attemptCreatedNow,
    auditAttemptMutation: attemptCreatedNow,
    auditEventMutation: false,
    auditArtifactMutation: false,
    auditRowsCreated: attemptCreatedNow,
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

function buildWarnings(mode: AttemptCreationMode, attemptCreatedNow: boolean, existingAttemptReturned: boolean) {
  const warnings = ["provider_call_disabled_by_patch_policy", "content_item_mutation_disabled", "blogger_write_disabled_by_patch_policy"];
  if (mode === "preview") {
    warnings.push("draft_generation_llm_dispatch_attempt_creation_preview_only");
  }
  if (attemptCreatedNow) {
    warnings.push("audit_attempt_row_created_without_provider_call");
  }
  if (existingAttemptReturned) {
    warnings.push("duplicate_idempotency_key_returned_existing_attempt");
  }
  return warnings;
}
