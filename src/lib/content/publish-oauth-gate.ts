import { createHash } from "node:crypto";
import { buildOperationProfileExceptionDashboardSummary } from "@/lib/blog-operation-profiles/operation-profile-exception-dashboard";
import type { OperationProfileAdvisorySummary } from "@/lib/blog-operation-profiles/operation-profile-summary";
import type { BloggerPublishApprovalAdmin, BloggerPublishExecutionAttemptAdmin, PublishOAuthAccessTokenState, PublishOAuthGateResponse } from "@/lib/blogger/admin-types";

export const REQUIRED_BEFORE_PUBLISH_OAUTH_GATE = [
  "Blogger connection must exist for the content item's blog",
  "Verified target Blogger blog selection must exist",
  "Blogger access token must be present and not expired",
  "Use the Blogger settings token refresh action when the access token is expired",
  "Manual OAuth reconnect is still required if refresh token is missing or invalid"
] as const;

export const REQUIRED_BEFORE_SCHEDULED_PUBLISH_OAUTH_GATE = [
  ...REQUIRED_BEFORE_PUBLISH_OAUTH_GATE,
  "Scheduled publish execution preflight must be implemented separately",
  "Schedule mutation and partial failure policy must be approved separately"
] as const;

export const REQUIRED_BEFORE_GUARDED_PUBLISH_IMPLEMENTATION = [
  "Guarded Blogger publish route is implemented but live execution remains disabled by default",
  "Use only the approved publish snapshot and saved execution attempt as inputs for live execution",
  "Require one explicit user-approved Blogger publish/write call",
  "Record a redacted publish execution result without storing raw Blogger response bodies",
  "Define readback and retry policy before enabling any content item mutation"
] as const;

export const REQUIRED_BEFORE_GUARDED_PUBLISH_EXECUTION = [
  "Final publish execution preflight must be ready",
  "Guarded publish implementation must be present",
  "Rollback plan must be acknowledged",
  "External write risk must be acknowledged",
  "Final human approval must be captured immediately before execution"
] as const;

export interface BuildPublishOAuthGateInput {
  contentItemId: string;
  connection: {
    id: string;
    bloggerBlogId: string | null;
    bloggerBlogName: string | null;
    bloggerBlogUrl: string | null;
  } | null;
  connectionCount: number;
  hasAccessToken: boolean;
  accessTokenExpiresAt: string | null;
  contentStatus: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  draftMarkdown: string | null;
  draftHtml: string | null;
  latestApproval: BloggerPublishApprovalAdmin | null;
  latestAttempt: BloggerPublishExecutionAttemptAdmin | null;
  operationProfileAdvisorySummary: OperationProfileAdvisorySummary;
  checkedAt?: Date;
}

