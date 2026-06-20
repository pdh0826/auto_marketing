import { prisma } from "@/lib/db/client";

const PATCH_VERSION = "9F-2E";

type OperatorWorkflowMode = "preview" | "apply";
type ApprovalStateDraft = "ready_for_operator_review" | "waiting_for_content_fixture" | "blocked_by_guardrail";

export interface DailyContentQueueOperatorWorkflowRequest {
  mode?: unknown;
  planId?: unknown;
}

export interface DailyContentQueueOperatorWorkflowResponse {
  checkedAt: string;
  operatorApprovalWorkflowSummary: DailyContentQueueOperatorWorkflowSummary;
}

export interface DailyContentQueueOperatorWorkflowSummary {
  checked: true;
  mode: OperatorWorkflowMode;
  patchVersion: "9F-2E";
  workflowMode: "draft_preview" | "blocked_preview_only";
  workflowWriteEnabled: false;
  targetPlanId: string;
  planDateLocal: string | null;
  planStatus: string | null;
  planKind: string | null;
  operationMode: string | null;
  defaultPublishPolicyPreset: string | null;
  applyAttempted: false;
  applyBlocked: boolean;
  applyOk: false;
  queueSummary: {
    totalItems: number;
    linkedContentItemCount: number;
    unlinkedItemCount: number;
    approvalRequiredCount: number;
    readyForOperatorReviewCount: number;
    waitingForContentFixtureCount: number;
    blockedFromGenerationCount: number;
    blockedFromPublishCount: number;
  };
  operatorDecisionSummary: {
    approvalPersistenceImplemented: false;
    realApprovalMutationEnabled: false;
    draftGenerationEnabled: false;
    llmCallEnabled: false;
    publishExecutionEnabled: false;
    scheduledPublishEnabled: false;
    availableDecisionDrafts: string[];
    disabledDecisionActions: string[];
  };
  queueItems: DailyContentQueueOperatorWorkflowItem[];
  guardrailSummary: {
    noBusinessDbWrite: true;
    noApprovalMutation: true;
    noContentGeneration: true;
    noLlmCall: true;
    noContentItemMutation: true;
    noBloggerWrite: true;
    noPublishExecution: true;
    noScheduledPublish: true;
    noOAuthReconnect: true;
    noTokenRefresh: true;
  };
  sideEffectSummary: {
    dbRead: true;
    dbWrite: false;
    approvalMutation: false;
    contentGeneration: false;
    llmCall: false;
    contentMutation: false;
    bloggerRead: false;
    bloggerWrite: false;
    bloggerPublish: false;
    bloggerUpdate: false;
    bloggerDraftSave: false;
    scheduledPublish: false;
    tokenRefresh: false;
    oauthReconnect: false;
    externalSend: false;
    schemaMigration: false;
  };
  blockingReasons: string[];
  warnings: string[];
}

export interface DailyContentQueueOperatorWorkflowItem {
  planItemId: string;
  itemOrder: number;
  slotKey: string;
  slotLabel: string;
  status: string;
  topicSeed: string;
  contentIntent: string;
  publishMode: string;
  contentItemId: string | null;
  linkedContentStatus: string | null;
  linkedContentMode: string | null;
  linkedContentTitle: string | null;
  approvalStateDraft: ApprovalStateDraft;
  nextSafeStepDraft: string;
  missingRequirements: string[];
  disabledActions: string[];
  guardrails: {
    requiresHumanApproval: boolean;
    draftGenerationAllowed: boolean;
    llmGenerationAllowed: boolean;
    publishExecutionAllowed: boolean;
    scheduledPublishAllowed: boolean;
  };
}

