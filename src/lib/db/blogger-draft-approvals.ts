import type { Prisma } from "@prisma/client";
import type { BloggerDraftApprovalSnapshot } from "@/lib/blogger/draft-approval";
import { buildBloggerDraftApprovalReadinessSummary, hashPrefix } from "@/lib/blogger/draft-approval";
import type { BloggerDraftApprovalAdmin } from "@/lib/blogger/admin-types";
import { prisma } from "@/lib/db/client";

const safeSelect = {
  id: true,
  contentItemId: true,
  status: true,
  snapshotHash: true,
  draftHtmlHash: true,
  titleCandidate: true,
  targetBloggerBlogId: true,
  targetBloggerBlogName: true,
  targetBloggerBlogUrl: true,
  targetBloggerBlogVerifiedAt: true,
  approvedAt: true,
  approvedBy: true,
  revokedAt: true,
  revokedReason: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.BloggerDraftApprovalSelect;

export type SafeBloggerDraftApproval = Prisma.BloggerDraftApprovalGetPayload<{ select: typeof safeSelect }>;

export function getLatestBloggerDraftApproval(contentItemId: string) {
  return prisma.bloggerDraftApproval.findFirst({
    where: { contentItemId },
    orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }],
    select: safeSelect
  });
}

export function getActiveBloggerDraftApproval(contentItemId: string) {
  return prisma.bloggerDraftApproval.findFirst({
    where: {
      contentItemId,
      status: "approved",
      revokedAt: null
    },
    orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }],
    select: safeSelect
  });
}

export function createBloggerDraftApprovalFromSnapshot(input: {
  contentItemId: string;
  snapshot: BloggerDraftApprovalSnapshot;
  snapshotHash: string;
  draftHtmlHash: string;
  approvedBy?: string | null;
}) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await tx.bloggerDraftApproval.updateMany({
      where: {
        contentItemId: input.contentItemId,
        status: "approved",
        revokedAt: null
      },
      data: {
        status: "superseded",
        revokedAt: now,
        revokedReason: "superseded_by_new_approval"
      }
    });

    return tx.bloggerDraftApproval.create({
      data: {
        contentItemId: input.contentItemId,
        status: "approved",
        snapshotHash: input.snapshotHash,
        draftHtmlHash: input.draftHtmlHash,
        titleCandidate: input.snapshot.titleCandidate,
        targetBloggerBlogId: input.snapshot.targetBloggerBlogId,
        targetBloggerBlogName: input.snapshot.targetBloggerBlogName,
        targetBloggerBlogUrl: input.snapshot.targetBloggerBlogUrl,
        targetBloggerBlogVerifiedAt: new Date(input.snapshot.targetBloggerBlogVerifiedAt),
        readinessSummaryJson: buildBloggerDraftApprovalReadinessSummary(input.snapshot),
        approvedBy: input.approvedBy ?? null
      },
      select: safeSelect
    });
  });
}

export async function revokeActiveBloggerDraftApproval(contentItemId: string) {
  const activeApproval = await getActiveBloggerDraftApproval(contentItemId);
  if (!activeApproval) {
    return null;
  }

  return prisma.bloggerDraftApproval.update({
    where: { id: activeApproval.id },
    data: {
      status: "revoked",
      revokedAt: new Date(),
      revokedReason: "user_revoked"
    },
    select: safeSelect
  });
}

export function toBloggerDraftApprovalAdmin(approval: SafeBloggerDraftApproval): BloggerDraftApprovalAdmin {
  return {
    id: approval.id,
    contentItemId: approval.contentItemId,
    status: approval.status,
    snapshotHashPrefix: hashPrefix(approval.snapshotHash),
    draftHtmlHashPrefix: hashPrefix(approval.draftHtmlHash),
    titleCandidate: approval.titleCandidate,
    targetBloggerBlogId: approval.targetBloggerBlogId,
    targetBloggerBlogName: approval.targetBloggerBlogName,
    targetBloggerBlogUrl: approval.targetBloggerBlogUrl,
    targetBloggerBlogVerifiedAt: approval.targetBloggerBlogVerifiedAt.toISOString(),
    approvedAt: approval.approvedAt.toISOString(),
    approvedBy: approval.approvedBy,
    revokedAt: approval.revokedAt?.toISOString() ?? null,
    revokedReason: approval.revokedReason,
    createdAt: approval.createdAt.toISOString(),
    updatedAt: approval.updatedAt.toISOString()
  };
}
