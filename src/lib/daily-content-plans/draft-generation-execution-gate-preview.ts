import { prisma } from "@/lib/db/client";

const PATCH_VERSION = "9F-2J";
const OPERATOR_APPROVAL_MIGRATION = "20260620000200_add_daily_content_operator_approval_scaffold";
const OPERATOR_APPROVAL_PURPOSE = "draft_generation_execution";

type DraftGenerationExecutionGateMode = "preview" | "blocked_non_preview";
type GateLayerStatus = "pass" | "blocked" | "not_applicable";

export interface DailyContentDraftGenerationExecutionGatePreviewRequest {
  mode?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationExecutionGatePreviewResponse {
  checkedAt: string;
  draftGenerationExecutionGatePreviewSummary: DailyContentDraftGenerationExecutionGatePreviewSummary;
}

export interface DailyContentDraftGenerationExecutionGatePreviewSummary {
  patchVersion: "9F-2J";
  checked: true;
  mode: DraftGenerationExecutionGateMode;
  requestedMode: string | null;
  targetPlanId: string | null;
  targetPlanItemId: string;
  linkedContentItemId: string | null;
  applyAttempted: false;
  generationAttempted: false;
  applyBlocked: boolean;
  generationBlocked: true;
  applyOk: false;
  generationOk: false;
  targetIntegrity: {
    planItemFound: boolean;
    linkedContentItemFound: boolean;
    linkedFixtureMatchesPlanItem: boolean;
  };
  migrationState: {
    operatorApprovalMigrationExpected: typeof OPERATOR_APPROVAL_MIGRATION;
    operatorApprovalTablesExist: boolean;
    operatorApprovalPersistenceAvailable: boolean;
    migrationPendingAssumed: boolean;
  };
  executionGateSummary: {
    executionAllowed: false;
    readinessStructuralReady: boolean;
    operatorApprovalSatisfied: boolean;
    llmProviderGateSatisfied: false;
    contentMutationGateSatisfied: false;
    confirmationSatisfied: false;
    idempotencySatisfied: false;
    publishIsolationSatisfied: boolean;
    overallLabelKo: string;
  };
  gateLayers: DailyContentDraftGenerationExecutionGateLayer[];
  canonicalBlockingReasons: string[];
  futureApplyRequirements: {
    requiresAppliedOperatorApprovalMigration: true;
    requiresPersistedOperatorApproval: true;
    requiresLlmExecutionFlag: true;
    requiresContentMutationFlag: true;
    requiresDraftGenerationWriteFlag: true;
    requiresConfirmationPhrase: true;
    requiresIdempotencyKey: true;
    requiresBloggerWriteDisabled: true;
    requiresPublishExecutionDisabled: true;
  };
  expectedFutureSideEffectsIfApproved: {
    llmCallLogInsert: true;
    contentItemDraftMutation: true;
    bloggerWrite: false;
    publishExecution: false;
    scheduledPublish: false;
    tokenRefresh: false;
    oauthReconnect: false;
  };
  guardrailSummary: {
    noBusinessDbWrite: true;
    noContentGeneration: true;
    noLlmCall: true;
    noContentItemMutation: true;
    noDraftMarkdownMutation: true;
    noDraftHtmlMutation: true;
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
    llmCallLogInsert: false;
    contentMutation: false;
    draftMarkdownMutation: false;
    draftHtmlMutation: false;
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
  warnings: string[];
}

export interface DailyContentDraftGenerationExecutionGateLayer {
  layer: number;
  key: string;
  labelKo: string;
  status: GateLayerStatus;
  blockingReasons: string[];
  allowedSideEffects: string[];
  prohibitedSideEffects: string[];
}

export async function buildDailyContentDraftGenerationExecutionGatePreviewResponse(
  rawRequest: DailyContentDraftGenerationExecutionGatePreviewRequest
): Promise<DailyContentDraftGenerationExecutionGatePreviewResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const blockingReasons = new Set<string>();
  const warnings = new Set<string>([
    "draft_generation_execution_gate_preview_only",
    "draft_generation_execution_disabled",
    "llm_call_disabled",
    "content_item_mutation_disabled"
  ]);

