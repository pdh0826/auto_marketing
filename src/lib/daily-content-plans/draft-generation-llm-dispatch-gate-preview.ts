import {
  buildDailyContentDraftGenerationLlmRequestEnvelopePreviewResponse,
  type DailyContentDraftGenerationLlmRequestEnvelopePreviewResponse
} from "@/lib/daily-content-plans/draft-generation-llm-request-envelope-preview";

const PATCH_VERSION = "9F-2U";
const PREVIEW_MODE = "read_only_draft_generation_llm_dispatch_gate_preview";
const DISPATCH_GATE_VERSION = "daily_content_draft_generation_llm_dispatch_gate_v0";
const SOURCE_REQUEST_ENVELOPE_PATCH_VERSION = "9F-2T";

const REQUIRED_FEATURE_FLAGS = [
  "BLOG_DAILY_CONTENT_DRAFT_GENERATION_LLM_ENABLED",
  "BLOG_DAILY_CONTENT_CONTENT_MUTATION_ENABLED",
  "BLOG_DAILY_CONTENT_DRAFT_GENERATION_WRITE_ENABLED"
] as const;

type DispatchGatePreviewMode = "preview" | "blocked_non_preview";
type DispatchGateCheckStatus = "pass" | "blocked" | "warn" | "not_applicable";
type DispatchGateCheckSeverity = "info" | "low" | "medium" | "high";
type RequestEnvelopeSummary =
  DailyContentDraftGenerationLlmRequestEnvelopePreviewResponse["draftGenerationLlmRequestEnvelopePreviewSummary"];

export interface DailyContentDraftGenerationLlmDispatchGatePreviewRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationLlmDispatchGatePreviewResponse extends DailyContentDraftGenerationLlmDispatchGatePreviewSummary {
  checkedAt: string;
  draftGenerationLlmDispatchGatePreviewSummary: DailyContentDraftGenerationLlmDispatchGatePreviewSummary;
}