export function buildPublishOAuthGate(input: BuildPublishOAuthGateInput): PublishOAuthGateResponse {
  const checkedAt = input.checkedAt ?? new Date();
  const currentDraftMarkdownHash = md5Hex(input.draftMarkdown ?? "");
  const currentDraftHtmlHash = md5Hex(input.draftHtml ?? "");
  const accessTokenExpired = isExpired(input.accessTokenExpiresAt);
  const accessTokenState = getAccessTokenState({
    connectionFound: Boolean(input.connection),
    hasAccessToken: input.hasAccessToken,
    accessTokenExpired
  });
  const reauthRequired = accessTokenState === "expired_reauth_required" || accessTokenState === "missing" || accessTokenState === "unknown";
  const reconnectCompletionSummary = buildManualReconnectCompletionSummary({
    input,
    accessTokenState,
    reauthRequired,
    currentDraftMarkdownHash,
    currentDraftHtmlHash
  });
  const finalPublishExecutionPreflightSummary = buildFinalPublishExecutionPreflightSummary({
    input,
    reconnectCompletionSummary
  });
  const guardedPublishExecutionDesignSummary = buildGuardedPublishExecutionDesignSummary({
    input,
    finalPublishExecutionPreflightSummary
  });
  const blockingReasons = new Set<string>(reconnectCompletionSummary.blockingReasons);
  finalPublishExecutionPreflightSummary.blockingReasons.forEach((reason) => blockingReasons.add(reason));
  guardedPublishExecutionDesignSummary.blockingReasons.forEach((reason) => blockingReasons.add(reason));
  const warnings = new Set<string>();
  finalPublishExecutionPreflightSummary.warnings.forEach((warning) => warnings.add(warning));
  guardedPublishExecutionDesignSummary.warnings.forEach((warning) => warnings.add(warning));

  if (!input.connection) {
    blockingReasons.add("blogger_connection_missing");
  }
  if (input.connectionCount > 1) {
    blockingReasons.add("multiple_blogger_connections_need_manual_selection");
  }
  if (!input.connection?.bloggerBlogId) {
    blockingReasons.add("blogger_blog_selection_missing");
  }
  if (!reconnectCompletionSummary.reconnectCompletionReady) {
    blockingReasons.add("oauth_gate_not_satisfied");
    blockingReasons.add("publish_execution_not_allowed_until_oauth_gate_passes");
    blockingReasons.add("manual_reconnect_completion_not_ready");
  }
  if (accessTokenState === "expired_reauth_required") {
    blockingReasons.add("access_token_expired_reauth_required");
    blockingReasons.add("manual_token_refresh_required");
  } else if (accessTokenState === "missing") {
    blockingReasons.add("access_token_missing");
    blockingReasons.add("manual_blogger_oauth_reconnect_required");
  } else if (accessTokenState === "unknown") {
    blockingReasons.add("access_token_state_unknown");
    blockingReasons.add("manual_blogger_oauth_reconnect_required");
  }
  if (input.latestApproval && reauthRequired) {
    warnings.add("saved_publish_approval_exists_but_oauth_gate_blocks_execution");
  }
  if (input.latestAttempt && reauthRequired) {
    warnings.add("saved_publish_attempt_exists_but_oauth_gate_blocks_execution");
  }
  const topLevelBlockingReasons = Array.from(blockingReasons);
  const operationProfileExceptionDashboardSummary = buildOperationProfileExceptionDashboardSummary({
    advisorySummary: input.operationProfileAdvisorySummary,
    existingGateBlockingReasons: topLevelBlockingReasons
  });

  return {
    contentItemId: input.contentItemId,
    checkedAt: checkedAt.toISOString(),
    canProceedToPublishExecution: false,
    canProceedToScheduledPublishExecution: false,
    canExecutePublish: false,
    canExecuteScheduledPublish: false,
    canPublish: false,
    canSchedulePublish: false,
    blockingReasons: topLevelBlockingReasons,
    warnings: Array.from(warnings),
    operationProfileAdvisorySummary: input.operationProfileAdvisorySummary,
    operationProfileExceptionDashboardSummary,
    oauthGateSummary: {
      connectionFound: Boolean(input.connection),
      selectedBloggerBlogFound: Boolean(input.connection?.bloggerBlogId),
      targetBloggerBlogId: input.connection?.bloggerBlogId ?? null,
      targetBloggerBlogName: input.connection?.bloggerBlogName ?? null,
      targetBloggerBlogUrl: input.connection?.bloggerBlogUrl ?? null,
      accessTokenState,
      accessTokenExpired,
      reauthRequired,
      manualReconnectRequired: reauthRequired,
      tokenRefreshImplemented: true,
      autoReconnectImplemented: false,
      reconnectSettingsPath: "/settings/blogger",
      publishApprovalId: input.latestApproval?.id ?? null,
      publishExecutionAttemptId: input.latestAttempt?.id ?? null
    },
    manualReconnectCompletionSummary: {
      ...reconnectCompletionSummary,
      blockingReasons: Array.from(new Set([...reconnectCompletionSummary.blockingReasons])),
      warnings: Array.from(new Set([...reconnectCompletionSummary.warnings]))
    },
    finalPublishExecutionPreflightSummary,
    guardedPublishExecutionDesignSummary,
    requiredBeforePublishExecution: [...REQUIRED_BEFORE_PUBLISH_OAUTH_GATE],
    requiredBeforeScheduledPublishExecution: [...REQUIRED_BEFORE_SCHEDULED_PUBLISH_OAUTH_GATE],
    sideEffectSummary: {
      dbRead: true,
      dbWrite: false,
      bloggerRead: false,
      bloggerWrite: false,
      oauthReconnect: false,
      tokenRefresh: false,
      bloggerApiWrite: false,
      bloggerPublish: false,
      bloggerScheduledPublish: false,
      bloggerPostsUpdate: false,
      bloggerDraftSave: false,
      contentMutation: false,
      contentItemMutation: false,
      llmCall: false
    }
  };
}

