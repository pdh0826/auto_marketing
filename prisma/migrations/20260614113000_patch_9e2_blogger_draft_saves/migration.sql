-- Patch 9E-2: safe Blogger draft save result records.
-- Stores only safe result metadata. Full draftHtml, tokens, encrypted values, and raw Blogger API responses are intentionally absent.

CREATE TYPE "BloggerDraftSaveStatus" AS ENUM ('success', 'failed');

CREATE TABLE "blogger_draft_saves" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "bloggerConnectionId" TEXT NOT NULL,
    "status" "BloggerDraftSaveStatus" NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "draftHtmlHash" TEXT NOT NULL,
    "targetBloggerBlogId" TEXT NOT NULL,
    "targetBloggerBlogName" TEXT,
    "targetBloggerBlogUrl" TEXT,
    "titleCandidate" TEXT NOT NULL,
    "bloggerPostId" TEXT,
    "bloggerPostUrl" TEXT,
    "bloggerPostPublishedAt" TIMESTAMP(3),
    "bloggerPostUpdatedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "savedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blogger_draft_saves_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "blogger_draft_saves_contentItemId_idx" ON "blogger_draft_saves"("contentItemId");
CREATE INDEX "blogger_draft_saves_approvalId_idx" ON "blogger_draft_saves"("approvalId");
CREATE INDEX "blogger_draft_saves_status_idx" ON "blogger_draft_saves"("status");
CREATE INDEX "blogger_draft_saves_snapshotHash_idx" ON "blogger_draft_saves"("snapshotHash");
CREATE INDEX "blogger_draft_saves_savedAt_idx" ON "blogger_draft_saves"("savedAt");

ALTER TABLE "blogger_draft_saves"
ADD CONSTRAINT "blogger_draft_saves_contentItemId_fkey"
FOREIGN KEY ("contentItemId") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "blogger_draft_saves"
ADD CONSTRAINT "blogger_draft_saves_approvalId_fkey"
FOREIGN KEY ("approvalId") REFERENCES "blogger_draft_approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

GRANT USAGE ON TYPE "BloggerDraftSaveStatus" TO blog_growth_agent_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "blogger_draft_saves" TO blog_growth_agent_app;
