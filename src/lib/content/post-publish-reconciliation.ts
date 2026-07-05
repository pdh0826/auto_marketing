import { Prisma } from "@prisma/client";
import type { PostPublishReconciliationResponse, PublishResultReadbackResponse } from "@/lib/blogger/admin-types";
import { prisma } from "@/lib/db/client";
import { buildPublishResultReadbackResponse, type PublishResultReadbackRequest } from "@/lib/content/publish-result-readback";

const APPLY_FEATURE_FLAG = "BLOGGER_POST_PUBLISH_RECONCILIATION_APPLY_ENABLED";
const CONFIRMATION_PHRASE = "I_UNDERSTAND_THIS_WILL_MARK_CONTENT_AS_PUBLISHED";

export interface PostPublishReconciliationRequest extends PublishResultReadbackRequest {
  mode?: unknown;
  confirmDbReconciliation?: unknown;
  contentMutationAcknowledged?: unknown;
  attemptMutationAcknowledged?: unknown;
  finalDbReconciliationApprovalConfirmed?: unknown;
}

type ReconciliationSummary = PostPublishReconciliationResponse["postPublishReconciliationSummary"];
type ReadbackSummary = PublishResultReadbackResponse["publishResultReadbackSummary"];

export async function buildPostPublishReconciliationResponse(
  contentItemId: string,
  rawRequest: PostPublishReconciliationRequest
): Promise<PostPublishReconciliationResponse> {
  const checkedAt = new Date();
  const request = normalizeReconciliationRequest(rawRequest);
  const readbackResponse = await buildPublishResultReadbackResponse(contentItemId, request);
  const readback = readbackResponse.publishResultReadbackSummary;
  const blockingReasons = new Set(readback.blockingReasons);
  const warnings = new Set(readback.warnings);
  const featureFlagEnabled = process.env[APPLY_FEATURE_FLAG] === "true";
  const confirmationPhraseAccepted = request.confirmDbReconciliation === CONFIRMATION_PHRASE;
  const contentMutationAcknowledged = request.contentMutationAcknowledged === true;
  const attemptMutationAcknowledged = request.attemptMutationAcknowledged === true;
  const finalDbReconciliationApprovalConfirmed = request.finalDbReconciliationApprovalConfirmed === true;

  const proposedContentItemPatch = buildProposedContentItemPatch(readback);
  const proposedAttemptPatch = buildProposedAttemptPatch(readback);
  const alreadyReconciled = isAlreadyReconciled(readback);

  if (request.mode === "preview") {
    warnings.add("post_publish_reconciliation_preview_only");
    if (readback.externalBloggerState.appearsPublished && readback.internalDbState.contentStatus === "planned") {
      warnings.add("content_items_still_planned_after_external_publish");
    }
    if (readback.externalBloggerState.appearsPublished && readback.internalDbState.attemptStatus === "planned_only") {
      warnings.add("publish_execution_attempt_not_reconciled_after_external_publish");
    }
  }

  if (request.mode === "apply") {
    collectApplyBlockers({
      readback,
      request,
      blockingReasons,
      featureFlagEnabled,
      confirmationPhraseAccepted,
      contentMutationAcknowledged,
      attemptMutationAcknowledged,
      finalDbReconciliationApprovalConfirmed,
      alreadyReconciled
    });
  }

  let appliedContentItemPatch = false;
  let appliedAttemptPatch = false;
  let internalDbStateAfter: ReconciliationSummary["internalDbStateAfter"] = null;
  const canApply = request.mode === "apply" && blockingReasons.size === 0 && !alreadyReconciled && proposedContentItemPatch && proposedAttemptPatch;
  const applyAttempted = Boolean(canApply);

  if (canApply) {
    const publishedAt = proposedContentItemPatch.publishedAt ? new Date(proposedContentItemPatch.publishedAt) : null;
    if (!publishedAt || Number.isNaN(publishedAt.getTime())) {
      blockingReasons.add("published_at_mismatch");
    } else if (!readback.publishExecutionAttemptId) {
      blockingReasons.add("publish_execution_attempt_missing");
    } else {
      const updated = await prisma.$transaction(async (tx) => {
        const content = await tx.contentItem.update({
          where: { id: contentItemId },
          data: {
            status: "published",
            publishedAt,
            scheduledAt: null
          },
          select: {
            status: true,
            publishedAt: true,
            scheduledAt: true
          }
        });

        const attempt = await tx.bloggerPublishExecutionAttempt.update({
          where: { id: readback.publishExecutionAttemptId ?? "" },
          data: {
            status: "success",
            bloggerResponseRedactedJson: proposedAttemptPatch.bloggerResponseRedactedJson as Prisma.InputJsonValue,
            errorType: null,
            errorCode: null,
            errorMessageRedacted: null,
            retryEligible: false,
            retryBlockedReason: null,
            contentMutationPlanned: true,
            contentMutationCompleted: true,
            contentStatusBefore: readback.internalDbState.contentStatus,
            contentStatusAfter: "published",
            publishedAtPlanned: publishedAt,
            publishedAtApplied: publishedAt,
            scheduledAtPlanned: null,
            scheduledAtApplied: null
          },
          select: {
            status: true,
            bloggerResponseRedactedJson: true,
            errorCode: true
          }
        });

        return {
          content,
          attempt
        };
      });

      appliedContentItemPatch = true;
      appliedAttemptPatch = true;
      warnings.add("content_items_marked_published_after_blogger_readback");
      warnings.add("publish_execution_attempt_marked_success_after_blogger_readback");
      internalDbStateAfter = {
        contentStatus: updated.content.status,
        contentPublishedAt: updated.content.publishedAt?.toISOString() ?? null,
        contentScheduledAt: updated.content.scheduledAt?.toISOString() ?? null,
        attemptStatus: updated.attempt.status,
        attemptHasRedactedResponse: Boolean(updated.attempt.bloggerResponseRedactedJson),
        attemptErrorCode: updated.attempt.errorCode ?? null
      };
    }
  }

  if (alreadyReconciled) {
    warnings.add("post_publish_reconciliation_already_applied");
  }

  const applyOk = request.mode === "apply" && (appliedContentItemPatch && appliedAttemptPatch || alreadyReconciled) && blockingReasons.size === 0;
  const applyBlocked = request.mode === "apply" && !applyOk;
  const dbWrite = appliedContentItemPatch || appliedAttemptPatch;

  const summary: ReconciliationSummary = {
    checked: true,
    mode: request.mode,
    readbackAttempted: readback.readbackAttempted,
    readbackOk: readback.readbackOk,
    readbackBlocked: readback.readbackBlocked,
    applyAttempted,
    applyBlocked,
    applyOk,
    featureFlagEnabled,
    confirmationPhraseAccepted,
    contentMutationAcknowledged,
    attemptMutationAcknowledged,
    finalDbReconciliationApprovalConfirmed,
    contentItemId,
    publishApprovalId: readback.publishApprovalId,
    publishExecutionAttemptId: readback.publishExecutionAttemptId,
    bloggerDraftSaveId: readback.bloggerDraftSaveId,
    targetBloggerBlogId: readback.targetBloggerBlogId,
    targetBloggerBlogName: readback.targetBloggerBlogName,
    targetBloggerBlogUrl: readback.targetBloggerBlogUrl,
    bloggerPostId: readback.bloggerPostId,
    bloggerPostUrl: readback.bloggerReadbackRedacted.bloggerPostUrl,
    publishedAt: readback.bloggerReadbackRedacted.publishedAt,
    updatedAt: readback.bloggerReadbackRedacted.updatedAt,
    matches: readback.matches,
    externalBloggerState: readback.externalBloggerState,
    internalDbStateBefore: readback.internalDbState,
    proposedContentItemPatch,
    proposedAttemptPatch,
    appliedContentItemPatch,
    appliedAttemptPatch,
    internalDbStateAfter,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings),
    sideEffectSummary: {
      dbRead: true,
      dbWrite,
      bloggerRead: readback.sideEffectSummary.bloggerRead,
      bloggerWrite: false,
      bloggerPublish: false,
      bloggerUpdate: false,
      bloggerDraftSave: false,
      tokenRefresh: false,
      oauthReconnect: false,
      contentMutation: appliedContentItemPatch,
      approvalMutation: false,
      attemptMutation: appliedAttemptPatch,
      llmCall: false,
      externalSend: readback.sideEffectSummary.bloggerRead
    }
  };

  return {
    contentItemId,
    checkedAt: checkedAt.toISOString(),
    postPublishReconciliationSummary: summary
  };
}

