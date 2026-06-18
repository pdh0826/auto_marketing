import { createHash } from "node:crypto";
import type { GuardedPublishExecutionResponse } from "@/lib/blogger/admin-types";
import { publishExistingBloggerPost } from "@/lib/blogger/publish-post";
import { decryptBloggerSecret, isBloggerSecretEncryptionConfigured } from "@/lib/blogger/secrets";
import { buildPublishOAuthGate } from "@/lib/content/publish-oauth-gate";
import { getEncryptedBloggerConnectionSecret, getBloggerConnectionSecretStatus } from "@/lib/db/blogger-connection-secrets";
import { listBloggerConnectionsForBlog } from "@/lib/db/blogger-connections";
import { getSuccessfulBloggerDraftSaveByApproval } from "@/lib/db/blogger-draft-saves";
import { findLatestBloggerPublishApprovalForContentItem, toBloggerPublishApprovalAdmin } from "@/lib/db/blogger-publish-approvals";
import { findLatestBloggerPublishExecutionAttemptForContentItem, toBloggerPublishExecutionAttemptAdmin } from "@/lib/db/blogger-publish-execution-attempts";
import { prisma } from "@/lib/db/client";

export const GUARDED_BLOGGER_PUBLISH_LIVE_FEATURE_FLAG = "BLOGGER_GUARDED_PUBLISH_LIVE_ENABLED";
export const GUARDED_BLOGGER_PUBLISH_CONFIRMATION_PHRASE = "I_UNDERSTAND_THIS_WILL_PUBLISH_TO_BLOGGER";
export const GUARDED_PUBLISH_EXECUTION_ROUTE_PATH = "/api/content-items/[id]/guarded-publish-execution";

export interface GuardedPublishExecutionRequest {
  mode?: unknown;
  publishApprovalId?: unknown;
  publishExecutionAttemptId?: unknown;
  expectedDraftMarkdownHash?: unknown;
  expectedDraftHtmlHash?: unknown;
  expectedDraftHtmlLength?: unknown;
  expectedTargetBloggerBlogId?: unknown;
  expectedTargetBloggerBlogUrl?: unknown;
  expectedBloggerPostId?: unknown;
  confirmLiveBloggerPublish?: unknown;
  rollbackPlanAcknowledged?: unknown;
  externalWriteRiskAcknowledged?: unknown;
  finalHumanApprovalConfirmed?: unknown;
}

type GuardedPublishSummary = GuardedPublishExecutionResponse["guardedPublishExecutionSummary"];

