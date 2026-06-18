import { NextResponse } from "next/server";
import type { PublishApprovalMode } from "@/lib/blogger/admin-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { buildPublishApprovalExecutionGuard } from "@/lib/content/publish-approval-execution-guard";
import { buildPublishExecutionAttemptPreview } from "@/lib/content/publish-execution-attempt-preview";
import { getBloggerConnectionSecretStatus } from "@/lib/db/blogger-connection-secrets";
import { listBloggerConnectionsForBlog } from "@/lib/db/blogger-connections";
import { getLatestSuccessfulBloggerDraftSave, toBloggerDraftSaveAdmin } from "@/lib/db/blogger-draft-saves";
import { findLatestBloggerPublishApprovalForContentItem, toBloggerPublishApprovalAdmin } from "@/lib/db/blogger-publish-approvals";
import { prisma } from "@/lib/db/client";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

interface PublishExecutionAttemptPreviewRequest {
  mode?: PublishApprovalMode;
  scheduledAt?: string | null;
  timezone?: string | null;
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json().catch(() => ({}))) as PublishExecutionAttemptPreviewRequest;
    const mode = parseMode(body.mode);
    const scheduledAt = normalizeNullableString(body.scheduledAt);
    const timezone = normalizeNullableString(body.timezone);
    const contentItem = await prisma.contentItem.findUnique({
      where: { id: params.id },
      include: {
        blog: true,
        brandProfile: true
      }
    });

    if (!contentItem) {
      return NextResponse.json({ error: "Content item not found." }, { status: 404 });
    }

    const safeContentItem = contentItem as unknown as ContentItemAdmin;
    const bloggerConnections = contentItem.blogId ? await listBloggerConnectionsForBlog(contentItem.blogId) : [];
    const bloggerConnection = bloggerConnections.length === 1 ? bloggerConnections[0] : null;
    const secretStatus = bloggerConnection ? await getBloggerConnectionSecretStatus(bloggerConnection.id) : null;
    const [latestApproval, latestSuccessfulDraftSave] = await Promise.all([
      findLatestBloggerPublishApprovalForContentItem(params.id),
      getLatestSuccessfulBloggerDraftSave(params.id)
    ]);
    const safeLatestApproval = latestApproval ? toBloggerPublishApprovalAdmin(latestApproval) : null;
    const safeLatestSuccessfulDraftSave = latestSuccessfulDraftSave ? toBloggerDraftSaveAdmin(latestSuccessfulDraftSave) : null;
    const executionGuard = buildPublishApprovalExecutionGuard({
      contentItem: safeContentItem,
      latestApproval: safeLatestApproval,
      latestSuccessfulDraftSave: safeLatestSuccessfulDraftSave,
      accessTokenExpired: isExpired(secretStatus?.accessTokenExpiresAt ?? null),
      mode,
      scheduledAt: mode === "scheduled_publish" ? scheduledAt : null,
      timezone: mode === "scheduled_publish" ? timezone : null
    });
    const result = buildPublishExecutionAttemptPreview({
      contentItemId: params.id,
      executionGuard,
      latestApproval: safeLatestApproval,
      latestSuccessfulDraftSave: safeLatestSuccessfulDraftSave,
      contentStatusBefore: safeContentItem.status ?? null
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Publish execution attempt preview failed.", 500) }, { status: 400 });
  }
}

function parseMode(value: unknown): PublishApprovalMode | null {
  if (value === "publish" || value === "scheduled_publish") {
    return value;
  }
  return null;
}

function normalizeNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isExpired(value: string | null) {
  if (!value) {
    return false;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time <= Date.now();
}
