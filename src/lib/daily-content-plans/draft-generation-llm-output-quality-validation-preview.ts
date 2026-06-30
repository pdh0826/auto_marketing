import {
  buildDailyContentDraftGenerationLlmDispatchResponseReadbackResponse,
  type DailyContentDraftGenerationLlmDispatchResponseReadbackResponse
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-response-readback";

const PATCH_VERSION = "9F-3K";
const PREVIEW_MODE = "read_only_draft_generation_llm_output_quality_validation_preview";
const VALIDATION_VERSION = "daily_content_draft_generation_llm_output_quality_validation_preview_v0";

type ValidationPreviewMode = "preview" | "blocked_non_preview";
type ResponseReadbackSummary =
  DailyContentDraftGenerationLlmDispatchResponseReadbackResponse["draftGenerationLlmDispatchResponseReadbackSummary"];
type ValidationCheckStatus = "pass" | "warn" | "blocked" | "not_applicable";

export interface DailyContentDraftGenerationLlmOutputQualityValidationPreviewRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationLlmOutputQualityValidationPreviewResponse
  extends DailyContentDraftGenerationLlmOutputQualityValidationPreviewSummary {
  checkedAt: string;
  draftGenerationLlmOutputQualityValidationPreviewSummary: DailyContentDraftGenerationLlmOutputQualityValidationPreviewSummary;
}

export interface DailyContentDraftGenerationLlmOutputQualityValidationPreviewSummary {
  patchVersion: "9F-3K";
  checked: true;
  mode: ValidationPreviewMode;
  requestedMode: string;
  previewMode: typeof PREVIEW_MODE;
  validationPreviewOnly: true;
  dryRunOnly: true;
  targetSummary: ResponseReadbackSummary["targetSummary"];
  persistedApprovalSummary: ResponseReadbackSummary["persistedApprovalSummary"];
  executionGateSummary: ResponseReadbackSummary["executionGateSummary"];
  outputQualityValidationSummary: OutputQualityValidationSummary;
  currentSideEffectSummary: DailyContentDraftGenerationLlmOutputQualityValidationPreviewSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface OutputQualityValidationSummary {
  validationVersion: typeof VALIDATION_VERSION;
  sourceReadbackPatchVersion: "9F-3J";
  latestAttemptId: string | null;
  latestAttemptStatus: string | null;
  responseHashPrefix: string | null;
  responseLength: number | null;
  candidateMarkdownAvailable: boolean;
  candidateMarkdownSource: "not_stored_by_9f3i_policy" | "future_redacted_candidate_artifact";
  canRunFullMarkdownValidation: boolean;
  validationReady: boolean;
  deterministicValidationOnly: true;
  llmJudgeUsed: false;
  checks: OutputQualityValidationCheck[];
  passCount: number;
  warnCount: number;
  blockedCount: number;
  notApplicableCount: number;
  rawPromptStoredOrReturned: false;
  rawResponseStoredOrReturned: false;
  fullCandidateStoredOrReturned: false;
  secretOrTokenStoredOrReturned: false;
  contentItemSnapshot: ResponseReadbackSummary["responseReadbackSummary"]["contentItemSnapshot"];
  nextSafePatchCandidate: "9F-3L";
  nextSafePatchPurpose: string;
}

export interface OutputQualityValidationCheck {
  key: string;
  label: string;
  status: ValidationCheckStatus;
  required: boolean;
  message: string;
}

export interface DailyContentDraftGenerationLlmOutputQualityValidationPreviewSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  auditAttemptMutation: false;
  auditEventMutation: false;
  auditArtifactMutation: false;
  auditRowsCreated: false;
  validationArtifactPersistedNow: false;
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

export async function buildDailyContentDraftGenerationLlmOutputQualityValidationPreviewResponse(
  rawRequest: DailyContentDraftGenerationLlmOutputQualityValidationPreviewRequest
): Promise<DailyContentDraftGenerationLlmOutputQualityValidationPreviewResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const responseReadback = await buildDailyContentDraftGenerationLlmDispatchResponseReadbackResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const readbackSummary = responseReadback.draftGenerationLlmDispatchResponseReadbackSummary;
  const outputQualityValidationSummary = buildOutputQualityValidationSummary(readbackSummary);
  const blockingReasons = new Set<string>();

  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_llm_output_quality_validation_preview_is_preview_only");
  }
  if (!readbackSummary.responseReadbackSummary.providerResponseReceived) {
    blockingReasons.add("draft_generation_llm_dispatch_response_not_received");
  }
  if (!readbackSummary.responseReadbackSummary.responseArtifactAlreadyPersisted) {
    blockingReasons.add("draft_generation_llm_response_artifact_missing");
  }
  if (!readbackSummary.responseReadbackSummary.latestLlmCallLogFound) {
    blockingReasons.add("draft_generation_llm_call_log_missing");
  }
  if (!outputQualityValidationSummary.candidateMarkdownAvailable) {
    blockingReasons.add("draft_generation_llm_candidate_markdown_not_stored");
  }
  if (!outputQualityValidationSummary.validationReady) {
    blockingReasons.add("draft_generation_llm_output_quality_validation_not_ready");
  }

  const warnings = new Set<string>([
    "draft_generation_llm_output_quality_validation_preview_only",
    "full_markdown_validation_requires_candidate_text_artifact",
    "llm_judge_disabled_by_patch_policy",
    "content_item_mutation_disabled",
    "blogger_write_disabled_by_patch_policy"
  ]);
  const sideEffectSummary = buildSideEffectSummary();
  const summary: DailyContentDraftGenerationLlmOutputQualityValidationPreviewSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    previewMode: PREVIEW_MODE,
    validationPreviewOnly: true,
    dryRunOnly: true,
    targetSummary: readbackSummary.targetSummary,
    persistedApprovalSummary: readbackSummary.persistedApprovalSummary,
    executionGateSummary: readbackSummary.executionGateSummary,
    outputQualityValidationSummary,
    currentSideEffectSummary: sideEffectSummary,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationLlmOutputQualityValidationPreviewSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmOutputQualityValidationPreviewRequest): {
  mode: ValidationPreviewMode;
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

function buildOutputQualityValidationSummary(readbackSummary: ResponseReadbackSummary): OutputQualityValidationSummary {
  const response = readbackSummary.responseReadbackSummary;
  const candidateMarkdownAvailable = false;
  const checks = buildChecks({ responseReceived: response.providerResponseReceived, candidateMarkdownAvailable });
  const passCount = checks.filter((check) => check.status === "pass").length;
  const warnCount = checks.filter((check) => check.status === "warn").length;
  const blockedCount = checks.filter((check) => check.status === "blocked").length;
  const notApplicableCount = checks.filter((check) => check.status === "not_applicable").length;

  return {
    validationVersion: VALIDATION_VERSION,
    sourceReadbackPatchVersion: "9F-3J",
    latestAttemptId: response.latestAttemptId,
    latestAttemptStatus: response.latestAttemptStatus,
    responseHashPrefix: response.responseArtifact?.artifactHashPrefix ?? response.responseEvent?.responseHashPrefix ?? response.latestLlmCallLog?.responseHashPrefix ?? null,
    responseLength: response.responseEvent?.responseLength ?? response.latestLlmCallLog?.responseLength ?? null,
    candidateMarkdownAvailable,
    candidateMarkdownSource: "not_stored_by_9f3i_policy",
    canRunFullMarkdownValidation: false,
    validationReady: candidateMarkdownAvailable && blockedCount === 0,
    deterministicValidationOnly: true,
    llmJudgeUsed: false,
    checks,
    passCount,
    warnCount,
    blockedCount,
    notApplicableCount,
    rawPromptStoredOrReturned: false,
    rawResponseStoredOrReturned: false,
    fullCandidateStoredOrReturned: false,
    secretOrTokenStoredOrReturned: false,
    contentItemSnapshot: response.contentItemSnapshot,
    nextSafePatchCandidate: "9F-3L",
    nextSafePatchPurpose: "Persist the blocked validation preview as an audit event/artifact without content mutation, or add an explicitly approved candidate text artifact policy first."
  };
}

function buildChecks(input: { responseReceived: boolean; candidateMarkdownAvailable: boolean }): OutputQualityValidationCheck[] {
  const candidateBlockedMessage = "Full Markdown candidate text is not stored by the 9F-3I policy, so this check cannot inspect generated content.";
  return [
    {
      key: "provider_response_metadata",
      label: "Provider response metadata exists",
      status: input.responseReceived ? "pass" : "blocked",
      required: true,
      message: input.responseReceived ? "Provider response metadata was found in safe audit readback." : "Provider response metadata is missing."
    },
    {
      key: "candidate_markdown_available",
      label: "Candidate Markdown available for static validation",
      status: input.candidateMarkdownAvailable ? "pass" : "blocked",
      required: true,
      message: input.candidateMarkdownAvailable ? "Candidate Markdown is available for deterministic validation." : candidateBlockedMessage
    },
    {
      key: "markdown_structure",
      label: "Markdown structure",
      status: input.candidateMarkdownAvailable ? "not_applicable" : "blocked",
      required: true,
      message: candidateBlockedMessage
    },
    {
      key: "korean_readability_heuristics",
      label: "Korean readability heuristics",
      status: input.candidateMarkdownAvailable ? "not_applicable" : "blocked",
      required: false,
      message: candidateBlockedMessage
    },
    {
      key: "seo_headings",
      label: "SEO headings",
      status: input.candidateMarkdownAvailable ? "not_applicable" : "blocked",
      required: true,
      message: candidateBlockedMessage
    },
    {
      key: "policy_forbidden_phrases",
      label: "Policy forbidden phrases",
      status: input.candidateMarkdownAvailable ? "not_applicable" : "blocked",
      required: true,
      message: candidateBlockedMessage
    },
    {
      key: "cta_faq_requirements",
      label: "CTA and FAQ requirements",
      status: input.candidateMarkdownAvailable ? "not_applicable" : "blocked",
      required: true,
      message: candidateBlockedMessage
    },
    {
      key: "blogger_compatibility",
      label: "Blogger compatibility",
      status: input.candidateMarkdownAvailable ? "not_applicable" : "blocked",
      required: true,
      message: candidateBlockedMessage
    },
    {
      key: "redaction_boundary",
      label: "Raw prompt/response/candidate redaction",
      status: "pass",
      required: true,
      message: "Preview returns metadata only and does not expose raw prompt, raw response, or full candidate text."
    }
  ];
}

function buildSideEffectSummary(): DailyContentDraftGenerationLlmOutputQualityValidationPreviewSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    auditAttemptMutation: false,
    auditEventMutation: false,
    auditArtifactMutation: false,
    auditRowsCreated: false,
    validationArtifactPersistedNow: false,
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
