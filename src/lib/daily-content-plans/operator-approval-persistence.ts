import { prisma } from "@/lib/db/client";

const PATCH_VERSION = "9F-2K";

export const DAILY_CONTENT_OPERATOR_APPROVAL_PURPOSE = "draft_generation_execution";
export const DAILY_CONTENT_OPERATOR_ACTION = "approve_for_draft_generation_execution";
export const DAILY_CONTENT_OPERATOR_LABEL = "초안 생성 실행 승인";
export const DAILY_CONTENT_OPERATOR_APPROVAL_CONFIRMATION_PHRASE = "I_UNDERSTAND_THIS_WILL_PERSIST_OPERATOR_APPROVAL_ONLY";
export const DAILY_CONTENT_OPERATOR_APPROVAL_WRITE_FLAG = "BLOG_DAILY_CONTENT_OPERATOR_APPROVAL_WRITE_ENABLED";

type OperatorApprovalPersistenceMode = "preview" | "apply";

export interface DailyContentOperatorApprovalPersistenceRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
  approvalPurpose?: unknown;
  operatorAction?: unknown;
  operatorNoteRedacted?: unknown;
  idempotencyKey?: unknown;
  confirmOperatorApprovalWrite?: unknown;
}

export interface DailyContentOperatorApprovalPersistenceResponse {
  checkedAt: string;
  operatorApprovalPersistenceSummary: DailyContentOperatorApprovalPersistenceSummary;
}

export interface DailyContentOperatorApprovalPersistenceSummary {
  patchVersion: "9F-2K";
  checked: true;
  mode: OperatorApprovalPersistenceMode;
  requestedMode: string | null;
  targetPlanId: string;
  targetPlanItemId: string;
  targetContentItemId: string;
  approvalPurpose: typeof DAILY_CONTENT_OPERATOR_APPROVAL_PURPOSE;
  operatorAction: typeof DAILY_CONTENT_OPERATOR_ACTION;
  operatorLabel: typeof DAILY_CONTENT_OPERATOR_LABEL;
  targetIntegrity: {
    planFound: boolean;
    planItemFound: boolean;
    contentItemFound: boolean;
    planItemBelongsToPlan: boolean;
    contentItemMatchesPlanItem: boolean;
    contentItemNotPublished: boolean;
    contentItemNotScheduled: boolean;
    contentItemHasNoDraftMarkdown: boolean;
    contentItemHasNoDraftHtml: boolean;
  };
  existingApprovalFound: boolean;
  existingApprovalId: string | null;
  existingEventCount: number;
  approvalWouldBeCreated: boolean;
  eventWouldBeCreated: boolean;
  featureFlagEnabled: boolean;
  confirmationPhraseAccepted: boolean;
  idempotencyKeyAccepted: boolean;
  applyAttempted: boolean;
  applyBlocked: boolean;
  applyOk: boolean;
  appliedApprovalId: string | null;
  appliedEventId: string | null;
  createdApproval: boolean;
  createdEvent: boolean;
  blockingReasons: string[];
  warnings: string[];
  persistedApprovalSummary: null | {
    id: string;
    approvalPurpose: string;
    approvalStatus: string;
    operatorAction: string | null;
    operatorLabel: string | null;
    planItemId: string;
    contentItemId: string;
    approvedAt: string | null;
    idempotencyKey: string;
  };
  persistedEventSummary: null | {
    id: string;
    approvalId: string;
    eventType: string;
    toStatus: string;
    idempotencyKey: string;
  };
  guardrailSummary: {
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
    dbWrite: boolean;
    approvalMutation: boolean;
    approvalEventMutation: boolean;
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
    publishApprovalMutation: false;
    publishAttemptMutation: false;
    externalSend: false;
  };
}

export function buildDailyContentOperatorApprovalIdempotencyKey(planItemId: string, contentItemId: string) {
  return `9F-2K:draft_generation_execution:${planItemId}:${contentItemId}`;
}

