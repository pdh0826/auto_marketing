-- Patch 9A grant fix: allow the application DB user to use the Blogger connection placeholder table.
-- No secret/token values are created or stored by this migration.

GRANT USAGE ON TYPE "BloggerConnectionStatus" TO blog_growth_agent_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "blogger_connections" TO blog_growth_agent_app;
