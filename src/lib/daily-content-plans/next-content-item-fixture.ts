import { prisma } from "@/lib/db/client";

const PATCH_VERSION = "9F-6B";
const WRITE_FEATURE_FLAG = "BLOG_DAILY_NEXT_CONTENT_ITEM_FIXTURE_WRITE_ENABLED";
const CONFIRMATION_PHRASE = "I_UNDERSTAND_THIS_WILL_CREATE_OR_LINK_NEXT_DAILY_CONTENT_ITEM_FIXTURE";

type FixtureMode = "preview" | "apply";

export interface DailyContentNextContentItemFixtureRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  expectedContentItemId?: unknown;
  idempotencyKey?: unknown;
  confirmNextContentItemFixtureWrite?: unknown;
}

export interface DailyContentNextContentItemFixtureResponse extends DailyContentNextContentItemFixtureSummary {
  checkedAt: string;
  nextContentItemFixtureSummary: DailyContentNextContentItemFixtureSummary;
}

export interface DailyContentNextContentItemFixtureSummary {
  checked: true;
  patchVersion: "9F-6B";
  mode: FixtureMode;
  targetSummary: {
    planId: string | null;
    planItemId: string | null;
    itemOrder: number | null;
    slotKey: string | null;
    planStatus: string | null;
    planDateLocal: string | null;
    targetBloggerBlogId: string | null;
    targetBloggerBlogName: string | null;
    currentContentItemId: string | null;
    deterministicContentItemId: string | null;
    expectedContentItemId: string | null;
  };
  readinessSummary: {
    planFound: boolean;
    planItemFound: boolean;
    planItemMatchesPlan: boolean | null;
    planItemIsNextUnlinkedCandidate: boolean;
    existingLinkedContentItemFound: boolean;
    deterministicContentItemFound: boolean;
    fixtureWouldBeCreated: boolean;
    planItemWouldBeLinked: boolean;
    safeForFixtureApply: boolean;
  };
  proposedFixtureSummary: {
    id: string | null;
    title: string | null;
    targetKeyword: string | null;
    status: "planned";
    mode: "memo_expand";
    source: "daily_content_plan_item";
    noDraftBody: true;
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
    blogId: string | null;
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
    requiresHumanApproval: boolean;
    draftGenerationAllowed: boolean;
    llmGenerationAllowed: boolean;
    publishExecutionAllowed: boolean;
    scheduledPublishAllowed: boolean;
  } | null;
  applyAttempted: boolean;
  applyBlocked: boolean;
  applyOk: boolean;
  featureFlagEnabled: boolean;
  confirmationPhraseAccepted: boolean;
  idempotencyKeyAccepted: boolean;
  appliedContentItemId: string | null;
  linkedPlanItemId: string | null;
  createdContentItem: boolean;
  updatedPlanItem: boolean;
  blockingReasons: string[];
  warnings: string[];
  guardrailSummary: {
    noContentGeneration: true;
    noDraftMarkdownMutation: true;
    noDraftHtmlMutation: true;
    noLlmCall: true;
    noBloggerWrite: true;
    noBloggerDraftSave: true;
    noPublishExecution: true;
    noScheduledPublish: true;
    noOAuthReconnect: true;
    noTokenRefresh: true;
  };
  sideEffectSummary: {
    dbRead: true;
    dbWrite: boolean;
    contentItemInsert: boolean;
    dailyPlanItemUpdate: boolean;
    draftMarkdownMutation: false;
    draftHtmlMutation: false;
    statusMutation: false;
    qualityScoreMutation: false;
    publishedAtMutation: false;
    scheduledAtMutation: false;
    approvalMutation: false;
    attemptMutation: false;
    auditArtifactMutation: false;
    schemaMigration: false;
    bloggerRead: false;
    bloggerWrite: false;
    bloggerDraftSave: false;
    bloggerPublish: false;
    bloggerUpdate: false;
    scheduledPublish: false;
    tokenRefresh: false;
    oauthReconnect: false;
    contentGeneration: false;
    llmCall: false;
    llmCallLogMutation: false;
    externalSend: false;
  };
}