export async function buildGuardedPublishExecutionResponse(
  contentItemId: string,
  rawRequest: GuardedPublishExecutionRequest
): Promise<GuardedPublishExecutionResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const featureFlagEnabled = process.env[GUARDED_BLOGGER_PUBLISH_LIVE_FEATURE_FLAG] === "true";
  const confirmationPhraseAccepted = request.confirmLiveBloggerPublish === GUARDED_BLOGGER_PUBLISH_CONFIRMATION_PHRASE;

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
  const [secretStatus, latestApprovalRaw, latestAttemptRaw] = await Promise.all([
    bloggerConnection ? getBloggerConnectionSecretStatus(bloggerConnection.id) : Promise.resolve(null),
    findLatestBloggerPublishApprovalForContentItem(contentItem.id),
    findLatestBloggerPublishExecutionAttemptForContentItem(contentItem.id)
  ]);
  const latestApproval = latestApprovalRaw ? toBloggerPublishApprovalAdmin(latestApprovalRaw) : null;
  const latestAttempt = latestAttemptRaw ? toBloggerPublishExecutionAttemptAdmin(latestAttemptRaw) : null;
  const latestDraftSave = latestApproval ? await getSuccessfulBloggerDraftSaveByApproval(latestApproval.id) : null;
  const currentDraftMarkdownHash = md5Hex(contentItem.draftMarkdown ?? "");
  const currentDraftHtmlHash = md5Hex(contentItem.draftHtml ?? "");
  const currentDraftHtmlLength = (contentItem.draftHtml ?? "").length;

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
    latestApproval,
    latestAttempt,
    checkedAt
  });

  const expected = resolveExpectedValues({
    request,
    mode: request.mode,
    currentDraftMarkdownHash,
    currentDraftHtmlHash,
    currentDraftHtmlLength,
    latestApproval,
    latestAttempt,
    latestDraftSave,
    bloggerConnection
  });
  const publishApprovalMatchesRequest = Boolean(latestApproval && expected.publishApprovalId === latestApproval.id);
  const publishExecutionAttemptMatchesRequest = Boolean(latestAttempt && expected.publishExecutionAttemptId === latestAttempt.id);
  const contentHashMatchesRequest = Boolean(
    expected.expectedDraftMarkdownHash === currentDraftMarkdownHash &&
      expected.expectedDraftHtmlHash === currentDraftHtmlHash &&
      expected.expectedDraftHtmlLength === currentDraftHtmlLength
  );
  const targetBlogMatchesRequest = Boolean(
    expected.expectedTargetBloggerBlogId === (latestApproval?.targetBloggerBlogId ?? bloggerConnection?.bloggerBlogId ?? null) &&
      expected.expectedTargetBloggerBlogId === (bloggerConnection?.bloggerBlogId ?? null) &&
      expected.expectedTargetBloggerBlogUrl === (latestApproval?.targetBloggerBlogUrl ?? bloggerConnection?.bloggerBlogUrl ?? null)
  );
  const actualBloggerPostId = latestApproval?.bloggerPostId ?? latestAttempt?.bloggerPostId ?? latestDraftSave?.bloggerPostId ?? null;
  const bloggerPostIdMatchesRequest = Boolean(actualBloggerPostId && expected.expectedBloggerPostId === actualBloggerPostId);
  const guardedDesignReady = Boolean(
    oauthGate.guardedPublishExecutionDesignSummary.checked &&
      oauthGate.guardedPublishExecutionDesignSummary.implementationStatus === "implemented_live_guarded" &&
      oauthGate.guardedPublishExecutionDesignSummary.existingBloggerPostId
  );

  const blockingReasons = buildBlockingReasons({
    request,
    featureFlagEnabled,
    confirmationPhraseAccepted,
    oauthGate,
    contentStatus: contentItem.status,
    publishedAt: contentItem.publishedAt,
    scheduledAt: contentItem.scheduledAt,
    publishApprovalMatchesRequest,
    publishExecutionAttemptMatchesRequest,
    contentHashMatchesRequest,
    targetBlogMatchesRequest,
    bloggerPostIdMatchesRequest,
    bloggerPostId: actualBloggerPostId,
    guardedDesignReady,
    liveExpectedMetadataProvided: hasLiveExpectedMetadata(request)
  });

  const warnings = new Set<string>();
  if (request.mode === "dry_run") {
    warnings.add("dry_run_does_not_call_blogger_publish");
  }
  if (!oauthGate.finalPublishExecutionPreflightSummary.finalPreflightReady && oauthGate.oauthGateSummary.accessTokenExpired) {
    warnings.add("oauth_reconnect_required_before_live_publish");
  }

  let bloggerResultRedacted: GuardedPublishSummary["bloggerResultRedacted"] = emptyBloggerResult();
  let liveExecutionAttempted = false;
  const hardBlockersForLive = Array.from(blockingReasons).filter((reason) => reason !== "content_mutation_deferred_to_post_publish_patch");
  let bloggerApiCallAllowedNow = request.mode === "live" && hardBlockersForLive.length === 0;

  if (bloggerApiCallAllowedNow && bloggerConnection?.id && actualBloggerPostId && expected.expectedTargetBloggerBlogId) {
    const accessToken = await getUsableAccessTokenForPublish(bloggerConnection.id);
    if (!accessToken.ok) {
      bloggerApiCallAllowedNow = false;
      blockingReasons.add(accessToken.errorCode);
      bloggerResultRedacted = {
        ...emptyBloggerResult(),
        errorCode: accessToken.errorCode,
        errorMessageRedacted: accessToken.errorMessageRedacted,
        retryable: false
      };
    } else {
      liveExecutionAttempted = true;
      const result = await publishExistingBloggerPost({
        accessToken: accessToken.value,
        bloggerBlogId: expected.expectedTargetBloggerBlogId,
        bloggerPostId: actualBloggerPostId
      });
      bloggerResultRedacted = {
        attempted: true,
        ok: result.ok,
        status: result.status,
        bloggerPostId: result.bloggerPostId ?? null,
        bloggerPostUrl: result.bloggerPostUrl ?? null,
        publishedAt: result.publishedAt ?? null,
        updatedAt: result.updatedAt ?? null,
        retryable: result.retryable,
        errorCode: result.errorCode ?? null,
        errorMessageRedacted: result.errorMessageRedacted ?? null
      };

      if (!result.ok) {
        blockingReasons.add("blogger_publish_failed");
        if (result.retryable) {
          blockingReasons.add("blogger_publish_result_unknown_manual_review_required");
        }
      }
    }
  }

  const summary: GuardedPublishSummary = {
    checked: true,
    mode: request.mode,
    implementationStatus: "implemented_live_guarded",
    routePath: GUARDED_PUBLISH_EXECUTION_ROUTE_PATH,
    liveExecutionAttempted,
    liveExecutionBlocked: !liveExecutionAttempted,
    dryRunOnly: request.mode === "dry_run",
    canExecutePublish: false,
    canProceedToPublishExecution: false,
    canProceedToScheduledPublishExecution: false,
    bloggerApiCallAllowedNow,
    featureFlagEnabled,
    confirmationPhraseAccepted,
    rollbackPlanAcknowledged: request.rollbackPlanAcknowledged,
    externalWriteRiskAcknowledged: request.externalWriteRiskAcknowledged,
    finalHumanApprovalConfirmed: request.finalHumanApprovalConfirmed,
    oauthGateSatisfied: oauthGate.finalPublishExecutionPreflightSummary.oauthGateSatisfied,
    manualReconnectCompletionReady: oauthGate.finalPublishExecutionPreflightSummary.manualReconnectCompletionReady,
    finalPreflightReady: oauthGate.finalPublishExecutionPreflightSummary.finalPreflightReady,
    guardedDesignReady,
    publishApprovalMatchesRequest,
    publishExecutionAttemptMatchesRequest,
    contentHashMatchesRequest,
    targetBlogMatchesRequest,
    bloggerPostIdMatchesRequest,
    contentItemId,
    publishApprovalId: latestApproval?.id ?? null,
    publishExecutionAttemptId: latestAttempt?.id ?? null,
    bloggerDraftSaveId: latestDraftSave?.id ?? latestApproval?.bloggerDraftSaveId ?? null,
    targetBloggerBlogId: latestApproval?.targetBloggerBlogId ?? bloggerConnection?.bloggerBlogId ?? null,
    targetBloggerBlogName: latestApproval?.targetBloggerBlogName ?? bloggerConnection?.bloggerBlogName ?? null,
    targetBloggerBlogUrl: latestApproval?.targetBloggerBlogUrl ?? bloggerConnection?.bloggerBlogUrl ?? null,
    bloggerPostId: actualBloggerPostId,
    redactedBloggerRequestPlan: {
      method: "POST",
      endpointKind: "blogger.posts.publish",
      bloggerBlogId: latestApproval?.targetBloggerBlogId ?? bloggerConnection?.bloggerBlogId ?? null,
      bloggerPostId: actualBloggerPostId,
      usesAccessToken: true,
      accessTokenIncluded: false,
      requestBodyIncluded: false,
      requestBodyHashOnly: true
    },
    bloggerResultRedacted,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings),
    sideEffectSummary: {
      dbRead: true,
      dbWrite: false,
      bloggerRead: false,
      bloggerWrite: liveExecutionAttempted,
      bloggerPublish: liveExecutionAttempted,
      bloggerUpdate: false,
      bloggerDraftSave: false,
      tokenRefresh: false,
      oauthReconnect: false,
      contentMutation: false,
      approvalMutation: false,
      attemptMutation: false,
      llmCall: false,
      externalSend: liveExecutionAttempted
    }
  };

  return {
    contentItemId,
    checkedAt: checkedAt.toISOString(),
    guardedPublishExecutionSummary: summary
  };
}

