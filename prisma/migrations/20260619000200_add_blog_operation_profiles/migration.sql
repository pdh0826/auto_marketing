-- Patch 9F-1A: Blog Operation Profile + Default Publish Policy Preset foundation.
-- This migration adds schema only. It does not create business/config rows.

CREATE TABLE "blog_operation_profiles" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "targetBloggerBlogId" TEXT NOT NULL,
  "targetBloggerBlogName" TEXT,
  "targetBloggerBlogUrl" TEXT,
  "profileName" TEXT NOT NULL DEFAULT 'Default',
  "status" TEXT NOT NULL DEFAULT 'active',
  "operationMode" TEXT NOT NULL DEFAULT 'approval_required',
  "defaultPublishPolicyPreset" TEXT NOT NULL DEFAULT 'safe_manual_publish',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
  "allowAutoPublish" BOOLEAN NOT NULL DEFAULT false,
  "allowScheduledPublish" BOOLEAN NOT NULL DEFAULT false,
  "requireOAuthGate" BOOLEAN NOT NULL DEFAULT true,
  "requireFinalHumanApproval" BOOLEAN NOT NULL DEFAULT true,
  "requireExternalWriteRiskAck" BOOLEAN NOT NULL DEFAULT true,
  "requireRollbackPlanAck" BOOLEAN NOT NULL DEFAULT true,
  "requireReadbackAfterPublish" BOOLEAN NOT NULL DEFAULT true,
  "requirePostPublishReconciliation" BOOLEAN NOT NULL DEFAULT true,
  "maxPostsPerDay" INTEGER,
  "defaultPublishWindowStart" TEXT,
  "defaultPublishWindowEnd" TEXT,
  "policyJson" JSONB,
  "guardrailJson" JSONB,
  "exceptionRoutingJson" JSONB,

  CONSTRAINT "blog_operation_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blog_operation_profiles_targetBloggerBlogId_key" ON "blog_operation_profiles"("targetBloggerBlogId");
CREATE INDEX "blog_operation_profiles_status_idx" ON "blog_operation_profiles"("status");
CREATE INDEX "blog_operation_profiles_defaultPublishPolicyPreset_idx" ON "blog_operation_profiles"("defaultPublishPolicyPreset");
CREATE INDEX "blog_operation_profiles_operationMode_idx" ON "blog_operation_profiles"("operationMode");

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "blog_operation_profiles" TO blog_growth_agent_app;
