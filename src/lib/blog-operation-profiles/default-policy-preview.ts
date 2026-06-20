import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { buildSafeManualPublishPolicy, SAFE_MANUAL_PUBLISH_PRESET } from "@/lib/blog-operation-profiles/default-publish-policy";
import { buildOperationProfileAdvisorySummary } from "@/lib/blog-operation-profiles/operation-profile-advisory";
import { buildOperationProfileExceptionDashboardSummary } from "@/lib/blog-operation-profiles/operation-profile-exception-dashboard";
import { buildOperationProfilePolicySimulationSummary } from "@/lib/blog-operation-profiles/operation-profile-policy-simulation";
import type { BlogOperationProfileResponse, BlogOperationProfileSummary } from "@/lib/blog-operation-profiles/operation-profile-summary";

const WRITE_FEATURE_FLAG = "BLOG_OPERATION_PROFILE_WRITE_ENABLED";
const CONFIRMATION_PHRASE = "I_UNDERSTAND_THIS_WILL_CREATE_OR_UPDATE_BLOG_OPERATION_PROFILE";

export interface BlogOperationProfileDefaultPolicyRequest {
  mode?: unknown;
  targetBloggerBlogId?: unknown;
  targetBloggerBlogName?: unknown;
  targetBloggerBlogUrl?: unknown;
  defaultPublishPolicyPreset?: unknown;
  confirmOperationProfileWrite?: unknown;
}

export async function buildBlogOperationProfileDefaultPolicyResponse(rawRequest: BlogOperationProfileDefaultPolicyRequest): Promise<BlogOperationProfileResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const blockingReasons = new Set<string>();
  const warnings = new Set<string>();
  const featureFlagEnabled = process.env[WRITE_FEATURE_FLAG] === "true";
  const confirmationPhraseAccepted = request.confirmOperationProfileWrite === CONFIRMATION_PHRASE;
  const defaultPublishPolicy = buildSafeManualPublishPolicy() as unknown as Record<string, unknown>;

  if (request.defaultPublishPolicyPreset !== SAFE_MANUAL_PUBLISH_PRESET) {
    blockingReasons.add("safe_manual_publish_preset_missing");
  }
  if (!request.targetBloggerBlogId) {
    blockingReasons.add("target_blogger_blog_missing");
  }

  const [selectedConnection, existingProfile] = await Promise.all([
    request.targetBloggerBlogId
      ? prisma.bloggerConnection.findFirst({
          where: {
            bloggerBlogId: request.targetBloggerBlogId,
            bloggerBlogVerifiedAt: { not: null }
          },
          orderBy: { updatedAt: "desc" },
          select: {
            bloggerBlogId: true,
            bloggerBlogName: true,
            bloggerBlogUrl: true
          }
        })
      : Promise.resolve(null),
    request.targetBloggerBlogId
      ? prisma.blogOperationProfile.findUnique({
          where: { targetBloggerBlogId: request.targetBloggerBlogId }
        })
      : Promise.resolve(null)
  ]);

  if (request.mode === "apply" && !selectedConnection) {
    blockingReasons.add("selected_blogger_blog_missing");
  }
  if (selectedConnection && selectedConnection.bloggerBlogId !== request.targetBloggerBlogId) {
    blockingReasons.add("target_blogger_blog_mismatch");
  }

  const targetBloggerBlogId = selectedConnection?.bloggerBlogId ?? request.targetBloggerBlogId;
  const targetBloggerBlogName = selectedConnection?.bloggerBlogName ?? request.targetBloggerBlogName;
  const targetBloggerBlogUrl = selectedConnection?.bloggerBlogUrl ?? request.targetBloggerBlogUrl;
  const proposedProfile = buildProposedProfile();
  const profileFound = Boolean(existingProfile);
  const profileWouldBeCreated = Boolean(!existingProfile && targetBloggerBlogId);
  const profileWouldBeUpdated = Boolean(existingProfile && profileNeedsUpdate(existingProfile, targetBloggerBlogName, targetBloggerBlogUrl));

  warnings.add("safe_manual_publish_preset_selected");
  warnings.add("auto_publish_disabled_by_default");
  warnings.add("scheduled_publish_disabled_by_default");
  if (request.mode === "preview") {
    warnings.add("blog_operation_profile_preview_only");
  }

  if (request.mode === "apply") {
    if (!featureFlagEnabled) {
      blockingReasons.add("blog_operation_profile_write_feature_flag_disabled");
    }
    if (!confirmationPhraseAccepted) {
      blockingReasons.add("blog_operation_profile_confirmation_missing");
    }
  }

  const canApply = request.mode === "apply" && blockingReasons.size === 0 && Boolean(targetBloggerBlogId);
  let applyOk = false;
  let dbWrite = false;

  if (canApply) {
    await prisma.$transaction(async (tx) => {
      await tx.blogOperationProfile.upsert({
        where: { targetBloggerBlogId: targetBloggerBlogId ?? "" },
        create: buildProfileWriteData(targetBloggerBlogId ?? "", targetBloggerBlogName, targetBloggerBlogUrl, defaultPublishPolicy),
        update: buildProfileWriteData(targetBloggerBlogId ?? "", targetBloggerBlogName, targetBloggerBlogUrl, defaultPublishPolicy)
      });
    });
    applyOk = true;
    dbWrite = true;
  }

  const summary: BlogOperationProfileSummary = {
    checked: true,
    mode: request.mode,
    profileFound,
    profileWouldBeCreated,
    profileWouldBeUpdated,
    applyAttempted: canApply,
    applyBlocked: request.mode === "apply" && !applyOk,
    applyOk,
    featureFlagEnabled,
    confirmationPhraseAccepted,
    targetBloggerBlogId,
    targetBloggerBlogName,
    targetBloggerBlogUrl,
    proposedProfile,
    defaultPublishPolicy,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings),
    sideEffectSummary: {
      dbRead: true,
      dbWrite,
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

  const operationProfileAdvisorySummary = await buildOperationProfileAdvisorySummary({
    targetBloggerBlogId,
    targetBloggerBlogName,
    targetBloggerBlogUrl
  });
  const operationProfileExceptionDashboardSummary = buildOperationProfileExceptionDashboardSummary({
    advisorySummary: operationProfileAdvisorySummary
  });
  const operationProfilePolicySimulationSummary = buildOperationProfilePolicySimulationSummary({
    advisorySummary: operationProfileAdvisorySummary
  });

  return {
    checkedAt: checkedAt.toISOString(),
    blogOperationProfileSummary: summary,
    operationProfileExceptionDashboardSummary,
    operationProfilePolicySimulationSummary
  };
}

