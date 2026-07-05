import {
  buildDailyContentDraftGenerationReadinessResponse,
  type DailyContentDraftGenerationReadinessSummary
} from "@/lib/daily-content-plans/draft-generation-readiness";
import { buildDailyContentNextItemReadinessResponse, type DailyContentNextItemReadinessSummary } from "@/lib/daily-content-plans/next-item-readiness";

const PATCH_VERSION = "9F-6C";

export interface DailyContentNextDraftGenerationReadinessRequest {
  planId?: unknown;
}

export interface DailyContentNextDraftGenerationReadinessResponse extends DailyContentNextDraftGenerationReadinessSummary {
  checkedAt: string;
  nextDraftGenerationReadinessSummary: DailyContentNextDraftGenerationReadinessSummary;
}

export interface DailyContentNextDraftGenerationReadinessSummary {
  checked: true;
  patchVersion: "9F-6C";
  readOnly: true;
  targetSummary: {
    planId: string | null;
    planItemId: string | null;
    contentItemId: string | null;
    nextAction: string | null;
    recommendedNextPatchBeforeReadiness: string | null;
  };
  nextItemReadinessSummary: Pick<
    DailyContentNextItemReadinessSummary,
    "patchVersion" | "mode" | "readOnly" | "planSummary" | "nextCandidateSummary" | "nextStepSummary" | "blockingReasons" | "warnings" | "sideEffectSummary"
  >;
  draftGenerationReadinessSummary: DailyContentDraftGenerationReadinessSummary | null;
  readinessSummary: {
    nextItemReadyForDraftGenerationReadiness: boolean;
    structuralReadyForFutureDraftGeneration: boolean;
    executionReadyForDraftGeneration: false;
    operatorApprovalRequired: boolean;
    nextRecommendedPatch: "9F-7A" | "manual_review";
    nextRecommendedPatchPurpose: string;
  };
  blockingReasons: string[];
  warnings: string[];
  sideEffectSummary: {
    dbRead: true;
    dbWrite: false;
    contentGeneration: false;
    llmCall: false;
    llmCallLogMutation: false;
    contentMutation: false;
    draftMarkdownMutation: false;
    draftHtmlMutation: false;
    bloggerRead: false;
    bloggerWrite: false;
    bloggerDraftSave: false;
    bloggerPublish: false;
    scheduledPublish: false;
    tokenRefresh: false;
    oauthReconnect: false;
    approvalMutation: false;
    attemptMutation: false;
    externalSend: false;
    schemaMigration: false;
  };
}

