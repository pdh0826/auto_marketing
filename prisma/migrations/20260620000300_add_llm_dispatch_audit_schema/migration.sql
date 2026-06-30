-- CreateTable
CREATE TABLE "blog_daily_content_llm_dispatch_attempts" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planItemId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "operatorApprovalId" TEXT NOT NULL,
    "idempotencyKeyHash" TEXT NOT NULL,
    "attemptPurpose" TEXT NOT NULL DEFAULT 'daily_content_draft_generation',
    "attemptStatus" TEXT NOT NULL DEFAULT 'planned',
    "providerKey" TEXT,
    "providerKind" TEXT,
    "modelKey" TEXT,
    "modelDisplayName" TEXT,
    "requestEnvelopeHash" TEXT NOT NULL,
    "promptSha256" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "promptQualityChecklistVersion" TEXT NOT NULL,
    "dispatchGateVersion" TEXT NOT NULL,
    "healthCheckReferenceId" TEXT,
    "healthCheckSummaryHash" TEXT,
    "confirmationPhraseHash" TEXT NOT NULL,
    "requestBodyStored" BOOLEAN NOT NULL DEFAULT false,
    "requestBodyRedacted" BOOLEAN NOT NULL DEFAULT true,
    "responseBodyStored" BOOLEAN NOT NULL DEFAULT false,
    "responseBodyRedacted" BOOLEAN NOT NULL DEFAULT true,
    "rawSecretStored" BOOLEAN NOT NULL DEFAULT false,
    "rawTokenStored" BOOLEAN NOT NULL DEFAULT false,
    "providerNetworkCallAttempted" BOOLEAN NOT NULL DEFAULT false,
    "llmCallAttempted" BOOLEAN NOT NULL DEFAULT false,
    "llmCompletionReceived" BOOLEAN NOT NULL DEFAULT false,
    "contentMutationAttempted" BOOLEAN NOT NULL DEFAULT false,
    "draftMutationAttempted" BOOLEAN NOT NULL DEFAULT false,
    "bloggerWriteAttempted" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "errorCategory" TEXT,
    "errorMessageRedacted" TEXT,
    "metadata" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_daily_content_llm_dispatch_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_daily_content_llm_dispatch_events" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventStatus" TEXT NOT NULL,
    "eventMessage" TEXT,
    "eventPayloadRedactedJson" JSONB,
    "rawSecretStored" BOOLEAN NOT NULL DEFAULT false,
    "rawTokenStored" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_daily_content_llm_dispatch_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_daily_content_llm_dispatch_artifacts" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "artifactKind" TEXT NOT NULL,
    "artifactHash" TEXT NOT NULL,
    "artifactStorageMode" TEXT NOT NULL DEFAULT 'not_stored',
    "artifactRedactionStatus" TEXT NOT NULL DEFAULT 'redacted_or_hash_only',
    "artifactPreview" TEXT,
    "rawSecretStored" BOOLEAN NOT NULL DEFAULT false,
    "rawTokenStored" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_daily_content_llm_dispatch_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_bdc_llm_dispatch_idempotency" ON "blog_daily_content_llm_dispatch_attempts"("planItemId", "contentItemId", "attemptPurpose", "idempotencyKeyHash");

-- CreateIndex
CREATE INDEX "idx_bdc_llm_dispatch_attempts_plan_created" ON "blog_daily_content_llm_dispatch_attempts"("planId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_bdc_llm_dispatch_attempts_item_created" ON "blog_daily_content_llm_dispatch_attempts"("planItemId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_bdc_llm_dispatch_attempts_content_created" ON "blog_daily_content_llm_dispatch_attempts"("contentItemId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_bdc_llm_dispatch_attempts_status_created" ON "blog_daily_content_llm_dispatch_attempts"("attemptStatus", "createdAt");

-- CreateIndex
CREATE INDEX "idx_bdc_llm_dispatch_attempts_provider_model_created" ON "blog_daily_content_llm_dispatch_attempts"("providerKey", "modelKey", "createdAt");

-- CreateIndex
CREATE INDEX "idx_bdc_llm_dispatch_attempts_envelope_hash" ON "blog_daily_content_llm_dispatch_attempts"("requestEnvelopeHash");

-- CreateIndex
CREATE INDEX "idx_bdc_llm_dispatch_attempts_prompt_hash" ON "blog_daily_content_llm_dispatch_attempts"("promptSha256");

-- CreateIndex
CREATE INDEX "idx_bdc_llm_dispatch_events_attempt_created" ON "blog_daily_content_llm_dispatch_events"("attemptId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_bdc_llm_dispatch_events_type_created" ON "blog_daily_content_llm_dispatch_events"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "idx_bdc_llm_dispatch_events_status_created" ON "blog_daily_content_llm_dispatch_events"("eventStatus", "createdAt");

-- CreateIndex
CREATE INDEX "idx_bdc_llm_dispatch_artifacts_attempt_created" ON "blog_daily_content_llm_dispatch_artifacts"("attemptId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_bdc_llm_dispatch_artifacts_kind_created" ON "blog_daily_content_llm_dispatch_artifacts"("artifactKind", "createdAt");

-- CreateIndex
CREATE INDEX "idx_bdc_llm_dispatch_artifacts_hash" ON "blog_daily_content_llm_dispatch_artifacts"("artifactHash");

-- AddForeignKey
ALTER TABLE "blog_daily_content_llm_dispatch_attempts" ADD CONSTRAINT "blog_daily_content_llm_dispatch_attempts_planId_fkey" FOREIGN KEY ("planId") REFERENCES "blog_daily_content_plans"("id") ON DELETE RESTRICT;

-- AddForeignKey
ALTER TABLE "blog_daily_content_llm_dispatch_attempts" ADD CONSTRAINT "blog_daily_content_llm_dispatch_attempts_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "blog_daily_content_plan_items"("id") ON DELETE RESTRICT;

-- AddForeignKey
ALTER TABLE "blog_daily_content_llm_dispatch_attempts" ADD CONSTRAINT "blog_daily_content_llm_dispatch_attempts_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_items"("id") ON DELETE RESTRICT;

-- AddForeignKey
ALTER TABLE "blog_daily_content_llm_dispatch_attempts" ADD CONSTRAINT "blog_daily_content_llm_dispatch_attempts_operatorApprovalId_fkey" FOREIGN KEY ("operatorApprovalId") REFERENCES "blog_daily_content_operator_approvals"("id") ON DELETE RESTRICT;

-- AddForeignKey
ALTER TABLE "blog_daily_content_llm_dispatch_events" ADD CONSTRAINT "blog_daily_content_llm_dispatch_events_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "blog_daily_content_llm_dispatch_attempts"("id") ON DELETE RESTRICT;

-- AddForeignKey
ALTER TABLE "blog_daily_content_llm_dispatch_artifacts" ADD CONSTRAINT "blog_daily_content_llm_dispatch_artifacts_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "blog_daily_content_llm_dispatch_attempts"("id") ON DELETE RESTRICT;
