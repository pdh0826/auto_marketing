import { prisma } from "@/lib/db/client";
import { buildDailyContentSavedDraftHtmlReadinessReadbackResponse } from "@/lib/daily-content-plans/saved-draft-html-readiness-readback";

const PATCH_VERSION = "9F-3R-FIX3";
const DIAGNOSIS_MODE = "read_only_draft_payload_blocker_diagnosis";

type DiagnosisMode = "diagnose" | "blocked_non_diagnose";

export interface DailyContentDraftPayloadBlockerDiagnosisRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftPayloadBlockerDiagnosisResponse extends DailyContentDraftPayloadBlockerDiagnosisSummary {
  checkedAt: string;
  draftPayloadBlockerDiagnosisSummary: DailyContentDraftPayloadBlockerDiagnosisSummary;
}

export interface DailyContentDraftPayloadBlockerDiagnosisSummary {
  patchVersion: "9F-3R-FIX3";
  checked: true;
  mode: DiagnosisMode;
  requestedMode: string;
  diagnosisMode: typeof DIAGNOSIS_MODE;
  readOnly: true;
  targetSummary: DraftPayloadBlockerTargetSummary;
  savedDraftHtmlReadbackSummary: DraftPayloadBlockerReadbackSummary;
  blogTargetDiagnosisSummary: BlogTargetDiagnosisSummary;
  blockerDiagnoses: DraftPayloadBlockerDiagnosis[];
  nextActionSummary: DraftPayloadNextActionSummary;
  currentSideEffectSummary: DraftPayloadBlockerDiagnosisSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface DraftPayloadBlockerTargetSummary {
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
  planItemFound: boolean;
  planItemMatchesPlan: boolean | null;
  planItemMatchesContentItem: boolean | null;
  contentItemFound: boolean;
  contentStatus: string | null;
  contentBlogId: string | null;
  contentBlogName: string | null;
  brandProfileId: string | null;
  brandProfileName: string | null;
  draftMarkdownLength: number | null;
  draftMarkdownHash: string | null;
  draftHtmlLength: number | null;
  draftHtmlHash: string | null;
  publishedAtPresent: boolean | null;
  scheduledAtPresent: boolean | null;
}

export interface DraftPayloadBlockerReadbackSummary {
  qualityReady: boolean | null;
  qualityGrade: "pass" | "warn" | "fail" | null;
  qualityRequiredFailCount: number | null;
  failedRequiredCheckKeys: string[];
  contentReady: boolean | null;
  publishReady: boolean | null;
  publishReadinessStage: string | null;
  publishBlockingIssueKeys: string[];
  draftPayloadReady: boolean | null;
  draftPayloadBlockingIssues: string[];
  draftPayloadWarnings: string[];
  canProceedTo9F3S: boolean;
  nextStepBlockers: string[];
}

export interface BlogTargetDiagnosisSummary {
  contentItemHasBlogProfile: boolean;
  blogProfileCandidateCount: number;
  viableBlogTargetCandidateCount: number;
  recommendedBlogTarget: BlogTargetCandidateSummary | null;
  blogTargetCandidates: BlogTargetCandidateSummary[];
  bloggerConnectionCandidates: BloggerConnectionCandidateSummary[];
  safeLinkingPossibleInFollowUpPatch: boolean;
  followUpMutationRequired: boolean;
  followUpMutationField: "content_items.blogId" | null;
}

export interface BlogTargetCandidateSummary {
  blogId: string;
  blogName: string;
  status: string;
  urlPresent: boolean;
  bloggerBlogIdPresent: boolean;
  contentItemCount: number;
  bloggerConnectionCount: number;
  connectedVerifiedBloggerConnectionCount: number;
  connectedVerifiedBloggerTarget: {
    connectionId: string;
    connectionName: string;
    bloggerBlogId: string;
    bloggerBlogName: string | null;
    bloggerBlogUrlPresent: boolean;
    bloggerBlogVerifiedAt: string | null;
  } | null;
}

export interface BloggerConnectionCandidateSummary {
  connectionId: string;
  blogId: string | null;
  blogName: string | null;
  connectionName: string;
  status: string;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  selectedBloggerBlogIdPresent: boolean;
  selectedBloggerBlogName: string | null;
  selectedBloggerBlogUrlPresent: boolean;
  selectedBloggerBlogVerifiedAt: string | null;
  tokenLast4Returned: false;
  accessTokenReturned: false;
  refreshTokenReturned: false;
  encryptedValueReturned: false;
}

export interface DraftPayloadBlockerDiagnosis {
  blockerKey: string;
  currentlyPresent: boolean;
  severity: "blocking" | "warning" | "informational";
  rootCause: string;
  recommendedAction: string;
  proposedNextPatch: string;
  requiresDbMutation: boolean;
  requiresBloggerApiCall: false;
  requiresLlmCall: false;
}

export interface DraftPayloadNextActionSummary {
  canProceedTo9F3S: boolean;
  recommendedNextPatch: "9F-3R-FIX4" | "9F-3S" | "manual_blogger_setup" | "blocked_manual_review";
  recommendedNextPatchPurpose: string;
  approvalRequiredBeforeMutation: boolean;
  mutationShouldBeGated: boolean;
  mutationAllowedInThisPatch: false;
  suggestedMutationPreview: {
    field: "content_items.blogId" | null;
    contentItemId: string | null;
    proposedBlogId: string | null;
    proposedBlogName: string | null;
    proposedBloggerConnectionId: string | null;
    proposedBloggerBlogId: string | null;
    proposedBloggerBlogName: string | null;
  };
  nextStepBlockers: string[];
}

export interface DraftPayloadBlockerDiagnosisSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  contentItemMutation: false;
  draftMarkdownMutation: false;
  draftHtmlMutation: false;
  blogProfileMutation: false;
  bloggerConnectionMutation: false;
  statusMutation: false;
  qualityScoreMutation: false;
  publishedAtMutation: false;
  scheduledAtMutation: false;
  auditAttemptMutation: false;
  auditEventMutation: false;
  auditArtifactMutation: false;
  llmCall: false;
  llmCallLogMutation: false;
  bloggerRead: false;
  bloggerWrite: false;
  bloggerDraftSave: false;
  bloggerPublish: false;
  scheduledPublish: false;
  oauthReconnect: false;
  tokenRefresh: false;
  externalSend: false;
}

