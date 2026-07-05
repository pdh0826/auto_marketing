import type { BloggerDraftApprovalSummary, BloggerDraftPayloadPreview, BloggerDraftSaveAdmin, PublishPreflightDryRun } from "@/lib/blogger/admin-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";

export const PROPOSED_PUBLISH_APPROVAL_SNAPSHOT_FIELDS = [
  "contentItemId",
  "contentStatus",
  "draftMarkdownHash",
  "draftHtmlHash",
  "draftHtmlLength",
  "titleCandidate",
  "targetBloggerBlogId",
  "targetBloggerBlogName",
  "targetBloggerBlogUrl",
  "bloggerPostId",
  "bloggerDraftSavedAt",
  "bloggerDraftApprovalId",
  "bloggerDraftApprovalSnapshotHash",
  "approvalMatchesCurrentPreview",
  "publishMode",
  "scheduledAt",
  "timezone",
  "requestedBy",
  "approvalCreatedAt",
  "rollbackAcknowledged",
  "sideEffectSummaryAcknowledged",
  "tokenStateCheckedAt"
] as const;

export const REQUIRED_BEFORE_PUBLISH = [
  "OAuth reconnect or otherwise valid Blogger access token state",
  "Existing Blogger draft save success with target blog id and Blogger post id",
  "Current draft payload preview and manual approval snapshot still match",
  "Dedicated publish approval snapshot and rollback acknowledgement",
  "Side-effect summary acknowledged before any Blogger publish call",
  "Local content status/publishedAt mutation policy approved"
] as const;

export const REQUIRED_BEFORE_SCHEDULED_PUBLISH = [
  ...REQUIRED_BEFORE_PUBLISH,
  "Future scheduledAt value and explicit timezone",
  "Schedule update/cancel policy approved",
  "Local scheduledAt/status mutation and partial failure policy approved"
] as const;

export interface BuildPublishPreflightInput {
  contentItem: ContentItemAdmin;
  draftPayloadPreview: BloggerDraftPayloadPreview;
  approvalSummary: BloggerDraftApprovalSummary;
  latestSuccessfulDraftSave: BloggerDraftSaveAdmin | null;
  accessTokenExpired: boolean;
  checkedAt?: Date;
}

export function buildPublishPreflightDryRun(input: BuildPublishPreflightInput): PublishPreflightDryRun {
  const checkedAt = input.checkedAt ?? new Date();
  const draftSave = input.latestSuccessfulDraftSave;
  const targetBlog = input.draftPayloadPreview.targetBlog;
  const blockingReasons = new Set<string>([
    "publish_not_implemented",
    "scheduled_publish_not_implemented",
    "publish_approval_not_implemented",
    "content_item_mutation_policy_not_implemented"
  ]);
  const warnings = new Set<string>();

  if (input.contentItem.status !== "planned") {
    blockingReasons.add("content_status_not_planned");
  }
  if (input.contentItem.publishedAt) {
    blockingReasons.add("content_already_published");
  }
  if (input.contentItem.scheduledAt) {
    blockingReasons.add("content_already_scheduled");
  }
  if (input.accessTokenExpired) {
    blockingReasons.add("access_token_expired_reauth_required");
    blockingReasons.add("oauth_gate_not_satisfied");
    blockingReasons.add("manual_blogger_oauth_reconnect_required");
    blockingReasons.add("token_refresh_not_implemented");
  }
  if (!draftSave) {
    blockingReasons.add("blogger_draft_not_saved");
  }
  if (draftSave && !draftSave.bloggerPostId) {
    blockingReasons.add("blogger_draft_post_id_missing");
  }
  if (!targetBlog?.id && !draftSave?.targetBloggerBlogId) {
    blockingReasons.add("blogger_blog_id_missing");
  }
  if (input.approvalSummary.approvalStatus !== "approved") {
    blockingReasons.add("manual_approval_missing");
  }
  if (!input.approvalSummary.approvalMatchesCurrentPreview) {
    blockingReasons.add("approval_snapshot_mismatch");
  }
  if (draftSave && input.approvalSummary.approval?.id === draftSave.approvalId) {
    warnings.add("duplicate_save_protection_active");
  }
  if (input.draftPayloadPreview.warnings.length > 0) {
    input.draftPayloadPreview.warnings.forEach((warning) => warnings.add(warning));
  }

  const bloggerBlogId = draftSave?.targetBloggerBlogId ?? targetBlog?.id ?? null;
  const bloggerBlogName = draftSave?.targetBloggerBlogName ?? targetBlog?.name ?? null;
  const bloggerBlogUrl = draftSave?.targetBloggerBlogUrl ?? targetBlog?.url ?? null;
  const titleCandidate = draftSave?.titleCandidate ?? input.draftPayloadPreview.titleCandidate ?? input.contentItem.title ?? null;

  return {
    contentItemId: input.contentItem.id,
    checkedAt: checkedAt.toISOString(),
    canPublish: false,
    canSchedulePublish: false,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings),
    publishPreflightSummary: {
      bloggerDraftSaved: Boolean(draftSave),
      bloggerBlogId,
      bloggerBlogName,
      bloggerBlogUrl,
      bloggerPostId: draftSave?.bloggerPostId ?? null,
      bloggerDraftSavedAt: draftSave?.savedAt ?? null,
      bloggerDraftApprovalId: input.approvalSummary.approval?.id ?? null,
      bloggerDraftApprovalSnapshotHash: input.approvalSummary.approval?.snapshotHashPrefix ?? null,
      draftHtmlHashPrefix: input.approvalSummary.currentDraftHtmlHashPrefix,
      titleCandidate,
      manualApprovalStatus: input.approvalSummary.approvalStatus,
      approvalMatchesCurrentPreview: input.approvalSummary.approvalMatchesCurrentPreview,
      accessTokenExpired: input.accessTokenExpired,
      duplicateSaveProtectionActive: Boolean(draftSave && input.approvalSummary.approval?.id === draftSave.approvalId),
      publishImplemented: false,
      scheduledPublishImplemented: false,
      publishApprovalImplemented: false,
      canPublish: false,
      canSchedulePublish: false
    },
    requiredBeforePublish: [...REQUIRED_BEFORE_PUBLISH],
    requiredBeforeScheduledPublish: [...REQUIRED_BEFORE_SCHEDULED_PUBLISH],
    proposedPublishApprovalSnapshotFields: [...PROPOSED_PUBLISH_APPROVAL_SNAPSHOT_FIELDS],
    sideEffectSummary: {
      bloggerApiWrite: false,
      bloggerPublish: false,
      bloggerScheduledPublish: false,
      bloggerPostsUpdate: false,
      bloggerDraftSave: false,
      tokenRefresh: false,
      llmCall: false,
      contentItemMutation: false
    }
  };
}
