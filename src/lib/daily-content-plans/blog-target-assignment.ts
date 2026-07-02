import { prisma } from "@/lib/db/client";
import { buildDailyContentDraftPayloadBlockerDiagnosisResponse } from "@/lib/daily-content-plans/draft-payload-blocker-diagnosis";

const PATCH_VERSION = "9F-3R-FIX4";
const FEATURE_FLAG_NAME = "BLOG_DAILY_CONTENT_BLOG_TARGET_ASSIGNMENT_ENABLED";
const REQUIRED_CONFIRMATION_PHRASE = "I_UNDERSTAND_THIS_LINKS_DAILY_CONTENT_ITEM_TO_BLOG_PROFILE_ONLY_WITHOUT_BLOGGER_WRITE";

type AssignmentMode = "preview" | "apply" | "blocked_non_supported_mode";

export interface DailyContentBlogTargetAssignmentRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
  expectedCurrentBlogId?: unknown;
  expectedDraftMarkdownHash?: unknown;
  expectedDraftHtmlHash?: unknown;
  targetBlogId?: unknown;
  expectedBloggerConnectionId?: unknown;
  expectedBloggerBlogId?: unknown;
  confirmationPhrase?: unknown;
  idempotencyKey?: unknown;
}

export interface DailyContentBlogTargetAssignmentResponse extends DailyContentBlogTargetAssignmentSummary {
  checkedAt: string;
  blogTargetAssignmentSummary: DailyContentBlogTargetAssignmentSummary;
}

