import { createHash } from "node:crypto";
import type {
  BloggerDraftSaveAdmin,
  BloggerPublishApprovalAdmin,
  PublishApprovalExecutionGuardResponse,
  PublishApprovalMode,
  PublishApprovalTokenState
} from "@/lib/blogger/admin-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";

export const REQUIRED_BEFORE_PUBLISH_EXECUTION = [
  "Publish execution route and attempt audit model must be implemented",
  "Blogger access token must be valid immediately before execution",
  "Saved publish approval must still match current content and Blogger draft state",
  "Content item status/publishedAt mutation policy must be approved",
  "Rollback and partial failure handling policy must be approved"
] as const;

export interface BuildPublishApprovalExecutionGuardInput {
  contentItem: ContentItemAdmin;
  latestApproval: BloggerPublishApprovalAdmin | null;
  latestSuccessfulDraftSave: BloggerDraftSaveAdmin | null;
  accessTokenExpired: boolean;
  mode?: PublishApprovalMode | null;
  scheduledAt?: string | null;
  timezone?: string | null;
  checkedAt?: Date;
}

export function buildPublishApprovalExecutionGuard(input: BuildPublishApprovalExecutionGuardInput): PublishApprovalExecutionGuardResponse {
  const checkedAt = input.checkedAt ?? new Date();
  const approval = input.latestApproval;
  const blockingReasons = new Set<string>([
    "publish_execution_not_implemented",
    "publish_not_implemented",
    "scheduled_publish_not_implemented",
    "content_item_mutation_policy_not_implemented"
  ]);
  const warnings = new Set<string>();
  const invalidationCandidates = new Set<string>();

  const currentTokenState: PublishApprovalTokenState = input.accessTokenExpired ? "expired_reauth_required" : approval ? "valid_not_verified" : "unknown";
  const currentMode = input.mode ?? approval?.mode ?? "publish";
  const currentScheduledAt = normalizeDateTime(input.scheduledAt ?? approval?.scheduledAt ?? null);
  const currentTimezone = input.timezone ?? approval?.timezone ?? null;
  const currentDraftMarkdownHash = md5Hex(input.contentItem.draftMarkdown ?? "");
  const currentDraftHtmlHash = md5Hex(input.contentItem.draftHtml ?? "");
  const currentDraftHtmlLength = input.contentItem.draftHtml?.length ?? 0;
  const currentTitleCandidate = input.latestSuccessfulDraftSave?.titleCandidate ?? input.contentItem.title ?? null;
  const currentTargetBlogId = input.latestSuccessfulDraftSave?.targetBloggerBlogId ?? null;
  const currentBloggerPostId = input.latestSuccessfulDraftSave?.bloggerPostId ?? null;

  if (!approval) {
    blockingReasons.add("publish_approval_missing");
  }
  if (input.accessTokenExpired || approval?.tokenState === "expired_reauth_required") {
    blockingReasons.add("access_token_expired_reauth_required");
  }

  const approvalActive = Boolean(approval && approval.status === "approved_snapshot" && !approval.invalidatedAt);
  if (approval && !approvalActive) {
    blockingReasons.add("publish_approval_not_active");
  }

  const matchSummary = {
    draftHtmlHashMatches: compareNullable(approval?.draftHtmlHash ?? null, currentDraftHtmlHash),
    draftMarkdownHashMatches: compareNullable(approval?.draftMarkdownHash ?? null, currentDraftMarkdownHash),
    draftHtmlLengthMatches: approval ? approval.draftHtmlLength === currentDraftHtmlLength : null,
    titleCandidateMatches: compareNullable(approval?.titleCandidate ?? null, currentTitleCandidate),
    targetBloggerBlogMatches: compareNullable(approval?.targetBloggerBlogId ?? null, currentTargetBlogId),
    bloggerPostIdMatches: compareNullable(approval?.bloggerPostId ?? null, currentBloggerPostId),
    contentStatusMatches: compareNullable(approval ? "planned" : null, input.contentItem.status ?? null),
    scheduledAtMatches: compareNullable(normalizeDateTime(approval?.scheduledAt ?? null), currentScheduledAt),
    timezoneMatches: compareNullable(approval?.timezone ?? null, currentTimezone),
    modeMatches: compareNullable(approval?.mode ?? null, currentMode),
    tokenStateMatches: compareNullable(approval?.tokenState ?? null, currentTokenState)
  };

  addInvalidationCandidate(matchSummary.draftHtmlHashMatches, invalidationCandidates, "draft_html_hash_changed");
  addInvalidationCandidate(matchSummary.draftMarkdownHashMatches, invalidationCandidates, "draft_markdown_hash_changed");
  addInvalidationCandidate(matchSummary.draftHtmlLengthMatches, invalidationCandidates, "draft_html_length_changed");
  addInvalidationCandidate(matchSummary.titleCandidateMatches, invalidationCandidates, "title_candidate_changed");
  addInvalidationCandidate(matchSummary.targetBloggerBlogMatches, invalidationCandidates, "target_blogger_blog_changed");
  addInvalidationCandidate(matchSummary.bloggerPostIdMatches, invalidationCandidates, "blogger_post_id_changed");
  addInvalidationCandidate(matchSummary.contentStatusMatches, invalidationCandidates, "content_status_changed");
  addInvalidationCandidate(matchSummary.scheduledAtMatches, invalidationCandidates, "scheduled_at_changed");
  addInvalidationCandidate(matchSummary.timezoneMatches, invalidationCandidates, "timezone_changed");
  addInvalidationCandidate(matchSummary.modeMatches, invalidationCandidates, "publish_mode_changed");

  if (approval?.invalidatedAt) {
    invalidationCandidates.add("approval_already_invalidated");
  }
  if (approval && approval.status !== "approved_snapshot") {
    invalidationCandidates.add("approval_status_not_executable");
  }
  if (matchSummary.tokenStateMatches === false) {
    warnings.add("token_state_changed_recheck_required");
  }

  const approvalMatchesCurrentState = Boolean(approvalActive && invalidationCandidates.size === 0);
  if (!approvalMatchesCurrentState) {
    blockingReasons.add("publish_approval_current_state_mismatch");
  }

  return {
    contentItemId: input.contentItem.id,
    checkedAt: checkedAt.toISOString(),
    approvalId: approval?.id ?? null,
    approvalSnapshotHash: approval?.snapshotHash ?? null,
    approvalFound: Boolean(approval),
    approvalActive,
    approvalMatchesCurrentState,
    canExecutePublish: false,
    canExecuteScheduledPublish: false,
    canPublish: false,
    canSchedulePublish: false,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings),
    invalidationCandidates: Array.from(invalidationCandidates),
    matchSummary,
    approvalSummary: {
      id: approval?.id ?? null,
      mode: approval?.mode ?? null,
      status: approval?.status ?? null,
      snapshotHash: approval?.snapshotHash ?? null,
      createdAt: approval?.createdAt ?? null,
      invalidatedAt: approval?.invalidatedAt ?? null,
      invalidatedReason: approval?.invalidatedReason ?? null,
      tokenState: approval?.tokenState ?? null
    },
    requiredBeforeExecution: [...REQUIRED_BEFORE_PUBLISH_EXECUTION],
    sideEffectSummary: {
      dbRead: true,
      dbWrite: false,
      approvalInvalidation: false,
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

function md5Hex(value: string) {
  return createHash("md5").update(value, "utf8").digest("hex");
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

function addInvalidationCandidate(match: boolean | null, candidates: Set<string>, reason: string) {
  if (match === false) {
    candidates.add(reason);
  }
}

function normalizeDateTime(value: string | null) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return value;
  }
  return date.toISOString();
}
