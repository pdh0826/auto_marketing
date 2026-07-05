import { createHash } from "crypto";
import { prisma } from "@/lib/db/client";

const PATCH_VERSION = "9F-6A";
const READINESS_MODE = "read_only_next_daily_item_readiness";

export interface DailyContentNextItemReadinessRequest {
  planId?: unknown;
}

export interface DailyContentNextItemReadinessResponse extends DailyContentNextItemReadinessSummary {
  checkedAt: string;
  nextItemReadinessSummary: DailyContentNextItemReadinessSummary;
}

export interface DailyContentNextItemReadinessSummary {
  checked: true;
  patchVersion: "9F-6A";
  mode: typeof READINESS_MODE;
  readOnly: true;
  planSummary: DailyContentNextPlanSummary | null;
  itemSummaries: DailyContentNextPlanItemSummary[];
  completedMilestoneSummary: DailyContentCompletedMilestoneSummary;
  nextCandidateSummary: DailyContentNextCandidateSummary | null;
  nextStepSummary: DailyContentNextStepSummary;
  blockingReasons: string[];
  warnings: string[];
  sideEffectSummary: DailyContentNextItemSideEffectSummary;
}

export interface DailyContentNextPlanSummary {
  id: string;
  planDateLocal: string;
  timezone: string;
  planName: string;
  status: string;
  targetBloggerBlogId: string;
  targetBloggerBlogName: string | null;
  plannedItemCount: number;
  persistedItemCount: number;
  linkedContentItemCount: number;
  publishedLinkedContentItemCount: number;
  plannedLinkedContentItemCount: number;
  candidateWithoutContentItemCount: number;
}

export interface DailyContentNextPlanItemSummary {
  id: string;
  itemOrder: number;
  slotKey: string;
  status: string;
  topicSeed: string;
  contentIntent: string;
  publishMode: string;
  contentItemId: string | null;
  contentStatus: string | null;
  contentTitle: string | null;
  contentBlogId: string | null;
  hasDraftMarkdown: boolean | null;
  draftMarkdownHash: string | null;
  hasDraftHtml: boolean | null;
  draftHtmlHash: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  requiresHumanApproval: boolean;
  draftGenerationAllowed: boolean;
  llmGenerationAllowed: boolean;
  publishExecutionAllowed: boolean;
  scheduledPublishAllowed: boolean;
  safeForNextContentItemFixture: boolean;
  safeForDraftPipelineRestart: boolean;
}

export interface DailyContentCompletedMilestoneSummary {
  publishedContentItemFound: boolean;
  publishedContentItemId: string | null;
  publishedContentTitle: string | null;
  publishedAt: string | null;
  draftSaveCount: number;
  successfulDraftSaveCount: number;
  publishApprovalCount: number;
  publishAttemptCount: number;
  successfulPublishAttemptCount: number;
  duplicatePublishProtected: boolean;
}

export interface DailyContentNextCandidateSummary {
  planItemId: string;
  itemOrder: number;
  slotKey: string;
  topicSeed: string;
  contentIntent: string;
  contentItemId: string | null;
  contentStatus: string | null;
  nextAction:
    | "create_or_link_content_item_fixture"
    | "restart_existing_draft_generation_pipeline"
    | "blocked_existing_content_not_safe"
    | "no_action_required";
  recommendedNextPatch: "9F-6B" | "9F-6C" | "manual_review";
  recommendedNextPatchPurpose: string;
  blockerKeys: string[];
}

export interface DailyContentNextStepSummary {
  canProceedTo9F6B: boolean;
  canProceedTo9F6C: boolean;
  recommendedNextPatch: "9F-6B" | "9F-6C" | "manual_review";
  recommendedNextPatchPurpose: string;
  operatorChecklist: string[];
}

