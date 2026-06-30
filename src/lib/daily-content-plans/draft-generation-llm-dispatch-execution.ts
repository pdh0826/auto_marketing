import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { createLlmCallLog } from "@/lib/db/llm-call-logs";
import {
  buildDailyContentDraftGenerationLlmDispatchExecutionPlanLockResponse,
  type DailyContentDraftGenerationLlmDispatchExecutionPlanLockResponse
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-execution-plan-lock";
import {
  buildDailyContentDraftGenerationPromptRenderPreviewResponse,
  type DailyContentDraftGenerationPromptRenderPreviewResponse
} from "@/lib/daily-content-plans/draft-generation-prompt-render-preview";
import { decryptSecret } from "@/lib/llm/secrets";
import { getOpenAiCompletionTokenParameter } from "@/lib/llm/provider-test";
import { safeErrorMessage } from "@/lib/llm/redaction";

const PATCH_VERSION = "9F-3I";
const EXECUTION_MODE = "gated_draft_generation_llm_dispatch_without_content_mutation";
const FEATURE_FLAG_NAME = "BLOG_DAILY_CONTENT_DRAFT_GENERATION_LLM_ENABLED";
const REQUIRED_CONFIRMATION_PHRASE = "I_UNDERSTAND_THIS_CALLS_ONE_LLM_PROVIDER_WITHOUT_CONTENT_MUTATION";
const RESPONSE_ARTIFACT_KIND = "llm_response_metadata_hash";
const RESPONSE_EVENT_TYPE = "llm_dispatch_provider_response_received";
const FAILED_EVENT_TYPE = "llm_dispatch_provider_call_failed";

type DispatchExecutionMode = "preview" | "execute" | "blocked_non_supported_mode";
type PlanLockSummary =
  DailyContentDraftGenerationLlmDispatchExecutionPlanLockResponse["draftGenerationLlmDispatchExecutionPlanLockSummary"];
type PromptRenderSummary =
  DailyContentDraftGenerationPromptRenderPreviewResponse["draftGenerationPromptRenderPreviewSummary"];

interface ProviderCallResult {
  text: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  responseSummary: string;
}

class ProviderCallError extends Error {
  responseSummary: string;
  latencyMs: number;

  constructor(message: string, responseSummary: string, latencyMs: number) {
    super(message);
    this.responseSummary = responseSummary;
    this.latencyMs = latencyMs;
  }
}

export interface DailyContentDraftGenerationLlmDispatchExecutionRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
  expectedLockHash?: unknown;
  confirmationPhrase?: unknown;
  idempotencyKey?: unknown;
}

export interface DailyContentDraftGenerationLlmDispatchExecutionResponse
  extends DailyContentDraftGenerationLlmDispatchExecutionSummary {
  checkedAt: string;
  draftGenerationLlmDispatchExecutionSummary: DailyContentDraftGenerationLlmDispatchExecutionSummary;
}

