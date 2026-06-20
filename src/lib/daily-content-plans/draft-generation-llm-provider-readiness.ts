import type { LlmProviderType } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { buildDailyContentDraftGenerationExecutionGatePreviewResponse } from "@/lib/daily-content-plans/draft-generation-execution-gate-preview";

const PATCH_VERSION = "9F-2N";
const READINESS_MODE = "read_only_llm_provider_execution_readiness";
const DRAFT_GENERATION_TASK_TYPE = "content_draft";
const DAILY_DRAFT_TASK_NAME = "daily_content_draft_generation";
const OPERATOR_APPROVAL_PURPOSE = "draft_generation_execution";
const OPERATOR_APPROVAL_ACTION = "approve_for_draft_generation_execution";

type LlmProviderReadinessMode = "preview" | "blocked_non_preview";

export interface DailyContentDraftGenerationLlmProviderReadinessRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationLlmProviderReadinessResponse {
  checkedAt: string;
  draftGenerationLlmProviderReadinessSummary: DailyContentDraftGenerationLlmProviderReadinessSummary;
}

export interface DailyContentDraftGenerationLlmProviderReadinessSummary {
  patchVersion: "9F-2N";
  checked: true;
  mode: LlmProviderReadinessMode;
  requestedMode: string | null;
  readinessMode: typeof READINESS_MODE;
  dryRunOnly: true;
  llmCallAttempted: false;
  providerHealthChecked: false;
  providerNetworkCallAttempted: false;
  targetSummary: {
    planId: string | null;
    planItemId: string;
    contentItemId: string | null;
    linkedFixtureFound: boolean;
    linkedFixtureMatchesPlanItem: boolean;
    fixtureStatus: string | null;
    fixtureHasNoDraftMarkdown: boolean;
    fixtureHasNoDraftHtml: boolean;
  };
  persistedApprovalSummary: {
    operatorApprovalPersisted: boolean;
    operatorApprovalSatisfied: boolean;
    approvalId: string | null;
    approvalPurpose: string | null;
    approvalStatus: string | null;
    operatorAction: string | null;
  };
  executionGateSummary: {
    executionAllowed: false;
    remainingBlockers: string[];
    resolvedBlockers: string[];
  };
  llmProviderReadinessSummary: {
    readinessAllowed: false;
    readinessLevel: "static_config_preview_only";
    taskName: typeof DAILY_DRAFT_TASK_NAME;
    taskPurpose: typeof OPERATOR_APPROVAL_PURPOSE;
    routeResolutionPlan: {
      routeLookupAttempted: true;
      routeLookupSource: "existing_content_draft_task_route";
      selectedRouteResolved: boolean;
      selectedProviderKey: string | null;
      selectedModelKey: string | null;
      selectedModelDisplayName: string | null;
      fallbackRouteAvailable: boolean;
      routeResolutionDeferredReason: string | null;
    };
    providerConfigPlan: {
      providerConfigLookupAttempted: true;
      providerConfigFound: boolean;
      providerKind: LlmProviderType | "unknown" | null;
      providerEnabledForDraftGeneration: boolean;
      providerHealthCheckRequiredBeforeExecution: true;
      providerHealthCheckedNow: false;
      providerNetworkCallAttemptedNow: false;
    };
    modelConfigPlan: {
      modelConfigLookupAttempted: true;
      modelConfigFound: boolean;
      modelCandidateResolved: boolean;
      modelExecutionDeferred: true;
      modelTokenBudgetKnown: boolean;
      modelTemperatureKnown: boolean;
      modelRole: "draft_generation";
      modelSelectionReason: string | null;
    };
    secretAndEnvReadiness: {
      envPresenceChecked: true;
      rawSecretValueExposed: false;
      dbSecretMetadataPresent: boolean;
      providerSecretRefPresent: boolean;
      requiredEnvVars: Array<{
        name: string;
        present: boolean;
        valueExposed: false;
      }>;
      missingRequiredEnvVars: string[];
      optionalEnvVars: string[];
    };
    readinessBlockers: string[];
    readinessWarnings: string[];
    nextExecutionPrerequisites: {
      requiresLlmExecutionFeatureFlag: true;
      requiresProviderHealthCheckPatch: true;
      requiresConfirmationPhrase: true;
      requiresIdempotencyKey: true;
      requiresContentMutationFeatureFlag: true;
      requiresDraftGenerationWriteFeatureFlag: true;
      requiresSeparateExecutionPatch: true;
    };
    currentSideEffectSummary: DailyContentDraftGenerationLlmProviderReadinessSideEffectSummary;
  };
  blockingReasons: string[];
  warnings: string[];
}