  if (!request.planItemId) {
    blockingReasons.add("daily_content_plan_item_id_missing");
  }
  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_execution_gate_preview_only");
  }

  const [planItem, operatorApprovalTableState] = await Promise.all([
    request.planItemId
      ? prisma.blogDailyContentPlanItem.findUnique({
          where: { id: request.planItemId },
          include: { plan: true }
        })
      : null,
    readOperatorApprovalTableState()
  ]);

  if (!planItem) {
    blockingReasons.add("target_plan_item_not_found");
  }

  const linkedContentItemId = request.contentItemId ?? planItem?.contentItemId ?? null;
  const linkedContentItem = linkedContentItemId
    ? await prisma.contentItem.findUnique({
        where: { id: linkedContentItemId },
        select: {
          id: true,
          mode: true,
          status: true,
          draftMarkdown: true,
          draftHtml: true,
          publishedAt: true,
          scheduledAt: true
        }
      })
    : null;

  const planItemFound = Boolean(planItem);
  const linkedContentItemFound = Boolean(linkedContentItem);
  const linkedFixtureMatchesPlanItem = Boolean(planItem && linkedContentItemId && planItem.contentItemId === linkedContentItemId && linkedContentItem);
  const fixtureNotPublished = Boolean(linkedContentItem && !linkedContentItem.publishedAt && linkedContentItem.status !== "published");
  const fixtureNotScheduled = Boolean(linkedContentItem && !linkedContentItem.scheduledAt && linkedContentItem.status !== "scheduled");
  const fixtureHasNoDraftMarkdown = Boolean(linkedContentItem && !linkedContentItem.draftMarkdown?.trim());
  const fixtureHasNoDraftHtml = Boolean(linkedContentItem && !linkedContentItem.draftHtml?.trim());
  const itemGenerationFlagsDisabled = Boolean(
    planItem &&
      !planItem.draftGenerationAllowed &&
      !planItem.llmGenerationAllowed &&
      !planItem.publishExecutionAllowed &&
      !planItem.scheduledPublishAllowed &&
      planItem.requiresHumanApproval
  );

  if (planItem && !planItem.contentItemId) {
    blockingReasons.add("linked_content_fixture_not_found");
  }
  if (planItem && linkedContentItemId && planItem.contentItemId !== linkedContentItemId) {
    blockingReasons.add("linked_content_item_mismatch");
  }
  if (linkedContentItemId && !linkedContentItem) {
    blockingReasons.add("linked_content_fixture_not_found");
  }
  if (linkedContentItem && !fixtureNotPublished) {
    blockingReasons.add("content_item_already_published");
  }
  if (linkedContentItem && !fixtureNotScheduled) {
    blockingReasons.add("content_item_scheduled");
  }
  if (linkedContentItem && (!fixtureHasNoDraftMarkdown || !fixtureHasNoDraftHtml)) {
    blockingReasons.add("draft_already_exists_regeneration_not_approved");
  }

  const readinessStructuralReady =
    request.mode === "preview" &&
    planItemFound &&
    linkedContentItemFound &&
    linkedFixtureMatchesPlanItem &&
    fixtureNotPublished &&
    fixtureNotScheduled &&
    fixtureHasNoDraftMarkdown &&
    fixtureHasNoDraftHtml &&
    itemGenerationFlagsDisabled;

  if (!readinessStructuralReady) {
    blockingReasons.add("draft_generation_readiness_failed");
  }

  const operatorApprovalTablesExist = operatorApprovalTableState.approvalsTableExists && operatorApprovalTableState.eventsTableExists;
  if (!operatorApprovalTablesExist) {
    blockingReasons.add("operator_approval_tables_not_applied");
  }

