import type { Prisma } from "@prisma/client";
import type { BloggerPublishApprovalAdmin, PublishApprovalMode, PublishApprovalSnapshotPreview, PublishApprovalTokenState } from "@/lib/blogger/admin-types";
import { hashPrefix } from "@/lib/blogger/draft-approval";
import { prisma } from "@/lib/db/client";

const safeSelect = {
  id: true,
  contentItemId: true,
  mode: true,
  status: true,
  targetBloggerBlogId: true,
  targetBloggerBlogName: true,
  targetBloggerBlogUrl: true,
  bloggerPostId: true,
  bloggerDraftSaveId: true,
  bloggerDraftApprovalId: true,
  draftMarkdownHash: true,
  draftHtmlHash: true,
  draftHtmlLength: true,
  titleCandidate: true,
  scheduledAt: true,
  timezone: true,
  snapshotHash: true,
  hashAlgorithm: true,
  canonicalization: true,
  rollbackAcknowledged: true,
  sideEffectSummaryAcknowledged: true,
  approvalPersistenceAcknowledged: true,
  tokenState: true,
  tokenStateCheckedAt: true,
  createdBy: true,
  createdAt: true,
  invalidatedAt: true,
  invalidatedReason: true,
  supersededByApprovalId: true
} satisfies Prisma.BloggerPublishApprovalSelect;

export type SafeBloggerPublishApproval = Prisma.BloggerPublishApprovalGetPayload<{ select: typeof safeSelect }>;

export function countBloggerPublishApprovalsForContentItem(contentItemId: string) {
  return prisma.bloggerPublishApproval.count({
    where: { contentItemId }
  });
}

export function findLatestBloggerPublishApprovalForContentItem(contentItemId: string) {
  return prisma.bloggerPublishApproval.findFirst({
    where: { contentItemId },
    orderBy: [{ createdAt: "desc" }],
    select: safeSelect
  });
}

export function findBloggerPublishApprovalById(id: string) {
  return prisma.bloggerPublishApproval.findUnique({
    where: { id },
    select: safeSelect
  });
}

export async function createBloggerPublishApprovalFromSnapshot(input: {
  contentItemId: string;
  mode: PublishApprovalMode;
  snapshot: PublishApprovalSnapshotPreview;
  snapshotHash: string;
  hashAlgorithm: "sha256";
  canonicalization: string;
  bloggerDraftSaveId: string | null;
  bloggerDraftApprovalId: string | null;
  rollbackAcknowledged: boolean;
  sideEffectSummaryAcknowledged: boolean;
  approvalPersistenceAcknowledged: boolean;
  createdBy?: string | null;
}) {
  if (!input.rollbackAcknowledged || !input.sideEffectSummaryAcknowledged || !input.approvalPersistenceAcknowledged) {
    throw new Error("acknowledgement_required");
  }
  if (input.mode !== "publish" && input.mode !== "scheduled_publish") {
    throw new Error("invalid_publish_approval_mode");
  }
  if (input.mode === "scheduled_publish" && (!input.snapshot.scheduledAt || !input.snapshot.timezone)) {
    throw new Error("scheduled_publish_requires_schedule");
  }
  if (!input.snapshot.targetBloggerBlogId) {
    throw new Error("target_blogger_blog_missing");
  }
  if (!input.snapshot.bloggerPostId) {
    throw new Error("blogger_draft_post_id_missing");
  }

  const scheduledAt = parseOptionalDate(input.snapshot.scheduledAt);
  const tokenStateCheckedAt = new Date(input.snapshot.tokenStateCheckedAt);
  const existingApproval = await prisma.bloggerPublishApproval.findFirst({
    where: {
      contentItemId: input.contentItemId,
      mode: input.mode,
      snapshotHash: input.snapshotHash,
      scheduledAt,
      status: "approved_snapshot",
      invalidatedAt: null
    },
    orderBy: [{ createdAt: "desc" }],
    select: safeSelect
  });

  if (existingApproval) {
    return {
      approval: existingApproval,
      created: false
    };
  }

  const approval = await prisma.bloggerPublishApproval.create({
    data: {
      contentItemId: input.contentItemId,
      mode: input.mode,
      status: "approved_snapshot",
      targetBloggerBlogId: input.snapshot.targetBloggerBlogId,
      targetBloggerBlogName: input.snapshot.targetBloggerBlogName,
      targetBloggerBlogUrl: input.snapshot.targetBloggerBlogUrl,
      bloggerPostId: input.snapshot.bloggerPostId,
      bloggerDraftSaveId: input.bloggerDraftSaveId,
      bloggerDraftApprovalId: input.bloggerDraftApprovalId,
      draftMarkdownHash: input.snapshot.draftMarkdownHash,
      draftHtmlHash: input.snapshot.draftHtmlHash,
      draftHtmlLength: input.snapshot.draftHtmlLength,
      titleCandidate: input.snapshot.titleCandidate,
      scheduledAt,
      timezone: input.snapshot.timezone,
      snapshotJson: input.snapshot as unknown as Prisma.InputJsonValue,
      snapshotHash: input.snapshotHash,
      hashAlgorithm: input.hashAlgorithm,
      canonicalization: input.canonicalization,
      rollbackAcknowledged: input.rollbackAcknowledged,
      sideEffectSummaryAcknowledged: input.sideEffectSummaryAcknowledged,
      approvalPersistenceAcknowledged: input.approvalPersistenceAcknowledged,
      tokenState: input.snapshot.tokenState,
      tokenStateCheckedAt,
      createdBy: input.createdBy ?? null
    },
    select: safeSelect
  });

  return {
    approval,
    created: true
  };
}

