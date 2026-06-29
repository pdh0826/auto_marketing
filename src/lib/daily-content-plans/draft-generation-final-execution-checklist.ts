import {
  buildDailyContentDraftGenerationDryRunPlannerResponse,
  type DailyContentDraftGenerationDryRunPlannerResponse
} from "@/lib/daily-content-plans/draft-generation-dry-run-planner";
import {
  buildDailyContentDraftGenerationLlmProviderHealthCheckExecutionResponse,
  type DailyContentDraftGenerationLlmProviderHealthCheckExecutionResponse
} from "@/lib/daily-content-plans/draft-generation-llm-provider-health-check-execution";
import {
  buildDailyContentDraftGenerationLlmProviderHealthCheckPreviewResponse,
  type DailyContentDraftGenerationLlmProviderHealthCheckPreviewResponse
} from "@/lib/daily-content-plans/draft-generation-llm-provider-health-check-preview";
import {
  buildDailyContentDraftGenerationLlmProviderReadinessResponse,
  type DailyContentDraftGenerationLlmProviderReadinessResponse
} from "@/lib/daily-content-plans/draft-generation-llm-provider-readiness";

const PATCH_VERSION = "9F-2Q";
const CHECKLIST_MODE = "read_only_draft_generation_final_execution_checklist";

type FinalChecklistMode = "preview" | "blocked_non_preview";
type ChecklistItemStatus = "pass" | "blocked" | "caution";

export interface DailyContentDraftGenerationFinalExecutionChecklistRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationFinalExecutionChecklistResponse {
  checkedAt: string;
  draftGenerationFinalExecutionChecklistSummary: DailyContentDraftGenerationFinalExecutionChecklistSummary;
}

