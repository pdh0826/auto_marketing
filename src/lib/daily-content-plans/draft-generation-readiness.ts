import { prisma } from "@/lib/db/client";

const PATCH_VERSION = "9F-2F";

type DraftGenerationReadinessMode = "preflight" | "generate";
type DraftGenerationReadinessLevel = "blocked_safe" | "structural_ready_but_execution_blocked" | "missing_fixture" | "invalid_state";

export interface DailyContentDraftGenerationReadinessRequest {
  mode?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationReadinessResponse {
  checkedAt: string;
  draftGenerationReadinessSummary: DailyContentDraftGenerationReadinessSummary;
}

export interface DailyContentDraftGenerationReadinessSummary {
  checked: true;
  patchVersion: "9F-2F";
  mode: DraftGenerationReadinessMode;
  targetPlanId: string | null;
  targetPlanItemId: string;
  linkedContentItemId: string | null;
  fixtureFound: boolean;
  planItemFound: boolean;
  linkedFixtureMatchesPlanItem: boolean;
  applyAttempted: false;
  generationAttempted: false;
  applyBlocked: boolean;
  generationBlocked: true;
  applyOk: false;
  generationOk: false;
  readinessSummary: {
    structuralReadyForFutureDraftGeneration: boolean;
    executionReadyForDraftGeneration: false;
    readinessLevel: DraftGenerationReadinessLevel;
    operatorLabelKo: string;
    nextSafeStepDraft: string;
  };
  checks: {
    planItemLinkedToContentFixture: boolean;
    fixtureExists: boolean;
    fixtureStatusIsSafe: boolean;
    fixtureNotPublished: boolean;
    fixtureNotScheduled: boolean;
    fixtureHasNoDraftMarkdown: boolean;
    fixtureHasNoDraftHtml: boolean;
    planRequiresHumanApproval: boolean;
    operatorApprovalPersisted: false;
    draftGenerationFlagEnabled: false;
    llmGenerationFlagEnabled: false;
    contentMutationAllowed: false;
    bloggerWriteAllowed: false;
    publishExecutionAllowed: false;
    scheduledPublishAllowed: false;
  };
  missingRequirements: string[];
  blockingReasons: string[];
  warnings: string[];
  proposedFutureDraftGenerationPlan: {
    source: "daily_content_plan_item_fixture";
    topicSeed: string | null;
    contentIntent: string | null;
    linkedContentItemId: string | null;
    wouldRequireOperatorApproval: true;
    wouldRequireSeparateWriteFlag: true;
    wouldRequireLlmProviderSelection: true;
    wouldCreateDraftMarkdown: false;
    wouldCreateDraftHtml: false;
    previewOnly: true;
  };
  disabledActions: string[];
  guardrailSummary: {
    noBusinessDbWrite: true;
    noContentGeneration: true;
    noLlmCall: true;
    noContentItemMutation: true;
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
    dbWrite: false;
    contentGeneration: false;
    llmCall: false;
    contentMutation: false;
    bloggerWrite: false;
    bloggerPublish: false;
    bloggerDraftSave: false;
    scheduledPublish: false;
    tokenRefresh: false;
    oauthReconnect: false;
    approvalMutation: false;
    attemptMutation: false;
    externalSend: false;
    schemaMigration: false;
  };
}

export async function buildDailyContentDraftGenerationReadinessResponse(
  rawRequest: DailyContentDraftGenerationReadinessRequest
): Promise<DailyContentDraftGenerationReadinessResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const blockingReasons = new Set<string>();
  const warnings = new Set<string>(["draft_generation_readiness_preflight_only", "draft_generation_execution_disabled", "llm_call_disabled"]);

