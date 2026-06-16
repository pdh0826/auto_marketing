import { createHash } from "node:crypto";
import type { PublishApprovalMode, PublishApprovalPreview, PublishApprovalTokenState, PublishPreflightDryRun } from "@/lib/blogger/admin-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { REQUIRED_BEFORE_PUBLISH, REQUIRED_BEFORE_SCHEDULED_PUBLISH } from "@/lib/content/publish-preflight";

export const PUBLISH_APPROVAL_PREVIEW_CANONICALIZATION = "stable-json-sort-keys-v1";

export const REQUIRED_BEFORE_APPROVAL_PERSISTENCE = [
  "Publish approval DB model or approved existing-table extension",
  "Canonical snapshot field list and hash algorithm frozen",
  "Manual rollback acknowledgement capture",
  "Manual side-effect summary acknowledgement capture",
  "Token state checkedAt persistence policy",
  "Approval expiration and invalidation policy",
  "Publish execution attempt audit model",
  "Partial failure handling policy"
] as const;

export interface BuildPublishApprovalPreviewInput {
  contentItem: ContentItemAdmin;
  publishPreflight: PublishPreflightDryRun;
  publishMode?: PublishApprovalMode;
  scheduledAt?: string | null;
  timezone?: string | null;
  checkedAt?: Date;
}

export function buildPublishApprovalPreview(input: BuildPublishApprovalPreviewInput): PublishApprovalPreview {
  const checkedAt = input.checkedAt ?? new Date();
  const checkedAtIso = checkedAt.toISOString();
  const publishMode = input.publishMode ?? "publish";
  const scheduledAt = input.scheduledAt ?? null;
  const timezone = input.timezone ?? null;
  const tokenState = getTokenState(input.publishPreflight);
  const blockingReasons = new Set<string>([
    "publish_approval_persistence_not_implemented",
    "publish_not_implemented",
    "scheduled_publish_not_implemented",
    "rollback_acknowledgement_required",
    "side_effect_summary_acknowledgement_required"
  ]);
  const warnings = new Set<string>(input.publishPreflight.warnings);

  if (tokenState === "expired_reauth_required") {
    blockingReasons.add("access_token_expired_reauth_required");
  }
  if (!input.publishPreflight.publishPreflightSummary.bloggerDraftSaved) {
    blockingReasons.add("blogger_draft_not_saved");
  }
  if (!input.publishPreflight.publishPreflightSummary.bloggerPostId) {
    blockingReasons.add("blogger_draft_post_id_missing");
  }
  if (!input.publishPreflight.publishPreflightSummary.bloggerBlogId) {
    blockingReasons.add("blogger_blog_id_missing");
  }
  if (input.publishPreflight.publishPreflightSummary.manualApprovalStatus !== "approved") {
    blockingReasons.add("manual_approval_missing");
  }
  if (!input.publishPreflight.publishPreflightSummary.approvalMatchesCurrentPreview) {
    blockingReasons.add("approval_snapshot_mismatch");
  }
  if (publishMode === "scheduled_publish" && !scheduledAt) {
    blockingReasons.add("scheduled_at_required_for_scheduled_publish");
  }
  if (publishMode === "scheduled_publish" && !timezone) {
    blockingReasons.add("timezone_required_for_scheduled_publish");
  }

  const snapshot = {
    contentItemId: input.contentItem.id,
    contentStatus: input.contentItem.status ?? null,
    draftMarkdownHash: md5Hex(input.contentItem.draftMarkdown ?? ""),
    draftHtmlHash: md5Hex(input.contentItem.draftHtml ?? ""),
    draftHtmlLength: input.contentItem.draftHtml?.length ?? 0,
    titleCandidate: input.publishPreflight.publishPreflightSummary.titleCandidate,
    targetBloggerBlogId: input.publishPreflight.publishPreflightSummary.bloggerBlogId,
    targetBloggerBlogName: input.publishPreflight.publishPreflightSummary.bloggerBlogName,
    targetBloggerBlogUrl: input.publishPreflight.publishPreflightSummary.bloggerBlogUrl,
    bloggerPostId: input.publishPreflight.publishPreflightSummary.bloggerPostId,
    bloggerDraftSavedAt: input.publishPreflight.publishPreflightSummary.bloggerDraftSavedAt,
    bloggerDraftApprovalId: input.publishPreflight.publishPreflightSummary.bloggerDraftApprovalId,
    bloggerDraftApprovalSnapshotHash: input.publishPreflight.publishPreflightSummary.bloggerDraftApprovalSnapshotHash,
    approvalMatchesCurrentPreview: input.publishPreflight.publishPreflightSummary.approvalMatchesCurrentPreview,
    publishMode,
    scheduledAt,
    timezone,
    rollbackAcknowledged: false as const,
    sideEffectSummaryAcknowledged: false as const,
    tokenState,
    tokenStateCheckedAt: checkedAtIso
  };
  const canonicalSnapshot = stableStringify(snapshot);

  return {
    contentItemId: input.contentItem.id,
    checkedAt: checkedAtIso,
    canCreatePublishApproval: false,
    canPublish: false,
    canSchedulePublish: false,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings),
    approvalSnapshotPreview: snapshot,
    approvalSnapshotHashPreview: sha256Hex(canonicalSnapshot),
    hashAlgorithm: "sha256",
    canonicalization: PUBLISH_APPROVAL_PREVIEW_CANONICALIZATION,
    requiredBeforeApprovalPersistence: [...REQUIRED_BEFORE_APPROVAL_PERSISTENCE],
    requiredBeforePublish: [...REQUIRED_BEFORE_PUBLISH],
    requiredBeforeScheduledPublish: [...REQUIRED_BEFORE_SCHEDULED_PUBLISH],
    sideEffectSummary: {
      bloggerApiWrite: false,
      bloggerPublish: false,
      bloggerScheduledPublish: false,
      bloggerPostsUpdate: false,
      bloggerDraftSave: false,
      tokenRefresh: false,
      llmCall: false,
      contentItemMutation: false,
      dbWrite: false,
      approvalPersistence: false
    }
  };
}

function getTokenState(preflight: PublishPreflightDryRun): PublishApprovalTokenState {
  if (preflight.publishPreflightSummary.accessTokenExpired) {
    return "expired_reauth_required";
  }
  if (preflight.publishPreflightSummary.bloggerDraftSaved) {
    return "valid_not_verified";
  }
  return "unknown";
}

function md5Hex(value: string) {
  return createHash("md5").update(value, "utf8").digest("hex");
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
