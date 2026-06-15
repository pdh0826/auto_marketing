-- Patch 9E-4C-3A: Local stepwise draft generation run/step foundation.
-- Stores stepwise generation state and normalized Markdown fragments only.
-- Prompt full text, raw provider responses, secrets, tokens, and content item body mutations are intentionally absent.

CREATE TYPE "ContentDraftGenerationRunStatus" AS ENUM ('pending', 'running', 'failed', 'completed', 'cancelled');
CREATE TYPE "ContentDraftGenerationStepStatus" AS ENUM ('pending', 'running', 'success', 'failed', 'skipped');

CREATE TABLE "content_draft_generation_runs" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "status" "ContentDraftGenerationRunStatus" NOT NULL DEFAULT 'pending',
    "currentStepKey" TEXT,
    "sectionKeys" JSONB NOT NULL,
    "assembledCandidateMarkdown" TEXT,
    "finalCandidateMarkdown" TEXT,
    "validationSummary" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "content_draft_generation_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "content_draft_generation_steps" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "sectionKey" TEXT,
    "status" "ContentDraftGenerationStepStatus" NOT NULL DEFAULT 'pending',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "outputMarkdown" TEXT,
    "outputSummary" TEXT,
    "promptHash" TEXT,
    "responseHash" TEXT,
    "latencyMs" INTEGER,
    "errorCode" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_draft_generation_steps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "content_draft_generation_runs_contentItemId_idx" ON "content_draft_generation_runs"("contentItemId");
CREATE INDEX "content_draft_generation_runs_strategy_idx" ON "content_draft_generation_runs"("strategy");
CREATE INDEX "content_draft_generation_runs_status_idx" ON "content_draft_generation_runs"("status");
CREATE INDEX "content_draft_generation_runs_currentStepKey_idx" ON "content_draft_generation_runs"("currentStepKey");
CREATE INDEX "content_draft_generation_runs_createdAt_idx" ON "content_draft_generation_runs"("createdAt");

CREATE INDEX "content_draft_generation_steps_runId_idx" ON "content_draft_generation_steps"("runId");
CREATE INDEX "content_draft_generation_steps_stepKey_idx" ON "content_draft_generation_steps"("stepKey");
CREATE INDEX "content_draft_generation_steps_sectionKey_idx" ON "content_draft_generation_steps"("sectionKey");
CREATE INDEX "content_draft_generation_steps_status_idx" ON "content_draft_generation_steps"("status");
CREATE INDEX "content_draft_generation_steps_createdAt_idx" ON "content_draft_generation_steps"("createdAt");

ALTER TABLE "content_draft_generation_runs"
ADD CONSTRAINT "content_draft_generation_runs_contentItemId_fkey"
FOREIGN KEY ("contentItemId") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_draft_generation_steps"
ADD CONSTRAINT "content_draft_generation_steps_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "content_draft_generation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT USAGE ON TYPE "ContentDraftGenerationRunStatus" TO blog_growth_agent_app;
GRANT USAGE ON TYPE "ContentDraftGenerationStepStatus" TO blog_growth_agent_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "content_draft_generation_runs" TO blog_growth_agent_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "content_draft_generation_steps" TO blog_growth_agent_app;
