-- Patch 9E-1: Blogger draft approval guard.
-- Stores only hashes and safe metadata for a user-approved draft payload preview.
-- Full draftHtml, Blogger tokens, encrypted values, and Blogger API responses are intentionally absent.

CREATE TYPE "BloggerDraftApprovalStatus" AS ENUM ('approved', 'revoked', 'superseded');

CREATE TABLE "blogger_draft_approvals" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "status" "BloggerDraftApprovalStatus" NOT NULL DEFAULT 'approved',
    "snapshotHash" TEXT NOT NULL,
    "draftHtmlHash" TEXT NOT NULL,
    "titleCandidate" TEXT NOT NULL,
    "targetBloggerBlogId" TEXT NOT NULL,
    "targetBloggerBlogName" TEXT,
    "targetBloggerBlogUrl" TEXT,
    "targetBloggerBlogVerifiedAt" TIMESTAMP(3) NOT NULL,
    "readinessSummaryJson" JSONB NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blogger_draft_approvals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "blogger_draft_approvals_contentItemId_idx" ON "blogger_draft_approvals"("contentItemId");
CREATE INDEX "blogger_draft_approvals_status_idx" ON "blogger_draft_approvals"("status");
CREATE INDEX "blogger_draft_approvals_snapshotHash_idx" ON "blogger_draft_approvals"("snapshotHash");
CREATE INDEX "blogger_draft_approvals_approvedAt_idx" ON "blogger_draft_approvals"("approvedAt");

ALTER TABLE "blogger_draft_approvals"
ADD CONSTRAINT "blogger_draft_approvals_contentItemId_fkey"
FOREIGN KEY ("contentItemId") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT USAGE ON TYPE "BloggerDraftApprovalStatus" TO blog_growth_agent_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "blogger_draft_approvals" TO blog_growth_agent_app;
