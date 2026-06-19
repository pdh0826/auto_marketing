import { readBloggerPost } from "@/lib/blogger/read-post";
import { decryptBloggerSecret, isBloggerSecretEncryptionConfigured } from "@/lib/blogger/secrets";
import type { PublishResultReadbackResponse } from "@/lib/blogger/admin-types";
import { buildPublishOAuthGate } from "@/lib/content/publish-oauth-gate";
import { getEncryptedBloggerConnectionSecret, getBloggerConnectionSecretStatus } from "@/lib/db/blogger-connection-secrets";
import { listBloggerConnectionsForBlog } from "@/lib/db/blogger-connections";
import { getLatestSuccessfulBloggerDraftSave } from "@/lib/db/blogger-draft-saves";
import { findBloggerPublishApprovalById, findLatestBloggerPublishApprovalForContentItem, toBloggerPublishApprovalAdmin } from "@/lib/db/blogger-publish-approvals";
import {
  findBloggerPublishExecutionAttemptById,
  findLatestBloggerPublishExecutionAttemptForContentItem,
  toBloggerPublishExecutionAttemptAdmin
} from "@/lib/db/blogger-publish-execution-attempts";
import { prisma } from "@/lib/db/client";

export interface PublishResultReadbackRequest {
  publishApprovalId?: unknown;
  publishExecutionAttemptId?: unknown;
  expectedTargetBloggerBlogId?: unknown;
  expectedTargetBloggerBlogUrl?: unknown;
  expectedBloggerPostId?: unknown;
  expectedBloggerPostUrl?: unknown;
  expectedPublishedAt?: unknown;
  expectedUpdatedAt?: unknown;
}

type PublishResultReadbackSummary = PublishResultReadbackResponse["publishResultReadbackSummary"];

