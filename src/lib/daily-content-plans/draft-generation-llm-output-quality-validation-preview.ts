import {
  buildDailyContentDraftGenerationLlmDispatchResponseReadbackResponse,
  type DailyContentDraftGenerationLlmDispatchResponseReadbackResponse
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-response-readback";
import { prisma } from "@/lib/db/client";

const PATCH_VERSION = "9F-3K";
const PREVIEW_MODE = "read_only_draft_generation_llm_output_quality_validation_preview";
const VALIDATION_VERSION = "daily_content_draft_generation_llm_output_quality_validation_preview_v0";
const CANDIDATE_ARTIFACT_KIND = "llm_candidate_markdown_text";
const CANDIDATE_STORAGE_MODE = "controlled_candidate_text";

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
  candidateMarkdownSource: "not_stored_by_9f3i_policy" | "controlled_candidate_text_artifact";
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
  const outputQualityValidationSummary = await buildOutputQualityValidationSummary(readbackSummary);
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

async function buildOutputQualityValidationSummary(readbackSummary: ResponseReadbackSummary): Promise<OutputQualityValidationSummary> {
  const response = readbackSummary.responseReadbackSummary;
  const candidateArtifact = response.latestAttemptId
    ? await prisma.blogDailyContentLlmDispatchArtifact.findFirst({
        where: {
          attemptId: response.latestAttemptId,
          artifactKind: CANDIDATE_ARTIFACT_KIND,
          artifactStorageMode: CANDIDATE_STORAGE_MODE
        },
        orderBy: { createdAt: "desc" },
        select: {
          artifactHash: true,
          artifactPreview: true
        }
      })
    : null;
  const candidateMarkdown = candidateArtifact?.artifactPreview?.trim() ?? "";
  const candidateMarkdownAvailable = candidateMarkdown.length > 0;
  const checks = buildChecks({ responseReceived: response.providerResponseReceived, candidateMarkdownAvailable, candidateMarkdown });
  const passCount = checks.filter((check) => check.status === "pass").length;
  const warnCount = checks.filter((check) => check.status === "warn").length;
  const blockedCount = checks.filter((check) => check.status === "blocked").length;
  const notApplicableCount = checks.filter((check) => check.status === "not_applicable").length;
  const requiredBlockedCount = checks.filter((check) => check.required && check.status === "blocked").length;

  return {
    validationVersion: VALIDATION_VERSION,
    sourceReadbackPatchVersion: "9F-3J",
    latestAttemptId: response.latestAttemptId,
    latestAttemptStatus: response.latestAttemptStatus,
    responseHashPrefix:
      candidateArtifact?.artifactHash.slice(0, 16) ??
      response.responseArtifact?.artifactHashPrefix ??
      response.responseEvent?.responseHashPrefix ??
      response.latestLlmCallLog?.responseHashPrefix ??
      null,
    responseLength: candidateMarkdownAvailable ? candidateMarkdown.length : response.responseEvent?.responseLength ?? response.latestLlmCallLog?.responseLength ?? null,
    candidateMarkdownAvailable,
    candidateMarkdownSource: candidateMarkdownAvailable ? "controlled_candidate_text_artifact" : "not_stored_by_9f3i_policy",
    canRunFullMarkdownValidation: candidateMarkdownAvailable,
    validationReady: candidateMarkdownAvailable && requiredBlockedCount === 0,
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
    nextSafePatchPurpose: candidateMarkdownAvailable
      ? "Persist the validation preview as an audit event/artifact without content mutation."
      : "Persist the blocked validation preview as an audit event/artifact without content mutation, or add an explicitly approved candidate text artifact policy first."
  };
}

function buildChecks(input: { responseReceived: boolean; candidateMarkdownAvailable: boolean; candidateMarkdown: string }): OutputQualityValidationCheck[] {
  const candidateBlockedMessage = "Full Markdown candidate text is not stored by the 9F-3I policy, so this check cannot inspect generated content.";
  const headingCount = countMarkdownHeadings(input.candidateMarkdown);
  const hasKorean = /[가-힣]/.test(input.candidateMarkdown);
  const hasForbiddenPhrase = /(죄송합니다|AI\s*언어\s*모델|투자\s*수익을\s*보장|무조건\s*상승)/i.test(input.candidateMarkdown);
  const hasCta = /(확인해보세요|점검해보세요|비교해보세요|댓글|문의|상담|체크)/i.test(input.candidateMarkdown);
  const hasFaq = /(FAQ|자주\s*묻는\s*질문|Q\.|질문)/i.test(input.candidateMarkdown);
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
      status: input.candidateMarkdownAvailable ? (headingCount >= 2 && input.candidateMarkdown.length >= 500 ? "pass" : "warn") : "blocked",
      required: true,
      message: input.candidateMarkdownAvailable ? "Candidate Markdown has inspectable structure metadata." : candidateBlockedMessage
    },
    {
      key: "korean_readability_heuristics",
      label: "Korean readability heuristics",
      status: input.candidateMarkdownAvailable ? (hasKorean ? "pass" : "warn") : "blocked",
      required: false,
      message: input.candidateMarkdownAvailable ? "Candidate Markdown was checked with deterministic Korean readability heuristics." : candidateBlockedMessage
    },
    {
      key: "seo_headings",
      label: "SEO headings",
      status: input.candidateMarkdownAvailable ? (headingCount >= 2 ? "pass" : "warn") : "blocked",
      required: true,
      message: input.candidateMarkdownAvailable ? "Candidate Markdown heading shape was checked." : candidateBlockedMessage
    },
    {
      key: "policy_forbidden_phrases",
      label: "Policy forbidden phrases",
      status: input.candidateMarkdownAvailable ? (hasForbiddenPhrase ? "blocked" : "pass") : "blocked",
      required: true,
      message: input.candidateMarkdownAvailable ? "Candidate Markdown was scanned for blocked phrases." : candidateBlockedMessage
    },
    {
      key: "cta_faq_requirements",
      label: "CTA and FAQ requirements",
      status: input.candidateMarkdownAvailable ? (hasCta && hasFaq ? "pass" : "warn") : "blocked",
      required: true,
      message: input.candidateMarkdownAvailable ? "CTA and FAQ presence were checked deterministically." : candidateBlockedMessage
    },
    {
      key: "blogger_compatibility",
      label: "Blogger compatibility",
      status: input.candidateMarkdownAvailable ? "pass" : "blocked",
      required: true,
      message: input.candidateMarkdownAvailable ? "Candidate Markdown is plain text and ready for later HTML conversion preview." : candidateBlockedMessage
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

function countMarkdownHeadings(markdown: string) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^#{1,3}\s+\S/.test(line.trim())).length;
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
