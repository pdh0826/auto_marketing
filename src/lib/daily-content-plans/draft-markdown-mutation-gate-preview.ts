import {
  buildDailyContentDraftGenerationMarkdownCandidateAcceptanceGateResponse,
  type DailyContentDraftGenerationMarkdownCandidateAcceptanceGateResponse
} from "@/lib/daily-content-plans/draft-generation-markdown-candidate-acceptance-gate";
import { prisma } from "@/lib/db/client";

const PATCH_VERSION = "9F-3N";
const PREVIEW_MODE = "read_only_draft_markdown_mutation_gate_preview";
const PREVIEW_VERSION = "daily_content_draft_markdown_mutation_gate_preview_v0";
const CANDIDATE_ARTIFACT_KIND = "llm_candidate_markdown_text";
const CANDIDATE_STORAGE_MODE = "controlled_candidate_text";

type MutationPreviewMode = "preview" | "blocked_non_preview";
type AcceptanceSummary =
  DailyContentDraftGenerationMarkdownCandidateAcceptanceGateResponse["draftGenerationMarkdownCandidateAcceptanceGateSummary"];

export interface DailyContentDraftMarkdownMutationGatePreviewRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftMarkdownMutationGatePreviewResponse extends DailyContentDraftMarkdownMutationGatePreviewSummary {
  checkedAt: string;
  draftMarkdownMutationGatePreviewSummary: DailyContentDraftMarkdownMutationGatePreviewSummary;
}

export interface DailyContentDraftMarkdownMutationGatePreviewSummary {
  patchVersion: "9F-3N";
  checked: true;
  mode: MutationPreviewMode;
  requestedMode: string;
  previewMode: typeof PREVIEW_MODE;
  mutationPreviewOnly: true;
  dryRunOnly: true;
  targetSummary: AcceptanceSummary["targetSummary"];
  persistedApprovalSummary: AcceptanceSummary["persistedApprovalSummary"];
  executionGateSummary: AcceptanceSummary["executionGateSummary"];
  draftMarkdownMutationPreviewSummary: DraftMarkdownMutationPreviewSummary;
  currentSideEffectSummary: DailyContentDraftMarkdownMutationGatePreviewSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface DraftMarkdownMutationPreviewSummary {
  previewVersion: typeof PREVIEW_VERSION;
  latestAttemptId: string | null;
  canAcceptMarkdownCandidate: boolean;
  proposedDraftMarkdownAvailable: boolean;
  proposedDraftMarkdownLength: number | null;
  proposedDraftMarkdownHash: string | null;
  currentDraftMarkdownLength: number | null;
  currentDraftHtmlLength: number | null;
  contentItemStatus: string | null;
  canPreviewDraftMarkdownMutation: boolean;
  mutationPreviewBlockers: string[];
  rawPromptStoredOrReturned: false;
  rawResponseStoredOrReturned: false;
  fullCandidateStoredOrReturned: false;
  proposedDraftMarkdownReturned: false;
  contentMutationAttempted: false;
  nextSafePatchCandidate: "9F-3O";
  nextSafePatchPurpose: string;
}

export interface DailyContentDraftMarkdownMutationGatePreviewSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  contentItemMutation: false;
  draftMarkdownMutation: false;
  draftHtmlMutation: false;
  auditAttemptMutation: false;
  auditEventMutation: false;
  auditArtifactMutation: false;
  llmCall: false;
  llmCallLogMutation: false;
  bloggerWrite: false;
  bloggerPublish: false;
  oauthReconnect: false;
  tokenRefresh: false;
  externalSend: false;
}