export async function buildDailyContentDraftPayloadBlockerDiagnosisResponse(
  rawRequest: DailyContentDraftPayloadBlockerDiagnosisRequest
): Promise<DailyContentDraftPayloadBlockerDiagnosisResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const readback = await buildDailyContentSavedDraftHtmlReadinessReadbackResponse({
    mode: "readback",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const readbackSummary = readback.savedDraftHtmlReadinessReadbackSummary;
  const [contentItem, blogs, bloggerConnections] = await Promise.all([
    request.contentItemId
      ? prisma.contentItem.findUnique({
          where: { id: request.contentItemId },
          select: {
            id: true,
            blogId: true,
            brandProfileId: true,
            blog: { select: { id: true, name: true } },
            brandProfile: { select: { id: true, name: true } }
          }
        })
      : null,
    prisma.blog.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 10,
      select: {
        id: true,
        name: true,
        status: true,
        url: true,
        bloggerBlogId: true,
        _count: {
          select: {
            contentItems: true,
            bloggerConnections: true
          }
        },
        bloggerConnections: {
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            name: true,
            status: true,
            bloggerBlogId: true,
            bloggerBlogName: true,
            bloggerBlogUrl: true,
            bloggerBlogVerifiedAt: true
          }
        }
      }
    }),
    prisma.bloggerConnection.findMany({
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        blogId: true,
        name: true,
        status: true,
        hasAccessToken: true,
        hasRefreshToken: true,
        bloggerBlogId: true,
        bloggerBlogName: true,
        bloggerBlogUrl: true,
        bloggerBlogVerifiedAt: true,
        blog: { select: { id: true, name: true } }
      }
    })
  ]);
  const blogTargetDiagnosisSummary = buildBlogTargetDiagnosisSummary(contentItem, blogs, bloggerConnections);
  const readbackCompactSummary = buildReadbackCompactSummary(readbackSummary);
  const blockerDiagnoses = buildBlockerDiagnoses(readbackCompactSummary, blogTargetDiagnosisSummary);
  const nextActionSummary = buildNextActionSummary(request.contentItemId, readbackCompactSummary, blogTargetDiagnosisSummary);
  const blockingReasons = buildBlockingReasons(request.mode, readbackSummary.blockingReasons, nextActionSummary.nextStepBlockers);
  const summary: DailyContentDraftPayloadBlockerDiagnosisSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    diagnosisMode: DIAGNOSIS_MODE,
    readOnly: true,
    targetSummary: {
      ...readbackSummary.targetSummary,
      contentBlogId: contentItem?.blogId ?? null,
      contentBlogName: contentItem?.blog?.name ?? null,
      brandProfileId: contentItem?.brandProfileId ?? null,
      brandProfileName: contentItem?.brandProfile?.name ?? null
    },
    savedDraftHtmlReadbackSummary: readbackCompactSummary,
    blogTargetDiagnosisSummary,
    blockerDiagnoses,
    nextActionSummary,
    currentSideEffectSummary: buildSideEffectSummary(),
    blockingReasons,
    warnings: buildWarnings()
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftPayloadBlockerDiagnosisSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftPayloadBlockerDiagnosisRequest): {
  mode: DiagnosisMode;
  requestedMode: string;
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
} {
  const requestedMode = getString(rawRequest.mode) ?? "diagnose";
  return {
    mode: requestedMode === "diagnose" ? "diagnose" : "blocked_non_diagnose",
    requestedMode,
    planId: getString(rawRequest.planId),
    planItemId: getString(rawRequest.planItemId),
    contentItemId: getString(rawRequest.contentItemId)
  };
}