function normalizeReconciliationRequest(raw: PostPublishReconciliationRequest) {
  const mode: "preview" | "apply" = raw.mode === "apply" ? "apply" : "preview";
  return {
    mode,
    publishApprovalId: getString(raw.publishApprovalId),
    publishExecutionAttemptId: getString(raw.publishExecutionAttemptId),
    expectedTargetBloggerBlogId: getString(raw.expectedTargetBloggerBlogId),
    expectedTargetBloggerBlogUrl: getString(raw.expectedTargetBloggerBlogUrl),
    expectedBloggerPostId: getString(raw.expectedBloggerPostId),
    expectedBloggerPostUrl: getString(raw.expectedBloggerPostUrl),
    expectedPublishedAt: getString(raw.expectedPublishedAt),
    expectedUpdatedAt: getString(raw.expectedUpdatedAt),
    confirmDbReconciliation: getString(raw.confirmDbReconciliation),
    contentMutationAcknowledged: raw.contentMutationAcknowledged === true,
    attemptMutationAcknowledged: raw.attemptMutationAcknowledged === true,
    finalDbReconciliationApprovalConfirmed: raw.finalDbReconciliationApprovalConfirmed === true
  };
}

function collectApplyBlockers(input: {
  readback: ReadbackSummary;
  request: ReturnType<typeof normalizeReconciliationRequest>;
  blockingReasons: Set<string>;
  featureFlagEnabled: boolean;
  confirmationPhraseAccepted: boolean;
  contentMutationAcknowledged: boolean;
  attemptMutationAcknowledged: boolean;
  finalDbReconciliationApprovalConfirmed: boolean;
  alreadyReconciled: boolean;
}) {
  const { readback, request, blockingReasons } = input;

  if (input.alreadyReconciled) {
    return;
  }

  if (!input.featureFlagEnabled) blockingReasons.add("post_publish_reconciliation_apply_feature_flag_disabled");
  if (!input.confirmationPhraseAccepted) blockingReasons.add("post_publish_reconciliation_confirmation_missing");
  if (!input.contentMutationAcknowledged) blockingReasons.add("content_mutation_not_acknowledged");
  if (!input.attemptMutationAcknowledged) blockingReasons.add("attempt_mutation_not_acknowledged");
  if (!input.finalDbReconciliationApprovalConfirmed) blockingReasons.add("final_db_reconciliation_approval_missing");
  if (!readback.readbackOk) blockingReasons.add("blogger_readback_failed");
  if (!readback.externalBloggerState.postExists) blockingReasons.add("blogger_readback_post_not_found");
  if (!readback.externalBloggerState.appearsPublished) blockingReasons.add("safe_to_mutate_content_after_readback_false");
  if (!readback.reconciliationPreview.safeToMutateContentAfterReadback) blockingReasons.add("safe_to_mutate_content_after_readback_false");
  if (!readback.matches.approvalMatchesCurrentState) blockingReasons.add("publish_approval_invalidated");
  if (!readback.matches.attemptMatchesCurrentState) blockingReasons.add("publish_execution_attempt_missing");
  if (!readback.matches.draftSaveMatchesCurrentState) blockingReasons.add("draft_save_missing");
  if (!readback.matches.targetBlogMatches) blockingReasons.add("target_blog_mismatch");
  if (!readback.matches.bloggerPostIdMatches) blockingReasons.add("blogger_post_id_mismatch");
  if (!readback.matches.bloggerPostUrlMatchesExpected) blockingReasons.add("blogger_post_url_mismatch");
  if (request.expectedPublishedAt && readback.matches.publishedAtMatchesExpected !== true) blockingReasons.add("published_at_mismatch");
  if (request.expectedUpdatedAt && readback.matches.updatedAtMatchesExpected !== true) blockingReasons.add("updated_at_mismatch");

  if (!input.alreadyReconciled) {
    if (readback.internalDbState.contentStatus !== "planned") blockingReasons.add("content_status_not_planned");
    if (readback.internalDbState.contentPublishedAt) blockingReasons.add("content_already_published_but_attempt_not_reconciled");
    if (readback.internalDbState.attemptStatus !== "planned_only") blockingReasons.add("publish_execution_attempt_not_planned_only");
  }
}

