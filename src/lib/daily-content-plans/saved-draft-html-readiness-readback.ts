import { createHash } from "crypto";
import { buildBloggerDraftApprovalSnapshotHashes, buildBloggerDraftApprovalSummary } from "@/lib/blogger/draft-approval";
import { buildBloggerDraftPayloadPreview } from "@/lib/blogger/draft-payload-preview";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { buildHtmlQualityPreview } from "@/lib/content/html-quality-preview";
import { buildPublishReadiness } from "@/lib/content/publish-readiness";
import { getActiveBloggerDraftApproval, getLatestBloggerDraftApproval, toBloggerDraftApprovalAdmin } from "@/lib/db/blogger-draft-approvals";
import { getLatestSuccessfulBloggerDraftSave } from "@/lib/db/blogger-draft-saves";
import { listBloggerConnectionsForBlog } from "@/lib/db/blogger-connections";
import { prisma } from "@/lib/db/client";

const PATCH_VERSION = "9F-3R";
const READBACK_MODE = "read_only_saved_draft_html_readiness_readback";

type ReadbackMode = "readback" | "blocked_non_readback";

export interface DailyContentSavedDraftHtmlReadinessReadbackRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentSavedDraftHtmlReadinessReadbackResponse extends DailyContentSavedDraftHtmlReadinessReadbackSummary {
  checkedAt: string;
  savedDraftHtmlReadinessReadbackSummary: DailyContentSavedDraftHtmlReadinessReadbackSummary;
}

