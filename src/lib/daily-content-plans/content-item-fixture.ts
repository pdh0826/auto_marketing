import { prisma } from "@/lib/db/client";

const WRITE_FEATURE_FLAG = "BLOG_DAILY_PLAN_CONTENT_ITEM_FIXTURE_WRITE_ENABLED";
const CONFIRMATION_PHRASE = "I_UNDERSTAND_THIS_WILL_CREATE_OR_LINK_ONE_CONTENT_ITEM_FIXTURE";
const PATCH_VERSION = "9F-2D";

export interface DailyPlanContentItemFixtureRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  confirmContentItemFixtureWrite?: unknown;
}

export interface DailyPlanContentItemFixtureResponse {
  checkedAt: string;
  contentItemFixtureSummary: DailyPlanContentItemFixtureSummary;
}

export interface DailyPlanContentItemFixtureSummary {
  checked: true;
  mode: "preview" | "apply";
  patchVersion: "9F-2D";
  targetPlanId: string;
  targetPlanItemId: string;
  targetItemOrder: number | null;
  targetSlotKey: string | null;
  fixtureWouldBeCreated: boolean;
  fixtureAlreadyLinked: boolean;
  applyAttempted: boolean;
  applyBlocked: boolean;
  applyOk: boolean;
  featureFlagEnabled: boolean;
  confirmationPhraseAccepted: boolean;
  appliedContentItemId: string | null;
  linkedPlanItemId: string | null;
  createdContentItem: boolean;
  updatedPlanItem: boolean;
  blockingReasons: string[];
  warnings: string[];
  proposedFixtureSummary: {
    id: string | null;
    title: string | null;
    status: "planned";
    mode: "memo_expand";
    source: "daily_content_plan_item";
    noLlmGeneration: true;
    noBloggerWrite: true;
    publishBlocked: true;
  };
  persistedContentItemSummary: {
    id: string;
    status: string;
    mode: string;
    title: string | null;
    targetKeyword: string | null;
    publishedAt: string | null;
    scheduledAt: string | null;
    hasDraftMarkdown: boolean;
    hasDraftHtml: boolean;
  } | null;
  persistedPlanItemSummary: {
    id: string;
    planId: string;
    itemOrder: number;
    slotKey: string;
    status: string;
    topicSeed: string;
    contentIntent: string;
    publishMode: string;
    contentItemId: string | null;
    draftGenerationAllowed: boolean;
    llmGenerationAllowed: boolean;
    publishExecutionAllowed: boolean;
    scheduledPublishAllowed: boolean;
    requiresHumanApproval: boolean;
  } | null;
  guardrailSummary: {
    noContentGeneration: true;
    noLlmCall: true;
    noBloggerWrite: true;
    noPublishExecution: true;
    noScheduledPublish: true;
    noOAuthReconnect: true;
    noTokenRefresh: true;
    noPublishApprovalMutation: true;
    noPublishAttemptMutation: true;
  };
  sideEffectSummary: {
    dbRead: true;
    dbWrite: boolean;
    contentItemInsert: boolean;
    dailyPlanItemUpdate: boolean;
    schemaMigration: false;
    bloggerRead: false;
    bloggerWrite: false;
    bloggerPublish: false;
    bloggerUpdate: false;
    bloggerDraftSave: false;
    tokenRefresh: false;
    oauthReconnect: false;
    contentGeneration: false;
    llmCall: false;
    approvalMutation: false;
    attemptMutation: false;
    externalSend: false;
  };
}

