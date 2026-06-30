import {
  buildDailyContentDraftGenerationLlmOutputQualityValidationPreviewResponse,
  type DailyContentDraftGenerationLlmOutputQualityValidationPreviewResponse
} from "@/lib/daily-content-plans/draft-generation-llm-output-quality-validation-preview";

const PATCH_VERSION = "9F-3M";
const PREVIEW_MODE = "read_only_draft_generation_markdown_candidate_acceptance_gate";
const GATE_VERSION = "daily_content_draft_generation_markdown_candidate_acceptance_gate_v0";

type AcceptanceGateMode = "preview" | "blocked_non_preview";
type ValidationPreviewSummary =
  DailyContentDraftGenerationLlmOutputQualityValidationPreviewResponse["draftGenerationLlmOutputQualityValidationPreviewSummary"];

export interface DailyContentDraftGenerationMarkdownCandidateAcceptanceGateRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationMarkdownCandidateAcceptanceGateResponse
  extends DailyContentDraftGenerationMarkdownCandidateAcceptanceGateSummary {
  checkedAt: string;
  draftGenerationMarkdownCandidateAcceptanceGateSummary: DailyContentDraftGenerationMarkdownCandidateAcceptanceGateSummary;
}

export interface DailyContentDraftGenerationMarkdownCandidateAcceptanceGateSummary {
  patchVersion: "9F-3M";
  checked: true;
  mode: AcceptanceGateMode;
  requestedMode: string;
  previewMode: typeof PREVIEW_MODE;
  acceptanceGateOnly: true;
  dryRunOnly: true;
  targetSummary: ValidationPreviewSummary["targetSummary"];
  persistedApprovalSummary: ValidationPreviewSummary["persistedApprovalSummary"];
  executionGateSummary: ValidationPreviewSummary["executionGateSummary"];
  markdownCandidateAcceptanceSummary: MarkdownCandidateAcceptanceSummary;
  currentSideEffectSummary: DailyContentDraftGenerationMarkdownCandidateAcceptanceGateSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface MarkdownCandidateAcceptanceSummary {
  gateVersion: typeof GATE_VERSION;
  latestAttemptId: string | null;
  responseHashPrefix: string | null;
  candidateMarkdownAvailable: boolean;
  validationReady: boolean;
  contentItemStatus: string | null;
  draftMarkdownLength: number | null;
  draftHtmlLength: number | null;
  canAcceptMarkdownCandidate: boolean;
  acceptanceBlockers: string[];
  nextSafePatchCandidate: "9F-3N";
  nextSafePatchPurpose: string;
  rawPromptStoredOrReturned: false;
  rawResponseStoredOrReturned: false;
  fullCandidateStoredOrReturned: false;
  secretOrTokenStoredOrReturned: false;
}

export interface DailyContentDraftGenerationMarkdownCandidateAcceptanceGateSideEffectSummary {
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

export async function buildDailyContentDraftGenerationMarkdownCandidateAcceptanceGateResponse(
  rawRequest: DailyContentDraftGenerationMarkdownCandidateAcceptanceGateRequest
): Promise<DailyContentDraftGenerationMarkdownCandidateAcceptanceGateResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const validationPreview = await buildDailyContentDraftGenerationLlmOutputQualityValidationPreviewResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const validationSummary = validationPreview.draftGenerationLlmOutputQualityValidationPreviewSummary;
  const acceptanceSummary = buildAcceptanceSummary(validationSummary);
  const blockingReasons = new Set<string>(acceptanceSummary.acceptanceBlockers);

  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_markdown_candidate_acceptance_gate_is_preview_only");
  }

  const warnings = new Set<string>([
    "markdown_candidate_acceptance_gate_preview_only",
    "content_item_mutation_disabled",
    "draft_markdown_persistence_deferred_to_9f3o",
    "blogger_write_disabled_by_patch_policy"
  ]);
  const sideEffectSummary = buildSideEffectSummary();
  const summary: DailyContentDraftGenerationMarkdownCandidateAcceptanceGateSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    previewMode: PREVIEW_MODE,
    acceptanceGateOnly: true,
    dryRunOnly: true,
    targetSummary: validationSummary.targetSummary,
    persistedApprovalSummary: validationSummary.persistedApprovalSummary,
    executionGateSummary: validationSummary.executionGateSummary,
    markdownCandidateAcceptanceSummary: acceptanceSummary,
    currentSideEffectSummary: sideEffectSummary,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationMarkdownCandidateAcceptanceGateSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationMarkdownCandidateAcceptanceGateRequest): {
  mode: AcceptanceGateMode;
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

function buildAcceptanceSummary(validationSummary: ValidationPreviewSummary): MarkdownCandidateAcceptanceSummary {
  const validation = validationSummary.outputQualityValidationSummary;
  const contentSnapshot = validation.contentItemSnapshot;
  const blockers = new Set<string>();

  if (!validation.latestAttemptId) {
    blockers.add("draft_generation_llm_dispatch_attempt_missing");
  }
  if (!validation.candidateMarkdownAvailable) {
    blockers.add("draft_generation_markdown_candidate_not_available");
  }
  if (!validation.validationReady) {
    blockers.add("draft_generation_output_validation_not_ready");
  }
  if (contentSnapshot?.status !== "planned") {
    blockers.add("content_item_status_not_planned");
  }
  if ((contentSnapshot?.draftMarkdownLength ?? 0) > 0) {
    blockers.add("content_item_draft_markdown_already_present");
  }

  return {
    gateVersion: GATE_VERSION,
    latestAttemptId: validation.latestAttemptId,
    responseHashPrefix: validation.responseHashPrefix,
    candidateMarkdownAvailable: validation.candidateMarkdownAvailable,
    validationReady: validation.validationReady,
    contentItemStatus: contentSnapshot?.status ?? null,
    draftMarkdownLength: contentSnapshot?.draftMarkdownLength ?? null,
    draftHtmlLength: contentSnapshot?.draftHtmlLength ?? null,
    canAcceptMarkdownCandidate: blockers.size === 0,
    acceptanceBlockers: Array.from(blockers),
    nextSafePatchCandidate: "9F-3N",
    nextSafePatchPurpose: "Preview the exact draftMarkdown mutation candidate before any content_items write.",
    rawPromptStoredOrReturned: false,
    rawResponseStoredOrReturned: false,
    fullCandidateStoredOrReturned: false,
    secretOrTokenStoredOrReturned: false
  };
}

function buildSideEffectSummary(): DailyContentDraftGenerationMarkdownCandidateAcceptanceGateSideEffectSummary {
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
