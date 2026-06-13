-- CreateEnum
CREATE TYPE "LlmInvocationMode" AS ENUM ('external_http', 'local_http', 'cli');

-- CreateEnum
CREATE TYPE "LlmApiFormat" AS ENUM ('openai_compatible', 'ollama_compatible', 'custom_http', 'custom_cli');

-- CreateEnum
CREATE TYPE "LlmProviderTestStatus" AS ENUM ('untested', 'success', 'failed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LlmProviderType" ADD VALUE 'external_http';
ALTER TYPE "LlmProviderType" ADD VALUE 'local_http';
ALTER TYPE "LlmProviderType" ADD VALUE 'cli';

-- AlterEnum
ALTER TYPE "LlmTaskType" ADD VALUE 'provider_test';

-- AlterTable
ALTER TABLE "llm_providers" ADD COLUMN     "apiFormat" "LlmApiFormat" NOT NULL DEFAULT 'openai_compatible',
ADD COLUMN     "cliArgsJson" JSONB,
ADD COLUMN     "cliExecutable" TEXT,
ADD COLUMN     "defaultModel" TEXT,
ADD COLUMN     "endpointPath" TEXT,
ADD COLUMN     "headersJson" JSONB,
ADD COLUMN     "invocationMode" "LlmInvocationMode" NOT NULL DEFAULT 'external_http',
ADD COLUMN     "lastTestError" TEXT,
ADD COLUMN     "lastTestStatus" "LlmProviderTestStatus" NOT NULL DEFAULT 'untested',
ADD COLUMN     "lastTestedAt" TIMESTAMP(3),
ADD COLUMN     "requestTemplateJson" JSONB;

-- CreateTable
CREATE TABLE "llm_provider_secrets" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "secretKind" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "keyVersion" TEXT NOT NULL DEFAULT 'v1',
    "apiKeyLast4" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_provider_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "llm_provider_secrets_providerId_idx" ON "llm_provider_secrets"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "llm_provider_secrets_providerId_secretKind_key" ON "llm_provider_secrets"("providerId", "secretKind");

-- CreateIndex
CREATE INDEX "llm_providers_invocationMode_idx" ON "llm_providers"("invocationMode");

-- CreateIndex
CREATE INDEX "llm_providers_apiFormat_idx" ON "llm_providers"("apiFormat");

-- CreateIndex
CREATE INDEX "llm_providers_lastTestStatus_idx" ON "llm_providers"("lastTestStatus");

-- AddForeignKey
ALTER TABLE "llm_provider_secrets" ADD CONSTRAINT "llm_provider_secrets_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "llm_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