export interface DailyContentDraftGenerationLlmDispatchExecutionSummary {
  patchVersion: "9F-3I";
  checked: true;
  mode: DispatchExecutionMode;
  requestedMode: string;
  executionMode: typeof EXECUTION_MODE;
  dispatchExecutionImplemented: true;
  dispatchExecutionAllowed: boolean;
  dispatchExecutedNow: boolean;
  targetSummary: PlanLockSummary["targetSummary"];
  persistedApprovalSummary: PlanLockSummary["persistedApprovalSummary"];
  executionGateSummary: PlanLockSummary["executionGateSummary"];
  dispatchExecutionSummary: DispatchExecutionSummary;
  currentSideEffectSummary: DailyContentDraftGenerationLlmDispatchExecutionSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface DispatchExecutionSummary {
  featureFlagName: typeof FEATURE_FLAG_NAME;
  featureFlagEnabled: boolean;
  confirmationPhraseRequired: true;
  confirmationPhraseMatched: boolean;
  idempotencyKeyRequired: true;
  idempotencyKeyPresent: boolean;
  rawIdempotencyKeyStored: false;
  rawConfirmationPhraseStored: false;
  expectedLockHashMatched: boolean;
  currentLockHash: string | null;
  planLockCandidateReady: boolean;
  finalPreflightReadyForPlanLock: boolean;
  latestAttemptId: string | null;
  priorLlmCallDetected: boolean;
  canExecuteNow: boolean;
  executionBlockers: string[];
  providerRequestSent: boolean;
  providerResponseReceived: boolean;
  llmCallLogCreated: boolean;
  llmCallLogId: string | null;
  responseArtifactCreated: boolean;
  responseArtifactId: string | null;
  responseEventCreated: boolean;
  responseEventId: string | null;
  attemptUpdated: boolean;
  responseHash: string | null;
  responseLength: number | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  responseSummary: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface DailyContentDraftGenerationLlmDispatchExecutionSideEffectSummary {
  dbRead: true;
  dbWrite: boolean;
  auditAttemptMutation: boolean;
  auditEventMutation: boolean;
  auditArtifactMutation: boolean;
  auditRowsCreated: boolean;
  llmCallLogMutation: boolean;
  promptRenderedForDispatch: boolean;
  promptStored: false;
  requestEnvelopeBuiltForPreview: true;
  requestEnvelopeStored: false;
  requestSentToProvider: boolean;
  providerHealthChecked: false;
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
  publishApprovalMutation: false;
  publishAttemptMutation: false;
  externalSend: boolean;
}

export async function buildDailyContentDraftGenerationLlmDispatchExecutionResponse(
  rawRequest: DailyContentDraftGenerationLlmDispatchExecutionRequest
): Promise<DailyContentDraftGenerationLlmDispatchExecutionResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const [planLock, promptRender, route] = await Promise.all([
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
  const latestAttemptId = planLockSummary.executionPlanLockSummary.latestAttemptId;
  const latestAttempt = latestAttemptId
    ? await prisma.blogDailyContentLlmDispatchAttempt.findUnique({
        where: { id: latestAttemptId },
        select: {
          id: true,
          llmCallAttempted: true,
          providerNetworkCallAttempted: true,
          contentMutationAttempted: true,
          bloggerWriteAttempted: true
        }
      })
    : null;
  const gate = buildExecutionGate({ request, planLockSummary, latestAttempt, routeReady: Boolean(route?.primaryProvider && route.primaryModel) });
  let providerCall: ProviderCallResult | null = null;
  let llmCallLogId: string | null = null;
  let responseArtifactId: string | null = null;
  let responseEventId: string | null = null;
  let failedEventId: string | null = null;
  let attemptUpdated = false;
  let errorCode: string | null = null;
  let errorMessage: string | null = null;

  if (gate.canExecuteNow && route?.primaryProvider && route.primaryModel && latestAttempt) {
    const startedAt = new Date();
    try {
      providerCall = await callProviderOnce({
        provider: route.primaryProvider,
        modelName: route.primaryModel.name,
        promptRender: promptRender.draftGenerationPromptRenderPreviewSummary,
        temperature: route.temperature,
        maxTokens: route.maxTokens,
        timeoutSeconds: route.timeoutSeconds
      });
      const responseHash = sha256(providerCall.text);
      const metadata = buildSafeLlmCallMetadata({
        request,
        planLockSummary,
        responseHash,
        responseLength: providerCall.text.length,
        responseSummary: providerCall.responseSummary
      });
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

      const [event, artifact] = await prisma.$transaction([
        prisma.blogDailyContentLlmDispatchEvent.create({
          data: {
            attemptId: latestAttempt.id,
            eventType: RESPONSE_EVENT_TYPE,
            eventStatus: "provider_response_received_redacted",
            eventMessage: "Provider response received. Raw response was not stored.",
            eventPayloadRedactedJson: {
              patchVersion: PATCH_VERSION,
              lockHash: request.expectedLockHash,
              responseHash,
              responseLength: providerCall.text.length,
              llmCallLogId,
              rawResponseStored: false,
              rawSecretStored: false,
              rawTokenStored: false
            },
            rawSecretStored: false,
            rawTokenStored: false
          }
        }),
        prisma.blogDailyContentLlmDispatchArtifact.create({
          data: {
            attemptId: latestAttempt.id,
            artifactKind: RESPONSE_ARTIFACT_KIND,
            artifactHash: responseHash,
            artifactStorageMode: "hash_only",
            artifactRedactionStatus: "redacted_or_hash_only",
            artifactPreview: stableStringify({
              patchVersion: PATCH_VERSION,
              responseHashPrefix: responseHash.slice(0, 16),
              responseLength: providerCall.text.length,
              responseSummary: providerCall.responseSummary,
              rawResponseStored: false
            }),
            rawSecretStored: false,
            rawTokenStored: false
          }
        }),
        prisma.blogDailyContentLlmDispatchAttempt.update({
          where: { id: latestAttempt.id },
          data: {
            attemptStatus: "provider_response_received",
            providerNetworkCallAttempted: true,
            llmCallAttempted: true,
            llmCompletionReceived: true,
            responseBodyStored: false,
            responseBodyRedacted: true,
            rawSecretStored: false,
            rawTokenStored: false,
            errorCode: null,
            errorCategory: null,
            errorMessageRedacted: null,
            startedAt,
            finishedAt: new Date(),
            metadata: metadata as unknown as Prisma.InputJsonObject
          }
        })
      ]);
      responseEventId = event.id;
      responseArtifactId = artifact.id;
      attemptUpdated = true;
    } catch (error) {
      const safeMessage = safeErrorMessage(error instanceof Error ? error.message : "provider_call_failed", 500);
      const providerError = error instanceof ProviderCallError ? error : null;
      errorCode = providerError?.responseSummary ?? "provider_call_failed";
      errorMessage = safeMessage;
      const failedLog = await createLlmCallLog({
        taskType: "content_draft",
        providerId: route.primaryProvider.id,
        modelId: route.primaryModel.id,
        contentItemId: request.contentItemId,
        status: "failed",
        latencyMs: providerError?.latencyMs ?? null,
        inputTokens: null,
        outputTokens: null,
        estimatedCost: null,
        errorMessage: safeMessage,
        metadata: {
          purpose: "daily_content_draft_generation_llm_dispatch",
          phase: "dispatch_execution",
          patchVersion: PATCH_VERSION,
          lockHash: request.expectedLockHash,
          errorCode,
          rawPromptStored: false,
          rawResponseStored: false,
          rawSecretStored: false,
          rawTokenStored: false
        } as unknown as Prisma.InputJsonObject
      });
      llmCallLogId = failedLog.id;
      const failedEvent = await prisma.blogDailyContentLlmDispatchEvent.create({
        data: {
          attemptId: latestAttempt.id,
          eventType: FAILED_EVENT_TYPE,
          eventStatus: "provider_call_failed_redacted",
          eventMessage: safeMessage,
          eventPayloadRedactedJson: {
            patchVersion: PATCH_VERSION,
            lockHash: request.expectedLockHash,
            errorCode,
            llmCallLogId,
            rawResponseStored: false,
            rawSecretStored: false,
            rawTokenStored: false
          },
          rawSecretStored: false,
          rawTokenStored: false
        }
      });
      failedEventId = failedEvent.id;
      await prisma.blogDailyContentLlmDispatchAttempt.update({
        where: { id: latestAttempt.id },
        data: {
          attemptStatus: "provider_call_failed",
          providerNetworkCallAttempted: true,
          llmCallAttempted: true,
          llmCompletionReceived: false,
          errorCode,
          errorCategory: "provider_call_failed",
          errorMessageRedacted: safeMessage,
          startedAt,
          finishedAt: new Date()
        }
      });
      attemptUpdated = true;
    }
  }

  const responseHash = providerCall ? sha256(providerCall.text) : null;
  const dispatchExecutedNow = Boolean(providerCall);
  const dbMutated = Boolean(llmCallLogId || responseArtifactId || responseEventId || failedEventId || attemptUpdated);
  const summary: DailyContentDraftGenerationLlmDispatchExecutionSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    executionMode: EXECUTION_MODE,
    dispatchExecutionImplemented: true,
    dispatchExecutionAllowed: gate.canExecuteNow,
    dispatchExecutedNow,
    targetSummary: planLockSummary.targetSummary,
    persistedApprovalSummary: planLockSummary.persistedApprovalSummary,
    executionGateSummary: planLockSummary.executionGateSummary,
    dispatchExecutionSummary: {
      featureFlagName: FEATURE_FLAG_NAME,
      featureFlagEnabled: gate.featureFlagEnabled,
      confirmationPhraseRequired: true,
      confirmationPhraseMatched: gate.confirmationPhraseMatched,
      idempotencyKeyRequired: true,
      idempotencyKeyPresent: gate.idempotencyKeyPresent,
      rawIdempotencyKeyStored: false,
      rawConfirmationPhraseStored: false,
      expectedLockHashMatched: gate.expectedLockHashMatched,
      currentLockHash: planLockSummary.executionPlanLockSummary.lockHash,
      planLockCandidateReady: planLockSummary.executionPlanLockSummary.planLockCandidateReady,
      finalPreflightReadyForPlanLock: planLockSummary.executionPlanLockSummary.finalPreflightReadyForPlanLock,
      latestAttemptId,
      priorLlmCallDetected: Boolean(latestAttempt?.llmCallAttempted || latestAttempt?.providerNetworkCallAttempted),
      canExecuteNow: gate.canExecuteNow,
      executionBlockers: gate.blockers,
      providerRequestSent: Boolean(providerCall || errorCode),
      providerResponseReceived: Boolean(providerCall),
      llmCallLogCreated: Boolean(llmCallLogId),
      llmCallLogId,
      responseArtifactCreated: Boolean(responseArtifactId),
      responseArtifactId,
      responseEventCreated: Boolean(responseEventId || failedEventId),
      responseEventId: responseEventId ?? failedEventId,
      attemptUpdated,
      responseHash,
      responseLength: providerCall?.text.length ?? null,
      latencyMs: providerCall?.latencyMs ?? null,
      inputTokens: providerCall?.inputTokens ?? null,
      outputTokens: providerCall?.outputTokens ?? null,
      responseSummary: providerCall?.responseSummary ?? null,
      errorCode,
      errorMessage
    },
    currentSideEffectSummary: buildSideEffectSummary({
      dbMutated,
      providerCalled: Boolean(providerCall || errorCode),
      llmCallLogCreated: Boolean(llmCallLogId),
      auditEventCreated: Boolean(responseEventId || failedEventId),
      auditArtifactCreated: Boolean(responseArtifactId),
      attemptUpdated
    }),
    blockingReasons: gate.blockers,
    warnings: buildWarnings(request.mode, dispatchExecutedNow, Boolean(errorCode))
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationLlmDispatchExecutionSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmDispatchExecutionRequest): {
  mode: DispatchExecutionMode;
  requestedMode: string;
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
  expectedLockHash: string | null;
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
    expectedLockHash: getString(rawRequest.expectedLockHash),
    confirmationPhrase: getString(rawRequest.confirmationPhrase),
    idempotencyKey: getString(rawRequest.idempotencyKey)
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildExecutionGate(input: {
  request: ReturnType<typeof normalizeRequest>;
  planLockSummary: PlanLockSummary;
  latestAttempt: {
    llmCallAttempted: boolean;
    providerNetworkCallAttempted: boolean;
    contentMutationAttempted: boolean;
    bloggerWriteAttempted: boolean;
  } | null;
  routeReady: boolean;
}) {
  const featureFlagEnabled = process.env[FEATURE_FLAG_NAME] === "true";
  const confirmationPhraseMatched = input.request.confirmationPhrase === REQUIRED_CONFIRMATION_PHRASE;
  const idempotencyKeyPresent = Boolean(input.request.idempotencyKey);
  const expectedLockHashMatched =
    Boolean(input.request.expectedLockHash) && input.request.expectedLockHash === input.planLockSummary.executionPlanLockSummary.lockHash;
  const blockers = new Set<string>();

  if (input.request.mode === "blocked_non_supported_mode") {
    blockers.add("draft_generation_llm_dispatch_execution_mode_not_allowed");
  }
  if (input.request.mode === "preview") {
    blockers.add("draft_generation_llm_dispatch_execution_not_requested");
  }
  if (!featureFlagEnabled) {
    blockers.add("draft_generation_llm_dispatch_feature_flag_disabled");
  }
  if (!confirmationPhraseMatched) {
    blockers.add("confirmation_phrase_missing_or_mismatch");
  }
  if (!idempotencyKeyPresent) {
    blockers.add("idempotency_key_missing");
  }
  if (!input.planLockSummary.executionPlanLockSummary.planLockCandidateReady) {
    blockers.add("execution_plan_lock_candidate_not_ready");
  }
  if (!expectedLockHashMatched) {
    blockers.add("expected_lock_hash_missing_or_mismatch");
  }
  if (!input.latestAttempt) {
    blockers.add("dispatch_attempt_not_found");
  }
  if (input.latestAttempt?.llmCallAttempted || input.latestAttempt?.providerNetworkCallAttempted) {
    blockers.add("dispatch_attempt_already_sent_to_provider");
  }
  if (input.latestAttempt?.contentMutationAttempted) {
    blockers.add("content_mutation_already_attempted");
  }
  if (input.latestAttempt?.bloggerWriteAttempted) {
    blockers.add("blogger_write_already_attempted");
  }
  if (!input.routeReady) {
    blockers.add("llm_route_not_ready");
  }

  return {
    featureFlagEnabled,
    confirmationPhraseMatched,
    idempotencyKeyPresent,
    expectedLockHashMatched,
    blockers: Array.from(blockers),
    canExecuteNow: input.request.mode === "execute" && blockers.size === 0
  };
}

async function callProviderOnce(input: {
  provider: ProviderWithSecrets;
  modelName: string;
  promptRender: PromptRenderSummary;
  temperature: number | null;
  maxTokens: number | null;
  timeoutSeconds: number | null;
}): Promise<ProviderCallResult> {
  const prompt = {
    system: "You are a careful Korean blog draft writer. Return only the requested Markdown draft.",
    user: input.promptRender.promptRenderPreviewSummary.fullPromptPreview
  };
  if (input.provider.apiFormat === "openai_compatible") {
    return callOpenAiCompatible(input.provider, input.modelName, prompt, input.temperature, input.maxTokens, input.timeoutSeconds ?? input.provider.timeoutSeconds);
  }
  if (input.provider.apiFormat === "ollama_compatible") {
    return callOllamaCompatible(input.provider, input.modelName, prompt, input.temperature, input.maxTokens, input.timeoutSeconds ?? input.provider.timeoutSeconds);
  }
  throw new ProviderCallError("unsupported_provider_api_format", "unsupported_provider_api_format", 0);
}

async function callOpenAiCompatible(
  provider: ProviderWithSecrets,
  model: string,
  prompt: { system: string; user: string },
  temperature: number | null,
  maxTokens: number | null,
  timeoutSeconds: number
): Promise<ProviderCallResult> {
  const startedAt = Date.now();
  const baseUrl = requireBaseUrl(provider.baseUrl);
  const apiKey = getProviderApiKey(provider);
  const tokenParameter = getOpenAiCompletionTokenParameter(model);
  const response = await fetchWithTimeout(
    joinUrl(baseUrl, provider.endpointPath || "/v1/chat/completions"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user }
        ],
        temperature: temperature ?? 0.3,
        [tokenParameter]: maxTokens ?? 2500
      })
    },
    timeoutSeconds
  );
  const body = await readJsonOrText(response);
  const latencyMs = Date.now() - startedAt;

