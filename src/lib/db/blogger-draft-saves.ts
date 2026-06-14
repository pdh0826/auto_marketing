import type { Prisma } from "@prisma/client";
import type { BloggerDraftSaveAdmin } from "@/lib/blogger/admin-types";
import { hashPrefix } from "@/lib/blogger/draft-approval";
import { prisma } from "@/lib/db/client";

const safeSelect = {
  id: true,
  contentItemId: true,
  approvalId: true,
  bloggerConnectionId: true,
  status: true,
  snapshotHash: true,
  draftHtmlHash: true,
  targetBloggerBlogId: true,
  targetBloggerBlogName: true,
  targetBloggerBlogUrl: true,
  titleCandidate: true,
  bloggerPostId: true,
  bloggerPostUrl: true,
  bloggerPostPublishedAt: true,
  bloggerPostUpdatedAt: true,
  errorCode: true,
  errorMessage: true,
  retryable: true,
  savedAt: true,
  failedAt: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.BloggerDraftSaveSelect;

export type SafeBloggerDraftSave = Prisma.BloggerDraftSaveGetPayload<{ select: typeof safeSelect }>;

export function getLatestBloggerDraftSave(contentItemId: string) {
  return prisma.bloggerDraftSave.findFirst({
    where: { contentItemId },
    orderBy: [{ createdAt: "desc" }],
    select: safeSelect
  });
}

export function getLatestSuccessfulBloggerDraftSave(contentItemId: string) {
  return prisma.bloggerDraftSave.findFirst({
    where: {
      contentItemId,
      status: "success"
    },
    orderBy: [{ savedAt: "desc" }, { createdAt: "desc" }],
    select: safeSelect
  });
}

export function getSuccessfulBloggerDraftSaveByApproval(approvalId: string) {
  return prisma.bloggerDraftSave.findFirst({
    where: {
      approvalId,
      status: "success"
    },
    orderBy: [{ savedAt: "desc" }, { createdAt: "desc" }],
    select: safeSelect
  });
}

export function createBloggerDraftSaveSuccess(input: {
  contentItemId: string;
  approvalId: string;
  bloggerConnectionId: string;
  snapshotHash: string;
  draftHtmlHash: string;
  targetBloggerBlogId: string;
  targetBloggerBlogName: string | null;
  targetBloggerBlogUrl: string | null;
  titleCandidate: string;
  bloggerPostId: string;
  bloggerPostUrl: string | null;
  bloggerPostPublishedAt: Date | null;
  bloggerPostUpdatedAt: Date | null;
}) {
  return prisma.bloggerDraftSave.create({
    data: {
      ...input,
      status: "success",
      savedAt: new Date(),
      retryable: false
    },
    select: safeSelect
  });
}

export function createBloggerDraftSaveFailure(input: {
  contentItemId: string;
  approvalId: string;
  bloggerConnectionId: string;
  snapshotHash: string;
  draftHtmlHash: string;
  targetBloggerBlogId: string;
  targetBloggerBlogName: string | null;
  targetBloggerBlogUrl: string | null;
  titleCandidate: string;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
}) {
  return prisma.bloggerDraftSave.create({
    data: {
      ...input,
      status: "failed",
      failedAt: new Date()
    },
    select: safeSelect
  });
}

export function toBloggerDraftSaveAdmin(save: SafeBloggerDraftSave): BloggerDraftSaveAdmin {
  return {
    id: save.id,
    contentItemId: save.contentItemId,
    approvalId: save.approvalId,
    bloggerConnectionId: save.bloggerConnectionId,
    status: save.status,
    snapshotHashPrefix: hashPrefix(save.snapshotHash),
    draftHtmlHashPrefix: hashPrefix(save.draftHtmlHash),
    targetBloggerBlogId: save.targetBloggerBlogId,
    targetBloggerBlogName: save.targetBloggerBlogName,
    targetBloggerBlogUrl: save.targetBloggerBlogUrl,
    titleCandidate: save.titleCandidate,
    bloggerPostId: save.bloggerPostId,
    bloggerPostUrl: save.bloggerPostUrl,
    bloggerPostPublishedAt: save.bloggerPostPublishedAt?.toISOString() ?? null,
    bloggerPostUpdatedAt: save.bloggerPostUpdatedAt?.toISOString() ?? null,
    errorCode: save.errorCode,
    errorMessage: save.errorMessage,
    retryable: save.retryable,
    savedAt: save.savedAt?.toISOString() ?? null,
    failedAt: save.failedAt?.toISOString() ?? null,
    createdAt: save.createdAt.toISOString(),
    updatedAt: save.updatedAt.toISOString()
  };
}