export interface DailyContentSavedDraftHtmlReadinessReadbackSummary {
  patchVersion: "9F-3R";
  checked: true;
  mode: ReadbackMode;
  requestedMode: string;
  readbackMode: typeof READBACK_MODE;
  readOnly: true;
  targetSummary: SavedDraftHtmlReadinessTargetSummary;
  qualityReadbackSummary: SavedDraftHtmlQualityReadbackSummary | null;
  publishReadinessSummary: SavedDraftHtmlPublishReadinessSummary | null;
  bloggerDraftPayloadReadbackSummary: SavedDraftHtmlBloggerDraftPayloadReadbackSummary | null;
  nextStepSummary: SavedDraftHtmlNextStepSummary;
  currentSideEffectSummary: SavedDraftHtmlReadinessSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface SavedDraftHtmlReadinessTargetSummary {
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
  planItemFound: boolean;
  planItemMatchesPlan: boolean | null;
  planItemMatchesContentItem: boolean | null;
  contentItemFound: boolean;
  contentStatus: string | null;
  draftMarkdownLength: number | null;
  draftMarkdownHash: string | null;
  draftHtmlLength: number | null;
  draftHtmlHash: string | null;
  publishedAtPresent: boolean | null;
  scheduledAtPresent: boolean | null;
}

export interface SavedDraftHtmlQualityReadbackSummary {
  ready: boolean;
  scorePreview: number;
  grade: "pass" | "warn" | "fail";
  requiredFailCount: number;
  warningCount: number;
  metadata: {
    draftHtmlLength: number;
    h1Count: number;
    h2h3Count: number;
    paragraphCount: number;
    ctaSignalCount: number;
    questionSignalCount: number;
    unmatchedMediaReferenceCount: number;
  };
  failedRequiredCheckKeys: string[];
  warningCheckKeys: string[];
}

export interface SavedDraftHtmlPublishReadinessSummary {
  ready: boolean;
  contentReady: boolean;
  publishReady: boolean;
  stage: string;
  blockingIssueKeys: string[];
  warningKeys: string[];
  metadata: {
    hasPlan: boolean;
    hasDraftMarkdown: boolean;
    hasDraftHtml: boolean;
    htmlValidationOk: boolean;
    qualityGrade: "pass" | "warn" | "fail";
    qualityRequiredFailCount: number;
    bloggerConnectionStatus: string;
    hasSelectedBloggerBlog: boolean;
    manualApprovalStatus: string;
    bloggerDraftApprovalMatchesCurrentPreview: boolean;
    bloggerDraftSaved: boolean;
  };
}

export interface SavedDraftHtmlBloggerDraftPayloadReadbackSummary {
  draftPayloadReady: boolean;
  contentReady: boolean;
  bloggerConnectionReady: boolean;
  selectedBlogReady: boolean;
  titleCandidatePresent: boolean;
  htmlLength: number;
  targetBlogPresent: boolean;
  targetBlogId: string | null;
  targetBlogName: string | null;
  approvalStatus: string;
  approvalMatchesCurrentPreview: boolean;
  currentSnapshotHashPrefix: string | null;
  currentDraftHtmlHashPrefix: string | null;
  draftSaved: boolean;
  blockingIssues: string[];
  warnings: string[];
  htmlSnippetReturned: false;
}

export interface SavedDraftHtmlNextStepSummary {
  canProceedTo9F3S: boolean;
  recommendedNextPatch: "9F-3S";
  recommendedNextPatchPurpose: string;
  nextStepBlockers: string[];
}

export interface SavedDraftHtmlReadinessSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  contentItemMutation: false;
  draftMarkdownMutation: false;
  draftHtmlMutation: false;
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

export async function buildDailyContentSavedDraftHtmlReadinessReadbackResponse(
  rawRequest: DailyContentSavedDraftHtmlReadinessReadbackRequest
): Promise<DailyContentSavedDraftHtmlReadinessReadbackResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const [planItem, contentItem] = await Promise.all([
    request.planItemId
      ? prisma.blogDailyContentPlanItem.findUnique({
          where: { id: request.planItemId },
          select: {
            id: true,
            planId: true,
            contentItemId: true
          }
        })
      : null,
    request.contentItemId
      ? prisma.contentItem.findUnique({
          where: { id: request.contentItemId },
          include: {
            blog: true,
            brandProfile: true,
            assets: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
            }
          }
        })
      : null
  ]);
  const targetSummary = buildTargetSummary(request, planItem, contentItem);
  const baseBlockers = buildBaseBlockers(request, planItem, contentItem);
  const qualityReadbackSummary = contentItem ? buildQualitySummary(contentItem as unknown as ContentItemAdmin, contentItem.assets as unknown as ContentAssetAdmin[]) : null;
  const bloggerConnections = contentItem?.blogId ? await listBloggerConnectionsForBlog(contentItem.blogId) : [];
  const bloggerConnection = bloggerConnections.length === 1 ? bloggerConnections[0] : null;
  const draftPayloadPreview = contentItem
    ? buildBloggerDraftPayloadPreview(contentItem as unknown as ContentItemAdmin, contentItem.assets as unknown as ContentAssetAdmin[], bloggerConnections)
    : null;
  const currentHashes = draftPayloadPreview && contentItem ? buildBloggerDraftApprovalSnapshotHashes(draftPayloadPreview, contentItem.draftHtml) : null;
  const activeApproval = contentItem ? await getActiveBloggerDraftApproval(contentItem.id) : null;
  const latestApproval = contentItem ? activeApproval ?? (await getLatestBloggerDraftApproval(contentItem.id)) : null;
  const latestSuccessfulDraftSave = contentItem ? await getLatestSuccessfulBloggerDraftSave(contentItem.id) : null;
  const approvalSummary =
    draftPayloadPreview && contentItem
      ? buildBloggerDraftApprovalSummary({
          approval: latestApproval ? toBloggerDraftApprovalAdmin(latestApproval) : null,
          approvalSnapshotHash: latestApproval?.snapshotHash ?? null,
          currentSnapshotHash: currentHashes?.snapshotHash ?? null,
          currentDraftHtmlHash: currentHashes?.draftHtmlHash ?? null,
          currentPreviewReady: draftPayloadPreview.draftPayloadReady
        })
      : null;
  const publishReadiness =
    contentItem && approvalSummary
      ? buildPublishReadiness(
          contentItem as unknown as ContentItemAdmin,
          contentItem.assets as unknown as ContentAssetAdmin[],
          bloggerConnection,
          {
            status: approvalSummary.approvalStatus,
            snapshotHashPrefix: approvalSummary.currentSnapshotHashPrefix,
            matchesCurrentPreview: approvalSummary.approvalMatchesCurrentPreview,
            approvedAt: approvalSummary.approval?.approvedAt ?? null
          },
          latestSuccessfulDraftSave
            ? {
                draftSaved: true,
                bloggerPostId: latestSuccessfulDraftSave.bloggerPostId,
                bloggerPostUrl: latestSuccessfulDraftSave.bloggerPostUrl,
                savedAt: latestSuccessfulDraftSave.savedAt
              }
            : null
        )
      : null;
  const publishReadinessSummary = publishReadiness ? buildPublishReadinessSummary(publishReadiness) : null;
  const bloggerDraftPayloadReadbackSummary =
    draftPayloadPreview && approvalSummary ? buildBloggerDraftPayloadSummary(draftPayloadPreview, approvalSummary) : null;
  const nextStepSummary = buildNextStepSummary(baseBlockers, qualityReadbackSummary, publishReadinessSummary, bloggerDraftPayloadReadbackSummary);
  const blockingReasons = [...baseBlockers, ...nextStepSummary.nextStepBlockers];
  const summary: DailyContentSavedDraftHtmlReadinessReadbackSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    readbackMode: READBACK_MODE,
    readOnly: true,
    targetSummary,
    qualityReadbackSummary,
    publishReadinessSummary,
    bloggerDraftPayloadReadbackSummary,
    nextStepSummary,
    currentSideEffectSummary: buildSideEffectSummary(),
    blockingReasons: Array.from(new Set(blockingReasons)),
    warnings: buildWarnings()
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    savedDraftHtmlReadinessReadbackSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentSavedDraftHtmlReadinessReadbackRequest): {
  mode: ReadbackMode;
  requestedMode: string;
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
} {
  const requestedMode = getString(rawRequest.mode) ?? "readback";
  return {
    mode: requestedMode === "readback" ? "readback" : "blocked_non_readback",
    requestedMode,
    planId: getString(rawRequest.planId),
    planItemId: getString(rawRequest.planItemId),
    contentItemId: getString(rawRequest.contentItemId)
  };
}

