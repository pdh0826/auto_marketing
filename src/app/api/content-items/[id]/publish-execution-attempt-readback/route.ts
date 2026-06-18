import { NextResponse } from "next/server";
import type { PublishExecutionAttemptReadbackResponse } from "@/lib/blogger/admin-types";
import {
  countBloggerPublishExecutionAttemptsForContentItem,
  findLatestBloggerPublishExecutionAttemptForContentItem,
  listActiveBloggerPublishExecutionAttemptsForContentItem,
  toBloggerPublishExecutionAttemptAdmin
} from "@/lib/db/blogger-publish-execution-attempts";
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

    const [count, latestAttempt, activeAttempts] = await Promise.all([
      countBloggerPublishExecutionAttemptsForContentItem(params.id),
      findLatestBloggerPublishExecutionAttemptForContentItem(params.id),
      listActiveBloggerPublishExecutionAttemptsForContentItem(params.id)
    ]);
    const blockingReasons = new Set<string>(["publish_execution_not_implemented"]);
    if (count === 0) {
      blockingReasons.add("publish_execution_attempt_missing");
    }

    const result: PublishExecutionAttemptReadbackResponse = {
      contentItemId: params.id,
      checkedAt: new Date().toISOString(),
      count,
      latestAttempt: latestAttempt ? toBloggerPublishExecutionAttemptAdmin(latestAttempt) : null,
      activeAttempts: activeAttempts.map(toBloggerPublishExecutionAttemptAdmin),
      canExecutePublish: false,
      canExecuteScheduledPublish: false,
      canPublish: false,
      canSchedulePublish: false,
      blockingReasons: Array.from(blockingReasons),
      warnings: [],
      sideEffectSummary: {
        dbRead: true,
        dbWrite: false,
        attemptPersistence: false,
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
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Publish execution attempt readback failed.", 500) }, { status: 400 });
  }
}