export async function buildDailyContentOperatorApprovalPersistenceResponse(
  rawRequest: DailyContentOperatorApprovalPersistenceRequest
): Promise<DailyContentOperatorApprovalPersistenceResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const warnings = new Set<string>([
    "operator_approval_persistence_guarded",
    "approval_row_only",
    "approval_event_row_only",
    "draft_generation_not_executed",
    "llm_call_disabled",
    "content_item_mutation_disabled",
    "blogger_write_disabled"
  ]);
  const blockingReasons = new Set<string>();
  const expectedIdempotencyKey =
    request.planItemId && request.contentItemId ? buildDailyContentOperatorApprovalIdempotencyKey(request.planItemId, request.contentItemId) : null;
  const eventIdempotencyKey = request.idempotencyKey ? `${request.idempotencyKey}:event:approval_created` : null;

  if (!request.planId) {
    blockingReasons.add("daily_content_plan_id_missing");
  }
  if (!request.planItemId) {
    blockingReasons.add("daily_content_plan_item_id_missing");
  }
  if (!request.contentItemId) {
    blockingReasons.add("content_item_id_missing");
  }
  if (request.approvalPurpose !== DAILY_CONTENT_OPERATOR_APPROVAL_PURPOSE) {
    blockingReasons.add("approval_purpose_not_supported");
  }
  if (request.operatorAction !== DAILY_CONTENT_OPERATOR_ACTION) {
    blockingReasons.add("operator_action_not_supported");
  }
  if (request.idempotencyKey && expectedIdempotencyKey && request.idempotencyKey !== expectedIdempotencyKey) {
    blockingReasons.add("idempotency_key_mismatch");
  }

  const [plan, planItem, contentItem] = await Promise.all([
    request.planId
      ? prisma.blogDailyContentPlan.findUnique({
          where: { id: request.planId },
          select: {
            id: true,
            defaultPublishPolicyPreset: true,
            operationMode: true
          }
        })
      : null,
    request.planItemId
      ? prisma.blogDailyContentPlanItem.findUnique({
          where: { id: request.planItemId },
          select: {
            id: true,
            planId: true,
            contentItemId: true,
            requiresHumanApproval: true,
            draftGenerationAllowed: true,
            llmGenerationAllowed: true,
            publishExecutionAllowed: true,
            scheduledPublishAllowed: true
          }
        })
      : null,
    request.contentItemId
      ? prisma.contentItem.findUnique({
          where: { id: request.contentItemId },
          select: {
            id: true,
            status: true,
            draftMarkdown: true,
            draftHtml: true,
            publishedAt: true,
            scheduledAt: true
          }
        })
      : null
  ]);

  const planFound = Boolean(plan);
  const planItemFound = Boolean(planItem);
  const contentItemFound = Boolean(contentItem);
  const planItemBelongsToPlan = Boolean(planItem && request.planId && planItem.planId === request.planId);
  const contentItemMatchesPlanItem = Boolean(planItem && request.contentItemId && planItem.contentItemId === request.contentItemId);
  const contentItemNotPublished = Boolean(contentItem && !contentItem.publishedAt && contentItem.status !== "published");
  const contentItemNotScheduled = Boolean(contentItem && !contentItem.scheduledAt && contentItem.status !== "scheduled");
  const contentItemHasNoDraftMarkdown = Boolean(contentItem && !contentItem.draftMarkdown?.trim());
  const contentItemHasNoDraftHtml = Boolean(contentItem && !contentItem.draftHtml?.trim());
  const planItemGuardrailsSafe = Boolean(
    planItem &&
      planItem.requiresHumanApproval &&
      !planItem.draftGenerationAllowed &&
      !planItem.llmGenerationAllowed &&
      !planItem.publishExecutionAllowed &&
      !planItem.scheduledPublishAllowed
  );

  if (!planFound) {
    blockingReasons.add("daily_content_plan_not_found");
  }
  if (!planItemFound) {
    blockingReasons.add("daily_content_plan_item_not_found");
  }
  if (!contentItemFound) {
    blockingReasons.add("content_item_not_found");
  }
  if (planItem && !planItemBelongsToPlan) {
    blockingReasons.add("daily_content_plan_item_plan_mismatch");
  }
  if (planItem && !contentItemMatchesPlanItem) {
    blockingReasons.add("content_item_not_linked_to_plan_item");
  }
  if (contentItem && !contentItemNotPublished) {
    blockingReasons.add("content_item_already_published");
  }
  if (contentItem && !contentItemNotScheduled) {
    blockingReasons.add("content_item_scheduled");
  }
  if (contentItem && !contentItemHasNoDraftMarkdown) {
    blockingReasons.add("draft_markdown_already_exists");
  }
  if (contentItem && !contentItemHasNoDraftHtml) {
    blockingReasons.add("draft_html_already_exists");
  }
  if (planItem && !planItemGuardrailsSafe) {
    blockingReasons.add("daily_plan_item_generation_guardrails_not_safe");
  }

  const existingApprovalState = await readExistingApprovalState({
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId,
    idempotencyKey: request.idempotencyKey,
    eventIdempotencyKey
  });
  if (!existingApprovalState.readOk) {
    blockingReasons.add("operator_approval_read_failed");
    warnings.add("operator_approval_table_permission_or_read_error");
  }
  const existingApproval = existingApprovalState.approval;
  const existingEventCount = existingApprovalState.eventCount;
  const existingEvent = existingApprovalState.event;

  const featureFlagEnabled = process.env[DAILY_CONTENT_OPERATOR_APPROVAL_WRITE_FLAG] === "true";
  const confirmationPhraseAccepted = request.confirmOperatorApprovalWrite === DAILY_CONTENT_OPERATOR_APPROVAL_CONFIRMATION_PHRASE;
  const idempotencyKeyAccepted = Boolean(request.idempotencyKey && expectedIdempotencyKey && request.idempotencyKey === expectedIdempotencyKey);

  if (request.mode === "apply") {
    if (!featureFlagEnabled) {
      blockingReasons.add("operator_approval_write_feature_flag_disabled");
    }
    if (!confirmationPhraseAccepted) {
      blockingReasons.add("confirmation_phrase_missing_or_invalid");
    }
    if (!idempotencyKeyAccepted) {
      blockingReasons.add(request.idempotencyKey ? "idempotency_key_mismatch" : "idempotency_key_missing");
    }
  }

  const applyBlocked = request.mode === "apply" && blockingReasons.size > 0;
  const applyCanProceed = request.mode === "apply" && !applyBlocked;
  const approvalWouldBeCreated = !existingApproval;
  const eventWouldBeCreated = Boolean(!existingEvent && (existingApproval || approvalWouldBeCreated));

  let appliedApproval = existingApproval;
  let appliedEvent = existingEvent;
  let createdApproval = false;
  let createdEvent = false;

  if (applyCanProceed && request.idempotencyKey && eventIdempotencyKey && request.planId && request.planItemId && request.contentItemId) {
    const approvalIdempotencyKey = request.idempotencyKey;
    const targetPlanId = request.planId;
    const targetPlanItemId = request.planItemId;
    const targetContentItemId = request.contentItemId;

    const result = await prisma.$transaction(async (tx) => {
      let approval = await tx.blogDailyContentOperatorApproval.findUnique({
        where: { idempotencyKey: approvalIdempotencyKey }
      });
      let approvalCreated = false;

      if (!approval) {
        approval = await tx.blogDailyContentOperatorApproval.findFirst({
          where: {
            planId: targetPlanId,
            planItemId: targetPlanItemId,
            contentItemId: targetContentItemId,
            approvalPurpose: DAILY_CONTENT_OPERATOR_APPROVAL_PURPOSE,
            approvalStatus: "approved"
          },
          orderBy: { createdAt: "asc" }
        });
      }

      if (!approval) {
        approval = await tx.blogDailyContentOperatorApproval.create({
          data: {
            planId: request.planId!,
            planItemId: request.planItemId!,
            contentItemId: request.contentItemId!,
            approvalPurpose: DAILY_CONTENT_OPERATOR_APPROVAL_PURPOSE,
            approvalStatus: "approved",
            operatorAction: DAILY_CONTENT_OPERATOR_ACTION,
            operatorLabel: DAILY_CONTENT_OPERATOR_LABEL,
            operatorNoteRedacted: request.operatorNoteRedacted,
            riskAcknowledged: true,
            externalWriteRiskAcknowledged: false,
            llmExecutionAcknowledged: true,
            contentMutationAcknowledged: true,
            bloggerWriteAcknowledged: false,
            approvalPolicyPreset: plan?.defaultPublishPolicyPreset ?? "safe_manual_publish",
            operationMode: plan?.operationMode ?? "approval_required",
            guardrailSnapshotJson: buildGuardrailSnapshot(),
            readinessSnapshotJson: buildReadinessSnapshot(),
            sideEffectExpectationJson: buildSideEffectExpectation(),
            approvedAt: checkedAt,
            idempotencyKey: approvalIdempotencyKey
          }
        });
        approvalCreated = true;
      }

      let event = await tx.blogDailyContentOperatorApprovalEvent.findUnique({
        where: { idempotencyKey: eventIdempotencyKey }
      });
      let eventCreated = false;

      if (!event) {
        event = await tx.blogDailyContentOperatorApprovalEvent.create({
          data: {
            approvalId: approval.id,
            planId: approval.planId,
            planItemId: approval.planItemId,
            contentItemId: approval.contentItemId,
            eventType: "approval_created",
            fromStatus: null,
            toStatus: "approved",
            operatorAction: DAILY_CONTENT_OPERATOR_ACTION,
            operatorNoteRedacted: request.operatorNoteRedacted,
            requestId: approvalIdempotencyKey,
            idempotencyKey: eventIdempotencyKey,
            guardrailSnapshotJson: buildGuardrailSnapshot(),
            readinessSnapshotJson: buildReadinessSnapshot(),
            sideEffectExpectationJson: buildSideEffectExpectation()
          }
        });
        eventCreated = true;
      }

      return { approval, approvalCreated, event, eventCreated };
    });

    appliedApproval = result.approval;
    appliedEvent = result.event;
    createdApproval = result.approvalCreated;
    createdEvent = result.eventCreated;
  }

  const applyAttempted = applyCanProceed;
  const applyOk = Boolean(applyAttempted && appliedApproval && appliedEvent);
  const summary: DailyContentOperatorApprovalPersistenceSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    targetPlanId: request.planId ?? "",
    targetPlanItemId: request.planItemId ?? "",
    targetContentItemId: request.contentItemId ?? "",
    approvalPurpose: DAILY_CONTENT_OPERATOR_APPROVAL_PURPOSE,
    operatorAction: DAILY_CONTENT_OPERATOR_ACTION,
    operatorLabel: DAILY_CONTENT_OPERATOR_LABEL,
    targetIntegrity: {
      planFound,
      planItemFound,
      contentItemFound,
      planItemBelongsToPlan,
      contentItemMatchesPlanItem,
      contentItemNotPublished,
      contentItemNotScheduled,
      contentItemHasNoDraftMarkdown,
      contentItemHasNoDraftHtml
    },
    existingApprovalFound: Boolean(existingApproval),
    existingApprovalId: existingApproval?.id ?? null,
    existingEventCount,
    approvalWouldBeCreated,
    eventWouldBeCreated,
    featureFlagEnabled,
    confirmationPhraseAccepted,
    idempotencyKeyAccepted,
    applyAttempted,
    applyBlocked: request.mode === "apply" && !applyOk,
    applyOk,
    appliedApprovalId: applyOk ? appliedApproval?.id ?? null : null,
    appliedEventId: applyOk ? appliedEvent?.id ?? null : null,
    createdApproval,
    createdEvent,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings),
    persistedApprovalSummary: appliedApproval ? summarizeApproval(appliedApproval) : null,
    persistedEventSummary: appliedEvent ? summarizeEvent(appliedEvent) : null,
    guardrailSummary: buildGuardrailSummary(),
    sideEffectSummary: {
      dbRead: true,
      dbWrite: applyOk && (createdApproval || createdEvent),
      approvalMutation: applyOk && createdApproval,
      approvalEventMutation: applyOk && createdEvent,
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
      publishApprovalMutation: false,
      publishAttemptMutation: false,
      externalSend: false
    }
  };

  return {
    checkedAt: checkedAt.toISOString(),
    operatorApprovalPersistenceSummary: summary
  };
}

