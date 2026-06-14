-- Patch 9C-1: Blogger token storage security foundation.
-- Stores encrypted secret values only; plaintext token/client secret columns are intentionally absent.

CREATE TYPE "BloggerSecretKind" AS ENUM ('oauth_client_secret', 'access_token', 'refresh_token');

CREATE TABLE "blogger_connection_secrets" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "secretKind" "BloggerSecretKind" NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "keyVersion" TEXT NOT NULL DEFAULT 'v1',
    "last4" TEXT,
    "tokenType" TEXT,
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blogger_connection_secrets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blogger_connection_secrets_connectionId_secretKind_key" ON "blogger_connection_secrets"("connectionId", "secretKind");
CREATE INDEX "blogger_connection_secrets_connectionId_idx" ON "blogger_connection_secrets"("connectionId");
CREATE INDEX "blogger_connection_secrets_secretKind_idx" ON "blogger_connection_secrets"("secretKind");
CREATE INDEX "blogger_connection_secrets_expiresAt_idx" ON "blogger_connection_secrets"("expiresAt");

ALTER TABLE "blogger_connection_secrets"
ADD CONSTRAINT "blogger_connection_secrets_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "blogger_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT USAGE ON TYPE "BloggerSecretKind" TO blog_growth_agent_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "blogger_connection_secrets" TO blog_growth_agent_app;