export async function buildPublishResultReadbackResponse(
  contentItemId: string,
  rawRequest: PublishResultReadbackRequest
): Promise<PublishResultReadbackResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const blockingReasons = new Set<string>();
  const warnings = new Set<string>();

  const contentItem = await prisma.contentItem.findUnique({
    where: { id: contentItemId },
    select: {
      id: true,
      blogId: true,
      status: true,
      scheduledAt: true,
      publishedAt: true,
      draftMarkdown: true,
      draftHtml: true
    }
  });

  if (!contentItem) {
    throw new Error("content_item_not_found");
  }

  const bloggerConnections = contentItem.blogId ? await listBloggerConnectionsForBlog(contentItem.blogId) : [];
  const bloggerConnection = bloggerConnections.length === 1 ? bloggerConnections[0] : null;
  const [secretStatus, approvalRaw, attemptRaw, latestDraftSave] = await Promise.all([
    bloggerConnection ? getBloggerConnectionSecretStatus(bloggerConnection.id) : Promise.resolve(null),
    request.publishApprovalId ? findBloggerPublishApprovalById(request.publishApprovalId) : findLatestBloggerPublishApprovalForContentItem(contentItem.id),
    request.publishExecutionAttemptId
      ? findBloggerPublishExecutionAttemptById(request.publishExecutionAttemptId)
      : findLatestBloggerPublishExecutionAttemptForContentItem(contentItem.id),
    getLatestSuccessfulBloggerDraftSave(contentItem.id)
  ]);

  const approval = approvalRaw ? toBloggerPublishApprovalAdmin(approvalRaw) : null;
  const attempt = attemptRaw ? toBloggerPublishExecutionAttemptAdmin(attemptRaw) : null;
  const attemptWithReadbackFields = attempt?.id
    ? await prisma.bloggerPublishExecutionAttempt.findUnique({
        where: { id: attempt.id },
        select: {
          id: true,
          status: true,
          bloggerResponseRedactedJson: true,
          errorCode: true
        }
      })
    : null;

  const oauthGate = buildPublishOAuthGate({
    contentItemId,
    connection: bloggerConnection
      ? {
          id: bloggerConnection.id,
          bloggerBlogId: bloggerConnection.bloggerBlogId,
          bloggerBlogName: bloggerConnection.bloggerBlogName,
          bloggerBlogUrl: bloggerConnection.bloggerBlogUrl
        }
      : null,
    connectionCount: bloggerConnections.length,
    hasAccessToken: Boolean(secretStatus?.hasAccessToken),
    accessTokenExpiresAt: secretStatus?.accessTokenExpiresAt ?? null,
    contentStatus: contentItem.status,
    scheduledAt: contentItem.scheduledAt?.toISOString() ?? null,
    publishedAt: contentItem.publishedAt?.toISOString() ?? null,
    draftMarkdown: contentItem.draftMarkdown,
    draftHtml: contentItem.draftHtml,
    latestApproval: approval,
    latestAttempt: attempt,
    checkedAt
  });

  const actualTargetBlogId = approval?.targetBloggerBlogId ?? latestDraftSave?.targetBloggerBlogId ?? bloggerConnection?.bloggerBlogId ?? null;
  const actualTargetBlogUrl = approval?.targetBloggerBlogUrl ?? latestDraftSave?.targetBloggerBlogUrl ?? bloggerConnection?.bloggerBlogUrl ?? null;
  const actualBloggerPostId = approval?.bloggerPostId ?? attempt?.bloggerPostId ?? latestDraftSave?.bloggerPostId ?? null;
  const expectedTargetBlogId = request.expectedTargetBloggerBlogId ?? actualTargetBlogId;
  const expectedTargetBlogUrl = request.expectedTargetBloggerBlogUrl ?? actualTargetBlogUrl;
  const expectedBloggerPostId = request.expectedBloggerPostId ?? actualBloggerPostId;

  const approvalMatchesCurrentState = Boolean(approval && approval.contentItemId === contentItem.id && approval.status === "approved_snapshot" && !approval.invalidatedAt);
  const attemptMatchesCurrentState = Boolean(attempt && attempt.contentItemId === contentItem.id && (!approval || attempt.publishApprovalId === approval.id));
  const draftSaveMatchesCurrentState = Boolean(
    latestDraftSave?.status === "success" &&
      latestDraftSave.bloggerPostId &&
      latestDraftSave.bloggerPostId === actualBloggerPostId &&
      latestDraftSave.targetBloggerBlogId === actualTargetBlogId
  );
  const targetBlogMatches = Boolean(actualTargetBlogId && expectedTargetBlogId === actualTargetBlogId && expectedTargetBlogUrl === actualTargetBlogUrl);
  const bloggerPostIdMatchesInternalState = Boolean(actualBloggerPostId && expectedBloggerPostId === actualBloggerPostId);

  if (!oauthGate.finalPublishExecutionPreflightSummary.oauthGateSatisfied) {
    blockingReasons.add("oauth_gate_not_satisfied");
  }
  if (!oauthGate.finalPublishExecutionPreflightSummary.manualReconnectCompletionReady) {
    blockingReasons.add("manual_reconnect_completion_not_ready");
  }
  if (!oauthGate.finalPublishExecutionPreflightSummary.finalPreflightReady) {
    blockingReasons.add("final_publish_execution_preflight_not_ready");
  }
  if (!approval) {
    blockingReasons.add("publish_approval_missing");
  } else if (approval.status !== "approved_snapshot" || approval.invalidatedAt) {
    blockingReasons.add("publish_approval_invalidated");
  }
  if (!attempt) {
    blockingReasons.add("publish_execution_attempt_missing");
  }
  if (!latestDraftSave || latestDraftSave.status !== "success") {
    blockingReasons.add("blogger_draft_save_missing");
  }
  if (!actualBloggerPostId) {
    blockingReasons.add("blogger_post_id_missing");
  }
  if (!targetBlogMatches) {
    blockingReasons.add("target_blog_mismatch");
  }
  if (actualBloggerPostId && !bloggerPostIdMatchesInternalState) {
    blockingReasons.add("blogger_post_id_mismatch");
  }

  const accessTokenResult = await getReadOnlyAccessToken(bloggerConnection?.id ?? null);
  if (!accessTokenResult.ok) {
    blockingReasons.add(accessTokenResult.errorCode);
  }

  let bloggerReadbackRedacted: PublishResultReadbackSummary["bloggerReadbackRedacted"] = emptyReadbackResult();
  let readbackAttempted = false;

  if (blockingReasons.size === 0 && accessTokenResult.ok && actualTargetBlogId && actualBloggerPostId) {
    readbackAttempted = true;
    const readback = await readBloggerPost({
      accessToken: accessTokenResult.value,
      bloggerBlogId: actualTargetBlogId,
      bloggerPostId: actualBloggerPostId
    });
    bloggerReadbackRedacted = {
      ok: readback.ok,
      status: readback.status,
      bloggerPostId: readback.bloggerPostId ?? null,
      bloggerPostUrl: readback.bloggerPostUrl ?? null,
      title: readback.title ?? null,
      publishedAt: readback.publishedAt ?? null,
      updatedAt: readback.updatedAt ?? null,
      statusLabel: readback.statusLabel ?? null,
      retryable: readback.retryable,
      errorCode: readback.errorCode ?? null,
      errorMessageRedacted: readback.errorMessageRedacted ?? null
    };

    if (!readback.ok) {
      blockingReasons.add(readback.errorCode ?? "blogger_readback_failed");
    }
  }

  const bloggerPostIdMatches =
    Boolean(bloggerReadbackRedacted.bloggerPostId && bloggerReadbackRedacted.bloggerPostId === actualBloggerPostId && bloggerReadbackRedacted.bloggerPostId === expectedBloggerPostId) ||
    (!readbackAttempted && bloggerPostIdMatchesInternalState);
  const bloggerPostUrlMatchesExpected = Boolean(
    request.expectedBloggerPostUrl && bloggerReadbackRedacted.bloggerPostUrl && request.expectedBloggerPostUrl === bloggerReadbackRedacted.bloggerPostUrl
  );
  const publishedAtMatchesExpected = request.expectedPublishedAt ? timestampsMatch(request.expectedPublishedAt, bloggerReadbackRedacted.publishedAt) : null;
  const updatedAtMatchesExpected = request.expectedUpdatedAt ? timestampsMatch(request.expectedUpdatedAt, bloggerReadbackRedacted.updatedAt) : null;

  if (readbackAttempted && bloggerReadbackRedacted.ok) {
    if (!bloggerPostIdMatches) {
      blockingReasons.add("blogger_post_id_mismatch");
    }
    if (request.expectedBloggerPostUrl && !bloggerPostUrlMatchesExpected) {
      blockingReasons.add("blogger_post_url_mismatch");
    }
  }

  const postExists = Boolean(bloggerReadbackRedacted.ok && bloggerReadbackRedacted.bloggerPostId);
  const appearsPublished = Boolean(
    bloggerReadbackRedacted.ok && (bloggerReadbackRedacted.statusLabel === "LIVE" || Boolean(bloggerReadbackRedacted.publishedAt && bloggerReadbackRedacted.bloggerPostUrl))
  );
  const contentMutationRequired = Boolean(postExists && appearsPublished && contentItem.status !== "published");
  const attemptMutationRequired = Boolean(postExists && appearsPublished && !attemptWithReadbackFields?.bloggerResponseRedactedJson);
  const safeToMutateContentAfterReadback = Boolean(
    postExists &&
      appearsPublished &&
      bloggerPostIdMatches &&
      (!request.expectedBloggerPostUrl || bloggerPostUrlMatchesExpected) &&
      (publishedAtMatchesExpected !== false || !request.expectedPublishedAt)
  );

  if (contentMutationRequired) {
    warnings.add("content_items_still_planned_after_external_publish");
    warnings.add("content_mutation_deferred_to_9e9d");
  }
  if (attemptMutationRequired) {
    warnings.add("publish_execution_attempt_not_reconciled_after_external_publish");
    warnings.add("attempt_mutation_deferred_to_9e9d");
  }

  const summary: PublishResultReadbackSummary = {
    checked: true,
    readbackAttempted,
    readbackOk: Boolean(readbackAttempted && bloggerReadbackRedacted.ok),
    readbackBlocked: !readbackAttempted,
    contentItemId,
    publishApprovalId: approval?.id ?? null,
    publishExecutionAttemptId: attempt?.id ?? null,
    bloggerDraftSaveId: latestDraftSave?.id ?? approval?.bloggerDraftSaveId ?? null,
    targetBloggerBlogId: actualTargetBlogId,
    targetBloggerBlogName: approval?.targetBloggerBlogName ?? latestDraftSave?.targetBloggerBlogName ?? bloggerConnection?.bloggerBlogName ?? null,
    targetBloggerBlogUrl: actualTargetBlogUrl,
    bloggerPostId: actualBloggerPostId,
    expectedBloggerPostUrl: request.expectedBloggerPostUrl,
    expectedPublishedAt: request.expectedPublishedAt,
    expectedUpdatedAt: request.expectedUpdatedAt,
    bloggerReadbackRedacted,
    matches: {
      approvalMatchesCurrentState,
      attemptMatchesCurrentState,
      draftSaveMatchesCurrentState,
      targetBlogMatches,
      bloggerPostIdMatches,
      bloggerPostUrlMatchesExpected,
      publishedAtMatchesExpected,
      updatedAtMatchesExpected
    },
    externalBloggerState: {
      postExists,
      appearsPublished,
      urlAvailable: Boolean(bloggerReadbackRedacted.bloggerPostUrl),
      publishedAtAvailable: Boolean(bloggerReadbackRedacted.publishedAt),
      updatedAtAvailable: Boolean(bloggerReadbackRedacted.updatedAt)
    },
    internalDbState: {
      contentStatus: contentItem.status,
      contentPublishedAt: contentItem.publishedAt?.toISOString() ?? null,
      contentScheduledAt: contentItem.scheduledAt?.toISOString() ?? null,
      attemptStatus: attemptWithReadbackFields?.status ?? attempt?.status ?? null,
      attemptHasRedactedResponse: Boolean(attemptWithReadbackFields?.bloggerResponseRedactedJson),
      attemptErrorCode: attemptWithReadbackFields?.errorCode ?? null
    },
    reconciliationPreview: {
      reconciliationNeeded: contentMutationRequired || attemptMutationRequired,
      recommendedNextPatch: "9E-9D",
      contentMutationRequired,
      attemptMutationRequired,
      approvalMutationRequired: false,
      safeToMutateContentAfterReadback,
      proposedContentItemPatch:
        contentMutationRequired && safeToMutateContentAfterReadback
          ? {
              status: "published",
              publishedAt: bloggerReadbackRedacted.publishedAt,
              scheduledAt: null,
              bloggerPostId: bloggerReadbackRedacted.bloggerPostId ?? actualBloggerPostId,
              bloggerPostUrl: bloggerReadbackRedacted.bloggerPostUrl
            }
          : null,
      proposedAttemptPatch:
        attemptMutationRequired && safeToMutateContentAfterReadback
          ? {
              status: "success",
              bloggerResponseRedactedJson: "redacted_readback_result",
              errorType: null,
              errorCode: null,
              errorMessageRedacted: null
            }
          : null
    },
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings),
    sideEffectSummary: {
      dbRead: true,
      dbWrite: false,
      bloggerRead: readbackAttempted,
      bloggerWrite: false,
      bloggerPublish: false,
      bloggerUpdate: false,
      bloggerDraftSave: false,
      tokenRefresh: false,
      oauthReconnect: false,
      contentMutation: false,
      approvalMutation: false,
      attemptMutation: false,
      llmCall: false,
      externalSend: false
    }
  };

  return {
    contentItemId,
    checkedAt: checkedAt.toISOString(),
    publishResultReadbackSummary: summary
  };
}

