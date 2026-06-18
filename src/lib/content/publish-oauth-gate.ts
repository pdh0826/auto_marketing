import { createHash } from "node:crypto";
import type { BloggerPublishApprovalAdmin, BloggerPublishExecutionAttemptAdmin, PublishOAuthAccessTokenState, PublishOAuthGateResponse } from "@/lib/blogger/admin-types";

export const REQUIRED_BEFORE_PUBLISH_OAUTH_GATE = [
  "Blogger connection must exist for the content item's blog",
  "Verified target Blogger blog selection must exist",
  "Blogger access token must be present and not expired",
  "Manual OAuth reconnect must be completed in Blogger settings when token is expired",
  "Token refresh remains unimplemented and must not be called automatically"
] as const;

export const REQUIRED_BEFORE_SCHEDULED_PUBLISH_OAUTH_GATE = [
  ...REQUIRED_BEFORE_PUBLISH_OAUTH_GATE,
  "Scheduled publish execution preflight must be implemented separately",
  "Schedule mutation and partial failure policy must be approved separately"
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
  const blockingReasons = new Set<string>(reconnectCompletionSummary.blockingReasons);
  finalPublishExecutionPreflightSummary.blockingReasons.forEach((reason) => blockingReasons.add(reason));
  const warnings = new Set<string>();
  finalPublishExecutionPreflightSummary.warnings.forEach((warning) => warnings.add(warning));

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
    blockingReasons.add("manual_blogger_oauth_reconnect_required");
    blockingReasons.add("token_refresh_not_implemented");
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

  return {
    contentItemId: input.contentItemId,
    checkedAt: checkedAt.toISOString(),
    canProceedToPublishExecution: false,
    canProceedToScheduledPublishExecution: false,
    canExecutePublish: false,
    canExecuteScheduledPublish: false,
    canPublish: false,
    canSchedulePublish: false,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings),
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
      tokenRefreshImplemented: false,
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
    "guarded_blogger_publish_not_implemented",
    "publish_execution_still_disabled_until_guarded_publish_implementation",
    "rollback_plan_not_acknowledged",
    "external_write_risk_not_acknowledged",
    "final_human_approval_required"
  ]);
  const warnings = new Set<string>();

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
    tokenRefreshImplemented: false,
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
  const blockingReasons = new Set<string>([
    "final_publish_preflight_not_implemented",
    "publish_execution_still_disabled_until_final_preflight"
  ]);
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
    tokenRefreshImplemented: false,
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