export interface DailyContentNextItemSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  contentItemMutation: false;
  draftMarkdownMutation: false;
  draftHtmlMutation: false;
  statusMutation: false;
  qualityScoreMutation: false;
  publishedAtMutation: false;
  scheduledAtMutation: false;
  dailyPlanMutation: false;
  approvalMutation: false;
  attemptMutation: false;
  auditArtifactMutation: false;
  llmCall: false;
  llmCallLogMutation: false;
  bloggerRead: false;
  bloggerWrite: false;
  bloggerDraftSave: false;
  bloggerPublish: false;
  bloggerUpdate: false;
  scheduledPublish: false;
  oauthReconnect: false;
  tokenRefresh: false;
  externalSend: false;
}

export async function buildDailyContentNextItemReadinessResponse(
  rawRequest: DailyContentNextItemReadinessRequest
): Promise<DailyContentNextItemReadinessResponse> {
  const checkedAt = new Date();
  const requestedPlanId = toOptionalString(rawRequest.planId);
  const plan = requestedPlanId
    ? await prisma.blogDailyContentPlan.findUnique({
        where: { id: requestedPlanId },
        include: {
          items: {
            orderBy: [{ itemOrder: "asc" }, { createdAt: "asc" }]
          }
        }
      })
    : await prisma.blogDailyContentPlan.findFirst({
        orderBy: [{ planDateLocal: "desc" }, { createdAt: "desc" }],
        include: {
          items: {
            orderBy: [{ itemOrder: "asc" }, { createdAt: "asc" }]
          }
        }
      });

  const contentItemIds = plan?.items.map((item) => item.contentItemId).filter((id): id is string => Boolean(id)) ?? [];
  const contentItems = contentItemIds.length
    ? await prisma.contentItem.findMany({
        where: { id: { in: contentItemIds } },
        select: {
          id: true,
          blogId: true,
          status: true,
          title: true,
          draftMarkdown: true,
          draftHtml: true,
          publishedAt: true,
          scheduledAt: true
        }
      })
    : [];
  const contentItemById = new Map(contentItems.map((contentItem) => [contentItem.id, contentItem]));
  const itemSummaries =
    plan?.items.map((item) => {
      const contentItem = item.contentItemId ? contentItemById.get(item.contentItemId) ?? null : null;
      return buildItemSummary(item, contentItem);
    }) ?? [];

  const publishedItem = itemSummaries.find((item) => item.contentStatus === "published" || Boolean(item.publishedAt)) ?? null;
  const [draftSaveCount, successfulDraftSaveCount, publishApprovalCount, publishAttemptCount, successfulPublishAttemptCount] = publishedItem?.contentItemId
    ? await Promise.all([
        prisma.bloggerDraftSave.count({ where: { contentItemId: publishedItem.contentItemId } }),
        prisma.bloggerDraftSave.count({ where: { contentItemId: publishedItem.contentItemId, status: "success" } }),
        prisma.bloggerPublishApproval.count({ where: { contentItemId: publishedItem.contentItemId } }),
        prisma.bloggerPublishExecutionAttempt.count({ where: { contentItemId: publishedItem.contentItemId } }),
        prisma.bloggerPublishExecutionAttempt.count({ where: { contentItemId: publishedItem.contentItemId, status: "success" } })
      ])
    : [0, 0, 0, 0, 0];

  const planSummary = plan
    ? buildPlanSummary({
        id: plan.id,
        planDateLocal: plan.planDateLocal,
        timezone: plan.timezone,
        planName: plan.planName,
        status: plan.status,
        targetBloggerBlogId: plan.targetBloggerBlogId,
        targetBloggerBlogName: plan.targetBloggerBlogName,
        plannedItemCount: plan.plannedItemCount,
        itemSummaries
      })
    : null;
  const completedMilestoneSummary: DailyContentCompletedMilestoneSummary = {
    publishedContentItemFound: Boolean(publishedItem?.contentItemId),
    publishedContentItemId: publishedItem?.contentItemId ?? null,
    publishedContentTitle: publishedItem?.contentTitle ?? null,
    publishedAt: publishedItem?.publishedAt ?? null,
    draftSaveCount,
    successfulDraftSaveCount,
    publishApprovalCount,
    publishAttemptCount,
    successfulPublishAttemptCount,
    duplicatePublishProtected: Boolean(publishedItem?.contentItemId && successfulPublishAttemptCount >= 1)
  };
  const nextCandidateSummary = buildNextCandidateSummary(itemSummaries);
  const blockingReasons = buildBlockingReasons({
    requestedPlanId,
    planFound: Boolean(plan),
    completedMilestoneSummary,
    nextCandidateSummary
  });
  const nextStepSummary = buildNextStepSummary(nextCandidateSummary, blockingReasons);
  const summary: DailyContentNextItemReadinessSummary = {
    checked: true,
    patchVersion: PATCH_VERSION,
    mode: READINESS_MODE,
    readOnly: true,
    planSummary,
    itemSummaries,
    completedMilestoneSummary,
    nextCandidateSummary,
    nextStepSummary,
    blockingReasons,
    warnings: buildWarnings(),
    sideEffectSummary: buildSideEffectSummary()
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    nextItemReadinessSummary: summary
  };
}