async function readExistingApproval(input: { planId: string | null; planItemId: string | null; contentItemId: string | null; idempotencyKey: string | null }) {
  if (input.idempotencyKey) {
    const byIdempotencyKey = await prisma.blogDailyContentOperatorApproval.findUnique({
      where: { idempotencyKey: input.idempotencyKey }
    });
    if (byIdempotencyKey) {
      return byIdempotencyKey;
    }
  }

  if (!input.planId || !input.planItemId || !input.contentItemId) {
    return null;
  }

  return prisma.blogDailyContentOperatorApproval.findFirst({
    where: {
      planId: input.planId,
      planItemId: input.planItemId,
      contentItemId: input.contentItemId,
      approvalPurpose: DAILY_CONTENT_OPERATOR_APPROVAL_PURPOSE,
      approvalStatus: "approved"
    },
    orderBy: { createdAt: "asc" }
  });
}

async function readExistingApprovalState(input: {
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
  idempotencyKey: string | null;
  eventIdempotencyKey: string | null;
}) {
  try {
    const approval = await readExistingApproval(input);
    const eventCount = approval
      ? await prisma.blogDailyContentOperatorApprovalEvent.count({
          where: { approvalId: approval.id }
        })
      : 0;
    const event = input.eventIdempotencyKey
      ? await prisma.blogDailyContentOperatorApprovalEvent.findUnique({
          where: { idempotencyKey: input.eventIdempotencyKey }
        })
      : null;

    return {
      readOk: true,
      approval,
      eventCount,
      event
    };
  } catch {
    return {
      readOk: false,
      approval: null,
      eventCount: 0,
      event: null
    };
  }
}