  if (!response.ok) {
    throw new ProviderCallError(safeHttpFailureMessage("OpenAI-compatible", response.status), summarizeHttpFailure("openai_compatible", response.status), latencyMs);
  }

  return {
    text: extractOpenAiText(body),
    latencyMs,
    inputTokens: extractUsageToken(body, "prompt_tokens"),
    outputTokens: extractUsageToken(body, "completion_tokens"),
    responseSummary: "openai_chat_completion_received"
  };
}

async function callOllamaCompatible(
  provider: ProviderWithSecrets,
  model: string,
  prompt: { system: string; user: string },
  temperature: number | null,
  maxTokens: number | null,
  timeoutSeconds: number
): Promise<ProviderCallResult> {
  const startedAt = Date.now();
  const baseUrl = requireBaseUrl(provider.baseUrl);
  const response = await fetchWithTimeout(
    joinUrl(baseUrl, provider.endpointPath || "/api/generate"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: `${prompt.system}\n\n${prompt.user}`,
        stream: false,
        options: {
          temperature: temperature ?? 0.3,
          num_predict: maxTokens ?? 2500
        }
      })
    },
    timeoutSeconds
  );
  const body = await readJsonOrText(response);
  const latencyMs = Date.now() - startedAt;

  if (!response.ok) {
    throw new ProviderCallError(safeHttpFailureMessage("Ollama-compatible", response.status), summarizeHttpFailure("ollama_compatible", response.status), latencyMs);
  }

  return {
    text: extractOllamaText(body),
    latencyMs,
    inputTokens: null,
    outputTokens: null,
    responseSummary: "ollama_generate_received"
  };
}