function normalizeRequest(raw: GuardedPublishExecutionRequest): {
  mode: "dry_run" | "live";
  publishApprovalId: string | null;
  publishExecutionAttemptId: string | null;
  expectedDraftMarkdownHash: string | null;
  expectedDraftHtmlHash: string | null;
  expectedDraftHtmlLength: number | null;
  expectedTargetBloggerBlogId: string | null;
  expectedTargetBloggerBlogUrl: string | null;
  expectedBloggerPostId: string | null;
  confirmLiveBloggerPublish: string | null;
  rollbackPlanAcknowledged: boolean;
  externalWriteRiskAcknowledged: boolean;
  finalHumanApprovalConfirmed: boolean;
} {
  const mode = raw.mode === "live" ? "live" : "dry_run";
  return {
    mode,
    publishApprovalId: getString(raw.publishApprovalId),
    publishExecutionAttemptId: getString(raw.publishExecutionAttemptId),
    expectedDraftMarkdownHash: getString(raw.expectedDraftMarkdownHash),
    expectedDraftHtmlHash: getString(raw.expectedDraftHtmlHash),
    expectedDraftHtmlLength: getNumber(raw.expectedDraftHtmlLength),
    expectedTargetBloggerBlogId: getString(raw.expectedTargetBloggerBlogId),
    expectedTargetBloggerBlogUrl: getString(raw.expectedTargetBloggerBlogUrl),
    expectedBloggerPostId: getString(raw.expectedBloggerPostId),
    confirmLiveBloggerPublish: getString(raw.confirmLiveBloggerPublish),
    rollbackPlanAcknowledged: raw.rollbackPlanAcknowledged === true,
    externalWriteRiskAcknowledged: raw.externalWriteRiskAcknowledged === true,
    finalHumanApprovalConfirmed: raw.finalHumanApprovalConfirmed === true
  };
}