export async function buildDailyPlanContentItemFixtureResponse(rawRequest: DailyPlanContentItemFixtureRequest): Promise<DailyPlanContentItemFixtureResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const blockingReasons = new Set<string>();
  const warnings = new Set<string>(["daily_plan_content_item_fixture_no_generation", "daily_plan_content_item_fixture_blogger_write_disabled"]);
  const featureFlagEnabled = process.env[WRITE_FEATURE_FLAG] === "true";
  const confirmationPhraseAccepted = request.confirmContentItemFixtureWrite === CONFIRMATION_PHRASE;

  if (!request.planId) {
    blockingReasons.add("daily_plan_id_missing");
  }
  if (!request.planItemId) {
    blockingReasons.add("daily_plan_item_id_missing");
  }

  const planItem = request.planItemId
    ? await prisma.blogDailyContentPlanItem.findUnique({
        where: { id: request.planItemId },
        include: { plan: true }
      })
    : null;

  if (!planItem) {
    blockingReasons.add("daily_plan_item_not_found");
  }
  if (planItem && request.planId && planItem.planId !== request.planId) {
    blockingReasons.add("daily_plan_item_plan_mismatch");
  }
  if (planItem && (planItem.itemOrder !== 1 || planItem.slotKey !== "morning_education")) {
    blockingReasons.add("daily_plan_item_not_9f2d_target");
  }
  if (planItem && planItem.plan.targetBloggerBlogId !== "3065973490356135805") {
    blockingReasons.add("daily_plan_target_blog_mismatch");
  }
  if (planItem && planItem.plan.status !== "draft") {
    blockingReasons.add("daily_plan_status_not_draft");
  }
  if (planItem && (!planItem.requiresHumanApproval || planItem.draftGenerationAllowed || planItem.llmGenerationAllowed || planItem.publishExecutionAllowed || planItem.scheduledPublishAllowed)) {
    blockingReasons.add("daily_plan_item_guardrails_not_safe");
  }
  if (request.mode === "apply") {
    if (!featureFlagEnabled) {
      blockingReasons.add("daily_plan_content_item_fixture_write_feature_flag_disabled");
    }
    if (!confirmationPhraseAccepted) {
      blockingReasons.add("daily_plan_content_item_fixture_confirmation_phrase_missing");
    }
  }

  const deterministicContentItemId = planItem ? buildFixtureContentItemId(planItem.id) : null;
  const existingLinkedContentItem = planItem?.contentItemId
    ? await prisma.contentItem.findUnique({ where: { id: planItem.contentItemId } })
    : null;
  const existingDeterministicContentItem =
    !existingLinkedContentItem && deterministicContentItemId ? await prisma.contentItem.findUnique({ where: { id: deterministicContentItemId } }) : null;
  const existingContentItem = existingLinkedContentItem ?? existingDeterministicContentItem;
  const fixtureAlreadyLinked = Boolean(planItem?.contentItemId && existingLinkedContentItem);
  const fixtureWouldBeCreated = Boolean(planItem && !existingContentItem);
  const canApply = request.mode === "apply" && blockingReasons.size === 0 && Boolean(planItem && deterministicContentItemId);

  let appliedContentItemId: string | null = null;
  let linkedPlanItemId: string | null = null;
  let createdContentItem = false;
  let updatedPlanItem = false;
  let persistedContentItem = existingContentItem;
  let persistedPlanItemSummary = planItem ? buildPersistedPlanItemSummary(planItem) : null;

  if (canApply && planItem && deterministicContentItemId) {
    const result = await prisma.$transaction(async (tx) => {
      const contentItem = existingContentItem
        ? existingContentItem
        : await tx.contentItem.create({
            data: buildContentItemFixtureData({ id: deterministicContentItemId, planItem })
          });

      const shouldUpdatePlanItem = planItem.contentItemId !== contentItem.id;
      const updatedItem = shouldUpdatePlanItem
        ? await tx.blogDailyContentPlanItem.update({
            where: { id: planItem.id },
            data: { contentItemId: contentItem.id }
          })
        : planItem;

      return {
        contentItem,
        planItem: updatedItem,
        createdContentItem: !existingContentItem,
        updatedPlanItem: shouldUpdatePlanItem
      };
    });

    appliedContentItemId = result.contentItem.id;
    linkedPlanItemId = result.planItem.id;
    createdContentItem = result.createdContentItem;
    updatedPlanItem = result.updatedPlanItem;
    persistedContentItem = result.contentItem;
    persistedPlanItemSummary = buildPersistedPlanItemSummary(result.planItem);
  }

  const summary: DailyPlanContentItemFixtureSummary = {
    checked: true,
    mode: request.mode,
    patchVersion: PATCH_VERSION,
    targetPlanId: request.planId ?? "",
    targetPlanItemId: request.planItemId ?? "",
    targetItemOrder: planItem?.itemOrder ?? null,
    targetSlotKey: planItem?.slotKey ?? null,
    fixtureWouldBeCreated,
    fixtureAlreadyLinked,
    applyAttempted: canApply,
    applyBlocked: request.mode === "apply" && !canApply,
    applyOk: Boolean(canApply),
    featureFlagEnabled,
    confirmationPhraseAccepted,
    appliedContentItemId,
    linkedPlanItemId,
    createdContentItem,
    updatedPlanItem,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings),
    proposedFixtureSummary: {
      id: deterministicContentItemId,
      title: planItem?.topicSeed ?? null,
      status: "planned",
      mode: "memo_expand",
      source: "daily_content_plan_item",
      noLlmGeneration: true,
      noBloggerWrite: true,
      publishBlocked: true
    },
    persistedContentItemSummary: persistedContentItem ? buildPersistedContentItemSummary(persistedContentItem) : null,
    persistedPlanItemSummary,
    guardrailSummary: {
      noContentGeneration: true,
      noLlmCall: true,
      noBloggerWrite: true,
      noPublishExecution: true,
      noScheduledPublish: true,
      noOAuthReconnect: true,
      noTokenRefresh: true,
      noPublishApprovalMutation: true,
      noPublishAttemptMutation: true
    },
    sideEffectSummary: {
      dbRead: true,
      dbWrite: canApply,
      contentItemInsert: createdContentItem,
      dailyPlanItemUpdate: updatedPlanItem,
      schemaMigration: false,
      bloggerRead: false,
      bloggerWrite: false,
      bloggerPublish: false,
      bloggerUpdate: false,
      bloggerDraftSave: false,
      tokenRefresh: false,
      oauthReconnect: false,
      contentGeneration: false,
      llmCall: false,
      approvalMutation: false,
      attemptMutation: false,
      externalSend: false
    }
  };

  return {
    checkedAt: checkedAt.toISOString(),
    contentItemFixtureSummary: summary
  };
}