export async function buildDailyContentDraftMarkdownMutationGatePreviewResponse(
  rawRequest: DailyContentDraftMarkdownMutationGatePreviewRequest
): Promise<DailyContentDraftMarkdownMutationGatePreviewResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const acceptance = await buildDailyContentDraftGenerationMarkdownCandidateAcceptanceGateResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const acceptanceSummary = acceptance.draftGenerationMarkdownCandidateAcceptanceGateSummary;
  const draftMarkdownMutationPreviewSummary = await buildMutationPreviewSummary(acceptanceSummary);
  const blockingReasons = new Set<string>(draftMarkdownMutationPreviewSummary.mutationPreviewBlockers);

  if (request.mode !== "preview") {
    blockingReasons.add("draft_markdown_mutation_gate_preview_is_preview_only");
  }

  const summary: DailyContentDraftMarkdownMutationGatePreviewSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    previewMode: PREVIEW_MODE,
    mutationPreviewOnly: true,
    dryRunOnly: true,
    targetSummary: acceptanceSummary.targetSummary,
    persistedApprovalSummary: acceptanceSummary.persistedApprovalSummary,
    executionGateSummary: acceptanceSummary.executionGateSummary,
    draftMarkdownMutationPreviewSummary,
    currentSideEffectSummary: buildSideEffectSummary(),
    blockingReasons: Array.from(blockingReasons),
    warnings: [
      "draft_markdown_mutation_preview_only",
      "content_item_mutation_disabled",
      "proposed_draft_markdown_body_not_returned",
      "blogger_write_disabled_by_patch_policy"
    ]
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftMarkdownMutationGatePreviewSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftMarkdownMutationGatePreviewRequest): {
  mode: MutationPreviewMode;
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

async function buildMutationPreviewSummary(acceptanceSummary: AcceptanceSummary): Promise<DraftMarkdownMutationPreviewSummary> {
  const acceptance = acceptanceSummary.markdownCandidateAcceptanceSummary;
  const candidateArtifact = acceptance.latestAttemptId
    ? await prisma.blogDailyContentLlmDispatchArtifact.findFirst({
        where: {
          attemptId: acceptance.latestAttemptId,
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
  const proposedDraftMarkdownLength = candidateArtifact?.artifactPreview?.length ?? null;
  const proposedDraftMarkdownHash = candidateArtifact?.artifactHash ?? null;
  const blockers = new Set<string>(acceptance.acceptanceBlockers);

  if (!acceptance.canAcceptMarkdownCandidate) {
    blockers.add("draft_markdown_mutation_candidate_not_accepted");
  }
  if (!acceptance.candidateMarkdownAvailable) {
    blockers.add("proposed_draft_markdown_not_available");
  }
  if (!candidateArtifact) {
    blockers.add("candidate_text_artifact_missing");
  }
  if (acceptance.contentItemStatus !== "planned") {
    blockers.add("content_item_status_not_planned");
  }

  return {
    previewVersion: PREVIEW_VERSION,
    latestAttemptId: acceptance.latestAttemptId,
    canAcceptMarkdownCandidate: acceptance.canAcceptMarkdownCandidate,
    proposedDraftMarkdownAvailable: acceptance.candidateMarkdownAvailable,
    proposedDraftMarkdownLength,
    proposedDraftMarkdownHash,
    currentDraftMarkdownLength: acceptance.draftMarkdownLength,
    currentDraftHtmlLength: acceptance.draftHtmlLength,
    contentItemStatus: acceptance.contentItemStatus,
    canPreviewDraftMarkdownMutation: blockers.size === 0,
    mutationPreviewBlockers: Array.from(blockers),
    rawPromptStoredOrReturned: false,
    rawResponseStoredOrReturned: false,
    fullCandidateStoredOrReturned: false,
    proposedDraftMarkdownReturned: false,
    contentMutationAttempted: false,
    nextSafePatchCandidate: "9F-3O",
    nextSafePatchPurpose: "Persist draftMarkdown only after explicit content mutation approval and candidate availability."
  };
}

function buildSideEffectSummary(): DailyContentDraftMarkdownMutationGatePreviewSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    contentItemMutation: false,
    draftMarkdownMutation: false,
    draftHtmlMutation: false,
    auditAttemptMutation: false,
    auditEventMutation: false,
    auditArtifactMutation: false,
    llmCall: false,
    llmCallLogMutation: false,
    bloggerWrite: false,
    bloggerPublish: false,
    oauthReconnect: false,
    tokenRefresh: false,
    externalSend: false
  };
}