function resolveExpectedValues(input: {
  request: ReturnType<typeof normalizeRequest>;
  mode: "dry_run" | "live";
  currentDraftMarkdownHash: string;
  currentDraftHtmlHash: string;
  currentDraftHtmlLength: number;
  latestApproval: { id: string; targetBloggerBlogId: string | null; targetBloggerBlogUrl: string | null; bloggerPostId: string; draftMarkdownHash: string; draftHtmlHash: string; draftHtmlLength: number } | null;
  latestAttempt: { id: string; bloggerPostId: string | null } | null;
  latestDraftSave: { bloggerPostId: string | null } | null;
  bloggerConnection: { bloggerBlogId: string | null; bloggerBlogUrl: string | null } | null;
}) {
  const fallbackAllowed = input.mode === "dry_run";

  return {
    publishApprovalId: input.request.publishApprovalId ?? (fallbackAllowed ? input.latestApproval?.id ?? null : null),
    publishExecutionAttemptId: input.request.publishExecutionAttemptId ?? (fallbackAllowed ? input.latestAttempt?.id ?? null : null),
    expectedDraftMarkdownHash: input.request.expectedDraftMarkdownHash ?? (fallbackAllowed ? input.latestApproval?.draftMarkdownHash ?? input.currentDraftMarkdownHash : null),
    expectedDraftHtmlHash: input.request.expectedDraftHtmlHash ?? (fallbackAllowed ? input.latestApproval?.draftHtmlHash ?? input.currentDraftHtmlHash : null),
    expectedDraftHtmlLength: input.request.expectedDraftHtmlLength ?? (fallbackAllowed ? input.latestApproval?.draftHtmlLength ?? input.currentDraftHtmlLength : null),
    expectedTargetBloggerBlogId:
      input.request.expectedTargetBloggerBlogId ?? (fallbackAllowed ? input.latestApproval?.targetBloggerBlogId ?? input.bloggerConnection?.bloggerBlogId ?? null : null),
    expectedTargetBloggerBlogUrl:
      input.request.expectedTargetBloggerBlogUrl ?? (fallbackAllowed ? input.latestApproval?.targetBloggerBlogUrl ?? input.bloggerConnection?.bloggerBlogUrl ?? null : null),
    expectedBloggerPostId:
      input.request.expectedBloggerPostId ?? (fallbackAllowed ? input.latestApproval?.bloggerPostId ?? input.latestAttempt?.bloggerPostId ?? input.latestDraftSave?.bloggerPostId ?? null : null)
  };
}