export interface DailyContentBlogTargetAssignmentSummary {
  patchVersion: "9F-3R-FIX4";
  checked: true;
  mode: AssignmentMode;
  requestedMode: string;
  assignmentImplemented: true;
  assignmentAllowed: boolean;
  blogTargetAssignedNow: boolean;
  assignmentDetailSummary: BlogTargetAssignmentDetailSummary;
  diagnosisSummary: {
    recommendedNextPatch: string;
    proposedBlogId: string | null;
    proposedBlogName: string | null;
    proposedBloggerConnectionId: string | null;
    proposedBloggerBlogId: string | null;
  };
  currentSideEffectSummary: BlogTargetAssignmentSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface BlogTargetAssignmentDetailSummary {
  featureFlagName: typeof FEATURE_FLAG_NAME;
  featureFlagEnabled: boolean;
  confirmationPhraseRequired: true;
  confirmationPhraseMatched: boolean;
  idempotencyKeyRequired: true;
  idempotencyKeyPresent: boolean;
  rawConfirmationPhraseStored: false;
  rawIdempotencyKeyStored: false;
  contentItemId: string | null;
  contentStatusBefore: string | null;
  currentBlogIdBefore: string | null;
  currentBlogIdAfter: string | null;
  expectedCurrentBlogIdMatched: boolean;
  draftMarkdownHashMatched: boolean;
  draftHtmlHashMatched: boolean;
  targetBlogIdMatchedDiagnosis: boolean;
  targetBlogId: string | null;
  targetBlogName: string | null;
  targetBlogStatus: string | null;
  targetBlogHasConnectedVerifiedBloggerConnection: boolean;
  expectedBloggerConnectionIdMatched: boolean;
  expectedBloggerBlogIdMatched: boolean;
  appliedField: "content_items.blogId" | null;
  draftMarkdownLengthBefore: number | null;
  draftHtmlLengthBefore: number | null;
  draftMarkdownHashBefore: string | null;
  draftHtmlHashBefore: string | null;
  canAssignNow: boolean;
  assignmentBlockers: string[];
  fullDraftMarkdownReturned: false;
  fullDraftHtmlReturned: false;
  tokenOrSecretReturned: false;
}

export interface BlogTargetAssignmentSideEffectSummary {
  dbRead: true;
  dbWrite: boolean;
  contentItemMutation: boolean;
  blogIdMutation: boolean;
  draftMarkdownMutation: false;
  draftHtmlMutation: false;
  blogProfileMutation: false;
  bloggerConnectionMutation: false;
  statusMutation: false;
  qualityScoreMutation: false;
  publishedAtMutation: false;
  scheduledAtMutation: false;
  auditAttemptMutation: false;
  auditEventMutation: false;
  auditArtifactMutation: false;
  llmCall: false;
  llmCallLogMutation: false;
  bloggerRead: false;
  bloggerWrite: false;
  bloggerDraftSave: false;
  bloggerPublish: false;
  scheduledPublish: false;
  oauthReconnect: false;
  tokenRefresh: false;
  externalSend: false;
}

export async function buildDailyContentBlogTargetAssignmentResponse(
  rawRequest: DailyContentBlogTargetAssignmentRequest
): Promise<DailyContentBlogTargetAssignmentResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const diagnosis = await buildDailyContentDraftPayloadBlockerDiagnosisResponse({
    mode: "diagnose",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const diagnosisSummary = diagnosis.draftPayloadBlockerDiagnosisSummary;
  const proposed = diagnosisSummary.nextActionSummary.suggestedMutationPreview;
  const [contentItem, targetBlog] = await Promise.all([
    request.contentItemId
      ? prisma.contentItem.findUnique({
          where: { id: request.contentItemId },
          select: {
            id: true,
            status: true,
            blogId: true,
            draftMarkdown: true,
            draftHtml: true,
            qualityScore: true,
            publishedAt: true,
            scheduledAt: true
          }
        })
      : null,
    request.targetBlogId
      ? prisma.blog.findUnique({
          where: { id: request.targetBlogId },
          select: {
            id: true,
            name: true,
            status: true,
            bloggerConnections: {
              where: {
                id: request.expectedBloggerConnectionId ?? undefined
              },
              select: {
                id: true,
                status: true,
                bloggerBlogId: true,
                bloggerBlogName: true,
                bloggerBlogVerifiedAt: true
              }
            }
          }
        })
      : null
  ]);
  const currentBlogId = contentItem?.blogId ?? null;
  const draftMarkdownHash = diagnosisSummary.targetSummary.draftMarkdownHash;
  const draftHtmlHash = diagnosisSummary.targetSummary.draftHtmlHash;
  const targetConnection = targetBlog?.bloggerConnections[0] ?? null;
  const featureFlagEnabled = process.env[FEATURE_FLAG_NAME] === "true";
  const confirmationPhraseMatched = request.confirmationPhrase === REQUIRED_CONFIRMATION_PHRASE;
  const idempotencyKeyPresent = Boolean(request.idempotencyKey);
  const expectedCurrentBlogIdMatched = request.expectedCurrentBlogId === currentBlogId;
  const draftMarkdownHashMatched = Boolean(request.expectedDraftMarkdownHash) && request.expectedDraftMarkdownHash === draftMarkdownHash;
  const draftHtmlHashMatched = Boolean(request.expectedDraftHtmlHash) && request.expectedDraftHtmlHash === draftHtmlHash;
  const targetBlogIdMatchedDiagnosis = Boolean(request.targetBlogId) && request.targetBlogId === proposed.proposedBlogId;
  const targetBlogHasConnectedVerifiedBloggerConnection = Boolean(
    targetConnection?.status === "connected" && targetConnection.bloggerBlogId && targetConnection.bloggerBlogVerifiedAt
  );
  const expectedBloggerConnectionIdMatched =
    Boolean(request.expectedBloggerConnectionId) && request.expectedBloggerConnectionId === proposed.proposedBloggerConnectionId && request.expectedBloggerConnectionId === targetConnection?.id;
  const expectedBloggerBlogIdMatched =
    Boolean(request.expectedBloggerBlogId) && request.expectedBloggerBlogId === proposed.proposedBloggerBlogId && request.expectedBloggerBlogId === targetConnection?.bloggerBlogId;
  const blockers = buildBlockers({
    mode: request.mode,
    featureFlagEnabled,
    confirmationPhraseMatched,
    idempotencyKeyPresent,
    contentItem,
    expectedCurrentBlogIdMatched,
    draftMarkdownHashMatched,
    draftHtmlHashMatched,
    targetBlog,
    targetBlogIdMatchedDiagnosis,
    targetBlogHasConnectedVerifiedBloggerConnection,
    expectedBloggerConnectionIdMatched,
    expectedBloggerBlogIdMatched,
    diagnosisReady: diagnosisSummary.nextActionSummary.recommendedNextPatch === "9F-3R-FIX4"
  });
  const canAssignNow = request.mode === "apply" && blockers.length === 0;
  let blogTargetAssignedNow = false;
  let currentBlogIdAfter = currentBlogId;

  if (canAssignNow && request.contentItemId && request.targetBlogId) {
    const updated = await prisma.contentItem.update({
      where: { id: request.contentItemId },
      data: { blogId: request.targetBlogId },
      select: { blogId: true }
    });
    blogTargetAssignedNow = true;
    currentBlogIdAfter = updated.blogId;
  }

  const responseBlockers = blogTargetAssignedNow ? [] : blockers;
  const summary: DailyContentBlogTargetAssignmentSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    assignmentImplemented: true,
    assignmentAllowed: canAssignNow,
    blogTargetAssignedNow,
    assignmentDetailSummary: {
      featureFlagName: FEATURE_FLAG_NAME,
      featureFlagEnabled,
      confirmationPhraseRequired: true,
      confirmationPhraseMatched,
      idempotencyKeyRequired: true,
      idempotencyKeyPresent,
      rawConfirmationPhraseStored: false,
      rawIdempotencyKeyStored: false,
      contentItemId: contentItem?.id ?? null,
      contentStatusBefore: contentItem?.status ?? null,
      currentBlogIdBefore: currentBlogId,
      currentBlogIdAfter,
      expectedCurrentBlogIdMatched,
      draftMarkdownHashMatched,
      draftHtmlHashMatched,
      targetBlogIdMatchedDiagnosis,
      targetBlogId: targetBlog?.id ?? null,
      targetBlogName: targetBlog?.name ?? null,
      targetBlogStatus: targetBlog?.status ?? null,
      targetBlogHasConnectedVerifiedBloggerConnection,
      expectedBloggerConnectionIdMatched,
      expectedBloggerBlogIdMatched,
      appliedField: blogTargetAssignedNow ? "content_items.blogId" : null,
      draftMarkdownLengthBefore: contentItem?.draftMarkdown?.length ?? null,
      draftHtmlLengthBefore: contentItem?.draftHtml?.length ?? null,
      draftMarkdownHashBefore: draftMarkdownHash,
      draftHtmlHashBefore: draftHtmlHash,
      canAssignNow,
      assignmentBlockers: responseBlockers,
      fullDraftMarkdownReturned: false,
      fullDraftHtmlReturned: false,
      tokenOrSecretReturned: false
    },
    diagnosisSummary: {
      recommendedNextPatch: diagnosisSummary.nextActionSummary.recommendedNextPatch,
      proposedBlogId: proposed.proposedBlogId,
      proposedBlogName: proposed.proposedBlogName,
      proposedBloggerConnectionId: proposed.proposedBloggerConnectionId,
      proposedBloggerBlogId: proposed.proposedBloggerBlogId
    },
    currentSideEffectSummary: buildSideEffectSummary(blogTargetAssignedNow),
    blockingReasons: responseBlockers,
    warnings: buildWarnings(request.mode, blogTargetAssignedNow)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    blogTargetAssignmentSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentBlogTargetAssignmentRequest): {
  mode: AssignmentMode;
  requestedMode: string;
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
  expectedCurrentBlogId: string | null;
  expectedDraftMarkdownHash: string | null;
  expectedDraftHtmlHash: string | null;
  targetBlogId: string | null;
  expectedBloggerConnectionId: string | null;
  expectedBloggerBlogId: string | null;
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
    expectedCurrentBlogId: normalizeNullableString(rawRequest.expectedCurrentBlogId),
    expectedDraftMarkdownHash: getString(rawRequest.expectedDraftMarkdownHash),
    expectedDraftHtmlHash: getString(rawRequest.expectedDraftHtmlHash),
    targetBlogId: getString(rawRequest.targetBlogId),
    expectedBloggerConnectionId: getString(rawRequest.expectedBloggerConnectionId),
    expectedBloggerBlogId: getString(rawRequest.expectedBloggerBlogId),
    confirmationPhrase: getString(rawRequest.confirmationPhrase),
    idempotencyKey: getString(rawRequest.idempotencyKey)
  };
}

function buildBlockers(input: {
  mode: AssignmentMode;
  featureFlagEnabled: boolean;
  confirmationPhraseMatched: boolean;
  idempotencyKeyPresent: boolean;
  contentItem: {
    status: string;
    blogId: string | null;
    draftMarkdown: string | null;
    draftHtml: string | null;
    qualityScore: number | null;
    publishedAt: Date | null;
    scheduledAt: Date | null;
  } | null;
  expectedCurrentBlogIdMatched: boolean;
  draftMarkdownHashMatched: boolean;
  draftHtmlHashMatched: boolean;
  targetBlog: { status: string } | null;
  targetBlogIdMatchedDiagnosis: boolean;
  targetBlogHasConnectedVerifiedBloggerConnection: boolean;
  expectedBloggerConnectionIdMatched: boolean;
  expectedBloggerBlogIdMatched: boolean;
  diagnosisReady: boolean;
}) {
  const blockers: string[] = [];

  if (input.mode === "blocked_non_supported_mode") {
    blockers.push("blog_target_assignment_mode_not_supported");
  }
  if (input.mode === "apply" && !input.featureFlagEnabled) {
    blockers.push("blog_target_assignment_feature_flag_disabled");
  }
  if (input.mode === "apply" && !input.confirmationPhraseMatched) {
    blockers.push("confirmation_phrase_missing_or_mismatch");
  }
  if (input.mode === "apply" && !input.idempotencyKeyPresent) {
    blockers.push("idempotency_key_missing");
  }
  if (!input.contentItem) {
    blockers.push("content_item_not_found");
  }
  if (input.contentItem && input.contentItem.status !== "planned") {
    blockers.push("content_item_status_not_planned");
  }
  if (input.contentItem?.blogId) {
    blockers.push("content_item_blog_id_already_present");
  }
  if (input.contentItem && !input.contentItem.draftMarkdown?.trim()) {
    blockers.push("saved_draft_markdown_missing");
  }
  if (input.contentItem && !input.contentItem.draftHtml?.trim()) {
    blockers.push("saved_draft_html_missing");
  }
  if (input.contentItem?.publishedAt) {
    blockers.push("content_item_already_published");
  }
  if (input.contentItem?.scheduledAt) {
    blockers.push("content_item_already_scheduled");
  }
  if (input.mode === "apply" && !input.expectedCurrentBlogIdMatched) {
    blockers.push("expected_current_blog_id_mismatch");
  }
  if (input.mode === "apply" && !input.draftMarkdownHashMatched) {
    blockers.push("expected_draft_markdown_hash_mismatch");
  }
  if (input.mode === "apply" && !input.draftHtmlHashMatched) {
    blockers.push("expected_draft_html_hash_mismatch");
  }
  if (!input.targetBlog) {
    blockers.push("target_blog_not_found");
  }
  if (input.targetBlog && input.targetBlog.status !== "active") {
    blockers.push("target_blog_not_active");
  }
  if (!input.targetBlogIdMatchedDiagnosis) {
    blockers.push("target_blog_does_not_match_diagnosis");
  }
  if (!input.targetBlogHasConnectedVerifiedBloggerConnection) {
    blockers.push("target_blog_connected_verified_blogger_connection_missing");
  }
  if (input.mode === "apply" && !input.expectedBloggerConnectionIdMatched) {
    blockers.push("expected_blogger_connection_id_mismatch");
  }
  if (input.mode === "apply" && !input.expectedBloggerBlogIdMatched) {
    blockers.push("expected_blogger_blog_id_mismatch");
  }
  if (!input.diagnosisReady) {
    blockers.push("draft_payload_blocker_diagnosis_not_ready_for_assignment");
  }

  return blockers;
}

function buildWarnings(mode: AssignmentMode, assigned: boolean) {
  if (assigned) {
    return [
      "daily_content_item_blog_target_assigned_by_explicit_gate",
      "draft_markdown_not_changed",
      "draft_html_not_changed",
      "blogger_write_disabled_by_patch_policy",
      "llm_call_disabled_by_patch_policy"
    ];
  }
  const warnings = [
    "daily_content_item_blog_target_assignment_guard_active",
    "draft_markdown_not_changed",
    "draft_html_not_changed",
    "blogger_write_disabled_by_patch_policy",
    "llm_call_disabled_by_patch_policy"
  ];
  if (mode === "preview") {
    warnings.push("preview_mode_does_not_write_blog_id");
  }
  return warnings;
}

function buildSideEffectSummary(assigned: boolean): BlogTargetAssignmentSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: assigned,
    contentItemMutation: assigned,
    blogIdMutation: assigned,
    draftMarkdownMutation: false,
    draftHtmlMutation: false,
    blogProfileMutation: false,
    bloggerConnectionMutation: false,
    statusMutation: false,
    qualityScoreMutation: false,
    publishedAtMutation: false,
    scheduledAtMutation: false,
    auditAttemptMutation: false,
    auditEventMutation: false,
    auditArtifactMutation: false,
    llmCall: false,
    llmCallLogMutation: false,
    bloggerRead: false,
    bloggerWrite: false,
    bloggerDraftSave: false,
    bloggerPublish: false,
    scheduledPublish: false,
    oauthReconnect: false,
    tokenRefresh: false,
    externalSend: false
  };
}

function normalizeNullableString(value: unknown) {
  if (value === null) {
    return null;
  }
  if (typeof value === "string" && value.trim().toLowerCase() === "null") {
    return null;
  }
  return getString(value);
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
