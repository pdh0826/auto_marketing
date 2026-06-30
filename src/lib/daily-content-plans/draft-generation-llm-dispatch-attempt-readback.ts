import {
  buildDailyContentDraftGenerationLlmDispatchAuditMigrationApplyReadbackResponse,
  type DailyContentDraftGenerationLlmDispatchAuditMigrationApplyReadbackResponse
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-audit-migration-apply-readback";
import { prisma } from "@/lib/db/client";

const PATCH_VERSION = "9F-2X";
const PREVIEW_MODE = "read_only_draft_generation_llm_dispatch_attempt_readback";
const READBACK_VERSION = "daily_content_draft_generation_llm_dispatch_attempt_readback_v0";
const MIGRATION_APPLIED_PATCH_VERSION = "9F-2W-APPLY";

type AttemptReadbackMode = "preview" | "blocked_non_preview";
type AuditMigrationApplyReadbackSummary =
  DailyContentDraftGenerationLlmDispatchAuditMigrationApplyReadbackResponse["draftGenerationLlmDispatchAuditMigrationApplyReadbackSummary"];

export interface DailyContentDraftGenerationLlmDispatchAttemptReadbackRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationLlmDispatchAttemptReadbackResponse
  extends DailyContentDraftGenerationLlmDispatchAttemptReadbackSummary {
  checkedAt: string;
  draftGenerationLlmDispatchAttemptReadbackSummary: DailyContentDraftGenerationLlmDispatchAttemptReadbackSummary;
}

export interface DailyContentDraftGenerationLlmDispatchAttemptReadbackSummary {
  patchVersion: "9F-2X";
  checked: true;
  mode: AttemptReadbackMode;
  requestedMode: string;
  previewMode: typeof PREVIEW_MODE;
  readbackOnly: true;
  dryRunOnly: true;
  auditTablesExist: boolean;
  auditRowsCreatedNow: false;
  auditRowsMutatedNow: false;
  providerNetworkCallAttempted: false;
  llmCallAttempted: false;
  contentMutationAttempted: false;
  bloggerWriteAttempted: false;
  targetSummary: AuditMigrationApplyReadbackSummary["targetSummary"];
  persistedApprovalSummary: AuditMigrationApplyReadbackSummary["persistedApprovalSummary"];
  executionGateSummary: AuditMigrationApplyReadbackSummary["executionGateSummary"];
  dispatchAttemptReadbackSummary: DispatchAttemptReadbackSummary;
  baselineSummary: AuditMigrationApplyReadbackSummary["baselineSummary"];
  sideEffectSummary: DailyContentDraftGenerationLlmDispatchAttemptReadbackSideEffectSummary;
  currentSideEffectSummary: DailyContentDraftGenerationLlmDispatchAttemptReadbackSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface DispatchAttemptReadbackSummary {
  readbackVersion: typeof READBACK_VERSION;
  migrationAppliedPatchVersion: typeof MIGRATION_APPLIED_PATCH_VERSION;
  auditTablesExist: boolean;
  emptyState: boolean;
  globalCounts: DispatchAuditCounts;
  targetScopedCounts: DispatchAuditCounts;
  latestTargetAttempt: SafeDispatchAttemptReadback | null;
  latestTargetEvent: SafeDispatchEventReadback | null;
  latestTargetArtifact: SafeDispatchArtifactReadback | null;
  lifecycle: {
    currentLifecycleStatus: "not_started";
    latestAttemptStatus: string | null;
    latestAttemptId: string | null;
    futureLifecycleStatuses: string[];
  };
  futureReadbackShape: {
    attemptFields: string[];
    eventFields: string[];
    artifactFields: string[];
    rawPromptStoredOrReturned: false;
    rawResponseStoredOrReturned: false;
    fullCandidateStoredOrReturned: false;
    secretOrTokenStoredOrReturned: false;
  };
  actionAvailability: {
    canCreateAttemptNow: false;
    attemptCreationAllowedInThisPatch: false;
    canDispatchNow: false;
    dispatchAllowedInThisPatch: false;
    providerCallAllowedInThisPatch: false;
    llmCallAllowedInThisPatch: false;
    contentMutationAllowedInThisPatch: false;
  };
  nextSafePatchCandidate: "9F-2Y";
  nextSafePatchPurpose: string;
}

export interface DispatchAuditCounts {
  attempts: number;
  events: number;
  artifacts: number;
}

export interface SafeDispatchAttemptReadback {
  id: string;
  planId: string;
  planItemId: string;
  contentItemId: string;
  operatorApprovalId: string;
  attemptPurpose: string;
  attemptStatus: string;
  providerKey: string | null;
  providerKind: string | null;
  modelKey: string | null;
  modelDisplayName: string | null;
  requestEnvelopeHash: string;
  promptSha256: string;
  promptVersion: string;
  promptQualityChecklistVersion: string;
  dispatchGateVersion: string;
  healthCheckReferenceId: string | null;
  healthCheckSummaryHash: string | null;
  requestBodyStored: boolean;
  requestBodyRedacted: boolean;
  responseBodyStored: boolean;
  responseBodyRedacted: boolean;
  rawSecretStored: boolean;
  rawTokenStored: boolean;
  providerNetworkCallAttempted: boolean;
  llmCallAttempted: boolean;
  llmCompletionReceived: boolean;
  contentMutationAttempted: boolean;
  draftMutationAttempted: boolean;
  bloggerWriteAttempted: boolean;
  errorCode: string | null;
  errorCategory: string | null;
  errorMessageRedacted: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SafeDispatchEventReadback {
  id: string;
  attemptId: string;
  eventType: string;
  eventStatus: string;
  eventMessage: string | null;
  rawSecretStored: boolean;
  rawTokenStored: boolean;
  createdAt: string;
}

export interface SafeDispatchArtifactReadback {
  id: string;
  attemptId: string;
  artifactKind: string;
  artifactHash: string;
  artifactStorageMode: string;
  artifactRedactionStatus: string;
  artifactPreview: string | null;
  rawSecretStored: boolean;
  rawTokenStored: boolean;
  createdAt: string;
}

export interface DailyContentDraftGenerationLlmDispatchAttemptReadbackSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  auditAttemptMutation: false;
  auditEventMutation: false;
  auditArtifactMutation: false;
  auditRowsCreated: false;
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

export async function buildDailyContentDraftGenerationLlmDispatchAttemptReadbackResponse(
  rawRequest: DailyContentDraftGenerationLlmDispatchAttemptReadbackRequest
): Promise<DailyContentDraftGenerationLlmDispatchAttemptReadbackResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const applyReadback = await buildDailyContentDraftGenerationLlmDispatchAuditMigrationApplyReadbackResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const applySummary = applyReadback.draftGenerationLlmDispatchAuditMigrationApplyReadbackSummary;
  const auditTablesExist = applySummary.schemaTablesCreated;
  const dispatchAttemptReadbackSummary = await readDispatchAttemptReadbackSummary({
    auditTablesExist,
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const blockingReasons = new Set<string>();

  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_llm_dispatch_attempt_readback_is_preview_only");
  }
  if (!auditTablesExist) {
    blockingReasons.add("draft_generation_llm_dispatch_audit_tables_missing");
  }

  const warnings = new Set<string>([
    "draft_generation_llm_dispatch_attempt_readback_only",
    "dispatch_attempt_creation_disabled_by_patch_policy",
    "provider_call_disabled_by_patch_policy",
    "content_item_mutation_disabled"
  ]);

  const sideEffectSummary = buildSideEffectSummary();
  const summary: DailyContentDraftGenerationLlmDispatchAttemptReadbackSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    previewMode: PREVIEW_MODE,
    readbackOnly: true,
    dryRunOnly: true,
    auditTablesExist,
    auditRowsCreatedNow: false,
    auditRowsMutatedNow: false,
    providerNetworkCallAttempted: false,
    llmCallAttempted: false,
    contentMutationAttempted: false,
    bloggerWriteAttempted: false,
    targetSummary: applySummary.targetSummary,
    persistedApprovalSummary: applySummary.persistedApprovalSummary,
    executionGateSummary: {
      executionAllowed: false,
      finalDraftGenerationAllowed: false,
      remainingBlockers: applySummary.executionGateSummary.remainingBlockers,
      resolvedBlockers: applySummary.executionGateSummary.resolvedBlockers
    },
    dispatchAttemptReadbackSummary,
    baselineSummary: applySummary.baselineSummary,
    sideEffectSummary,
    currentSideEffectSummary: sideEffectSummary,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationLlmDispatchAttemptReadbackSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmDispatchAttemptReadbackRequest): {
  mode: AttemptReadbackMode;
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

async function readDispatchAttemptReadbackSummary(input: {
  auditTablesExist: boolean;
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
}): Promise<DispatchAttemptReadbackSummary> {
  if (!input.auditTablesExist) {
    return buildEmptyDispatchAttemptReadbackSummary({
      auditTablesExist: false,
      globalCounts: { attempts: 0, events: 0, artifacts: 0 },
      targetScopedCounts: { attempts: 0, events: 0, artifacts: 0 },
      latestTargetAttempt: null,
      latestTargetEvent: null,
      latestTargetArtifact: null
    });
  }

  const [globalCounts, targetScopedCounts, latestTargetAttempt, latestTargetEvent, latestTargetArtifact] = await Promise.all([
    readGlobalCounts(),
    readTargetScopedCounts(input),
    readLatestTargetAttempt(input),
    readLatestTargetEvent(input),
    readLatestTargetArtifact(input)
  ]);

  return buildEmptyDispatchAttemptReadbackSummary({
    auditTablesExist: input.auditTablesExist,
    globalCounts,
    targetScopedCounts,
    latestTargetAttempt,
    latestTargetEvent,
    latestTargetArtifact
  });
}

async function readGlobalCounts(): Promise<DispatchAuditCounts> {
  const [attempts, events, artifacts] = await Promise.all([
    prisma.blogDailyContentLlmDispatchAttempt.count(),
    prisma.blogDailyContentLlmDispatchEvent.count(),
    prisma.blogDailyContentLlmDispatchArtifact.count()
  ]);
  return { attempts, events, artifacts };
}

async function readTargetScopedCounts(input: { planId: string | null; planItemId: string | null; contentItemId: string | null }): Promise<DispatchAuditCounts> {
  const attemptWhere = buildAttemptWhere(input);
  const [attempts, events, artifacts] = await Promise.all([
    prisma.blogDailyContentLlmDispatchAttempt.count({ where: attemptWhere }),
    prisma.blogDailyContentLlmDispatchEvent.count({
      where: {
        attempt: attemptWhere
      }
    }),
    prisma.blogDailyContentLlmDispatchArtifact.count({
      where: {
        attempt: attemptWhere
      }
    })
  ]);
  return { attempts, events, artifacts };
}

async function readLatestTargetAttempt(input: { planId: string | null; planItemId: string | null; contentItemId: string | null }): Promise<SafeDispatchAttemptReadback | null> {
  const attempt = await prisma.blogDailyContentLlmDispatchAttempt.findFirst({
    where: buildAttemptWhere(input),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      planId: true,
      planItemId: true,
      contentItemId: true,
      operatorApprovalId: true,
      attemptPurpose: true,
      attemptStatus: true,
      providerKey: true,
      providerKind: true,
      modelKey: true,
      modelDisplayName: true,
      requestEnvelopeHash: true,
      promptSha256: true,
      promptVersion: true,
      promptQualityChecklistVersion: true,
      dispatchGateVersion: true,
      healthCheckReferenceId: true,
      healthCheckSummaryHash: true,
      requestBodyStored: true,
      requestBodyRedacted: true,
      responseBodyStored: true,
      responseBodyRedacted: true,
      rawSecretStored: true,
      rawTokenStored: true,
      providerNetworkCallAttempted: true,
      llmCallAttempted: true,
      llmCompletionReceived: true,
      contentMutationAttempted: true,
      draftMutationAttempted: true,
      bloggerWriteAttempted: true,
      errorCode: true,
      errorCategory: true,
      errorMessageRedacted: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return attempt ? serializeAttempt(attempt) : null;
}

async function readLatestTargetEvent(input: { planId: string | null; planItemId: string | null; contentItemId: string | null }): Promise<SafeDispatchEventReadback | null> {
  const event = await prisma.blogDailyContentLlmDispatchEvent.findFirst({
    where: {
      attempt: buildAttemptWhere(input)
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      attemptId: true,
      eventType: true,
      eventStatus: true,
      eventMessage: true,
      rawSecretStored: true,
      rawTokenStored: true,
      createdAt: true
    }
  });

  return event
    ? {
        ...event,
        createdAt: event.createdAt.toISOString()
      }
    : null;
}

async function readLatestTargetArtifact(input: { planId: string | null; planItemId: string | null; contentItemId: string | null }): Promise<SafeDispatchArtifactReadback | null> {
  const artifact = await prisma.blogDailyContentLlmDispatchArtifact.findFirst({
    where: {
      attempt: buildAttemptWhere(input)
    },
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
        ...artifact,
        createdAt: artifact.createdAt.toISOString()
      }
    : null;
}

function buildAttemptWhere(input: { planId: string | null; planItemId: string | null; contentItemId: string | null }) {
  return {
    ...(input.planId ? { planId: input.planId } : {}),
    ...(input.planItemId ? { planItemId: input.planItemId } : {}),
    ...(input.contentItemId ? { contentItemId: input.contentItemId } : {})
  };
}

function serializeAttempt(attempt: {
  id: string;
  planId: string;
  planItemId: string;
  contentItemId: string;
  operatorApprovalId: string;
  attemptPurpose: string;
  attemptStatus: string;
  providerKey: string | null;
  providerKind: string | null;
  modelKey: string | null;
  modelDisplayName: string | null;
  requestEnvelopeHash: string;
  promptSha256: string;
  promptVersion: string;
  promptQualityChecklistVersion: string;
  dispatchGateVersion: string;
  healthCheckReferenceId: string | null;
  healthCheckSummaryHash: string | null;
  requestBodyStored: boolean;
  requestBodyRedacted: boolean;
  responseBodyStored: boolean;
  responseBodyRedacted: boolean;
  rawSecretStored: boolean;
  rawTokenStored: boolean;
  providerNetworkCallAttempted: boolean;
  llmCallAttempted: boolean;
  llmCompletionReceived: boolean;
  contentMutationAttempted: boolean;
  draftMutationAttempted: boolean;
  bloggerWriteAttempted: boolean;
  errorCode: string | null;
  errorCategory: string | null;
  errorMessageRedacted: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): SafeDispatchAttemptReadback {
  return {
    ...attempt,
    startedAt: attempt.startedAt?.toISOString() ?? null,
    finishedAt: attempt.finishedAt?.toISOString() ?? null,
    createdAt: attempt.createdAt.toISOString(),
    updatedAt: attempt.updatedAt.toISOString()
  };
}

function buildEmptyDispatchAttemptReadbackSummary(input: {
  auditTablesExist: boolean;
  globalCounts: DispatchAuditCounts;
  targetScopedCounts: DispatchAuditCounts;
  latestTargetAttempt: SafeDispatchAttemptReadback | null;
  latestTargetEvent: SafeDispatchEventReadback | null;
  latestTargetArtifact: SafeDispatchArtifactReadback | null;
}): DispatchAttemptReadbackSummary {
  return {
    readbackVersion: READBACK_VERSION,
    migrationAppliedPatchVersion: MIGRATION_APPLIED_PATCH_VERSION,
    auditTablesExist: input.auditTablesExist,
    emptyState: input.globalCounts.attempts === 0 && input.globalCounts.events === 0 && input.globalCounts.artifacts === 0,
    globalCounts: input.globalCounts,
    targetScopedCounts: input.targetScopedCounts,
    latestTargetAttempt: input.latestTargetAttempt,
    latestTargetEvent: input.latestTargetEvent,
    latestTargetArtifact: input.latestTargetArtifact,
    lifecycle: {
      currentLifecycleStatus: "not_started",
      latestAttemptStatus: input.latestTargetAttempt?.attemptStatus ?? null,
      latestAttemptId: input.latestTargetAttempt?.id ?? null,
      futureLifecycleStatuses: [
        "not_started",
        "gate_previewed",
        "attempt_planned",
        "attempt_queued",
        "attempt_started",
        "provider_request_prepared",
        "provider_request_sent",
        "provider_response_received",
        "provider_response_rejected",
        "output_validation_started",
        "output_validation_failed",
        "output_validation_passed",
        "content_mutation_deferred",
        "content_mutation_started",
        "content_mutation_committed",
        "content_mutation_failed",
        "attempt_completed",
        "attempt_failed"
      ]
    },
    futureReadbackShape: {
      attemptFields: [
        "id",
        "planId",
        "planItemId",
        "contentItemId",
        "operatorApprovalId",
        "attemptPurpose",
        "attemptStatus",
        "providerKey",
        "providerKind",
        "modelKey",
        "requestEnvelopeHash",
        "promptSha256",
        "promptVersion",
        "dispatchGateVersion",
        "startedAt",
        "finishedAt",
        "createdAt",
        "updatedAt"
      ],
      eventFields: ["id", "attemptId", "eventType", "eventStatus", "eventMessage", "createdAt"],
      artifactFields: ["id", "attemptId", "artifactKind", "artifactHash", "artifactStorageMode", "artifactRedactionStatus", "createdAt"],
      rawPromptStoredOrReturned: false,
      rawResponseStoredOrReturned: false,
      fullCandidateStoredOrReturned: false,
      secretOrTokenStoredOrReturned: false
    },
    actionAvailability: {
      canCreateAttemptNow: false,
      attemptCreationAllowedInThisPatch: false,
      canDispatchNow: false,
      dispatchAllowedInThisPatch: false,
      providerCallAllowedInThisPatch: false,
      llmCallAllowedInThisPatch: false,
      contentMutationAllowedInThisPatch: false
    },
    nextSafePatchCandidate: "9F-2Y",
    nextSafePatchPurpose: "Draft-generation LLM dispatch attempt creation gate preview, no rows/no provider call/no content mutation"
  };
}

function buildSideEffectSummary(): DailyContentDraftGenerationLlmDispatchAttemptReadbackSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    auditAttemptMutation: false,
    auditEventMutation: false,
    auditArtifactMutation: false,
    auditRowsCreated: false,
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