function buildGuardedPublishExecutionDesignSummary(input: {
  input: BuildPublishOAuthGateInput;
  finalPublishExecutionPreflightSummary: PublishOAuthGateResponse["finalPublishExecutionPreflightSummary"];
}): PublishOAuthGateResponse["guardedPublishExecutionDesignSummary"] {
  const { input: gateInput, finalPublishExecutionPreflightSummary } = input;
  const approval = gateInput.latestApproval;
  const attempt = gateInput.latestAttempt;
  const existingBloggerPostId = approval?.bloggerPostId ?? attempt?.bloggerPostId ?? null;
  const plannedOperationKind = getPlannedOperationKind({
    bloggerPostId: existingBloggerPostId,
    bloggerDraftSaveId: approval?.bloggerDraftSaveId ?? null
  });
  const plannedBloggerApiAction = existingBloggerPostId ? "blogger.posts.publish" : "to_be_decided_in_9E_9B";
  const blockingReasons = new Set<string>([
    "guarded_blogger_publish_route_implemented_but_live_disabled",
    "rollback_plan_not_acknowledged",
    "external_write_risk_not_acknowledged",
    "final_human_approval_required"
  ]);
  const warnings = new Set<string>();

  if (process.env.BLOGGER_GUARDED_PUBLISH_LIVE_ENABLED !== "true") {
    blockingReasons.add("live_blogger_publish_feature_flag_disabled");
  }
  if (!finalPublishExecutionPreflightSummary.finalPreflightReady) {
    blockingReasons.add("final_publish_execution_preflight_not_ready");
  }
  if (!existingBloggerPostId) {
    warnings.add("blogger_post_id_missing_for_publish_design");
  }
  if (plannedBloggerApiAction === "to_be_decided_in_9E_9B") {
    warnings.add("blogger_publish_api_action_to_be_decided");
  }

  return {
    checked: true,
    designVersion: "9E-9A",
    implementationStatus: "implemented_live_guarded",
    routePath: "/api/content-items/[id]/guarded-publish-execution",
    finalPreflightReady: finalPublishExecutionPreflightSummary.finalPreflightReady,
    guardedPublishImplementationReady: true,
    canProceedToPublishExecution: false,
    canProceedToScheduledPublishExecution: false,
    canExecutePublish: false,
    oauthGateSatisfied: finalPublishExecutionPreflightSummary.oauthGateSatisfied,
    manualReconnectCompletionReady: finalPublishExecutionPreflightSummary.manualReconnectCompletionReady,
    publishApprovalStillValid: finalPublishExecutionPreflightSummary.publishApprovalStillValid,
    publishExecutionAttemptStillPlanningOnly: finalPublishExecutionPreflightSummary.publishExecutionAttemptStillPlanningOnly,
    contentSnapshotMatchesApproval: finalPublishExecutionPreflightSummary.contentSnapshotMatchesApproval,
    targetBlogSnapshotMatchesCurrentSelection: finalPublishExecutionPreflightSummary.targetBlogSnapshotMatchesCurrentSelection,
    contentItemId: gateInput.contentItemId,
    publishApprovalId: approval?.id ?? null,
    publishExecutionAttemptId: attempt?.id ?? null,
    bloggerDraftSaveId: approval?.bloggerDraftSaveId ?? null,
    targetBloggerBlogId: approval?.targetBloggerBlogId ?? attempt?.targetBloggerBlogId ?? gateInput.connection?.bloggerBlogId ?? null,
    targetBloggerBlogName: approval?.targetBloggerBlogName ?? gateInput.connection?.bloggerBlogName ?? null,
    targetBloggerBlogUrl: approval?.targetBloggerBlogUrl ?? gateInput.connection?.bloggerBlogUrl ?? null,
    existingBloggerPostId,
    plannedOperationKind,
    plannedBloggerApiAction,
    bloggerApiCallAllowedNow: false,
    bloggerWriteWillBeRequiredInFuturePatch: true,
    requiredBeforeImplementation: [...REQUIRED_BEFORE_GUARDED_PUBLISH_IMPLEMENTATION],
    requiredBeforeExecution: [...REQUIRED_BEFORE_GUARDED_PUBLISH_EXECUTION],
    rollbackPlanAcknowledged: false,
    externalWriteRiskAcknowledged: false,
    finalHumanApprovalRequired: true,
    redactedBloggerRequestPlan: {
      method: plannedBloggerApiAction === "blogger.posts.publish" ? "POST" : "UNKNOWN",
      endpointKind: plannedBloggerApiAction === "blogger.posts.publish" ? "blogger.posts.publish" : "to_be_decided",
      bloggerBlogId: approval?.targetBloggerBlogId ?? attempt?.targetBloggerBlogId ?? gateInput.connection?.bloggerBlogId ?? null,
      bloggerPostId: existingBloggerPostId,
      usesAccessToken: true,
      accessTokenIncluded: false,
      requestBodyIncluded: false,
      requestBodyHashOnly: true,
      draftHtmlHash: approval?.draftHtmlHash ?? attempt?.draftHtmlHash ?? null,
      titleCandidate: approval?.titleCandidate ?? attempt?.titleCandidate ?? null
    },
    failurePolicyDraft: {
      retryEligibleByDefault: false,
      retryRequiresReadback: true,
      partialFailureRequiresManualReview: true,
      contentMutationAfterBloggerSuccessOnly: true,
      noContentMutationOnUnknownBloggerResult: true
    },
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings),
    sideEffectSummary: {
      dbRead: true,
      dbWrite: false,
      bloggerRead: false,
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
}

function buildFinalPublishExecutionPreflightSummary(input: {
  input: BuildPublishOAuthGateInput;
  reconnectCompletionSummary: PublishOAuthGateResponse["manualReconnectCompletionSummary"];
}): PublishOAuthGateResponse["finalPublishExecutionPreflightSummary"] {
  const { input: gateInput, reconnectCompletionSummary } = input;
  const approval = gateInput.latestApproval;
  const attempt = gateInput.latestAttempt;
  const contentExists = Boolean(gateInput.contentItemId);
  const contentAlreadyPublished = gateInput.contentStatus === "published" || Boolean(gateInput.publishedAt);
  const contentAlreadyScheduled = gateInput.contentStatus === "scheduled" || Boolean(gateInput.scheduledAt);
  const contentSnapshotMatchesApproval = Boolean(
    reconnectCompletionSummary.draftMarkdownHashMatchesApprovalSnapshot === true && reconnectCompletionSummary.draftHtmlHashMatchesApprovalSnapshot === true
  );
  const oauthGateSatisfied = Boolean(reconnectCompletionSummary.reconnectCompletionReady && !reconnectCompletionSummary.reauthRequired);
  const coreReadOnlyReady = Boolean(
    oauthGateSatisfied &&
      reconnectCompletionSummary.publishApprovalStillValid &&
      reconnectCompletionSummary.publishExecutionAttemptStillPlanningOnly &&
      reconnectCompletionSummary.contentStillPlanned &&
      !contentAlreadyPublished &&
      !contentAlreadyScheduled &&
      contentSnapshotMatchesApproval &&
      reconnectCompletionSummary.targetBlogMatchesApprovalSnapshot === true
  );
  const blockingReasons = new Set<string>([
    "guarded_blogger_publish_route_implemented_but_live_disabled",
    "rollback_plan_not_acknowledged",
    "external_write_risk_not_acknowledged",
    "final_human_approval_required"
  ]);
  const warnings = new Set<string>();

  if (process.env.BLOGGER_GUARDED_PUBLISH_LIVE_ENABLED !== "true") {
    blockingReasons.add("live_blogger_publish_feature_flag_disabled");
  }
  if (!coreReadOnlyReady) {
    blockingReasons.add("final_publish_execution_preflight_not_ready");
  }
  if (!oauthGateSatisfied) {
    blockingReasons.add("oauth_gate_not_satisfied");
  }
  if (!reconnectCompletionSummary.reconnectCompletionReady) {
    blockingReasons.add("manual_reconnect_completion_not_ready");
  }
  if (reconnectCompletionSummary.accessTokenState === "expired_reauth_required") {
    blockingReasons.add("access_token_still_expired_reauth_required");
  }
  if (reconnectCompletionSummary.accessTokenState === "missing") {
    blockingReasons.add("access_token_missing_after_reconnect");
  }
  addFinalBlocker(!reconnectCompletionSummary.bloggerConnectionExists, blockingReasons, "blogger_connection_missing");
  addFinalBlocker(!reconnectCompletionSummary.selectedBlogExists, blockingReasons, "selected_blog_missing");
  addFinalBlocker(reconnectCompletionSummary.selectedBlogMatchesApprovalTarget === false, blockingReasons, "selected_blog_mismatch_after_reconnect");
  addFinalBlocker(reconnectCompletionSummary.targetBlogMatchesApprovalSnapshot === false, blockingReasons, "target_blog_snapshot_mismatch_after_reconnect");
  addFinalBlocker(!reconnectCompletionSummary.publishApprovalExists, blockingReasons, "publish_approval_missing");
  addFinalBlocker(reconnectCompletionSummary.publishApprovalInvalidated, blockingReasons, "publish_approval_invalidated");
  addFinalBlocker(approval ? !reconnectCompletionSummary.publishApprovalStillValid : false, blockingReasons, "publish_approval_snapshot_mismatch");
  addFinalBlocker(!reconnectCompletionSummary.publishExecutionAttemptExists, blockingReasons, "publish_execution_attempt_missing");
  addFinalBlocker(
    reconnectCompletionSummary.publishExecutionAttemptExists && !reconnectCompletionSummary.publishExecutionAttemptStillPlanningOnly,
    blockingReasons,
    "publish_execution_attempt_not_planning_only"
  );
  addFinalBlocker(!contentExists, blockingReasons, "content_missing");
  addFinalBlocker(!reconnectCompletionSummary.contentStillPlanned, blockingReasons, "content_status_not_planned");
  addFinalBlocker(contentAlreadyPublished, blockingReasons, "content_already_published");
  addFinalBlocker(contentAlreadyScheduled, blockingReasons, "content_already_scheduled");
  addFinalBlocker(!contentSnapshotMatchesApproval, blockingReasons, "draft_snapshot_mismatch_after_reconnect");

  reconnectCompletionSummary.warnings.forEach((warning) => warnings.add(warning));
  if (attempt && approval && attempt.publishApprovalId !== approval.id) {
    warnings.add("publish_execution_attempt_approval_mismatch");
  }

  return {
    checked: true,
    finalPreflightReady: coreReadOnlyReady,
    canProceedToPublishExecution: false,
    canProceedToScheduledPublishExecution: false,
    canExecutePublish: false,
    oauthGateSatisfied,
    manualReconnectCompletionReady: reconnectCompletionSummary.reconnectCompletionReady,
    accessTokenState: reconnectCompletionSummary.accessTokenState,
    reauthRequired: reconnectCompletionSummary.reauthRequired,
    manualReconnectRequired: reconnectCompletionSummary.manualReconnectRequired,
    tokenRefreshImplemented: true,
    autoReconnectImplemented: false,
    bloggerConnectionExists: reconnectCompletionSummary.bloggerConnectionExists,
    selectedBlogExists: reconnectCompletionSummary.selectedBlogExists,
    selectedBlogMatchesApprovalTarget: reconnectCompletionSummary.selectedBlogMatchesApprovalTarget,
    targetBlogSnapshotMatchesCurrentSelection: reconnectCompletionSummary.targetBlogMatchesApprovalSnapshot,
    publishApprovalExists: reconnectCompletionSummary.publishApprovalExists,
    publishApprovalStillValid: reconnectCompletionSummary.publishApprovalStillValid,
    publishApprovalInvalidated: reconnectCompletionSummary.publishApprovalInvalidated,
    publishApprovalId: approval?.id ?? null,
    publishExecutionAttemptExists: reconnectCompletionSummary.publishExecutionAttemptExists,
    publishExecutionAttemptStillPlanningOnly: reconnectCompletionSummary.publishExecutionAttemptStillPlanningOnly,
    publishExecutionAttemptId: attempt?.id ?? null,
    contentExists,
    contentStillPlanned: reconnectCompletionSummary.contentStillPlanned,
    contentAlreadyPublished,
    contentAlreadyScheduled,
    draftMarkdownHashMatchesApprovalSnapshot: reconnectCompletionSummary.draftMarkdownHashMatchesApprovalSnapshot,
    draftHtmlHashMatchesApprovalSnapshot: reconnectCompletionSummary.draftHtmlHashMatchesApprovalSnapshot,
    contentSnapshotMatchesApproval,
    rollbackPlanAcknowledged: false,
    externalWriteRiskAcknowledged: false,
    finalHumanApprovalRequired: true,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings),
    sideEffectSummary: {
      dbRead: true,
      dbWrite: false,
      bloggerRead: false,
      bloggerWrite: false,
      bloggerPublish: false,
      bloggerUpdate: false,
      tokenRefresh: false,
      oauthReconnect: false,
      contentMutation: false,
      approvalMutation: false,
      attemptMutation: false,
      llmCall: false,
      externalSend: false
    }
  };
}

