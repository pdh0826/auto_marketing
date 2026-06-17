import type { PublishApprovalExecutionGuardResponse, PublishApprovalInvalidationPreviewResponse } from "@/lib/blogger/admin-types";

export interface BuildPublishApprovalInvalidationPreviewInput {
  contentItemId: string;
  executionGuard: PublishApprovalExecutionGuardResponse;
  manualInvalidationRequested?: boolean;
  manualReason?: string | null;
  checkedAt?: Date;
}

export function buildPublishApprovalInvalidationPreview(input: BuildPublishApprovalInvalidationPreviewInput): PublishApprovalInvalidationPreviewResponse {
  const checkedAt = input.checkedAt ?? new Date();
  const manualReason = normalizeManualReason(input.manualReason);
  const manualInvalidationRequested = Boolean(input.manualInvalidationRequested || manualReason);
  const invalidationReasons = new Set<string>(input.executionGuard.invalidationCandidates);
  const blockingReasons = new Set<string>(["invalidation_persistence_not_implemented"]);
  const warnings = new Set<string>();

  if (manualInvalidationRequested) {
    invalidationReasons.add("manual_user_requested_invalidation");
  }
  if (!input.executionGuard.approvalFound) {
    blockingReasons.add("publish_approval_missing");
  }
  if (!input.executionGuard.approvalActive) {
    blockingReasons.add("publish_approval_not_active");
  }
  if (input.executionGuard.warnings.length > 0) {
    input.executionGuard.warnings.forEach((warning) => warnings.add(warning));
  }
  if (manualInvalidationRequested && !manualReason) {
    warnings.add("manual_reason_empty");
  }

  const wouldInvalidate = invalidationReasons.size > 0;

  return {
    contentItemId: input.contentItemId,
    checkedAt: checkedAt.toISOString(),
    approvalId: input.executionGuard.approvalId,
    approvalFound: input.executionGuard.approvalFound,
    approvalActive: input.executionGuard.approvalActive,
    approvalMatchesCurrentState: input.executionGuard.approvalFound ? input.executionGuard.approvalMatchesCurrentState : null,
    manualInvalidationRequested,
    manualReason,
    wouldInvalidate,
    canInvalidate: false,
    canPublish: false,
    canSchedulePublish: false,
    canExecutePublish: false,
    canExecuteScheduledPublish: false,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings),
    invalidationReasons: Array.from(invalidationReasons),
    invalidationCandidates: input.executionGuard.invalidationCandidates,
    invalidationPlan: {
      updateTable: "blogger_publish_approvals",
      setInvalidatedAt: wouldInvalidate ? checkedAt.toISOString() : null,
      setInvalidatedReason: wouldInvalidate ? Array.from(invalidationReasons).join(",") : null,
      dryRunOnly: true,
      dbUpdateImplemented: false
    },
    executionGuardSummary: {
      canExecutePublish: false,
      canExecuteScheduledPublish: false,
      approvalMatchesCurrentState: input.executionGuard.approvalFound ? input.executionGuard.approvalMatchesCurrentState : null,
      blockingReasons: input.executionGuard.blockingReasons
    },
    sideEffectSummary: {
      dbRead: true,
      dbWrite: false,
      approvalInvalidation: false,
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
}

function normalizeManualReason(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const trimmed = value.replace(/[\r\n\t]+/g, " ").trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 240);
}
