import { Prisma } from "@prisma/client";
import { buildSafeManualPublishPolicy, SAFE_MANUAL_PUBLISH_PRESET } from "@/lib/blog-operation-profiles/default-publish-policy";
import { prisma } from "@/lib/db/client";
import type { DailyContentPlanResponse, DailyContentPlanSummary } from "@/lib/daily-content-plans/daily-content-plan-summary";

const WRITE_FEATURE_FLAG = "BLOG_DAILY_CONTENT_PLAN_WRITE_ENABLED";
const CONFIRMATION_PHRASE = "I_UNDERSTAND_THIS_WILL_CREATE_OR_UPDATE_DAILY_CONTENT_PLAN";
const DEFAULT_TIMEZONE = "Asia/Seoul";

export interface DailyContentPlanDefaultRequest {
  mode?: unknown;
  targetBloggerBlogId?: unknown;
  targetBloggerBlogName?: unknown;
  targetBloggerBlogUrl?: unknown;
  planDateLocal?: unknown;
  timezone?: unknown;
  defaultPublishPolicyPreset?: unknown;
  confirmDailyContentPlanWrite?: unknown;
}

export async function buildDailyContentPlanDefaultResponse(rawRequest: DailyContentPlanDefaultRequest): Promise<DailyContentPlanResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const blockingReasons = new Set<string>();
  const warnings = new Set<string>(["daily_content_plan_preview_only_no_generation", "daily_content_plan_blogger_write_disabled"]);
  const featureFlagEnabled = process.env[WRITE_FEATURE_FLAG] === "true";
  const confirmationPhraseAccepted = request.confirmDailyContentPlanWrite === CONFIRMATION_PHRASE;
  const planItems = buildPlanItems();
  const policySnapshot = buildPolicySnapshot();

  if (!request.targetBloggerBlogId) {
    blockingReasons.add("daily_content_plan_target_blog_missing");
  }
  if (!request.planDateLocal) {
    blockingReasons.add("daily_content_plan_date_missing");
  }
  if (request.defaultPublishPolicyPreset !== SAFE_MANUAL_PUBLISH_PRESET) {
    blockingReasons.add("daily_content_plan_profile_not_safe_manual_publish");
  }

  const [profile, existingPlan] = await Promise.all([
    request.targetBloggerBlogId
      ? prisma.blogOperationProfile.findUnique({
          where: { targetBloggerBlogId: request.targetBloggerBlogId }
        })
      : Promise.resolve(null),
    request.targetBloggerBlogId && request.planDateLocal
      ? prisma.blogDailyContentPlan.findUnique({
          where: {
            targetBloggerBlogId_planDateLocal: {
              targetBloggerBlogId: request.targetBloggerBlogId,
              planDateLocal: request.planDateLocal
            }
          }
        })
      : Promise.resolve(null)
  ]);

  const profileHealthy = Boolean(
    profile &&
      profile.status === "active" &&
      profile.operationMode === "approval_required" &&
      profile.defaultPublishPolicyPreset === SAFE_MANUAL_PUBLISH_PRESET &&
      profile.allowAutoPublish === false &&
      profile.allowScheduledPublish === false &&
      profile.requireOAuthGate &&
      profile.requireFinalHumanApproval &&
      profile.requireExternalWriteRiskAck &&
      profile.requireRollbackPlanAck &&
      profile.requireReadbackAfterPublish &&
      profile.requirePostPublishReconciliation
  );

  if (!profile) {
    blockingReasons.add("daily_content_plan_profile_missing");
  }
  if (profile && profile.targetBloggerBlogId !== request.targetBloggerBlogId) {
    blockingReasons.add("daily_content_plan_profile_mismatch");
  }
  if (profile && !profileHealthy) {
    blockingReasons.add("daily_content_plan_profile_not_safe_manual_publish");
  }
  if (request.mode === "apply") {
    if (!featureFlagEnabled) {
      blockingReasons.add("daily_content_plan_write_feature_flag_disabled");
    }
    if (!confirmationPhraseAccepted) {
      blockingReasons.add("daily_content_plan_confirmation_missing");
    }
  }

  const canApply = request.mode === "apply" && blockingReasons.size === 0 && Boolean(request.targetBloggerBlogId && request.planDateLocal);
  let applyOk = false;
  let dbWrite = false;

  if (canApply) {
    await prisma.$transaction(async (tx) => {
      const plan = await tx.blogDailyContentPlan.upsert({
        where: {
          targetBloggerBlogId_planDateLocal: {
            targetBloggerBlogId: request.targetBloggerBlogId ?? "",
            planDateLocal: request.planDateLocal ?? ""
          }
        },
        create: buildPlanWriteData({ request, profileId: profile?.id ?? null, planItems, policySnapshot }),
        update: buildPlanWriteData({ request, profileId: profile?.id ?? null, planItems, policySnapshot })
      });

      await tx.blogDailyContentPlanItem.deleteMany({ where: { planId: plan.id } });
      await tx.blogDailyContentPlanItem.createMany({
        data: planItems.map((item) => buildPlanItemWriteData(plan.id, item, policySnapshot))
      });
    });
    applyOk = true;
    dbWrite = true;
  }

  const summary: DailyContentPlanSummary = {
    checked: true,
    mode: request.mode,
    planVersion: "9F-2A",
    planMode: "daily_auto_content_plan_draft",
    profileFound: Boolean(profile),
    profileHealthy,
    planWouldBeCreated: Boolean(!existingPlan && request.targetBloggerBlogId && request.planDateLocal),
    planWouldBeUpdated: Boolean(existingPlan),
    applyAttempted: canApply,
    applyBlocked: request.mode === "apply" && !applyOk,
    applyOk,
    featureFlagEnabled,
    confirmationPhraseAccepted,
    targetBloggerBlogId: profile?.targetBloggerBlogId ?? request.targetBloggerBlogId ?? "",
    targetBloggerBlogName: profile?.targetBloggerBlogName ?? request.targetBloggerBlogName,
    targetBloggerBlogUrl: profile?.targetBloggerBlogUrl ?? request.targetBloggerBlogUrl,
    planDateLocal: request.planDateLocal ?? "",
    timezone: DEFAULT_TIMEZONE,
    operationMode: "approval_required",
    defaultPublishPolicyPreset: SAFE_MANUAL_PUBLISH_PRESET,
    contentGenerationEnabled: false,
    llmCallEnabled: false,
    publishExecutionEnabled: false,
    scheduledPublishEnabled: false,
    policySnapshot,
    planItems,
    planTotals: {
      plannedItemCount: planItems.length,
      approvalRequiredCount: planItems.filter((item) => item.requiresHumanApproval).length,
      llmGenerationAllowedCount: 0,
      publishExecutionAllowedCount: 0,
      scheduledPublishAllowedCount: 0
    },
    guardrailSummary: {
      noContentGeneration: true,
      noLlmCall: true,
      noContentItemMutation: true,
      noBloggerWrite: true,
      noPublishExecution: true,
      noScheduledPublish: true,
      profilePolicyUsed: Boolean(profile)
    },
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
      contentGeneration: false,
      contentMutation: false,
      approvalMutation: false,
      attemptMutation: false,
      llmCall: false,
      externalSend: false
    }
  };

  return {
    checkedAt: checkedAt.toISOString(),
    dailyContentPlanSummary: summary
  };
}