function buildProposedContentItemPatch(readback: ReadbackSummary): ReconciliationSummary["proposedContentItemPatch"] {
  if (!readback.reconciliationPreview.safeToMutateContentAfterReadback || !readback.bloggerReadbackRedacted.publishedAt) {
    return null;
  }
  if (readback.internalDbState.contentStatus === "published") {
    return null;
  }
  return {
    status: "published",
    publishedAt: readback.bloggerReadbackRedacted.publishedAt,
    scheduledAt: null
  };
}

function buildProposedAttemptPatch(readback: ReadbackSummary): ReconciliationSummary["proposedAttemptPatch"] {
  if (!readback.reconciliationPreview.safeToMutateContentAfterReadback || !readback.bloggerReadbackRedacted.bloggerPostId) {
    return null;
  }
  if (readback.internalDbState.attemptStatus === "success" && readback.internalDbState.attemptHasRedactedResponse) {
    return null;
  }
  return {
    status: "success",
    bloggerResponseRedactedJson: {
      source: "blogger_readback",
      patch: "9E-9D",
      bloggerPostId: readback.bloggerReadbackRedacted.bloggerPostId,
      bloggerPostUrl: readback.bloggerReadbackRedacted.bloggerPostUrl,
      publishedAt: readback.bloggerReadbackRedacted.publishedAt,
      updatedAt: readback.bloggerReadbackRedacted.updatedAt,
      statusLabel: readback.bloggerReadbackRedacted.statusLabel,
      readbackStatus: readback.bloggerReadbackRedacted.status,
      rawResponseStored: false,
      contentReturned: false
    },
    errorType: null,
    errorCode: null,
    errorMessageRedacted: null
  };
}

function isAlreadyReconciled(readback: ReadbackSummary) {
  return (
    readback.internalDbState.contentStatus === "published" &&
    Boolean(readback.internalDbState.contentPublishedAt) &&
    readback.internalDbState.attemptStatus === "success" &&
    readback.internalDbState.attemptHasRedactedResponse &&
    readback.reconciliationPreview.safeToMutateContentAfterReadback
  );
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