export async function buildDailyContentNextContentItemFixtureResponse(
  rawRequest: DailyContentNextContentItemFixtureRequest
): Promise<DailyContentNextContentItemFixtureResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const blockingReasons = new Set<string>();
  const warnings = new Set<string>([
    "next_content_item_fixture_gated_apply_required",
    "no_llm_call",
    "no_blogger_api_call",
    "no_draft_body_generation"
  ]);
  const featureFlagEnabled = process.env[WRITE_FEATURE_FLAG] === "true";
  const confirmationPhraseAccepted = request.confirmNextContentItemFixtureWrite === CONFIRMATION_PHRASE;

  if (!request.planId) {
    blockingReasons.add("daily_content_plan_id_missing");
  }
  if (!request.planItemId) {
    blockingReasons.add("daily_content_plan_item_id_missing");
  }

  const plan = request.planId
    ? await prisma.blogDailyContentPlan.findUnique({
        where: { id: request.planId },
        include: {
          items: {
            orderBy: [{ itemOrder: "asc" }, { createdAt: "asc" }]
          }
        }
      })
    : null;
  const planItem = request.planItemId ? plan?.items.find((item) => item.id === request.planItemId) ?? null : null;
  const deterministicContentItemId = planItem ? buildFixtureContentItemId(planItem.id) : null;
  const idempotencyKeyAccepted = Boolean(
    request.idempotencyKey && deterministicContentItemId && request.idempotencyKey === buildExpectedIdempotencyKey(planItem!.planId, planItem!.id, deterministicContentItemId)
  );

  if (!plan) {
    blockingReasons.add("daily_content_plan_not_found");
  }
  if (!planItem) {
    blockingReasons.add("daily_content_plan_item_not_found");
  }
  if (planItem && request.planId && planItem.planId !== request.planId) {
    blockingReasons.add("daily_content_plan_item_plan_mismatch");
  }

  const linkedContentItem = planItem?.contentItemId
    ? await prisma.contentItem.findUnique({
        where: { id: planItem.contentItemId }
      })
    : null;
  const deterministicContentItem =
    deterministicContentItemId && deterministicContentItemId !== planItem?.contentItemId
      ? await prisma.contentItem.findUnique({ where: { id: deterministicContentItemId } })
      : null;
  const persistedContentItem = linkedContentItem ?? deterministicContentItem;
  const nextUnlinkedCandidate = findNextUnlinkedCandidate(plan?.items ?? []);
  const planItemIsNextUnlinkedCandidate = Boolean(planItem && nextUnlinkedCandidate?.id === planItem.id);
  const safePlanItemGuardrails = Boolean(
    planItem &&
      planItem.requiresHumanApproval &&
      !planItem.draftGenerationAllowed &&
      !planItem.llmGenerationAllowed &&
      !planItem.publishExecutionAllowed &&
      !planItem.scheduledPublishAllowed
  );
  const deterministicFixtureSafe = Boolean(
    deterministicContentItem &&
      deterministicContentItem.status === "planned" &&
      !deterministicContentItem.draftMarkdown?.trim() &&
      !deterministicContentItem.draftHtml?.trim() &&
      !deterministicContentItem.publishedAt &&
      !deterministicContentItem.scheduledAt
  );
  const linkedContentSafe = Boolean(
    linkedContentItem &&
      linkedContentItem.status === "planned" &&
      !linkedContentItem.draftMarkdown?.trim() &&
      !linkedContentItem.draftHtml?.trim() &&
      !linkedContentItem.publishedAt &&
      !linkedContentItem.scheduledAt
  );
  const safeForFixtureApply = Boolean(
    plan &&
      planItem &&
      deterministicContentItemId &&
      plan.status === "draft" &&
      planItemIsNextUnlinkedCandidate &&
      safePlanItemGuardrails &&
      (!linkedContentItem || linkedContentSafe) &&
      (!deterministicContentItem || deterministicFixtureSafe)
  );

  if (plan && plan.status !== "draft") {
    blockingReasons.add("daily_content_plan_status_not_draft");
  }
  if (planItem && !planItemIsNextUnlinkedCandidate) {
    blockingReasons.add("daily_content_plan_item_is_not_next_unlinked_candidate");
  }
  if (planItem && !safePlanItemGuardrails) {
    blockingReasons.add("daily_content_plan_item_guardrails_not_safe");
  }
  if (linkedContentItem && !linkedContentSafe) {
    blockingReasons.add("linked_content_item_not_safe_for_fixture_reuse");
  }
  if (deterministicContentItem && !deterministicFixtureSafe) {
    blockingReasons.add("deterministic_content_item_not_safe_for_fixture_reuse");
  }
  if (request.expectedContentItemId && deterministicContentItemId && request.expectedContentItemId !== deterministicContentItemId) {
    blockingReasons.add("expected_content_item_id_mismatch");
  }
  if (request.mode === "apply") {
    if (!featureFlagEnabled) {
      blockingReasons.add("next_content_item_fixture_write_feature_flag_disabled");
    }
    if (!confirmationPhraseAccepted) {
      blockingReasons.add("next_content_item_fixture_confirmation_phrase_missing");
    }
    if (!idempotencyKeyAccepted) {
      blockingReasons.add("next_content_item_fixture_idempotency_key_missing_or_invalid");
    }
  }

  const canApply = request.mode === "apply" && blockingReasons.size === 0 && safeForFixtureApply && Boolean(planItem && deterministicContentItemId);
  let appliedContentItemId: string | null = null;
  let linkedPlanItemId: string | null = null;
  let createdContentItem = false;
  let updatedPlanItem = false;
  let appliedContentItem = persistedContentItem;
  let appliedPlanItem = planItem;

  if (canApply && planItem && deterministicContentItemId) {
    const result = await prisma.$transaction(async (tx) => {
      const contentItem =
        linkedContentItem ??
        deterministicContentItem ??
        (await tx.contentItem.create({
          data: buildContentItemFixtureData({
            id: deterministicContentItemId,
            planId: planItem.planId,
            planItemId: planItem.id,
            itemOrder: planItem.itemOrder,
            slotKey: planItem.slotKey,
            topicSeed: planItem.topicSeed,
            contentIntent: planItem.contentIntent
          })
        }));
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
        createdContentItem: !linkedContentItem && !deterministicContentItem,
        updatedPlanItem: shouldUpdatePlanItem
      };
    });

    appliedContentItemId = result.contentItem.id;
    linkedPlanItemId = result.planItem.id;
    createdContentItem = result.createdContentItem;
    updatedPlanItem = result.updatedPlanItem;
    appliedContentItem = result.contentItem;
    appliedPlanItem = result.planItem;
  }

  const summary: DailyContentNextContentItemFixtureSummary = {
    checked: true,
    patchVersion: PATCH_VERSION,
    mode: request.mode,
    targetSummary: {
      planId: request.planId,
      planItemId: request.planItemId,
      itemOrder: planItem?.itemOrder ?? null,
      slotKey: planItem?.slotKey ?? null,
      planStatus: plan?.status ?? null,
      planDateLocal: plan?.planDateLocal ?? null,
      targetBloggerBlogId: plan?.targetBloggerBlogId ?? null,
      targetBloggerBlogName: plan?.targetBloggerBlogName ?? null,
      currentContentItemId: planItem?.contentItemId ?? null,
      deterministicContentItemId,
      expectedContentItemId: request.expectedContentItemId
    },
    readinessSummary: {
      planFound: Boolean(plan),
      planItemFound: Boolean(planItem),
      planItemMatchesPlan: planItem && request.planId ? planItem.planId === request.planId : null,
      planItemIsNextUnlinkedCandidate,
      existingLinkedContentItemFound: Boolean(linkedContentItem),
      deterministicContentItemFound: Boolean(deterministicContentItem),
      fixtureWouldBeCreated: Boolean(planItem && !linkedContentItem && !deterministicContentItem),
      planItemWouldBeLinked: Boolean(planItem && !planItem.contentItemId && (deterministicContentItem || !linkedContentItem)),
      safeForFixtureApply
    },
    proposedFixtureSummary: {
      id: deterministicContentItemId,
      title: planItem?.topicSeed ?? null,
      targetKeyword: planItem?.topicSeed ?? null,
      status: "planned",
      mode: "memo_expand",
      source: "daily_content_plan_item",
      noDraftBody: true,
      noLlmGeneration: true,
      noBloggerWrite: true,
      publishBlocked: true
    },
    persistedContentItemSummary: appliedContentItem ? buildPersistedContentItemSummary(appliedContentItem) : null,
    persistedPlanItemSummary: appliedPlanItem ? buildPersistedPlanItemSummary(appliedPlanItem) : null,
    applyAttempted: canApply,
    applyBlocked: request.mode === "apply" && !canApply,
    applyOk: canApply,
    featureFlagEnabled,
    confirmationPhraseAccepted,
    idempotencyKeyAccepted,
    appliedContentItemId,
    linkedPlanItemId,
    createdContentItem,
    updatedPlanItem,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings),
    guardrailSummary: {
      noContentGeneration: true,
      noDraftMarkdownMutation: true,
      noDraftHtmlMutation: true,
      noLlmCall: true,
      noBloggerWrite: true,
      noBloggerDraftSave: true,
      noPublishExecution: true,
      noScheduledPublish: true,
      noOAuthReconnect: true,
      noTokenRefresh: true
    },
    sideEffectSummary: {
      dbRead: true,
      dbWrite: canApply,
      contentItemInsert: createdContentItem,
      dailyPlanItemUpdate: updatedPlanItem,
      draftMarkdownMutation: false,
      draftHtmlMutation: false,
      statusMutation: false,
      qualityScoreMutation: false,
      publishedAtMutation: false,
      scheduledAtMutation: false,
      approvalMutation: false,
      attemptMutation: false,
      auditArtifactMutation: false,
      schemaMigration: false,
      bloggerRead: false,
      bloggerWrite: false,
      bloggerDraftSave: false,
      bloggerPublish: false,
      bloggerUpdate: false,
      scheduledPublish: false,
      tokenRefresh: false,
      oauthReconnect: false,
      contentGeneration: false,
      llmCall: false,
      llmCallLogMutation: false,
      externalSend: false
    }
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    nextContentItemFixtureSummary: summary
  };
}