function buildTargetSummary(
  request: { planId: string | null; planItemId: string | null; contentItemId: string | null },
  planItem: { id: string; planId: string; contentItemId: string | null } | null,
  contentItem: { id: string; status: string; draftMarkdown: string | null; draftHtml: string | null; publishedAt: Date | null; scheduledAt: Date | null } | null
): SavedDraftHtmlReadinessTargetSummary {
  return {
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId,
    planItemFound: Boolean(planItem),
    planItemMatchesPlan: planItem && request.planId ? planItem.planId === request.planId : null,
    planItemMatchesContentItem: planItem && request.contentItemId ? planItem.contentItemId === request.contentItemId : null,
    contentItemFound: Boolean(contentItem),
    contentStatus: contentItem?.status ?? null,
    draftMarkdownLength: contentItem ? contentItem.draftMarkdown?.length ?? 0 : null,
    draftMarkdownHash: contentItem ? sha256(contentItem.draftMarkdown ?? "") : null,
    draftHtmlLength: contentItem ? contentItem.draftHtml?.length ?? 0 : null,
    draftHtmlHash: contentItem ? sha256(contentItem.draftHtml ?? "") : null,
    publishedAtPresent: contentItem ? Boolean(contentItem.publishedAt) : null,
    scheduledAtPresent: contentItem ? Boolean(contentItem.scheduledAt) : null
  };
}

function buildBaseBlockers(
  request: { mode: ReadbackMode; planId: string | null; contentItemId: string | null },
  planItem: { planId: string; contentItemId: string | null } | null,
  contentItem: { id: string; status: string; draftMarkdown: string | null; draftHtml: string | null; publishedAt: Date | null; scheduledAt: Date | null } | null
) {
  const blockers: string[] = [];

  if (request.mode !== "readback") {
    blockers.push("saved_draft_html_readiness_readback_is_read_only");
  }
  if (!planItem) {
    blockers.push("plan_item_not_found");
  }
  if (request.planId && planItem && planItem.planId !== request.planId) {
    blockers.push("plan_item_plan_mismatch");
  }
  if (!contentItem) {
    blockers.push("content_item_not_found");
  }
  if (contentItem && planItem && planItem.contentItemId !== contentItem.id) {
    blockers.push("plan_item_content_item_mismatch");
  }
  if (contentItem && contentItem.status !== "planned") {
    blockers.push("content_item_status_not_planned");
  }
  if (contentItem && !contentItem.draftMarkdown?.trim()) {
    blockers.push("saved_draft_markdown_missing");
  }
  if (contentItem && !contentItem.draftHtml?.trim()) {
    blockers.push("saved_draft_html_missing");
  }
  if (contentItem?.publishedAt) {
    blockers.push("content_item_already_published");
  }
  if (contentItem?.scheduledAt) {
    blockers.push("content_item_already_scheduled");
  }

  return blockers;
}

function buildQualitySummary(contentItem: ContentItemAdmin, assets: ContentAssetAdmin[]): SavedDraftHtmlQualityReadbackSummary {
  const quality = buildHtmlQualityPreview(contentItem, assets);
  const failedRequiredCheckKeys = quality.checks.filter((check) => check.status === "fail" && check.severity === "required").map((check) => check.key);
  const warningCheckKeys = quality.checks.filter((check) => check.status === "warn").map((check) => check.key);

  return {
    ready: quality.ready,
    scorePreview: quality.scorePreview,
    grade: quality.grade,
    requiredFailCount: failedRequiredCheckKeys.length,
    warningCount: warningCheckKeys.length,
    metadata: {
      draftHtmlLength: quality.metadata.draftHtmlLength,
      h1Count: quality.metadata.h1Count,
      h2h3Count: quality.metadata.h2h3Count,
      paragraphCount: quality.metadata.paragraphCount,
      ctaSignalCount: quality.metadata.ctaSignalCount,
      questionSignalCount: quality.metadata.questionSignalCount,
      unmatchedMediaReferenceCount: quality.metadata.unmatchedMediaReferenceCount
    },
    failedRequiredCheckKeys,
    warningCheckKeys
  };
}