function buildSafeLlmCallMetadata(input: {
  request: ReturnType<typeof normalizeRequest>;
  planLockSummary: PlanLockSummary;
  responseHash: string;
  responseLength: number;
  responseSummary: string;
}) {
  return {
    purpose: "daily_content_draft_generation_llm_dispatch",
    phase: "dispatch_execution",
    patchVersion: PATCH_VERSION,
    attemptId: input.planLockSummary.executionPlanLockSummary.latestAttemptId,
    planId: input.request.planId,
    planItemId: input.request.planItemId,
    lockHash: input.request.expectedLockHash,
    responseHash: input.responseHash,
    responseLength: input.responseLength,
    responseSummary: input.responseSummary,
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
}): DailyContentDraftGenerationLlmDispatchExecutionSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: input.dbMutated,
    auditAttemptMutation: input.attemptUpdated,
    auditEventMutation: input.auditEventCreated,
    auditArtifactMutation: input.auditArtifactCreated,
    auditRowsCreated: input.auditEventCreated || input.auditArtifactCreated,
    llmCallLogMutation: input.llmCallLogCreated,
    promptRenderedForDispatch: true,
    promptStored: false,
    requestEnvelopeBuiltForPreview: true,
    requestEnvelopeStored: false,
    requestSentToProvider: input.providerCalled,
    providerHealthChecked: false,
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
    publishApprovalMutation: false,
    publishAttemptMutation: false,
    externalSend: input.providerCalled
  };
}

