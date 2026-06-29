import {
  buildDailyContentDraftGenerationLlmDispatchGatePreviewResponse,
  type DailyContentDraftGenerationLlmDispatchGatePreviewResponse
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-gate-preview";

const PATCH_VERSION = "9F-2V";
const PREVIEW_MODE = "read_only_draft_generation_llm_dispatch_audit_schema_design";
const DESIGN_VERSION = "daily_content_draft_generation_llm_dispatch_audit_schema_v0";

type AuditSchemaDesignMode = "preview" | "blocked_non_preview";
type DispatchGateSummary =
  DailyContentDraftGenerationLlmDispatchGatePreviewResponse["draftGenerationLlmDispatchGatePreviewSummary"];

export interface DailyContentDraftGenerationLlmDispatchAuditSchemaDesignRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationLlmDispatchAuditSchemaDesignResponse
  extends DailyContentDraftGenerationLlmDispatchAuditSchemaDesignSummary {
  checkedAt: string;
  draftGenerationLlmDispatchAuditSchemaDesignSummary: DailyContentDraftGenerationLlmDispatchAuditSchemaDesignSummary;
}

export interface DailyContentDraftGenerationLlmDispatchAuditSchemaDesignSummary {
  patchVersion: "9F-2V";
  checked: true;
  mode: AuditSchemaDesignMode;
  requestedMode: string;
  previewMode: typeof PREVIEW_MODE;
  designOnly: true;
  dryRunOnly: true;
  schemaModified: false;
  migrationCreated: false;
  migrationApplied: false;
  dbWrite: false;
  providerNetworkCallAttempted: false;
  llmCallAttempted: false;
  contentMutationAttempted: false;
  targetSummary: DispatchGateSummary["targetSummary"];
  persistedApprovalSummary: DispatchGateSummary["persistedApprovalSummary"];
  executionGateSummary: DispatchGateSummary["executionGateSummary"];
  auditSchemaDesignSummary: AuditSchemaDesignSummary;
  sideEffectSummary: DailyContentDraftGenerationLlmDispatchAuditSchemaDesignSideEffectSummary;
  currentSideEffectSummary: DailyContentDraftGenerationLlmDispatchAuditSchemaDesignSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface AuditSchemaDesignSummary {
  designVersion: typeof DESIGN_VERSION;
  designOnly: true;
  prismaSchemaChangeProposed: true;
  prismaSchemaChangedNow: false;
  migrationRequiredLater: true;
  migrationCreatedNow: false;
  migrationAppliedNow: false;
  proposedTables: ProposedAuditTable[];
  idempotencyDesign: {
    rawIdempotencyKeyStored: false;
    idempotencyKeyHashStored: true;
    uniqueConstraint: "unique(planItemId, contentItemId, attemptPurpose, idempotencyKeyHash)";
    duplicateBehavior: "return_existing_attempt_readback_without_reexecution";
    retryPolicy: "failed_attempt_retry_requires_new_idempotency_key";
  };
  redactionPolicy: {
    rawSecretsStored: false;
    rawTokensStored: false;
    rawProviderRequestStoredByDefault: false;
    rawProviderResponseStoredByDefault: false;
    authorizationHeaderValueStored: false;
    promptHashAllowed: true;
    requestEnvelopeHashAllowed: true;
    redactedErrorMessageAllowed: true;
    fullPromptStored: false;
    fullCandidateStoredByDefault: false;
  };
  retentionPlan: {
    attemptMetadataRetention: "long_lived";
    eventMetadataRetention: "long_lived";
    redactedArtifactRetention: "configurable_future_policy";
    rawProviderPayloadRetention: "not_applicable_raw_payload_not_stored";
    cleanupJobRequiredLater: true;
  };
  futureMigrationPlan: {
    nextSchemaScaffoldPatchCandidate: "9F-2W";
    applyPatchCandidate: "9F-2W-APPLY";
    migrationShouldBeSeparateFromProviderCall: true;
    migrationShouldCreateRows: false;
    migrationShouldBeAppliedOnlyAfterOperatorApproval: true;
  };
  sourceDispatchGatePatchVersion: "9F-2U";
  sourceDispatchGateSummary: {
    dispatchAllowedNow: false;
    dispatchWouldBeBlocked: true;
    dispatchBlockers: string[];
  };
}

export interface ProposedAuditTable {
  name: string;
  tableName: string;
  purpose: string;
  createNow: false;
  fields: ProposedAuditField[];
  indexes: string[];
  foreignKeys: string[];
  uniqueConstraints: string[];
}

export interface ProposedAuditField {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  notes: string;
}

export interface DailyContentDraftGenerationLlmDispatchAuditSchemaDesignSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  schemaFileModified: false;
  migrationFileCreated: false;
  migrationApplied: false;
  envRead: true;
  secretValueExposed: false;
  auditSchemaDesignedForPreview: true;
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

export async function buildDailyContentDraftGenerationLlmDispatchAuditSchemaDesignResponse(
  rawRequest: DailyContentDraftGenerationLlmDispatchAuditSchemaDesignRequest
): Promise<DailyContentDraftGenerationLlmDispatchAuditSchemaDesignResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const dispatchGateResponse = await buildDailyContentDraftGenerationLlmDispatchGatePreviewResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const dispatchGateSummary = dispatchGateResponse.draftGenerationLlmDispatchGatePreviewSummary;
  const auditSchemaDesignSummary = buildAuditSchemaDesignSummary(dispatchGateSummary);
  const blockingReasons = new Set<string>();

  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_llm_dispatch_audit_schema_design_is_preview_only");
  }
  const sideEffectSummary = buildSideEffectSummary();

  const warnings = new Set<string>([
    "draft_generation_llm_dispatch_audit_schema_design_only",
    "prisma_schema_change_not_applied",
    "migration_not_created",
    "migration_not_applied",
    "provider_call_disabled_by_patch_policy",
    "content_item_mutation_disabled"
  ]);

  const summary: DailyContentDraftGenerationLlmDispatchAuditSchemaDesignSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    previewMode: PREVIEW_MODE,
    designOnly: true,
    dryRunOnly: true,
    schemaModified: false,
    migrationCreated: false,
    migrationApplied: false,
    dbWrite: false,
    providerNetworkCallAttempted: false,
    llmCallAttempted: false,
    contentMutationAttempted: false,
    targetSummary: dispatchGateSummary.targetSummary,
    persistedApprovalSummary: dispatchGateSummary.persistedApprovalSummary,
    executionGateSummary: {
      executionAllowed: false,
      finalDraftGenerationAllowed: false,
      remainingBlockers: dispatchGateSummary.executionGateSummary.remainingBlockers,
      resolvedBlockers: dispatchGateSummary.executionGateSummary.resolvedBlockers
    },
    auditSchemaDesignSummary,
    sideEffectSummary,
    currentSideEffectSummary: sideEffectSummary,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationLlmDispatchAuditSchemaDesignSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmDispatchAuditSchemaDesignRequest): {
  mode: AuditSchemaDesignMode;
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

function buildAuditSchemaDesignSummary(dispatchGateSummary: DispatchGateSummary): AuditSchemaDesignSummary {
  return {
    designVersion: DESIGN_VERSION,
    designOnly: true,
    prismaSchemaChangeProposed: true,
    prismaSchemaChangedNow: false,
    migrationRequiredLater: true,
    migrationCreatedNow: false,
    migrationAppliedNow: false,
    proposedTables: [buildAttemptsTable(), buildEventsTable(), buildArtifactsTable()],
    idempotencyDesign: {
      rawIdempotencyKeyStored: false,
      idempotencyKeyHashStored: true,
      uniqueConstraint: "unique(planItemId, contentItemId, attemptPurpose, idempotencyKeyHash)",
      duplicateBehavior: "return_existing_attempt_readback_without_reexecution",
      retryPolicy: "failed_attempt_retry_requires_new_idempotency_key"
    },
    redactionPolicy: {
      rawSecretsStored: false,
      rawTokensStored: false,
      rawProviderRequestStoredByDefault: false,
      rawProviderResponseStoredByDefault: false,
      authorizationHeaderValueStored: false,
      promptHashAllowed: true,
      requestEnvelopeHashAllowed: true,
      redactedErrorMessageAllowed: true,
      fullPromptStored: false,
      fullCandidateStoredByDefault: false
    },
    retentionPlan: {
      attemptMetadataRetention: "long_lived",
      eventMetadataRetention: "long_lived",
      redactedArtifactRetention: "configurable_future_policy",
      rawProviderPayloadRetention: "not_applicable_raw_payload_not_stored",
      cleanupJobRequiredLater: true
    },
    futureMigrationPlan: {
      nextSchemaScaffoldPatchCandidate: "9F-2W",
      applyPatchCandidate: "9F-2W-APPLY",
      migrationShouldBeSeparateFromProviderCall: true,
      migrationShouldCreateRows: false,
      migrationShouldBeAppliedOnlyAfterOperatorApproval: true
    },
    sourceDispatchGatePatchVersion: "9F-2U",
    sourceDispatchGateSummary: {
      dispatchAllowedNow: dispatchGateSummary.dispatchAllowedNow,
      dispatchWouldBeBlocked: dispatchGateSummary.dispatchGatePreviewSummary.dispatchWouldBeBlocked,
      dispatchBlockers: dispatchGateSummary.dispatchGatePreviewSummary.dispatchBlockers
    }
  };
}

function buildAttemptsTable(): ProposedAuditTable {
  return {
    name: "blog_daily_content_llm_dispatch_attempts",
    tableName: "blog_daily_content_llm_dispatch_attempts",
    purpose: "One row per future LLM dispatch attempt",
    createNow: false,
    fields: [
      field("id", "String", false, "cuid()", "Primary key."),
      field("planId", "String", false, null, "Links to the daily content plan."),
      field("planItemId", "String", false, null, "Links to the daily plan item being dispatched."),
      field("contentItemId", "String", false, null, "Links to the target content item fixture."),
      field("operatorApprovalId", "String", false, null, "Links to the approval used for this future attempt."),
      field("idempotencyKeyHash", "String", false, null, "Hash of the idempotency key; raw key is never stored."),
      field("attemptStatus", "String", false, "planned", "Future enum candidate such as planned, started, failed, succeeded, manual_review_required."),
      field("attemptPurpose", "String", false, "daily_content_draft_generation", "Purpose for uniqueness and replay policy."),
      field("providerKey", "String", true, null, "Safe provider id/key metadata."),
      field("providerKind", "String", true, null, "Safe provider kind metadata."),
      field("modelKey", "String", true, null, "Safe model id/key metadata."),
      field("modelDisplayName", "String", true, null, "Safe model display metadata."),
      field("requestEnvelopeHash", "String", false, null, "Hash of the redacted request envelope preview."),
      field("promptSha256", "String", false, null, "Hash of the sanitized prompt preview."),
      field("promptVersion", "String", false, null, "Prompt version used by the future dispatch."),
      field("promptQualityChecklistVersion", "String", false, null, "Prompt quality checklist version."),
      field("dispatchGateVersion", "String", false, null, "Dispatch gate design/version used."),
      field("healthCheckReferenceId", "String", true, null, "Future persisted health-check reference if available."),
      field("healthCheckSummaryHash", "String", true, null, "Hash of health-check metadata when no reference id exists."),
      field("confirmationPhraseHash", "String", false, null, "Hash of accepted confirmation phrase."),
      field("requestBodyStored", "Boolean", false, "false", "Raw provider request body is not stored by default."),
      field("requestBodyRedacted", "Boolean", false, "true", "Any stored request artifact must be redacted."),
      field("responseBodyStored", "Boolean", false, "false", "Raw provider response body is not stored by default."),
      field("responseBodyRedacted", "Boolean", false, "true", "Any stored response artifact must be redacted."),
      field("rawSecretStored", "Boolean", false, "false", "Raw secret values must never be stored."),
      field("rawTokenStored", "Boolean", false, "false", "Raw token values must never be stored."),
      field("providerNetworkCallAttempted", "Boolean", false, "false", "True only after a future explicit dispatch attempts provider network."),
      field("llmCallAttempted", "Boolean", false, "false", "True only after a future explicit LLM call begins."),
      field("llmCompletionReceived", "Boolean", false, "false", "True only after a future provider completion response is accepted."),
      field("contentMutationAttempted", "Boolean", false, "false", "Content mutation defaults to false and is separate from provider call."),
      field("draftMutationAttempted", "Boolean", false, "false", "Draft field mutation defaults to false."),
      field("bloggerWriteAttempted", "Boolean", false, "false", "Blogger writes are not part of draft-generation dispatch."),
      field("errorCode", "String", true, null, "Short safe error code."),
      field("errorCategory", "String", true, null, "Short safe error category."),
      field("errorMessageRedacted", "String", true, null, "Redacted error message only."),
      field("startedAt", "DateTime", true, null, "Future dispatch start timestamp."),
      field("finishedAt", "DateTime", true, null, "Future dispatch finish timestamp."),
      field("createdAt", "DateTime", false, "now()", "Creation timestamp."),
      field("updatedAt", "DateTime", false, "updatedAt", "Update timestamp.")
    ],
    indexes: [
      "index(planId, createdAt)",
      "index(planItemId, createdAt)",
      "index(contentItemId, createdAt)",
      "index(attemptStatus, createdAt)",
      "index(providerKey, modelKey, createdAt)",
      "index(requestEnvelopeHash)",
      "index(promptSha256)"
    ],
    foreignKeys: [
      "planId -> blog_daily_content_plans.id",
      "planItemId -> blog_daily_content_plan_items.id",
      "contentItemId -> content_items.id",
      "operatorApprovalId -> blog_daily_content_operator_approvals.id"
    ],
    uniqueConstraints: ["unique(planItemId, contentItemId, attemptPurpose, idempotencyKeyHash)"]
  };
}

function buildEventsTable(): ProposedAuditTable {
  return {
    name: "blog_daily_content_llm_dispatch_events",
    tableName: "blog_daily_content_llm_dispatch_events",
    purpose: "Append-only event stream for future dispatch attempts",
    createNow: false,
    fields: [
      field("id", "String", false, "cuid()", "Primary key."),
      field("attemptId", "String", false, null, "Links to dispatch attempt."),
      field("eventType", "String", false, null, "Future enum candidate for the dispatch lifecycle event."),
      field("eventStatus", "String", false, null, "Short status such as planned, started, succeeded, failed, skipped."),
      field("eventMessage", "String", true, null, "Short redacted operator-readable message."),
      field("eventPayloadRedactedJson", "Json", true, null, "Safe redacted metadata only."),
      field("rawSecretStored", "Boolean", false, "false", "Raw secret values must never be stored."),
      field("rawTokenStored", "Boolean", false, "false", "Raw token values must never be stored."),
      field("createdAt", "DateTime", false, "now()", "Event timestamp.")
    ],
    indexes: ["index(attemptId, createdAt)", "index(eventType, createdAt)", "index(eventStatus, createdAt)"],
    foreignKeys: ["attemptId -> blog_daily_content_llm_dispatch_attempts.id"],
    uniqueConstraints: []
  };
}

function buildArtifactsTable(): ProposedAuditTable {
  return {
    name: "blog_daily_content_llm_dispatch_artifacts",
    tableName: "blog_daily_content_llm_dispatch_artifacts",
    purpose: "Optional future redacted artifact metadata for prompts, envelopes, responses, and validated candidates",
    createNow: false,
    fields: [
      field("id", "String", false, "cuid()", "Primary key."),
      field("attemptId", "String", false, null, "Links to dispatch attempt."),
      field("artifactKind", "String", false, null, "prompt_preview, request_envelope_preview, redacted_provider_request, redacted_provider_response, validated candidate."),
      field("artifactHash", "String", false, null, "Hash of artifact content or preview."),
      field("artifactStorageMode", "String", false, "metadata_only", "Default is metadata/hash only."),
      field("artifactRedactionStatus", "String", false, "redacted", "Artifacts must be redacted before storage."),
      field("artifactPreview", "String", true, null, "Bounded redacted preview only, never raw secrets or full payload."),
      field("rawSecretStored", "Boolean", false, "false", "Raw secret values must never be stored."),
      field("rawTokenStored", "Boolean", false, "false", "Raw token values must never be stored."),
      field("createdAt", "DateTime", false, "now()", "Artifact metadata timestamp.")
    ],
    indexes: ["index(attemptId, createdAt)", "index(artifactKind, createdAt)", "index(artifactHash)"],
    foreignKeys: ["attemptId -> blog_daily_content_llm_dispatch_attempts.id"],
    uniqueConstraints: []
  };
}

function field(name: string, type: string, nullable: boolean, defaultValue: string | null, notes: string): ProposedAuditField {
  return { name, type, nullable, defaultValue, notes };
}

function buildSideEffectSummary(): DailyContentDraftGenerationLlmDispatchAuditSchemaDesignSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    schemaFileModified: false,
    migrationFileCreated: false,
    migrationApplied: false,
    envRead: true,
    secretValueExposed: false,
    auditSchemaDesignedForPreview: true,
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