export async function buildDailyContentQueueOperatorWorkflowResponse(
  rawRequest: DailyContentQueueOperatorWorkflowRequest
): Promise<DailyContentQueueOperatorWorkflowResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const blockingReasons = new Set<string>();
  const warnings = new Set<string>([
    "operator_approval_workflow_preview_only",
    "operator_approval_persistence_not_implemented",
    "content_generation_disabled",
    "blogger_publish_disabled"
  ]);

  if (!request.planId) {
    blockingReasons.add("daily_content_plan_id_missing");
  }
  if (request.mode !== "preview") {
    blockingReasons.add("operator_approval_workflow_is_preview_only");
  }

  const plan = request.planId
    ? await prisma.blogDailyContentPlan.findUnique({
        where: { id: request.planId },
        include: { items: { orderBy: { itemOrder: "asc" } } }
      })
    : null;

  if (!plan) {
    blockingReasons.add("daily_content_plan_not_found");
  }

  const contentItemIds = Array.from(new Set((plan?.items ?? []).map((item) => item.contentItemId).filter((id): id is string => Boolean(id))));
  const linkedContentItems =
    contentItemIds.length > 0
      ? await prisma.contentItem.findMany({
          where: { id: { in: contentItemIds } },
          select: {
            id: true,
            status: true,
            mode: true,
            title: true
          }
        })
      : [];
  const linkedContentItemMap = new Map(linkedContentItems.map((item) => [item.id, item]));

  const queueItems = (plan?.items ?? []).map((item) => buildWorkflowItem(item, linkedContentItemMap.get(item.contentItemId ?? "")));
  const linkedContentItemCount = queueItems.filter((item) => Boolean(item.contentItemId && item.linkedContentStatus)).length;
  const readyForOperatorReviewCount = queueItems.filter((item) => item.approvalStateDraft === "ready_for_operator_review").length;
  const waitingForContentFixtureCount = queueItems.filter((item) => item.approvalStateDraft === "waiting_for_content_fixture").length;

  const summary: DailyContentQueueOperatorWorkflowSummary = {
    checked: true,
    mode: request.mode,
    patchVersion: PATCH_VERSION,
    workflowMode: request.mode === "preview" ? "draft_preview" : "blocked_preview_only",
    workflowWriteEnabled: false,
    targetPlanId: request.planId ?? "",
    planDateLocal: plan?.planDateLocal ?? null,
    planStatus: plan?.status ?? null,
    planKind: plan?.planKind ?? null,
    operationMode: plan?.operationMode ?? null,
    defaultPublishPolicyPreset: plan?.defaultPublishPolicyPreset ?? null,
    applyAttempted: false,
    applyBlocked: request.mode !== "preview",
    applyOk: false,
    queueSummary: {
      totalItems: queueItems.length,
      linkedContentItemCount,
      unlinkedItemCount: queueItems.length - linkedContentItemCount,
      approvalRequiredCount: queueItems.filter((item) => item.guardrails.requiresHumanApproval).length,
      readyForOperatorReviewCount,
      waitingForContentFixtureCount,
      blockedFromGenerationCount: queueItems.length,
      blockedFromPublishCount: queueItems.length
    },
    operatorDecisionSummary: {
      approvalPersistenceImplemented: false,
      realApprovalMutationEnabled: false,
      draftGenerationEnabled: false,
      llmCallEnabled: false,
      publishExecutionEnabled: false,
      scheduledPublishEnabled: false,
      availableDecisionDrafts: ["초안 생성 준비 승인", "주제 보류", "재검토 요청"],
      disabledDecisionActions: [
        "approval_persistence_disabled",
        "draft_generation_disabled",
        "llm_call_disabled",
        "blogger_write_disabled",
        "publish_execution_disabled",
        "scheduled_publish_disabled"
      ]
    },
    queueItems,
    guardrailSummary: {
      noBusinessDbWrite: true,
      noApprovalMutation: true,
      noContentGeneration: true,
      noLlmCall: true,
      noContentItemMutation: true,
      noBloggerWrite: true,
      noPublishExecution: true,
      noScheduledPublish: true,
      noOAuthReconnect: true,
      noTokenRefresh: true
    },
    sideEffectSummary: {
      dbRead: true,
      dbWrite: false,
      approvalMutation: false,
      contentGeneration: false,
      llmCall: false,
      contentMutation: false,
      bloggerRead: false,
      bloggerWrite: false,
      bloggerPublish: false,
      bloggerUpdate: false,
      bloggerDraftSave: false,
      scheduledPublish: false,
      tokenRefresh: false,
      oauthReconnect: false,
      externalSend: false,
      schemaMigration: false
    },
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    operatorApprovalWorkflowSummary: summary
  };
}

