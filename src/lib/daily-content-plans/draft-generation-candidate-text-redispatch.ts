import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { createLlmCallLog } from "@/lib/db/llm-call-logs";
import {
  buildDailyContentDraftGenerationLlmDispatchExecutionPlanLockResponse,
  type DailyContentDraftGenerationLlmDispatchExecutionPlanLockResponse
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-execution-plan-lock";
import {
  callDailyContentDraftProviderOnce,
  type DailyContentDraftProviderCallResult
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-execution";
import { buildDailyContentDraftGenerationLlmRequestEnvelopePreviewResponse } from "@/lib/daily-content-plans/draft-generation-llm-request-envelope-preview";
import { buildDailyContentDraftGenerationPromptQualityChecklistPreviewResponse } from "@/lib/daily-content-plans/draft-generation-prompt-quality-checklist-preview";
import { buildDailyContentDraftGenerationPromptRenderPreviewResponse } from "@/lib/daily-content-plans/draft-generation-prompt-render-preview";
import { safeErrorMessage } from "@/lib/llm/redaction";

const PATCH_VERSION = "9F-3I-R1";
const ATTEMPT_PURPOSE = "daily_content_draft_generation_candidate_text_redispatch";
const FEATURE_FLAG_NAME = "BLOG_DAILY_CONTENT_DRAFT_GENERATION_CANDIDATE_TEXT_REDISPATCH_ENABLED";
const REQUIRED_CONFIRMATION_PHRASE = "I_UNDERSTAND_THIS_CALLS_ONE_LLM_PROVIDER_AND_STORES_CANDIDATE_TEXT_ARTIFACT_WITHOUT_CONTENT_MUTATION";
const RESPONSE_EVENT_TYPE = "llm_candidate_text_provider_response_received";
const FAILED_EVENT_TYPE = "llm_candidate_text_provider_call_failed";
const RESPONSE_ARTIFACT_KIND = "llm_response_metadata_hash";
const CANDIDATE_ARTIFACT_KIND = "llm_candidate_markdown_text";
const CANDIDATE_STORAGE_MODE = "controlled_candidate_text";
const CANDIDATE_REDACTION_STATUS = "candidate_text_policy_checked";
const DISPATCH_GATE_VERSION = "daily_content_draft_generation_candidate_text_redispatch_v0";

type RedispatchMode = "preview" | "execute" | "blocked_non_supported_mode";
type PlanLockSummary =
  DailyContentDraftGenerationLlmDispatchExecutionPlanLockResponse["draftGenerationLlmDispatchExecutionPlanLockSummary"];

export interface DailyContentDraftGenerationCandidateTextRedispatchRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
  confirmationPhrase?: unknown;
  idempotencyKey?: unknown;
}

export interface DailyContentDraftGenerationCandidateTextRedispatchResponse
  extends DailyContentDraftGenerationCandidateTextRedispatchSummary {
  checkedAt: string;
  draftGenerationCandidateTextRedispatchSummary: DailyContentDraftGenerationCandidateTextRedispatchSummary;
}

export interface DailyContentDraftGenerationCandidateTextRedispatchSummary {
  patchVersion: "9F-3I-R1";
  checked: true;
  mode: RedispatchMode;
  requestedMode: string;
  redispatchImplemented: true;
  redispatchAllowed: boolean;
  redispatchExecutedNow: boolean;
  existingRedispatchReturned: boolean;
  targetSummary: PlanLockSummary["targetSummary"];
  persistedApprovalSummary: PlanLockSummary["persistedApprovalSummary"];
  executionGateSummary: PlanLockSummary["executionGateSummary"];
  candidateTextRedispatchSummary: CandidateTextRedispatchSummary;
  currentSideEffectSummary: CandidateTextRedispatchSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface CandidateTextRedispatchSummary {
  featureFlagName: typeof FEATURE_FLAG_NAME;
  featureFlagEnabled: boolean;
  confirmationPhraseRequired: true;
  confirmationPhraseMatched: boolean;
  idempotencyKeyRequired: true;
  idempotencyKeyPresent: boolean;
  rawIdempotencyKeyStored: false;
  rawConfirmationPhraseStored: false;
  canExecuteNow: boolean;
  redispatchBlockers: string[];
  attemptId: string | null;
  attemptPurpose: typeof ATTEMPT_PURPOSE;
  llmCallLogId: string | null;
  responseEventId: string | null;
  responseArtifactId: string | null;
  candidateArtifactId: string | null;
  candidateArtifactKind: typeof CANDIDATE_ARTIFACT_KIND;
  candidateArtifactStorageMode: typeof CANDIDATE_STORAGE_MODE;
  candidateArtifactRedactionStatus: typeof CANDIDATE_REDACTION_STATUS;
  candidateMarkdownHash: string | null;
  candidateMarkdownLength: number | null;
  candidateMarkdownStoredAsControlledArtifact: boolean;
  candidateMarkdownReturned: false;
  candidatePreviewReturned: false;
  rawPromptStoredOrReturned: false;
  rawResponseStoredOrReturned: false;
  secretOrTokenStoredOrReturned: false;
  responseSummary: string | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface CandidateTextRedispatchSideEffectSummary {
  dbRead: true;
  dbWrite: boolean;
  auditAttemptMutation: boolean;
  auditEventMutation: boolean;
  auditArtifactMutation: boolean;
  auditRowsCreated: boolean;
  llmCallLogMutation: boolean;
  promptRenderedForDispatch: true;
  promptStored: false;
  requestEnvelopeBuiltForPreview: true;
  requestEnvelopeStored: false;
  requestSentToProvider: boolean;
  providerNetworkCall: boolean;
  llmCall: boolean;
  llmCompletionCall: boolean;
  contentItemMutation: false;
  draftMarkdownMutation: false;
  draftHtmlMutation: false;
  bloggerWrite: false;
  bloggerDraftSave: false;
  bloggerPublish: false;
  scheduledPublish: false;
  oauthReconnect: false;
  tokenRefresh: false;
  externalSend: boolean;
}

export async function buildDailyContentDraftGenerationCandidateTextRedispatchResponse(
  rawRequest: DailyContentDraftGenerationCandidateTextRedispatchRequest
): Promise<DailyContentDraftGenerationCandidateTextRedispatchResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const [planLock, promptRender, requestEnvelope, promptQuality, route] = await Promise.all([
    buildDailyContentDraftGenerationLlmDispatchExecutionPlanLockResponse({
      mode: "preview",
      planId: request.planId,
      planItemId: request.planItemId,
      contentItemId: request.contentItemId
    }),
    buildDailyContentDraftGenerationPromptRenderPreviewResponse({
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
    prisma.llmTaskRoute.findUnique({
      where: { taskType: "content_draft" },
      include: {
        primaryProvider: {
          include: { secrets: true }
        },
        primaryModel: true
      }
    })
  ]);
  const planLockSummary = planLock.draftGenerationLlmDispatchExecutionPlanLockSummary;
  const idempotencyKeyHash = request.idempotencyKey ? sha256(request.idempotencyKey) : null;
  const confirmationPhraseHash = request.confirmationPhrase ? sha256(request.confirmationPhrase) : null;
  const existingAttempt =
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
  const existingCandidateArtifact = existingAttempt
    ? await prisma.blogDailyContentLlmDispatchArtifact.findFirst({
        where: {
          attemptId: existingAttempt.id,
          artifactKind: CANDIDATE_ARTIFACT_KIND
        },
        orderBy: { createdAt: "desc" }
      })
    : null;
  const gate = buildRedispatchGate({
    request,
    planLockSummary,
    routeReady: Boolean(route?.primaryProvider && route.primaryModel),
    existingAttemptReturned: Boolean(existingAttempt && existingCandidateArtifact)
  });
  let attemptId: string | null = existingAttempt?.id ?? null;
  let providerCall: DailyContentDraftProviderCallResult | null = null;
  let llmCallLogId: string | null = null;
  let responseEventId: string | null = null;
  let responseArtifactId: string | null = null;
  let candidateArtifactId: string | null = existingCandidateArtifact?.id ?? null;
  let errorCode: string | null = null;
  let errorMessage: string | null = null;
  let attemptUpdated = false;

  if (gate.canExecuteNow && route?.primaryProvider && route.primaryModel && request.planId && request.planItemId && request.contentItemId && idempotencyKeyHash && confirmationPhraseHash) {
    const startedAt = new Date();
    const requestEnvelopeSummary = requestEnvelope.draftGenerationLlmRequestEnvelopePreviewSummary.requestEnvelopePreviewSummary;
    const promptQualitySummary = promptQuality.draftGenerationPromptQualityChecklistPreviewSummary.promptQualityChecklistSummary;
    const createdAttempt = await prisma.blogDailyContentLlmDispatchAttempt.create({
      data: {
        planId: request.planId,
        planItemId: request.planItemId,
        contentItemId: request.contentItemId,
        operatorApprovalId: planLockSummary.persistedApprovalSummary.approvalId ?? "",
        idempotencyKeyHash,
        attemptPurpose: ATTEMPT_PURPOSE,
        attemptStatus: "candidate_text_redispatch_started",
        providerKey: requestEnvelopeSummary.providerKey,
        providerKind: requestEnvelopeSummary.providerKind,
        modelKey: requestEnvelopeSummary.modelKey,
        modelDisplayName: requestEnvelopeSummary.modelDisplayName,
        requestEnvelopeHash: sha256(stableStringify({ requestEnvelopeSummary, patchVersion: PATCH_VERSION })),
        promptSha256: requestEnvelopeSummary.promptSha256,
        promptVersion: promptQualitySummary.promptVersion,
        promptQualityChecklistVersion: promptQualitySummary.checklistVersion,
        dispatchGateVersion: DISPATCH_GATE_VERSION,
        healthCheckSummaryHash: sha256(stableStringify({ candidateTextRedispatch: true, providerNetworkCallAttempted: false })),
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
        startedAt,
        metadata: {
          patchVersion: PATCH_VERSION,
          attemptPurpose: ATTEMPT_PURPOSE,
          candidateTextArtifactExpected: true,
          rawPromptStored: false,
          rawResponseStored: false,
          contentMutationAttempted: false,
          bloggerWriteAttempted: false
        } as Prisma.InputJsonObject
      }
    });
    const createdAttemptId = createdAttempt.id;
    attemptId = createdAttemptId;

    try {
      providerCall = await callDailyContentDraftProviderOnce({
        provider: route.primaryProvider,
        modelName: route.primaryModel.name,
        fullPromptPreview: promptRender.draftGenerationPromptRenderPreviewSummary.promptRenderPreviewSummary.fullPromptPreview,
        temperature: route.temperature,
        maxTokens: route.maxTokens,
        timeoutSeconds: route.timeoutSeconds
      });
      const candidateMarkdown = normalizeCandidateMarkdown(providerCall.text);
      const candidateHash = sha256(candidateMarkdown);
      const metadata = buildSafeMetadata({ request, attemptId: createdAttemptId, candidateHash, candidateLength: candidateMarkdown.length, providerCall });
      const log = await createLlmCallLog({
        taskType: "content_draft",
        providerId: route.primaryProvider.id,
        modelId: route.primaryModel.id,
        contentItemId: request.contentItemId,
        status: "success",
        latencyMs: providerCall.latencyMs,
        inputTokens: providerCall.inputTokens,
        outputTokens: providerCall.outputTokens,
        estimatedCost: null,
        errorMessage: null,
        metadata: metadata as unknown as Prisma.InputJsonObject
      });
      llmCallLogId = log.id;

      const [event, responseArtifact, candidateArtifact] = await prisma.$transaction([
        prisma.blogDailyContentLlmDispatchEvent.create({
          data: {
            attemptId: createdAttemptId,
            eventType: RESPONSE_EVENT_TYPE,
            eventStatus: "candidate_text_artifact_created",
            eventMessage: "Provider response converted into controlled candidate Markdown artifact. Content item was not mutated.",
            eventPayloadRedactedJson: {
              patchVersion: PATCH_VERSION,
              candidateHash,
              candidateLength: candidateMarkdown.length,
              llmCallLogId,
              rawPromptStored: false,
              rawResponseStored: false,
              candidateMarkdownReturned: false,
              contentMutationAttempted: false,
              bloggerWriteAttempted: false
            } as Prisma.InputJsonObject,
            rawSecretStored: false,
            rawTokenStored: false
          }
        }),
        prisma.blogDailyContentLlmDispatchArtifact.create({
          data: {
            attemptId: createdAttemptId,
            artifactKind: RESPONSE_ARTIFACT_KIND,
            artifactHash: candidateHash,
            artifactStorageMode: "hash_only",
            artifactRedactionStatus: "redacted_or_hash_only",
            artifactPreview: stableStringify({
              patchVersion: PATCH_VERSION,
              candidateHashPrefix: candidateHash.slice(0, 16),
              candidateLength: candidateMarkdown.length,
              responseSummary: providerCall.responseSummary,
              rawResponseStored: false
            }),
            rawSecretStored: false,
            rawTokenStored: false
          }
        }),
        prisma.blogDailyContentLlmDispatchArtifact.create({
          data: {
            attemptId: createdAttemptId,
            artifactKind: CANDIDATE_ARTIFACT_KIND,
            artifactHash: candidateHash,
            artifactStorageMode: CANDIDATE_STORAGE_MODE,
            artifactRedactionStatus: CANDIDATE_REDACTION_STATUS,
            artifactPreview: candidateMarkdown,
            rawSecretStored: false,
            rawTokenStored: false
          }
        }),
        prisma.blogDailyContentLlmDispatchAttempt.update({
          where: { id: createdAttemptId },
          data: {
            attemptStatus: "candidate_text_artifact_created",
            providerNetworkCallAttempted: true,
            llmCallAttempted: true,
            llmCompletionReceived: true,
            responseBodyStored: false,
            responseBodyRedacted: true,
            rawSecretStored: false,
            rawTokenStored: false,
            contentMutationAttempted: false,
            draftMutationAttempted: false,
            bloggerWriteAttempted: false,
            errorCode: null,
            errorCategory: null,
            errorMessageRedacted: null,
            finishedAt: new Date(),
            metadata: metadata as unknown as Prisma.InputJsonObject
          }
        })
      ]);
      responseEventId = event.id;
      responseArtifactId = responseArtifact.id;
      candidateArtifactId = candidateArtifact.id;
      attemptUpdated = true;
    } catch (error) {
      const safeMessage = safeErrorMessage(error instanceof Error ? error.message : "provider_call_failed", 500);
      errorCode = safeMessage === "provider_timeout" ? "provider_timeout" : "provider_call_failed";
      errorMessage = safeMessage;
      const failedLog = await createLlmCallLog({
        taskType: "content_draft",
        providerId: route.primaryProvider.id,
        modelId: route.primaryModel.id,
        contentItemId: request.contentItemId,
        status: "failed",
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        estimatedCost: null,
        errorMessage: safeMessage,
        metadata: {
          purpose: "daily_content_draft_generation_candidate_text_redispatch",
          phase: "candidate_text_redispatch",
          patchVersion: PATCH_VERSION,
          attemptId: createdAttemptId,
          errorCode,
          rawPromptStored: false,
          rawResponseStored: false,
          rawSecretStored: false,
          rawTokenStored: false,
          contentMutationAttempted: false,
          bloggerWriteAttempted: false
        } as unknown as Prisma.InputJsonObject
      });
      llmCallLogId = failedLog.id;
      const failedEvent = await prisma.blogDailyContentLlmDispatchEvent.create({
        data: {
          attemptId: createdAttemptId,
          eventType: FAILED_EVENT_TYPE,
          eventStatus: "provider_call_failed_redacted",
          eventMessage: safeMessage,
          eventPayloadRedactedJson: {
            patchVersion: PATCH_VERSION,
            errorCode,
            llmCallLogId,
            rawResponseStored: false,
            rawSecretStored: false,
            rawTokenStored: false
          } as Prisma.InputJsonObject,
          rawSecretStored: false,
          rawTokenStored: false
        }
      });
      responseEventId = failedEvent.id;
      await prisma.blogDailyContentLlmDispatchAttempt.update({
        where: { id: createdAttemptId },
        data: {
          attemptStatus: "candidate_text_provider_call_failed",
          providerNetworkCallAttempted: true,
          llmCallAttempted: true,
          llmCompletionReceived: false,
          errorCode,
          errorCategory: "provider_call_failed",
          errorMessageRedacted: safeMessage,
          finishedAt: new Date()
        }
      });
      attemptUpdated = true;
    }
  }

  const candidateMarkdownHash = providerCall ? sha256(normalizeCandidateMarkdown(providerCall.text)) : existingCandidateArtifact?.artifactHash ?? null;
  const candidateMarkdownLength = providerCall ? normalizeCandidateMarkdown(providerCall.text).length : existingCandidateArtifact?.artifactPreview?.length ?? null;
  const redispatchExecutedNow = Boolean(providerCall);
  const existingRedispatchReturned = Boolean(existingAttempt && existingCandidateArtifact && request.mode === "execute");
  const dbMutated = Boolean(redispatchExecutedNow || llmCallLogId || responseEventId || responseArtifactId || (attemptUpdated && !existingRedispatchReturned));
  const responseBlockers = existingRedispatchReturned ? [] : gate.blockers;
  const summary: DailyContentDraftGenerationCandidateTextRedispatchSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    redispatchImplemented: true,
    redispatchAllowed: gate.canExecuteNow || existingRedispatchReturned,
    redispatchExecutedNow,
    existingRedispatchReturned,
    targetSummary: planLockSummary.targetSummary,
    persistedApprovalSummary: planLockSummary.persistedApprovalSummary,
    executionGateSummary: planLockSummary.executionGateSummary,
    candidateTextRedispatchSummary: {
      featureFlagName: FEATURE_FLAG_NAME,
      featureFlagEnabled: gate.featureFlagEnabled,
      confirmationPhraseRequired: true,
      confirmationPhraseMatched: gate.confirmationPhraseMatched,
      idempotencyKeyRequired: true,
      idempotencyKeyPresent: gate.idempotencyKeyPresent,
      rawIdempotencyKeyStored: false,
      rawConfirmationPhraseStored: false,
      canExecuteNow: gate.canExecuteNow,
      redispatchBlockers: responseBlockers,
      attemptId,
      attemptPurpose: ATTEMPT_PURPOSE,
      llmCallLogId,
      responseEventId,
      responseArtifactId,
      candidateArtifactId,
      candidateArtifactKind: CANDIDATE_ARTIFACT_KIND,
      candidateArtifactStorageMode: CANDIDATE_STORAGE_MODE,
      candidateArtifactRedactionStatus: CANDIDATE_REDACTION_STATUS,
      candidateMarkdownHash,
      candidateMarkdownLength,
      candidateMarkdownStoredAsControlledArtifact: Boolean(candidateArtifactId),
      candidateMarkdownReturned: false,
      candidatePreviewReturned: false,
      rawPromptStoredOrReturned: false,
      rawResponseStoredOrReturned: false,
      secretOrTokenStoredOrReturned: false,
      responseSummary: providerCall?.responseSummary ?? null,
      latencyMs: providerCall?.latencyMs ?? null,
      inputTokens: providerCall?.inputTokens ?? null,
      outputTokens: providerCall?.outputTokens ?? null,
      errorCode,
      errorMessage
    },
    currentSideEffectSummary: buildSideEffectSummary({
      dbMutated,
      providerCalled: Boolean(redispatchExecutedNow || errorCode),
      llmCallLogCreated: Boolean(llmCallLogId),
      auditEventCreated: Boolean(responseEventId),
      auditArtifactCreated: Boolean(responseArtifactId || (candidateArtifactId && !existingRedispatchReturned)),
      attemptUpdated: Boolean(attemptUpdated || (attemptId && !existingRedispatchReturned))
    }),
    blockingReasons: responseBlockers,
    warnings: buildWarnings(request.mode, redispatchExecutedNow, existingRedispatchReturned, Boolean(errorCode))
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationCandidateTextRedispatchSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationCandidateTextRedispatchRequest): {
  mode: RedispatchMode;
  requestedMode: string;
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
  confirmationPhrase: string | null;
  idempotencyKey: string | null;
} {
  const requestedMode = getString(rawRequest.mode) ?? "preview";
  return {
    mode: requestedMode === "preview" || requestedMode === "execute" ? requestedMode : "blocked_non_supported_mode",
    requestedMode,
    planId: getString(rawRequest.planId),
    planItemId: getString(rawRequest.planItemId),
    contentItemId: getString(rawRequest.contentItemId),
    confirmationPhrase: getString(rawRequest.confirmationPhrase),
    idempotencyKey: getString(rawRequest.idempotencyKey)
  };
}

function buildRedispatchGate(input: {
  request: ReturnType<typeof normalizeRequest>;
  planLockSummary: PlanLockSummary;
  routeReady: boolean;
  existingAttemptReturned: boolean;
}) {
  const featureFlagEnabled = process.env[FEATURE_FLAG_NAME] === "true";
  const confirmationPhraseMatched = input.request.confirmationPhrase === REQUIRED_CONFIRMATION_PHRASE;
  const idempotencyKeyPresent = Boolean(input.request.idempotencyKey);
  const blockers = new Set<string>();
  const target = input.planLockSummary.targetSummary;

  if (input.existingAttemptReturned && input.request.mode === "execute") {
    return {
      featureFlagEnabled,
      confirmationPhraseMatched,
      idempotencyKeyPresent,
      blockers: [],
      canExecuteNow: false
    };
  }
  if (input.request.mode === "blocked_non_supported_mode") {
    blockers.add("draft_generation_candidate_text_redispatch_mode_not_allowed");
  }
  if (input.request.mode === "preview") {
    blockers.add("draft_generation_candidate_text_redispatch_not_requested");
  }
  if (!featureFlagEnabled) {
    blockers.add("candidate_text_redispatch_feature_flag_disabled");
  }
  if (!confirmationPhraseMatched) {
    blockers.add("confirmation_phrase_missing_or_mismatch");
  }
  if (!idempotencyKeyPresent) {
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
  if (!input.planLockSummary.persistedApprovalSummary.operatorApprovalSatisfied || !input.planLockSummary.persistedApprovalSummary.approvalId) {
    blockers.add("operator_approval_missing");
  }
  if (!input.routeReady) {
    blockers.add("llm_route_not_ready");
  }

  return {
    featureFlagEnabled,
    confirmationPhraseMatched,
    idempotencyKeyPresent,
    blockers: Array.from(blockers),
    canExecuteNow: input.request.mode === "execute" && blockers.size === 0
  };
}

function buildSafeMetadata(input: {
  request: ReturnType<typeof normalizeRequest>;
  attemptId: string;
  candidateHash: string;
  candidateLength: number;
  providerCall: DailyContentDraftProviderCallResult;
}) {
  return {
    purpose: "daily_content_draft_generation_candidate_text_redispatch",
    phase: "candidate_text_redispatch",
    patchVersion: PATCH_VERSION,
    attemptId: input.attemptId,
    planId: input.request.planId,
    planItemId: input.request.planItemId,
    candidateHash: input.candidateHash,
    candidateLength: input.candidateLength,
    responseSummary: input.providerCall.responseSummary,
    candidateTextArtifactKind: CANDIDATE_ARTIFACT_KIND,
    candidateTextArtifactStorageMode: CANDIDATE_STORAGE_MODE,
    candidateMarkdownReturned: false,
    rawPromptStored: false,
    rawResponseStored: false,
    rawSecretStored: false,
    rawTokenStored: false,
    contentMutationAttempted: false,
    bloggerWriteAttempted: false
  };
}

function buildSideEffectSummary(input: {
  dbMutated: boolean;
  providerCalled: boolean;
  llmCallLogCreated: boolean;
  auditEventCreated: boolean;
  auditArtifactCreated: boolean;
  attemptUpdated: boolean;
}): CandidateTextRedispatchSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: input.dbMutated,
    auditAttemptMutation: input.attemptUpdated,
    auditEventMutation: input.auditEventCreated,
    auditArtifactMutation: input.auditArtifactCreated,
    auditRowsCreated: input.auditEventCreated || input.auditArtifactCreated || input.attemptUpdated,
    llmCallLogMutation: input.llmCallLogCreated,
    promptRenderedForDispatch: true,
    promptStored: false,
    requestEnvelopeBuiltForPreview: true,
    requestEnvelopeStored: false,
    requestSentToProvider: input.providerCalled,
    providerNetworkCall: input.providerCalled,
    llmCall: input.providerCalled,
    llmCompletionCall: input.providerCalled,
    contentItemMutation: false,
    draftMarkdownMutation: false,
    draftHtmlMutation: false,
    bloggerWrite: false,
    bloggerDraftSave: false,
    bloggerPublish: false,
    scheduledPublish: false,
    oauthReconnect: false,
    tokenRefresh: false,
    externalSend: input.providerCalled
  };
}

function buildWarnings(mode: RedispatchMode, executed: boolean, existingReturned: boolean, failed: boolean) {
  const warnings = new Set<string>([
    "candidate_text_redispatch_does_not_mutate_content_items",
    "blogger_write_disabled_by_patch_policy",
    "candidate_markdown_body_stored_as_controlled_artifact_not_returned"
  ]);
  if (mode === "preview") {
    warnings.add("candidate_text_redispatch_preview_only");
  }
  if (executed) {
    warnings.add("provider_llm_call_executed_once");
  }
  if (existingReturned) {
    warnings.add("duplicate_idempotency_key_returned_existing_candidate_artifact");
  }
  if (failed) {
    warnings.add("provider_llm_call_failed_with_safe_error");
  }
  return Array.from(warnings);
}

function normalizeCandidateMarkdown(value: string) {
  return value.replace(/\u0000/g, "").trim();
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