function normalizeRequest(raw: BlogOperationProfileDefaultPolicyRequest) {
  return {
    mode: raw.mode === "apply" ? ("apply" as const) : ("preview" as const),
    targetBloggerBlogId: getString(raw.targetBloggerBlogId),
    targetBloggerBlogName: getString(raw.targetBloggerBlogName),
    targetBloggerBlogUrl: getString(raw.targetBloggerBlogUrl),
    defaultPublishPolicyPreset: getString(raw.defaultPublishPolicyPreset) ?? SAFE_MANUAL_PUBLISH_PRESET,
    confirmOperationProfileWrite: getString(raw.confirmOperationProfileWrite)
  };
}

function buildProposedProfile(): BlogOperationProfileSummary["proposedProfile"] {
  return {
    profileName: "Default",
    status: "active",
    operationMode: "approval_required",
    defaultPublishPolicyPreset: SAFE_MANUAL_PUBLISH_PRESET,
    allowAutoPublish: false,
    allowScheduledPublish: false,
    requireOAuthGate: true,
    requireFinalHumanApproval: true,
    requireExternalWriteRiskAck: true,
    requireRollbackPlanAck: true,
    requireReadbackAfterPublish: true,
    requirePostPublishReconciliation: true,
    timezone: "Asia/Seoul"
  };
}

function buildProfileWriteData(targetBloggerBlogId: string, targetBloggerBlogName: string | null, targetBloggerBlogUrl: string | null, defaultPublishPolicy: Record<string, unknown>) {
  const proposedProfile = buildProposedProfile();
  return {
    targetBloggerBlogId,
    targetBloggerBlogName,
    targetBloggerBlogUrl,
    ...proposedProfile,
    policyJson: defaultPublishPolicy as Prisma.InputJsonValue,
    guardrailJson: {
      rawBloggerResponseStorageAllowed: false,
      contentReturnedInReadbackResponse: false,
      unknownExternalResultRequiresManualReview: true
    },
    exceptionRoutingJson: {
      operatorSeesExceptionsOnly: false,
      exceptionOnlyDashboardImplemented: false
    }
  };
}

function profileNeedsUpdate(existingProfile: {
  targetBloggerBlogName: string | null;
  targetBloggerBlogUrl: string | null;
  profileName: string;
  status: string;
  operationMode: string;
  defaultPublishPolicyPreset: string;
  timezone: string;
  allowAutoPublish: boolean;
  allowScheduledPublish: boolean;
  requireOAuthGate: boolean;
  requireFinalHumanApproval: boolean;
  requireExternalWriteRiskAck: boolean;
  requireRollbackPlanAck: boolean;
  requireReadbackAfterPublish: boolean;
  requirePostPublishReconciliation: boolean;
}, targetBloggerBlogName: string | null, targetBloggerBlogUrl: string | null) {
  const proposed = buildProposedProfile();
  return (
    existingProfile.targetBloggerBlogName !== targetBloggerBlogName ||
    existingProfile.targetBloggerBlogUrl !== targetBloggerBlogUrl ||
    existingProfile.profileName !== proposed.profileName ||
    existingProfile.status !== proposed.status ||
    existingProfile.operationMode !== proposed.operationMode ||
    existingProfile.defaultPublishPolicyPreset !== proposed.defaultPublishPolicyPreset ||
    existingProfile.timezone !== proposed.timezone ||
    existingProfile.allowAutoPublish !== proposed.allowAutoPublish ||
    existingProfile.allowScheduledPublish !== proposed.allowScheduledPublish ||
    existingProfile.requireOAuthGate !== proposed.requireOAuthGate ||
    existingProfile.requireFinalHumanApproval !== proposed.requireFinalHumanApproval ||
    existingProfile.requireExternalWriteRiskAck !== proposed.requireExternalWriteRiskAck ||
    existingProfile.requireRollbackPlanAck !== proposed.requireRollbackPlanAck ||
    existingProfile.requireReadbackAfterPublish !== proposed.requireReadbackAfterPublish ||
    existingProfile.requirePostPublishReconciliation !== proposed.requirePostPublishReconciliation
  );
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