export function toBloggerPublishApprovalAdmin(approval: SafeBloggerPublishApproval): BloggerPublishApprovalAdmin {
  return {
    id: approval.id,
    contentItemId: approval.contentItemId,
    status: approval.status,
    mode: approval.mode,
    snapshotHash: approval.snapshotHash,
    snapshotHashPrefix: hashPrefix(approval.snapshotHash),
    hashAlgorithm: approval.hashAlgorithm === "sha256" ? "sha256" : "sha256",
    canonicalization: approval.canonicalization,
    targetBloggerBlogId: approval.targetBloggerBlogId,
    targetBloggerBlogName: approval.targetBloggerBlogName,
    targetBloggerBlogUrl: approval.targetBloggerBlogUrl,
    bloggerPostId: approval.bloggerPostId,
    bloggerDraftSaveId: approval.bloggerDraftSaveId,
    bloggerDraftApprovalId: approval.bloggerDraftApprovalId,
    draftMarkdownHash: approval.draftMarkdownHash,
    draftHtmlHash: approval.draftHtmlHash,
    draftHtmlLength: approval.draftHtmlLength,
    titleCandidate: approval.titleCandidate,
    scheduledAt: approval.scheduledAt?.toISOString() ?? null,
    timezone: approval.timezone,
    rollbackAcknowledged: approval.rollbackAcknowledged,
    sideEffectSummaryAcknowledged: approval.sideEffectSummaryAcknowledged,
    approvalPersistenceAcknowledged: approval.approvalPersistenceAcknowledged,
    tokenState: toPublishApprovalTokenState(approval.tokenState),
    tokenStateCheckedAt: approval.tokenStateCheckedAt.toISOString(),
    createdBy: approval.createdBy,
    createdAt: approval.createdAt.toISOString(),
    invalidatedAt: approval.invalidatedAt?.toISOString() ?? null,
    invalidatedReason: approval.invalidatedReason,
    supersededByApprovalId: approval.supersededByApprovalId
  };
}

function parseOptionalDate(value: string | null) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("invalid_scheduled_at");
  }
  return date;
}

function toPublishApprovalTokenState(value: string): PublishApprovalTokenState {
  if (value === "expired_reauth_required" || value === "valid_not_verified" || value === "unknown") {
    return value;
  }
  return "unknown";
}
