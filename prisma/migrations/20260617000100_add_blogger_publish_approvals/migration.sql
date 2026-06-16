-- CreateEnum
CREATE TYPE "BloggerPublishApprovalMode" AS ENUM ('publish', 'scheduled_publish');

-- CreateEnum
CREATE TYPE "BloggerPublishApprovalStatus" AS ENUM ('approved_snapshot', 'invalidated', 'used_for_publish_attempt', 'used_for_schedule_attempt', 'cancelled');

-- CreateTable
CREATE TABLE "blogger_publish_approvals" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "mode" "BloggerPublishApprovalMode" NOT NULL,
    "status" "BloggerPublishApprovalStatus" NOT NULL DEFAULT 'approved_snapshot',
    "targetBloggerBlogId" TEXT NOT NULL,
    "targetBloggerBlogName" TEXT,
    "targetBloggerBlogUrl" TEXT,
    "bloggerPostId" TEXT NOT NULL,
    "bloggerDraftSaveId" TEXT,
    "bloggerDraftApprovalId" TEXT,
    "draftMarkdownHash" TEXT NOT NULL,
    "draftHtmlHash" TEXT NOT NULL,
    "draftHtmlLength" INTEGER NOT NULL,
    "titleCandidate" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "timezone" TEXT,
    "snapshotJson" JSONB NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "hashAlgorithm" TEXT NOT NULL,
    "canonicalization" TEXT NOT NULL,
    "rollbackAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "sideEffectSummaryAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "approvalPersistenceAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "tokenState" TEXT NOT NULL,
    "tokenStateCheckedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "invalidatedAt" TIMESTAMP(3),
    "invalidatedReason" TEXT,
    "supersededByApprovalId" TEXT,

    CONSTRAINT "blogger_publish_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blogger_publish_approvals_contentItemId_idx" ON "blogger_publish_approvals"("contentItemId");

-- CreateIndex
CREATE INDEX "blogger_publish_approvals_bloggerPostId_idx" ON "blogger_publish_approvals"("bloggerPostId");

-- CreateIndex
CREATE INDEX "blogger_publish_approvals_targetBloggerBlogId_idx" ON "blogger_publish_approvals"("targetBloggerBlogId");

-- CreateIndex
CREATE INDEX "blogger_publish_approvals_snapshotHash_idx" ON "blogger_publish_approvals"("snapshotHash");

-- CreateIndex
CREATE INDEX "blogger_publish_approvals_status_idx" ON "blogger_publish_approvals"("status");

-- CreateIndex
CREATE INDEX "blogger_publish_approvals_createdAt_idx" ON "blogger_publish_approvals"("createdAt");

-- CreateIndex
CREATE INDEX "blogger_publish_approvals_invalidatedAt_idx" ON "blogger_publish_approvals"("invalidatedAt");

-- CreateIndex
CREATE INDEX "blogger_publish_approvals_mode_idx" ON "blogger_publish_approvals"("mode");

-- CreateIndex
CREATE INDEX "blogger_publish_approvals_scheduledAt_idx" ON "blogger_publish_approvals"("scheduledAt");

-- AddForeignKey
ALTER TABLE "blogger_publish_approvals" ADD CONSTRAINT "blogger_publish_approvals_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blogger_publish_approvals" ADD CONSTRAINT "blogger_publish_approvals_bloggerDraftSaveId_fkey" FOREIGN KEY ("bloggerDraftSaveId") REFERENCES "blogger_draft_saves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blogger_publish_approvals" ADD CONSTRAINT "blogger_publish_approvals_bloggerDraftApprovalId_fkey" FOREIGN KEY ("bloggerDraftApprovalId") REFERENCES "blogger_draft_approvals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