function buildReadbackCompactSummary(
  readbackSummary: Awaited<ReturnType<typeof buildDailyContentSavedDraftHtmlReadinessReadbackResponse>>["savedDraftHtmlReadinessReadbackSummary"]
): DraftPayloadBlockerReadbackSummary {
  return {
    qualityReady: readbackSummary.qualityReadbackSummary?.ready ?? null,
    qualityGrade: readbackSummary.qualityReadbackSummary?.grade ?? null,
    qualityRequiredFailCount: readbackSummary.qualityReadbackSummary?.requiredFailCount ?? null,
    failedRequiredCheckKeys: readbackSummary.qualityReadbackSummary?.failedRequiredCheckKeys ?? [],
    contentReady: readbackSummary.publishReadinessSummary?.contentReady ?? null,
    publishReady: readbackSummary.publishReadinessSummary?.publishReady ?? null,
    publishReadinessStage: readbackSummary.publishReadinessSummary?.stage ?? null,
    publishBlockingIssueKeys: readbackSummary.publishReadinessSummary?.blockingIssueKeys ?? [],
    draftPayloadReady: readbackSummary.bloggerDraftPayloadReadbackSummary?.draftPayloadReady ?? null,
    draftPayloadBlockingIssues: readbackSummary.bloggerDraftPayloadReadbackSummary?.blockingIssues ?? [],
    draftPayloadWarnings: readbackSummary.bloggerDraftPayloadReadbackSummary?.warnings ?? [],
    canProceedTo9F3S: readbackSummary.nextStepSummary.canProceedTo9F3S,
    nextStepBlockers: readbackSummary.nextStepSummary.nextStepBlockers
  };
}

function buildBlogTargetDiagnosisSummary(
  contentItem: {
    blogId: string | null;
  } | null,
  blogs: Array<{
    id: string;
    name: string;
    status: string;
    url: string | null;
    bloggerBlogId: string | null;
    _count: { contentItems: number; bloggerConnections: number };
    bloggerConnections: Array<{
      id: string;
      name: string;
      status: string;
      bloggerBlogId: string | null;
      bloggerBlogName: string | null;
      bloggerBlogUrl: string | null;
      bloggerBlogVerifiedAt: Date | null;
    }>;
  }>,
  bloggerConnections: Array<{
    id: string;
    blogId: string | null;
    name: string;
    status: string;
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    bloggerBlogId: string | null;
    bloggerBlogName: string | null;
    bloggerBlogUrl: string | null;
    bloggerBlogVerifiedAt: Date | null;
    blog: { id: string; name: string } | null;
  }>
): BlogTargetDiagnosisSummary {
  const blogTargetCandidates = blogs.map(toBlogTargetCandidateSummary);
  const viableCandidates = blogTargetCandidates.filter((candidate) => candidate.status === "active" && candidate.connectedVerifiedBloggerConnectionCount === 1);
  const recommendedBlogTarget = viableCandidates.length === 1 ? viableCandidates[0] : null;

  return {
    contentItemHasBlogProfile: Boolean(contentItem?.blogId),
    blogProfileCandidateCount: blogs.length,
    viableBlogTargetCandidateCount: viableCandidates.length,
    recommendedBlogTarget,
    blogTargetCandidates,
    bloggerConnectionCandidates: bloggerConnections.map(toBloggerConnectionCandidateSummary),
    safeLinkingPossibleInFollowUpPatch: !contentItem?.blogId && Boolean(recommendedBlogTarget),
    followUpMutationRequired: !contentItem?.blogId,
    followUpMutationField: !contentItem?.blogId ? "content_items.blogId" : null
  };
}

