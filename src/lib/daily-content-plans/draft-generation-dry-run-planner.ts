import { prisma } from "@/lib/db/client";
import { buildDailyContentDraftGenerationExecutionGatePreviewResponse } from "@/lib/daily-content-plans/draft-generation-execution-gate-preview";

const PATCH_VERSION = "9F-2M";
const PLANNER_MODE = "read_only_draft_generation_dry_run";
const OPERATOR_APPROVAL_PURPOSE = "draft_generation_execution";
const OPERATOR_APPROVAL_ACTION = "approve_for_draft_generation_execution";

type DraftGenerationDryRunPlannerMode = "preview" | "blocked_non_preview";

export interface DailyContentDraftGenerationDryRunPlannerRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationDryRunPlannerResponse {
  checkedAt: string;
  draftGenerationDryRunPlannerSummary: DailyContentDraftGenerationDryRunPlannerSummary;
}

export interface DailyContentDraftGenerationDryRunPlannerSummary {
  patchVersion: "9F-2M";
  checked: true;
  mode: DraftGenerationDryRunPlannerMode;
  requestedMode: string | null;
  plannerMode: typeof PLANNER_MODE;
  dryRunOnly: true;
  generationAttempted: false;
  generationBlocked: true;
  targetSummary: {
    planId: string | null;
    planItemId: string;
    contentItemId: string | null;
    itemOrder: number | null;
    slotKey: string | null;
    topicSeed: string | null;
    contentIntent: string | null;
    linkedFixtureFound: boolean;
    linkedFixtureMatchesPlanItem: boolean;
    fixtureStatus: string | null;
    fixtureNotPublished: boolean;
    fixtureNotScheduled: boolean;
    fixtureHasNoDraftMarkdown: boolean;
    fixtureHasNoDraftHtml: boolean;
    draftMarkdownLength: number;
    draftHtmlLength: number;
    planOperationMode: string | null;
    defaultPublishPolicyPreset: string | null;
    blogOperationProfileId: string | null;
    blogOperationProfileFound: boolean;
  };
  persistedApprovalSummary: {
    operatorApprovalPersisted: boolean;
    operatorApprovalSatisfied: boolean;
    approvalId: string | null;
    approvalPurpose: string | null;
    approvalStatus: string | null;
    operatorAction: string | null;
    operatorLabel: string | null;
  };
  executionGateSummary: {
    executionAllowed: false;
    remainingBlockers: string[];
    resolvedBlockers: string[];
  };
  dryRunPlannerSummary: {
    inputSnapshotPlan: {
      willUsePlanMetadata: true;
      willUsePlanItemMetadata: true;
      willUseLinkedContentFixture: true;
      willUseBlogOperationProfile: true;
      willUseContentPolicy: true;
      rawSecretsIncluded: false;
      rawTokensIncluded: false;
    };
    promptStructurePlan: {
      promptVersionCandidate: "daily_content_draft_generation_v0_dry_run";
      fullPromptRendered: false;
      rawPromptStored: false;
      sections: string[];
    };
    modelCandidatePlan: {
      llmCallAttempted: false;
      providerHealthChecked: false;
      finalModelSelectionDeferred: true;
      nextReadinessPatchCandidate: "9F-2N";
      candidatesMayComeFrom: string[];
    };
    outputPlan: {
      actualDraftCreated: false;
      actualDraftMarkdownMutated: false;
      actualDraftHtmlMutated: false;
      futureTargetFields: string[];
      outputStorageDeferredUntilExecutionGatePasses: true;
    };
    currentSideEffectSummary: DailyContentDraftGenerationDryRunSideEffectSummary;
    futureSideEffectPlan: {
      futureLlmCallWouldBeRequired: true;
      futureContentDraftMutationWouldBeRequired: true;
      futureBloggerWriteWouldRemainDisabled: true;
      futurePublishWouldRemainDisabled: true;
      futureScheduleWouldRemainDisabled: true;
      requiresSeparateExecutionPatch: true;
      requiresFeatureFlags: string[];
      requiresConfirmationPhrase: "I_UNDERSTAND_THIS_WILL_CALL_LLM_AND_MUTATE_ONE_CONTENT_ITEM_DRAFT";
      requiresIdempotencyKey: true;
    };
  };
  blockingReasons: string[];
  warnings: string[];
}

export interface DailyContentDraftGenerationDryRunSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  llmCall: false;
  llmCallLogMutation: false;
  contentItemMutation: false;
  draftMarkdownMutation: false;
  draftHtmlMutation: false;
  bloggerWrite: false;
  bloggerDraftSave: false;
  bloggerPublish: false;
  scheduledPublish: false;
  oauthReconnect: false;
  tokenRefresh: false;
  publishApprovalMutation: false;
  publishAttemptMutation: false;
  externalSend: false;
}

