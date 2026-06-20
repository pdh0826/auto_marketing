-- CreateTable
CREATE TABLE "blog_daily_content_operator_approvals" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planItemId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "approvalPurpose" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL,
    "operatorAction" TEXT,
    "operatorLabel" TEXT,
    "operatorNoteRedacted" TEXT,
    "riskAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "externalWriteRiskAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "llmExecutionAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "contentMutationAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "bloggerWriteAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "approvalPolicyPreset" TEXT,
    "operationMode" TEXT,
    "guardrailSnapshotJson" JSONB,
    "readinessSnapshotJson" JSONB,
    "sideEffectExpectationJson" JSONB,
    "approvedAt" TIMESTAMP(3),
    "heldAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByOperatorId" TEXT,
    "updatedByOperatorId" TEXT,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "blog_daily_content_operator_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_daily_content_operator_approval_events" (
    "id" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planItemId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "operatorAction" TEXT,
    "operatorNoteRedacted" TEXT,
    "requestId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "guardrailSnapshotJson" JSONB,
    "readinessSnapshotJson" JSONB,
    "sideEffectExpectationJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByOperatorId" TEXT,

    CONSTRAINT "blog_daily_content_operator_approval_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blog_daily_content_operator_approvals_planId_createdAt_idx" ON "blog_daily_content_operator_approvals"("planId", "createdAt");

-- CreateIndex
CREATE INDEX "blog_daily_content_operator_approvals_planItemId_approvalPu_idx" ON "blog_daily_content_operator_approvals"("planItemId", "approvalPurpose");

-- CreateIndex
CREATE INDEX "blog_daily_content_operator_approvals_contentItemId_approva_idx" ON "blog_daily_content_operator_approvals"("contentItemId", "approvalPurpose");

-- CreateIndex
CREATE INDEX "blog_daily_content_operator_approvals_approvalStatus_approv_idx" ON "blog_daily_content_operator_approvals"("approvalStatus", "approvalPurpose");

-- CreateIndex
CREATE INDEX "blog_daily_content_operator_approvals_approvalPurpose_creat_idx" ON "blog_daily_content_operator_approvals"("approvalPurpose", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "blog_daily_content_operator_approvals_idempotencyKey_key" ON "blog_daily_content_operator_approvals"("idempotencyKey");

-- CreateIndex
CREATE INDEX "blog_daily_content_operator_approval_events_approvalId_crea_idx" ON "blog_daily_content_operator_approval_events"("approvalId", "createdAt");

-- CreateIndex
CREATE INDEX "blog_daily_content_operator_approval_events_planId_createdA_idx" ON "blog_daily_content_operator_approval_events"("planId", "createdAt");

-- CreateIndex
CREATE INDEX "blog_daily_content_operator_approval_events_planItemId_crea_idx" ON "blog_daily_content_operator_approval_events"("planItemId", "createdAt");

-- CreateIndex
CREATE INDEX "blog_daily_content_operator_approval_events_contentItemId_c_idx" ON "blog_daily_content_operator_approval_events"("contentItemId", "createdAt");

-- CreateIndex
CREATE INDEX "blog_daily_content_operator_approval_events_eventType_creat_idx" ON "blog_daily_content_operator_approval_events"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "blog_daily_content_operator_approval_events_idempotencyKey_key" ON "blog_daily_content_operator_approval_events"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "blog_daily_content_operator_approvals" ADD CONSTRAINT "blog_daily_content_operator_approvals_planId_fkey" FOREIGN KEY ("planId") REFERENCES "blog_daily_content_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_daily_content_operator_approvals" ADD CONSTRAINT "blog_daily_content_operator_approvals_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "blog_daily_content_plan_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_daily_content_operator_approvals" ADD CONSTRAINT "blog_daily_content_operator_approvals_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_daily_content_operator_approval_events" ADD CONSTRAINT "blog_daily_content_operator_approval_events_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "blog_daily_content_operator_approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_daily_content_operator_approval_events" ADD CONSTRAINT "blog_daily_content_operator_approval_events_planId_fkey" FOREIGN KEY ("planId") REFERENCES "blog_daily_content_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_daily_content_operator_approval_events" ADD CONSTRAINT "blog_daily_content_operator_approval_events_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "blog_daily_content_plan_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_daily_content_operator_approval_events" ADD CONSTRAINT "blog_daily_content_operator_approval_events_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