  const operatorApprovalReadState = await readPersistedOperatorApproval({
    operatorApprovalTablesExist,
    planItemId: request.planItemId,
    contentItemId: linkedContentItemId
  });
  if (!operatorApprovalReadState.readOk) {
    blockingReasons.add("operator_approval_read_failed");
    warnings.add("operator_approval_table_permission_or_read_error");
  }
  const operatorApproval = operatorApprovalReadState.approval;
  const operatorApprovalSatisfied = Boolean(operatorApproval);

  if (!operatorApprovalSatisfied) {
    blockingReasons.add("operator_approval_missing");
  }
  blockingReasons.add("llm_execution_feature_flag_disabled");
  blockingReasons.add("content_mutation_feature_flag_disabled");
  blockingReasons.add("draft_generation_write_feature_flag_disabled");
  blockingReasons.add("confirmation_phrase_missing");
  blockingReasons.add("idempotency_key_missing");

  const publishIsolationSatisfied = Boolean(planItem && !planItem.publishExecutionAllowed && !planItem.scheduledPublishAllowed);
  if (!publishIsolationSatisfied) {
    blockingReasons.add("publish_execution_must_remain_disabled");
    blockingReasons.add("scheduled_publish_must_remain_disabled");
  }

  const canonicalBlockingReasons = Array.from(blockingReasons);
  const summary: DailyContentDraftGenerationExecutionGatePreviewSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    targetPlanId: planItem?.planId ?? null,
    targetPlanItemId: request.planItemId ?? "",
    linkedContentItemId,
    applyAttempted: false,
    generationAttempted: false,
    applyBlocked: true,
    generationBlocked: true,
    applyOk: false,
    generationOk: false,
    targetIntegrity: {
      planItemFound,
      linkedContentItemFound,
      linkedFixtureMatchesPlanItem
    },
    migrationState: {
      operatorApprovalMigrationExpected: OPERATOR_APPROVAL_MIGRATION,
      operatorApprovalTablesExist,
      operatorApprovalPersistenceAvailable: operatorApprovalTablesExist,
      migrationPendingAssumed: !operatorApprovalTablesExist
    },
    executionGateSummary: {
      executionAllowed: false,
      readinessStructuralReady,
      operatorApprovalSatisfied,
      llmProviderGateSatisfied: false,
      contentMutationGateSatisfied: false,
      confirmationSatisfied: false,
      idempotencySatisfied: false,
      publishIsolationSatisfied,
      overallLabelKo: readinessStructuralReady ? "구조 준비 완료, 실행 차단" : "실행 차단"
    },
    gateLayers: buildGateLayers({
      requestMode: request.mode,
      planItemFound,
      linkedContentItemFound,
      linkedFixtureMatchesPlanItem,
      fixtureNotPublished,
      fixtureNotScheduled,
      fixtureHasNoDraftMarkdown,
      fixtureHasNoDraftHtml,
      itemGenerationFlagsDisabled,
      readinessStructuralReady,
      operatorApprovalTablesExist,
      operatorApprovalSatisfied,
      publishIsolationSatisfied
    }),
    canonicalBlockingReasons,
    futureApplyRequirements: {
      requiresAppliedOperatorApprovalMigration: true,
      requiresPersistedOperatorApproval: true,
      requiresLlmExecutionFlag: true,
      requiresContentMutationFlag: true,
      requiresDraftGenerationWriteFlag: true,
      requiresConfirmationPhrase: true,
      requiresIdempotencyKey: true,
      requiresBloggerWriteDisabled: true,
      requiresPublishExecutionDisabled: true
    },
    expectedFutureSideEffectsIfApproved: {
      llmCallLogInsert: true,
      contentItemDraftMutation: true,
      bloggerWrite: false,
      publishExecution: false,
      scheduledPublish: false,
      tokenRefresh: false,
      oauthReconnect: false
    },
    guardrailSummary: {
      noBusinessDbWrite: true,
      noContentGeneration: true,
      noLlmCall: true,
      noContentItemMutation: true,
      noDraftMarkdownMutation: true,
      noDraftHtmlMutation: true,
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
      llmCallLogInsert: false,
      contentMutation: false,
      draftMarkdownMutation: false,
      draftHtmlMutation: false,
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
    },
    warnings: Array.from(warnings)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    draftGenerationExecutionGatePreviewSummary: summary
  };
}

