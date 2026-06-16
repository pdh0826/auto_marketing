import { NextResponse } from "next/server";
import type { PublishApprovalReadbackResponse } from "@/lib/blogger/admin-types";
import {
  countBloggerPublishApprovalsForContentItem,
  findLatestBloggerPublishApprovalForContentItem,
  listActiveBloggerPublishApprovalsForContentItem,
  toBloggerPublishApprovalAdmin
} from "@/lib/db/blogger-publish-approvals";
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
      select: { id: true }
    });

    if (!contentItem) {
      return NextResponse.json({ error: "Content item not found." }, { status: 404 });
    }

    const [count, latestApproval, activeApprovals] = await Promise.all([
      countBloggerPublishApprovalsForContentItem(params.id),
      findLatestBloggerPublishApprovalForContentItem(params.id),
      listActiveBloggerPublishApprovalsForContentItem(params.id)
    ]);
    const latestApprovalAdmin = latestApproval ? toBloggerPublishApprovalAdmin(latestApproval) : null;
    const blockingReasons = new Set<string>(["publish_not_implemented", "scheduled_publish_not_implemented"]);
    const warnings = new Set<string>();

    if (!latestApprovalAdmin) {
      blockingReasons.add("publish_approval_missing");
    }
    if (latestApprovalAdmin?.tokenState === "expired_reauth_required") {
      blockingReasons.add("access_token_expired_reauth_required");
    }
    if (latestApprovalAdmin && latestApprovalAdmin.status !== "approved_snapshot") {
      blockingReasons.add("publish_approval_not_active");
    }
    if (activeApprovals.length > 1) {
      warnings.add("multiple_active_publish_approvals");
    }

    const result: PublishApprovalReadbackResponse = {
      contentItemId: params.id,
      checkedAt: new Date().toISOString(),
      count,
      latestApproval: latestApprovalAdmin,
      activeApprovals: activeApprovals.map(toBloggerPublishApprovalAdmin),
      canPublish: false,
      canSchedulePublish: false,
      blockingReasons: Array.from(blockingReasons),
      warnings: Array.from(warnings),
      sideEffectSummary: {
        dbRead: true,
        dbWrite: false,
        approvalPersistence: false,
        contentItemMutation: false,
        bloggerApiWrite: false,
        bloggerPublish: false,
        bloggerScheduledPublish: false,
        bloggerPostsUpdate: false,
        bloggerDraftSave: false,
        tokenRefresh: false,
        llmCall: false
      }
    };

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Publish approval readback failed.", 500) }, { status: 400 });
  }
}