export async function buildDailyContentDraftGenerationDryRunPlannerResponse(
  rawRequest: DailyContentDraftGenerationDryRunPlannerRequest
): Promise<DailyContentDraftGenerationDryRunPlannerResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const blockingReasons = new Set<string>();
  const warnings = new Set<string>([
    "draft_generation_dry_run_planner_preview_only",
    "draft_generation_execution_still_blocked",
    "llm_call_disabled",
    "content_item_mutation_disabled",
    "blogger_write_disabled"
  ]);

  if (!request.planItemId) {
    blockingReasons.add("daily_content_plan_item_id_missing");
  }
  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_dry_run_planner_is_preview_only");
  }

  const planItem = request.planItemId
    ? await prisma.blogDailyContentPlanItem.findUnique({
        where: { id: request.planItemId },
        include: { plan: true }
      })
    : null;

  if (!planItem) {
    blockingReasons.add("daily_content_plan_item_not_found");
  }
  if (request.planId && planItem && planItem.planId !== request.planId) {
    blockingReasons.add("daily_content_plan_id_mismatch");
  }

  const linkedContentItemId = request.contentItemId ?? planItem?.contentItemId ?? null;
  const fixture = linkedContentItemId
    ? await prisma.contentItem.findUnique({
        where: { id: linkedContentItemId },
        select: {
          id: true,
          status: true,
          draftMarkdown: true,
          draftHtml: true,
          publishedAt: true,
          scheduledAt: true
        }
      })
    : null;

  if (planItem && !planItem.contentItemId) {
    blockingReasons.add("content_item_fixture_missing");
  }
  if (planItem && linkedContentItemId && planItem.contentItemId !== linkedContentItemId) {
    blockingReasons.add("linked_content_item_mismatch");
  }
  if (linkedContentItemId && !fixture) {
    blockingReasons.add("linked_content_item_not_found");
  }

  const operationProfile = planItem?.plan.operationProfileId
    ? await prisma.blogOperationProfile.findUnique({
        where: { id: planItem.plan.operationProfileId },
        select: {
          id: true
        }
      })
    : null;

  const gateResponse = await buildDailyContentDraftGenerationExecutionGatePreviewResponse({
    mode: request.mode === "preview" ? "preview" : request.requestedMode,
    planItemId: request.planItemId,
    contentItemId: linkedContentItemId
  });
  const gateSummary = gateResponse.draftGenerationExecutionGatePreviewSummary;

  for (const blocker of gateSummary.executionBlockerSummary.remainingBlockers) {
    blockingReasons.add(blocker);
  }

  const draftMarkdownLength = fixture?.draftMarkdown?.length ?? 0;
  const draftHtmlLength = fixture?.draftHtml?.length ?? 0;
  const fixtureNotPublished = Boolean(fixture && !fixture.publishedAt && fixture.status !== "published");
  const fixtureNotScheduled = Boolean(fixture && !fixture.scheduledAt && fixture.status !== "scheduled");
  const fixtureHasNoDraftMarkdown = Boolean(fixture && !fixture.draftMarkdown?.trim());
  const fixtureHasNoDraftHtml = Boolean(fixture && !fixture.draftHtml?.trim());

  return {
    checkedAt: checkedAt.toISOString(),
    draftGenerationDryRunPlannerSummary: {
      patchVersion: PATCH_VERSION,
      checked: true,
      mode: request.mode,
      requestedMode: request.requestedMode,
      plannerMode: PLANNER_MODE,
      dryRunOnly: true,
      generationAttempted: false,
      generationBlocked: true,
      targetSummary: {
        planId: planItem?.planId ?? request.planId,
        planItemId: request.planItemId ?? "",
        contentItemId: linkedContentItemId,
        itemOrder: planItem?.itemOrder ?? null,
        slotKey: planItem?.slotKey ?? null,
        topicSeed: planItem?.topicSeed ?? null,
        contentIntent: planItem?.contentIntent ?? null,
        linkedFixtureFound: Boolean(fixture),
        linkedFixtureMatchesPlanItem: Boolean(planItem && fixture && linkedContentItemId && planItem.contentItemId === linkedContentItemId),
        fixtureStatus: fixture?.status ?? null,
        fixtureNotPublished,
        fixtureNotScheduled,
        fixtureHasNoDraftMarkdown,
        fixtureHasNoDraftHtml,
        draftMarkdownLength,
        draftHtmlLength,
        planOperationMode: planItem?.plan.operationMode ?? null,
        defaultPublishPolicyPreset: planItem?.plan.defaultPublishPolicyPreset ?? null,
        blogOperationProfileId: planItem?.plan.operationProfileId ?? null,
        blogOperationProfileFound: Boolean(operationProfile)
      },
      persistedApprovalSummary: {
        operatorApprovalPersisted: gateSummary.postApprovalState.operatorApprovalPersisted,
        operatorApprovalSatisfied: gateSummary.postApprovalState.operatorApprovalSatisfied,
        approvalId: gateSummary.postApprovalState.operatorApprovalId,
        approvalPurpose: gateSummary.postApprovalState.operatorApprovalPurpose ?? OPERATOR_APPROVAL_PURPOSE,
        approvalStatus: gateSummary.postApprovalState.operatorApprovalStatus,
        operatorAction: gateSummary.postApprovalState.operatorApprovalAction ?? OPERATOR_APPROVAL_ACTION,
        operatorLabel: gateSummary.postApprovalState.operatorApprovalSatisfied ? "초안 생성 실행 승인" : null
      },
      executionGateSummary: {
        executionAllowed: false,
        remainingBlockers: gateSummary.executionBlockerSummary.remainingBlockers,
        resolvedBlockers: gateSummary.executionBlockerSummary.resolvedBlockers
      },
      dryRunPlannerSummary: {
        inputSnapshotPlan: {
          willUsePlanMetadata: true,
          willUsePlanItemMetadata: true,
          willUseLinkedContentFixture: true,
          willUseBlogOperationProfile: true,
          willUseContentPolicy: true,
          rawSecretsIncluded: false,
          rawTokensIncluded: false
        },
        promptStructurePlan: {
          promptVersionCandidate: "daily_content_draft_generation_v0_dry_run",
          fullPromptRendered: false,
          rawPromptStored: false,
          sections: [
            "system_role_and_safety",
            "blog_context",
            "target_reader_and_tone",
            "plan_item_intent",
            "content_constraints",
            "draft_markdown_requirements",
            "seo_structure_requirements",
            "quality_and_forbidden_phrases_check"
          ]
        },
        modelCandidatePlan: {
          llmCallAttempted: false,
          providerHealthChecked: false,
          finalModelSelectionDeferred: true,
          nextReadinessPatchCandidate: "9F-2N",
          candidatesMayComeFrom: ["llm_task_routes", "llm_models", "operation profile", "local fallback policy"]
        },
        outputPlan: {
          actualDraftCreated: false,
          actualDraftMarkdownMutated: false,
          actualDraftHtmlMutated: false,
          futureTargetFields: ["content_items.draftMarkdown", "content_items.draftHtml"],
          outputStorageDeferredUntilExecutionGatePasses: true
        },
        currentSideEffectSummary: buildSideEffectSummary(),
        futureSideEffectPlan: {
          futureLlmCallWouldBeRequired: true,
          futureContentDraftMutationWouldBeRequired: true,
          futureBloggerWriteWouldRemainDisabled: true,
          futurePublishWouldRemainDisabled: true,
          futureScheduleWouldRemainDisabled: true,
          requiresSeparateExecutionPatch: true,
          requiresFeatureFlags: [
            "BLOG_DAILY_CONTENT_DRAFT_GENERATION_LLM_ENABLED",
            "BLOG_DAILY_CONTENT_CONTENT_MUTATION_ENABLED",
            "BLOG_DAILY_CONTENT_DRAFT_GENERATION_WRITE_ENABLED"
          ],
          requiresConfirmationPhrase: "I_UNDERSTAND_THIS_WILL_CALL_LLM_AND_MUTATE_ONE_CONTENT_ITEM_DRAFT",
          requiresIdempotencyKey: true
        }
      },
      blockingReasons: Array.from(blockingReasons),
      warnings: Array.from(warnings)
    }
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationDryRunPlannerRequest): {
  mode: DraftGenerationDryRunPlannerMode;
  requestedMode: string;
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
} {
  const requestedMode = getString(rawRequest.mode) ?? "preview";
  return {
    mode: requestedMode === "preview" ? "preview" : "blocked_non_preview",
    requestedMode,
    planId: getString(rawRequest.planId),
    planItemId: getString(rawRequest.planItemId),
    contentItemId: getString(rawRequest.contentItemId)
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildSideEffectSummary(): DailyContentDraftGenerationDryRunSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    llmCall: false,
    llmCallLogMutation: false,
    contentItemMutation: false,
    draftMarkdownMutation: false,
    draftHtmlMutation: false,
    bloggerWrite: false,
    bloggerDraftSave: false,
    bloggerPublish: false,
    scheduledPublish: false,
    oauthReconnect: false,
    tokenRefresh: false,
    publishApprovalMutation: false,
    publishAttemptMutation: false,
    externalSend: false
  };
}
