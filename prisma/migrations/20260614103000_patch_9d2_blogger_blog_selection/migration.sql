-- Patch 9D-2: store verified selected Blogger blog metadata.
ALTER TABLE "blogger_connections"
ADD COLUMN "bloggerBlogUrl" TEXT,
ADD COLUMN "bloggerBlogVerifiedAt" TIMESTAMP(3);

CREATE INDEX "blogger_connections_bloggerBlogVerifiedAt_idx" ON "blogger_connections"("bloggerBlogVerifiedAt");
