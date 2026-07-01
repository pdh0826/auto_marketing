import { createHash } from "crypto";
import { prisma } from "@/lib/db/client";
import {
  buildDailyContentDraftMarkdownMutationGatePreviewResponse,
  type DailyContentDraftMarkdownMutationGatePreviewResponse
} from "@/lib/daily-content-plans/draft-markdown-mutation-gate-preview";

const PATCH_VERSION = "9F-3O";
const FEATURE_FLAG_NAME = "BLOG_DAILY_CONTENT_DRAFT_MARKDOWN_PERSISTENCE_ENABLED";
const REQUIRED_CONFIRMATION_PHRASE = "I_UNDERSTAND_THIS_PERSISTS_DRAFT_MARKDOWN_ONLY_WITHOUT_BLOGGER_WRITE";
const CANDIDATE_ARTIFACT_KIND = "llm_candidate_markdown_text";
const CANDIDATE_STORAGE_MODE = "controlled_candidate_text";

type PersistenceMode = "preview" | "apply" | "blocked_non_supported_mode";
type MutationGateSummary = DailyContentDraftMarkdownMutationGatePreviewResponse["draftMarkdownMutationGatePreviewSummary"];

export interface DailyContentDraftMarkdownPersistenceRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
  expectedCandidateHash?: unknown;
  confirmationPhrase?: unknown;
  idempotencyKey?: unknown;
}

export interface DailyContentDraftMarkdownPersistenceResponse extends DailyContentDraftMarkdownPersistenceSummary {
  checkedAt: string;
  draftMarkdownPersistenceSummary: DailyContentDraftMarkdownPersistenceSummary;
}

export interface DailyContentDraftMarkdownPersistenceSummary {
  patchVersion: "9F-3O";
  checked: true;
  mode: PersistenceMode;
  requestedMode: string;
  persistenceImplemented: true;
  persistenceAllowed: boolean;
  draftMarkdownPersistedNow: boolean;
  targetSummary: MutationGateSummary["targetSummary"];
  persistedApprovalSummary: MutationGateSummary["persistedApprovalSummary"];
  executionGateSummary: MutationGateSummary["executionGateSummary"];
  draftMarkdownPersistenceDetailSummary: DraftMarkdownPersistenceInnerSummary;
  currentSideEffectSummary: DraftMarkdownPersistenceSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface DraftMarkdownPersistenceInnerSummary {
  featureFlagName: typeof FEATURE_FLAG_NAME;
  featureFlagEnabled: boolean;
  confirmationPhraseRequired: true;
  confirmationPhraseMatched: boolean;
  idempotencyKeyRequired: true;
  idempotencyKeyPresent: boolean;
  rawConfirmationPhraseStored: false;
  rawIdempotencyKeyStored: false;
  expectedCandidateHashMatched: boolean;
  candidateArtifactId: string | null;
  candidateArtifactKind: typeof CANDIDATE_ARTIFACT_KIND;
  candidateArtifactStorageMode: typeof CANDIDATE_STORAGE_MODE;
  candidateMarkdownHash: string | null;
  candidateMarkdownLength: number | null;
  contentItemId: string | null;
  contentStatusBefore: string | null;
  draftMarkdownLengthBefore: number | null;
  draftHtmlLengthBefore: number | null;
  draftMarkdownLengthAfter: number | null;
  draftHtmlLengthAfter: number | null;
  appliedField: "draftMarkdown" | null;
  candidateMarkdownReturned: false;
  rawPromptStoredOrReturned: false;
  rawResponseStoredOrReturned: false;
  canPersistNow: boolean;
  persistenceBlockers: string[];
}

export interface DraftMarkdownPersistenceSideEffectSummary {
  dbRead: true;
  dbWrite: boolean;
  contentItemMutation: boolean;
  draftMarkdownMutation: boolean;
  draftHtmlMutation: false;
  statusMutation: false;
  qualityScoreMutation: false;
  publishedAtMutation: false;
  scheduledAtMutation: false;
  auditAttemptMutation: false;
  auditEventMutation: false;
  auditArtifactMutation: false;
  llmCall: false;
  llmCallLogMutation: false;
  bloggerWrite: false;
  bloggerDraftSave: false;
  bloggerPublish: false;
  scheduledPublish: false;
  oauthReconnect: false;
  tokenRefresh: false;
  externalSend: false;
}

export async function buildDailyContentDraftMarkdownPersistenceResponse(
  rawRequest: DailyContentDraftMarkdownPersistenceRequest
): Promise<DailyContentDraftMarkdownPersistenceResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const mutationGate = await buildDailyContentDraftMarkdownMutationGatePreviewResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const mutationSummary = mutationGate.draftMarkdownMutationGatePreviewSummary;
  const mutationPreview = mutationSummary.draftMarkdownMutationPreviewSummary;
  const [candidateArtifact, contentItem] = await Promise.all([
    readCandidateArtifact(mutationPreview.latestAttemptId),
    request.contentItemId
      ? prisma.contentItem.findUnique({
          where: { id: request.contentItemId },
          select: {
            id: true,
            status: true,
            draftMarkdown: true,
            draftHtml: true,
            qualityScore: true,
            publishedAt: true,
            scheduledAt: true
          }
        })
      : null
  ]);
  const candidateMarkdown = candidateArtifact?.artifactPreview?.trim() ?? "";
  const candidateHash = candidateMarkdown ? sha256(candidateMarkdown) : null;
  const featureFlagEnabled = process.env[FEATURE_FLAG_NAME] === "true";
  const confirmationPhraseMatched = request.confirmationPhrase === REQUIRED_CONFIRMATION_PHRASE;
  const idempotencyKeyPresent = Boolean(request.idempotencyKey);
  const expectedCandidateHashMatched = Boolean(request.expectedCandidateHash) && request.expectedCandidateHash === candidateHash;
  const blockers = buildBlockers({
    mode: request.mode,
    featureFlagEnabled,
    confirmationPhraseMatched,
    idempotencyKeyPresent,
    expectedCandidateHashMatched,
    mutationGateReady: mutationPreview.canPreviewDraftMarkdownMutation,
    candidateArtifactFound: Boolean(candidateArtifact),
    candidateMarkdown,
    candidateHashMatchedPreview: Boolean(candidateHash && mutationPreview.proposedDraftMarkdownHash === candidateHash),
    contentItem,
    requestContentItemId: request.contentItemId
  });
  const canPersistNow = request.mode === "apply" && blockers.length === 0;
  const beforeDraftMarkdownLength = contentItem?.draftMarkdown?.length ?? 0;
  const beforeDraftHtmlLength = contentItem?.draftHtml?.length ?? 0;
  let draftMarkdownPersistedNow = false;
  let afterDraftMarkdownLength: number | null = beforeDraftMarkdownLength;
  let afterDraftHtmlLength: number | null = beforeDraftHtmlLength;

