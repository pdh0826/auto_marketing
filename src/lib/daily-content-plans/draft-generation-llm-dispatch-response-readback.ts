import { prisma } from "@/lib/db/client";
import {
  buildDailyContentDraftGenerationLlmDispatchAttemptReadbackResponse,
  type DailyContentDraftGenerationLlmDispatchAttemptReadbackResponse
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-attempt-readback";

const PATCH_VERSION = "9F-3J";
const PREVIEW_MODE = "read_only_draft_generation_llm_dispatch_response_readback";
const READBACK_VERSION = "daily_content_draft_generation_llm_dispatch_response_readback_v0";
const RESPONSE_EVENT_TYPE = "llm_dispatch_provider_response_received";
const RESPONSE_ARTIFACT_KIND = "llm_response_metadata_hash";

type ResponseReadbackMode = "preview" | "blocked_non_preview";
type AttemptReadbackSummary =
  DailyContentDraftGenerationLlmDispatchAttemptReadbackResponse["draftGenerationLlmDispatchAttemptReadbackSummary"];

export interface DailyContentDraftGenerationLlmDispatchResponseReadbackRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationLlmDispatchResponseReadbackResponse
  extends DailyContentDraftGenerationLlmDispatchResponseReadbackSummary {
  checkedAt: string;
  draftGenerationLlmDispatchResponseReadbackSummary: DailyContentDraftGenerationLlmDispatchResponseReadbackSummary;
}

export interface DailyContentDraftGenerationLlmDispatchResponseReadbackSummary {
  patchVersion: "9F-3J";
  checked: true;
  mode: ResponseReadbackMode;
  requestedMode: string;
  previewMode: typeof PREVIEW_MODE;
  readbackOnly: true;
  dryRunOnly: true;
  responseArtifactPersistedNow: false;
  providerNetworkCallAttempted: false;
  llmCallAttempted: false;
  contentMutationAttempted: false;
  bloggerWriteAttempted: false;
  targetSummary: AttemptReadbackSummary["targetSummary"];
  persistedApprovalSummary: AttemptReadbackSummary["persistedApprovalSummary"];
  executionGateSummary: AttemptReadbackSummary["executionGateSummary"];
  responseReadbackSummary: DispatchResponseReadbackSummary;
  currentSideEffectSummary: DailyContentDraftGenerationLlmDispatchResponseReadbackSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface DispatchResponseReadbackSummary {
  readbackVersion: typeof READBACK_VERSION;
  latestAttemptId: string | null;
  latestAttemptStatus: string | null;
  providerResponseReceived: boolean;
  llmCompletionReceived: boolean;
  responseEventFound: boolean;
  responseEvent: SafeResponseEventReadback | null;
  responseArtifactFound: boolean;
  responseArtifactAlreadyPersisted: boolean;
  responseArtifact: SafeResponseArtifactReadback | null;
  latestLlmCallLogFound: boolean;
  latestLlmCallLog: SafeLlmCallLogReadback | null;
  responseHashMatchedAcrossAudit: boolean;
  responseLengthMatchedAcrossAudit: boolean;
  rawPromptStoredOrReturned: false;
  rawResponseStoredOrReturned: false;
  fullCandidateStoredOrReturned: false;
  secretOrTokenStoredOrReturned: false;
  contentItemSnapshot: SafeContentItemSnapshot | null;
  nextSafePatchCandidate: "9F-3K";
  nextSafePatchPurpose: string;
}

export interface SafeResponseEventReadback {
  id: string;
  attemptId: string;
  eventType: string;
  eventStatus: string;
  eventMessage: string | null;
  responseHashPrefix: string | null;
  responseLength: number | null;
  rawResponseStored: boolean | null;
  rawSecretStored: boolean;
  rawTokenStored: boolean;
  createdAt: string;
}

export interface SafeResponseArtifactReadback {
  id: string;
  attemptId: string;
  artifactKind: string;
  artifactHashPrefix: string;
  artifactStorageMode: string;
  artifactRedactionStatus: string;
  artifactPreviewLength: number | null;
  rawSecretStored: boolean;
  rawTokenStored: boolean;
  createdAt: string;
}

export interface SafeLlmCallLogReadback {
  id: string;
  taskType: string;
  status: string;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  phase: string | null;
  responseHashPrefix: string | null;
  responseLength: number | null;
  rawPromptStored: boolean | null;
  rawResponseStored: boolean | null;
  rawSecretStored: boolean | null;
  rawTokenStored: boolean | null;
  createdAt: string;
}

export interface SafeContentItemSnapshot {
  id: string;
  status: string;
  draftMarkdownLength: number;
  draftHtmlLength: number;
  qualityScore: number | null;
  publishedAt: string | null;
  scheduledAt: string | null;
}

export interface DailyContentDraftGenerationLlmDispatchResponseReadbackSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  auditAttemptMutation: false;
  auditEventMutation: false;
  auditArtifactMutation: false;
  auditRowsCreated: false;
  responseArtifactPersistedNow: false;
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

export async function buildDailyContentDraftGenerationLlmDispatchResponseReadbackResponse(
  rawRequest: DailyContentDraftGenerationLlmDispatchResponseReadbackRequest
): Promise<DailyContentDraftGenerationLlmDispatchResponseReadbackResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const attemptReadback = await buildDailyContentDraftGenerationLlmDispatchAttemptReadbackResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const attemptSummary = attemptReadback.draftGenerationLlmDispatchAttemptReadbackSummary;
  const responseReadbackSummary = await readResponseReadbackSummary({
    latestAttemptId: attemptSummary.dispatchAttemptReadbackSummary.latestTargetAttempt?.id ?? null,
    latestAttemptStatus: attemptSummary.dispatchAttemptReadbackSummary.latestTargetAttempt?.attemptStatus ?? null,
    providerResponseReceived: attemptSummary.dispatchAttemptReadbackSummary.latestTargetAttempt?.llmCompletionReceived ?? false,
    contentItemId: request.contentItemId
  });
  const blockingReasons = new Set<string>();

  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_llm_dispatch_response_readback_is_preview_only");
  }
  if (!responseReadbackSummary.latestAttemptId) {
    blockingReasons.add("draft_generation_llm_dispatch_attempt_missing");
  }
  if (!responseReadbackSummary.providerResponseReceived) {
    blockingReasons.add("draft_generation_llm_dispatch_response_not_received");
  }
  if (!responseReadbackSummary.responseEventFound) {
    blockingReasons.add("draft_generation_llm_dispatch_response_event_missing");
  }
  if (!responseReadbackSummary.responseArtifactFound) {
    blockingReasons.add("draft_generation_llm_dispatch_response_artifact_missing");
  }
  if (!responseReadbackSummary.latestLlmCallLogFound) {
    blockingReasons.add("draft_generation_llm_dispatch_llm_call_log_missing");
  }
  if (!responseReadbackSummary.responseHashMatchedAcrossAudit) {
    blockingReasons.add("draft_generation_llm_dispatch_response_hash_mismatch");
  }

  const warnings = new Set<string>([
    "draft_generation_llm_dispatch_response_readback_only",
    "raw_prompt_and_response_not_returned",
    "content_item_mutation_disabled",
    "blogger_write_disabled_by_patch_policy"
  ]);
  const sideEffectSummary = buildSideEffectSummary();
  const summary: DailyContentDraftGenerationLlmDispatchResponseReadbackSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    previewMode: PREVIEW_MODE,
    readbackOnly: true,
    dryRunOnly: true,
    responseArtifactPersistedNow: false,
    providerNetworkCallAttempted: false,
    llmCallAttempted: false,
    contentMutationAttempted: false,
    bloggerWriteAttempted: false,
    targetSummary: attemptSummary.targetSummary,
    persistedApprovalSummary: attemptSummary.persistedApprovalSummary,
    executionGateSummary: attemptSummary.executionGateSummary,
    responseReadbackSummary,
    currentSideEffectSummary: sideEffectSummary,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationLlmDispatchResponseReadbackSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmDispatchResponseReadbackRequest): {
  mode: ResponseReadbackMode;
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

async function readResponseReadbackSummary(input: {
  latestAttemptId: string | null;
  latestAttemptStatus: string | null;
  providerResponseReceived: boolean;
  contentItemId: string | null;
}): Promise<DispatchResponseReadbackSummary> {
  if (!input.latestAttemptId) {
    return buildResponseReadbackSummary({
      latestAttemptId: null,
      latestAttemptStatus: input.latestAttemptStatus,
      providerResponseReceived: input.providerResponseReceived,
      responseEvent: null,
      responseArtifact: null,
      latestLlmCallLog: null,
      contentItemSnapshot: await readContentItemSnapshot(input.contentItemId)
    });
  }

  const [responseEvent, responseArtifact, latestLlmCallLog, contentItemSnapshot] = await Promise.all([
    readLatestResponseEvent(input.latestAttemptId),
    readLatestResponseArtifact(input.latestAttemptId),
    readLatestLlmCallLog(input.contentItemId),
    readContentItemSnapshot(input.contentItemId)
  ]);

  return buildResponseReadbackSummary({
    latestAttemptId: input.latestAttemptId,
    latestAttemptStatus: input.latestAttemptStatus,
    providerResponseReceived: input.providerResponseReceived,
    responseEvent,
    responseArtifact,
    latestLlmCallLog,
    contentItemSnapshot
  });
}

async function readLatestResponseEvent(attemptId: string): Promise<SafeResponseEventReadback | null> {
  const event = await prisma.blogDailyContentLlmDispatchEvent.findFirst({
    where: { attemptId, eventType: RESPONSE_EVENT_TYPE },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      attemptId: true,
      eventType: true,
      eventStatus: true,
      eventMessage: true,
      eventPayloadRedactedJson: true,
      rawSecretStored: true,
      rawTokenStored: true,
      createdAt: true
    }
  });
  if (!event) {
    return null;
  }
  const payload = event.eventPayloadRedactedJson && typeof event.eventPayloadRedactedJson === "object" && !Array.isArray(event.eventPayloadRedactedJson)
    ? (event.eventPayloadRedactedJson as Record<string, unknown>)
    : {};
  const responseHash = typeof payload.responseHash === "string" ? payload.responseHash : null;
  const responseLength = typeof payload.responseLength === "number" ? payload.responseLength : null;
  const rawResponseStored = typeof payload.rawResponseStored === "boolean" ? payload.rawResponseStored : null;

  return {
    id: event.id,
    attemptId: event.attemptId,
    eventType: event.eventType,
    eventStatus: event.eventStatus,
    eventMessage: event.eventMessage,
    responseHashPrefix: responseHash?.slice(0, 16) ?? null,
    responseLength,
    rawResponseStored,
    rawSecretStored: event.rawSecretStored,
    rawTokenStored: event.rawTokenStored,
    createdAt: event.createdAt.toISOString()
  };
}