function normalizeRequest(raw: DailyContentPlanDefaultRequest) {
  const timezone = getString(raw.timezone);
  return {
    mode: raw.mode === "apply" ? ("apply" as const) : ("preview" as const),
    targetBloggerBlogId: getString(raw.targetBloggerBlogId),
    targetBloggerBlogName: getString(raw.targetBloggerBlogName),
    targetBloggerBlogUrl: getString(raw.targetBloggerBlogUrl),
    planDateLocal: getString(raw.planDateLocal),
    timezone: timezone === DEFAULT_TIMEZONE ? DEFAULT_TIMEZONE : DEFAULT_TIMEZONE,
    defaultPublishPolicyPreset: getString(raw.defaultPublishPolicyPreset) ?? SAFE_MANUAL_PUBLISH_PRESET,
    confirmDailyContentPlanWrite: getString(raw.confirmDailyContentPlanWrite)
  };
}

function buildPlanItems(): DailyContentPlanSummary["planItems"] {
  return [
    {
      syntheticPlanItemId: "preview-morning-education",
      itemOrder: 1,
      slotKey: "morning_education",
      topicSeed: "초보자를 위한 급등주 체크 전 확인할 기본 조건",
      contentIntent: "beginner_education",
      audienceHint: "주식 초보자 / 리스크 관리 중심",
      riskNote: "특정 종목 매수 추천이 아닌 교육형 콘텐츠로 제한",
      publishMode: "approval_required",
      draftGenerationAllowed: false,
      llmGenerationAllowed: false,
      publishExecutionAllowed: false,
      scheduledPublishAllowed: false,
      requiresHumanApproval: true,
      operatorTakeaway: "교육형 topic seed만 준비합니다. 본문 생성과 발행은 별도 승인 전까지 실행하지 않습니다."
    },
    {
      syntheticPlanItemId: "preview-midday-checklist",
      itemOrder: 2,
      slotKey: "midday_checklist",
      topicSeed: "급등 포착 전에 점검할 거래량과 뉴스 해석 체크리스트",
      contentIntent: "checklist_education",
      audienceHint: "단기 관심 종목을 보는 초보 투자자",
      riskNote: "실시간 종목 추천이나 수익 보장 표현 금지",
      publishMode: "approval_required",
      draftGenerationAllowed: false,
      llmGenerationAllowed: false,
      publishExecutionAllowed: false,
      scheduledPublishAllowed: false,
      requiresHumanApproval: true,
      operatorTakeaway: "체크리스트형 planning metadata입니다. LLM 호출과 content_items 생성은 하지 않습니다."
    },
    {
      syntheticPlanItemId: "preview-evening-risk-review",
      itemOrder: 3,
      slotKey: "evening_risk_review",
      topicSeed: "오늘의 관심 종목을 복기할 때 봐야 할 손절·분할매수 기준",
      contentIntent: "risk_management_education",
      audienceHint: "다음 매매를 준비하는 개인 투자자",
      riskNote: "투자 판단은 독자 책임이며, 구체 매수/매도 지시 금지",
      publishMode: "approval_required",
      draftGenerationAllowed: false,
      llmGenerationAllowed: false,
      publishExecutionAllowed: false,
      scheduledPublishAllowed: false,
      requiresHumanApproval: true,
      operatorTakeaway: "리스크 관리 중심 계획입니다. scheduled publish와 Blogger write는 비활성입니다."
    }
  ];
}