  if (canPersistNow && contentItem && request.contentItemId) {
    const updated = await prisma.contentItem.update({
      where: { id: request.contentItemId },
      data: {
        draftMarkdown: candidateMarkdown
      },
      select: {
        draftMarkdown: true,
        draftHtml: true
      }
    });
    draftMarkdownPersistedNow = true;
    afterDraftMarkdownLength = updated.draftMarkdown?.length ?? 0;
    afterDraftHtmlLength = updated.draftHtml?.length ?? 0;
  }

  const responseBlockers = draftMarkdownPersistedNow ? [] : blockers;
  const summary: DailyContentDraftMarkdownPersistenceSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    persistenceImplemented: true,
    persistenceAllowed: canPersistNow,
    draftMarkdownPersistedNow,
    targetSummary: mutationSummary.targetSummary,
    persistedApprovalSummary: mutationSummary.persistedApprovalSummary,
    executionGateSummary: mutationSummary.executionGateSummary,
    draftMarkdownPersistenceDetailSummary: {
      featureFlagName: FEATURE_FLAG_NAME,
      featureFlagEnabled,
      confirmationPhraseRequired: true,
      confirmationPhraseMatched,
      idempotencyKeyRequired: true,
      idempotencyKeyPresent,
      rawConfirmationPhraseStored: false,
      rawIdempotencyKeyStored: false,
      expectedCandidateHashMatched,
      candidateArtifactId: candidateArtifact?.id ?? null,
      candidateArtifactKind: CANDIDATE_ARTIFACT_KIND,
      candidateArtifactStorageMode: CANDIDATE_STORAGE_MODE,
      candidateMarkdownHash: candidateHash,
      candidateMarkdownLength: candidateMarkdown ? candidateMarkdown.length : null,
      contentItemId: contentItem?.id ?? null,
      contentStatusBefore: contentItem?.status ?? null,
      draftMarkdownLengthBefore: beforeDraftMarkdownLength,
      draftHtmlLengthBefore: beforeDraftHtmlLength,
      draftMarkdownLengthAfter: afterDraftMarkdownLength,
      draftHtmlLengthAfter: afterDraftHtmlLength,
      appliedField: draftMarkdownPersistedNow ? "draftMarkdown" : null,
      candidateMarkdownReturned: false,
      rawPromptStoredOrReturned: false,
      rawResponseStoredOrReturned: false,
      canPersistNow,
      persistenceBlockers: responseBlockers
    },
    currentSideEffectSummary: buildSideEffectSummary(draftMarkdownPersistedNow),
    blockingReasons: responseBlockers,
    warnings: buildWarnings(request.mode, draftMarkdownPersistedNow)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftMarkdownPersistenceSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftMarkdownPersistenceRequest): {
  mode: PersistenceMode;
  requestedMode: string;
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
  expectedCandidateHash: string | null;
  confirmationPhrase: string | null;
  idempotencyKey: string | null;
} {
  const requestedMode = getString(rawRequest.mode) ?? "preview";
  return {
    mode: requestedMode === "preview" || requestedMode === "apply" ? requestedMode : "blocked_non_supported_mode",
    requestedMode,
    planId: getString(rawRequest.planId),
    planItemId: getString(rawRequest.planItemId),
    contentItemId: getString(rawRequest.contentItemId),
    expectedCandidateHash: getString(rawRequest.expectedCandidateHash),
    confirmationPhrase: getString(rawRequest.confirmationPhrase),
    idempotencyKey: getString(rawRequest.idempotencyKey)
  };
}