function toBlogTargetCandidateSummary(blog: {
  id: string;
  name: string;
  status: string;
  url: string | null;
  bloggerBlogId: string | null;
  _count: { contentItems: number; bloggerConnections: number };
  bloggerConnections: Array<{
    id: string;
    name: string;
    status: string;
    bloggerBlogId: string | null;
    bloggerBlogName: string | null;
    bloggerBlogUrl: string | null;
    bloggerBlogVerifiedAt: Date | null;
  }>;
}): BlogTargetCandidateSummary {
  const connectedVerifiedConnections = blog.bloggerConnections.filter(
    (connection) => connection.status === "connected" && Boolean(connection.bloggerBlogId && connection.bloggerBlogVerifiedAt)
  );
  const selectedConnection = connectedVerifiedConnections.length === 1 ? connectedVerifiedConnections[0] : null;

  return {
    blogId: blog.id,
    blogName: blog.name,
    status: blog.status,
    urlPresent: Boolean(blog.url),
    bloggerBlogIdPresent: Boolean(blog.bloggerBlogId),
    contentItemCount: blog._count.contentItems,
    bloggerConnectionCount: blog._count.bloggerConnections,
    connectedVerifiedBloggerConnectionCount: connectedVerifiedConnections.length,
    connectedVerifiedBloggerTarget: selectedConnection
      ? {
          connectionId: selectedConnection.id,
          connectionName: selectedConnection.name,
          bloggerBlogId: selectedConnection.bloggerBlogId ?? "",
          bloggerBlogName: selectedConnection.bloggerBlogName,
          bloggerBlogUrlPresent: Boolean(selectedConnection.bloggerBlogUrl),
          bloggerBlogVerifiedAt: selectedConnection.bloggerBlogVerifiedAt?.toISOString() ?? null
        }
      : null
  };
}

function toBloggerConnectionCandidateSummary(connection: {
  id: string;
  blogId: string | null;
  name: string;
  status: string;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  bloggerBlogId: string | null;
  bloggerBlogName: string | null;
  bloggerBlogUrl: string | null;
  bloggerBlogVerifiedAt: Date | null;
  blog: { id: string; name: string } | null;
}): BloggerConnectionCandidateSummary {
  return {
    connectionId: connection.id,
    blogId: connection.blogId,
    blogName: connection.blog?.name ?? null,
    connectionName: connection.name,
    status: connection.status,
    hasAccessToken: connection.hasAccessToken,
    hasRefreshToken: connection.hasRefreshToken,
    selectedBloggerBlogIdPresent: Boolean(connection.bloggerBlogId),
    selectedBloggerBlogName: connection.bloggerBlogName,
    selectedBloggerBlogUrlPresent: Boolean(connection.bloggerBlogUrl),
    selectedBloggerBlogVerifiedAt: connection.bloggerBlogVerifiedAt?.toISOString() ?? null,
    tokenLast4Returned: false,
    accessTokenReturned: false,
    refreshTokenReturned: false,
    encryptedValueReturned: false
  };
}

function buildBlockerDiagnoses(
  readback: DraftPayloadBlockerReadbackSummary,
  blogTarget: BlogTargetDiagnosisSummary
): DraftPayloadBlockerDiagnosis[] {
  const keys = new Set([...readback.draftPayloadBlockingIssues, ...readback.publishBlockingIssueKeys, ...readback.nextStepBlockers]);
  const diagnoses: DraftPayloadBlockerDiagnosis[] = [];

  for (const key of ["blog_profile_missing", "blogger_connection_not_configured", "blogger_connection", "blogger_blog_selection", "manual_approval", "blogger_draft_saved", "draft_payload_not_ready"]) {
    diagnoses.push(diagnoseBlocker(key, keys.has(key), blogTarget));
  }
  if (readback.qualityRequiredFailCount && readback.qualityRequiredFailCount > 0) {
    diagnoses.push(diagnoseBlocker("quality_required_checks_failed", true, blogTarget));
  }

  return diagnoses;
}