async function readOperatorApprovalTableState() {
  const rows = await prisma.$queryRaw<Array<{ operator_approvals_table: string | null; operator_approval_events_table: string | null }>>`
    select
      to_regclass('public.blog_daily_content_operator_approvals')::text as operator_approvals_table,
      to_regclass('public.blog_daily_content_operator_approval_events')::text as operator_approval_events_table
  `;
  const row = rows[0];
  return {
    approvalsTableExists: Boolean(row?.operator_approvals_table),
    eventsTableExists: Boolean(row?.operator_approval_events_table)
  };
}

async function readPersistedOperatorApproval(input: { operatorApprovalTablesExist: boolean; planItemId: string | null; contentItemId: string | null }) {
  if (!input.operatorApprovalTablesExist || !input.planItemId || !input.contentItemId) {
    return {
      readOk: true,
      approval: null
    };
  }

  try {
    const approval = await prisma.blogDailyContentOperatorApproval.findFirst({
      where: {
        planItemId: input.planItemId,
        contentItemId: input.contentItemId,
        approvalPurpose: OPERATOR_APPROVAL_PURPOSE,
        approvalStatus: "approved",
        revokedAt: null
      },
      orderBy: { createdAt: "asc" }
    });
    return {
      readOk: true,
      approval
    };
  } catch {
    return {
      readOk: false,
      approval: null
    };
  }
}