function buildBlockers(input: {
  mode: PersistenceMode;
  featureFlagEnabled: boolean;
  confirmationPhraseMatched: boolean;
  idempotencyKeyPresent: boolean;
  expectedCandidateHashMatched: boolean;
  mutationGateReady: boolean;
  candidateArtifactFound: boolean;
  candidateMarkdown: string;
  candidateHashMatchedPreview: boolean;
  contentItem: {
    id: string;
    status: string;
    draftMarkdown: string | null;
    draftHtml: string | null;
    qualityScore: number | null;
    publishedAt: Date | null;
    scheduledAt: Date | null;
  } | null;
  requestContentItemId: string | null;
}) {
  const blockers = new Set<string>();

  if (input.mode === "blocked_non_supported_mode") {
    blockers.add("draft_markdown_persistence_mode_not_allowed");
  }
  if (input.mode === "preview") {
    blockers.add("draft_markdown_persistence_not_requested");
  }
  if (input.mode === "apply" && !input.featureFlagEnabled) {
    blockers.add("draft_markdown_persistence_feature_flag_disabled");
  }
  if (input.mode === "apply" && !input.confirmationPhraseMatched) {
    blockers.add("confirmation_phrase_missing_or_mismatch");
  }
  if (input.mode === "apply" && !input.idempotencyKeyPresent) {
    blockers.add("idempotency_key_missing");
  }
  if (input.mode === "apply" && !input.expectedCandidateHashMatched) {
    blockers.add("expected_candidate_hash_missing_or_mismatch");
  }
  if (!input.mutationGateReady) {
    blockers.add("draft_markdown_mutation_gate_not_ready");
  }
  if (!input.candidateArtifactFound || !input.candidateMarkdown) {
    blockers.add("candidate_text_artifact_missing");
  }
  if (!input.candidateHashMatchedPreview) {
    blockers.add("candidate_hash_mismatch_with_preview");
  }
  if (!input.requestContentItemId || !input.contentItem) {
    blockers.add("content_item_not_found");
  }
  if (input.contentItem?.status !== "planned") {
    blockers.add("content_item_status_not_planned");
  }
  if ((input.contentItem?.draftMarkdown?.length ?? 0) > 0) {
    blockers.add("draft_markdown_already_present");
  }
  if ((input.contentItem?.draftHtml?.length ?? 0) > 0) {
    blockers.add("draft_html_already_present");
  }
  if (input.contentItem?.publishedAt) {
    blockers.add("published_at_already_present");
  }
  if (input.contentItem?.scheduledAt) {
    blockers.add("scheduled_at_already_present");
  }

  return Array.from(blockers);
}

async function readCandidateArtifact(attemptId: string | null) {
  if (!attemptId) {
    return null;
  }
  return prisma.blogDailyContentLlmDispatchArtifact.findFirst({
    where: {
      attemptId,
      artifactKind: CANDIDATE_ARTIFACT_KIND,
      artifactStorageMode: CANDIDATE_STORAGE_MODE
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      artifactHash: true,
      artifactPreview: true
    }
  });
}

function buildSideEffectSummary(persisted: boolean): DraftMarkdownPersistenceSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: persisted,
    contentItemMutation: persisted,
    draftMarkdownMutation: persisted,
    draftHtmlMutation: false,
    statusMutation: false,
    qualityScoreMutation: false,
    publishedAtMutation: false,
    scheduledAtMutation: false,
    auditAttemptMutation: false,
    auditEventMutation: false,
    auditArtifactMutation: false,
    llmCall: false,
    llmCallLogMutation: false,
    bloggerWrite: false,
    bloggerDraftSave: false,
    bloggerPublish: false,
    scheduledPublish: false,
    oauthReconnect: false,
    tokenRefresh: false,
    externalSend: false
  };
}

function buildWarnings(mode: PersistenceMode, persisted: boolean) {
  const warnings = new Set<string>([
    "draft_markdown_persistence_does_not_write_draft_html",
    "blogger_write_disabled_by_patch_policy",
    "candidate_markdown_body_not_returned"
  ]);
  if (mode === "preview") {
    warnings.add("draft_markdown_persistence_preview_only");
  }
  if (persisted) {
    warnings.add("content_item_draft_markdown_persisted_once");
  }
  return Array.from(warnings);
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