export interface DailyContentDraftGenerationLlmDispatchGatePreviewSummary {
  patchVersion: "9F-2U";
  checked: true;
  mode: DispatchGatePreviewMode;
  requestedMode: string;
  previewMode: typeof PREVIEW_MODE;
  dryRunOnly: true;
  dispatchGateEvaluatedForPreview: true;
  dispatchAllowedNow: false;
  requestEnvelopeStored: false;
  requestWouldBeSent: false;
  requestSentToProvider: false;
  llmCallAttempted: false;
  providerNetworkCallAttempted: false;
  providerHealthCheckAttempted: false;
  contentMutationAttempted: false;
  targetSummary: RequestEnvelopeSummary["targetSummary"];
  persistedApprovalSummary: RequestEnvelopeSummary["persistedApprovalSummary"];
  executionGateSummary: RequestEnvelopeSummary["executionGateSummary"];
  dispatchGatePreviewSummary: DispatchGatePreviewSummary;
  currentSideEffectSummary: DailyContentDraftGenerationLlmDispatchGatePreviewSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface DispatchGatePreviewSummary {
  sourceRequestEnvelopePatchVersion: typeof SOURCE_REQUEST_ENVELOPE_PATCH_VERSION;
  dispatchGateVersion: typeof DISPATCH_GATE_VERSION;
  dispatchGateEvaluatedForPreview: true;
  dispatchGatePassed: false;
  dispatchAllowedNow: false;
  dispatchWouldBeBlocked: true;
  requestEnvelopeReadyForFutureDispatch: boolean;
  providerRouteReadyForFutureDispatch: boolean;
  promptQualityReadyForFutureDispatch: boolean;
  operatorApprovalReadyForFutureDispatch: boolean;
  providerHealthCheckRequiredBeforeDispatch: true;
  providerHealthCheckSatisfiedNow: false;
  confirmationPhraseRequired: true;
  confirmationPhrasePresentNow: false;
  idempotencyKeyRequired: true;
  idempotencyKeyPresentNow: false;
  requiredFeatureFlags: string[];
  enabledFeatureFlags: string[];
  missingFeatureFlags: string[];
  totalChecks: number;
  passCount: number;
  blockedCount: number;
  warnCount: number;
  notApplicableCount: number;
  dispatchBlockers: string[];
  nextRequiredOperatorInputs: string[];
  nextRequiredFeatureFlags: string[];
  gateGroups: DispatchGateGroup[];
  checks: DispatchGateCheck[];
  futureDispatchPlan: {
    separateDispatchExecutionPatchRequired: true;
    dispatchExecutionRouteCreatedNow: false;
    providerCallAllowedInThisPatch: false;
    llmCompletionAllowedInThisPatch: false;
    contentMutationAllowedInThisPatch: false;
  };
  redactionSummary: {
    forbiddenPatternScanPassed: boolean;
    forbiddenPatternHitKeys: string[];
    secretValueExposed: false;
    requestEnvelopeHeaderValuesExposed: false;
    requestEnvelopeEndpointValueExposed: false;
  };
}

export interface DispatchGateGroup {
  key: string;
  label: string;
  status: Exclude<DispatchGateCheckStatus, "not_applicable">;
  checks: DispatchGateCheck[];
}

export interface DispatchGateCheck {
  key: string;
  label: string;
  status: DispatchGateCheckStatus;
  severity: DispatchGateCheckSeverity;
  detail: string;
  blockerCode?: string;
  remediation?: string;
}

export interface DailyContentDraftGenerationLlmDispatchGatePreviewSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  envRead: true;
  secretValueExposed: false;
  dispatchGateEvaluatedForPreview: true;
  requestEnvelopeBuiltForPreview: true;
  requestEnvelopeStored: false;
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

export async function buildDailyContentDraftGenerationLlmDispatchGatePreviewResponse(
  rawRequest: DailyContentDraftGenerationLlmDispatchGatePreviewRequest
): Promise<DailyContentDraftGenerationLlmDispatchGatePreviewResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const envelopeResponse = await buildDailyContentDraftGenerationLlmRequestEnvelopePreviewResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const envelopeSummary = envelopeResponse.draftGenerationLlmRequestEnvelopePreviewSummary;
  const dispatchGatePreviewSummary = buildDispatchGatePreviewSummary(envelopeSummary);
  const blockingReasons = new Set<string>(dispatchGatePreviewSummary.dispatchBlockers);

  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_llm_dispatch_gate_preview_is_preview_only");
  }

  const warnings = new Set<string>([
    "draft_generation_llm_dispatch_gate_preview_only",
    "dispatch_execution_route_not_created",
    "request_not_sent_to_provider",
    "llm_call_disabled_by_patch_policy",
    "content_item_mutation_disabled"
  ]);
  for (const warning of envelopeSummary.warnings) {
    warnings.add(warning);
  }
  if (!dispatchGatePreviewSummary.redactionSummary.forbiddenPatternScanPassed) {
    warnings.add("dispatch_gate_forbidden_pattern_detected");
  }

  const summary: DailyContentDraftGenerationLlmDispatchGatePreviewSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    previewMode: PREVIEW_MODE,
    dryRunOnly: true,
    dispatchGateEvaluatedForPreview: true,
    dispatchAllowedNow: false,
    requestEnvelopeStored: false,
    requestWouldBeSent: false,
    requestSentToProvider: false,
    llmCallAttempted: false,
    providerNetworkCallAttempted: false,
    providerHealthCheckAttempted: false,
    contentMutationAttempted: false,
    targetSummary: envelopeSummary.targetSummary,
    persistedApprovalSummary: envelopeSummary.persistedApprovalSummary,
    executionGateSummary: {
      executionAllowed: false,
      finalDraftGenerationAllowed: false,
      remainingBlockers: envelopeSummary.executionGateSummary.remainingBlockers,
      resolvedBlockers: envelopeSummary.executionGateSummary.resolvedBlockers
    },
    dispatchGatePreviewSummary,
    currentSideEffectSummary: buildSideEffectSummary(),
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationLlmDispatchGatePreviewSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmDispatchGatePreviewRequest): {
  mode: DispatchGatePreviewMode;
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

function buildDispatchGatePreviewSummary(envelopeSummary: RequestEnvelopeSummary): DispatchGatePreviewSummary {
  const enabledFeatureFlags = REQUIRED_FEATURE_FLAGS.filter((flag) => process.env[flag] === "true");
  const missingFeatureFlags = REQUIRED_FEATURE_FLAGS.filter((flag) => !enabledFeatureFlags.includes(flag));
  const envelope = envelopeSummary.requestEnvelopePreviewSummary;
  const requestEnvelopeReadyForFutureDispatch =
    envelope.requestEnvelopeBuiltForPreview &&
    !envelope.requestEnvelopeStored &&
    !envelope.requestWouldBeSent &&
    !envelope.headerValuesExposed &&
    !envelope.secretValuesExposed &&
    !envelope.endpointValueExposed &&
    envelope.redactionSummary.forbiddenPatternScanPassed;
  const providerRouteReadyForFutureDispatch = envelope.routeResolved && isSupportedProviderKind(envelope.providerKind);
  const promptQualityReadyForFutureDispatch = !envelope.dispatchBlockers.some((blocker) => blocker.startsWith("prompt_quality_"));
  const operatorApprovalReadyForFutureDispatch = envelopeSummary.persistedApprovalSummary.operatorApprovalSatisfied;
  const gateGroups = [
    buildTargetGate(envelopeSummary),
    buildApprovalGate(envelopeSummary),
    buildPromptGate(envelopeSummary, promptQualityReadyForFutureDispatch),
    buildRequestEnvelopeGate(envelopeSummary, requestEnvelopeReadyForFutureDispatch),
    buildProviderRouteGate(envelopeSummary, providerRouteReadyForFutureDispatch),
    buildProviderHealthGate(),
    buildOperatorExecutionGate(envelopeSummary),
    buildFeatureFlagGate(enabledFeatureFlags, missingFeatureFlags),
    buildConfirmationGate(),
    buildIdempotencyGate(),
    buildSideEffectPolicyGate()
  ];
  const checks = gateGroups.flatMap((group) => group.checks);
  const dispatchBlockers = Array.from(
    new Set([
      ...envelopeSummary.executionGateSummary.remainingBlockers,
      ...envelope.dispatchBlockers,
      ...checks.filter((check) => check.status === "blocked" && check.blockerCode).map((check) => check.blockerCode as string)
    ])
  );
  const forbiddenPatternHitKeys = scanForbiddenPatternKeys({
    gateGroups,
    checks,
    dispatchBlockers,
    nextRequiredOperatorInputs: ["confirmation_phrase", "idempotency_key"],
    nextRequiredFeatureFlags: missingFeatureFlags
  });

  return {
    sourceRequestEnvelopePatchVersion: SOURCE_REQUEST_ENVELOPE_PATCH_VERSION,
    dispatchGateVersion: DISPATCH_GATE_VERSION,
    dispatchGateEvaluatedForPreview: true,
    dispatchGatePassed: false,
    dispatchAllowedNow: false,
    dispatchWouldBeBlocked: true,
    requestEnvelopeReadyForFutureDispatch,
    providerRouteReadyForFutureDispatch,
    promptQualityReadyForFutureDispatch,
    operatorApprovalReadyForFutureDispatch,
    providerHealthCheckRequiredBeforeDispatch: true,
    providerHealthCheckSatisfiedNow: false,
    confirmationPhraseRequired: true,
    confirmationPhrasePresentNow: false,
    idempotencyKeyRequired: true,
    idempotencyKeyPresentNow: false,
    requiredFeatureFlags: [...REQUIRED_FEATURE_FLAGS],
    enabledFeatureFlags,
    missingFeatureFlags,
    totalChecks: checks.length,
    passCount: checks.filter((check) => check.status === "pass").length,
    blockedCount: checks.filter((check) => check.status === "blocked").length,
    warnCount: checks.filter((check) => check.status === "warn").length,
    notApplicableCount: checks.filter((check) => check.status === "not_applicable").length,
    dispatchBlockers,
    nextRequiredOperatorInputs: ["confirmation_phrase", "idempotency_key"],
    nextRequiredFeatureFlags: missingFeatureFlags,
    gateGroups,
    checks,
    futureDispatchPlan: {
      separateDispatchExecutionPatchRequired: true,
      dispatchExecutionRouteCreatedNow: false,
      providerCallAllowedInThisPatch: false,
      llmCompletionAllowedInThisPatch: false,
      contentMutationAllowedInThisPatch: false
    },
    redactionSummary: {
      forbiddenPatternScanPassed: forbiddenPatternHitKeys.length === 0 && envelope.redactionSummary.forbiddenPatternScanPassed,
      forbiddenPatternHitKeys,
      secretValueExposed: false,
      requestEnvelopeHeaderValuesExposed: false,
      requestEnvelopeEndpointValueExposed: false
    }
  };
}

function buildTargetGate(envelopeSummary: RequestEnvelopeSummary): DispatchGateGroup {
  const target = envelopeSummary.targetSummary;
  return buildGateGroup("target_gate", "Target fixture gate", [
    check(
      "linked_fixture_found",
      "Linked content fixture exists",
      target.linkedFixtureFound ? "pass" : "blocked",
      "high",
      target.linkedFixtureFound ? "Linked content fixture exists." : "Linked content fixture is missing.",
      "content_item_fixture_missing",
      "Create/link the deterministic content fixture before future dispatch."
    ),
    check(
      "linked_fixture_matches_plan_item",
      "Linked fixture matches plan item",
      target.linkedFixtureMatchesPlanItem ? "pass" : "blocked",
      "high",
      target.linkedFixtureMatchesPlanItem ? "The fixture matches the selected daily plan item." : "The fixture does not match the selected daily plan item.",
      "linked_content_item_mismatch",
      "Use the content item linked to the selected daily plan item."
    ),
    check(
      "fixture_status_planned",
      "Fixture status is planned",
      target.fixtureStatus === "planned" ? "pass" : "blocked",
      "high",
      target.fixtureStatus === "planned" ? "The fixture is still planned." : `Fixture status is ${target.fixtureStatus ?? "unknown"}.`,
      "content_item_not_planned",
      "Only planned fixtures are eligible for future draft generation dispatch."
    ),
    check(
      "fixture_has_no_draft_markdown",
      "No saved draft Markdown",
      target.fixtureHasNoDraftMarkdown ? "pass" : "blocked",
      "high",
      target.fixtureHasNoDraftMarkdown ? "No draft Markdown exists yet." : "Draft Markdown already exists.",
      "draft_markdown_already_exists",
      "Regeneration requires a separate approval policy."
    ),
    check(
      "fixture_has_no_draft_html",
      "No saved draft HTML",
      target.fixtureHasNoDraftHtml ? "pass" : "blocked",
      "medium",
      target.fixtureHasNoDraftHtml ? "No draft HTML exists yet." : "Draft HTML already exists.",
      "draft_html_already_exists",
      "Regeneration requires a separate approval policy."
    )
  ]);
}

function buildApprovalGate(envelopeSummary: RequestEnvelopeSummary): DispatchGateGroup {
  const approval = envelopeSummary.persistedApprovalSummary;
  return buildGateGroup("approval_gate", "Operator approval gate", [
    check(
      "approval_persisted",
      "Operator approval persisted",
      approval.operatorApprovalPersisted ? "pass" : "blocked",
      "high",
      approval.operatorApprovalPersisted ? "Operator approval row exists." : "Operator approval row is missing.",
      "operator_approval_missing",
      "Persist operator approval before future dispatch."
    ),
    check(
      "approval_satisfied",
      "Operator approval satisfied",
      approval.operatorApprovalSatisfied ? "pass" : "blocked",
      "high",
      approval.operatorApprovalSatisfied ? "Operator approval is satisfied." : "Operator approval is not satisfied.",
      "operator_approval_not_satisfied",
      "Approve the daily plan item for draft generation execution."
    )
  ]);
}

function buildPromptGate(envelopeSummary: RequestEnvelopeSummary, promptQualityReady: boolean): DispatchGateGroup {
  const envelope = envelopeSummary.requestEnvelopePreviewSummary;
  return buildGateGroup("prompt_gate", "Prompt quality gate", [
    check(
      "prompt_preview_available",
      "Prompt render preview available",
      envelope.sourcePromptPreviewPatchVersion === "9F-2R" ? "pass" : "blocked",
      "medium",
      "Prompt render preview metadata is available from 9F-2R.",
      "prompt_render_preview_missing",
      "Run the prompt render preview before future dispatch."
    ),
    check(
      "prompt_not_stored_or_sent",
      "Prompt not stored or sent",
      !envelopeSummary.requestEnvelopeStored && !envelopeSummary.requestWouldBeSent ? "pass" : "blocked",
      "high",
      "Prompt/request remains preview-only and has not been sent.",
      "prompt_or_request_sent_unexpectedly",
      "Stop and inspect request handling before dispatch."
    ),
    check(
      "prompt_quality_passed",
      "Prompt quality checklist passed",
      promptQualityReady ? "pass" : "blocked",
      "high",
      promptQualityReady ? "No prompt quality blockers are present." : "Prompt quality blockers are present.",
      "prompt_quality_gate_not_passed",
      "Resolve prompt quality blockers before future dispatch."
    )
  ]);
}

function buildRequestEnvelopeGate(envelopeSummary: RequestEnvelopeSummary, requestEnvelopeReady: boolean): DispatchGateGroup {
  const envelope = envelopeSummary.requestEnvelopePreviewSummary;
  return buildGateGroup("request_envelope_gate", "Request envelope gate", [
    check(
      "request_envelope_built_for_preview",
      "Request envelope built for preview",
      envelope.requestEnvelopeBuiltForPreview ? "pass" : "blocked",
      "medium",
      envelope.requestEnvelopeBuiltForPreview ? "The request envelope preview was built in memory." : "The request envelope preview was not built.",
      "request_envelope_preview_missing",
      "Run request envelope preview before future dispatch."
    ),
    check(
      "request_not_stored",
      "Request envelope not stored",
      !envelope.requestEnvelopeStored ? "pass" : "blocked",
      "high",
      "Request envelope storage is false.",
      "request_envelope_stored_unexpectedly",
      "Stop and inspect storage policy before dispatch."
    ),
    check(
      "request_not_sent",
      "Request would not be sent",
      !envelope.requestWouldBeSent ? "pass" : "blocked",
      "high",
      "Request send flag is false.",
      "request_would_be_sent_unexpectedly",
      "Stop and inspect dispatch policy before dispatch."
    ),
    check(
      "header_secret_endpoint_values_hidden",
      "Header, secret, endpoint values hidden",
      !envelope.headerValuesExposed && !envelope.secretValuesExposed && !envelope.endpointValueExposed ? "pass" : "blocked",
      "high",
      "Header values, secret values, and endpoint values are not exposed.",
      "request_envelope_value_exposure_detected",
      "Remove unsafe values from request envelope preview."
    ),
    check(
      "request_envelope_ready_summary",
      "Request envelope ready for future dispatch",
      requestEnvelopeReady ? "pass" : "blocked",
      "medium",
      requestEnvelopeReady ? "Preview-only envelope metadata is internally consistent." : "Request envelope preview is not ready for future dispatch.",
      "request_envelope_not_ready_for_future_dispatch",
      "Resolve envelope blockers before future dispatch."
    )
  ]);
}

function buildProviderRouteGate(envelopeSummary: RequestEnvelopeSummary, providerRouteReady: boolean): DispatchGateGroup {
  const envelope = envelopeSummary.requestEnvelopePreviewSummary;
  return buildGateGroup("provider_route_gate", "Provider route gate", [
    check(
      "provider_route_resolved",
      "Provider route resolved",
      envelope.routeResolved ? "pass" : "blocked",
      "high",
      envelope.routeResolved ? "Provider route and model are resolved." : "Provider route or model is unresolved.",
      "llm_provider_route_not_configured_for_draft_generation",
      "Configure the content draft provider route and model."
    ),
    check(
      "provider_kind_supported",
      "Provider kind supported",
      isSupportedProviderKind(envelope.providerKind) ? "pass" : "blocked",
      "medium",
      envelope.providerKind ? `Provider kind ${envelope.providerKind} is recognized.` : "Provider kind is unknown.",
      "llm_provider_kind_not_supported_for_dispatch",
      "Use a supported provider kind before future dispatch."
    ),
    check(
      "provider_route_ready",
      "Provider route ready for future dispatch",
      providerRouteReady ? "pass" : "blocked",
      "high",
      providerRouteReady ? "Provider route is ready for a future gated dispatch." : "Provider route is not ready for future dispatch.",
      "llm_provider_route_not_ready_for_future_dispatch",
      "Resolve provider/model readiness blockers."
    )
  ]);
}

function buildProviderHealthGate(): DispatchGateGroup {
  return buildGateGroup("provider_health_gate", "Provider health gate", [
    check(
      "provider_health_check_required",
      "Provider health check required",
      "blocked",
      "medium",
      "A provider health check pass is required before future dispatch and is not persisted as satisfied now.",
      "provider_health_check_not_satisfied",
      "Run the approved provider health-check flow before a later dispatch execution patch."
    ),
    check(
      "provider_health_not_checked_now",
      "Provider health not checked in this patch",
      "pass",
      "info",
      "This preview did not call the provider or health-check endpoint."
    )
  ]);
}

function buildOperatorExecutionGate(envelopeSummary: RequestEnvelopeSummary): DispatchGateGroup {
  return buildGateGroup("operator_execution_gate", "Final execution checklist gate", [
    check(
      "execution_allowed_false",
      "Execution remains disabled",
      !envelopeSummary.executionGateSummary.executionAllowed ? "pass" : "blocked",
      "high",
      "executionAllowed remains false in this preview.",
      "execution_allowed_unexpectedly_true",
      "Stop before dispatch if executionAllowed becomes true in a preview patch."
    ),
    check(
      "final_draft_generation_allowed_false",
      "Final draft generation remains disabled",
      !envelopeSummary.executionGateSummary.finalDraftGenerationAllowed ? "pass" : "blocked",
      "high",
      "finalDraftGenerationAllowed remains false in this preview.",
      "final_draft_generation_allowed_unexpectedly_true",
      "Stop before dispatch if finalDraftGenerationAllowed becomes true in a preview patch."
    )
  ]);
}

function buildFeatureFlagGate(enabledFeatureFlags: readonly string[], missingFeatureFlags: readonly string[]): DispatchGateGroup {
  return buildGateGroup("feature_flag_gate", "Feature flag gate", [
    checkFeatureFlag("llm_execution_feature_flag", REQUIRED_FEATURE_FLAGS[0], enabledFeatureFlags, "llm_execution_feature_flag_disabled"),
    checkFeatureFlag("content_mutation_feature_flag", REQUIRED_FEATURE_FLAGS[1], enabledFeatureFlags, "content_mutation_feature_flag_disabled"),
    checkFeatureFlag("draft_generation_write_feature_flag", REQUIRED_FEATURE_FLAGS[2], enabledFeatureFlags, "draft_generation_write_feature_flag_disabled"),
    check(
      "missing_feature_flags_summary",
      "Feature flags missing",
      missingFeatureFlags.length === 0 ? "warn" : "blocked",
      "high",
      missingFeatureFlags.length === 0
        ? "Required feature flags appear enabled, but this preview still will not dispatch."
        : `${missingFeatureFlags.length} required feature flag(s) are missing.`,
      missingFeatureFlags.length === 0 ? undefined : "draft_generation_dispatch_feature_flags_missing",
      "Enable flags only in a later approved execution patch."
    )
  ]);
}

function buildConfirmationGate(): DispatchGateGroup {
  return buildGateGroup("confirmation_gate", "Confirmation gate", [
    check(
      "confirmation_phrase_present",
      "Confirmation phrase present",
      "blocked",
      "high",
      "No confirmation phrase is accepted by this preview route.",
      "confirmation_phrase_missing",
      "A later dispatch execution route must require an exact confirmation phrase."
    )
  ]);
}

function buildIdempotencyGate(): DispatchGateGroup {
  return buildGateGroup("idempotency_gate", "Idempotency gate", [
    check(
      "idempotency_key_present",
      "Idempotency key present",
      "blocked",
      "high",
      "No idempotency key is accepted or stored by this preview route.",
      "idempotency_key_missing",
      "A later dispatch execution route must require and persist/check an idempotency key."
    )
  ]);
}

function buildSideEffectPolicyGate(): DispatchGateGroup {
  return buildGateGroup("side_effect_policy_gate", "Side-effect policy gate", [
    check("request_sent_to_provider_false", "Request sent to provider false", "pass", "high", "requestSentToProvider remains false."),
    check("provider_network_call_false", "Provider network call false", "pass", "high", "providerNetworkCall remains false."),
    check("llm_call_false", "LLM call false", "pass", "high", "llmCall remains false."),
    check("llm_log_mutation_false", "LLM log mutation false", "pass", "high", "llmCallLogMutation remains false."),
    check("content_mutation_false", "Content mutation false", "pass", "high", "contentItemMutation remains false."),
    check("blogger_write_false", "Blogger write false", "pass", "high", "bloggerWrite remains false.")
  ]);
}

function buildGateGroup(key: string, label: string, checks: DispatchGateCheck[]): DispatchGateGroup {
  return {
    key,
    label,
    status: summarizeGateGroupStatus(checks),
    checks
  };
}

function summarizeGateGroupStatus(checks: DispatchGateCheck[]): Exclude<DispatchGateCheckStatus, "not_applicable"> {
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
  status: DispatchGateCheckStatus,
  severity: DispatchGateCheckSeverity,
  detail: string,
  blockerCode?: string,
  remediation?: string
): DispatchGateCheck {
  return {
    key,
    label,
    status,
    severity,
    detail,
    ...(blockerCode && status === "blocked" ? { blockerCode } : {}),
    ...(remediation ? { remediation } : {})
  };
}

function checkFeatureFlag(key: string, flagName: string, enabledFeatureFlags: readonly string[], blockerCode: string) {
  const enabled = enabledFeatureFlags.includes(flagName);
  return check(
    key,
    flagName,
    enabled ? "warn" : "blocked",
    "high",
    enabled ? "Flag appears enabled, but this preview route still will not dispatch." : "Required dispatch feature flag is not enabled.",
    enabled ? undefined : blockerCode,
    "Feature flags should be enabled only for a later approved execution patch."
  );
}

function isSupportedProviderKind(providerKind: unknown) {
  return providerKind === "openai" || providerKind === "local" || providerKind === "external_http" || providerKind === "local_http" || providerKind === "cli";
}

function scanForbiddenPatternKeys(value: unknown) {
  const text = JSON.stringify(value);
  const patterns: Array<{ key: string; pattern: string }> = [
    { key: "openai_key_prefix", pattern: "sk-" },
    { key: "bearer_header_value", pattern: "Bearer " },
    { key: "oauth_refresh_token_literal", pattern: "refresh_token" },
    { key: "oauth_access_token_literal", pattern: "access_token" },
    { key: "openai_env_assignment", pattern: "OPENAI_API_KEY=" },
    { key: "generic_api_env_assignment", pattern: "API_KEY=" },
    { key: "password_env_assignment", pattern: "PASSWORD=" },
    { key: "secret_env_assignment", pattern: "SECRET=" },
    { key: "authorization_header_line", pattern: "Authorization:" }
  ];
  return patterns.filter((entry) => text.includes(entry.pattern)).map((entry) => entry.key);
}

function buildSideEffectSummary(): DailyContentDraftGenerationLlmDispatchGatePreviewSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    envRead: true,
    secretValueExposed: false,
    dispatchGateEvaluatedForPreview: true,
    requestEnvelopeBuiltForPreview: true,
    requestEnvelopeStored: false,
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