  if (!request.planItemId) {
    blockingReasons.add("daily_content_plan_item_id_missing");
  }
  if (request.mode !== "preflight") {
    blockingReasons.add("draft_generation_readiness_is_preflight_only");
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

  const linkedContentItemId = request.contentItemId ?? planItem?.contentItemId ?? null;
  const fixture = linkedContentItemId
    ? await prisma.contentItem.findUnique({
        where: { id: linkedContentItemId },
        select: {
          id: true,
          mode: true,
          status: true,
          title: true,
          draftMarkdown: true,
          draftHtml: true,
          publishedAt: true,
          scheduledAt: true
        }
      })
    : null;

  const planItemLinkedToContentFixture = Boolean(planItem?.contentItemId);
  const linkedFixtureMatchesPlanItem = Boolean(planItem && linkedContentItemId && planItem.contentItemId === linkedContentItemId && fixture);
  const fixtureStatusIsSafe = Boolean(fixture && fixture.status !== "published" && fixture.status !== "scheduled");
  const fixtureNotPublished = Boolean(fixture && !fixture.publishedAt && fixture.status !== "published");
  const fixtureNotScheduled = Boolean(fixture && !fixture.scheduledAt && fixture.status !== "scheduled");
  const fixtureHasNoDraftMarkdown = Boolean(fixture && !fixture.draftMarkdown?.trim());
  const fixtureHasNoDraftHtml = Boolean(fixture && !fixture.draftHtml?.trim());
  const planRequiresHumanApproval = Boolean(planItem?.requiresHumanApproval);
  const planItemGuardrailsSafe = Boolean(
    planItem &&
      planItem.requiresHumanApproval &&
      !planItem.draftGenerationAllowed &&
      !planItem.llmGenerationAllowed &&
      !planItem.publishExecutionAllowed &&
      !planItem.scheduledPublishAllowed
  );

  if (planItem && !planItem.contentItemId) {
    blockingReasons.add("content_item_fixture_missing");
  }
  if (planItem && linkedContentItemId && planItem.contentItemId !== linkedContentItemId) {
    blockingReasons.add("linked_content_item_mismatch");
  }
  if (linkedContentItemId && !fixture) {
    blockingReasons.add("linked_content_item_not_found");
  }
  if (fixture && !fixtureStatusIsSafe) {
    blockingReasons.add("fixture_status_not_safe_for_draft_generation");
  }
  if (fixture && !fixtureNotPublished) {
    blockingReasons.add("fixture_already_published");
  }
  if (fixture && !fixtureNotScheduled) {
    blockingReasons.add("fixture_already_scheduled");
  }
  if (fixture && (!fixtureHasNoDraftMarkdown || !fixtureHasNoDraftHtml)) {
    blockingReasons.add("fixture_already_has_generated_draft_content");
  }
  if (planItem && !planItemGuardrailsSafe) {
    blockingReasons.add("daily_plan_item_generation_guardrails_not_safe");
  }

  const structuralReadyForFutureDraftGeneration =
    request.mode === "preflight" &&
    Boolean(planItem) &&
    Boolean(fixture) &&
    linkedFixtureMatchesPlanItem &&
    fixtureStatusIsSafe &&
    fixtureNotPublished &&
    fixtureNotScheduled &&
    fixtureHasNoDraftMarkdown &&
    fixtureHasNoDraftHtml &&
    planItemGuardrailsSafe;

  const readinessLevel = getReadinessLevel({
    structuralReadyForFutureDraftGeneration,
    planItemFound: Boolean(planItem),
    fixtureFound: Boolean(fixture),
    requestMode: request.mode
  });

  blockingReasons.add("no_operator_approval_persisted");
  blockingReasons.add("draft_generation_execution_disabled");
  blockingReasons.add("llm_generation_execution_disabled");
  blockingReasons.add("content_mutation_disabled");

  const summary: DailyContentDraftGenerationReadinessSummary = {
    checked: true,
    patchVersion: PATCH_VERSION,
    mode: request.mode,
    targetPlanId: planItem?.planId ?? null,
    targetPlanItemId: request.planItemId ?? "",
    linkedContentItemId,
    fixtureFound: Boolean(fixture),
    planItemFound: Boolean(planItem),
    linkedFixtureMatchesPlanItem,
    applyAttempted: false,
    generationAttempted: false,
    applyBlocked: request.mode !== "preflight",
    generationBlocked: true,
    applyOk: false,
    generationOk: false,
    readinessSummary: {
      structuralReadyForFutureDraftGeneration,
      executionReadyForDraftGeneration: false,
      readinessLevel,
      operatorLabelKo: getOperatorLabelKo(readinessLevel),
      nextSafeStepDraft: getNextSafeStepDraft(readinessLevel)
    },
    checks: {
      planItemLinkedToContentFixture,
      fixtureExists: Boolean(fixture),
      fixtureStatusIsSafe,
      fixtureNotPublished,
      fixtureNotScheduled,
      fixtureHasNoDraftMarkdown,
      fixtureHasNoDraftHtml,
      planRequiresHumanApproval,
      operatorApprovalPersisted: false,
      draftGenerationFlagEnabled: false,
      llmGenerationFlagEnabled: false,
      contentMutationAllowed: false,
      bloggerWriteAllowed: false,
      publishExecutionAllowed: false,
      scheduledPublishAllowed: false
    },
    missingRequirements: [
      "operator_approval_not_persisted",
      "draft_generation_write_flag_not_available",
      "llm_provider_execution_disabled",
      "generation_action_not_implemented",
      "content_item_mutation_disabled"
    ],
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings),
    proposedFutureDraftGenerationPlan: {
      source: "daily_content_plan_item_fixture",
      topicSeed: planItem?.topicSeed ?? fixture?.title ?? null,
      contentIntent: planItem?.contentIntent ?? null,
      linkedContentItemId,
      wouldRequireOperatorApproval: true,
      wouldRequireSeparateWriteFlag: true,
      wouldRequireLlmProviderSelection: true,
      wouldCreateDraftMarkdown: false,
      wouldCreateDraftHtml: false,
      previewOnly: true
    },
    disabledActions: ["generate_draft", "call_llm", "mutate_content_item", "save_blogger_draft", "publish_blogger_post", "schedule_publish"],
    guardrailSummary: {
      noBusinessDbWrite: true,
      noContentGeneration: true,
      noLlmCall: true,
      noContentItemMutation: true,
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
      dbWrite: false,
      contentGeneration: false,
      llmCall: false,
      contentMutation: false,
      bloggerWrite: false,
      bloggerPublish: false,
      bloggerDraftSave: false,
      scheduledPublish: false,
      tokenRefresh: false,
      oauthReconnect: false,
      approvalMutation: false,
      attemptMutation: false,
      externalSend: false,
      schemaMigration: false
    }
  };

