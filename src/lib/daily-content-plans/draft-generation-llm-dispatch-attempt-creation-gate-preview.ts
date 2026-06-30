import {
  buildDailyContentDraftGenerationLlmDispatchAttemptReadbackResponse,
  type DailyContentDraftGenerationLlmDispatchAttemptReadbackResponse,
  type SafeDispatchAttemptReadback
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-attempt-readback";
import {
  buildDailyContentDraftGenerationLlmDispatchGatePreviewResponse,
  type DailyContentDraftGenerationLlmDispatchGatePreviewResponse
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-gate-preview";

const PATCH_VERSION = "9F-2Y";
const PREVIEW_MODE = "read_only_draft_generation_llm_dispatch_attempt_creation_gate_preview";
const GATE_VERSION = "daily_content_draft_generation_llm_dispatch_attempt_creation_gate_v0";
const SOURCE_READBACK_PATCH_VERSION = "9F-2X";

type AttemptCreationGateMode = "preview" | "blocked_non_preview";
type AttemptCreationGateCheckStatus = "pass" | "blocked" | "warn" | "not_applicable";
type AttemptCreationGateCheckSeverity = "info" | "low" | "medium" | "high";
type AttemptReadbackSummary =
  DailyContentDraftGenerationLlmDispatchAttemptReadbackResponse["draftGenerationLlmDispatchAttemptReadbackSummary"];
type DispatchGateSummary = DailyContentDraftGenerationLlmDispatchGatePreviewResponse["draftGenerationLlmDispatchGatePreviewSummary"];

export interface DailyContentDraftGenerationLlmDispatchAttemptCreationGatePreviewRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationLlmDispatchAttemptCreationGatePreviewResponse
  extends DailyContentDraftGenerationLlmDispatchAttemptCreationGatePreviewSummary {
  checkedAt: string;
  draftGenerationLlmDispatchAttemptCreationGatePreviewSummary: DailyContentDraftGenerationLlmDispatchAttemptCreationGatePreviewSummary;
}

export interface DailyContentDraftGenerationLlmDispatchAttemptCreationGatePreviewSummary {
  patchVersion: "9F-2Y";
  checked: true;
  mode: AttemptCreationGateMode;
  requestedMode: string;
  previewMode: typeof PREVIEW_MODE;
  gatePreviewOnly: true;
  dryRunOnly: true;
  attemptCreationGateEvaluated: true;
  canCreateAttemptNow: false;
  attemptCreationAllowedInThisPatch: false;
  auditRowsCreatedNow: false;
  auditRowsMutatedNow: false;
  providerNetworkCallAttempted: false;
  llmCallAttempted: false;
  contentMutationAttempted: false;
  bloggerWriteAttempted: false;
  targetSummary: AttemptReadbackSummary["targetSummary"];
  persistedApprovalSummary: AttemptReadbackSummary["persistedApprovalSummary"];
  executionGateSummary: AttemptReadbackSummary["executionGateSummary"];
  attemptCreationGatePreviewSummary: AttemptCreationGatePreviewSummary;
  currentSideEffectSummary: DailyContentDraftGenerationLlmDispatchAttemptCreationGatePreviewSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface AttemptCreationGatePreviewSummary {
  gateVersion: typeof GATE_VERSION;
  sourceReadbackPatchVersion: typeof SOURCE_READBACK_PATCH_VERSION;
  attemptCreationGateEvaluated: true;
  canCreateAttemptNow: false;
  attemptCreationWouldBeBlocked: true;
  attemptCreationAllowedInThisPatch: false;
  auditTablesExist: boolean;
  globalCounts: {
    attempts: number;
    events: number;
    artifacts: number;
  };
  targetScopedExistingAttempts: number;
  targetScopedExistingEvents: number;
  targetScopedExistingArtifacts: number;
  latestTargetAttempt: SafeDispatchAttemptReadback | null;
  duplicateIdempotencyCollisionDetected: false;
  idempotencyKeyRequired: true;
  idempotencyKeyPresentNow: false;
  rawIdempotencyKeyStoredNow: false;
  idempotencyKeyHashWouldBeStored: true;
  confirmationPhraseRequired: true;
  confirmationPhrasePresentNow: false;
  rawConfirmationPhraseStoredNow: false;
  confirmationPhraseHashWouldBeStored: true;
  providerHealthCheckSatisfiedNow: false;
  missingFeatureFlags: string[];
  creationBlockers: string[];
  futureAttemptFieldPlan: FutureAttemptFieldPlan;
  gateGroups: AttemptCreationGateGroup[];
  checks: AttemptCreationGateCheck[];
  nextSafePatchCandidate: "9F-2Z";
  nextSafePatchPurpose: string;
}

export interface FutureAttemptFieldPlan {
  attemptPurpose: "draft_generation_execution";
  attemptStatus: "not_created_preview_only";
  operatorApprovalIdFuturePopulated: boolean;
  idempotencyKeyHashFutureRequired: true;
  rawIdempotencyKeyStoredNow: false;
  rawConfirmationPhraseStoredNow: false;
  rawSecretStored: false;
  rawTokenStored: false;
  requestBodyStoredDefault: false;
  responseBodyStoredDefault: false;
  providerNetworkCallAttemptedInitial: false;
  llmCallAttemptedInitial: false;
  contentMutationAttemptedInitial: false;
  draftMutationAttemptedInitial: false;
  bloggerWriteAttemptedInitial: false;
}

export interface AttemptCreationGateGroup {
  key: string;
  label: string;
  status: Exclude<AttemptCreationGateCheckStatus, "not_applicable">;
  checks: AttemptCreationGateCheck[];
}

export interface AttemptCreationGateCheck {
  key: string;
  label: string;
  status: AttemptCreationGateCheckStatus;
  severity: AttemptCreationGateCheckSeverity;
  detail: string;
  blockerCode?: string;
  remediation?: string;
}

export interface DailyContentDraftGenerationLlmDispatchAttemptCreationGatePreviewSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  auditAttemptMutation: false;
  auditEventMutation: false;
  auditArtifactMutation: false;
  auditRowsCreated: false;
  attemptCreationGateEvaluated: true;
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

export async function buildDailyContentDraftGenerationLlmDispatchAttemptCreationGatePreviewResponse(
  rawRequest: DailyContentDraftGenerationLlmDispatchAttemptCreationGatePreviewRequest
): Promise<DailyContentDraftGenerationLlmDispatchAttemptCreationGatePreviewResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const [attemptReadback, dispatchGate] = await Promise.all([
    buildDailyContentDraftGenerationLlmDispatchAttemptReadbackResponse({
      mode: "preview",
      planId: request.planId,
      planItemId: request.planItemId,
      contentItemId: request.contentItemId
    }),
    buildDailyContentDraftGenerationLlmDispatchGatePreviewResponse({
      mode: "preview",
      planId: request.planId,
      planItemId: request.planItemId,
      contentItemId: request.contentItemId
    })
  ]);
  const attemptReadbackSummary = attemptReadback.draftGenerationLlmDispatchAttemptReadbackSummary;
  const dispatchGateSummary = dispatchGate.draftGenerationLlmDispatchGatePreviewSummary;
  const attemptCreationGatePreviewSummary = buildAttemptCreationGatePreviewSummary(attemptReadbackSummary, dispatchGateSummary);
  const blockingReasons = new Set<string>(attemptCreationGatePreviewSummary.creationBlockers);

  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_llm_dispatch_attempt_creation_gate_preview_is_preview_only");
  }

  const warnings = new Set<string>([
    "draft_generation_llm_dispatch_attempt_creation_gate_preview_only",
    "attempt_creation_disabled_by_patch_policy",
    "provider_call_disabled_by_patch_policy",
    "content_item_mutation_disabled"
  ]);
  const sideEffectSummary = buildSideEffectSummary();
  const summary: DailyContentDraftGenerationLlmDispatchAttemptCreationGatePreviewSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    previewMode: PREVIEW_MODE,
    gatePreviewOnly: true,
    dryRunOnly: true,
    attemptCreationGateEvaluated: true,
    canCreateAttemptNow: false,
    attemptCreationAllowedInThisPatch: false,
    auditRowsCreatedNow: false,
    auditRowsMutatedNow: false,
    providerNetworkCallAttempted: false,
    llmCallAttempted: false,
    contentMutationAttempted: false,
    bloggerWriteAttempted: false,
    targetSummary: attemptReadbackSummary.targetSummary,
    persistedApprovalSummary: attemptReadbackSummary.persistedApprovalSummary,
    executionGateSummary: {
      executionAllowed: false,
      finalDraftGenerationAllowed: false,
      remainingBlockers: attemptReadbackSummary.executionGateSummary.remainingBlockers,
      resolvedBlockers: attemptReadbackSummary.executionGateSummary.resolvedBlockers
    },
    attemptCreationGatePreviewSummary,
    currentSideEffectSummary: sideEffectSummary,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationLlmDispatchAttemptCreationGatePreviewSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmDispatchAttemptCreationGatePreviewRequest): {
  mode: AttemptCreationGateMode;
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

function buildAttemptCreationGatePreviewSummary(
  attemptReadback: AttemptReadbackSummary,
  dispatchGate: DispatchGateSummary
): AttemptCreationGatePreviewSummary {
  const readback = attemptReadback.dispatchAttemptReadbackSummary;
  const dispatch = dispatchGate.dispatchGatePreviewSummary;
  const futureAttemptFieldPlan: FutureAttemptFieldPlan = {
    attemptPurpose: "draft_generation_execution",
    attemptStatus: "not_created_preview_only",
    operatorApprovalIdFuturePopulated: attemptReadback.persistedApprovalSummary.operatorApprovalSatisfied,
    idempotencyKeyHashFutureRequired: true,
    rawIdempotencyKeyStoredNow: false,
    rawConfirmationPhraseStoredNow: false,
    rawSecretStored: false,
    rawTokenStored: false,
    requestBodyStoredDefault: false,
    responseBodyStoredDefault: false,
    providerNetworkCallAttemptedInitial: false,
    llmCallAttemptedInitial: false,
    contentMutationAttemptedInitial: false,
    draftMutationAttemptedInitial: false,
    bloggerWriteAttemptedInitial: false
  };
  const creationBlockers = buildCreationBlockers(dispatch);
  const gateGroups = buildGateGroups(attemptReadback, dispatchGate, futureAttemptFieldPlan);
  const checks = gateGroups.flatMap((group) => group.checks);

  return {
    gateVersion: GATE_VERSION,
    sourceReadbackPatchVersion: SOURCE_READBACK_PATCH_VERSION,
    attemptCreationGateEvaluated: true,
    canCreateAttemptNow: false,
    attemptCreationWouldBeBlocked: true,
    attemptCreationAllowedInThisPatch: false,
    auditTablesExist: readback.auditTablesExist,
    globalCounts: readback.globalCounts,
    targetScopedExistingAttempts: readback.targetScopedCounts.attempts,
    targetScopedExistingEvents: readback.targetScopedCounts.events,
    targetScopedExistingArtifacts: readback.targetScopedCounts.artifacts,
    latestTargetAttempt: readback.latestTargetAttempt,
    duplicateIdempotencyCollisionDetected: false,
    idempotencyKeyRequired: true,
    idempotencyKeyPresentNow: false,
    rawIdempotencyKeyStoredNow: false,
    idempotencyKeyHashWouldBeStored: true,
    confirmationPhraseRequired: true,
    confirmationPhrasePresentNow: false,
    rawConfirmationPhraseStoredNow: false,
    confirmationPhraseHashWouldBeStored: true,
    providerHealthCheckSatisfiedNow: dispatch.providerHealthCheckSatisfiedNow,
    missingFeatureFlags: dispatch.missingFeatureFlags,
    creationBlockers,
    futureAttemptFieldPlan,
    gateGroups,
    checks,
    nextSafePatchCandidate: "9F-2Z",
    nextSafePatchPurpose: "Gated LLM dispatch attempt creation persistence, no provider call/no content mutation"
  };
}

function buildCreationBlockers(dispatch: DispatchGateSummary["dispatchGatePreviewSummary"]) {
  return Array.from(
    new Set([
      "llm_execution_feature_flag_disabled",
      "content_mutation_feature_flag_disabled",
      "draft_generation_write_feature_flag_disabled",
      "confirmation_phrase_missing",
      "idempotency_key_missing",
      "provider_health_check_not_satisfied",
      "attempt_creation_disabled_by_patch_policy",
      ...dispatch.dispatchBlockers.filter((blocker) =>
        [
          "llm_execution_feature_flag_disabled",
          "content_mutation_feature_flag_disabled",
          "draft_generation_write_feature_flag_disabled",
          "confirmation_phrase_missing",
          "idempotency_key_missing",
          "provider_health_check_not_satisfied"
        ].includes(blocker)
      )
    ])
  );
}

function buildGateGroups(
  attemptReadback: AttemptReadbackSummary,
  dispatchGate: DispatchGateSummary,
  futureAttemptFieldPlan: FutureAttemptFieldPlan
): AttemptCreationGateGroup[] {
  const readback = attemptReadback.dispatchAttemptReadbackSummary;
  const dispatch = dispatchGate.dispatchGatePreviewSummary;
  const target = attemptReadback.targetSummary;

  return [
    group("target_gate", "Target gate", [
      check("linked_fixture_found", "Linked fixture found", target.linkedFixtureFound ? "pass" : "blocked", "high", "Target content fixture must exist.", "linked_content_fixture_not_found"),
      check(
        "linked_fixture_matches_plan_item",
        "Linked fixture matches plan item",
        target.linkedFixtureMatchesPlanItem ? "pass" : "blocked",
        "high",
        "Plan item must point at the requested content item.",
        "linked_content_item_mismatch"
      ),
      check("fixture_planned", "Fixture planned", target.fixtureStatus === "planned" ? "pass" : "blocked", "high", "Fixture must remain planned.", "content_item_not_planned"),
      check(
        "fixture_has_no_draft_markdown",
        "Fixture has no draft Markdown",
        target.fixtureHasNoDraftMarkdown ? "pass" : "blocked",
        "medium",
        "Draft Markdown must remain empty before generation.",
        "draft_markdown_already_exists"
      ),
      check(
        "fixture_has_no_draft_html",
        "Fixture has no draft HTML",
        target.fixtureHasNoDraftHtml ? "pass" : "blocked",
        "medium",
        "Draft HTML must remain empty before generation.",
        "draft_html_already_exists"
      )
    ]),
    group("audit_table_gate", "Audit table gate", [
      check("audit_tables_exist", "Audit tables exist", readback.auditTablesExist ? "pass" : "blocked", "high", "Dispatch audit tables must exist.", "dispatch_audit_tables_missing"),
      check("global_counts_readable", "Global counts readable", "pass", "medium", "Global attempt/event/artifact counts were read."),
      check("target_counts_readable", "Target counts readable", "pass", "medium", "Target-scoped attempt/event/artifact counts were read.")
    ]),
    group("readback_empty_state_gate", "Readback empty-state gate", [
      check(
        "latest_target_attempt_absent",
        "Latest target attempt absent",
        readback.latestTargetAttempt ? "blocked" : "pass",
        "high",
        readback.latestTargetAttempt ? "A previous target attempt exists." : "No target attempt exists yet.",
        "target_dispatch_attempt_already_exists"
      ),
      check(
        "target_attempt_count_zero",
        "Target attempt count zero",
        readback.targetScopedCounts.attempts === 0 ? "pass" : "blocked",
        "high",
        `Target-scoped attempts=${readback.targetScopedCounts.attempts}.`,
        "target_dispatch_attempt_already_exists"
      )
    ]),
    group("operator_approval_gate", "Operator approval gate", [
      check(
        "operator_approval_satisfied",
        "Operator approval satisfied",
        attemptReadback.persistedApprovalSummary.operatorApprovalSatisfied ? "pass" : "blocked",
        "high",
        "Persisted operator approval must be satisfied before a future attempt can be created.",
        "operator_approval_missing"
      )
    ]),
    group("dispatch_gate_precondition", "Dispatch gate precondition", [
      check("dispatch_allowed_now_false", "Dispatch allowed now false", dispatch.dispatchAllowedNow ? "blocked" : "pass", "high", "Dispatch remains blocked in this preview.", "dispatch_unexpectedly_allowed"),
      check(
        "dispatch_would_be_blocked",
        "Dispatch would be blocked",
        dispatch.dispatchWouldBeBlocked ? "pass" : "blocked",
        "high",
        "Future dispatch must still require a separate execution patch.",
        "dispatch_gate_not_blocked"
      )
    ]),
    group("request_envelope_gate", "Request envelope gate", [
      check(
        "request_envelope_ready_for_future_dispatch",
        "Request envelope ready for future dispatch",
        dispatch.requestEnvelopeReadyForFutureDispatch ? "pass" : "blocked",
        "medium",
        "Request envelope is previewed only and not stored or sent.",
        "request_envelope_not_ready"
      ),
      check("request_not_sent", "Request not sent", "pass", "high", "No request was sent to a provider.")
    ]),
    group("idempotency_gate", "Idempotency gate", [
      check("idempotency_key_required", "Idempotency key required", "blocked", "high", "A future persistence route must require an idempotency key.", "idempotency_key_missing"),
      check("raw_idempotency_not_stored", "Raw idempotency key not stored", "pass", "high", "Raw idempotency keys are not accepted, echoed, or stored now."),
      check("idempotency_hash_future", "Idempotency hash future", "pass", "medium", "Future persistence should store only idempotencyKeyHash.")
    ]),
    group("confirmation_gate", "Confirmation gate", [
      check("confirmation_phrase_required", "Confirmation phrase required", "blocked", "high", "A future persistence route must require an exact confirmation phrase.", "confirmation_phrase_missing"),
      check("raw_confirmation_not_stored", "Raw confirmation not stored", "pass", "high", "Raw confirmation phrase is not accepted, echoed, or stored now."),
      check("confirmation_hash_future", "Confirmation hash future", "pass", "medium", "Future persistence should store only a confirmation phrase hash if needed.")
    ]),
    group("feature_flag_gate", "Feature flag gate", [
      check("llm_execution_feature_flag", "LLM execution feature flag", dispatch.missingFeatureFlags.includes("BLOG_DAILY_CONTENT_DRAFT_GENERATION_LLM_ENABLED") ? "blocked" : "warn", "high", "LLM execution flag is required later.", "llm_execution_feature_flag_disabled"),
      check("content_mutation_feature_flag", "Content mutation feature flag", dispatch.missingFeatureFlags.includes("BLOG_DAILY_CONTENT_CONTENT_MUTATION_ENABLED") ? "blocked" : "warn", "high", "Content mutation flag is required later.", "content_mutation_feature_flag_disabled"),
      check("draft_generation_write_feature_flag", "Draft generation write feature flag", dispatch.missingFeatureFlags.includes("BLOG_DAILY_CONTENT_DRAFT_GENERATION_WRITE_ENABLED") ? "blocked" : "warn", "high", "Draft generation write flag is required later.", "draft_generation_write_feature_flag_disabled")
    ]),
    group("provider_health_gate", "Provider health gate", [
      check(
        "provider_health_check_satisfied",
        "Provider health check satisfied",
        dispatch.providerHealthCheckSatisfiedNow ? "warn" : "blocked",
        "high",
        "Provider health check is not satisfied for attempt creation yet.",
        "provider_health_check_not_satisfied"
      )
    ]),
    group("side_effect_policy_gate", "Side-effect policy gate", [
      check("attempt_creation_disabled", "Attempt creation disabled", "blocked", "high", "This patch evaluates only; it never creates an attempt row.", "attempt_creation_disabled_by_patch_policy"),
      check("audit_attempt_mutation_false", "Audit attempt mutation false", "pass", "high", "No audit attempt row is created."),
      check("audit_event_mutation_false", "Audit event mutation false", "pass", "high", "No audit event row is created."),
      check("audit_artifact_mutation_false", "Audit artifact mutation false", "pass", "high", "No audit artifact row is created."),
      check("provider_network_false", "Provider network false", "pass", "high", "No provider network call is attempted."),
      check("llm_call_false", "LLM call false", "pass", "high", "No LLM call is attempted."),
      check("content_mutation_false", "Content mutation false", "pass", "high", "No content item mutation is attempted."),
      check("future_attempt_field_plan_safe", "Future attempt field plan safe", futureAttemptFieldPlan.rawSecretStored ? "blocked" : "pass", "high", "Future field plan stores safe metadata only.")
    ])
  ];
}

function group(key: string, label: string, checks: AttemptCreationGateCheck[]): AttemptCreationGateGroup {
  return {
    key,
    label,
    status: summarizeGroupStatus(checks),
    checks
  };
}

function summarizeGroupStatus(checks: AttemptCreationGateCheck[]): Exclude<AttemptCreationGateCheckStatus, "not_applicable"> {
  if (checks.some((item) => item.status === "blocked")) {
    return "blocked";
  }
  if (checks.some((item) => item.status === "warn")) {
    return "warn";
  }
  return "pass";
}

function check(
  key: string,
  label: string,
  status: AttemptCreationGateCheckStatus,
  severity: AttemptCreationGateCheckSeverity,
  detail: string,
  blockerCode?: string,
  remediation?: string
): AttemptCreationGateCheck {
  return {
    key,
    label,
    status,
    severity,
    detail,
    ...(status === "blocked" && blockerCode ? { blockerCode } : {}),
    ...(remediation ? { remediation } : {})
  };
}

function buildSideEffectSummary(): DailyContentDraftGenerationLlmDispatchAttemptCreationGatePreviewSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    auditAttemptMutation: false,
    auditEventMutation: false,
    auditArtifactMutation: false,
    auditRowsCreated: false,
    attemptCreationGateEvaluated: true,
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
