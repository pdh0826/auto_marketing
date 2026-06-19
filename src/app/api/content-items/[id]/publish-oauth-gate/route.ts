import { NextResponse } from "next/server";
import { buildOperationProfileAdvisorySummary } from "@/lib/blog-operation-profiles/operation-profile-advisory";
import { buildPublishOAuthGate } from "@/lib/content/publish-oauth-gate";
import { getBloggerConnectionSecretStatus } from "@/lib/db/blogger-connection-secrets";
import { listBloggerConnectionsForBlog } from "@/lib/db/blogger-connections";
import { findLatestBloggerPublishApprovalForContentItem, toBloggerPublishApprovalAdmin } from "@/lib/db/blogger-publish-approvals";
import { findLatestBloggerPublishExecutionAttemptForContentItem, toBloggerPublishExecutionAttemptAdmin } from "@/lib/db/blogger-publish-execution-attempts";
import { prisma } from "@/lib/db/client";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const contentItem = await prisma.contentItem.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        blogId: true,
        status: true,
        scheduledAt: true,
        publishedAt: true,
        draftMarkdown: true,
        draftHtml: true
      }
    });

    if (!contentItem) {
      return NextResponse.json({ error: "Content item not found." }, { status: 404 });
    }

    const bloggerConnections = contentItem.blogId ? await listBloggerConnectionsForBlog(contentItem.blogId) : [];
    const bloggerConnection = bloggerConnections.length === 1 ? bloggerConnections[0] : null;
    const [secretStatus, latestApproval, latestAttempt] = await Promise.all([
      bloggerConnection ? getBloggerConnectionSecretStatus(bloggerConnection.id) : Promise.resolve(null),
      findLatestBloggerPublishApprovalForContentItem(params.id),
      findLatestBloggerPublishExecutionAttemptForContentItem(params.id)
    ]);

    const targetBloggerBlogId = latestApproval?.targetBloggerBlogId ?? latestAttempt?.targetBloggerBlogId ?? bloggerConnection?.bloggerBlogId ?? null;
    const targetBloggerBlogName = latestApproval?.targetBloggerBlogName ?? bloggerConnection?.bloggerBlogName ?? null;
    const targetBloggerBlogUrl = latestApproval?.targetBloggerBlogUrl ?? bloggerConnection?.bloggerBlogUrl ?? null;
    const operationProfileAdvisorySummary = await buildOperationProfileAdvisorySummary({
      targetBloggerBlogId,
      targetBloggerBlogName,
      targetBloggerBlogUrl
    });

    const result = buildPublishOAuthGate({
      contentItemId: params.id,
      connection: bloggerConnection
        ? {
            id: bloggerConnection.id,
            bloggerBlogId: bloggerConnection.bloggerBlogId,
            bloggerBlogName: bloggerConnection.bloggerBlogName,
            bloggerBlogUrl: bloggerConnection.bloggerBlogUrl
          }
        : null,
      connectionCount: bloggerConnections.length,
      hasAccessToken: Boolean(secretStatus?.hasAccessToken),
      accessTokenExpiresAt: secretStatus?.accessTokenExpiresAt ?? null,
      contentStatus: contentItem.status,
      scheduledAt: contentItem.scheduledAt?.toISOString() ?? null,
      publishedAt: contentItem.publishedAt?.toISOString() ?? null,
      draftMarkdown: contentItem.draftMarkdown,
      draftHtml: contentItem.draftHtml,
      latestApproval: latestApproval ? toBloggerPublishApprovalAdmin(latestApproval) : null,
      latestAttempt: latestAttempt ? toBloggerPublishExecutionAttemptAdmin(latestAttempt) : null,
      operationProfileAdvisorySummary
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Publish OAuth gate failed.", 500) }, { status: 400 });
  }
}
