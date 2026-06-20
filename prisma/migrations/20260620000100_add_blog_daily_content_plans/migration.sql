-- Patch 9F-2A: Daily Auto Content Plan draft foundation.
-- This migration adds schema only. It does not create daily plan business rows.

CREATE TABLE "blog_daily_content_plans" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "targetBloggerBlogId" TEXT NOT NULL,
  "targetBloggerBlogName" TEXT,
  "targetBloggerBlogUrl" TEXT,
  "operationProfileId" TEXT,
  "planDateLocal" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
  "planName" TEXT NOT NULL DEFAULT 'Daily Content Plan',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "planKind" TEXT NOT NULL DEFAULT 'daily_auto_content_plan',
  "operationMode" TEXT NOT NULL DEFAULT 'approval_required',
  "defaultPublishPolicyPreset" TEXT NOT NULL DEFAULT 'safe_manual_publish',
  "contentGenerationEnabled" BOOLEAN NOT NULL DEFAULT false,
  "llmCallEnabled" BOOLEAN NOT NULL DEFAULT false,
  "publishExecutionEnabled" BOOLEAN NOT NULL DEFAULT false,
  "scheduledPublishEnabled" BOOLEAN NOT NULL DEFAULT false,
  "plannedItemCount" INTEGER NOT NULL DEFAULT 0,
  "policySnapshotJson" JSONB,
  "planSummaryJson" JSONB,
  "guardrailJson" JSONB,

  CONSTRAINT "blog_daily_content_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blog_daily_content_plan_items" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "planId" TEXT NOT NULL,
  "itemOrder" INTEGER NOT NULL,
  "slotKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'candidate',
  "topicSeed" TEXT NOT NULL,
  "contentIntent" TEXT NOT NULL,
  "audienceHint" TEXT,
  "riskNote" TEXT,
  "publishMode" TEXT NOT NULL DEFAULT 'approval_required',
  "contentItemId" TEXT,
  "draftGenerationAllowed" BOOLEAN NOT NULL DEFAULT false,
  "llmGenerationAllowed" BOOLEAN NOT NULL DEFAULT false,
  "publishExecutionAllowed" BOOLEAN NOT NULL DEFAULT false,
  "scheduledPublishAllowed" BOOLEAN NOT NULL DEFAULT false,
  "requiresHumanApproval" BOOLEAN NOT NULL DEFAULT true,
  "policySnapshotJson" JSONB,
  "itemPlanJson" JSONB,

  CONSTRAINT "blog_daily_content_plan_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blog_daily_content_plans_targetBloggerBlogId_planDateLocal_key" ON "blog_daily_content_plans"("targetBloggerBlogId", "planDateLocal");
CREATE INDEX "blog_daily_content_plans_targetBloggerBlogId_idx" ON "blog_daily_content_plans"("targetBloggerBlogId");
CREATE INDEX "blog_daily_content_plans_planDateLocal_idx" ON "blog_daily_content_plans"("planDateLocal");
CREATE INDEX "blog_daily_content_plans_status_idx" ON "blog_daily_content_plans"("status");
CREATE INDEX "blog_daily_content_plans_defaultPublishPolicyPreset_idx" ON "blog_daily_content_plans"("defaultPublishPolicyPreset");
CREATE INDEX "blog_daily_content_plan_items_planId_idx" ON "blog_daily_content_plan_items"("planId");
CREATE INDEX "blog_daily_content_plan_items_status_idx" ON "blog_daily_content_plan_items"("status");
CREATE INDEX "blog_daily_content_plan_items_contentItemId_idx" ON "blog_daily_content_plan_items"("contentItemId");

ALTER TABLE "blog_daily_content_plan_items"
  ADD CONSTRAINT "blog_daily_content_plan_items_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "blog_daily_content_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "blog_daily_content_plans" TO blog_growth_agent_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "blog_daily_content_plan_items" TO blog_growth_agent_app;
