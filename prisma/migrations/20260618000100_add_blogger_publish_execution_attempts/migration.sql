-- CreateEnum
CREATE TYPE "BloggerPublishExecutionAttemptStatus" AS ENUM ('planned_only', 'blocked_by_preflight');

-- CreateTable
CREATE TABLE "blogger_publish_execution_attempts" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "publishApprovalId" TEXT NOT NULL,
    "publishApprovalSnapshotHash" TEXT NOT NULL,
    "mode" "BloggerPublishApprovalMode" NOT NULL,
    "status" "BloggerPublishExecutionAttemptStatus" NOT NULL DEFAULT 'planned_only',
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "targetBloggerBlogId" TEXT,
    "bloggerPostId" TEXT,
    "draftHtmlHash" TEXT,
    "titleCandidate" TEXT,
    "tokenStateAtAttempt" TEXT,
    "executionGuardCheckedAt" TIMESTAMP(3) NOT NULL,
    "approvalMatchesCurrentState" BOOLEAN,
    "invalidationCandidatesJson" JSONB NOT NULL,
    "sideEffectSummaryJson" JSONB NOT NULL,
    "bloggerRequestSummaryJson" JSONB,
    "bloggerResponseRedactedJson" JSONB,
    "errorType" TEXT,
    "errorCode" TEXT,
    "errorMessageRedacted" TEXT,
    "retryEligible" BOOLEAN NOT NULL DEFAULT false,
    "retryBlockedReason" TEXT,
    "contentMutationPlanned" BOOLEAN NOT NULL DEFAULT false,
    "contentMutationCompleted" BOOLEAN NOT NULL DEFAULT false,
    "contentStatusBefore" TEXT,
    "contentStatusAfter" TEXT,
    "publishedAtPlanned" TIMESTAMP(3),
    "publishedAtApplied" TIMESTAMP(3),
    "scheduledAtPlanned" TIMESTAMP(3),
    "scheduledAtApplied" TIMESTAMP(3),
    "attemptPlanJson" JSONB NOT NULL,
    "attemptPlanHash" TEXT NOT NULL,
    "hashAlgorithm" TEXT NOT NULL,
    "canonicalization" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blogger_publish_execution_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blogger_publish_execution_attempts_contentItemId_publishApprovalId_attemptPlanHash_key" ON "blogger_publish_execution_attempts"("contentItemId", "publishApprovalId", "attemptPlanHash");

-- CreateIndex
CREATE INDEX "blogger_publish_execution_attempts_contentItemId_idx" ON "blogger_publish_execution_attempts"("contentItemId");

-- CreateIndex
CREATE INDEX "blogger_publish_execution_attempts_publishApprovalId_idx" ON "blogger_publish_execution_attempts"("publishApprovalId");

-- CreateIndex
CREATE INDEX "blogger_publish_execution_attempts_publishApprovalSnapshotHash_idx" ON "blogger_publish_execution_attempts"("publishApprovalSnapshotHash");

-- CreateIndex
CREATE INDEX "blogger_publish_execution_attempts_attemptPlanHash_idx" ON "blogger_publish_execution_attempts"("attemptPlanHash");

-- CreateIndex
CREATE INDEX "blogger_publish_execution_attempts_status_idx" ON "blogger_publish_execution_attempts"("status");

-- CreateIndex
CREATE INDEX "blogger_publish_execution_attempts_mode_idx" ON "blogger_publish_execution_attempts"("mode");

-- CreateIndex
CREATE INDEX "blogger_publish_execution_attempts_createdAt_idx" ON "blogger_publish_execution_attempts"("createdAt");

-- AddForeignKey
ALTER TABLE "blogger_publish_execution_attempts" ADD CONSTRAINT "blogger_publish_execution_attempts_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blogger_publish_execution_attempts" ADD CONSTRAINT "blogger_publish_execution_attempts_publishApprovalId_fkey" FOREIGN KEY ("publishApprovalId") REFERENCES "blogger_publish_approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Grant application role access to Blogger publish execution attempt persistence objects.
GRANT USAGE ON TYPE "BloggerPublishExecutionAttemptStatus" TO blog_growth_agent_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "blogger_publish_execution_attempts" TO blog_growth_agent_app;