function diagnoseBlocker(blockerKey: string, currentlyPresent: boolean, blogTarget: BlogTargetDiagnosisSummary): DraftPayloadBlockerDiagnosis {
  if (blockerKey === "blog_profile_missing") {
    return {
      blockerKey,
      currentlyPresent,
      severity: currentlyPresent ? "blocking" : "informational",
      rootCause: "The daily fixture content item does not have content_items.blogId, so Blogger target resolution cannot start.",
      recommendedAction: blogTarget.recommendedBlogTarget
        ? "Run a separate gated mutation patch that links the content item to the recommended active Blog profile."
        : "Create or select exactly one active Blog profile with a connected verified Blogger connection before linking the content item.",
      proposedNextPatch: "9F-3R-FIX4",
      requiresDbMutation: true,
      requiresBloggerApiCall: false,
      requiresLlmCall: false
    };
  }
  if (blockerKey === "blogger_connection_not_configured" || blockerKey === "blogger_connection") {
    return {
      blockerKey,
      currentlyPresent,
      severity: currentlyPresent ? "blocking" : "informational",
      rootCause: "Blogger connections are evaluated through the content item's Blog profile. Without a linked blog profile, the existing connection cannot be used for this item.",
      recommendedAction: "After the content item is linked to the Blog profile, rerun saved draftHtml readiness readback and verify the connected Blogger target is selected.",
      proposedNextPatch: "9F-3R-FIX4",
      requiresDbMutation: true,
      requiresBloggerApiCall: false,
      requiresLlmCall: false
    };
  }
  if (blockerKey === "blogger_blog_selection") {
    return {
      blockerKey,
      currentlyPresent,
      severity: currentlyPresent ? "blocking" : "informational",
      rootCause: "Draft payload requires a verified selected Blogger blog on the resolved connection.",
      recommendedAction: "Use the existing Blogger settings selection flow if the resolved connection lacks bloggerBlogId/bloggerBlogVerifiedAt.",
      proposedNextPatch: "manual_blogger_setup",
      requiresDbMutation: false,
      requiresBloggerApiCall: false,
      requiresLlmCall: false
    };
  }
  if (blockerKey === "manual_approval") {
    return {
      blockerKey,
      currentlyPresent,
      severity: currentlyPresent ? "blocking" : "informational",
      rootCause: "Blogger draft approval snapshot has not been refreshed for the current saved draftHtml.",
      recommendedAction: "Proceed to 9F-3S only after draft payload readiness is true.",
      proposedNextPatch: "9F-3S",
      requiresDbMutation: true,
      requiresBloggerApiCall: false,
      requiresLlmCall: false
    };
  }
  if (blockerKey === "blogger_draft_saved") {
    return {
      blockerKey,
      currentlyPresent,
      severity: currentlyPresent ? "blocking" : "informational",
      rootCause: "There is no successful Blogger draft save for the current approval snapshot.",
      recommendedAction: "Do not address this before payload readiness and manual approval are refreshed.",
      proposedNextPatch: "after_9F-3S",
      requiresDbMutation: true,
      requiresBloggerApiCall: false,
      requiresLlmCall: false
    };
  }
  if (blockerKey === "quality_required_checks_failed") {
    return {
      blockerKey,
      currentlyPresent,
      severity: currentlyPresent ? "blocking" : "informational",
      rootCause: "Saved draftHtml still has required quality failures.",
      recommendedAction: "Repair or regenerate saved draftHtml before payload approval.",
      proposedNextPatch: "quality_repair",
      requiresDbMutation: true,
      requiresBloggerApiCall: false,
      requiresLlmCall: false
    };
  }
  return {
    blockerKey,
    currentlyPresent,
    severity: currentlyPresent ? "blocking" : "informational",
    rootCause: "Saved draftHtml is not yet ready for Blogger draft payload approval.",
    recommendedAction: "Resolve upstream blog target and payload readiness blockers, then rerun readback.",
    proposedNextPatch: "9F-3R-FIX4",
    requiresDbMutation: true,
    requiresBloggerApiCall: false,
    requiresLlmCall: false
  };
}