function buildPolicySnapshot(): Record<string, unknown> {
  return {
    ...buildSafeManualPublishPolicy(),
    operationMode: "approval_required",
    contentGenerationEnabled: false,
    llmCallEnabled: false,
    publishExecutionEnabled: false,
    scheduledPublishEnabled: false
  };
}

function buildPlanWriteData(input: {
  request: ReturnType<typeof normalizeRequest>;
  profileId: string | null;
  planItems: DailyContentPlanSummary["planItems"];
  policySnapshot: Record<string, unknown>;
}) {
  const { request, profileId, planItems, policySnapshot } = input;
  return {
    targetBloggerBlogId: request.targetBloggerBlogId ?? "",
    targetBloggerBlogName: request.targetBloggerBlogName,
    targetBloggerBlogUrl: request.targetBloggerBlogUrl,
    operationProfileId: profileId,
    planDateLocal: request.planDateLocal ?? "",
    timezone: DEFAULT_TIMEZONE,
    planName: "Daily Content Plan",
    status: "draft",
    planKind: "daily_auto_content_plan",
    operationMode: "approval_required",
    defaultPublishPolicyPreset: SAFE_MANUAL_PUBLISH_PRESET,
    contentGenerationEnabled: false,
    llmCallEnabled: false,
    publishExecutionEnabled: false,
    scheduledPublishEnabled: false,
    plannedItemCount: planItems.length,
    policySnapshotJson: policySnapshot as Prisma.InputJsonValue,
    planSummaryJson: {
      planVersion: "9F-2A",
      planMode: "daily_auto_content_plan_draft",
      plannedItemCount: planItems.length,
      validationScope: "planning_metadata_only"
    },
    guardrailJson: {
      noContentGeneration: true,
      noLlmCall: true,
      noContentItemMutation: true,
      noBloggerWrite: true,
      noPublishExecution: true,
      noScheduledPublish: true
    }
  };
}

function buildPlanItemWriteData(planId: string, item: DailyContentPlanSummary["planItems"][number], policySnapshot: Record<string, unknown>) {
  return {
    planId,
    itemOrder: item.itemOrder,
    slotKey: item.slotKey,
    status: "candidate",
    topicSeed: item.topicSeed,
    contentIntent: item.contentIntent,
    audienceHint: item.audienceHint,
    riskNote: item.riskNote,
    publishMode: item.publishMode,
    contentItemId: null,
    draftGenerationAllowed: false,
    llmGenerationAllowed: false,
    publishExecutionAllowed: false,
    scheduledPublishAllowed: false,
    requiresHumanApproval: true,
    policySnapshotJson: policySnapshot as Prisma.InputJsonValue,
    itemPlanJson: {
      syntheticPlanItemId: item.syntheticPlanItemId,
      operatorTakeaway: item.operatorTakeaway,
      previewOnlyInPatch: "9F-2A"
    }
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
