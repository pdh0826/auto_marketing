import type {
  BloggerDraftSaveAdmin,
  BloggerPublishApprovalAdmin,
  PublishApprovalExecutionGuardResponse,
  PublishExecutionAttemptPreviewResponse
} from "@/lib/blogger/admin-types";

export const REQUIRED_BEFORE_PUBLISH_ATTEMPT_STORAGE = [
  "Create and migrate a publish execution attempt audit table",
  "Define attempt uniqueness and idempotency constraints by publishApprovalId",
  "Define redacted Blogger request/response summary storage",
  "Define retry eligibility and partial failure verification policy",
  "Define content_items status/publishedAt mutation ordering"
] as const;

export const PUBLISH_ATTEMPT_RETRY_ELIGIBLE_EXAMPLES = [
  "network_timeout_before_blogger_confirmation",
  "temporary_5xx",
  "rate_limited_retry_after",
  "unknown_transient_failure_before_any_confirmed_side_effect"
] as const;

export const PUBLISH_ATTEMPT_RETRY_BLOCKED_EXAMPLES = [
  "approval_snapshot_mismatch",
  "approval_invalidated",
  "token_expired_reauth_required",
  "blogger_4xx_auth_or_scope_error",
  "blogger_post_already_published",
  "publish_already_succeeded",
  "content_hash_changed",
  "blogger_post_id_changed",
  "manual_abort",
  "unknown_side_effect_state_after_timeout"
] as const;

export const PUBLISH_ATTEMPT_PARTIAL_FAILURE_EXAMPLES = [
  "Blogger publish succeeded but local content_items mutation failed",
  "Blogger publish result unknown because request timed out after possible side effect",
  "local attempt log write succeeded but Blogger call failed",
  "Blogger call succeeded but response parsing failed",
  "content_items.status update succeeded but publishedAt update failed"
] as const;

export const PUBLISH_ATTEMPT_REDACTION_POLICY = [
  "Do not store or expose access tokens, refresh tokens, client secrets, encrypted values, or raw OAuth responses",
  "Do not store raw Blogger response/error bodies; keep only redacted status/code/message and safe post identifiers",
  "Do not store full draftHtml, prompt, raw LLM response, or full generated candidate body in attempt metadata",
  "Store hashes, lengths, ids, timestamps, and short safe error codes instead of raw payloads"
] as const;

export const PUBLISH_ATTEMPT_CONTENT_MUTATION_ORDERING = [
  "Persist attempt_started before any future Blogger publish call",
  "Record Blogger result in the attempt log before mutating content_items",
  "Only after confirmed Blogger success should a separate local mutation step update status/publishedAt or scheduledAt",
  "If local mutation fails after Blogger success, mark partial_failure and require manual verification before retry"
] as const;

export interface BuildPublishExecutionAttemptPreviewInput {
  contentItemId: string;
  executionGuard: PublishApprovalExecutionGuardResponse;
  latestApproval: BloggerPublishApprovalAdmin | null;
  latestSuccessfulDraftSave: BloggerDraftSaveAdmin | null;
  checkedAt?: Date;
}

export function buildPublishExecutionAttemptPreview(input: BuildPublishExecutionAttemptPreviewInput): PublishExecutionAttemptPreviewResponse {
  const checkedAt = input.checkedAt ?? new Date();
  const blockingReasons = new Set<string>([
    "attempt_storage_not_implemented",
    "publish_execution_not_implemented",
    "content_item_mutation_policy_not_implemented",
    ...input.executionGuard.blockingReasons
  ]);
  const warnings = new Set<string>(input.executionGuard.warnings);
  const approval = input.latestApproval;
  const latestDraftSave = input.latestSuccessfulDraftSave;
  const tokenStateAtAttempt = blockingReasons.has("access_token_expired_reauth_required")
    ? "expired_reauth_required"
    : approval?.tokenState ?? null;

  if (!approval) {
    blockingReasons.add("publish_approval_missing");
  }
  if (!input.executionGuard.approvalMatchesCurrentState) {
    blockingReasons.add("publish_approval_current_state_mismatch");
  }

  return {
    contentItemId: input.contentItemId,
    checkedAt: checkedAt.toISOString(),
    approvalId: approval?.id ?? input.executionGuard.approvalId,
    approvalSnapshotHash: approval?.snapshotHash ?? input.executionGuard.approvalSnapshotHash,
    attemptStorageImplemented: false,
    wouldCreateAttempt: false,
    canCreateAttempt: false,
    canExecutePublish: false,
    canExecuteScheduledPublish: false,
    canPublish: false,
    canSchedulePublish: false,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings),
    plannedAttempt: {
      futureTable: "blogger_publish_execution_attempts",
      mode: approval?.mode ?? null,
      status: "planned_only",
      publishApprovalId: approval?.id ?? input.executionGuard.approvalId,
      publishApprovalSnapshotHash: approval?.snapshotHash ?? input.executionGuard.approvalSnapshotHash,
      targetBloggerBlogId: approval?.targetBloggerBlogId ?? latestDraftSave?.targetBloggerBlogId ?? null,
      bloggerPostId: approval?.bloggerPostId ?? latestDraftSave?.bloggerPostId ?? null,
      draftHtmlHash: approval?.draftHtmlHash ?? null,
      titleCandidate: approval?.titleCandidate ?? latestDraftSave?.titleCandidate ?? null,
      tokenStateAtAttempt,
      executionGuardCheckedAt: input.executionGuard.checkedAt,
      approvalMatchesCurrentState: input.executionGuard.approvalFound ? input.executionGuard.approvalMatchesCurrentState : null,
      invalidationCandidates: input.executionGuard.invalidationCandidates,
      retryEligible: false,
      contentMutationPlanned: false,
      bloggerApiWritePlanned: false
    },
    requiredBeforeAttemptStorage: [...REQUIRED_BEFORE_PUBLISH_ATTEMPT_STORAGE],
    requiredBeforeExecution: input.executionGuard.requiredBeforeExecution,
    failurePolicySummary: {
      retryEligibleExamples: [...PUBLISH_ATTEMPT_RETRY_ELIGIBLE_EXAMPLES],
      retryBlockedExamples: [...PUBLISH_ATTEMPT_RETRY_BLOCKED_EXAMPLES],
      partialFailureExamples: [...PUBLISH_ATTEMPT_PARTIAL_FAILURE_EXAMPLES]
    },
    redactionPolicySummary: [...PUBLISH_ATTEMPT_REDACTION_POLICY],
    contentMutationOrdering: [...PUBLISH_ATTEMPT_CONTENT_MUTATION_ORDERING],
    executionGuardSummary: {
      approvalFound: input.executionGuard.approvalFound,
      approvalActive: input.executionGuard.approvalActive,
      approvalMatchesCurrentState: input.executionGuard.approvalFound ? input.executionGuard.approvalMatchesCurrentState : null,
      canExecutePublish: false,
      canExecuteScheduledPublish: false,
      blockingReasons: input.executionGuard.blockingReasons,
      warnings: input.executionGuard.warnings
    },
    sideEffectSummary: {
      dbRead: true,
      dbWrite: false,
      attemptPersistence: false,
      contentItemMutation: false,
      bloggerApiWrite: false,
      bloggerPublish: false,
      bloggerScheduledPublish: false,
      bloggerPostsUpdate: false,
      bloggerDraftSave: false,
      tokenRefresh: false,
      llmCall: false
    }
  };
}