function normalizeRequest(raw: DailyContentOperatorApprovalPersistenceRequest) {
  const requestedMode = getString(raw.mode);
  const planItemId = getString(raw.planItemId);
  const contentItemId = getString(raw.contentItemId);
  const operatorNoteRedacted = getString(raw.operatorNoteRedacted);

  return {
    mode: requestedMode === "apply" ? ("apply" as const) : ("preview" as const),
    requestedMode,
    planId: getString(raw.planId),
    planItemId,
    contentItemId,
    approvalPurpose: getString(raw.approvalPurpose) ?? DAILY_CONTENT_OPERATOR_APPROVAL_PURPOSE,
    operatorAction: getString(raw.operatorAction) ?? DAILY_CONTENT_OPERATOR_ACTION,
    operatorNoteRedacted: operatorNoteRedacted ? operatorNoteRedacted.slice(0, 500) : null,
    idempotencyKey: getString(raw.idempotencyKey),
    confirmOperatorApprovalWrite: getString(raw.confirmOperatorApprovalWrite)
  };
}

function summarizeApproval(approval: {
  id: string;
  approvalPurpose: string;
  approvalStatus: string;
  operatorAction: string | null;
  operatorLabel: string | null;
  planItemId: string;
  contentItemId: string;
  approvedAt: Date | null;
  idempotencyKey: string;
}) {
  return {
    id: approval.id,
    approvalPurpose: approval.approvalPurpose,
    approvalStatus: approval.approvalStatus,
    operatorAction: approval.operatorAction,
    operatorLabel: approval.operatorLabel,
    planItemId: approval.planItemId,
    contentItemId: approval.contentItemId,
    approvedAt: approval.approvedAt?.toISOString() ?? null,
    idempotencyKey: approval.idempotencyKey
  };
}

