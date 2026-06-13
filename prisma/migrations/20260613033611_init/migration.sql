-- CreateEnum
CREATE TYPE "BlogStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "CtaStrength" AS ENUM ('weak', 'normal', 'strong');

-- CreateEnum
CREATE TYPE "ContentMode" AS ENUM ('seo_keyword', 'service_promotion', 'memo_expand', 'existing_draft_improve');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('idea', 'planned', 'drafted', 'quality_review', 'approved', 'scheduled', 'published', 'failed', 'rewrite_needed');

-- CreateEnum
CREATE TYPE "LlmProviderType" AS ENUM ('openai', 'local');

-- CreateEnum
CREATE TYPE "LlmTaskType" AS ENUM ('content_plan', 'content_draft', 'html_convert', 'quality_check', 'style_rewrite', 'cta_generate', 'keyword_analyze', 'serp_analyze', 'image_analyze');

-- CreateEnum
CREATE TYPE "LlmCallStatus" AS ENUM ('success', 'failed');

-- CreateTable
CREATE TABLE "blogs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "bloggerBlogId" TEXT,
    "mainTopic" TEXT,
    "subTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetReader" TEXT,
    "tone" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ko-KR',
    "forbiddenPhrases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredPhrases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultContentLength" INTEGER NOT NULL DEFAULT 1200,
    "defaultCtaStrength" "CtaStrength" NOT NULL DEFAULT 'normal',
    "dailyPublishLimit" INTEGER NOT NULL DEFAULT 1,
    "nightExcludeStart" TEXT,
    "nightExcludeEnd" TEXT,
    "autoPublishEnabled" BOOLEAN NOT NULL DEFAULT false,
    "manualApprovalRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" "BlogStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceName" TEXT,
    "shortDescription" TEXT,
    "longDescription" TEXT,
    "targetUsers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coreFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "problemsSolved" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mainUrl" TEXT,
    "ctaWeak" TEXT,
    "ctaNormal" TEXT,
    "ctaStrong" TEXT,
    "forbiddenPhrases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredPhrases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "riskDisclaimer" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" TEXT NOT NULL,
    "blogId" TEXT,
    "brandProfileId" TEXT,
    "mode" "ContentMode" NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'idea',
    "title" TEXT,
    "targetKeyword" TEXT,
    "sourceMemo" TEXT,
    "planJson" JSONB,
    "draftMarkdown" TEXT,
    "draftHtml" TEXT,
    "qualityScore" INTEGER,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_providers" (
    "id" TEXT NOT NULL,
    "providerType" "LlmProviderType" NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT,
    "secretRef" TEXT,
    "apiKeyLast4" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "timeoutSeconds" INTEGER NOT NULL DEFAULT 60,
    "maxRetries" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_models" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_task_routes" (
    "id" TEXT NOT NULL,
    "taskType" "LlmTaskType" NOT NULL,
    "primaryProviderId" TEXT NOT NULL,
    "primaryModelId" TEXT NOT NULL,
    "fallbackProviderId" TEXT,
    "fallbackModelId" TEXT,
    "temperature" DOUBLE PRECISION,
    "maxTokens" INTEGER,
    "timeoutSeconds" INTEGER,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_task_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_call_logs" (
    "id" TEXT NOT NULL,
    "taskType" "LlmTaskType" NOT NULL,
    "providerId" TEXT,
    "modelId" TEXT,
    "contentItemId" TEXT,
    "status" "LlmCallStatus" NOT NULL,
    "latencyMs" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCost" DECIMAL(10,6),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blogs_status_idx" ON "blogs"("status");

-- CreateIndex
CREATE INDEX "brand_profiles_isDefault_idx" ON "brand_profiles"("isDefault");

-- CreateIndex
CREATE INDEX "content_items_blogId_idx" ON "content_items"("blogId");

-- CreateIndex
CREATE INDEX "content_items_brandProfileId_idx" ON "content_items"("brandProfileId");

-- CreateIndex
CREATE INDEX "content_items_status_idx" ON "content_items"("status");

-- CreateIndex
CREATE INDEX "content_items_mode_idx" ON "content_items"("mode");

-- CreateIndex
CREATE INDEX "llm_providers_providerType_idx" ON "llm_providers"("providerType");

-- CreateIndex
CREATE INDEX "llm_providers_isEnabled_idx" ON "llm_providers"("isEnabled");

-- CreateIndex
CREATE INDEX "llm_models_isEnabled_idx" ON "llm_models"("isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "llm_models_providerId_name_key" ON "llm_models"("providerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "llm_task_routes_taskType_key" ON "llm_task_routes"("taskType");

-- CreateIndex
CREATE INDEX "llm_task_routes_isEnabled_idx" ON "llm_task_routes"("isEnabled");

-- CreateIndex
CREATE INDEX "llm_call_logs_taskType_idx" ON "llm_call_logs"("taskType");

-- CreateIndex
CREATE INDEX "llm_call_logs_status_idx" ON "llm_call_logs"("status");

-- CreateIndex
CREATE INDEX "llm_call_logs_createdAt_idx" ON "llm_call_logs"("createdAt");

-- CreateIndex
CREATE INDEX "llm_call_logs_contentItemId_idx" ON "llm_call_logs"("contentItemId");

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "blogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_models" ADD CONSTRAINT "llm_models_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "llm_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_task_routes" ADD CONSTRAINT "llm_task_routes_primaryProviderId_fkey" FOREIGN KEY ("primaryProviderId") REFERENCES "llm_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_task_routes" ADD CONSTRAINT "llm_task_routes_primaryModelId_fkey" FOREIGN KEY ("primaryModelId") REFERENCES "llm_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_task_routes" ADD CONSTRAINT "llm_task_routes_fallbackProviderId_fkey" FOREIGN KEY ("fallbackProviderId") REFERENCES "llm_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_task_routes" ADD CONSTRAINT "llm_task_routes_fallbackModelId_fkey" FOREIGN KEY ("fallbackModelId") REFERENCES "llm_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_call_logs" ADD CONSTRAINT "llm_call_logs_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "llm_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_call_logs" ADD CONSTRAINT "llm_call_logs_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "llm_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_call_logs" ADD CONSTRAINT "llm_call_logs_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