function buildWarnings(mode: DispatchExecutionMode, executed: boolean, failed: boolean) {
  const warnings = new Set<string>([
    "draft_generation_llm_dispatch_does_not_mutate_content_items",
    "blogger_write_disabled_by_patch_policy",
    "raw_prompt_and_response_not_stored"
  ]);
  if (mode === "preview") {
    warnings.add("dispatch_execution_preview_only");
  }
  if (executed) {
    warnings.add("provider_llm_call_executed_once");
  }
  if (failed) {
    warnings.add("provider_llm_call_failed_with_safe_error");
  }
  return Array.from(warnings);
}

function getProviderApiKey(provider: ProviderWithSecrets) {
  const apiKeySecret = provider.secrets.find((secret) => secret.secretKind === "api_key");
  if (!apiKeySecret) {
    throw new ProviderCallError("missing_api_key_secret", "missing_api_key_secret", 0);
  }
  return decryptSecret(apiKeySecret.encryptedValue);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutSeconds: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderCallError("provider_timeout", "provider_timeout", timeoutSeconds * 1000);
    }
    throw new ProviderCallError("provider_network_error", "provider_network_error", 0);
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonOrText(response: Response) {
  const rawText = await response.text();
  if (!rawText) {
    return null;
  }
  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return rawText;
  }
}