function buildNextActionSummary(
  contentItemId: string | null,
  readback: DraftPayloadBlockerReadbackSummary,
  blogTarget: BlogTargetDiagnosisSummary
): DraftPayloadNextActionSummary {
  const target = blogTarget.recommendedBlogTarget?.connectedVerifiedBloggerTarget ?? null;
  if (readback.canProceedTo9F3S) {
    return {
      canProceedTo9F3S: true,
      recommendedNextPatch: "9F-3S",
      recommendedNextPatchPurpose: "Refresh or create the Blogger draft payload manual approval snapshot for the saved daily draftHtml.",
      approvalRequiredBeforeMutation: true,
      mutationShouldBeGated: true,
      mutationAllowedInThisPatch: false,
      suggestedMutationPreview: buildSuggestedMutationPreview(contentItemId, null),
      nextStepBlockers: []
    };
  }
  if (blogTarget.safeLinkingPossibleInFollowUpPatch && blogTarget.recommendedBlogTarget) {
    return {
      canProceedTo9F3S: false,
      recommendedNextPatch: "9F-3R-FIX4",
      recommendedNextPatchPurpose: "Gated one-time link of the daily fixture content item to the active Blog profile with a connected verified Blogger target.",
      approvalRequiredBeforeMutation: true,
      mutationShouldBeGated: true,
      mutationAllowedInThisPatch: false,
      suggestedMutationPreview: buildSuggestedMutationPreview(contentItemId, blogTarget.recommendedBlogTarget),
      nextStepBlockers: ["content_item_blog_profile_not_linked", "draft_payload_not_ready"]
    };
  }
  if (readback.draftPayloadBlockingIssues.includes("blogger_connection_not_configured")) {
    return {
      canProceedTo9F3S: false,
      recommendedNextPatch: "manual_blogger_setup",
      recommendedNextPatchPurpose: "Complete or verify Blogger connection setup for the selected Blog profile before approval refresh.",
      approvalRequiredBeforeMutation: false,
      mutationShouldBeGated: false,
      mutationAllowedInThisPatch: false,
      suggestedMutationPreview: buildSuggestedMutationPreview(contentItemId, null),
      nextStepBlockers: ["blogger_connection_not_configured", "draft_payload_not_ready"]
    };
  }

  return {
    canProceedTo9F3S: false,
    recommendedNextPatch: "blocked_manual_review",
    recommendedNextPatchPurpose: "Manual review is needed because no single safe Blog/Blogger target candidate was found.",
    approvalRequiredBeforeMutation: true,
    mutationShouldBeGated: true,
    mutationAllowedInThisPatch: false,
    suggestedMutationPreview: buildSuggestedMutationPreview(contentItemId, null),
    nextStepBlockers: readback.nextStepBlockers
  };
}

function buildSuggestedMutationPreview(contentItemId: string | null, blogTarget: BlogTargetCandidateSummary | null) {
  return {
    field: blogTarget ? ("content_items.blogId" as const) : null,
    contentItemId,
    proposedBlogId: blogTarget?.blogId ?? null,
    proposedBlogName: blogTarget?.blogName ?? null,
    proposedBloggerConnectionId: blogTarget?.connectedVerifiedBloggerTarget?.connectionId ?? null,
    proposedBloggerBlogId: blogTarget?.connectedVerifiedBloggerTarget?.bloggerBlogId ?? null,
    proposedBloggerBlogName: blogTarget?.connectedVerifiedBloggerTarget?.bloggerBlogName ?? null
  };
}

function buildBlockingReasons(mode: DiagnosisMode, readbackBlockers: string[], nextStepBlockers: string[]) {
  const blockers = new Set([...readbackBlockers, ...nextStepBlockers]);
  if (mode !== "diagnose") {
    blockers.add("draft_payload_blocker_diagnosis_is_read_only");
  }
  return Array.from(blockers);
}

function buildWarnings() {
  return [
    "draft_payload_blocker_diagnosis_read_only",
    "content_item_blog_assignment_not_mutated",
    "blogger_api_call_disabled_by_patch_policy",
    "llm_call_disabled_by_patch_policy",
    "secrets_tokens_and_encrypted_values_not_returned"
  ];
}

function buildSideEffectSummary(): DraftPayloadBlockerDiagnosisSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    contentItemMutation: false,
    draftMarkdownMutation: false,
    draftHtmlMutation: false,
    blogProfileMutation: false,
    bloggerConnectionMutation: false,
    statusMutation: false,
    qualityScoreMutation: false,
    publishedAtMutation: false,
    scheduledAtMutation: false,
    auditAttemptMutation: false,
    auditEventMutation: false,
    auditArtifactMutation: false,
    llmCall: false,
    llmCallLogMutation: false,
    bloggerRead: false,
    bloggerWrite: false,
    bloggerDraftSave: false,
    bloggerPublish: false,
    scheduledPublish: false,
    oauthReconnect: false,
    tokenRefresh: false,
    externalSend: false
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
