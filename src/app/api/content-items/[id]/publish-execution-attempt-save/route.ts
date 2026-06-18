import { NextResponse } from "next/server";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { buildPublishApprovalExecutionGuard } from "@/lib/content/publish-approval-execution-guard";
import { buildPublishExecutionAttemptPreview } from "@/lib/content/publish-execution-attempt-preview";
import { getBloggerConnectionSecretStatus } from "@/lib/db/blogger-connection-secrets";
import { listBloggerConnectionsForBlog } from "@/lib/db/blogger-connections";
import { getLatestSuccessfulBloggerDraftSave, toBloggerDraftSaveAdmin } from "@/lib/db/blogger-draft-saves";
import { createBloggerPublishExecutionAttemptFromPlan, toBloggerPublishExecutionAttemptAdmin } from "@/lib/db/blogger-publish-execution-attempts";
import { findBloggerPublishApprovalById, toBloggerPublishApprovalAdmin } from "@/lib/db/blogger-publish-approvals";
import { prisma } from "@/lib/db/client";
import { safeErrorMessage } from "@/lib/llm/redaction";
import type { PublishExecutionAttemptSaveResponse } from "@/lib/blogger/admin-types";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

interface PublishExecutionAttemptSaveRequest {
  publishApprovalId?: string | null;
  attemptPlanHashPreview?: string | null;
  attemptPersistenceAcknowledged?: boolean;
  noBloggerWriteAcknowledged?: boolean;
  noContentMutationAcknowledged?: boolean;
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json().catch(() => ({}))) as PublishExecutionAttemptSaveRequest;
    const publishApprovalId = normalizeNullableString(body.publishApprovalId);
    const attemptPlanHashPreview = normalizeNullableString(body.attemptPlanHashPreview);
    const acknowledgementBlockingReasons = getAcknowledgementBlockingReasons(body);

    if (!publishApprovalId) {
      return blocked("publish_approval_missing", ["publish_approval_missing", ...acknowledgementBlockingReasons]);
    }
    if (!attemptPlanHashPreview) {
      return blocked("attempt_hash_missing", ["attempt_hash_missing", ...acknowledgementBlockingReasons]);
    }
    if (acknowledgementBlockingReasons.length > 0) {
      return blocked("attempt_acknowledgement_required", acknowledgementBlockingReasons);
    }

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

    const approval = await findBloggerPublishApprovalById(publishApprovalId);
    if (!approval || approval.contentItemId !== params.id) {
      return blocked("publish_approval_missing", ["publish_approval_missing"]);
    }
    if (approval.invalidatedAt) {
      return blocked("publish_approval_invalidated", ["publish_approval_invalidated"]);
    }
    if (approval.status !== "approved_snapshot") {
      return blocked("publish_approval_not_active", ["publish_approval_not_active"]);
    }

    const safeContentItem = contentItem as unknown as ContentItemAdmin;
    const bloggerConnections = contentItem.blogId ? await listBloggerConnectionsForBlog(contentItem.blogId) : [];
    const bloggerConnection = bloggerConnections.length === 1 ? bloggerConnections[0] : null;
    const secretStatus = bloggerConnection ? await getBloggerConnectionSecretStatus(bloggerConnection.id) : null;
    const latestSuccessfulDraftSave = await getLatestSuccessfulBloggerDraftSave(params.id);
    const safeApproval = toBloggerPublishApprovalAdmin(approval);
    const safeLatestSuccessfulDraftSave = latestSuccessfulDraftSave ? toBloggerDraftSaveAdmin(latestSuccessfulDraftSave) : null;
    const executionGuard = buildPublishApprovalExecutionGuard({
      contentItem: safeContentItem,
      latestApproval: safeApproval,
      latestSuccessfulDraftSave: safeLatestSuccessfulDraftSave,
      accessTokenExpired: isExpired(secretStatus?.accessTokenExpiresAt ?? null),
      mode: safeApproval.mode,
      scheduledAt: safeApproval.mode === "scheduled_publish" ? safeApproval.scheduledAt : null,
      timezone: safeApproval.mode === "scheduled_publish" ? safeApproval.timezone : null
    });

    if (!executionGuard.approvalMatchesCurrentState) {
      return blocked("approval_no_longer_matches_current_state", ["approval_no_longer_matches_current_state", ...executionGuard.invalidationCandidates]);
    }
    if (executionGuard.invalidationCandidates.length > 0) {
      return blocked("invalidation_candidates_present", ["invalidation_candidates_present", ...executionGuard.invalidationCandidates]);
    }

    const preview = buildPublishExecutionAttemptPreview({
      contentItemId: params.id,
      executionGuard,
      latestApproval: safeApproval,
      latestSuccessfulDraftSave: safeLatestSuccessfulDraftSave,
      contentStatusBefore: safeContentItem.status ?? null
    });

    if (preview.attemptPlanHashPreview !== attemptPlanHashPreview) {
      return blocked("attempt_hash_mismatch", ["attempt_hash_mismatch"]);
    }
    if (preview.plannedAttempt.bloggerApiWritePlanned || preview.plannedAttempt.contentMutationPlanned) {
      return blocked("attempt_plan_side_effect_not_allowed", ["attempt_plan_side_effect_not_allowed"]);
    }

    const { attempt, created } = await createBloggerPublishExecutionAttemptFromPlan({
      contentItemId: params.id,
      publishApprovalId,
      preview
    });
    const safeAttempt = toBloggerPublishExecutionAttemptAdmin(attempt);
    const response: PublishExecutionAttemptSaveResponse = {
      contentItemId: params.id,
      attemptId: safeAttempt.id,
      publishApprovalId: safeAttempt.publishApprovalId,
      created,
      existing: !created,
      status: safeAttempt.status,
      mode: safeAttempt.mode,
      attemptPlanHash: safeAttempt.attemptPlanHash,
      hashAlgorithm: safeAttempt.hashAlgorithm,
      canonicalization: safeAttempt.canonicalization,
      canExecutePublish: false,
      canExecuteScheduledPublish: false,
      canPublish: false,
      canSchedulePublish: false,
      blockingReasons: preview.blockingReasons,
      warnings: preview.warnings,
      savedAttemptSummary: {
        publishApprovalSnapshotHash: safeAttempt.publishApprovalSnapshotHash,
        targetBloggerBlogId: safeAttempt.targetBloggerBlogId,
        bloggerPostId: safeAttempt.bloggerPostId,
        draftHtmlHash: safeAttempt.draftHtmlHash,
        tokenStateAtAttempt: safeAttempt.tokenStateAtAttempt,
        approvalMatchesCurrentState: safeAttempt.approvalMatchesCurrentState,
        retryEligible: false,
        retryBlockedReason: safeAttempt.retryBlockedReason,
        contentMutationPlanned: false,
        contentMutationCompleted: false,
        createdAt: safeAttempt.createdAt
      },
      sideEffectSummary: {
        dbWrite: created,
        attemptPersistence: created,
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

    return NextResponse.json({ data: response });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Publish execution attempt save failed.", 500) }, { status: 400 });
  }
}

function blocked(error: string, blockingReasons: string[]) {
  return NextResponse.json(
    {
      error,
      blockingReasons: Array.from(new Set(blockingReasons)),
      sideEffectSummary: {
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
    },
    { status: 400 }
  );
}

function getAcknowledgementBlockingReasons(body: PublishExecutionAttemptSaveRequest) {
  const blockingReasons: string[] = [];
  if (body.attemptPersistenceAcknowledged !== true) {
    blockingReasons.push("attempt_acknowledgement_required");
  }
  if (body.noBloggerWriteAcknowledged !== true) {
    blockingReasons.push("blogger_write_acknowledgement_required");
  }
  if (body.noContentMutationAcknowledged !== true) {
    blockingReasons.push("content_mutation_acknowledgement_required");
  }
  return blockingReasons;
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