function normalizeRequest(raw: DailyPlanContentItemFixtureRequest) {
  return {
    mode: raw.mode === "apply" ? ("apply" as const) : ("preview" as const),
    planId: getString(raw.planId),
    planItemId: getString(raw.planItemId),
    confirmContentItemFixtureWrite: getString(raw.confirmContentItemFixtureWrite)
  };
}

function buildFixtureContentItemId(planItemId: string) {
  return `daily_fixture_${planItemId}`;
}

function buildContentItemFixtureData(input: {
  id: string;
  planItem: {
    id: string;
    planId: string;
    topicSeed: string;
    contentIntent: string;
    slotKey: string;
    itemOrder: number;
  };
}) {
  const { id, planItem } = input;
  return {
    id,
    mode: "memo_expand" as const,
    status: "planned" as const,
    title: planItem.topicSeed,
    targetKeyword: planItem.topicSeed,
    sourceMemo: "9F-2D fixture only. No LLM generation has been executed.",
    planJson: {
      fixtureVersion: PATCH_VERSION,
      source: "daily_content_plan_item",
      planId: planItem.planId,
      planItemId: planItem.id,
      itemOrder: planItem.itemOrder,
      slotKey: planItem.slotKey,
      topicSeed: planItem.topicSeed,
      contentIntent: planItem.contentIntent,
      noLlmGeneration: true,
      noBloggerWrite: true,
      publishBlocked: true
    },
    draftMarkdown: null,
    draftHtml: null,
    qualityScore: null,
    scheduledAt: null,
    publishedAt: null
  };
}

function buildPersistedContentItemSummary(contentItem: {
  id: string;
  status: string;
  mode: string;
  title: string | null;
  targetKeyword: string | null;
  draftMarkdown: string | null;
  draftHtml: string | null;
  publishedAt: Date | null;
  scheduledAt: Date | null;
}): NonNullable<DailyPlanContentItemFixtureSummary["persistedContentItemSummary"]> {
  return {
    id: contentItem.id,
    status: contentItem.status,
    mode: contentItem.mode,
    title: contentItem.title,
    targetKeyword: contentItem.targetKeyword,
    publishedAt: contentItem.publishedAt?.toISOString() ?? null,
    scheduledAt: contentItem.scheduledAt?.toISOString() ?? null,
    hasDraftMarkdown: Boolean(contentItem.draftMarkdown?.trim()),
    hasDraftHtml: Boolean(contentItem.draftHtml?.trim())
  };
}

function buildPersistedPlanItemSummary(planItem: {
  id: string;
  planId: string;
  itemOrder: number;
  slotKey: string;
  status: string;
  topicSeed: string;
  contentIntent: string;
  publishMode: string;
  contentItemId: string | null;
  draftGenerationAllowed: boolean;
  llmGenerationAllowed: boolean;
  publishExecutionAllowed: boolean;
  scheduledPublishAllowed: boolean;
  requiresHumanApproval: boolean;
}): NonNullable<DailyPlanContentItemFixtureSummary["persistedPlanItemSummary"]> {
  return {
    id: planItem.id,
    planId: planItem.planId,
    itemOrder: planItem.itemOrder,
    slotKey: planItem.slotKey,
    status: planItem.status,
    topicSeed: planItem.topicSeed,
    contentIntent: planItem.contentIntent,
    publishMode: planItem.publishMode,
    contentItemId: planItem.contentItemId,
    draftGenerationAllowed: planItem.draftGenerationAllowed,
    llmGenerationAllowed: planItem.llmGenerationAllowed,
    publishExecutionAllowed: planItem.publishExecutionAllowed,
    scheduledPublishAllowed: planItem.scheduledPublishAllowed,
    requiresHumanApproval: planItem.requiresHumanApproval
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
