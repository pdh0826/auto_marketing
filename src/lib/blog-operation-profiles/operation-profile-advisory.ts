import { prisma } from "@/lib/db/client";
import { buildSafeManualPublishPolicy, SAFE_MANUAL_PUBLISH_PRESET } from "@/lib/blog-operation-profiles/default-publish-policy";
import type { OperationProfileAdvisorySummary } from "@/lib/blog-operation-profiles/operation-profile-summary";

export interface BuildOperationProfileAdvisoryInput {
  targetBloggerBlogId: string | null;
  targetBloggerBlogName: string | null;
  targetBloggerBlogUrl: string | null;
}

export async function buildOperationProfileAdvisorySummary(input: BuildOperationProfileAdvisoryInput): Promise<OperationProfileAdvisorySummary> {
  const profile = input.targetBloggerBlogId
    ? await prisma.blogOperationProfile.findUnique({
        where: { targetBloggerBlogId: input.targetBloggerBlogId },
        select: {
          id: true,
          targetBloggerBlogId: true,
          targetBloggerBlogName: true,
          targetBloggerBlogUrl: true,
          status: true,
          operationMode: true,
          defaultPublishPolicyPreset: true,
          timezone: true,
          allowAutoPublish: true,
          allowScheduledPublish: true,
          requireOAuthGate: true,
          requireFinalHumanApproval: true,
          requireExternalWriteRiskAck: true,
          requireRollbackPlanAck: true,
          requireReadbackAfterPublish: true,
          requirePostPublishReconciliation: true
        }
      })
    : null;

  const advisoryWarnings = new Set<string>();
  const advisoryNotes = new Set<string>(["operation_profile_advisory_only_not_enforced"]);

  if (!input.targetBloggerBlogId) {
    advisoryWarnings.add("operation_profile_target_blog_missing_advisory_only");
  }
  if (!profile) {
    advisoryWarnings.add("operation_profile_missing_advisory_only");
  } else {
    advisoryNotes.add("operation_profile_loaded_advisory_only");
  }
  if (profile && profile.targetBloggerBlogId !== input.targetBloggerBlogId) {
    advisoryWarnings.add("operation_profile_target_blog_mismatch_advisory_only");
  }
  if (profile && !compareNullable(profile.targetBloggerBlogUrl, input.targetBloggerBlogUrl)) {
    advisoryWarnings.add("operation_profile_target_url_mismatch_advisory_only");
  }
  if (profile && profile.defaultPublishPolicyPreset !== SAFE_MANUAL_PUBLISH_PRESET) {
    advisoryWarnings.add("operation_profile_preset_mismatch_advisory_only");
  }
  if (profile?.allowAutoPublish === false) {
    advisoryNotes.add("operation_profile_auto_publish_disabled");
  }
  if (profile?.allowScheduledPublish === false) {
    advisoryNotes.add("operation_profile_scheduled_publish_disabled");
  }

  return {
    checked: true,
    advisoryOnly: true,
    policyEnforced: false,
    blockerImpact: false,
    executionPermissionImpact: false,
    profileLookupAttempted: true,
    profileFound: Boolean(profile),
    profileId: profile?.id ?? null,
    targetBloggerBlogId: profile?.targetBloggerBlogId ?? input.targetBloggerBlogId,
    targetBloggerBlogName: profile?.targetBloggerBlogName ?? input.targetBloggerBlogName,
    targetBloggerBlogUrl: profile?.targetBloggerBlogUrl ?? input.targetBloggerBlogUrl,
    profileStatus: profile?.status ?? null,
    operationMode: profile?.operationMode ?? null,
    defaultPublishPolicyPreset: profile?.defaultPublishPolicyPreset ?? null,
    timezone: profile?.timezone ?? null,
    allowAutoPublish: profile?.allowAutoPublish ?? null,
    allowScheduledPublish: profile?.allowScheduledPublish ?? null,
    requireOAuthGate: profile?.requireOAuthGate ?? null,
    requireFinalHumanApproval: profile?.requireFinalHumanApproval ?? null,
    requireExternalWriteRiskAck: profile?.requireExternalWriteRiskAck ?? null,
    requireRollbackPlanAck: profile?.requireRollbackPlanAck ?? null,
    requireReadbackAfterPublish: profile?.requireReadbackAfterPublish ?? null,
    requirePostPublishReconciliation: profile?.requirePostPublishReconciliation ?? null,
    matches: {
      targetBloggerBlogIdMatches: Boolean(profile && profile.targetBloggerBlogId === input.targetBloggerBlogId),
      targetBloggerBlogUrlMatches: Boolean(profile && compareNullable(profile.targetBloggerBlogUrl, input.targetBloggerBlogUrl)),
      profileIsActive: profile?.status === "active",
      presetIsSafeManualPublish: profile?.defaultPublishPolicyPreset === SAFE_MANUAL_PUBLISH_PRESET,
      operationModeIsApprovalRequired: profile?.operationMode === "approval_required",
      autoPublishDisabled: profile?.allowAutoPublish === false,
      scheduledPublishDisabled: profile?.allowScheduledPublish === false,
      requiredManualGuardsEnabled: Boolean(
        profile?.requireOAuthGate &&
          profile.requireFinalHumanApproval &&
          profile.requireExternalWriteRiskAck &&
          profile.requireRollbackPlanAck &&
          profile.requireReadbackAfterPublish &&
          profile.requirePostPublishReconciliation
      )
    },
    defaultPublishPolicyPreview: buildSafeManualPublishPolicy() as unknown as Record<string, unknown>,
    advisoryWarnings: Array.from(advisoryWarnings),
    advisoryNotes: Array.from(advisoryNotes),
    blockingReasons: [],
    sideEffectSummary: {
      dbRead: true,
      dbWrite: false,
      schemaMigration: false,
      bloggerRead: false,
      bloggerWrite: false,
      bloggerPublish: false,
      bloggerUpdate: false,
      bloggerDraftSave: false,
      tokenRefresh: false,
      oauthReconnect: false,
      contentMutation: false,
      approvalMutation: false,
      attemptMutation: false,
      llmCall: false,
      externalSend: false
    }
  };
}

function compareNullable(left: string | null, right: string | null) {
  if (left === null && right === null) {
    return true;
  }
  if (left === null || right === null) {
    return false;
  }
  return left === right;
}