function buildManualReconnectCompletionSummary(input: {
  input: BuildPublishOAuthGateInput;
  accessTokenState: PublishOAuthAccessTokenState;
  reauthRequired: boolean;
  currentDraftMarkdownHash: string;
  currentDraftHtmlHash: string;
}): PublishOAuthGateResponse["manualReconnectCompletionSummary"] {
  const { input: gateInput } = input;
  const approval = gateInput.latestApproval;
  const attempt = gateInput.latestAttempt;
  const bloggerConnectionExists = Boolean(gateInput.connection);
  const selectedBlogExists = Boolean(gateInput.connection?.bloggerBlogId);
  const selectedBlogMatchesApprovalTarget = approval ? compareNullable(gateInput.connection?.bloggerBlogId ?? null, approval.targetBloggerBlogId) : null;
  const publishApprovalStillValid = Boolean(approval && approval.status === "approved_snapshot" && !approval.invalidatedAt);
  const publishApprovalInvalidated = Boolean(approval?.invalidatedAt || (approval && approval.status !== "approved_snapshot"));
  const publishExecutionAttemptStillPlanningOnly = Boolean(attempt && attempt.status === "planned_only");
  const contentStillPlanned = gateInput.contentStatus === "planned";
  const draftMarkdownHashMatchesApprovalSnapshot = approval ? compareNullable(input.currentDraftMarkdownHash, approval.draftMarkdownHash) : null;
  const draftHtmlHashMatchesApprovalSnapshot = approval ? compareNullable(input.currentDraftHtmlHash, approval.draftHtmlHash) : null;
  const targetBlogMatchesApprovalSnapshot = approval ? compareNullable(gateInput.connection?.bloggerBlogId ?? null, approval.targetBloggerBlogId) : null;
  const completionAccessTokenState = toManualReconnectCompletionAccessTokenState(input.accessTokenState);
  const blockingReasons = new Set<string>();
  const warnings = new Set<string>();

  if (!bloggerConnectionExists) {
    blockingReasons.add("blogger_connection_missing");
  }
  if (!selectedBlogExists) {
    blockingReasons.add("selected_blog_missing");
  }
  if (selectedBlogMatchesApprovalTarget === false) {
    blockingReasons.add("selected_blog_mismatch_after_reconnect");
  }
  if (completionAccessTokenState === "expired_reauth_required") {
    blockingReasons.add("access_token_still_expired_reauth_required");
  }
  if (completionAccessTokenState === "missing") {
    blockingReasons.add("access_token_missing_after_reconnect");
  }
  if (!approval) {
    blockingReasons.add("publish_approval_missing");
  }
  if (publishApprovalInvalidated) {
    blockingReasons.add("publish_approval_invalidated");
  }
  if (!attempt) {
    blockingReasons.add("publish_execution_attempt_missing");
  }
  if (attempt && !publishExecutionAttemptStillPlanningOnly) {
    blockingReasons.add("publish_execution_attempt_not_planning_only");
  }
  if (!contentStillPlanned) {
    blockingReasons.add("content_status_not_planned");
  }
  if (draftMarkdownHashMatchesApprovalSnapshot === false || draftHtmlHashMatchesApprovalSnapshot === false) {
    blockingReasons.add("draft_snapshot_mismatch_after_reconnect");
  }
  if (targetBlogMatchesApprovalSnapshot === false) {
    blockingReasons.add("target_blog_snapshot_mismatch_after_reconnect");
  }
  if (input.reauthRequired) {
    warnings.add("manual_oauth_reconnect_required_before_final_publish_preflight");
  }
  if (approval && attempt && approval.id !== attempt.publishApprovalId) {
    warnings.add("latest_publish_attempt_uses_different_approval");
  }

  const reconnectCompletionReady = Boolean(
    bloggerConnectionExists &&
      selectedBlogExists &&
      selectedBlogMatchesApprovalTarget !== false &&
      completionAccessTokenState === "valid" &&
      publishApprovalStillValid &&
      attempt &&
      publishExecutionAttemptStillPlanningOnly &&
      contentStillPlanned &&
      draftMarkdownHashMatchesApprovalSnapshot !== false &&
      draftHtmlHashMatchesApprovalSnapshot !== false &&
      targetBlogMatchesApprovalSnapshot !== false
  );

  if (!reconnectCompletionReady) {
    blockingReasons.add("manual_reconnect_completion_not_ready");
  }

  return {
    checked: true,
    reconnectSettingsPath: "/settings/blogger",
    bloggerConnectionExists,
    selectedBlogExists,
    selectedBlogMatchesApprovalTarget,
    accessTokenState: completionAccessTokenState,
    reauthRequired: input.reauthRequired,
    manualReconnectRequired: input.reauthRequired,
    tokenRefreshImplemented: true,
    autoReconnectImplemented: false,
    publishApprovalExists: Boolean(approval),
    publishApprovalStillValid,
    publishApprovalInvalidated,
    publishExecutionAttemptExists: Boolean(attempt),
    publishExecutionAttemptStillPlanningOnly,
    contentStillPlanned,
    draftMarkdownHashMatchesApprovalSnapshot,
    draftHtmlHashMatchesApprovalSnapshot,
    targetBlogMatchesApprovalSnapshot,
    reconnectCompletionReady,
    canProceedToFinalPublishPreflight: false,
    canExecutePublish: false,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings)
  };
}