async function readLatestResponseArtifact(attemptId: string): Promise<SafeResponseArtifactReadback | null> {
  const artifact = await prisma.blogDailyContentLlmDispatchArtifact.findFirst({
    where: { attemptId, artifactKind: RESPONSE_ARTIFACT_KIND },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      attemptId: true,
      artifactKind: true,
      artifactHash: true,
      artifactStorageMode: true,
      artifactRedactionStatus: true,
      artifactPreview: true,
      rawSecretStored: true,
      rawTokenStored: true,
      createdAt: true
    }
  });
  return artifact
    ? {
        id: artifact.id,
        attemptId: artifact.attemptId,
        artifactKind: artifact.artifactKind,
        artifactHashPrefix: artifact.artifactHash.slice(0, 16),
        artifactStorageMode: artifact.artifactStorageMode,
        artifactRedactionStatus: artifact.artifactRedactionStatus,
        artifactPreviewLength: artifact.artifactPreview?.length ?? null,
        rawSecretStored: artifact.rawSecretStored,
        rawTokenStored: artifact.rawTokenStored,
        createdAt: artifact.createdAt.toISOString()
      }
    : null;
}

async function readLatestLlmCallLog(contentItemId: string | null): Promise<SafeLlmCallLogReadback | null> {
  const log = await prisma.llmCallLog.findFirst({
    where: {
      taskType: "content_draft",
      ...(contentItemId ? { contentItemId } : {}),
      metadata: {
        path: ["phase"],
        equals: "dispatch_execution"
      }
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      taskType: true,
      status: true,
      latencyMs: true,
      inputTokens: true,
      outputTokens: true,
      metadata: true,
      createdAt: true
    }
  });
  if (!log) {
    return null;
  }
  const metadata = log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata) ? (log.metadata as Record<string, unknown>) : {};
  const responseHash = typeof metadata.responseHash === "string" ? metadata.responseHash : null;
  return {
    id: log.id,
    taskType: log.taskType,
    status: log.status,
    latencyMs: log.latencyMs,
    inputTokens: log.inputTokens,
    outputTokens: log.outputTokens,
    phase: typeof metadata.phase === "string" ? metadata.phase : null,
    responseHashPrefix: responseHash?.slice(0, 16) ?? null,
    responseLength: typeof metadata.responseLength === "number" ? metadata.responseLength : null,
    rawPromptStored: typeof metadata.rawPromptStored === "boolean" ? metadata.rawPromptStored : null,
    rawResponseStored: typeof metadata.rawResponseStored === "boolean" ? metadata.rawResponseStored : null,
    rawSecretStored: typeof metadata.rawSecretStored === "boolean" ? metadata.rawSecretStored : null,
    rawTokenStored: typeof metadata.rawTokenStored === "boolean" ? metadata.rawTokenStored : null,
    createdAt: log.createdAt.toISOString()
  };
}