export async function buildDailyContentNextDraftGenerationReadinessResponse(
  rawRequest: DailyContentNextDraftGenerationReadinessRequest
): Promise<DailyContentNextDraftGenerationReadinessResponse> {
  const checkedAt = new Date();
  const nextItemResponse = await buildDailyContentNextItemReadinessResponse({ planId: rawRequest.planId });
  const nextItemSummary = nextItemResponse.nextItemReadinessSummary;
  const nextCandidate = nextItemSummary.nextCandidateSummary;
  const targetReady = Boolean(
    nextCandidate &&
      nextCandidate.recommendedNextPatch === "9F-6C" &&
      nextCandidate.contentItemId &&
      nextCandidate.contentStatus === "planned" &&
      nextCandidate.nextAction === "restart_existing_draft_generation_pipeline"
  );
  const draftGenerationReadiness = targetReady
    ? (
        await buildDailyContentDraftGenerationReadinessResponse({
          mode: "preflight",
          planItemId: nextCandidate?.planItemId,
          contentItemId: nextCandidate?.contentItemId
        })
      ).draftGenerationReadinessSummary
    : null;
  const structuralReady = Boolean(draftGenerationReadiness?.readinessSummary.structuralReadyForFutureDraftGeneration);
  const blockingReasons = buildBlockingReasons({
    targetReady,
    nextItemBlockers: nextItemSummary.blockingReasons,
    draftGenerationReadiness
  });
  const warnings = buildWarnings(draftGenerationReadiness);
  const summary: DailyContentNextDraftGenerationReadinessSummary = {
    checked: true,
    patchVersion: PATCH_VERSION,
    readOnly: true,
    targetSummary: {
      planId: nextItemSummary.planSummary?.id ?? null,
      planItemId: nextCandidate?.planItemId ?? null,
      contentItemId: nextCandidate?.contentItemId ?? null,
      nextAction: nextCandidate?.nextAction ?? null,
      recommendedNextPatchBeforeReadiness: nextItemSummary.nextStepSummary.recommendedNextPatch
    },
    nextItemReadinessSummary: {
      patchVersion: nextItemSummary.patchVersion,
      mode: nextItemSummary.mode,
      readOnly: nextItemSummary.readOnly,
      planSummary: nextItemSummary.planSummary,
      nextCandidateSummary: nextItemSummary.nextCandidateSummary,
      nextStepSummary: nextItemSummary.nextStepSummary,
      blockingReasons: nextItemSummary.blockingReasons,
      warnings: nextItemSummary.warnings,
      sideEffectSummary: nextItemSummary.sideEffectSummary
    },
    draftGenerationReadinessSummary: draftGenerationReadiness,
    readinessSummary: {
      nextItemReadyForDraftGenerationReadiness: targetReady,
      structuralReadyForFutureDraftGeneration: structuralReady,
      executionReadyForDraftGeneration: false,
      operatorApprovalRequired: structuralReady,
      nextRecommendedPatch: structuralReady && blockingReasons.length === 0 ? "9F-7A" : "manual_review",
      nextRecommendedPatchPurpose:
        structuralReady && blockingReasons.length === 0
          ? "Preview and, after explicit approval, persist an operator approval row/event for the next planned fixture."
          : "Review the next item readiness blockers before any operator approval or draft generation execution."
    },
    blockingReasons,
    warnings,
    sideEffectSummary: buildSideEffectSummary()
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    nextDraftGenerationReadinessSummary: summary
  };
}

function buildBlockingReasons(input: {
  targetReady: boolean;
  nextItemBlockers: string[];
  draftGenerationReadiness: DailyContentDraftGenerationReadinessSummary | null;
}) {
  const blockers = new Set<string>();
  for (const blocker of input.nextItemBlockers) {
    blockers.add(blocker);
  }
  if (!input.targetReady) {
    blockers.add("next_daily_item_not_ready_for_draft_generation_readiness");
  }
  if (!input.draftGenerationReadiness) {
    blockers.add("draft_generation_readiness_not_available");
  }
  if (input.draftGenerationReadiness && !input.draftGenerationReadiness.readinessSummary.structuralReadyForFutureDraftGeneration) {
    blockers.add("draft_generation_structural_readiness_not_ready");
  }
  return Array.from(blockers);
}

function buildWarnings(draftGenerationReadiness: DailyContentDraftGenerationReadinessSummary | null) {
  return Array.from(
    new Set([
      "next_draft_generation_readiness_is_read_only",
      "no_operator_approval_mutation",
      "no_llm_call",
      "no_content_item_mutation",
      "no_blogger_api_call",
      ...(draftGenerationReadiness?.blockingReasons ?? [])
    ])
  );
}

function buildSideEffectSummary(): DailyContentNextDraftGenerationReadinessSummary["sideEffectSummary"] {
  return {
    dbRead: true,
    dbWrite: false,
    contentGeneration: false,
    llmCall: false,
    llmCallLogMutation: false,
    contentMutation: false,
    draftMarkdownMutation: false,
    draftHtmlMutation: false,
    bloggerRead: false,
    bloggerWrite: false,
    bloggerDraftSave: false,
    bloggerPublish: false,
    scheduledPublish: false,
    tokenRefresh: false,
    oauthReconnect: false,
    approvalMutation: false,
    attemptMutation: false,
    externalSend: false,
    schemaMigration: false
  };
}