function normalizeRequest(raw: DailyContentNextContentItemFixtureRequest) {
  return {
    mode: raw.mode === "apply" ? ("apply" as const) : ("preview" as const),
    planId: getString(raw.planId),
    planItemId: getString(raw.planItemId),
    expectedContentItemId: getString(raw.expectedContentItemId),
    idempotencyKey: getString(raw.idempotencyKey),
    confirmNextContentItemFixtureWrite: getString(raw.confirmNextContentItemFixtureWrite)
  };
}

function findNextUnlinkedCandidate(
  items: Array<{
    id: string;
    itemOrder: number;
    contentItemId: string | null;
  }>
) {
  return items.find((item) => !item.contentItemId) ?? null;
}

function buildExpectedIdempotencyKey(planId: string, planItemId: string, contentItemId: string) {
  return `9F-6B:${planId}:${planItemId}:${contentItemId}`;
}

function buildFixtureContentItemId(planItemId: string) {
  return `daily_fixture_${planItemId}`;
}

function buildContentItemFixtureData(input: {
  id: string;
  planId: string;
  planItemId: string;
  itemOrder: number;
  slotKey: string;
  topicSeed: string;
  contentIntent: string;
}) {
  return {
    id: input.id,
    mode: "memo_expand" as const,
    status: "planned" as const,
    title: input.topicSeed,
    targetKeyword: input.topicSeed,
    sourceMemo: "9F-6B fixture only. No LLM generation has been executed.",
    planJson: {
      fixtureVersion: PATCH_VERSION,
      source: "daily_content_plan_item",
      planId: input.planId,
      planItemId: input.planItemId,
      itemOrder: input.itemOrder,
      slotKey: input.slotKey,
      topicSeed: input.topicSeed,
      contentIntent: input.contentIntent,
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
  blogId: string | null;
  draftMarkdown: string | null;
  draftHtml: string | null;
  publishedAt: Date | null;
  scheduledAt: Date | null;
}): NonNullable<DailyContentNextContentItemFixtureSummary["persistedContentItemSummary"]> {
  return {
    id: contentItem.id,
    status: contentItem.status,
    mode: contentItem.mode,
    title: contentItem.title,
    targetKeyword: contentItem.targetKeyword,
    blogId: contentItem.blogId,
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
  requiresHumanApproval: boolean;
  draftGenerationAllowed: boolean;
  llmGenerationAllowed: boolean;
  publishExecutionAllowed: boolean;
  scheduledPublishAllowed: boolean;
}): NonNullable<DailyContentNextContentItemFixtureSummary["persistedPlanItemSummary"]> {
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
    requiresHumanApproval: planItem.requiresHumanApproval,
    draftGenerationAllowed: planItem.draftGenerationAllowed,
    llmGenerationAllowed: planItem.llmGenerationAllowed,
    publishExecutionAllowed: planItem.publishExecutionAllowed,
    scheduledPublishAllowed: planItem.scheduledPublishAllowed
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