export interface DailyContentDraftGenerationFinalExecutionChecklistSummary {
  patchVersion: "9F-2Q";
  checked: true;
  mode: FinalChecklistMode;
  requestedMode: string;
  checklistMode: typeof CHECKLIST_MODE;
  dryRunOnly: true;
  executionAllowed: false;
  finalDraftGenerationAllowed: false;
  llmCompletionAttempted: false;
  promptRendered: false;
  providerNetworkCallAttempted: false;
  contentMutationAttempted: false;
  bloggerWriteAttempted: false;
  targetSummary: {
    planId: string | null;
    planItemId: string;
    contentItemId: string | null;
    linkedFixtureFound: boolean;
    linkedFixtureMatchesPlanItem: boolean;
    fixtureStatus: string | null;
    fixtureNotPublished: boolean;
    fixtureNotScheduled: boolean;
    fixtureHasNoDraftMarkdown: boolean;
    fixtureHasNoDraftHtml: boolean;
    draftMarkdownLength: number;
    draftHtmlLength: number;
  };
  persistedApprovalSummary: DryRunSummary["persistedApprovalSummary"];
  priorGateSummary: {
    dryRunPlannerAvailable: boolean;
    llmProviderReadinessAvailable: boolean;
    llmProviderHealthCheckPreviewAvailable: boolean;
    llmProviderHealthCheckExecutionGateAvailable: boolean;
    healthCheckExecutedNow: false;
    providerNetworkCallAttemptedNow: false;
  };
  executionGateSummary: DryRunSummary["executionGateSummary"];
  finalChecklistSummary: {
    overallStatus: "not_ready_for_draft_generation_execution";
    readyForLlmCompletion: false;
    readyForContentMutation: false;
    readyForBloggerWrite: false;
    passItems: ChecklistItem[];
    blockedItems: ChecklistItem[];
    cautionItems: ChecklistItem[];
  };
  operatorRunbook: {
    purpose: string;
    thisPatchDoes: string[];
    thisPatchDoesNotDo: string[];
    futureExecutionWouldRequire: string[];
    recommendedNextPatch: "9F-2R — Draft-generation prompt render preview, no LLM/no content mutation";
  };
  currentSideEffectSummary: DailyContentDraftGenerationFinalExecutionChecklistSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface ChecklistItem {
  key: string;
  status: ChecklistItemStatus;
  label: string;
  requiredBeforeExecution?: boolean;
}

export interface DailyContentDraftGenerationFinalExecutionChecklistSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  envRead: true;
  secretValueExposed: false;
  providerHealthChecked: false;
  providerNetworkCall: false;
  promptRendered: false;
  rawPromptStored: false;
  llmCompletion: false;
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

type DryRunSummary = DailyContentDraftGenerationDryRunPlannerResponse["draftGenerationDryRunPlannerSummary"];
type ReadinessSummary = DailyContentDraftGenerationLlmProviderReadinessResponse["draftGenerationLlmProviderReadinessSummary"];
type HealthPreviewSummary = DailyContentDraftGenerationLlmProviderHealthCheckPreviewResponse["draftGenerationLlmProviderHealthCheckPreviewSummary"];
type HealthExecutionSummary = DailyContentDraftGenerationLlmProviderHealthCheckExecutionResponse["draftGenerationLlmProviderHealthCheckExecutionSummary"];

export async function buildDailyContentDraftGenerationFinalExecutionChecklistResponse(
  rawRequest: DailyContentDraftGenerationFinalExecutionChecklistRequest
): Promise<DailyContentDraftGenerationFinalExecutionChecklistResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const [dryRunResponse, readinessResponse, healthPreviewResponse, healthExecutionResponse] = await Promise.all([
    buildDailyContentDraftGenerationDryRunPlannerResponse({
      mode: "preview",
      planId: request.planId,
      planItemId: request.planItemId,
      contentItemId: request.contentItemId
    }),
    buildDailyContentDraftGenerationLlmProviderReadinessResponse({
      mode: "preview",
      planId: request.planId,
      planItemId: request.planItemId,
      contentItemId: request.contentItemId
    }),
    buildDailyContentDraftGenerationLlmProviderHealthCheckPreviewResponse({
      mode: "preview",
      planId: request.planId,
      planItemId: request.planItemId,
      contentItemId: request.contentItemId
    }),
    buildDailyContentDraftGenerationLlmProviderHealthCheckExecutionResponse({
      mode: "preview",
      planId: request.planId,
      planItemId: request.planItemId,
      contentItemId: request.contentItemId
    })
  ]);
  const dryRun = dryRunResponse.draftGenerationDryRunPlannerSummary;
  const readiness = readinessResponse.draftGenerationLlmProviderReadinessSummary;
  const healthPreview = healthPreviewResponse.draftGenerationLlmProviderHealthCheckPreviewSummary;
  const healthExecution = healthExecutionResponse.draftGenerationLlmProviderHealthCheckExecutionSummary;
  const target = buildTargetSummary(dryRun);
  const blockingReasons = new Set<string>(dryRun.executionGateSummary.remainingBlockers);

  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_final_execution_checklist_is_preview_only");
  }

  return {
    checkedAt: checkedAt.toISOString(),
    draftGenerationFinalExecutionChecklistSummary: {
      patchVersion: PATCH_VERSION,
      checked: true,
      mode: request.mode,
      requestedMode: request.requestedMode,
      checklistMode: CHECKLIST_MODE,
      dryRunOnly: true,
      executionAllowed: false,
      finalDraftGenerationAllowed: false,
      llmCompletionAttempted: false,
      promptRendered: false,
      providerNetworkCallAttempted: false,
      contentMutationAttempted: false,
      bloggerWriteAttempted: false,
      targetSummary: target,
      persistedApprovalSummary: dryRun.persistedApprovalSummary,
      priorGateSummary: {
        dryRunPlannerAvailable: dryRun.checked,
        llmProviderReadinessAvailable: readiness.checked,
        llmProviderHealthCheckPreviewAvailable: healthPreview.checked,
        llmProviderHealthCheckExecutionGateAvailable: healthExecution.checked,
        healthCheckExecutedNow: false,
        providerNetworkCallAttemptedNow: false
      },
      executionGateSummary: dryRun.executionGateSummary,
      finalChecklistSummary: buildFinalChecklistSummary({
        target,
        dryRun,
        readiness,
        healthPreview,
        healthExecution
      }),
      operatorRunbook: buildOperatorRunbook(),
      currentSideEffectSummary: buildSideEffectSummary(),
      blockingReasons: Array.from(blockingReasons),
      warnings: buildWarnings({
        requestMode: request.mode,
        readiness,
        healthPreview,
        healthExecution
      })
    }
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationFinalExecutionChecklistRequest): {
  mode: FinalChecklistMode;
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

function buildTargetSummary(dryRun: DryRunSummary): DailyContentDraftGenerationFinalExecutionChecklistSummary["targetSummary"] {
  return {
    planId: dryRun.targetSummary.planId,
    planItemId: dryRun.targetSummary.planItemId,
    contentItemId: dryRun.targetSummary.contentItemId,
    linkedFixtureFound: dryRun.targetSummary.linkedFixtureFound,
    linkedFixtureMatchesPlanItem: dryRun.targetSummary.linkedFixtureMatchesPlanItem,
    fixtureStatus: dryRun.targetSummary.fixtureStatus,
    fixtureNotPublished: dryRun.targetSummary.fixtureNotPublished,
    fixtureNotScheduled: dryRun.targetSummary.fixtureNotScheduled,
    fixtureHasNoDraftMarkdown: dryRun.targetSummary.fixtureHasNoDraftMarkdown,
    fixtureHasNoDraftHtml: dryRun.targetSummary.fixtureHasNoDraftHtml,
    draftMarkdownLength: dryRun.targetSummary.draftMarkdownLength,
    draftHtmlLength: dryRun.targetSummary.draftHtmlLength
  };
}

function buildFinalChecklistSummary(input: {
  target: DailyContentDraftGenerationFinalExecutionChecklistSummary["targetSummary"];
  dryRun: DryRunSummary;
  readiness: ReadinessSummary;
  healthPreview: HealthPreviewSummary;
  healthExecution: HealthExecutionSummary;
}): DailyContentDraftGenerationFinalExecutionChecklistSummary["finalChecklistSummary"] {
  const passItems: ChecklistItem[] = [];

  if (input.target.planId) {
    passItems.push({ key: "daily_content_plan_exists", status: "pass", label: "Daily Content Plan exists" });
  }
  if (input.target.linkedFixtureFound && input.target.linkedFixtureMatchesPlanItem) {
    passItems.push({ key: "linked_fixture_exists", status: "pass", label: "Linked content fixture exists" });
  }
  if (input.target.fixtureHasNoDraftMarkdown && input.target.fixtureHasNoDraftHtml) {
    passItems.push({ key: "linked_fixture_has_no_existing_draft", status: "pass", label: "Linked fixture still has empty draft fields" });
  }
  if (input.dryRun.persistedApprovalSummary.operatorApprovalSatisfied) {
    passItems.push({ key: "operator_approval_persisted", status: "pass", label: "Operator approval is persisted" });
  }
  if (input.readiness.llmProviderReadinessSummary.routeResolutionPlan.selectedRouteResolved) {
    passItems.push({ key: "llm_provider_route_resolved", status: "pass", label: "LLM provider route is resolved" });
  }

  const blockedItems = input.dryRun.executionGateSummary.remainingBlockers.map((blocker) => ({
    key: blocker,
    status: "blocked" as const,
    label: blocker,
    requiredBeforeExecution: true
  }));

  const cautionItems: ChecklistItem[] = [
    {
      key: "provider_health_check_not_executed_in_this_patch",
      status: "caution",
      label: "Provider health-check was not executed by 9F-2Q"
    },
    {
      key: "no_prompt_render_preview_yet",
      status: "caution",
      label: "Prompt full render preview is still deferred"
    },
    {
      key: "health_check_execution_gate_still_blocked",
      status: "caution",
      label: input.healthExecution.healthCheckExecutionSummary.healthCheckExecuted
        ? "Health-check execution result exists from a prior explicit run"
        : "Health-check execution gate remains blocked in this checklist"
    }
  ];

  if (!input.healthPreview.healthCheckPreviewSummary.providerHealthCheckRequiredBeforeExecution) {
    cautionItems.push({
      key: "provider_health_check_requirement_unclear",
      status: "caution",
      label: "Provider health-check requirement could not be confirmed"
    });
  }

  return {
    overallStatus: "not_ready_for_draft_generation_execution",
    readyForLlmCompletion: false,
    readyForContentMutation: false,
    readyForBloggerWrite: false,
    passItems,
    blockedItems,
    cautionItems
  };
}

function buildOperatorRunbook(): DailyContentDraftGenerationFinalExecutionChecklistSummary["operatorRunbook"] {
  return {
    purpose: "Explain final pre-execution checklist before any future draft generation execution patch.",
    thisPatchDoes: [
      "read current plan/item/content fixture state",
      "read persisted approval state",
      "summarize prior gates",
      "show final blockers",
      "show safe next steps"
    ],
    thisPatchDoesNotDo: [
      "render full prompt",
      "call LLM",
      "write llm_call_logs",
      "mutate content_items",
      "write draftMarkdown",
      "write draftHtml",
      "write/publish/schedule Blogger post",
      "refresh OAuth token"
    ],
    futureExecutionWouldRequire: [
      "explicit feature flags",
      "confirmation phrase",
      "idempotency key",
      "separate execution patch",
      "operator-visible final target confirmation",
      "post-execution DB delta verification"
    ],
    recommendedNextPatch: "9F-2R — Draft-generation prompt render preview, no LLM/no content mutation"
  };
}

function buildSideEffectSummary(): DailyContentDraftGenerationFinalExecutionChecklistSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    envRead: true,
    secretValueExposed: false,
    providerHealthChecked: false,
    providerNetworkCall: false,
    promptRendered: false,
    rawPromptStored: false,
    llmCompletion: false,
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

function buildWarnings(input: {
  requestMode: FinalChecklistMode;
  readiness: ReadinessSummary;
  healthPreview: HealthPreviewSummary;
  healthExecution: HealthExecutionSummary;
}) {
  const warnings = new Set<string>([
    "draft_generation_final_checklist_preview_only",
    "draft_generation_execution_still_blocked",
    "provider_network_call_not_attempted",
    "prompt_rendering_disabled_by_patch_policy",
    "llm_completion_disabled_by_patch_policy",
    "content_item_mutation_disabled",
    "blogger_write_disabled"
  ]);

  if (input.requestMode !== "preview") {
    warnings.add("non_preview_mode_blocked");
  }
  for (const warning of input.readiness.llmProviderReadinessSummary.readinessWarnings) {
    warnings.add(warning);
  }
  for (const warning of input.healthPreview.healthCheckPreviewSummary.healthCheckWarnings) {
    warnings.add(warning);
  }
  for (const warning of input.healthExecution.warnings) {
    warnings.add(warning);
  }
  return Array.from(warnings);
}