function buildPlanSummary(input: {
  id: string;
  planDateLocal: string;
  timezone: string;
  planName: string;
  status: string;
  targetBloggerBlogId: string;
  targetBloggerBlogName: string | null;
  plannedItemCount: number;
  itemSummaries: DailyContentNextPlanItemSummary[];
}): DailyContentNextPlanSummary {
  return {
    id: input.id,
    planDateLocal: input.planDateLocal,
    timezone: input.timezone,
    planName: input.planName,
    status: input.status,
    targetBloggerBlogId: input.targetBloggerBlogId,
    targetBloggerBlogName: input.targetBloggerBlogName,
    plannedItemCount: input.plannedItemCount,
    persistedItemCount: input.itemSummaries.length,
    linkedContentItemCount: input.itemSummaries.filter((item) => Boolean(item.contentItemId)).length,
    publishedLinkedContentItemCount: input.itemSummaries.filter((item) => item.contentStatus === "published" || Boolean(item.publishedAt)).length,
    plannedLinkedContentItemCount: input.itemSummaries.filter((item) => item.contentStatus === "planned").length,
    candidateWithoutContentItemCount: input.itemSummaries.filter((item) => !item.contentItemId).length
  };
}

function buildItemSummary(
  item: {
    id: string;
    itemOrder: number;
    slotKey: string;
    status: string;
    topicSeed: string;
    contentIntent: string;
    publishMode: string;
    contentItemId: string | null;
    requiresHumanApproval: boolean;
    draftGenerationAllowed: boolean;
    llmGenerationAllowed: boolean;
    publishExecutionAllowed: boolean;
    scheduledPublishAllowed: boolean;
  },
  contentItem: {
    id: string;
    blogId: string | null;
    status: string;
    title: string | null;
    draftMarkdown: string | null;
    draftHtml: string | null;
    publishedAt: Date | null;
    scheduledAt: Date | null;
  } | null
): DailyContentNextPlanItemSummary {
  const hasDraftMarkdown = contentItem ? Boolean(contentItem.draftMarkdown?.trim()) : null;
  const hasDraftHtml = contentItem ? Boolean(contentItem.draftHtml?.trim()) : null;
  const safePlanItemGuardrails =
    item.requiresHumanApproval &&
    !item.draftGenerationAllowed &&
    !item.llmGenerationAllowed &&
    !item.publishExecutionAllowed &&
    !item.scheduledPublishAllowed;
  const contentSafeForDraftPipeline =
    Boolean(contentItem) &&
    contentItem?.status === "planned" &&
    !contentItem?.publishedAt &&
    !contentItem?.scheduledAt &&
    !hasDraftMarkdown &&
    !hasDraftHtml;

  return {
    id: item.id,
    itemOrder: item.itemOrder,
    slotKey: item.slotKey,
    status: item.status,
    topicSeed: item.topicSeed,
    contentIntent: item.contentIntent,
    publishMode: item.publishMode,
    contentItemId: item.contentItemId,
    contentStatus: contentItem?.status ?? null,
    contentTitle: contentItem?.title ?? null,
    contentBlogId: contentItem?.blogId ?? null,
    hasDraftMarkdown,
    draftMarkdownHash: contentItem?.draftMarkdown ? hashText(contentItem.draftMarkdown) : null,
    hasDraftHtml,
    draftHtmlHash: contentItem?.draftHtml ? hashText(contentItem.draftHtml) : null,
    publishedAt: contentItem?.publishedAt?.toISOString() ?? null,
    scheduledAt: contentItem?.scheduledAt?.toISOString() ?? null,
    requiresHumanApproval: item.requiresHumanApproval,
    draftGenerationAllowed: item.draftGenerationAllowed,
    llmGenerationAllowed: item.llmGenerationAllowed,
    publishExecutionAllowed: item.publishExecutionAllowed,
    scheduledPublishAllowed: item.scheduledPublishAllowed,
    safeForNextContentItemFixture: safePlanItemGuardrails && !item.contentItemId,
    safeForDraftPipelineRestart: safePlanItemGuardrails && contentSafeForDraftPipeline
  };
}