function extractOpenAiText(body: unknown) {
  const choices = body && typeof body === "object" && "choices" in body ? (body as { choices?: Array<{ message?: { content?: unknown }; text?: unknown }> }).choices : null;
  const content = choices?.[0]?.message?.content ?? choices?.[0]?.text;
  if (typeof content !== "string" || !content.trim()) {
    throw new ProviderCallError("openai_response_content_missing", "response_content_missing", 0);
  }
  return content;
}

function extractOllamaText(body: unknown) {
  const response = body && typeof body === "object" && "response" in body ? (body as { response?: unknown }).response : null;
  if (typeof response !== "string" || !response.trim()) {
    throw new ProviderCallError("ollama_response_text_missing", "response_content_missing", 0);
  }
  return response;
}

function extractUsageToken(body: unknown, key: "prompt_tokens" | "completion_tokens") {
  const usage = body && typeof body === "object" && "usage" in body ? (body as { usage?: Record<string, unknown> }).usage : null;
  const value = usage?.[key];
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null;
}

function requireBaseUrl(value: string | null) {
  if (!value) {
    throw new ProviderCallError("missing_provider_base_url", "missing_provider_base_url", 0);
  }
  return value;
}

function joinUrl(baseUrl: string, endpointPath: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`;
  return `${normalizedBase}${normalizedPath}`;
}

function safeHttpFailureMessage(label: string, status: number) {
  if (status === 401 || status === 403) {
    return `${label} dispatch failed with HTTP ${status}. Authentication failed.`;
  }
  if (status === 400) {
    return `${label} dispatch failed with HTTP ${status}. Check provider parameters.`;
  }
  if (status === 404) {
    return `${label} dispatch failed with HTTP ${status}. Endpoint or model was not found.`;
  }
  return `${label} dispatch failed with HTTP ${status}.`;
}

function summarizeHttpFailure(apiFormat: string, status: number) {
  if (status === 401 || status === 403) {
    return "authentication_failed";
  }
  if (status === 400) {
    return "parameter_error";
  }
  if (status === 404) {
    return apiFormat === "ollama_compatible" ? "not_found_or_model_unavailable" : "not_found";
  }
  if (status >= 500) {
    return "provider_server_error";
  }
  return "provider_http_error";
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

type ProviderWithSecrets = NonNullable<Awaited<ReturnType<typeof prisma.llmProvider.findUnique>>> & {
  secrets: Array<{ secretKind: string; encryptedValue: string }>;
};