function getAccessTokenState(input: { connectionFound: boolean; hasAccessToken: boolean; accessTokenExpired: boolean }): PublishOAuthAccessTokenState {
  if (!input.connectionFound) {
    return "unknown";
  }
  if (!input.hasAccessToken) {
    return "missing";
  }
  if (input.accessTokenExpired) {
    return "expired_reauth_required";
  }
  return "valid_not_verified";
}

function toManualReconnectCompletionAccessTokenState(state: PublishOAuthAccessTokenState): PublishOAuthGateResponse["manualReconnectCompletionSummary"]["accessTokenState"] {
  if (state === "valid_not_verified") {
    return "valid";
  }
  return state;
}

function compareNullable(left: string | null, right: string | null) {
  if (left === null && right === null) {
    return true;
  }
  if (left === null || right === null) {
    return false;
  }
  return left === right;
}

function addFinalBlocker(condition: boolean, blockers: Set<string>, reason: string) {
  if (condition) {
    blockers.add(reason);
  }
}

function getPlannedOperationKind(input: {
  bloggerPostId: string | null;
  bloggerDraftSaveId: string | null;
}): PublishOAuthGateResponse["guardedPublishExecutionDesignSummary"]["plannedOperationKind"] {
  if (!input.bloggerPostId) {
    return "unknown_until_publish_implementation";
  }
  if (input.bloggerDraftSaveId) {
    return "publish_existing_blogger_draft";
  }
  return "publish_existing_blogger_post";
}

function isExpired(value: string | null) {
  if (!value) {
    return false;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time <= Date.now();
}

function md5Hex(value: string) {
  return createHash("md5").update(value, "utf8").digest("hex");
}