function normalizeRequest(raw: DailyContentQueueOperatorWorkflowRequest) {
  const mode = getString(raw.mode);
  return {
    mode: mode && mode !== "preview" ? ("apply" as const) : ("preview" as const),
    planId: getString(raw.planId)
  };
}

function buildWorkflowItem(
  item: {
    id: string;
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
  },
  linkedContentItem?: {
    id: string;
    status: string;
    mode: string;
    title: string | null;
  }
): DailyContentQueueOperatorWorkflowItem {
  const guardrailProblem =
    !item.requiresHumanApproval || item.draftGenerationAllowed || item.llmGenerationAllowed || item.publishExecutionAllowed || item.scheduledPublishAllowed;
  const approvalStateDraft: ApprovalStateDraft = guardrailProblem
    ? "blocked_by_guardrail"
    : linkedContentItem
      ? "ready_for_operator_review"
      : "waiting_for_content_fixture";

  return {
    planItemId: item.id,
    itemOrder: item.itemOrder,
    slotKey: item.slotKey,
    slotLabel: getSlotLabel(item.slotKey),
    status: item.status,
    topicSeed: item.topicSeed,
    contentIntent: item.contentIntent,
    publishMode: item.publishMode,
    contentItemId: item.contentItemId,
    linkedContentStatus: linkedContentItem?.status ?? null,
    linkedContentMode: linkedContentItem?.mode ?? null,
    linkedContentTitle: linkedContentItem?.title ?? null,
    approvalStateDraft,
    nextSafeStepDraft: getNextSafeStepDraft(approvalStateDraft),
    missingRequirements: getMissingRequirements(approvalStateDraft),
    disabledActions: [
      "approval_persistence_disabled",
      "draft_generation_disabled",
      "llm_call_disabled",
      "blogger_write_disabled",
      "publish_execution_disabled",
      "scheduled_publish_disabled"
    ],
    guardrails: {
      requiresHumanApproval: item.requiresHumanApproval,
      draftGenerationAllowed: item.draftGenerationAllowed,
      llmGenerationAllowed: item.llmGenerationAllowed,
      publishExecutionAllowed: item.publishExecutionAllowed,
      scheduledPublishAllowed: item.scheduledPublishAllowed
    }
  };
}

function getNextSafeStepDraft(approvalStateDraft: ApprovalStateDraft) {
  if (approvalStateDraft === "ready_for_operator_review") {
    return "운영자가 linked content fixture와 topic seed를 검토합니다. 실제 승인 저장과 초안 생성은 후속 패치에서만 가능합니다.";
  }
  if (approvalStateDraft === "waiting_for_content_fixture") {
    return "먼저 content_items fixture 연결이 필요합니다. 이번 workflow preview는 fixture를 생성하거나 연결하지 않습니다.";
  }
  return "가드레일이 안전하지 않아 생성/발행 단계로 진행할 수 없습니다.";
}

function getMissingRequirements(approvalStateDraft: ApprovalStateDraft) {
  if (approvalStateDraft === "ready_for_operator_review") {
    return ["operator_approval_persistence_not_implemented", "draft_generation_readiness_preflight_not_run"];
  }
  if (approvalStateDraft === "waiting_for_content_fixture") {
    return ["content_item_fixture_missing", "operator_approval_persistence_not_implemented"];
  }
  return ["daily_plan_item_guardrails_not_safe", "operator_approval_persistence_not_implemented"];
}

function getSlotLabel(slotKey: string) {
  const labels: Record<string, string> = {
    morning_education: "오전 교육형",
    midday_checklist: "점심 체크리스트",
    evening_risk_review: "저녁 리스크 복기"
  };
  return labels[slotKey] ?? slotKey;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
