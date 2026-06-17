import { NextResponse } from "next/server";
import type { PublishApprovalMode } from "@/lib/blogger/admin-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { buildPublishApprovalExecutionGuard } from "@/lib/content/publish-approval-execution-guard";
import { buildPublishApprovalInvalidationPreview } from "@/lib/content/publish-approval-invalidation-preview";
import { getBloggerConnectionSecretStatus } from "@/lib/db/blogger-connection-secrets";
import { listBloggerConnectionsForBlog } from "@/lib/db/blogger-connections";
import { getLatestSuccessfulBloggerDraftSave, toBloggerDraftSaveAdmin } from "@/lib/db/blogger-draft-saves";
import { findBloggerPublishApprovalById, findLatestBloggerPublishApprovalForContentItem, toBloggerPublishApprovalAdmin } from "@/lib/db/blogger-publish-approvals";
import { prisma } from "@/lib/db/client";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

interface PublishApprovalInvalidationPreviewRequest {
  approvalId?: string | null;
  mode?: PublishApprovalMode;
  scheduledAt?: string | null;
  timezone?: string | null;
  manualInvalidationRequested?: boolean;
  manualReason?: string | null;
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json().catch(() => ({}))) as PublishApprovalInvalidationPreviewRequest;
    const mode = parseMode(body.mode);
    const scheduledAt = normalizeNullableString(body.scheduledAt);
    const timezone = normalizeNullableString(body.timezone);
    const approvalId = normalizeNullableString(body.approvalId);
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
    const [requestedApproval, latestApproval, latestSuccessfulDraftSave] = await Promise.all([
      approvalId ? findBloggerPublishApprovalById(approvalId) : Promise.resolve(null),
      findLatestBloggerPublishApprovalForContentItem(params.id),
      getLatestSuccessfulBloggerDraftSave(params.id)
    ]);
    const selectedApproval = requestedApproval?.contentItemId === params.id ? requestedApproval : latestApproval;
    const executionGuard = buildPublishApprovalExecutionGuard({
      contentItem: safeContentItem,
      latestApproval: selectedApproval ? toBloggerPublishApprovalAdmin(selectedApproval) : null,
      latestSuccessfulDraftSave: latestSuccessfulDraftSave ? toBloggerDraftSaveAdmin(latestSuccessfulDraftSave) : null,
      accessTokenExpired: isExpired(secretStatus?.accessTokenExpiresAt ?? null),
      mode,
      scheduledAt: mode === "scheduled_publish" ? scheduledAt : null,
      timezone: mode === "scheduled_publish" ? timezone : null
    });

    const result = buildPublishApprovalInvalidationPreview({
      contentItemId: params.id,
      executionGuard,
      manualInvalidationRequested: body.manualInvalidationRequested === true,
      manualReason: normalizeNullableString(body.manualReason)
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Publish approval invalidation preview failed.", 500) }, { status: 400 });
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
