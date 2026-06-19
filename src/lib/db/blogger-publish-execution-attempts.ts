import { Prisma } from "@prisma/client";
import type {
  BloggerPublishExecutionAttemptAdmin,
  BloggerPublishExecutionAttemptStatus,
  PublishApprovalMode,
  PublishApprovalTokenState,
  PublishExecutionAttemptPreviewResponse
} from "@/lib/blogger/admin-types";
import { prisma } from "@/lib/db/client";

const safeSelect = {
  id: true,
  contentItemId: true,
  publishApprovalId: true,
  publishApprovalSnapshotHash: true,
  mode: true,
  status: true,
  attemptNumber: true,
  targetBloggerBlogId: true,
  bloggerPostId: true,
  draftHtmlHash: true,
  titleCandidate: true,
  tokenStateAtAttempt: true,
  executionGuardCheckedAt: true,
  approvalMatchesCurrentState: true,
  retryEligible: true,
  retryBlockedReason: true,
  contentMutationPlanned: true,
  contentMutationCompleted: true,
  contentStatusBefore: true,
  contentStatusAfter: true,
  publishedAtPlanned: true,
  publishedAtApplied: true,
  scheduledAtPlanned: true,
  scheduledAtApplied: true,
  attemptPlanHash: true,
  hashAlgorithm: true,
  canonicalization: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.BloggerPublishExecutionAttemptSelect;

export type SafeBloggerPublishExecutionAttempt = Prisma.BloggerPublishExecutionAttemptGetPayload<{ select: typeof safeSelect }>;

export function countBloggerPublishExecutionAttemptsForContentItem(contentItemId: string) {
  return prisma.bloggerPublishExecutionAttempt.count({
    where: { contentItemId }
  });
}

export function findLatestBloggerPublishExecutionAttemptForContentItem(contentItemId: string) {
  return prisma.bloggerPublishExecutionAttempt.findFirst({
    where: { contentItemId },
    orderBy: [{ createdAt: "desc" }],
    select: safeSelect
  });
}

export function listBloggerPublishExecutionAttemptsForContentItem(contentItemId: string) {
  return prisma.bloggerPublishExecutionAttempt.findMany({
    where: { contentItemId },
    orderBy: [{ createdAt: "desc" }],
    take: 20,
    select: safeSelect
  });
}

export function listActiveBloggerPublishExecutionAttemptsForContentItem(contentItemId: string) {
  return prisma.bloggerPublishExecutionAttempt.findMany({
    where: {
      contentItemId,
      status: {
        in: ["planned_only", "blocked_by_preflight"]
      }
    },
    orderBy: [{ createdAt: "desc" }],
    take: 20,
    select: safeSelect
  });
}

export function findBloggerPublishExecutionAttemptById(id: string) {
  return prisma.bloggerPublishExecutionAttempt.findUnique({
    where: { id },
    select: safeSelect
  });
}

export async function createBloggerPublishExecutionAttemptFromPlan(input: {
  contentItemId: string;
  publishApprovalId: string;
  preview: PublishExecutionAttemptPreviewResponse;
}) {
  const plan = input.preview.plannedAttempt;
  if (plan.publishApprovalId !== input.publishApprovalId) {
    throw new Error("publish_approval_mismatch");
  }
  if (plan.mode !== "publish" && plan.mode !== "scheduled_publish") {
    throw new Error("invalid_publish_attempt_mode");
  }
  if (!plan.publishApprovalSnapshotHash) {
    throw new Error("publish_approval_snapshot_hash_missing");
  }
  if (input.preview.canExecutePublish || input.preview.canExecuteScheduledPublish) {
    throw new Error("publish_execution_unexpectedly_enabled");
  }
  if (plan.bloggerApiWritePlanned || plan.contentMutationPlanned) {
    throw new Error("attempt_plan_side_effect_not_allowed");
  }
  if (plan.approvalMatchesCurrentState !== true) {
    throw new Error("approval_no_longer_matches_current_state");
  }
  if (plan.invalidationCandidates.length > 0) {
    throw new Error("invalidation_candidates_present");
  }
  if (plan.status !== "planned_only" && plan.status !== "blocked_by_preflight") {
    throw new Error("invalid_attempt_status");
  }

  const existingAttempt = await prisma.bloggerPublishExecutionAttempt.findUnique({
    where: {
      contentItemId_publishApprovalId_attemptPlanHash: {
        contentItemId: input.contentItemId,
        publishApprovalId: input.publishApprovalId,
        attemptPlanHash: input.preview.attemptPlanHashPreview
      }
    },
    select: safeSelect
  });

  if (existingAttempt) {
    return {
      attempt: existingAttempt,
      created: false
    };
  }

  const attempt = await prisma.bloggerPublishExecutionAttempt.create({
    data: {
      contentItemId: input.contentItemId,
      publishApprovalId: input.publishApprovalId,
      publishApprovalSnapshotHash: plan.publishApprovalSnapshotHash,
      mode: plan.mode,
      status: plan.status,
      attemptNumber: 1,
      targetBloggerBlogId: plan.targetBloggerBlogId,
      bloggerPostId: plan.bloggerPostId,
      draftHtmlHash: plan.draftHtmlHash,
      titleCandidate: plan.titleCandidate,
      tokenStateAtAttempt: plan.tokenStateAtAttempt,
      executionGuardCheckedAt: new Date(plan.executionGuardCheckedAt),
      approvalMatchesCurrentState: plan.approvalMatchesCurrentState,
      invalidationCandidatesJson: plan.invalidationCandidates as unknown as Prisma.InputJsonValue,
      sideEffectSummaryJson: input.preview.sideEffectSummary as unknown as Prisma.InputJsonValue,
      bloggerRequestSummaryJson: {
        plannedOnly: true,
        bloggerApiWritePlanned: false,
        bloggerPublishPlanned: false,
        bloggerScheduledPublishPlanned: false,
        rawRequestBodyStored: false
      },
      bloggerResponseRedactedJson: Prisma.JsonNull,
      errorType: "blocked_pre_execution",
      errorCode: plan.retryBlockedReason,
      errorMessageRedacted: plan.retryBlockedReason,
      retryEligible: false,
      retryBlockedReason: plan.retryBlockedReason,
      contentMutationPlanned: false,
      contentMutationCompleted: false,
      contentStatusBefore: plan.contentStatusBefore,
      attemptPlanJson: plan as unknown as Prisma.InputJsonValue,
      attemptPlanHash: input.preview.attemptPlanHashPreview,
      hashAlgorithm: input.preview.hashAlgorithm,
      canonicalization: input.preview.canonicalization
    },
    select: safeSelect
  });

  return {
    attempt,
    created: true
  };
}

export function toBloggerPublishExecutionAttemptAdmin(attempt: SafeBloggerPublishExecutionAttempt): BloggerPublishExecutionAttemptAdmin {
  return {
    id: attempt.id,
    contentItemId: attempt.contentItemId,
    publishApprovalId: attempt.publishApprovalId,
    publishApprovalSnapshotHash: attempt.publishApprovalSnapshotHash,
    mode: toPublishApprovalMode(attempt.mode),
    status: toBloggerPublishExecutionAttemptStatus(attempt.status),
    attemptNumber: attempt.attemptNumber,
    targetBloggerBlogId: attempt.targetBloggerBlogId,
    bloggerPostId: attempt.bloggerPostId,
    draftHtmlHash: attempt.draftHtmlHash,
    titleCandidate: attempt.titleCandidate,
    tokenStateAtAttempt: toPublishApprovalTokenState(attempt.tokenStateAtAttempt),
    executionGuardCheckedAt: attempt.executionGuardCheckedAt.toISOString(),
    approvalMatchesCurrentState: attempt.approvalMatchesCurrentState,
    retryEligible: attempt.retryEligible,
    retryBlockedReason: attempt.retryBlockedReason,
    contentMutationPlanned: attempt.contentMutationPlanned,
    contentMutationCompleted: attempt.contentMutationCompleted,
    contentStatusBefore: attempt.contentStatusBefore,
    contentStatusAfter: attempt.contentStatusAfter,
    publishedAtPlanned: attempt.publishedAtPlanned?.toISOString() ?? null,
    publishedAtApplied: attempt.publishedAtApplied?.toISOString() ?? null,
    scheduledAtPlanned: attempt.scheduledAtPlanned?.toISOString() ?? null,
    scheduledAtApplied: attempt.scheduledAtApplied?.toISOString() ?? null,
    attemptPlanHash: attempt.attemptPlanHash,
    hashAlgorithm: attempt.hashAlgorithm === "sha256" ? "sha256" : "sha256",
    canonicalization: attempt.canonicalization,
    createdAt: attempt.createdAt.toISOString(),
    updatedAt: attempt.updatedAt.toISOString()
  };
}

function toPublishApprovalMode(value: string): PublishApprovalMode {
  return value === "scheduled_publish" ? "scheduled_publish" : "publish";
}

function toBloggerPublishExecutionAttemptStatus(value: string): BloggerPublishExecutionAttemptStatus {
  if (value === "success") {
    return "success";
  }
  return value === "blocked_by_preflight" ? "blocked_by_preflight" : "planned_only";
}

function toPublishApprovalTokenState(value: string | null): PublishApprovalTokenState | null {
  if (value === "expired_reauth_required" || value === "valid_not_verified" || value === "unknown") {
    return value;
  }
  return null;
}