  return {
    checkedAt: checkedAt.toISOString(),
    draftGenerationReadinessSummary: summary
  };
}

function normalizeRequest(raw: DailyContentDraftGenerationReadinessRequest) {
  const mode = getString(raw.mode);
  return {
    mode: mode === "preflight" || mode === "preview" || mode === "readback" ? ("preflight" as const) : ("generate" as const),
    planItemId: getString(raw.planItemId),
    contentItemId: getString(raw.contentItemId)
  };
}

function getReadinessLevel(input: {
  structuralReadyForFutureDraftGeneration: boolean;
  planItemFound: boolean;
  fixtureFound: boolean;
  requestMode: DraftGenerationReadinessMode;
}): DraftGenerationReadinessLevel {
  if (input.requestMode !== "preflight") {
    return "blocked_safe";
  }
  if (!input.planItemFound || !input.fixtureFound) {
    return "missing_fixture";
  }
  if (input.structuralReadyForFutureDraftGeneration) {
    return "structural_ready_but_execution_blocked";
  }
  return "invalid_state";
}

function getOperatorLabelKo(readinessLevel: DraftGenerationReadinessLevel) {
  const labels: Record<DraftGenerationReadinessLevel, string> = {
    blocked_safe: "보기 전용으로 차단됨",
    structural_ready_but_execution_blocked: "구조 준비 완료, 실행 차단",
    missing_fixture: "content fixture 대기",
    invalid_state: "상태 점검 필요"
  };
  return labels[readinessLevel];
}

function getNextSafeStepDraft(readinessLevel: DraftGenerationReadinessLevel) {
  if (readinessLevel === "structural_ready_but_execution_blocked") {
    return "운영자 승인 저장 설계와 별도 write-enabled 초안 생성 패치가 준비된 뒤에만 LLM 초안 생성을 열 수 있습니다.";
  }
  if (readinessLevel === "missing_fixture") {
    return "먼저 Daily Content Plan item과 content_items fixture 연결 상태를 확인하세요.";
  }
  if (readinessLevel === "blocked_safe") {
    return "9F-2F는 preflight 전용입니다. 실행/generate mode는 항상 차단됩니다.";
  }
  return "fixture 상태, draft 비어 있음, 안전 가드, 승인 조건을 다시 확인하세요.";
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
