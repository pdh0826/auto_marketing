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
  latestApproval: BloggerPublishApprovalAdmin | null;
  latestAttempt: BloggerPublishExecutionAttemptAdmin | null;
  checkedAt?: Date;
}

export function buildPublishOAuthGate(input: BuildPublishOAuthGateInput): PublishOAuthGateResponse {
  const checkedAt = input.checkedAt ?? new Date();
  const accessTokenExpired = isExpired(input.accessTokenExpiresAt);
  const accessTokenState = getAccessTokenState({
    connectionFound: Boolean(input.connection),
    hasAccessToken: input.hasAccessToken,
    accessTokenExpired
  });
  const reauthRequired = accessTokenState === "expired_reauth_required" || accessTokenState === "missing" || accessTokenState === "unknown";
  const blockingReasons = new Set<string>([
    "oauth_gate_not_satisfied",
    "publish_execution_not_allowed_until_oauth_gate_passes"
  ]);
  const warnings = new Set<string>();

  if (!input.connection) {
    blockingReasons.add("blogger_connection_missing");
  }
  if (input.connectionCount > 1) {
    blockingReasons.add("multiple_blogger_connections_need_manual_selection");
  }
  if (!input.connection?.bloggerBlogId) {
    blockingReasons.add("blogger_blog_selection_missing");
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
    requiredBeforePublishExecution: [...REQUIRED_BEFORE_PUBLISH_OAUTH_GATE],
    requiredBeforeScheduledPublishExecution: [...REQUIRED_BEFORE_SCHEDULED_PUBLISH_OAUTH_GATE],
    sideEffectSummary: {
      dbRead: true,
      dbWrite: false,
      oauthReconnect: false,
      tokenRefresh: false,
      bloggerApiWrite: false,
      bloggerPublish: false,
      bloggerScheduledPublish: false,
      bloggerPostsUpdate: false,
      bloggerDraftSave: false,
      contentItemMutation: false,
      llmCall: false
    }
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

function isExpired(value: string | null) {
  if (!value) {
    return false;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time <= Date.now();
}