export interface DailyContentDraftGenerationLlmProviderReadinessSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  envRead: true;
  secretValueExposed: false;
  providerHealthChecked: false;
  providerNetworkCall: false;
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

export async function buildDailyContentDraftGenerationLlmProviderReadinessResponse(
  rawRequest: DailyContentDraftGenerationLlmProviderReadinessRequest
): Promise<DailyContentDraftGenerationLlmProviderReadinessResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const blockingReasons = new Set<string>();
  const warnings = new Set<string>([
    "llm_provider_readiness_preview_only",
    "provider_health_check_skipped_by_design",
    "llm_call_disabled_by_patch_policy",
    "content_item_mutation_disabled",
    "blogger_write_disabled"
  ]);

  if (!request.planItemId) {
    blockingReasons.add("daily_content_plan_item_id_missing");
  }
  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_llm_provider_readiness_is_preview_only");
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
          draftHtml: true
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

  const [gateResponse, route] = await Promise.all([
    buildDailyContentDraftGenerationExecutionGatePreviewResponse({
      mode: "preview",
      planItemId: request.planItemId,
      contentItemId: linkedContentItemId
    }),
    prisma.llmTaskRoute.findUnique({
      where: { taskType: DRAFT_GENERATION_TASK_TYPE },
      include: {
        primaryProvider: {
          include: {
            secrets: {
              select: {
                secretKind: true
              }
            }
          }
        },
        primaryModel: true,
        fallbackProvider: true,
        fallbackModel: true
      }
    })
  ]);

  const gateSummary = gateResponse.draftGenerationExecutionGatePreviewSummary;
  for (const blocker of gateSummary.executionBlockerSummary.remainingBlockers) {
    blockingReasons.add(blocker);
  }

  const selectedRouteResolved = Boolean(route?.isEnabled && route.primaryProvider && route.primaryModel);
  const primaryProvider = route?.primaryProvider ?? null;
  const primaryModel = route?.primaryModel ?? null;
  const dbSecretMetadataPresent = Boolean(primaryProvider?.secrets?.length || primaryProvider?.apiKeyLast4);
  const providerSecretRefPresent = Boolean(primaryProvider?.secretRef);
  const requiredEnvVars = getRequiredEnvVars(primaryProvider, dbSecretMetadataPresent || providerSecretRefPresent);
  const missingRequiredEnvVars = requiredEnvVars.filter((envVar) => !envVar.present).map((envVar) => envVar.name);
  const readinessBlockers = buildReadinessBlockers({
    selectedRouteResolved,
    routeEnabled: Boolean(route?.isEnabled),
    providerFound: Boolean(primaryProvider),
    providerEnabled: Boolean(primaryProvider?.isEnabled),
    modelFound: Boolean(primaryModel),
    modelEnabled: Boolean(primaryModel?.isEnabled),
    missingRequiredEnvVars
  });
  const readinessWarnings = buildReadinessWarnings({
    routeFound: Boolean(route),
    selectedRouteResolved,
    routeHasMaxTokens: route?.maxTokens !== null && route?.maxTokens !== undefined,
    routeHasTemperature: route?.temperature !== null && route?.temperature !== undefined,
    providerLastTestStatus: primaryProvider?.lastTestStatus ?? null
  });

  for (const blocker of readinessBlockers) {
    blockingReasons.add(blocker);
  }

  return {
    checkedAt: checkedAt.toISOString(),
    draftGenerationLlmProviderReadinessSummary: {
      patchVersion: PATCH_VERSION,
      checked: true,
      mode: request.mode,
      requestedMode: request.requestedMode,
      readinessMode: READINESS_MODE,
      dryRunOnly: true,
      llmCallAttempted: false,
      providerHealthChecked: false,
      providerNetworkCallAttempted: false,
      targetSummary: {
        planId: planItem?.planId ?? request.planId,
        planItemId: request.planItemId ?? "",
        contentItemId: linkedContentItemId,
        linkedFixtureFound: Boolean(fixture),
        linkedFixtureMatchesPlanItem: Boolean(planItem && fixture && linkedContentItemId && planItem.contentItemId === linkedContentItemId),
        fixtureStatus: fixture?.status ?? null,
        fixtureHasNoDraftMarkdown: Boolean(fixture && !fixture.draftMarkdown?.trim()),
        fixtureHasNoDraftHtml: Boolean(fixture && !fixture.draftHtml?.trim())
      },
      persistedApprovalSummary: {
        operatorApprovalPersisted: gateSummary.postApprovalState.operatorApprovalPersisted,
        operatorApprovalSatisfied: gateSummary.postApprovalState.operatorApprovalSatisfied,
        approvalId: gateSummary.postApprovalState.operatorApprovalId,
        approvalPurpose: gateSummary.postApprovalState.operatorApprovalPurpose ?? OPERATOR_APPROVAL_PURPOSE,
        approvalStatus: gateSummary.postApprovalState.operatorApprovalStatus,
        operatorAction: gateSummary.postApprovalState.operatorApprovalAction ?? OPERATOR_APPROVAL_ACTION
      },
      executionGateSummary: {
        executionAllowed: false,
        remainingBlockers: gateSummary.executionBlockerSummary.remainingBlockers,
        resolvedBlockers: gateSummary.executionBlockerSummary.resolvedBlockers
      },
      llmProviderReadinessSummary: {
        readinessAllowed: false,
        readinessLevel: "static_config_preview_only",
        taskName: DAILY_DRAFT_TASK_NAME,
        taskPurpose: OPERATOR_APPROVAL_PURPOSE,
        routeResolutionPlan: {
          routeLookupAttempted: true,
          routeLookupSource: "existing_content_draft_task_route",
          selectedRouteResolved,
          selectedProviderKey: primaryProvider?.id ?? null,
          selectedModelKey: primaryModel?.id ?? null,
          selectedModelDisplayName: primaryModel?.displayName ?? primaryModel?.name ?? null,
          fallbackRouteAvailable: Boolean(route?.fallbackProvider && route.fallbackModel),
          routeResolutionDeferredReason: selectedRouteResolved ? null : "content_draft_route_not_ready_for_execution"
        },
        providerConfigPlan: {
          providerConfigLookupAttempted: true,
          providerConfigFound: Boolean(primaryProvider),
          providerKind: primaryProvider?.providerType ?? null,
          providerEnabledForDraftGeneration: Boolean(primaryProvider?.isEnabled),
          providerHealthCheckRequiredBeforeExecution: true,
          providerHealthCheckedNow: false,
          providerNetworkCallAttemptedNow: false
        },
        modelConfigPlan: {
          modelConfigLookupAttempted: true,
          modelConfigFound: Boolean(primaryModel),
          modelCandidateResolved: Boolean(primaryModel?.isEnabled),
          modelExecutionDeferred: true,
          modelTokenBudgetKnown: route?.maxTokens !== null && route?.maxTokens !== undefined,
          modelTemperatureKnown: route?.temperature !== null && route?.temperature !== undefined,
          modelRole: "draft_generation",
          modelSelectionReason: selectedRouteResolved ? "content_draft task route primary model" : null
        },
        secretAndEnvReadiness: {
          envPresenceChecked: true,
          rawSecretValueExposed: false,
          dbSecretMetadataPresent,
          providerSecretRefPresent,
          requiredEnvVars,
          missingRequiredEnvVars,
          optionalEnvVars: ["OPENAI_API_KEY", "LOCAL_LLM_BASE_URL"]
        },
        readinessBlockers,
        readinessWarnings,
        nextExecutionPrerequisites: {
          requiresLlmExecutionFeatureFlag: true,
          requiresProviderHealthCheckPatch: true,
          requiresConfirmationPhrase: true,
          requiresIdempotencyKey: true,
          requiresContentMutationFeatureFlag: true,
          requiresDraftGenerationWriteFeatureFlag: true,
          requiresSeparateExecutionPatch: true
        },
        currentSideEffectSummary: buildSideEffectSummary()
      },
      blockingReasons: Array.from(blockingReasons),
      warnings: Array.from(warnings)
    }
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmProviderReadinessRequest): {
  mode: LlmProviderReadinessMode;
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

function getRequiredEnvVars(
  provider: {
    providerType: LlmProviderType;
    baseUrl: string | null;
  } | null,
  hasDbSecretOrRef: boolean
) {
  if (!provider) {
    return [];
  }
  const required: string[] = [];
  if ((provider.providerType === "openai" || provider.providerType === "external_http") && !hasDbSecretOrRef) {
    required.push("OPENAI_API_KEY");
  }
  if ((provider.providerType === "local" || provider.providerType === "local_http") && !provider.baseUrl) {
    required.push("LOCAL_LLM_BASE_URL");
  }
  return required.map((name) => ({
    name,
    present: Boolean(process.env[name]),
    valueExposed: false as const
  }));
}

function buildReadinessBlockers(input: {
  selectedRouteResolved: boolean;
  routeEnabled: boolean;
  providerFound: boolean;
  providerEnabled: boolean;
  modelFound: boolean;
  modelEnabled: boolean;
  missingRequiredEnvVars: string[];
}) {
  const blockers = new Set<string>(["llm_execution_feature_flag_disabled", "llm_provider_health_check_skipped_by_design", "llm_call_disabled_by_patch_policy"]);
  if (!input.selectedRouteResolved) {
    blockers.add("llm_provider_route_not_configured_for_draft_generation");
  }
  if (!input.routeEnabled) {
    blockers.add("llm_task_route_disabled_or_missing");
  }
  if (!input.providerFound) {
    blockers.add("llm_provider_config_not_found");
  }
  if (input.providerFound && !input.providerEnabled) {
    blockers.add("llm_provider_disabled_for_draft_generation");
  }
  if (!input.modelFound || !input.modelEnabled) {
    blockers.add("llm_model_candidate_not_resolved");
  }
  if (input.missingRequiredEnvVars.length > 0) {
    blockers.add("llm_required_env_missing");
  }
  return Array.from(blockers);
}

function buildReadinessWarnings(input: {
  routeFound: boolean;
  selectedRouteResolved: boolean;
  routeHasMaxTokens: boolean;
  routeHasTemperature: boolean;
  providerLastTestStatus: string | null;
}) {
  const warnings = new Set<string>();
  if (!input.routeFound) {
    warnings.add("model_route_unresolved");
  }
  if (!input.selectedRouteResolved) {
    warnings.add("provider_config_missing_if_applicable");
  }
  if (!input.routeHasMaxTokens) {
    warnings.add("llm_model_token_budget_not_declared");
  }
  if (!input.routeHasTemperature) {
    warnings.add("llm_model_temperature_not_declared");
  }
  if (input.providerLastTestStatus !== "success") {
    warnings.add("llm_provider_last_test_not_success");
  }
  return Array.from(warnings);
}

function buildSideEffectSummary(): DailyContentDraftGenerationLlmProviderReadinessSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    envRead: true,
    secretValueExposed: false,
    providerHealthChecked: false,
    providerNetworkCall: false,
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