function buildGateLayers(input: {
  requestMode: DraftGenerationExecutionGateMode;
  planItemFound: boolean;
  linkedContentItemFound: boolean;
  linkedFixtureMatchesPlanItem: boolean;
  fixtureNotPublished: boolean;
  fixtureNotScheduled: boolean;
  fixtureHasNoDraftMarkdown: boolean;
  fixtureHasNoDraftHtml: boolean;
  itemGenerationFlagsDisabled: boolean;
  readinessStructuralReady: boolean;
  operatorApprovalTablesExist: boolean;
  operatorApprovalSatisfied: boolean;
  publishIsolationSatisfied: boolean;
}): DailyContentDraftGenerationExecutionGateLayer[] {
  return [
    {
      layer: 0,
      key: "target_integrity_gate",
      labelKo: "대상 무결성",
      status: input.planItemFound && input.linkedContentItemFound && input.linkedFixtureMatchesPlanItem ? "pass" : "blocked",
      blockingReasons: compact([
        input.planItemFound ? null : "target_plan_item_not_found",
        input.linkedContentItemFound ? null : "linked_content_fixture_not_found",
        input.linkedFixtureMatchesPlanItem ? null : "linked_content_item_mismatch"
      ]),
      allowedSideEffects: ["db_read"],
      prohibitedSideEffects: ["db_write", "llm_call", "blogger_write"]
    },
    {
      layer: 1,
      key: "daily_plan_item_link_gate",
      labelKo: "Daily plan item 연결",
      status: input.linkedFixtureMatchesPlanItem && input.fixtureNotPublished && input.fixtureNotScheduled ? "pass" : "blocked",
      blockingReasons: compact([
        input.linkedFixtureMatchesPlanItem ? null : "linked_content_item_mismatch",
        input.fixtureNotPublished ? null : "content_item_already_published",
        input.fixtureNotScheduled ? null : "content_item_scheduled"
      ]),
      allowedSideEffects: ["db_read"],
      prohibitedSideEffects: ["draft_mutation", "publish_mutation", "schedule_mutation"]
    },
    {
      layer: 2,
      key: "draft_generation_readiness_preflight_gate",
      labelKo: "초안 생성 구조 준비",
      status: input.readinessStructuralReady ? "pass" : "blocked",
      blockingReasons: compact([
        input.readinessStructuralReady ? null : "draft_generation_readiness_failed",
        input.fixtureHasNoDraftMarkdown && input.fixtureHasNoDraftHtml ? null : "draft_already_exists_regeneration_not_approved"
      ]),
      allowedSideEffects: ["db_read", "readiness_preview"],
      prohibitedSideEffects: ["llm_call", "draft_write"]
    },
    {
      layer: 3,
      key: "operator_approval_persistence_gate",
      labelKo: "운영자 승인 저장",
      status: input.operatorApprovalTablesExist && input.operatorApprovalSatisfied ? "pass" : "blocked",
      blockingReasons: compact([
        input.operatorApprovalTablesExist ? null : "operator_approval_tables_not_applied",
        input.operatorApprovalSatisfied ? null : "operator_approval_missing"
      ]),
      allowedSideEffects: ["db_read"],
      prohibitedSideEffects: ["approval_mutation", "llm_call", "draft_write"]
    },
    {
      layer: 4,
      key: "llm_provider_model_gate",
      labelKo: "LLM Provider/Model",
      status: "blocked",
      blockingReasons: ["llm_execution_feature_flag_disabled"],
      allowedSideEffects: ["db_read"],
      prohibitedSideEffects: ["llm_call", "draft_write", "blogger_write"]
    },
    {
      layer: 5,
      key: "content_mutation_write_flag_gate",
      labelKo: "content_items 수정 flag",
      status: "blocked",
      blockingReasons: ["content_mutation_feature_flag_disabled", "draft_generation_write_feature_flag_disabled"],
      allowedSideEffects: ["db_read"],
      prohibitedSideEffects: ["llm_call", "content_mutation"]
    },
    {
      layer: 6,
      key: "confirmation_idempotency_gate",
      labelKo: "확인 문구와 idempotency",
      status: "blocked",
      blockingReasons: ["confirmation_phrase_missing", "idempotency_key_missing"],
      allowedSideEffects: ["db_read"],
      prohibitedSideEffects: ["duplicate_llm_call", "duplicate_draft_mutation"]
    },
    {
      layer: 7,
      key: "post_write_readback_gate",
      labelKo: "쓰기 후 readback",
      status: "not_applicable",
      blockingReasons: [],
      allowedSideEffects: ["readback_after_approved_write"],
      prohibitedSideEffects: ["additional_mutation", "publish_mutation"]
    },
    {
      layer: 8,
      key: "publish_isolation_gate",
      labelKo: "발행 격리",
      status: input.publishIsolationSatisfied ? "pass" : "blocked",
      blockingReasons: compact([
        input.publishIsolationSatisfied ? null : "publish_execution_must_remain_disabled",
        input.publishIsolationSatisfied ? null : "scheduled_publish_must_remain_disabled"
      ]),
      allowedSideEffects: ["db_read"],
      prohibitedSideEffects: ["blogger_draft_save", "blogger_publish", "scheduled_publish", "oauth_reconnect", "token_refresh"]
    }
  ];
}

function normalizeRequest(raw: DailyContentDraftGenerationExecutionGatePreviewRequest) {
  const requestedMode = getString(raw.mode);
  return {
    mode: requestedMode === "preview" || !requestedMode ? ("preview" as const) : ("blocked_non_preview" as const),
    requestedMode,
    planItemId: getString(raw.planItemId),
    contentItemId: getString(raw.contentItemId)
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function compact(values: Array<string | null>) {
  return values.filter((value): value is string => Boolean(value));
}
