-- Patch 9A: Blogger connection placeholder settings.
-- This migration stores only connection status and safe metadata.
-- OAuth tokens, refresh tokens, and client secret plaintext are intentionally not stored.

CREATE TYPE "BloggerConnectionStatus" AS ENUM ('not_configured', 'configured', 'oauth_required', 'connected', 'expired', 'error');

CREATE TABLE "blogger_connections" (
  "id" TEXT NOT NULL,
  "blogId" TEXT,
  "name" TEXT NOT NULL,
  "status" "BloggerConnectionStatus" NOT NULL DEFAULT 'not_configured',
  "bloggerBlogId" TEXT,
  "bloggerBlogName" TEXT,
  "connectedEmail" TEXT,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "clientSecretRef" TEXT,
  "hasClientSecret" BOOLEAN NOT NULL DEFAULT false,
  "hasAccessToken" BOOLEAN NOT NULL DEFAULT false,
  "hasRefreshToken" BOOLEAN NOT NULL DEFAULT false,
  "tokenLast4" TEXT,
  "lastTestedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "blogger_connections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "blogger_connections_blogId_idx" ON "blogger_connections"("blogId");
CREATE INDEX "blogger_connections_status_idx" ON "blogger_connections"("status");
CREATE INDEX "blogger_connections_bloggerBlogId_idx" ON "blogger_connections"("bloggerBlogId");

ALTER TABLE "blogger_connections"
  ADD CONSTRAINT "blogger_connections_blogId_fkey"
  FOREIGN KEY ("blogId") REFERENCES "blogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