function normalizeRequest(raw: PublishResultReadbackRequest) {
  return {
    publishApprovalId: getString(raw.publishApprovalId),
    publishExecutionAttemptId: getString(raw.publishExecutionAttemptId),
    expectedTargetBloggerBlogId: getString(raw.expectedTargetBloggerBlogId),
    expectedTargetBloggerBlogUrl: getString(raw.expectedTargetBloggerBlogUrl),
    expectedBloggerPostId: getString(raw.expectedBloggerPostId),
    expectedBloggerPostUrl: getString(raw.expectedBloggerPostUrl),
    expectedPublishedAt: getString(raw.expectedPublishedAt),
    expectedUpdatedAt: getString(raw.expectedUpdatedAt)
  };
}

async function getReadOnlyAccessToken(connectionId: string | null): Promise<{ ok: true; value: string } | { ok: false; errorCode: string }> {
  if (!connectionId) {
    return { ok: false, errorCode: "oauth_gate_not_satisfied" };
  }
  const accessTokenSecret = await getEncryptedBloggerConnectionSecret(connectionId, "access_token");
  if (!accessTokenSecret) {
    return { ok: false, errorCode: "access_token_missing" };
  }
  if (accessTokenSecret.expiresAt && accessTokenSecret.expiresAt.getTime() <= Date.now()) {
    return { ok: false, errorCode: "blogger_readback_unauthorized_reauth_required" };
  }
  if (!isBloggerSecretEncryptionConfigured()) {
    return { ok: false, errorCode: "blogger_secret_key_not_configured" };
  }

  try {
    return { ok: true, value: decryptBloggerSecret(accessTokenSecret.encryptedValue) };
  } catch {
    return { ok: false, errorCode: "token_decryption_failed" };
  }
}

function emptyReadbackResult(): PublishResultReadbackSummary["bloggerReadbackRedacted"] {
  return {
    ok: false,
    status: 0,
    bloggerPostId: null,
    bloggerPostUrl: null,
    title: null,
    publishedAt: null,
    updatedAt: null,
    statusLabel: null,
    retryable: null,
    errorCode: null,
    errorMessageRedacted: null
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function timestampsMatch(expected: string, actual: string | null) {
  if (!actual) {
    return false;
  }
  const expectedDate = new Date(expected);
  const actualDate = new Date(actual);
  if (Number.isFinite(expectedDate.getTime()) && Number.isFinite(actualDate.getTime())) {
    return expectedDate.getTime() === actualDate.getTime();
  }
  return expected === actual;
}