function buildNextCandidateSummary(itemSummaries: DailyContentNextPlanItemSummary[]): DailyContentNextCandidateSummary | null {
  const nextItem =
    itemSummaries.find((item) => !item.contentItemId) ??
    itemSummaries.find((item) => item.contentStatus !== "published" && !item.publishedAt && item.contentStatus !== "scheduled" && !item.scheduledAt) ??
    null;

  if (!nextItem) {
    return null;
  }

  const blockerKeys = buildNextCandidateBlockers(nextItem);
  if (!nextItem.contentItemId && nextItem.safeForNextContentItemFixture) {
    return {
      planItemId: nextItem.id,
      itemOrder: nextItem.itemOrder,
      slotKey: nextItem.slotKey,
      topicSeed: nextItem.topicSeed,
      contentIntent: nextItem.contentIntent,
      contentItemId: null,
      contentStatus: null,
      nextAction: "create_or_link_content_item_fixture",
      recommendedNextPatch: "9F-6B",
      recommendedNextPatchPurpose: "Create or link the next daily content item fixture through a gated apply route.",
      blockerKeys
    };
  }

  if (nextItem.safeForDraftPipelineRestart) {
    return {
      planItemId: nextItem.id,
      itemOrder: nextItem.itemOrder,
      slotKey: nextItem.slotKey,
      topicSeed: nextItem.topicSeed,
      contentIntent: nextItem.contentIntent,
      contentItemId: nextItem.contentItemId,
      contentStatus: nextItem.contentStatus,
      nextAction: "restart_existing_draft_generation_pipeline",
      recommendedNextPatch: "9F-6C",
      recommendedNextPatchPurpose: "Run the draft-generation readiness chain for the existing planned content item.",
      blockerKeys
    };
  }

  return {
    planItemId: nextItem.id,
    itemOrder: nextItem.itemOrder,
    slotKey: nextItem.slotKey,
    topicSeed: nextItem.topicSeed,
    contentIntent: nextItem.contentIntent,
    contentItemId: nextItem.contentItemId,
    contentStatus: nextItem.contentStatus,
    nextAction: "blocked_existing_content_not_safe",
    recommendedNextPatch: "manual_review",
    recommendedNextPatchPurpose: "Review the next daily plan item before creating or mutating content.",
    blockerKeys
  };
}