function summarizeEvent(event: { id: string; approvalId: string; eventType: string; toStatus: string; idempotencyKey: string }) {
  return {
    id: event.id,
    approvalId: event.approvalId,
    eventType: event.eventType,
    toStatus: event.toStatus,
    idempotencyKey: event.idempotencyKey
  };
}

function buildGuardrailSummary() {
  return {
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
  } as const;
}

function buildGuardrailSnapshot() {
  return {
    patchVersion: PATCH_VERSION,
    noContentGeneration: true,
    noLlmCall: true,
    noContentItemMutation: true,
    noDraftMarkdownMutation: true,
    noDraftHtmlMutation: true,
    noBloggerWrite: true,
    noPublishExecution: true,
    noScheduledPublish: true,
    noOAuthReconnect: true,
    noTokenRefresh: true
  };
}

function buildReadinessSnapshot() {
  return {
    patchVersion: PATCH_VERSION,
    approvalPurpose: DAILY_CONTENT_OPERATOR_APPROVAL_PURPOSE,
    operatorAction: DAILY_CONTENT_OPERATOR_ACTION,
    approvalRowOnly: true,
    approvalEventRowOnly: true,
    draftGenerationExecutionStillDisabled: true
  };
}

function buildSideEffectExpectation() {
  return {
    dbWrite: true,
    approvalMutation: true,
    approvalEventMutation: true,
    contentGeneration: false,
    llmCall: false,
    contentMutation: false,
    draftMarkdownMutation: false,
    draftHtmlMutation: false,
    bloggerWrite: false,
    bloggerPublish: false,
    tokenRefresh: false,
    oauthReconnect: false
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