function buildPublishReadinessSummary(publishReadiness: ReturnType<typeof buildPublishReadiness>): SavedDraftHtmlPublishReadinessSummary {
  return {
    ready: publishReadiness.ready,
    contentReady: publishReadiness.contentReady,
    publishReady: publishReadiness.publishReady,
    stage: publishReadiness.stage,
    blockingIssueKeys: publishReadiness.blockingIssues.map((issue) => issue.key),
    warningKeys: publishReadiness.warnings.map((warning) => warning.key),
    metadata: {
      hasPlan: publishReadiness.metadata.hasPlan,
      hasDraftMarkdown: publishReadiness.metadata.hasDraftMarkdown,
      hasDraftHtml: publishReadiness.metadata.hasDraftHtml,
      htmlValidationOk: publishReadiness.metadata.htmlValidationOk,
      qualityGrade: publishReadiness.metadata.qualityGrade,
      qualityRequiredFailCount: publishReadiness.metadata.qualityRequiredFailCount,
      bloggerConnectionStatus: publishReadiness.metadata.bloggerConnectionStatus,
      hasSelectedBloggerBlog: publishReadiness.metadata.hasSelectedBloggerBlog,
      manualApprovalStatus: publishReadiness.metadata.manualApprovalStatus,
      bloggerDraftApprovalMatchesCurrentPreview: publishReadiness.metadata.bloggerDraftApprovalMatchesCurrentPreview,
      bloggerDraftSaved: publishReadiness.metadata.bloggerDraftSaved
    }
  };
}

function buildBloggerDraftPayloadSummary(
  draftPayloadPreview: ReturnType<typeof buildBloggerDraftPayloadPreview>,
  approvalSummary: ReturnType<typeof buildBloggerDraftApprovalSummary>
): SavedDraftHtmlBloggerDraftPayloadReadbackSummary {
  return {
    draftPayloadReady: draftPayloadPreview.draftPayloadReady,
    contentReady: draftPayloadPreview.contentReady,
    bloggerConnectionReady: draftPayloadPreview.bloggerConnectionReady,
    selectedBlogReady: draftPayloadPreview.selectedBlogReady,
    titleCandidatePresent: Boolean(draftPayloadPreview.titleCandidate),
    htmlLength: draftPayloadPreview.htmlLength,
    targetBlogPresent: Boolean(draftPayloadPreview.targetBlog),
    targetBlogId: draftPayloadPreview.targetBlog?.id ?? null,
    targetBlogName: draftPayloadPreview.targetBlog?.name ?? null,
    approvalStatus: approvalSummary.approvalStatus,
    approvalMatchesCurrentPreview: approvalSummary.approvalMatchesCurrentPreview,
    currentSnapshotHashPrefix: approvalSummary.currentSnapshotHashPrefix,
    currentDraftHtmlHashPrefix: approvalSummary.currentDraftHtmlHashPrefix,
    draftSaved: draftPayloadPreview.draftSaveSummary.draftSaved,
    blockingIssues: draftPayloadPreview.blockingIssues,
    warnings: draftPayloadPreview.warnings,
    htmlSnippetReturned: false
  };
}

function buildNextStepSummary(
  baseBlockers: string[],
  quality: SavedDraftHtmlQualityReadbackSummary | null,
  publish: SavedDraftHtmlPublishReadinessSummary | null,
  payload: SavedDraftHtmlBloggerDraftPayloadReadbackSummary | null
): SavedDraftHtmlNextStepSummary {
  const blockers = new Set<string>(baseBlockers);

  if (!quality?.ready) {
    blockers.add("quality_readiness_not_ready");
  }
  if (!publish?.contentReady) {
    blockers.add("content_readiness_not_ready");
  }
  if (!payload?.draftPayloadReady) {
    blockers.add("draft_payload_not_ready");
  }

  return {
    canProceedTo9F3S: blockers.size === 0,
    recommendedNextPatch: "9F-3S",
    recommendedNextPatchPurpose: "Refresh or create the Blogger draft payload manual approval snapshot for the saved draftHtml.",
    nextStepBlockers: Array.from(blockers)
  };
}

function buildSideEffectSummary(): SavedDraftHtmlReadinessSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    contentItemMutation: false,
    draftMarkdownMutation: false,
    draftHtmlMutation: false,
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

function buildWarnings() {
  return [
    "saved_draft_html_readiness_readback_only",
    "content_item_mutation_disabled",
    "blogger_api_call_disabled_by_patch_policy",
    "llm_call_disabled_by_patch_policy",
    "html_body_not_returned"
  ];
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
