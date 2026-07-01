import { prisma } from "@/lib/db/client";
import {
  buildDailyContentDraftMarkdownMutationGatePreviewResponse,
  type DailyContentDraftMarkdownMutationGatePreviewResponse
} from "@/lib/daily-content-plans/draft-markdown-mutation-gate-preview";

const PATCH_VERSION = "9F-3O-prep";
const PREVIEW_MODE = "read_only_draft_generation_candidate_text_artifact_policy";
const POLICY_VERSION = "daily_content_draft_generation_candidate_text_artifact_policy_v0";
const CANDIDATE_ARTIFACT_KIND = "llm_candidate_markdown_text";

type PolicyMode = "preview" | "blocked_non_preview";
type MutationPreviewSummary = DailyContentDraftMarkdownMutationGatePreviewResponse["draftMarkdownMutationGatePreviewSummary"];

export interface DailyContentDraftGenerationCandidateTextArtifactPolicyRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationCandidateTextArtifactPolicyResponse
  extends DailyContentDraftGenerationCandidateTextArtifactPolicySummary {
  checkedAt: string;
  draftGenerationCandidateTextArtifactPolicySummary: DailyContentDraftGenerationCandidateTextArtifactPolicySummary;
}

export interface DailyContentDraftGenerationCandidateTextArtifactPolicySummary {
  patchVersion: "9F-3O-prep";
  checked: true;
  mode: PolicyMode;
  requestedMode: string;
  previewMode: typeof PREVIEW_MODE;
  policyOnly: true;
  dryRunOnly: true;
  targetSummary: MutationPreviewSummary["targetSummary"];
  persistedApprovalSummary: MutationPreviewSummary["persistedApprovalSummary"];
  executionGateSummary: MutationPreviewSummary["executionGateSummary"];
  candidateTextArtifactPolicySummary: CandidateTextArtifactPolicySummary;
  currentSideEffectSummary: DailyContentDraftGenerationCandidateTextArtifactPolicySideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface CandidateTextArtifactPolicySummary {
  policyVersion: typeof POLICY_VERSION;
  latestAttemptId: string | null;
  requiredArtifactKind: typeof CANDIDATE_ARTIFACT_KIND;
  candidateTextArtifactFound: boolean;
  candidateTextArtifactId: string | null;
  candidateTextArtifactStorageMode: string | null;
  candidateTextArtifactRedactionStatus: string | null;
  candidateMarkdownAvailableForDraftPersistence: boolean;
  draftMarkdownMutationPreviewReady: boolean;
  currentDraftMarkdownLength: number | null;
  currentDraftHtmlLength: number | null;
  contentItemStatus: string | null;
  canProceedTo9F3O: boolean;
  policyBlockers: string[];
  recommendedNextPatch: "9F-3I-R1";
  recommendedNextPatchPurpose: string;
  allowedAcquisitionPaths: CandidateTextAcquisitionPath[];
  rawPromptStoredOrReturned: false;
  rawResponseStoredOrReturned: false;
  fullCandidateReturned: false;
  contentMutationAttempted: false;
}

export interface CandidateTextAcquisitionPath {
  key: "gated_redispatch_with_candidate_text_artifact" | "manual_candidate_text_import";
  recommended: boolean;
  requiresUserApproval: boolean;
  description: string;
  requiredGates: string[];
}

export interface DailyContentDraftGenerationCandidateTextArtifactPolicySideEffectSummary {
  dbRead: true;
  dbWrite: false;
  auditAttemptMutation: false;
  auditEventMutation: false;
  auditArtifactMutation: false;
  llmCall: false;
  llmCallLogMutation: false;
  contentItemMutation: false;
  draftMarkdownMutation: false;
  draftHtmlMutation: false;
  bloggerWrite: false;
  bloggerPublish: false;
  oauthReconnect: false;
  tokenRefresh: false;
  externalSend: false;
}

export async function buildDailyContentDraftGenerationCandidateTextArtifactPolicyResponse(
  rawRequest: DailyContentDraftGenerationCandidateTextArtifactPolicyRequest
): Promise<DailyContentDraftGenerationCandidateTextArtifactPolicyResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const mutationPreview = await buildDailyContentDraftMarkdownMutationGatePreviewResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const mutationSummary = mutationPreview.draftMarkdownMutationGatePreviewSummary;
  const candidateTextArtifactPolicySummary = await buildPolicySummary(mutationSummary);
  const blockingReasons = new Set<string>(candidateTextArtifactPolicySummary.policyBlockers);

  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_candidate_text_artifact_policy_is_preview_only");
  }

  const summary: DailyContentDraftGenerationCandidateTextArtifactPolicySummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    previewMode: PREVIEW_MODE,
    policyOnly: true,
    dryRunOnly: true,
    targetSummary: mutationSummary.targetSummary,
    persistedApprovalSummary: mutationSummary.persistedApprovalSummary,
    executionGateSummary: mutationSummary.executionGateSummary,
    candidateTextArtifactPolicySummary,
    currentSideEffectSummary: buildSideEffectSummary(),
    blockingReasons: Array.from(blockingReasons),
    warnings: [
      "candidate_text_artifact_policy_only",
      "candidate_text_not_reconstructed_from_hash_only_artifacts",
      "content_item_mutation_disabled",
      "blogger_write_disabled_by_patch_policy"
    ]
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationCandidateTextArtifactPolicySummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationCandidateTextArtifactPolicyRequest): {
  mode: PolicyMode;
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

async function buildPolicySummary(mutationSummary: MutationPreviewSummary): Promise<CandidateTextArtifactPolicySummary> {
  const mutation = mutationSummary.draftMarkdownMutationPreviewSummary;
  const candidateArtifact = mutation.latestAttemptId
    ? await prisma.blogDailyContentLlmDispatchArtifact.findFirst({
        where: {
          attemptId: mutation.latestAttemptId,
          artifactKind: CANDIDATE_ARTIFACT_KIND
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          artifactStorageMode: true,
          artifactRedactionStatus: true
        }
      })
    : null;
  const blockers = new Set<string>(mutation.mutationPreviewBlockers);

  if (!candidateArtifact) {
    blockers.add("candidate_text_artifact_missing");
  }
  if (!mutation.proposedDraftMarkdownAvailable) {
    blockers.add("draft_markdown_proposal_not_available");
  }
  if (!mutation.canPreviewDraftMarkdownMutation) {
    blockers.add("draft_markdown_mutation_preview_not_ready");
  }

  return {
    policyVersion: POLICY_VERSION,
    latestAttemptId: mutation.latestAttemptId,
    requiredArtifactKind: CANDIDATE_ARTIFACT_KIND,
    candidateTextArtifactFound: Boolean(candidateArtifact),
    candidateTextArtifactId: candidateArtifact?.id ?? null,
    candidateTextArtifactStorageMode: candidateArtifact?.artifactStorageMode ?? null,
    candidateTextArtifactRedactionStatus: candidateArtifact?.artifactRedactionStatus ?? null,
    candidateMarkdownAvailableForDraftPersistence: Boolean(candidateArtifact) && mutation.proposedDraftMarkdownAvailable,
    draftMarkdownMutationPreviewReady: mutation.canPreviewDraftMarkdownMutation,
    currentDraftMarkdownLength: mutation.currentDraftMarkdownLength,
    currentDraftHtmlLength: mutation.currentDraftHtmlLength,
    contentItemStatus: mutation.contentItemStatus,
    canProceedTo9F3O: blockers.size === 0,
    policyBlockers: Array.from(blockers),
    recommendedNextPatch: "9F-3I-R1",
    recommendedNextPatchPurpose: "Create an explicitly approved candidate Markdown text artifact before draftMarkdown persistence.",
    allowedAcquisitionPaths: buildAllowedAcquisitionPaths(),
    rawPromptStoredOrReturned: false,
    rawResponseStoredOrReturned: false,
    fullCandidateReturned: false,
    contentMutationAttempted: false
  };
}

function buildAllowedAcquisitionPaths(): CandidateTextAcquisitionPath[] {
  return [
    {
      key: "gated_redispatch_with_candidate_text_artifact",
      recommended: true,
      requiresUserApproval: true,
      description: "Run a new gated content-draft LLM dispatch and persist the generated Markdown as a controlled candidate artifact, not as content_items.draftMarkdown.",
      requiredGates: [
        "feature_flag",
        "exact_confirmation_phrase",
        "idempotency_key",
        "current_plan_lock_hash",
        "candidate_artifact_redaction_policy",
        "no_content_item_mutation"
      ]
    },
    {
      key: "manual_candidate_text_import",
      recommended: false,
      requiresUserApproval: true,
      description: "Allow an operator to paste reviewed Markdown into a controlled candidate artifact for later draftMarkdown persistence.",
      requiredGates: ["operator_review", "exact_confirmation_phrase", "idempotency_key", "no_content_item_mutation"]
    }
  ];
}

function buildSideEffectSummary(): DailyContentDraftGenerationCandidateTextArtifactPolicySideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    auditAttemptMutation: false,
    auditEventMutation: false,
    auditArtifactMutation: false,
    llmCall: false,
    llmCallLogMutation: false,
    contentItemMutation: false,
    draftMarkdownMutation: false,
    draftHtmlMutation: false,
    bloggerWrite: false,
    bloggerPublish: false,
    oauthReconnect: false,
    tokenRefresh: false,
    externalSend: false
  };
}
