-- Patch 9B: Blogger OAuth state storage for authorization URL dry-run.
-- OAuth state plaintext, authorization codes, access tokens, refresh tokens,
-- and client secrets are intentionally not stored by this migration.

ALTER TABLE "blogger_connections"
  ADD COLUMN "oauthClientIdRef" TEXT;

CREATE TABLE "blogger_oauth_states" (
  "id" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "redirectUri" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "blogger_oauth_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blogger_oauth_states_stateHash_key" ON "blogger_oauth_states"("stateHash");
CREATE INDEX "blogger_oauth_states_connectionId_idx" ON "blogger_oauth_states"("connectionId");
CREATE INDEX "blogger_oauth_states_expiresAt_idx" ON "blogger_oauth_states"("expiresAt");

ALTER TABLE "blogger_oauth_states"
  ADD CONSTRAINT "blogger_oauth_states_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "blogger_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "blogger_oauth_states" TO blog_growth_agent_app;
