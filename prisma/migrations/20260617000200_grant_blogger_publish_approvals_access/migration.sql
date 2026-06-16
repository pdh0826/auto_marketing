-- Grant application role access to Blogger publish approval persistence objects.
GRANT USAGE ON TYPE "BloggerPublishApprovalMode" TO blog_growth_agent_app;
GRANT USAGE ON TYPE "BloggerPublishApprovalStatus" TO blog_growth_agent_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "blogger_publish_approvals" TO blog_growth_agent_app;