function buildNextCandidateBlockers(item: DailyContentNextPlanItemSummary): string[] {
  const blockers = new Set<string>();
  if (!item.requiresHumanApproval) {
    blockers.add("daily_plan_item_human_approval_not_required_unexpected");
  }
  if (item.draftGenerationAllowed || item.llmGenerationAllowed || item.publishExecutionAllowed || item.scheduledPublishAllowed) {
    blockers.add("daily_plan_item_execution_flags_not_safe");
  }
  if (item.contentStatus === "published" || item.publishedAt) {
    blockers.add("content_item_already_published");
  }
  if (item.contentStatus === "scheduled" || item.scheduledAt) {
    blockers.add("content_item_already_scheduled");
  }
  if (item.contentItemId && item.contentStatus !== "planned") {
    blockers.add("content_item_status_not_planned");
  }
  if (item.contentItemId && (item.hasDraftMarkdown || item.hasDraftHtml)) {
    blockers.add("content_item_already_has_draft_body");
  }
  return Array.from(blockers);
}

function buildBlockingReasons(input: {
  requestedPlanId: string | null;
  planFound: boolean;
  completedMilestoneSummary: DailyContentCompletedMilestoneSummary;
  nextCandidateSummary: DailyContentNextCandidateSummary | null;
}): string[] {
  const blockers = new Set<string>();
  if (input.requestedPlanId && !input.planFound) {
    blockers.add("daily_content_plan_not_found");
  }
  if (!input.planFound) {
    blockers.add("daily_content_plan_missing");
  }
  if (!input.completedMilestoneSummary.publishedContentItemFound) {
    blockers.add("published_daily_content_item_missing");
  }
  if (!input.completedMilestoneSummary.duplicatePublishProtected) {
    blockers.add("published_daily_content_duplicate_publish_guard_not_confirmed");
  }
  if (!input.nextCandidateSummary) {
    blockers.add("next_daily_plan_candidate_missing");
  }
  for (const blocker of input.nextCandidateSummary?.blockerKeys ?? []) {
    blockers.add(blocker);
  }
  return Array.from(blockers);
}

function buildNextStepSummary(
  nextCandidateSummary: DailyContentNextCandidateSummary | null,
  blockingReasons: string[]
): DailyContentNextStepSummary {
  const canProceedTo9F6B =
    Boolean(nextCandidateSummary) &&
    nextCandidateSummary?.recommendedNextPatch === "9F-6B" &&
    blockingReasons.length === 0;
  const canProceedTo9F6C =
    Boolean(nextCandidateSummary) &&
    nextCandidateSummary?.recommendedNextPatch === "9F-6C" &&
    blockingReasons.length === 0;

  return {
    canProceedTo9F6B,
    canProceedTo9F6C,
    recommendedNextPatch: nextCandidateSummary?.recommendedNextPatch ?? "manual_review",
    recommendedNextPatchPurpose: nextCandidateSummary?.recommendedNextPatchPurpose ?? "Create a new daily plan item or review why no next candidate exists.",
    operatorChecklist: [
      "Confirm the previous daily fixture remains published and duplicate-protected.",
      "Select the next daily plan item that is not already published or scheduled.",
      "Keep the next step read-only until a separate gated apply patch is approved.",
      "Do not call Blogger write, publish, scheduled publish, token refresh, or LLM generation from this readiness check."
    ]
  };
}

function buildWarnings(): string[] {
  return [
    "next_daily_item_readiness_is_read_only",
    "no_content_item_or_daily_plan_mutation",
    "no_llm_call",
    "no_blogger_api_call"
  ];
}

function buildSideEffectSummary(): DailyContentNextItemSideEffectSummary {
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
    dailyPlanMutation: false,
    approvalMutation: false,
    attemptMutation: false,
    auditArtifactMutation: false,
    llmCall: false,
    llmCallLogMutation: false,
    bloggerRead: false,
    bloggerWrite: false,
    bloggerDraftSave: false,
    bloggerPublish: false,
    bloggerUpdate: false,
    scheduledPublish: false,
    oauthReconnect: false,
    tokenRefresh: false,
    externalSend: false
  };
}

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