async function readContentItemSnapshot(contentItemId: string | null): Promise<SafeContentItemSnapshot | null> {
  if (!contentItemId) {
    return null;
  }
  const item = await prisma.contentItem.findUnique({
    where: { id: contentItemId },
    select: {
      id: true,
      status: true,
      draftMarkdown: true,
      draftHtml: true,
      qualityScore: true,
      publishedAt: true,
      scheduledAt: true
    }
  });
  return item
    ? {
        id: item.id,
        status: item.status,
        draftMarkdownLength: item.draftMarkdown?.length ?? 0,
        draftHtmlLength: item.draftHtml?.length ?? 0,
        qualityScore: item.qualityScore,
        publishedAt: item.publishedAt?.toISOString() ?? null,
        scheduledAt: item.scheduledAt?.toISOString() ?? null
      }
    : null;
}

function buildResponseReadbackSummary(input: {
  latestAttemptId: string | null;
  latestAttemptStatus: string | null;
  providerResponseReceived: boolean;
  responseEvent: SafeResponseEventReadback | null;
  responseArtifact: SafeResponseArtifactReadback | null;
  latestLlmCallLog: SafeLlmCallLogReadback | null;
  contentItemSnapshot: SafeContentItemSnapshot | null;
}): DispatchResponseReadbackSummary {
  const eventHashPrefix = input.responseEvent?.responseHashPrefix ?? null;
  const artifactHashPrefix = input.responseArtifact?.artifactHashPrefix ?? null;
  const logHashPrefix = input.latestLlmCallLog?.responseHashPrefix ?? null;
  const presentHashPrefixes = [eventHashPrefix, artifactHashPrefix, logHashPrefix].filter((value): value is string => Boolean(value));
  const responseHashMatchedAcrossAudit = presentHashPrefixes.length > 0 && presentHashPrefixes.every((value) => value === presentHashPrefixes[0]);
  const eventLength = input.responseEvent?.responseLength ?? null;
  const logLength = input.latestLlmCallLog?.responseLength ?? null;
  const responseLengthMatchedAcrossAudit = eventLength === null || logLength === null || eventLength === logLength;

  return {
    readbackVersion: READBACK_VERSION,
    latestAttemptId: input.latestAttemptId,
    latestAttemptStatus: input.latestAttemptStatus,
    providerResponseReceived: input.providerResponseReceived,
    llmCompletionReceived: input.providerResponseReceived,
    responseEventFound: Boolean(input.responseEvent),
    responseEvent: input.responseEvent,
    responseArtifactFound: Boolean(input.responseArtifact),
    responseArtifactAlreadyPersisted: Boolean(input.responseArtifact),
    responseArtifact: input.responseArtifact,
    latestLlmCallLogFound: Boolean(input.latestLlmCallLog),
    latestLlmCallLog: input.latestLlmCallLog,
    responseHashMatchedAcrossAudit,
    responseLengthMatchedAcrossAudit,
    rawPromptStoredOrReturned: false,
    rawResponseStoredOrReturned: false,
    fullCandidateStoredOrReturned: false,
    secretOrTokenStoredOrReturned: false,
    contentItemSnapshot: input.contentItemSnapshot,
    nextSafePatchCandidate: "9F-3K",
    nextSafePatchPurpose: "Validate redacted LLM output metadata and candidate readiness without mutating content."
  };
}

function buildSideEffectSummary(): DailyContentDraftGenerationLlmDispatchResponseReadbackSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    auditAttemptMutation: false,
    auditEventMutation: false,
    auditArtifactMutation: false,
    auditRowsCreated: false,
    responseArtifactPersistedNow: false,
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