function buildBlockingReasons(input: {
  request: ReturnType<typeof normalizeRequest>;
  featureFlagEnabled: boolean;
  confirmationPhraseAccepted: boolean;
  oauthGate: ReturnType<typeof buildPublishOAuthGate>;
  contentStatus: string | null;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  publishApprovalMatchesRequest: boolean;
  publishExecutionAttemptMatchesRequest: boolean;
  contentHashMatchesRequest: boolean;
  targetBlogMatchesRequest: boolean;
  bloggerPostIdMatchesRequest: boolean;
  bloggerPostId: string | null;
  guardedDesignReady: boolean;
  liveExpectedMetadataProvided: boolean;
}) {
  const blockers = new Set<string>();

  if (input.request.mode === "dry_run") {
    blockers.add("guarded_blogger_publish_route_implemented_but_live_disabled");
  }
  if (!input.featureFlagEnabled) {
    blockers.add("live_blogger_publish_feature_flag_disabled");
  }
  if (input.request.mode === "live" && !input.confirmationPhraseAccepted) {
    blockers.add("live_blogger_publish_confirmation_missing");
  }
  if (input.request.mode === "live" && !input.liveExpectedMetadataProvided) {
    blockers.add("live_publish_expected_metadata_missing");
  }
  if (!input.request.rollbackPlanAcknowledged) {
    blockers.add("rollback_plan_not_acknowledged");
  }
  if (!input.request.externalWriteRiskAcknowledged) {
    blockers.add("external_write_risk_not_acknowledged");
  }
  if (!input.request.finalHumanApprovalConfirmed) {
    blockers.add("final_human_approval_required");
  }
  if (!input.publishApprovalMatchesRequest) {
    blockers.add("publish_approval_id_mismatch");
  }
  if (!input.publishExecutionAttemptMatchesRequest) {
    blockers.add("publish_execution_attempt_id_mismatch");
  }
  if (!input.contentHashMatchesRequest) {
    blockers.add("content_hash_mismatch");
  }
  if (!input.targetBlogMatchesRequest) {
    blockers.add("target_blog_mismatch");
  }
  if (!input.bloggerPostId) {
    blockers.add("blogger_post_id_missing");
  } else if (!input.bloggerPostIdMatchesRequest) {
    blockers.add("blogger_post_id_mismatch");
  }
  if (!input.oauthGate.finalPublishExecutionPreflightSummary.oauthGateSatisfied) {
    blockers.add("oauth_gate_not_satisfied");
  }
  if (!input.oauthGate.finalPublishExecutionPreflightSummary.manualReconnectCompletionReady) {
    blockers.add("manual_reconnect_completion_not_ready");
  }
  if (!input.oauthGate.finalPublishExecutionPreflightSummary.finalPreflightReady) {
    blockers.add("final_publish_execution_preflight_not_ready");
  }
  if (input.oauthGate.oauthGateSummary.accessTokenExpired) {
    blockers.add("access_token_expired_reauth_required");
  }
  if (!input.guardedDesignReady) {
    blockers.add("guarded_publish_design_not_ready");
  }
  if (input.contentStatus !== "planned") {
    blockers.add("content_status_not_planned");
  }
  if (input.publishedAt) {
    blockers.add("content_already_published");
  }
  if (input.scheduledAt) {
    blockers.add("content_already_scheduled");
  }

  blockers.add("content_mutation_deferred_to_post_publish_patch");
  return blockers;
}

function hasLiveExpectedMetadata(request: ReturnType<typeof normalizeRequest>) {
  return Boolean(
    request.publishApprovalId &&
      request.publishExecutionAttemptId &&
      request.expectedDraftMarkdownHash &&
      request.expectedDraftHtmlHash &&
      typeof request.expectedDraftHtmlLength === "number" &&
      request.expectedTargetBloggerBlogId &&
      request.expectedTargetBloggerBlogUrl &&
      request.expectedBloggerPostId
  );
}

async function getUsableAccessTokenForPublish(connectionId: string): Promise<{ ok: true; value: string } | { ok: false; errorCode: string; errorMessageRedacted: string }> {
  const accessTokenSecret = await getEncryptedBloggerConnectionSecret(connectionId, "access_token");
  if (!accessTokenSecret) {
    return {
      ok: false,
      errorCode: "access_token_missing",
      errorMessageRedacted: "Blogger access token is missing. Reconnect OAuth before live publish."
    };
  }
  if (accessTokenSecret.expiresAt && accessTokenSecret.expiresAt.getTime() <= Date.now()) {
    return {
      ok: false,
      errorCode: "access_token_expired_reauth_required",
      errorMessageRedacted: "Blogger access token is expired. Manual OAuth reconnect is required before live publish."
    };
  }
  if (!isBloggerSecretEncryptionConfigured()) {
    return {
      ok: false,
      errorCode: "blogger_secret_key_not_configured",
      errorMessageRedacted: "Blogger secret encryption key is not configured."
    };
  }

  try {
    return {
      ok: true,
      value: decryptBloggerSecret(accessTokenSecret.encryptedValue)
    };
  } catch {
    return {
      ok: false,
      errorCode: "token_decryption_failed",
      errorMessageRedacted: "Stored Blogger access token could not be decrypted."
    };
  }
}

function emptyBloggerResult(): GuardedPublishSummary["bloggerResultRedacted"] {
  return {
    attempted: false,
    ok: null,
    status: null,
    bloggerPostId: null,
    bloggerPostUrl: null,
    publishedAt: null,
    updatedAt: null,
    retryable: null,
    errorCode: null,
    errorMessageRedacted: null
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function md5Hex(value: string) {
  return createHash("md5").update(value, "utf8").digest("hex");
}
