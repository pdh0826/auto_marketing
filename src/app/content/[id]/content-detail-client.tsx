"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  BloggerDraftPayloadPreview,
  BloggerDraftSaveAdmin,
  BloggerDraftSavePreflight,
  PublishApprovalMode,
  PublishApprovalExecutionGuardResponse,
  PublishApprovalInvalidationPreviewResponse,
  PublishApprovalPreview,
  PublishApprovalReadbackResponse,
  PublishApprovalSaveResponse,
  PublishExecutionAttemptReadbackResponse,
  PublishExecutionAttemptPreviewResponse,
  PublishExecutionAttemptSaveResponse,
  PublishOAuthGateResponse,
  PublishPreflightDryRun
} from "@/lib/blogger/admin-types";
import type { BlogPostTemplatePreviewResult, BlogPostTemplatePreviewSource } from "@/lib/blog-renderer/blog-post-template-renderer";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { buildContentPlanDryRun, type ContentPlanDryRunResult, type ReadinessStatus } from "@/lib/content/content-plan-preview";
import { getContentModeLabel } from "@/lib/content/constants";
import { buildDraftMarkdownDryRun, type DraftMarkdownDryRunResult } from "@/lib/content/draft-preview";
import { validateDraftMarkdown, type DraftValidationResult } from "@/lib/content/draft-validation";
import type { HtmlQualityPreviewResult } from "@/lib/content/html-quality-preview";
import type { HtmlQualityRepairPreviewResult } from "@/lib/content/html-quality-repair-preview";
import type { HtmlCandidateValidationResult, HtmlPreviewDryRunResult } from "@/lib/content/html-preview";
import { formatPlanJson, hasUsablePlanJson } from "@/lib/content/plan-template";
import type { PublishReadinessResult } from "@/lib/content/publish-readiness";
import { ApiResult, requestJson } from "@/lib/form-utils";
import type { LlmTaskRouteAdmin } from "@/lib/llm/admin-types";
import { getApiFormatLabel, getInvocationModeLabel } from "@/lib/llm/constants";
import {
  getDraftGenerationStrategyLabel,
  getDraftGenerationStrategyNotice,
  resolveDraftGenerationStrategy,
  type DraftGenerationStrategy,
  type DraftGenerationStrategyResolution
} from "@/lib/llm/draft-generation-strategy";

interface ContentDetailClientProps {
  contentItemId: string;
}

interface GeneratedPlanResult {
  candidatePlanJson: Record<string, unknown>;
  validation: {
    ok: boolean;
    errors: string[];
    warnings: string[];
  };
  route: {
    providerName: string;
    modelName: string;
    usedFallback: boolean;
  };
  metadata: {
    latencyMs: number;
    responseSummary: string;
  };
}

interface GeneratedDraftResult {
  candidateDraftMarkdown: string;
  validation: DraftValidationResult;
  route: {
    providerName: string;
    modelName: string;
    usedFallback: boolean;
  };
  metadata: {
    latencyMs: number;
    responseSummary: string;
    markdownLength: number;
    repairAttempted: boolean;
    repairSucceeded: boolean;
    initialValidationErrorCount: number;
    initialValidationWarningCount: number;
    finalValidationErrorCount: number;
    finalValidationWarningCount: number;
    strategy: DraftGenerationStrategy;
    strategyReason: string;
    isLocalLike: boolean;
    stepCount: number;
    plannedStepCount: number;
    sectionedGenerationImplemented: boolean;
    finalPolishImplemented: boolean;
    providerSummary: DraftGenerationStrategyResolution["providerSummary"];
    sectionCount: number;
    sectionKeys: string[];
    finalPolishApplied: boolean;
    finalPolishInputTooLong: boolean;
    finalPolishFallbackReason: string | null;
    fallbackUsed: boolean;
    fallbackReasons: string[];
    faqRequired: boolean;
    faqSectionDetected: boolean;
    faqFallbackAppended: boolean;
    faqCount: number;
    safetyScrubApplied: boolean;
    safetyScrubCount: number;
    safetyScrubCodes: string[];
    timeoutPolicy: string;
    overallTimeoutMs: number;
    stepTimeoutMs: number;
    skeletonTimeoutMs: number;
    sectionTimeoutMs: number;
    finalPolishTimeoutMs: number;
    repairTimeoutMs: number;
    stepSummaries: Array<{
      stepKey: string;
      sectionKey: string | null;
      status: "success" | "failed" | "fallback";
      durationMs: number;
      promptHash: string | null;
      responseHash: string | null;
      responseLength: number;
      retryCount: number;
      errorMessage: string | null;
    }>;
  };
}

interface BloggerDraftSaveApiResult {
  draftSave: BloggerDraftSaveAdmin | null;
  approvalMatched: boolean;
  draftSaveImplemented: true;
  publishImplemented: false;
  scheduledPublishImplemented: false;
  tokenRefreshImplemented: false;
}

interface ApiErrorWithData extends Error {
  data?: {
    draftSave?: BloggerDraftSaveAdmin | null;
  };
}

interface HtmlApplySummary {
  source: string;
  validationOk: boolean;
  htmlLength: number;
  unsafePatternCount: number;
  applied: boolean;
  appliedField: string | null;
  contentItemSideEffect: string;
  bloggerSideEffect: false;
  llmSideEffect: false;
  publishSideEffect: false;
  tokenRefreshSideEffect: false;
}

type HtmlCandidateSource = "none" | "html-preview" | "quality-repair" | "blog-template-preview" | "applied-html-candidate" | "manual-edit";
type DraftCandidateSource = "none" | "llm-generated" | "stepwise-final-candidate" | "manual-edit";
type StepwiseRunStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
type StepwiseStepStatus = "pending" | "running" | "success" | "failed";

interface StepwiseValidationSummary {
  phase?: string;
  ok?: boolean;
  errorCount?: number;
  warningCount?: number;
  markdownLength?: number;
  errors?: string[];
  warnings?: string[];
  guardSummary?: {
    faqRequired?: boolean;
    faqCount?: number;
    faqSectionDetectedBefore?: boolean;
    faqSectionDetectedAfter?: boolean;
    faqFallbackAppended?: boolean;
    safetyScrubApplied?: boolean;
    safetyScrubCount?: number;
    safetyScrubCodes?: string[];
    h1Count?: number;
    h2OrH3Count?: number;
    mediaPlaceholderCount?: number;
  };
}

interface StepwiseDraftGenerationStep {
  id: string;
  runId: string;
  stepKey: string;
  sectionKey: string | null;
  status: StepwiseStepStatus;
  attempt: number;
  outputMarkdown: string | null;
  outputSummary: string | null;
  hasOutputMarkdown: boolean;
  promptHash: string | null;
  responseHash: string | null;
  latencyMs: number | null;
  errorCode: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

interface StepwiseDraftGenerationRunSummary {
  id: string;
  contentItemId: string;
  strategy: string;
  status: StepwiseRunStatus;
  currentStepKey: string | null;
  sectionKeys: unknown;
  hasAssembledCandidateMarkdown: boolean;
  hasFinalCandidateMarkdown: boolean;
  validationSummary: StepwiseValidationSummary | null;
  metadata: unknown;
  stepCount: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface StepwiseDraftGenerationRunDetail extends StepwiseDraftGenerationRunSummary {
  assembledCandidateMarkdown: string | null;
  finalCandidateMarkdown: string | null;
  steps: StepwiseDraftGenerationStep[];
}

interface StepwiseRunsApiResult {
  contentItemId: string;
  runs: StepwiseDraftGenerationRunSummary[];
}

interface StepwiseRunApiResult {
  run: StepwiseDraftGenerationRunDetail;
}

interface StepwiseStepApiResult extends StepwiseRunApiResult {
  step: StepwiseDraftGenerationStep;
  executed: boolean;
  reusedExistingSuccess: boolean;
}

interface StepwiseAssembleApiResult extends StepwiseRunApiResult {
  assembledCandidateMarkdown: string;
  validationSummary: StepwiseValidationSummary;
  executed: boolean;
  reusedExistingAssembled: boolean;
}

interface StepwiseFinalPolishApiResult extends StepwiseRunApiResult {
  finalCandidateMarkdown: string;
  validationSummary: StepwiseValidationSummary;
  executed: boolean;
  reusedExistingFinal: boolean;
}

const STEPWISE_STEP_ORDER = ["skeleton", "intro", "body_1", "body_2", "body_3", "conclusion_cta_faq"] as const;
const STEPWISE_SECTION_KEYS = ["intro", "body_1", "body_2", "body_3", "conclusion_cta_faq"] as const;

export function ContentDetailClient({ contentItemId }: ContentDetailClientProps) {
  const [contentItem, setContentItem] = useState<ContentItemAdmin | null>(null);
  const [assets, setAssets] = useState<ContentAssetAdmin[]>([]);
  const [contentPlanRoute, setContentPlanRoute] = useState<LlmTaskRouteAdmin | null>(null);
  const [contentDraftRoute, setContentDraftRoute] = useState<LlmTaskRouteAdmin | null>(null);
  const [dryRunResult, setDryRunResult] = useState<ContentPlanDryRunResult | null>(null);
  const [draftDryRunResult, setDraftDryRunResult] = useState<DraftMarkdownDryRunResult | null>(null);
  const [htmlPreviewResult, setHtmlPreviewResult] = useState<HtmlPreviewDryRunResult | null>(null);
  const [blogPostTemplatePreviewResult, setBlogPostTemplatePreviewResult] = useState<BlogPostTemplatePreviewResult | null>(null);
  const [qualityPreviewResult, setQualityPreviewResult] = useState<HtmlQualityPreviewResult | null>(null);
  const [qualityRepairPreviewResult, setQualityRepairPreviewResult] = useState<HtmlQualityRepairPreviewResult | null>(null);
  const [publishReadinessResult, setPublishReadinessResult] = useState<PublishReadinessResult | null>(null);
  const [publishPreflightResult, setPublishPreflightResult] = useState<PublishPreflightDryRun | null>(null);
  const [publishApprovalPreviewResult, setPublishApprovalPreviewResult] = useState<PublishApprovalPreview | null>(null);
  const [publishApprovalSaveResult, setPublishApprovalSaveResult] = useState<PublishApprovalSaveResponse | null>(null);
  const [publishApprovalReadbackResult, setPublishApprovalReadbackResult] = useState<PublishApprovalReadbackResponse | null>(null);
  const [publishApprovalExecutionGuardResult, setPublishApprovalExecutionGuardResult] = useState<PublishApprovalExecutionGuardResponse | null>(null);
  const [publishApprovalInvalidationPreviewResult, setPublishApprovalInvalidationPreviewResult] = useState<PublishApprovalInvalidationPreviewResponse | null>(null);
  const [publishExecutionAttemptPreviewResult, setPublishExecutionAttemptPreviewResult] = useState<PublishExecutionAttemptPreviewResponse | null>(null);
  const [publishExecutionAttemptSaveResult, setPublishExecutionAttemptSaveResult] = useState<PublishExecutionAttemptSaveResponse | null>(null);
  const [publishExecutionAttemptReadbackResult, setPublishExecutionAttemptReadbackResult] = useState<PublishExecutionAttemptReadbackResponse | null>(null);
  const [publishOAuthGateResult, setPublishOAuthGateResult] = useState<PublishOAuthGateResponse | null>(null);
  const [bloggerDraftPreviewResult, setBloggerDraftPreviewResult] = useState<BloggerDraftPayloadPreview | null>(null);
  const [bloggerDraftSavePreflightResult, setBloggerDraftSavePreflightResult] = useState<BloggerDraftSavePreflight | null>(null);
  const [stepwiseRuns, setStepwiseRuns] = useState<StepwiseDraftGenerationRunSummary[]>([]);
  const [selectedStepwiseRunId, setSelectedStepwiseRunId] = useState<string | null>(null);
  const [selectedStepwiseRun, setSelectedStepwiseRun] = useState<StepwiseDraftGenerationRunDetail | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlanResult | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState<GeneratedDraftResult | null>(null);
  const [candidateText, setCandidateText] = useState("");
  const [candidateEditMode, setCandidateEditMode] = useState(false);
  const [candidateDirty, setCandidateDirty] = useState(false);
  const [candidateParseError, setCandidateParseError] = useState<string | null>(null);
  const [draftCandidateText, setDraftCandidateText] = useState("");
  const [draftCandidateSource, setDraftCandidateSource] = useState<DraftCandidateSource>("none");
  const [draftEditMode, setDraftEditMode] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [htmlCandidateText, setHtmlCandidateText] = useState("");
  const [htmlCandidateSource, setHtmlCandidateSource] = useState<HtmlCandidateSource>("none");
  const [htmlEditMode, setHtmlEditMode] = useState(false);
  const [htmlDirty, setHtmlDirty] = useState(false);
  const [htmlCandidateValidation, setHtmlCandidateValidation] = useState<HtmlCandidateValidationResult | null>(null);
  const [lastHtmlApplySummary, setLastHtmlApplySummary] = useState<HtmlApplySummary | null>(null);
  const [htmlApplyConfirmationPending, setHtmlApplyConfirmationPending] = useState(false);
  const [bloggerDraftSaveConfirmationPending, setBloggerDraftSaveConfirmationPending] = useState(false);
  const [publishApprovalMode, setPublishApprovalMode] = useState<PublishApprovalMode>("publish");
  const [publishApprovalScheduledAt, setPublishApprovalScheduledAt] = useState("");
  const [publishApprovalTimezone, setPublishApprovalTimezone] = useState("Asia/Tokyo");
  const [publishApprovalRollbackAcknowledged, setPublishApprovalRollbackAcknowledged] = useState(false);
  const [publishApprovalSideEffectAcknowledged, setPublishApprovalSideEffectAcknowledged] = useState(false);
  const [publishApprovalPersistenceAcknowledged, setPublishApprovalPersistenceAcknowledged] = useState(false);
  const [publishApprovalManualInvalidationReason, setPublishApprovalManualInvalidationReason] = useState("");
  const [publishAttemptPersistenceAcknowledged, setPublishAttemptPersistenceAcknowledged] = useState(false);
  const [publishAttemptNoBloggerWriteAcknowledged, setPublishAttemptNoBloggerWriteAcknowledged] = useState(false);
  const [publishAttemptNoContentMutationAcknowledged, setPublishAttemptNoContentMutationAcknowledged] = useState(false);
  const [qualityRepairCandidateText, setQualityRepairCandidateText] = useState("");
  const [qualityRepairEditMode, setQualityRepairEditMode] = useState(false);
  const [qualityRepairDirty, setQualityRepairDirty] = useState(false);
  const [qualityRepairCandidateValidation, setQualityRepairCandidateValidation] = useState<HtmlCandidateValidationResult | null>(null);
  const [planText, setPlanText] = useState("");
  const [loading, setLoading] = useState(true);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [runningHtmlPreview, setRunningHtmlPreview] = useState(false);
  const [runningBlogPostTemplatePreview, setRunningBlogPostTemplatePreview] = useState(false);
  const [applyingPlan, setApplyingPlan] = useState(false);
  const [applyingDraft, setApplyingDraft] = useState(false);
  const [revalidatingPlan, setRevalidatingPlan] = useState(false);
  const [revalidatingDraft, setRevalidatingDraft] = useState(false);
  const [validatingHtml, setValidatingHtml] = useState(false);
  const [applyingHtml, setApplyingHtml] = useState(false);
  const [runningQualityPreview, setRunningQualityPreview] = useState(false);
  const [runningQualityRepairPreview, setRunningQualityRepairPreview] = useState(false);
  const [validatingQualityRepairCandidate, setValidatingQualityRepairCandidate] = useState(false);
  const [runningPublishReadiness, setRunningPublishReadiness] = useState(false);
  const [runningPublishPreflight, setRunningPublishPreflight] = useState(false);
  const [runningPublishApprovalPreview, setRunningPublishApprovalPreview] = useState(false);
  const [savingPublishApproval, setSavingPublishApproval] = useState(false);
  const [runningPublishApprovalReadback, setRunningPublishApprovalReadback] = useState(false);
  const [runningPublishApprovalExecutionGuard, setRunningPublishApprovalExecutionGuard] = useState(false);
  const [runningPublishApprovalInvalidationPreview, setRunningPublishApprovalInvalidationPreview] = useState(false);
  const [runningPublishExecutionAttemptPreview, setRunningPublishExecutionAttemptPreview] = useState(false);
  const [savingPublishExecutionAttempt, setSavingPublishExecutionAttempt] = useState(false);
  const [runningPublishExecutionAttemptReadback, setRunningPublishExecutionAttemptReadback] = useState(false);
  const [runningPublishOAuthGate, setRunningPublishOAuthGate] = useState(false);
  const [runningBloggerDraftPreview, setRunningBloggerDraftPreview] = useState(false);
  const [runningBloggerDraftSavePreflight, setRunningBloggerDraftSavePreflight] = useState(false);
  const [approvingBloggerDraft, setApprovingBloggerDraft] = useState(false);
  const [revokingBloggerDraftApproval, setRevokingBloggerDraftApproval] = useState(false);
  const [savingBloggerDraft, setSavingBloggerDraft] = useState(false);
  const [loadingStepwiseRuns, setLoadingStepwiseRuns] = useState(false);
  const [creatingStepwiseRun, setCreatingStepwiseRun] = useState(false);
  const [executingStepwiseStepKey, setExecutingStepwiseStepKey] = useState<string | null>(null);
  const [assemblingStepwiseRun, setAssemblingStepwiseRun] = useState(false);
  const [finalPolishingStepwiseRun, setFinalPolishingStepwiseRun] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [draftGenerationError, setDraftGenerationError] = useState<string | null>(null);
  const [htmlPreviewError, setHtmlPreviewError] = useState<string | null>(null);
  const [blogPostTemplatePreviewError, setBlogPostTemplatePreviewError] = useState<string | null>(null);
  const [htmlApplyError, setHtmlApplyError] = useState<string | null>(null);
  const [qualityPreviewError, setQualityPreviewError] = useState<string | null>(null);
  const [qualityRepairPreviewError, setQualityRepairPreviewError] = useState<string | null>(null);
  const [publishReadinessError, setPublishReadinessError] = useState<string | null>(null);
  const [publishPreflightError, setPublishPreflightError] = useState<string | null>(null);
  const [publishApprovalPreviewError, setPublishApprovalPreviewError] = useState<string | null>(null);
  const [publishApprovalSaveError, setPublishApprovalSaveError] = useState<string | null>(null);
  const [publishApprovalReadbackError, setPublishApprovalReadbackError] = useState<string | null>(null);
  const [publishApprovalExecutionGuardError, setPublishApprovalExecutionGuardError] = useState<string | null>(null);
  const [publishApprovalInvalidationPreviewError, setPublishApprovalInvalidationPreviewError] = useState<string | null>(null);
  const [publishExecutionAttemptPreviewError, setPublishExecutionAttemptPreviewError] = useState<string | null>(null);
  const [publishExecutionAttemptSaveError, setPublishExecutionAttemptSaveError] = useState<string | null>(null);
  const [publishExecutionAttemptReadbackError, setPublishExecutionAttemptReadbackError] = useState<string | null>(null);
  const [publishOAuthGateError, setPublishOAuthGateError] = useState<string | null>(null);
  const [bloggerDraftPreviewError, setBloggerDraftPreviewError] = useState<string | null>(null);
  const [bloggerDraftSavePreflightError, setBloggerDraftSavePreflightError] = useState<string | null>(null);
  const [bloggerDraftSaveError, setBloggerDraftSaveError] = useState<string | null>(null);
  const [stepwiseError, setStepwiseError] = useState<string | null>(null);
  const [stepwiseNotice, setStepwiseNotice] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draftHtmlPostApplyNotice, setDraftHtmlPostApplyNotice] = useState(false);

  const parsedPlan = useMemo(() => parsePlan(planText), [planText]);
  const canMarkPlanned = parsedPlan.ok && hasUsablePlanJson(parsedPlan.value);
  const canApplyGeneratedPlan = Boolean(generatedPlan?.validation.ok && !candidateDirty && !candidateParseError && !applyingPlan);
  const canGenerateDraft = Boolean(contentItem?.planJson && draftDryRunResult?.ready && !generatingDraft);
  const canApplyGeneratedDraft = Boolean(generatedDraft?.validation.ok && !draftDirty && !applyingDraft);
  const canRunHtmlPreview = Boolean(contentItem?.draftMarkdown && !runningHtmlPreview);
  const canRunBlogPostTemplatePreview = Boolean(draftCandidateText.trim() && !runningBlogPostTemplatePreview);
  const canCopyBlogPostTemplatePreviewToHtmlCandidate = Boolean(
    blogPostTemplatePreviewResult?.html && blogPostTemplatePreviewResult.validationSummary.errors.length === 0
  );
  const canApplyHtmlCandidate = Boolean(htmlCandidateText && htmlCandidateValidation?.validation.ok && !htmlDirty && !applyingHtml);
  const canRunQualityPreview = Boolean(contentItem?.draftHtml && !runningQualityPreview);
  const canRunQualityRepairPreview = Boolean((contentItem?.draftMarkdown || contentItem?.draftHtml) && !runningQualityRepairPreview);
  const canRunPublishReadiness = Boolean(!runningPublishReadiness);
  const canRunPublishPreflight = Boolean(!runningPublishPreflight);
  const canRunPublishApprovalPreview = Boolean(!runningPublishApprovalPreview);
  const canRunPublishApprovalReadback = Boolean(!runningPublishApprovalReadback);
  const canRunPublishApprovalExecutionGuard = Boolean(!runningPublishApprovalExecutionGuard);
  const canRunPublishApprovalInvalidationPreview = Boolean(!runningPublishApprovalInvalidationPreview);
  const canRunPublishExecutionAttemptPreview = Boolean(!runningPublishExecutionAttemptPreview);
  const canSavePublishExecutionAttempt = Boolean(
    publishExecutionAttemptPreviewResult?.attemptPlanHashPreview &&
      publishExecutionAttemptPreviewResult.approvalId &&
      publishAttemptPersistenceAcknowledged &&
      publishAttemptNoBloggerWriteAcknowledged &&
      publishAttemptNoContentMutationAcknowledged &&
      !savingPublishExecutionAttempt
  );
  const canRunPublishExecutionAttemptReadback = Boolean(!runningPublishExecutionAttemptReadback);
  const canRunPublishOAuthGate = Boolean(!runningPublishOAuthGate);
  const publishApprovalPreviewMatchesOptions = Boolean(
    publishApprovalPreviewResult &&
      publishApprovalPreviewResult.approvalSnapshotPreview.publishMode === publishApprovalMode &&
      (publishApprovalPreviewResult.approvalSnapshotPreview.scheduledAt ?? "") ===
        (publishApprovalMode === "scheduled_publish" ? publishApprovalScheduledAt.trim() : "") &&
      (publishApprovalPreviewResult.approvalSnapshotPreview.timezone ?? "") ===
        (publishApprovalMode === "scheduled_publish" ? publishApprovalTimezone.trim() : "")
  );
  const canSavePublishApproval = Boolean(
    publishApprovalPreviewResult?.approvalSnapshotHashPreview &&
      publishApprovalPreviewMatchesOptions &&
      publishApprovalRollbackAcknowledged &&
      publishApprovalSideEffectAcknowledged &&
      publishApprovalPersistenceAcknowledged &&
      (publishApprovalMode === "publish" || (publishApprovalScheduledAt.trim() && publishApprovalTimezone.trim())) &&
      !savingPublishApproval
  );
  const canRunBloggerDraftPreview = Boolean(!runningBloggerDraftPreview);
  const canRunBloggerDraftSavePreflight = Boolean(!runningBloggerDraftSavePreflight);
  const canApproveBloggerDraftPayload = Boolean(
    bloggerDraftPreviewResult?.draftPayloadReady && bloggerDraftPreviewResult.approvalSummary.approvalStatus !== "approved" && !approvingBloggerDraft
  );
  const canRevokeBloggerDraftApproval = Boolean(bloggerDraftPreviewResult?.approvalSummary.approval?.status === "approved" && !revokingBloggerDraftApproval);
  const canSaveBloggerDraft = Boolean(
    bloggerDraftSavePreflightResult?.canSaveDraft === true &&
      bloggerDraftSavePreflightResult.blockingReasons.length === 0 &&
      bloggerDraftSavePreflightResult.approvalSnapshotStatus.status === "approved" &&
      bloggerDraftSavePreflightResult.approvalSnapshotStatus.approvalMatchesCurrentPreview &&
      bloggerDraftSavePreflightResult.draftPayloadPreviewSummary.draftPayloadReady &&
      !bloggerDraftSavePreflightResult.draftSavePreflightSummary.successfulSaveForCurrentApproval &&
      !bloggerDraftSavePreflightResult.draftSavePreflightSummary.duplicateSaveBlocked &&
      !savingBloggerDraft
  );
  const latestSuccessfulBloggerDraftSave =
    bloggerDraftPreviewResult?.draftSaveSummary.latestSuccessfulDraftSave ??
    bloggerDraftSavePreflightResult?.draftSavePreflightSummary.latestSuccessfulDraftSave ??
    null;
  const latestSuccessfulBloggerDraftAdminLinks = buildBloggerDraftAdminLinks(latestSuccessfulBloggerDraftSave);
  const latestSuccessfulBloggerDraftUrlLooksLikeHome = looksLikeBloggerBlogHomeUrl(latestSuccessfulBloggerDraftSave);
  const publishReadinessDraftAdminLinks = buildBloggerDraftAdminLinksFromIds(
    publishReadinessResult?.metadata.bloggerBlogId ?? null,
    publishReadinessResult?.metadata.bloggerDraftPostId ?? null
  );
  const postSaveDuplicateProtectionActive = Boolean(bloggerDraftSavePreflightResult?.draftSavePreflightSummary.duplicateSaveBlocked);
  const postSaveAccessTokenExpired = Boolean(bloggerDraftSavePreflightResult?.blockingReasons.includes("access_token_expired_reauth_required"));
  const stepwiseBusy = Boolean(loadingStepwiseRuns || creatingStepwiseRun || executingStepwiseStepKey || assemblingStepwiseRun || finalPolishingStepwiseRun);
  const canCreateStepwiseRun = Boolean(contentItem?.planJson && !creatingStepwiseRun);
  const canAssembleStepwiseRun = Boolean(selectedStepwiseRun && !stepwiseBusy && getMissingStepwiseSectionKeys(selectedStepwiseRun).length === 0);
  const canFinalPolishStepwiseRun = Boolean(selectedStepwiseRun?.assembledCandidateMarkdown && !stepwiseBusy);
  const draftStrategyResolution = useMemo(
    () =>
      resolveDraftGenerationStrategy({
        provider: contentDraftRoute?.primaryProvider,
        model: contentDraftRoute?.primaryModel
      }),
    [contentDraftRoute?.primaryProvider, contentDraftRoute?.primaryModel]
  );

  const loadContentItem = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await requestJson<ApiResult<ContentItemAdmin>>(`/api/content-items/${contentItemId}`);
      setContentItem(result.data);
      setPlanText(formatPlanJson(result.data.planJson));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "글 생성 요청 상세 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [contentItemId]);

  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    setAssetsError(null);

    try {
      const result = await requestJson<ApiResult<ContentAssetAdmin[]>>(`/api/content-items/${contentItemId}/assets`);
      setAssets(result.data);
    } catch (caught) {
      setAssetsError(caught instanceof Error ? caught.message : "첨부 미디어를 불러오지 못했습니다.");
    } finally {
      setAssetsLoading(false);
    }
  }, [contentItemId]);

  const loadRoutes = useCallback(async () => {
    setRoutesLoading(true);
    setRouteError(null);

    try {
      const result = await requestJson<ApiResult<LlmTaskRouteAdmin[]>>("/api/settings/llm/task-routes");
      setContentPlanRoute(result.data.find((route) => route.taskType === "content_plan") ?? null);
      setContentDraftRoute(result.data.find((route) => route.taskType === "content_draft") ?? null);
    } catch (caught) {
      setRouteError(caught instanceof Error ? caught.message : "content_plan route 정보를 불러오지 못했습니다.");
    } finally {
      setRoutesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContentItem();
    void loadAssets();
    void loadRoutes();
  }, [loadAssets, loadContentItem, loadRoutes]);

  const loadStepwiseRunDetail = useCallback(
    async (runId: string) => {
      const result = await requestJson<ApiResult<StepwiseRunApiResult>>(`/api/content-items/${contentItemId}/draft-generation-runs/${runId}`);
      setSelectedStepwiseRun(result.data.run);
      setSelectedStepwiseRunId(result.data.run.id);
      return result.data.run;
    },
    [contentItemId]
  );

  const loadStepwiseRuns = useCallback(async () => {
    setLoadingStepwiseRuns(true);
    setStepwiseError(null);

    try {
      const result = await requestJson<ApiResult<StepwiseRunsApiResult>>(`/api/content-items/${contentItemId}/draft-generation-runs`);
      setStepwiseRuns(result.data.runs);
      const nextSelectedRunId = selectedStepwiseRunId ?? result.data.runs[0]?.id ?? null;
      if (nextSelectedRunId) {
        await loadStepwiseRunDetail(nextSelectedRunId);
      } else {
        setSelectedStepwiseRun(null);
        setSelectedStepwiseRunId(null);
      }
    } catch (caught) {
      setStepwiseError(buildStepwiseErrorMessage(caught instanceof Error ? caught.message : "stepwise run 목록 조회에 실패했습니다."));
    } finally {
      setLoadingStepwiseRuns(false);
    }
  }, [contentItemId, loadStepwiseRunDetail, selectedStepwiseRunId]);

  useEffect(() => {
    void loadStepwiseRuns();
  }, [loadStepwiseRuns]);

  async function savePlanJson() {
    setPlanError(null);
    setNotice(null);

    const parsed = parsePlan(planText);
    if (!parsed.ok) {
      setPlanError(parsed.error);
      return;
    }

    setSavingPlan(true);
    try {
      const result = await requestJson<ApiResult<ContentItemAdmin>>(`/api/content-items/${contentItemId}`, {
        method: "PATCH",
        body: JSON.stringify({ planJson: parsed.value })
      });
      setContentItem(result.data);
      setPlanText(formatPlanJson(result.data.planJson));
      setNotice("planJson을 저장했습니다.");
    } catch (caught) {
      setPlanError(caught instanceof Error ? caught.message : "planJson을 저장하지 못했습니다.");
    } finally {
      setSavingPlan(false);
    }
  }

  async function markPlanned() {
    setPlanError(null);
    setNotice(null);

    const parsed = parsePlan(planText);
    if (!parsed.ok) {
      setPlanError(parsed.error);
      return;
    }

    if (!hasUsablePlanJson(parsed.value)) {
      setPlanError("planned 전환 전 최소 하나 이상의 기획 항목을 입력하세요. 빈 객체나 빈 템플릿만으로는 전환할 수 없습니다.");
      return;
    }

    setChangingStatus(true);
    try {
      const saved = await requestJson<ApiResult<ContentItemAdmin>>(`/api/content-items/${contentItemId}`, {
        method: "PATCH",
        body: JSON.stringify({ planJson: parsed.value, status: "planned" })
      });
      setContentItem(saved.data);
      setPlanText(formatPlanJson(saved.data.planJson));
      setNotice("planJson을 저장하고 status를 planned로 전환했습니다.");
    } catch (caught) {
      setPlanError(caught instanceof Error ? caught.message : "planned 전환에 실패했습니다.");
    } finally {
      setChangingStatus(false);
    }
  }

  function runContentPlanDryRun() {
    setNotice(null);
    setGenerationError(null);
    if (!contentItem) {
      setRouteError("글 생성 요청 상세 정보를 먼저 불러와야 합니다.");
      return;
    }
    setDryRunResult(buildContentPlanDryRun(contentItem, assets, contentPlanRoute));
  }

  function runDraftMarkdownDryRun() {
    setNotice(null);
    setDraftGenerationError(null);
    if (!contentItem) {
      setRouteError("글 생성 요청 상세 정보를 먼저 불러와야 합니다.");
      return;
    }
    setDraftDryRunResult(buildDraftMarkdownDryRun(contentItem, assets, contentDraftRoute));
  }

  async function generateDraftCandidate() {
    setNotice(null);
    setDraftGenerationError(null);
    setGeneratedDraft(null);
    setDraftCandidateText("");
    setDraftCandidateSource("none");
    setDraftEditMode(false);
    setDraftDirty(false);
    setGeneratingDraft(true);

    try {
      const result = await requestJson<ApiResult<GeneratedDraftResult>>(`/api/content-items/${contentItemId}/generate-draft`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setGeneratedDraft(result.data);
      setDraftCandidateText(result.data.candidateDraftMarkdown);
      setDraftCandidateSource("llm-generated");
      setBlogPostTemplatePreviewResult(null);
      setBlogPostTemplatePreviewError(null);
      setNotice("본문 초안 후보를 생성했습니다. 아직 DB에 저장되지 않았습니다.");
    } catch (caught) {
      setDraftGenerationError(caught instanceof Error ? caught.message : "본문 초안 후보 생성에 실패했습니다.");
    } finally {
      setGeneratingDraft(false);
    }
  }

  async function revalidateDraftCandidate() {
    if (!generatedDraft || !contentItem) {
      return;
    }

    setDraftGenerationError(null);
    setNotice(null);
    setRevalidatingDraft(true);
    try {
      const validation = validateDraftMarkdown(draftCandidateText, {
        contentItem,
        assets
      });
      setGeneratedDraft({
        ...generatedDraft,
        candidateDraftMarkdown: draftCandidateText,
        validation,
        metadata: {
          ...generatedDraft.metadata,
          markdownLength: draftCandidateText.length
        }
      });
      setDraftDirty(false);
      setNotice("초안 후보를 재검증했습니다. 아직 DB에 저장되지 않았습니다.");
    } finally {
      setRevalidatingDraft(false);
    }
  }

  async function applyGeneratedDraft() {
    if (!generatedDraft?.validation.ok) {
      setDraftGenerationError("validation을 통과한 후보만 draftMarkdown에 반영할 수 있습니다.");
      return;
    }
    if (draftDirty) {
      setDraftGenerationError("편집된 초안 후보는 재검증 후 반영할 수 있습니다.");
      return;
    }

    setApplyingDraft(true);
    setDraftGenerationError(null);
    setNotice(null);

    try {
      const result = await requestJson<ApiResult<ContentItemAdmin>>(`/api/content-items/${contentItemId}`, {
        method: "PATCH",
        body: JSON.stringify({ draftMarkdown: generatedDraft.candidateDraftMarkdown })
      });
      setContentItem(result.data);
      setNotice("생성 후보를 draftMarkdown에 반영했습니다. draftHtml은 생성하지 않았습니다.");
    } catch (caught) {
      setDraftGenerationError(caught instanceof Error ? caught.message : "생성 후보를 draftMarkdown에 반영하지 못했습니다.");
    } finally {
      setApplyingDraft(false);
    }
  }

  async function runHtmlPreviewDryRun() {
    setNotice(null);
    setHtmlPreviewError(null);
    setHtmlApplyError(null);
    setRunningHtmlPreview(true);

    try {
      const result = await requestJson<ApiResult<HtmlPreviewDryRunResult>>(`/api/content-items/${contentItemId}/html-preview`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setHtmlPreviewResult(result.data);
      setHtmlCandidateText(result.data.previewHtml);
      setHtmlCandidateSource("html-preview");
      setHtmlEditMode(false);
      setHtmlDirty(false);
      setLastHtmlApplySummary(null);
      setHtmlApplyConfirmationPending(false);
      const validation = await validateHtmlCandidateOnServer(result.data.previewHtml);
      setHtmlCandidateValidation(validation);
      setNotice("HTML 변환 dry-run preview를 생성했습니다. DB에는 저장하지 않았습니다.");
    } catch (caught) {
      setHtmlPreviewError(caught instanceof Error ? caught.message : "HTML 변환 dry-run preview에 실패했습니다.");
    } finally {
      setRunningHtmlPreview(false);
    }
  }

  async function runBlogPostTemplatePreview() {
    if (!draftCandidateText.trim()) {
      setBlogPostTemplatePreviewError("Markdown 후보가 비어 있습니다.");
      return;
    }

    setNotice(null);
    setBlogPostTemplatePreviewError(null);
    setRunningBlogPostTemplatePreview(true);

    try {
      const result = await requestJson<ApiResult<BlogPostTemplatePreviewResult>>(`/api/content-items/${contentItemId}/blog-post-template-preview`, {
        method: "POST",
        body: JSON.stringify({
          markdown: draftCandidateText,
          source: toBlogPostTemplatePreviewSource(draftCandidateSource),
          theme: "clean_blog"
        })
      });
      setBlogPostTemplatePreviewResult(result.data);
      setNotice("블로그 HTML template preview를 생성했습니다. DB 저장, LLM 호출, Blogger API 호출은 수행하지 않았습니다.");
    } catch (caught) {
      setBlogPostTemplatePreviewError(caught instanceof Error ? caught.message : "블로그 HTML template preview 생성에 실패했습니다.");
    } finally {
      setRunningBlogPostTemplatePreview(false);
    }
  }

  async function validateHtmlCandidateOnServer(candidateHtml: string) {
    const result = await requestJson<ApiResult<HtmlCandidateValidationResult>>(`/api/content-items/${contentItemId}/validate-html`, {
      method: "POST",
      body: JSON.stringify({ candidateHtml })
    });
    return result.data;
  }

  async function revalidateHtmlCandidate() {
    setHtmlApplyError(null);
    setHtmlPreviewError(null);
    setNotice(null);
    setValidatingHtml(true);

    try {
      const validation = await validateHtmlCandidateOnServer(htmlCandidateText);
      setHtmlCandidateValidation(validation);
      setHtmlDirty(false);
      setLastHtmlApplySummary(null);
      setHtmlApplyConfirmationPending(false);
      setNotice("HTML 후보를 재검증했습니다. 아직 DB에 저장하지 않았습니다.");
    } catch (caught) {
      setHtmlApplyError(caught instanceof Error ? caught.message : "HTML 후보 재검증에 실패했습니다.");
    } finally {
      setValidatingHtml(false);
    }
  }

  async function applyHtmlCandidate() {
    if (!htmlCandidateValidation?.validation.ok) {
      setHtmlApplyError("validation/security error가 없는 HTML 후보만 draftHtml에 반영할 수 있습니다.");
      return;
    }
    if (htmlDirty) {
      setHtmlApplyError("편집된 HTML 후보는 재검증 후 반영할 수 있습니다.");
      return;
    }
    if (!htmlApplyConfirmationPending) {
      setHtmlApplyConfirmationPending(true);
      setHtmlApplyError(null);
      setNotice("draftHtml 저장 확인 단계입니다. 이 버튼은 draftHtml만 저장하며 Blogger draft save/publish/token refresh는 실행하지 않습니다. 저장하려면 같은 버튼을 한 번 더 누르세요.");
      return;
    }

    setApplyingHtml(true);
    setHtmlApplyError(null);
    setNotice(null);

    try {
      const result = await requestJson<
        ApiResult<{
          contentItem: ContentItemAdmin;
          validation: HtmlCandidateValidationResult["validation"];
          securityChecks: HtmlCandidateValidationResult["securityChecks"];
          mediaMappings: HtmlCandidateValidationResult["mediaMappings"];
          metadata: HtmlCandidateValidationResult["metadata"];
          applySummary: HtmlApplySummary;
        }>
      >(`/api/content-items/${contentItemId}/apply-html`, {
        method: "POST",
        body: JSON.stringify({ candidateHtml: htmlCandidateText, source: htmlCandidateSource })
      });
      setContentItem(result.data.contentItem);
      setHtmlCandidateValidation({
        validation: result.data.validation,
        securityChecks: result.data.securityChecks,
        mediaMappings: result.data.mediaMappings,
        metadata: result.data.metadata
      });
      setHtmlDirty(false);
      setHtmlCandidateSource("applied-html-candidate");
      setLastHtmlApplySummary(result.data.applySummary);
      setHtmlApplyConfirmationPending(false);
      setQualityPreviewResult(null);
      setPublishReadinessResult(null);
      setBloggerDraftPreviewResult(null);
      setBloggerDraftSavePreflightResult(null);
      setBloggerDraftSaveConfirmationPending(false);
      setDraftHtmlPostApplyNotice(true);
      setNotice(
        "draftHtml을 수동 반영했습니다. Quality Dry Run / Publish Readiness / Blogger Draft Payload Preview / Blogger Draft Save Preflight를 다시 실행하고, Blogger draft save 전 재승인하세요."
      );
    } catch (caught) {
      setHtmlApplyError(caught instanceof Error ? caught.message : "HTML 후보를 draftHtml에 반영하지 못했습니다.");
    } finally {
      setApplyingHtml(false);
    }
  }

  async function runQualityPreview() {
    setNotice(null);
    setQualityPreviewError(null);
    setRunningQualityPreview(true);

    try {
      const result = await requestJson<ApiResult<HtmlQualityPreviewResult>>(`/api/content-items/${contentItemId}/quality-preview`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setQualityPreviewResult(result.data);
      setNotice("품질검사 dry-run preview를 생성했습니다. DB에는 저장하지 않았습니다.");
    } catch (caught) {
      setQualityPreviewError(caught instanceof Error ? caught.message : "품질검사 dry-run preview에 실패했습니다.");
    } finally {
      setRunningQualityPreview(false);
    }
  }

  async function runQualityRepairPreview() {
    setNotice(null);
    setQualityRepairPreviewError(null);
    setRunningQualityRepairPreview(true);

    try {
      const result = await requestJson<ApiResult<HtmlQualityRepairPreviewResult>>(`/api/content-items/${contentItemId}/quality-repair-preview`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setQualityRepairPreviewResult(result.data);
      setQualityRepairCandidateText(result.data.candidateHtml);
      setQualityRepairCandidateValidation(result.data.afterValidation);
      setQualityRepairEditMode(false);
      setQualityRepairDirty(false);
      setNotice("Quality repair candidate preview를 생성했습니다. draftHtml은 자동 저장하지 않았고 LLM/Blogger API를 호출하지 않았습니다.");
    } catch (caught) {
      setQualityRepairPreviewError(caught instanceof Error ? caught.message : "Quality repair preview에 실패했습니다.");
    } finally {
      setRunningQualityRepairPreview(false);
    }
  }

  async function revalidateQualityRepairCandidate() {
    setQualityRepairPreviewError(null);
    setNotice(null);
    setValidatingQualityRepairCandidate(true);

    try {
      const validation = await validateHtmlCandidateOnServer(qualityRepairCandidateText);
      setQualityRepairCandidateValidation(validation);
      setQualityRepairDirty(false);
      setNotice("Quality repair 후보를 재검증했습니다. 아직 draftHtml에 저장하지 않았습니다.");
    } catch (caught) {
      setQualityRepairPreviewError(caught instanceof Error ? caught.message : "Quality repair 후보 재검증에 실패했습니다.");
    } finally {
      setValidatingQualityRepairCandidate(false);
    }
  }

  function copyQualityRepairToHtmlCandidate() {
    setHtmlCandidateText(qualityRepairCandidateText);
    setHtmlCandidateSource("quality-repair");
    setHtmlCandidateValidation(null);
    setHtmlEditMode(false);
    setHtmlDirty(true);
    setLastHtmlApplySummary(null);
    setHtmlApplyConfirmationPending(false);
    setNotice("Quality repair 후보를 HTML 후보로 사용합니다. HTML 후보 섹션에서 재검증한 뒤 수동으로 draftHtml에 반영하세요.");
  }

  function copyBlogPostTemplatePreviewToHtmlCandidate() {
    if (!blogPostTemplatePreviewResult?.html) {
      setBlogPostTemplatePreviewError("Blog post template preview HTML이 없습니다.");
      return;
    }
    if (blogPostTemplatePreviewResult.validationSummary.errors.length > 0) {
      setBlogPostTemplatePreviewError("Template preview error가 있는 HTML은 후보로 가져올 수 없습니다.");
      return;
    }

    setHtmlCandidateText(blogPostTemplatePreviewResult.html);
    setHtmlCandidateSource("blog-template-preview");
    setHtmlCandidateValidation(null);
    setHtmlEditMode(false);
    setHtmlDirty(true);
    setLastHtmlApplySummary(null);
    setHtmlApplyConfirmationPending(false);
    setHtmlPreviewError(null);
    setHtmlApplyError(null);
    setNotice("Blog template preview HTML을 HTML 후보로 가져왔습니다. 아직 draftHtml에 저장하지 않았고, 기존 HTML 재검증과 수동 반영 버튼을 별도로 눌러야 저장됩니다.");
  }

  async function createStepwiseRun() {
    setStepwiseError(null);
    setStepwiseNotice(null);
    setCreatingStepwiseRun(true);

    try {
      const result = await requestJson<ApiResult<StepwiseRunApiResult>>(`/api/content-items/${contentItemId}/draft-generation-runs`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setSelectedStepwiseRun(result.data.run);
      setSelectedStepwiseRunId(result.data.run.id);
      setStepwiseNotice("새 stepwise run을 생성했습니다. content item에는 자동 반영하지 않았습니다.");
      const runs = await requestJson<ApiResult<StepwiseRunsApiResult>>(`/api/content-items/${contentItemId}/draft-generation-runs`);
      setStepwiseRuns(runs.data.runs);
    } catch (caught) {
      setStepwiseError(buildStepwiseErrorMessage(caught instanceof Error ? caught.message : "stepwise run 생성에 실패했습니다."));
    } finally {
      setCreatingStepwiseRun(false);
    }
  }

  async function selectStepwiseRun(runId: string) {
    setStepwiseError(null);
    setStepwiseNotice(null);
    setSelectedStepwiseRunId(runId);
    setLoadingStepwiseRuns(true);

    try {
      await loadStepwiseRunDetail(runId);
    } catch (caught) {
      setStepwiseError(buildStepwiseErrorMessage(caught instanceof Error ? caught.message : "stepwise run 상세 조회에 실패했습니다."));
    } finally {
      setLoadingStepwiseRuns(false);
    }
  }

  async function executeStepwiseStep(stepKey: string) {
    if (!selectedStepwiseRun) {
      return;
    }

    setStepwiseError(null);
    setStepwiseNotice(null);
    setExecutingStepwiseStepKey(stepKey);

    try {
      const result = await requestJson<ApiResult<StepwiseStepApiResult>>(
        `/api/content-items/${contentItemId}/draft-generation-runs/${selectedStepwiseRun.id}/steps/${stepKey}`,
        {
          method: "POST",
          body: JSON.stringify({})
        }
      );
      setSelectedStepwiseRun(result.data.run);
      setStepwiseNotice(
        result.data.executed
          ? `${stepKey} step을 로컬 LLM으로 실행했습니다. content item에는 자동 반영하지 않았습니다.`
          : `${stepKey} step은 이미 성공 상태라 기존 결과를 재사용했습니다.`
      );
      await loadStepwiseRuns();
    } catch (caught) {
      setStepwiseError(buildStepwiseErrorMessage(caught instanceof Error ? caught.message : `${stepKey} step 실행에 실패했습니다.`));
      if (selectedStepwiseRunId) {
        try {
          await loadStepwiseRunDetail(selectedStepwiseRunId);
        } catch {
          // keep the original error visible
        }
      }
    } finally {
      setExecutingStepwiseStepKey(null);
    }
  }

  async function assembleStepwiseRun() {
    if (!selectedStepwiseRun) {
      return;
    }

    setStepwiseError(null);
    setStepwiseNotice(null);
    setAssemblingStepwiseRun(true);

    try {
      const result = await requestJson<ApiResult<StepwiseAssembleApiResult>>(
        `/api/content-items/${contentItemId}/draft-generation-runs/${selectedStepwiseRun.id}/assemble`,
        {
          method: "POST",
          body: JSON.stringify({})
        }
      );
      setSelectedStepwiseRun(result.data.run);
      setStepwiseNotice(
        result.data.executed
          ? "section output을 deterministic assemble로 결합했습니다. LLM/Blogger API는 호출하지 않았고 content item에도 반영하지 않았습니다."
          : "기존 assembled candidate를 재사용했습니다."
      );
      await loadStepwiseRuns();
    } catch (caught) {
      setStepwiseError(buildStepwiseErrorMessage(caught instanceof Error ? caught.message : "stepwise assemble에 실패했습니다."));
    } finally {
      setAssemblingStepwiseRun(false);
    }
  }

  async function finalPolishStepwiseRun() {
    if (!selectedStepwiseRun) {
      return;
    }

    setStepwiseError(null);
    setStepwiseNotice(null);
    setFinalPolishingStepwiseRun(true);

    try {
      const result = await requestJson<ApiResult<StepwiseFinalPolishApiResult>>(
        `/api/content-items/${contentItemId}/draft-generation-runs/${selectedStepwiseRun.id}/final-polish`,
        {
          method: "POST",
          body: JSON.stringify({})
        }
      );
      setSelectedStepwiseRun(result.data.run);
      setStepwiseNotice(
        result.data.executed
          ? "final polish를 로컬 LLM으로 실행했습니다. 결과는 run candidate에만 저장했고 content item에는 자동 반영하지 않았습니다."
          : "기존 final candidate를 재사용했습니다."
      );
      await loadStepwiseRuns();
    } catch (caught) {
      setStepwiseError(buildStepwiseErrorMessage(caught instanceof Error ? caught.message : "final polish에 실패했습니다."));
      if (selectedStepwiseRunId) {
        try {
          await loadStepwiseRunDetail(selectedStepwiseRunId);
        } catch {
          // keep the original error visible
        }
      }
    } finally {
      setFinalPolishingStepwiseRun(false);
    }
  }

  function copyStepwiseFinalCandidateToDraftCandidate() {
    if (!selectedStepwiseRun?.finalCandidateMarkdown || !contentItem) {
      setStepwiseError("finalCandidateMarkdown이 있는 completed stepwise run을 먼저 선택하세요.");
      return;
    }

    const validation = validateDraftMarkdown(selectedStepwiseRun.finalCandidateMarkdown, {
      contentItem,
      assets
    });
    const provider = contentDraftRoute?.primaryProvider ?? null;
    const model = contentDraftRoute?.primaryModel ?? null;
    setGeneratedDraft({
      candidateDraftMarkdown: selectedStepwiseRun.finalCandidateMarkdown,
      validation,
      route: {
        providerName: provider?.name ?? "stepwise run candidate",
        modelName: model?.displayName ?? model?.name ?? "stepwise final candidate",
        usedFallback: false
      },
      metadata: {
        latencyMs: 0,
        responseSummary: "stepwise_final_candidate_manual_import",
        markdownLength: selectedStepwiseRun.finalCandidateMarkdown.length,
        repairAttempted: false,
        repairSucceeded: false,
        initialValidationErrorCount: validation.errors.length,
        initialValidationWarningCount: validation.warnings.length,
        finalValidationErrorCount: validation.errors.length,
        finalValidationWarningCount: validation.warnings.length,
        strategy: "local_sectioned_stepwise",
        strategyReason: "explicit_strategy",
        isLocalLike: true,
        stepCount: selectedStepwiseRun.steps.filter((step) => step.status === "success").length + (selectedStepwiseRun.finalCandidateMarkdown ? 1 : 0),
        plannedStepCount: STEPWISE_STEP_ORDER.length + 1,
        sectionedGenerationImplemented: true,
        finalPolishImplemented: true,
        providerSummary: {
          providerName: provider?.name ?? null,
          providerType: provider?.providerType ?? null,
          invocationMode: provider?.invocationMode ?? null,
          apiFormat: provider?.apiFormat ?? null,
          modelName: model?.displayName ?? model?.name ?? null
        },
        sectionCount: selectedStepwiseRun.steps.filter((step) => STEPWISE_SECTION_KEYS.includes(step.stepKey as (typeof STEPWISE_SECTION_KEYS)[number])).length,
        sectionKeys: [...STEPWISE_SECTION_KEYS],
        finalPolishApplied: true,
        finalPolishInputTooLong: false,
        finalPolishFallbackReason: null,
        fallbackUsed: false,
        fallbackReasons: [],
        faqRequired: Boolean(selectedStepwiseRun.validationSummary?.guardSummary?.faqRequired),
        faqSectionDetected: Boolean(selectedStepwiseRun.validationSummary?.guardSummary?.faqSectionDetectedAfter),
        faqFallbackAppended: Boolean(selectedStepwiseRun.validationSummary?.guardSummary?.faqFallbackAppended),
        faqCount: selectedStepwiseRun.validationSummary?.guardSummary?.faqCount ?? 0,
        safetyScrubApplied: Boolean(selectedStepwiseRun.validationSummary?.guardSummary?.safetyScrubApplied),
        safetyScrubCount: selectedStepwiseRun.validationSummary?.guardSummary?.safetyScrubCount ?? 0,
        safetyScrubCodes: selectedStepwiseRun.validationSummary?.guardSummary?.safetyScrubCodes ?? [],
        timeoutPolicy: "stepwise_manual_import",
        overallTimeoutMs: 0,
        stepTimeoutMs: 0,
        skeletonTimeoutMs: 0,
        sectionTimeoutMs: 0,
        finalPolishTimeoutMs: 0,
        repairTimeoutMs: 0,
        stepSummaries: selectedStepwiseRun.steps.map((step) => ({
          stepKey: step.stepKey,
          sectionKey: step.sectionKey,
          status: step.status === "success" ? "success" : step.status === "failed" ? "failed" : "fallback",
          durationMs: step.latencyMs ?? 0,
          promptHash: step.promptHash,
          responseHash: step.responseHash,
          responseLength: step.outputMarkdown?.length ?? 0,
          retryCount: Math.max(0, step.attempt - 1),
          errorMessage: step.errorCode
        }))
      }
    });
    setDraftCandidateText(selectedStepwiseRun.finalCandidateMarkdown);
    setDraftCandidateSource("stepwise-final-candidate");
    setBlogPostTemplatePreviewResult(null);
    setBlogPostTemplatePreviewError(null);
    setDraftEditMode(false);
    setDraftDirty(false);
    setDraftGenerationError(null);
    setStepwiseError(null);
    setStepwiseNotice("Stepwise final candidate를 기존 초안 후보로 가져왔습니다. DB/API 호출은 없었고, draftMarkdown 반영은 기존 수동 버튼을 별도로 눌러야 합니다.");
  }

  async function runPublishReadiness() {
    setNotice(null);
    setPublishReadinessError(null);
    setRunningPublishReadiness(true);

    try {
      const result = await requestJson<ApiResult<PublishReadinessResult>>(`/api/content-items/${contentItemId}/publish-readiness`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setPublishReadinessResult(result.data);
      setNotice("발행 준비 gate preview를 생성했습니다. DB에는 저장하지 않았고 Blogger API를 호출하지 않았습니다.");
    } catch (caught) {
      setPublishReadinessError(caught instanceof Error ? caught.message : "발행 준비 gate preview에 실패했습니다.");
    } finally {
      setRunningPublishReadiness(false);
    }
  }

  async function runPublishPreflight() {
    setNotice(null);
    setPublishPreflightError(null);
    setRunningPublishPreflight(true);

    try {
      const result = await requestJson<ApiResult<PublishPreflightDryRun>>(`/api/content-items/${contentItemId}/publish-preflight`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setPublishPreflightResult(result.data);
      setNotice("Publish preflight dry-run을 완료했습니다. publish, scheduled publish, Blogger write, token refresh, LLM 호출, DB 저장은 수행하지 않았습니다.");
    } catch (caught) {
      setPublishPreflightError(caught instanceof Error ? caught.message : "Publish preflight dry-run에 실패했습니다.");
    } finally {
      setRunningPublishPreflight(false);
    }
  }

  async function runPublishApprovalPreview() {
    setNotice(null);
    setPublishApprovalPreviewError(null);
    setPublishApprovalSaveError(null);
    setPublishApprovalSaveResult(null);
    setRunningPublishApprovalPreview(true);

    try {
      const result = await requestJson<ApiResult<PublishApprovalPreview>>(`/api/content-items/${contentItemId}/publish-approval-preview`, {
        method: "POST",
        body: JSON.stringify({
          mode: publishApprovalMode,
          scheduledAt: publishApprovalMode === "scheduled_publish" ? publishApprovalScheduledAt.trim() || null : null,
          timezone: publishApprovalMode === "scheduled_publish" ? publishApprovalTimezone.trim() || null : null
        })
      });
      setPublishApprovalPreviewResult(result.data);
      setNotice("Publish approval snapshot preview를 생성했습니다. approval 저장 전 hash 확인만 수행했고 publish, scheduled publish, Blogger write, token refresh, LLM 호출, DB 저장은 수행하지 않았습니다.");
    } catch (caught) {
      setPublishApprovalPreviewError(caught instanceof Error ? caught.message : "Publish approval snapshot preview에 실패했습니다.");
    } finally {
      setRunningPublishApprovalPreview(false);
    }
  }

  async function savePublishApprovalSnapshot() {
    if (!publishApprovalPreviewResult) {
      setPublishApprovalSaveError("Publish Approval Snapshot Preview를 먼저 실행하세요.");
      return;
    }
    if (!canSavePublishApproval) {
      setPublishApprovalSaveError("세 가지 acknowledgement를 모두 확인하고 현재 옵션으로 preview를 다시 실행해야 저장할 수 있습니다.");
      return;
    }

    setNotice(null);
    setPublishApprovalSaveError(null);
    setPublishApprovalSaveResult(null);
    setSavingPublishApproval(true);

    try {
      const result = await requestJson<ApiResult<PublishApprovalSaveResponse>>(`/api/content-items/${contentItemId}/publish-approval-save`, {
        method: "POST",
        body: JSON.stringify({
          mode: publishApprovalMode,
          scheduledAt: publishApprovalMode === "scheduled_publish" ? publishApprovalScheduledAt.trim() || null : null,
          timezone: publishApprovalMode === "scheduled_publish" ? publishApprovalTimezone.trim() || null : null,
          approvalSnapshotHashPreview: publishApprovalPreviewResult.approvalSnapshotHashPreview,
          tokenStateCheckedAt: publishApprovalPreviewResult.approvalSnapshotPreview.tokenStateCheckedAt,
          rollbackAcknowledged: publishApprovalRollbackAcknowledged,
          sideEffectSummaryAcknowledged: publishApprovalSideEffectAcknowledged,
          approvalPersistenceAcknowledged: publishApprovalPersistenceAcknowledged
        })
      });
      setPublishApprovalSaveResult(result.data);
      setNotice("Publish approval snapshot을 로컬 DB에 저장했습니다. Blogger publish, scheduled publish, token refresh, content status 변경은 수행하지 않았습니다.");
      await runPublishApprovalReadback();
    } catch (caught) {
      setPublishApprovalSaveError(caught instanceof Error ? caught.message : "Publish approval snapshot 저장에 실패했습니다.");
    } finally {
      setSavingPublishApproval(false);
    }
  }

  async function runPublishApprovalReadback() {
    setPublishApprovalReadbackError(null);
    setRunningPublishApprovalReadback(true);

    try {
      const result = await requestJson<ApiResult<PublishApprovalReadbackResponse>>(`/api/content-items/${contentItemId}/publish-approval-readback`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setPublishApprovalReadbackResult(result.data);
    } catch (caught) {
      setPublishApprovalReadbackError(caught instanceof Error ? caught.message : "Saved publish approval readback에 실패했습니다.");
    } finally {
      setRunningPublishApprovalReadback(false);
    }
  }

  async function runPublishApprovalExecutionGuard() {
    setNotice(null);
    setPublishApprovalExecutionGuardError(null);
    setRunningPublishApprovalExecutionGuard(true);

    try {
      const result = await requestJson<ApiResult<PublishApprovalExecutionGuardResponse>>(`/api/content-items/${contentItemId}/publish-approval-execution-guard`, {
        method: "POST",
        body: JSON.stringify({
          mode: publishApprovalMode,
          scheduledAt: publishApprovalMode === "scheduled_publish" ? publishApprovalScheduledAt.trim() || null : null,
          timezone: publishApprovalMode === "scheduled_publish" ? publishApprovalTimezone.trim() || null : null
        })
      });
      setPublishApprovalExecutionGuardResult(result.data);
      setNotice("Publish approval execution guard를 read-only로 확인했습니다. publish, scheduled publish, invalidation DB update, Blogger write는 수행하지 않았습니다.");
    } catch (caught) {
      setPublishApprovalExecutionGuardError(caught instanceof Error ? caught.message : "Publish approval execution guard에 실패했습니다.");
    } finally {
      setRunningPublishApprovalExecutionGuard(false);
    }
  }

  async function runPublishApprovalInvalidationPreview(manualInvalidationRequested = false) {
    setNotice(null);
    setPublishApprovalInvalidationPreviewError(null);
    setRunningPublishApprovalInvalidationPreview(true);

    try {
      const result = await requestJson<ApiResult<PublishApprovalInvalidationPreviewResponse>>(`/api/content-items/${contentItemId}/publish-approval-invalidation-preview`, {
        method: "POST",
        body: JSON.stringify({
          approvalId: publishApprovalExecutionGuardResult?.approvalId ?? publishApprovalReadbackResult?.latestApproval?.id ?? null,
          mode: publishApprovalMode,
          scheduledAt: publishApprovalMode === "scheduled_publish" ? publishApprovalScheduledAt.trim() || null : null,
          timezone: publishApprovalMode === "scheduled_publish" ? publishApprovalTimezone.trim() || null : null,
          manualInvalidationRequested,
          manualReason: manualInvalidationRequested ? publishApprovalManualInvalidationReason.trim() || null : null
        })
      });
      setPublishApprovalInvalidationPreviewResult(result.data);
      setNotice("Publish approval invalidation preview를 read-only로 확인했습니다. invalidatedAt/invalidatedReason DB update, publish, Blogger write는 수행하지 않았습니다.");
    } catch (caught) {
      setPublishApprovalInvalidationPreviewError(caught instanceof Error ? caught.message : "Publish approval invalidation preview에 실패했습니다.");
    } finally {
      setRunningPublishApprovalInvalidationPreview(false);
    }
  }

  async function runPublishExecutionAttemptPreview() {
    setNotice(null);
    setPublishExecutionAttemptPreviewError(null);
    setPublishExecutionAttemptSaveError(null);
    setPublishExecutionAttemptSaveResult(null);
    setRunningPublishExecutionAttemptPreview(true);

    try {
      const result = await requestJson<ApiResult<PublishExecutionAttemptPreviewResponse>>(`/api/content-items/${contentItemId}/publish-execution-attempt-preview`, {
        method: "POST",
        body: JSON.stringify({
          mode: publishApprovalMode,
          scheduledAt: publishApprovalMode === "scheduled_publish" ? publishApprovalScheduledAt.trim() || null : null,
          timezone: publishApprovalMode === "scheduled_publish" ? publishApprovalTimezone.trim() || null : null
        })
      });
      setPublishExecutionAttemptPreviewResult(result.data);
      setNotice("Publish execution attempt preview를 read-only로 확인했습니다. attempt log 저장, publish, scheduled publish, Blogger write, content mutation은 수행하지 않았습니다.");
    } catch (caught) {
      setPublishExecutionAttemptPreviewError(caught instanceof Error ? caught.message : "Publish execution attempt preview에 실패했습니다.");
    } finally {
      setRunningPublishExecutionAttemptPreview(false);
    }
  }

  async function savePublishExecutionAttemptPlan() {
    if (!publishExecutionAttemptPreviewResult?.attemptPlanHashPreview || !publishExecutionAttemptPreviewResult.approvalId) {
      setPublishExecutionAttemptSaveError("Publish Execution Attempt Preview를 먼저 실행하세요.");
      return;
    }
    if (!canSavePublishExecutionAttempt) {
      setPublishExecutionAttemptSaveError("attempt persistence / no Blogger write / no content mutation acknowledgement를 모두 확인해야 저장할 수 있습니다.");
      return;
    }

    setNotice(null);
    setPublishExecutionAttemptSaveError(null);
    setPublishExecutionAttemptSaveResult(null);
    setSavingPublishExecutionAttempt(true);

    try {
      const result = await requestJson<ApiResult<PublishExecutionAttemptSaveResponse>>(`/api/content-items/${contentItemId}/publish-execution-attempt-save`, {
        method: "POST",
        body: JSON.stringify({
          publishApprovalId: publishExecutionAttemptPreviewResult.approvalId,
          attemptPlanHashPreview: publishExecutionAttemptPreviewResult.attemptPlanHashPreview,
          attemptPersistenceAcknowledged: publishAttemptPersistenceAcknowledged,
          noBloggerWriteAcknowledged: publishAttemptNoBloggerWriteAcknowledged,
          noContentMutationAcknowledged: publishAttemptNoContentMutationAcknowledged
        })
      });
      setPublishExecutionAttemptSaveResult(result.data);
      setNotice(
        result.data.created
          ? "Publish execution attempt plan을 local DB에 저장했습니다. Blogger publish, scheduled publish, posts.update, token refresh, content status 변경은 수행하지 않았습니다."
          : "동일한 publish execution attempt plan이 이미 저장되어 existing row를 재사용했습니다. Blogger write와 content mutation은 수행하지 않았습니다."
      );
      await runPublishExecutionAttemptReadback();
    } catch (caught) {
      setPublishExecutionAttemptSaveError(caught instanceof Error ? caught.message : "Publish execution attempt plan 저장에 실패했습니다.");
    } finally {
      setSavingPublishExecutionAttempt(false);
    }
  }

  async function runPublishExecutionAttemptReadback() {
    setPublishExecutionAttemptReadbackError(null);
    setRunningPublishExecutionAttemptReadback(true);

    try {
      const result = await requestJson<ApiResult<PublishExecutionAttemptReadbackResponse>>(`/api/content-items/${contentItemId}/publish-execution-attempt-readback`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setPublishExecutionAttemptReadbackResult(result.data);
    } catch (caught) {
      setPublishExecutionAttemptReadbackError(caught instanceof Error ? caught.message : "Publish execution attempt readback에 실패했습니다.");
    } finally {
      setRunningPublishExecutionAttemptReadback(false);
    }
  }

  async function runPublishOAuthGate() {
    setNotice(null);
    setPublishOAuthGateError(null);
    setRunningPublishOAuthGate(true);

    try {
      const result = await requestJson<ApiResult<PublishOAuthGateResponse>>(`/api/content-items/${contentItemId}/publish-oauth-gate`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setPublishOAuthGateResult(result.data);
      setNotice("Publish OAuth Gate를 read-only로 확인했습니다. OAuth reconnect, token refresh, Blogger publish, scheduled publish, DB mutation은 수행하지 않았습니다.");
    } catch (caught) {
      setPublishOAuthGateError(caught instanceof Error ? caught.message : "Publish OAuth Gate 확인에 실패했습니다.");
    } finally {
      setRunningPublishOAuthGate(false);
    }
  }

  async function runBloggerDraftPreview() {
    setNotice(null);
    setBloggerDraftPreviewError(null);
    setBloggerDraftSavePreflightError(null);
    setBloggerDraftSaveError(null);
    setRunningBloggerDraftPreview(true);

    try {
      const result = await requestJson<ApiResult<BloggerDraftPayloadPreview>>(`/api/content-items/${contentItemId}/blogger-draft-preview`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setBloggerDraftPreviewResult(result.data);
      setBloggerDraftSaveConfirmationPending(false);
      setNotice("Blogger draft payload preview를 생성했습니다. DB에는 저장하지 않았고 Blogger API를 호출하지 않았습니다.");
    } catch (caught) {
      setBloggerDraftPreviewError(caught instanceof Error ? caught.message : "Blogger draft payload preview에 실패했습니다.");
    } finally {
      setRunningBloggerDraftPreview(false);
    }
  }

  async function runBloggerDraftSavePreflight() {
    setNotice(null);
    setBloggerDraftSavePreflightError(null);
    setBloggerDraftSaveError(null);
    setRunningBloggerDraftSavePreflight(true);

    try {
      const result = await requestJson<ApiResult<BloggerDraftSavePreflight>>(`/api/content-items/${contentItemId}/blogger-draft-save-preflight`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setBloggerDraftSavePreflightResult(result.data);
      setBloggerDraftSaveConfirmationPending(false);
      setNotice(
        result.data.canSaveDraft
          ? "Blogger draft save preflight가 통과되었습니다. 이 단계에서는 Blogger API write, draft save, publish, token refresh를 실행하지 않았습니다."
          : "Blogger draft save preflight를 완료했습니다. blocking reason을 해결한 뒤 다시 실행하세요. Blogger API write는 실행하지 않았습니다."
      );
    } catch (caught) {
      setBloggerDraftSavePreflightError(caught instanceof Error ? caught.message : "Blogger draft save preflight에 실패했습니다.");
    } finally {
      setRunningBloggerDraftSavePreflight(false);
    }
  }

  async function approveBloggerDraftPayload() {
    setNotice(null);
    setBloggerDraftPreviewError(null);
    setBloggerDraftSavePreflightResult(null);
    setBloggerDraftSavePreflightError(null);
    setBloggerDraftSaveError(null);
    setApprovingBloggerDraft(true);

    try {
      const result = await requestJson<
        ApiResult<{
          approvalSummary: BloggerDraftPayloadPreview["approvalSummary"];
          draftSaveImplemented: true;
          publishImplemented: false;
          tokenRefreshImplemented: false;
        }>
      >(`/api/content-items/${contentItemId}/blogger-draft-approval`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setBloggerDraftPreviewResult((current) => (current ? { ...current, approvalSummary: result.data.approvalSummary } : current));
      setBloggerDraftSaveConfirmationPending(false);
      setNotice("현재 Blogger draft payload preview snapshot을 승인했습니다. Blogger draft save는 수행하지 않았습니다.");
    } catch (caught) {
      setBloggerDraftPreviewError(caught instanceof Error ? caught.message : "Blogger draft payload approval에 실패했습니다.");
    } finally {
      setApprovingBloggerDraft(false);
    }
  }

  async function revokeBloggerDraftApproval() {
    setNotice(null);
    setBloggerDraftPreviewError(null);
    setBloggerDraftSavePreflightResult(null);
    setBloggerDraftSavePreflightError(null);
    setBloggerDraftSaveError(null);
    setRevokingBloggerDraftApproval(true);

    try {
      const result = await requestJson<
        ApiResult<{
          approvalSummary: BloggerDraftPayloadPreview["approvalSummary"];
          revoked: true;
          draftSaveImplemented: true;
          publishImplemented: false;
          tokenRefreshImplemented: false;
        }>
      >(`/api/content-items/${contentItemId}/blogger-draft-approval`, {
        method: "DELETE"
      });
      setBloggerDraftPreviewResult((current) => (current ? { ...current, approvalSummary: result.data.approvalSummary } : current));
      setBloggerDraftSaveConfirmationPending(false);
      setNotice("Blogger draft payload approval을 취소했습니다. Blogger API는 호출하지 않았습니다.");
    } catch (caught) {
      setBloggerDraftPreviewError(caught instanceof Error ? caught.message : "Blogger draft payload approval 취소에 실패했습니다.");
    } finally {
      setRevokingBloggerDraftApproval(false);
    }
  }

  async function saveBloggerDraft() {
    setNotice(null);
    setBloggerDraftPreviewError(null);
    setBloggerDraftSaveError(null);

    if (!canSaveBloggerDraft) {
      setBloggerDraftSaveConfirmationPending(false);
      setBloggerDraftSaveError("Draft Save Preflight가 통과하고 current approval snapshot이 일치할 때만 Blogger Draft 저장을 실행할 수 있습니다.");
      return;
    }

    if (!bloggerDraftSaveConfirmationPending) {
      setBloggerDraftSaveConfirmationPending(true);
      setNotice(
        "Blogger draft 저장 확인 단계입니다. 이 버튼은 실제 Blogger test blog에 draft post 1개를 생성합니다. publish/scheduled publish/posts.update/token refresh는 실행하지 않습니다. 저장하려면 같은 버튼을 한 번 더 누르세요."
      );
      return;
    }

    setSavingBloggerDraft(true);
    try {
      const result = await requestJson<ApiResult<BloggerDraftSaveApiResult>>(`/api/content-items/${contentItemId}/blogger-draft-save`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setBloggerDraftPreviewResult((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          draftSaveSummary: {
            ...current.draftSaveSummary,
            latestSuccessfulDraftSave: result.data.draftSave?.status === "success" ? result.data.draftSave : current.draftSaveSummary.latestSuccessfulDraftSave,
            latestDraftSave: result.data.draftSave,
            draftSaved: result.data.draftSave?.status === "success" ? true : current.draftSaveSummary.draftSaved
          }
        };
      });
      setBloggerDraftSavePreflightResult((current) => {
        if (!current || result.data.draftSave?.status !== "success") {
          return current;
        }
        return {
          ...current,
          ok: false,
          canSaveDraft: false,
          blockingReasons: Array.from(new Set([...current.blockingReasons, "blogger_draft_already_saved_for_approval"])),
          draftSavePreflightSummary: {
            ...current.draftSavePreflightSummary,
            draftNotSavedYetExpected: false,
            successfulSaveForCurrentApproval: true,
            duplicateSaveBlocked: true,
            latestSuccessfulDraftSave: result.data.draftSave
          }
        };
      });
      setBloggerDraftSaveConfirmationPending(false);
      setNotice(
        `Blogger draft가 생성되었습니다. publish=false, scheduledPublish=false입니다. 같은 approval의 중복 저장은 차단됩니다. Post ID: ${result.data.draftSave?.bloggerPostId ?? "-"} / Draft URL: ${
          result.data.draftSave?.bloggerPostUrl ?? "-"
        }`
      );
    } catch (caught) {
      setBloggerDraftSaveConfirmationPending(false);
      const apiError = caught instanceof Error ? (caught as ApiErrorWithData) : null;
      const draftSave = apiError?.data?.draftSave ?? null;
      setBloggerDraftSaveError(buildBloggerDraftSaveErrorMessage(apiError?.message ?? "Blogger draft 저장에 실패했습니다.", draftSave));
      if (draftSave) {
        setBloggerDraftPreviewResult((current) => {
          if (!current) {
            return current;
          }
          return {
            ...current,
            draftSaveSummary: {
              ...current.draftSaveSummary,
              latestDraftSave: draftSave
            }
          };
        });
      }
    } finally {
      setSavingBloggerDraft(false);
    }
  }

  async function generatePlanCandidate() {
    setNotice(null);
    setGenerationError(null);
    setGeneratedPlan(null);
    setCandidateText("");
    setCandidateEditMode(false);
    setCandidateDirty(false);
    setCandidateParseError(null);
    setGeneratingPlan(true);

    try {
      const result = await requestJson<ApiResult<GeneratedPlanResult>>(`/api/content-items/${contentItemId}/generate-plan`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setGeneratedPlan(result.data);
      setCandidateText(JSON.stringify(result.data.candidatePlanJson, null, 2));
      setNotice("기획서 후보를 생성했습니다. 아직 DB에 저장되지 않았습니다.");
    } catch (caught) {
      setGenerationError(caught instanceof Error ? caught.message : "기획서 후보 생성에 실패했습니다.");
    } finally {
      setGeneratingPlan(false);
    }
  }

  async function applyGeneratedPlan() {
    if (!generatedPlan?.validation.ok) {
      setGenerationError("validation을 통과한 후보만 planJson에 반영할 수 있습니다.");
      return;
    }
    if (candidateParseError) {
      setGenerationError("유효하지 않은 JSON입니다. 재검증할 수 없습니다.");
      return;
    }
    if (candidateDirty) {
      setGenerationError("편집된 후보는 재검증 후 반영할 수 있습니다.");
      return;
    }

    setApplyingPlan(true);
    setGenerationError(null);
    setNotice(null);

    try {
      const result = await requestJson<ApiResult<ContentItemAdmin>>(`/api/content-items/${contentItemId}`, {
        method: "PATCH",
        body: JSON.stringify({ planJson: generatedPlan.candidatePlanJson })
      });
      setContentItem(result.data);
      setPlanText(formatPlanJson(result.data.planJson));
      setNotice("생성 후보를 planJson에 반영했습니다. planned 전환은 기존 버튼으로 별도 수행하세요.");
    } catch (caught) {
      setGenerationError(caught instanceof Error ? caught.message : "생성 후보를 planJson에 반영하지 못했습니다.");
    } finally {
      setApplyingPlan(false);
    }
  }

  async function revalidateGeneratedPlan() {
    if (!generatedPlan) {
      return;
    }

    setGenerationError(null);
    setNotice(null);
    setCandidateParseError(null);

    const parsed = parsePlan(candidateText);
    if (!parsed.ok) {
      setCandidateParseError("유효하지 않은 JSON입니다. 재검증할 수 없습니다.");
      return;
    }

    setRevalidatingPlan(true);
    try {
      const result = await requestJson<ApiResult<Pick<GeneratedPlanResult, "candidatePlanJson" | "validation">>>(
        `/api/content-items/${contentItemId}/validate-plan`,
        {
          method: "POST",
          body: JSON.stringify({ candidatePlanJson: parsed.value })
        }
      );
      setGeneratedPlan({
        ...generatedPlan,
        candidatePlanJson: result.data.candidatePlanJson,
        validation: result.data.validation
      });
      setCandidateText(JSON.stringify(result.data.candidatePlanJson, null, 2));
      setCandidateDirty(false);
      setNotice("후보 planJson을 재검증했습니다. 아직 DB에 저장되지 않았습니다.");
    } catch (caught) {
      setGenerationError(caught instanceof Error ? caught.message : "후보 planJson 재검증에 실패했습니다.");
    } finally {
      setRevalidatingPlan(false);
    }
  }

  return (
    <>
      <section className="card">
        <span className="badge">Patch 6C</span>
        <h1>글 생성 요청 상세</h1>
        <p className="muted">수동으로 기획 JSON을 작성하고 planned 상태로 전환합니다. 자동 생성과 품질검사는 후속 패치에서 연결합니다.</p>
        <div className="form-actions">
          <Link className="button secondary" href="/content/new">
            글 생성 목록
          </Link>
          <button className="button secondary" type="button" disabled>
            기획서 자동 생성은 후속 패치에서 연결 예정
          </button>
          <button className="button secondary" type="button" disabled>
            본문 초안 생성은 아래 섹션에서 실행
          </button>
          <button className="button secondary" type="button" disabled>
            HTML 변환은 아래 dry-run에서 preview
          </button>
          <button className="button secondary" type="button" disabled>
            품질검사는 후속 패치에서 연결 예정
          </button>
        </div>
      </section>

      {error ? <div className="notice error">{error}</div> : null}
      {loading ? <div className="notice">글 생성 요청 상세 정보를 불러오는 중입니다.</div> : null}

      {contentItem ? (
        <>
          <section className="admin-section">
            <div className="section-heading">
              <div>
                <h2>Content Item</h2>
                <p className="muted">기본 정보와 연결된 블로그/서비스 프로필입니다.</p>
              </div>
            </div>
            <dl className="detail-grid">
              <DetailItem label="ID" value={contentItem.id} />
              <DetailItem label="Title" value={contentItem.title ?? "-"} />
              <DetailItem label="Mode" value={getContentModeLabel(contentItem.mode)} />
              <DetailItem label="Status" value={contentItem.status} />
              <DetailItem label="Target Keyword" value={contentItem.targetKeyword ?? "-"} />
              <DetailItem label="Blog" value={contentItem.blog?.name ?? "미지정"} />
              <DetailItem label="Brand Profile" value={contentItem.brandProfile?.name ?? "미지정"} />
              <DetailItem label="Quality Score" value={contentItem.qualityScore === null ? "아직 품질검사 전" : String(contentItem.qualityScore)} />
              <DetailItem label="Created" value={formatDate(contentItem.createdAt)} />
              <DetailItem label="Updated" value={formatDate(contentItem.updatedAt)} />
            </dl>
            <div className="read-block">
              <h3>Source Memo</h3>
              <pre>{contentItem.sourceMemo || "-"}</pre>
            </div>
          </section>

          <section className="admin-section">
            <div className="section-heading">
              <div>
                <h2>Publish Readiness Gate</h2>
                <p className="muted">
                  saved draftHtml과 quality preview 기준으로 발행 준비 상태를 확인합니다. 이 섹션은 Blogger API를 호출하지 않습니다.
                </p>
              </div>
              <button className="button secondary" type="button" disabled>
                Blogger draft save 가능 / publish는 후속 패치
              </button>
            </div>

            {publishReadinessError ? <div className="notice error">{publishReadinessError}</div> : null}
            {publishPreflightError ? <div className="notice error">{publishPreflightError}</div> : null}
            {publishApprovalPreviewError ? <div className="notice error">{publishApprovalPreviewError}</div> : null}
            {publishApprovalSaveError ? <div className="notice error">{publishApprovalSaveError}</div> : null}
            {publishApprovalReadbackError ? <div className="notice error">{publishApprovalReadbackError}</div> : null}
            {publishApprovalExecutionGuardError ? <div className="notice error">{publishApprovalExecutionGuardError}</div> : null}
            {publishApprovalInvalidationPreviewError ? <div className="notice error">{publishApprovalInvalidationPreviewError}</div> : null}
            {publishExecutionAttemptPreviewError ? <div className="notice error">{publishExecutionAttemptPreviewError}</div> : null}
            {publishExecutionAttemptSaveError ? <div className="notice error">{publishExecutionAttemptSaveError}</div> : null}
            {publishExecutionAttemptReadbackError ? <div className="notice error">{publishExecutionAttemptReadbackError}</div> : null}
            {publishOAuthGateError ? <div className="notice error">{publishOAuthGateError}</div> : null}

            <div className="read-block">
              <h3>Publish Approval Storage Options</h3>
              <div className="notice">
                이 설정은 publish approval snapshot preview와 local DB 저장에만 사용됩니다. Blogger publish, scheduled publish, posts.update, token refresh, content status
                변경은 수행하지 않습니다.
              </div>
              <div className="form-grid">
                <label>
                  <span>Approval mode</span>
                  <select
                    value={publishApprovalMode}
                    onChange={(event) => {
                      setPublishApprovalMode(event.target.value === "scheduled_publish" ? "scheduled_publish" : "publish");
                      setPublishApprovalPreviewResult(null);
                      setPublishApprovalSaveResult(null);
                      setPublishApprovalSaveError(null);
                    }}
                  >
                    <option value="publish">publish</option>
                    <option value="scheduled_publish">scheduled_publish</option>
                  </select>
                </label>
                <label>
                  <span>Scheduled At</span>
                  <input
                    type="datetime-local"
                    value={publishApprovalScheduledAt}
                    disabled={publishApprovalMode !== "scheduled_publish"}
                    onChange={(event) => {
                      setPublishApprovalScheduledAt(event.target.value);
                      setPublishApprovalPreviewResult(null);
                      setPublishApprovalSaveResult(null);
                      setPublishApprovalSaveError(null);
                    }}
                  />
                </label>
                <label>
                  <span>Timezone</span>
                  <input
                    value={publishApprovalTimezone}
                    disabled={publishApprovalMode !== "scheduled_publish"}
                    onChange={(event) => {
                      setPublishApprovalTimezone(event.target.value);
                      setPublishApprovalPreviewResult(null);
                      setPublishApprovalSaveResult(null);
                      setPublishApprovalSaveError(null);
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="form-actions">
              <button className="button" type="button" disabled={!canRunPublishReadiness} onClick={() => void runPublishReadiness()}>
                {runningPublishReadiness ? "Readiness Check 실행 중" : "Publish Readiness Check"}
              </button>
              <button className="button secondary" type="button" disabled={!canRunPublishPreflight} onClick={() => void runPublishPreflight()}>
                {runningPublishPreflight ? "Publish Preflight Dry-run 실행 중" : "Publish Preflight Dry-run"}
              </button>
              <button className="button secondary" type="button" disabled={!canRunPublishApprovalPreview} onClick={() => void runPublishApprovalPreview()}>
                {runningPublishApprovalPreview ? "Approval Snapshot Preview 실행 중" : "Publish Approval Snapshot Preview"}
              </button>
              <button className="button secondary" type="button" disabled={!canRunPublishApprovalReadback} onClick={() => void runPublishApprovalReadback()}>
                {runningPublishApprovalReadback ? "Saved Approval Readback 실행 중" : "Load Saved Publish Approvals"}
              </button>
              <button className="button secondary" type="button" disabled={!canRunPublishApprovalExecutionGuard} onClick={() => void runPublishApprovalExecutionGuard()}>
                {runningPublishApprovalExecutionGuard ? "Execution Guard 확인 중" : "Check Publish Approval Execution Guard"}
              </button>
              <button className="button secondary" type="button" disabled={!canRunPublishApprovalInvalidationPreview} onClick={() => void runPublishApprovalInvalidationPreview(false)}>
                {runningPublishApprovalInvalidationPreview ? "Invalidation Preview 실행 중" : "Check Approval Invalidation Preview"}
              </button>
              <button className="button secondary" type="button" disabled={!canRunPublishExecutionAttemptPreview} onClick={() => void runPublishExecutionAttemptPreview()}>
                {runningPublishExecutionAttemptPreview ? "Attempt Preview 실행 중" : "Check Publish Execution Attempt Preview"}
              </button>
              <button className="button secondary" type="button" disabled={!canRunPublishExecutionAttemptReadback} onClick={() => void runPublishExecutionAttemptReadback()}>
                {runningPublishExecutionAttemptReadback ? "Attempt Readback 실행 중" : "Load Saved Execution Attempts"}
              </button>
              <button className="button secondary" type="button" disabled={!canRunPublishOAuthGate} onClick={() => void runPublishOAuthGate()}>
                {runningPublishOAuthGate ? "OAuth Gate 확인 중" : "Check Publish OAuth Gate"}
              </button>
              <button className="button secondary" type="button" disabled>
                Publish는 후속 패치에서 연결 예정
              </button>
            </div>
            <div className="notice">
              Publish preflight dry-run은 실제 발행을 수행하지 않습니다. 이 점검은 read-only이며 Blogger API write, publish, scheduled publish, token refresh, DB mutation,
              LLM call을 수행하지 않습니다.
            </div>
            <div className="notice">
              Publish approval snapshot은 이제 local DB에 저장할 수 있지만, 저장은 publish 실행이 아닙니다. 저장된 approval이 있어도 canPublish=false,
              canSchedulePublish=false를 유지합니다.
            </div>

            {publishOAuthGateResult ? (
              <div className="read-block">
                <h3>Publish OAuth Gate</h3>
                <div className={publishOAuthGateResult.oauthGateSummary.reauthRequired ? "notice warning" : "notice"}>
                  <strong>
                    {publishOAuthGateResult.oauthGateSummary.reauthRequired
                      ? "Blogger OAuth 재연결이 필요합니다"
                      : "Blogger OAuth gate 상태를 확인했습니다"}
                  </strong>
                  <p>
                    이 gate는 publish/scheduled publish 실행 직전에 필요한 OAuth 연결과 access token 상태만 read-only로 확인합니다. OAuth reconnect,
                    token refresh, Blogger API write, publish, scheduled publish, content item mutation은 수행하지 않습니다.
                  </p>
                  <p>
                    saved publish approval 또는 saved execution attempt가 있어도 OAuth Gate가 통과되지 않으면 publish execution은 계속 차단됩니다.
                  </p>
                  {publishOAuthGateResult.oauthGateSummary.manualReconnectRequired ? (
                    <div className="form-actions">
                      <Link className="button secondary" href={publishOAuthGateResult.oauthGateSummary.reconnectSettingsPath}>
                        Blogger 설정에서 OAuth 재연결 확인
                      </Link>
                    </div>
                  ) : null}
                </div>
                <div className="detail-grid">
                  <DetailItem label="Checked At" value={formatDate(publishOAuthGateResult.checkedAt)} />
                  <DetailItem label="Can Proceed To Publish Execution" value={String(publishOAuthGateResult.canProceedToPublishExecution)} />
                  <DetailItem label="Can Proceed To Scheduled Publish" value={String(publishOAuthGateResult.canProceedToScheduledPublishExecution)} />
                  <DetailItem label="Can Execute Publish" value={String(publishOAuthGateResult.canExecutePublish)} />
                  <DetailItem label="Can Execute Scheduled Publish" value={String(publishOAuthGateResult.canExecuteScheduledPublish)} />
                  <DetailItem label="Connection Found" value={String(publishOAuthGateResult.oauthGateSummary.connectionFound)} />
                  <DetailItem label="Selected Blogger Blog Found" value={String(publishOAuthGateResult.oauthGateSummary.selectedBloggerBlogFound)} />
                  <DetailItem label="Target Blog ID" value={publishOAuthGateResult.oauthGateSummary.targetBloggerBlogId ?? "-"} />
                  <DetailItem label="Target Blog Name" value={publishOAuthGateResult.oauthGateSummary.targetBloggerBlogName ?? "-"} />
                  <DetailItem label="Target Blog URL" value={publishOAuthGateResult.oauthGateSummary.targetBloggerBlogUrl ?? "-"} />
                  <DetailItem label="Access Token State" value={publishOAuthGateResult.oauthGateSummary.accessTokenState} />
                  <DetailItem label="Access Token Expired" value={String(publishOAuthGateResult.oauthGateSummary.accessTokenExpired)} />
                  <DetailItem label="Reauth Required" value={String(publishOAuthGateResult.oauthGateSummary.reauthRequired)} />
                  <DetailItem label="Manual Reconnect Required" value={String(publishOAuthGateResult.oauthGateSummary.manualReconnectRequired)} />
                  <DetailItem label="Token Refresh Implemented" value={String(publishOAuthGateResult.oauthGateSummary.tokenRefreshImplemented)} />
                  <DetailItem label="Auto Reconnect Implemented" value={String(publishOAuthGateResult.oauthGateSummary.autoReconnectImplemented)} />
                  <DetailItem label="Publish Approval ID" value={publishOAuthGateResult.oauthGateSummary.publishApprovalId ?? "-"} />
                  <DetailItem label="Publish Attempt ID" value={publishOAuthGateResult.oauthGateSummary.publishExecutionAttemptId ?? "-"} />
                </div>
                <ValidationList title="OAuth Gate Blocking Reasons" items={publishOAuthGateResult.blockingReasons} emptyText="blocking reason이 없습니다." isError />
                <ValidationList title="OAuth Gate Warnings" items={publishOAuthGateResult.warnings} emptyText="warning이 없습니다." isWarning />
                <div className="read-block">
                  <h3>Manual Reconnect Completion Readiness</h3>
                  <div className="notice warning">
                    <strong>Read-only completion gate</strong>
                    <p>
                      이 summary는 `/settings/blogger`에서 수동 OAuth 재연결을 완료한 뒤 publish execution 전에 다시 확인해야 할 조건을 보여줍니다.
                    </p>
                    <p>
                      final publish preflight와 guarded publish execution design은 read-only로 제공되며, 실제 guarded Blogger publish 구현 전까지 canExecutePublish=false를 유지합니다.
                    </p>
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="Checked" value={String(publishOAuthGateResult.manualReconnectCompletionSummary.checked)} />
                    <DetailItem label="Reconnect Ready" value={String(publishOAuthGateResult.manualReconnectCompletionSummary.reconnectCompletionReady)} />
                    <DetailItem
                      label="Can Proceed To Final Preflight"
                      value={String(publishOAuthGateResult.manualReconnectCompletionSummary.canProceedToFinalPublishPreflight)}
                    />
                    <DetailItem label="Can Execute Publish" value={String(publishOAuthGateResult.manualReconnectCompletionSummary.canExecutePublish)} />
                    <DetailItem label="Connection Exists" value={String(publishOAuthGateResult.manualReconnectCompletionSummary.bloggerConnectionExists)} />
                    <DetailItem label="Selected Blog Exists" value={String(publishOAuthGateResult.manualReconnectCompletionSummary.selectedBlogExists)} />
                    <DetailItem
                      label="Selected Blog Matches Approval"
                      value={formatNullableBoolean(publishOAuthGateResult.manualReconnectCompletionSummary.selectedBlogMatchesApprovalTarget)}
                    />
                    <DetailItem label="Access Token State" value={publishOAuthGateResult.manualReconnectCompletionSummary.accessTokenState} />
                    <DetailItem label="Reauth Required" value={String(publishOAuthGateResult.manualReconnectCompletionSummary.reauthRequired)} />
                    <DetailItem label="Manual Reconnect Required" value={String(publishOAuthGateResult.manualReconnectCompletionSummary.manualReconnectRequired)} />
                    <DetailItem label="Token Refresh Implemented" value={String(publishOAuthGateResult.manualReconnectCompletionSummary.tokenRefreshImplemented)} />
                    <DetailItem label="Auto Reconnect Implemented" value={String(publishOAuthGateResult.manualReconnectCompletionSummary.autoReconnectImplemented)} />
                    <DetailItem label="Publish Approval Exists" value={String(publishOAuthGateResult.manualReconnectCompletionSummary.publishApprovalExists)} />
                    <DetailItem label="Publish Approval Still Valid" value={String(publishOAuthGateResult.manualReconnectCompletionSummary.publishApprovalStillValid)} />
                    <DetailItem label="Publish Approval Invalidated" value={String(publishOAuthGateResult.manualReconnectCompletionSummary.publishApprovalInvalidated)} />
                    <DetailItem label="Publish Attempt Exists" value={String(publishOAuthGateResult.manualReconnectCompletionSummary.publishExecutionAttemptExists)} />
                    <DetailItem
                      label="Attempt Still Planning Only"
                      value={String(publishOAuthGateResult.manualReconnectCompletionSummary.publishExecutionAttemptStillPlanningOnly)}
                    />
                    <DetailItem label="Content Still Planned" value={String(publishOAuthGateResult.manualReconnectCompletionSummary.contentStillPlanned)} />
                    <DetailItem
                      label="Draft Markdown Hash Match"
                      value={formatNullableBoolean(publishOAuthGateResult.manualReconnectCompletionSummary.draftMarkdownHashMatchesApprovalSnapshot)}
                    />
                    <DetailItem
                      label="Draft HTML Hash Match"
                      value={formatNullableBoolean(publishOAuthGateResult.manualReconnectCompletionSummary.draftHtmlHashMatchesApprovalSnapshot)}
                    />
                    <DetailItem
                      label="Target Blog Hash Match"
                      value={formatNullableBoolean(publishOAuthGateResult.manualReconnectCompletionSummary.targetBlogMatchesApprovalSnapshot)}
                    />
                  </div>
                  <ValidationList
                    title="Manual Reconnect Completion Blocking Reasons"
                    items={publishOAuthGateResult.manualReconnectCompletionSummary.blockingReasons}
                    emptyText="blocking reason이 없습니다."
                    isError
                  />
                  <ValidationList
                    title="Manual Reconnect Completion Warnings"
                    items={publishOAuthGateResult.manualReconnectCompletionSummary.warnings}
                    emptyText="warning이 없습니다."
                    isWarning
                  />
                </div>
                <div className="read-block">
                  <h3>Final Publish Execution Preflight</h3>
                  <div className="notice warning">
                    <strong>Final publish execution is still disabled until guarded Blogger publish implementation is added.</strong>
                    <p>
                      이 final preflight는 publish approval, execution attempt, OAuth gate, manual reconnect completion, content snapshot, target blog snapshot,
                      rollback placeholder, side-effect boundary를 하나로 합쳐 read-only로 보여줍니다.
                    </p>
                    <p>Blogger publish/write, posts.update, OAuth reconnect, token refresh, DB mutation, content mutation은 수행하지 않습니다.</p>
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="Checked" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.checked)} />
                    <DetailItem label="Final Preflight Ready" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.finalPreflightReady)} />
                    <DetailItem
                      label="Can Proceed To Publish Execution"
                      value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.canProceedToPublishExecution)}
                    />
                    <DetailItem
                      label="Can Proceed To Scheduled Publish"
                      value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.canProceedToScheduledPublishExecution)}
                    />
                    <DetailItem label="Can Execute Publish" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.canExecutePublish)} />
                    <DetailItem label="OAuth Gate Satisfied" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.oauthGateSatisfied)} />
                    <DetailItem
                      label="Manual Reconnect Ready"
                      value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.manualReconnectCompletionReady)}
                    />
                    <DetailItem label="Access Token State" value={publishOAuthGateResult.finalPublishExecutionPreflightSummary.accessTokenState} />
                    <DetailItem label="Reauth Required" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.reauthRequired)} />
                    <DetailItem label="Manual Reconnect Required" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.manualReconnectRequired)} />
                    <DetailItem label="Connection Exists" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.bloggerConnectionExists)} />
                    <DetailItem label="Selected Blog Exists" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.selectedBlogExists)} />
                    <DetailItem
                      label="Selected Blog Matches Approval"
                      value={formatNullableBoolean(publishOAuthGateResult.finalPublishExecutionPreflightSummary.selectedBlogMatchesApprovalTarget)}
                    />
                    <DetailItem
                      label="Target Blog Snapshot Match"
                      value={formatNullableBoolean(publishOAuthGateResult.finalPublishExecutionPreflightSummary.targetBlogSnapshotMatchesCurrentSelection)}
                    />
                    <DetailItem label="Publish Approval Exists" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.publishApprovalExists)} />
                    <DetailItem label="Publish Approval Valid" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.publishApprovalStillValid)} />
                    <DetailItem label="Publish Approval Invalidated" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.publishApprovalInvalidated)} />
                    <DetailItem label="Publish Approval ID" value={publishOAuthGateResult.finalPublishExecutionPreflightSummary.publishApprovalId ?? "-"} />
                    <DetailItem label="Attempt Exists" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.publishExecutionAttemptExists)} />
                    <DetailItem
                      label="Attempt Planning Only"
                      value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.publishExecutionAttemptStillPlanningOnly)}
                    />
                    <DetailItem label="Attempt ID" value={publishOAuthGateResult.finalPublishExecutionPreflightSummary.publishExecutionAttemptId ?? "-"} />
                    <DetailItem label="Content Exists" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.contentExists)} />
                    <DetailItem label="Content Still Planned" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.contentStillPlanned)} />
                    <DetailItem label="Content Already Published" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.contentAlreadyPublished)} />
                    <DetailItem label="Content Already Scheduled" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.contentAlreadyScheduled)} />
                    <DetailItem
                      label="Draft Markdown Match"
                      value={formatNullableBoolean(publishOAuthGateResult.finalPublishExecutionPreflightSummary.draftMarkdownHashMatchesApprovalSnapshot)}
                    />
                    <DetailItem
                      label="Draft HTML Match"
                      value={formatNullableBoolean(publishOAuthGateResult.finalPublishExecutionPreflightSummary.draftHtmlHashMatchesApprovalSnapshot)}
                    />
                    <DetailItem
                      label="Content Snapshot Match"
                      value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.contentSnapshotMatchesApproval)}
                    />
                    <DetailItem label="Rollback Acknowledged" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.rollbackPlanAcknowledged)} />
                    <DetailItem
                      label="External Write Risk Acknowledged"
                      value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.externalWriteRiskAcknowledged)}
                    />
                    <DetailItem
                      label="Final Human Approval Required"
                      value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.finalHumanApprovalRequired)}
                    />
                  </div>
                  <ValidationList
                    title="Final Publish Execution Blocking Reasons"
                    items={publishOAuthGateResult.finalPublishExecutionPreflightSummary.blockingReasons}
                    emptyText="blocking reason이 없습니다."
                    isError
                  />
                  <ValidationList
                    title="Final Publish Execution Warnings"
                    items={publishOAuthGateResult.finalPublishExecutionPreflightSummary.warnings}
                    emptyText="warning이 없습니다."
                    isWarning
                  />
                  <div className="detail-grid">
                    <DetailItem label="DB Read" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.sideEffectSummary.dbRead)} />
                    <DetailItem label="DB Write" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.sideEffectSummary.dbWrite)} />
                    <DetailItem label="Blogger Read" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.sideEffectSummary.bloggerRead)} />
                    <DetailItem label="Blogger Write" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.sideEffectSummary.bloggerWrite)} />
                    <DetailItem label="Blogger Publish" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.sideEffectSummary.bloggerPublish)} />
                    <DetailItem label="Blogger Update" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.sideEffectSummary.bloggerUpdate)} />
                    <DetailItem label="Token Refresh" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.sideEffectSummary.tokenRefresh)} />
                    <DetailItem label="OAuth Reconnect" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.sideEffectSummary.oauthReconnect)} />
                    <DetailItem label="Content Mutation" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.sideEffectSummary.contentMutation)} />
                    <DetailItem label="Approval Mutation" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.sideEffectSummary.approvalMutation)} />
                    <DetailItem label="Attempt Mutation" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.sideEffectSummary.attemptMutation)} />
                    <DetailItem label="LLM Call" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.sideEffectSummary.llmCall)} />
                    <DetailItem label="External Send" value={String(publishOAuthGateResult.finalPublishExecutionPreflightSummary.sideEffectSummary.externalSend)} />
                  </div>
                </div>
                <div className="read-block">
                  <h3>Guarded Blogger Publish Execution Design</h3>
                  <div className="notice warning">
                    <strong>Design-only guard remains active</strong>
                    <p>
                      Final preflight가 ready여도 guarded Blogger publish implementation은 아직 추가되지 않았습니다. 이 check는 Blogger write/publish,
                      posts.update, Blogger read API, OAuth reconnect, token refresh, DB mutation, content mutation을 수행하지 않습니다.
                    </p>
                    <p>
                      canExecutePublish=false, canProceedToPublishExecution=false,
                      canProceedToScheduledPublishExecution=false를 유지합니다.
                    </p>
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="Checked" value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.checked)} />
                    <DetailItem label="Design Version" value={publishOAuthGateResult.guardedPublishExecutionDesignSummary.designVersion} />
                    <DetailItem label="Implementation Status" value={publishOAuthGateResult.guardedPublishExecutionDesignSummary.implementationStatus} />
                    <DetailItem label="Final Preflight Ready" value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.finalPreflightReady)} />
                    <DetailItem
                      label="Guarded Publish Ready"
                      value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.guardedPublishImplementationReady)}
                    />
                    <DetailItem
                      label="Can Proceed To Publish Execution"
                      value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.canProceedToPublishExecution)}
                    />
                    <DetailItem
                      label="Can Proceed To Scheduled Publish"
                      value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.canProceedToScheduledPublishExecution)}
                    />
                    <DetailItem label="Can Execute Publish" value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.canExecutePublish)} />
                    <DetailItem label="OAuth Gate Satisfied" value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.oauthGateSatisfied)} />
                    <DetailItem
                      label="Manual Reconnect Ready"
                      value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.manualReconnectCompletionReady)}
                    />
                    <DetailItem
                      label="Publish Approval Valid"
                      value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.publishApprovalStillValid)}
                    />
                    <DetailItem
                      label="Attempt Planning Only"
                      value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.publishExecutionAttemptStillPlanningOnly)}
                    />
                    <DetailItem
                      label="Content Snapshot Match"
                      value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.contentSnapshotMatchesApproval)}
                    />
                    <DetailItem
                      label="Target Blog Snapshot Match"
                      value={formatNullableBoolean(publishOAuthGateResult.guardedPublishExecutionDesignSummary.targetBlogSnapshotMatchesCurrentSelection)}
                    />
                    <DetailItem label="Content Item ID" value={publishOAuthGateResult.guardedPublishExecutionDesignSummary.contentItemId} />
                    <DetailItem label="Publish Approval ID" value={publishOAuthGateResult.guardedPublishExecutionDesignSummary.publishApprovalId ?? "-"} />
                    <DetailItem label="Publish Attempt ID" value={publishOAuthGateResult.guardedPublishExecutionDesignSummary.publishExecutionAttemptId ?? "-"} />
                    <DetailItem label="Blogger Draft Save ID" value={publishOAuthGateResult.guardedPublishExecutionDesignSummary.bloggerDraftSaveId ?? "-"} />
                    <DetailItem label="Target Blog ID" value={publishOAuthGateResult.guardedPublishExecutionDesignSummary.targetBloggerBlogId ?? "-"} />
                    <DetailItem label="Target Blog Name" value={publishOAuthGateResult.guardedPublishExecutionDesignSummary.targetBloggerBlogName ?? "-"} />
                    <DetailItem label="Target Blog URL" value={publishOAuthGateResult.guardedPublishExecutionDesignSummary.targetBloggerBlogUrl ?? "-"} />
                    <DetailItem label="Existing Blogger Post ID" value={publishOAuthGateResult.guardedPublishExecutionDesignSummary.existingBloggerPostId ?? "-"} />
                    <DetailItem label="Planned Operation" value={publishOAuthGateResult.guardedPublishExecutionDesignSummary.plannedOperationKind} />
                    <DetailItem label="Planned Blogger API Action" value={publishOAuthGateResult.guardedPublishExecutionDesignSummary.plannedBloggerApiAction} />
                    <DetailItem
                      label="Blogger API Call Allowed Now"
                      value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.bloggerApiCallAllowedNow)}
                    />
                    <DetailItem
                      label="Future Blogger Write Required"
                      value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.bloggerWriteWillBeRequiredInFuturePatch)}
                    />
                    <DetailItem
                      label="Rollback Acknowledged"
                      value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.rollbackPlanAcknowledged)}
                    />
                    <DetailItem
                      label="External Write Risk Acknowledged"
                      value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.externalWriteRiskAcknowledged)}
                    />
                    <DetailItem
                      label="Final Human Approval Required"
                      value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.finalHumanApprovalRequired)}
                    />
                  </div>
                  <ValidationList
                    title="Required Before Guarded Publish Implementation"
                    items={publishOAuthGateResult.guardedPublishExecutionDesignSummary.requiredBeforeImplementation}
                    emptyText="implementation 전 필수 항목이 없습니다."
                  />
                  <ValidationList
                    title="Required Before Guarded Publish Execution"
                    items={publishOAuthGateResult.guardedPublishExecutionDesignSummary.requiredBeforeExecution}
                    emptyText="execution 전 필수 항목이 없습니다."
                  />
                  <ValidationList
                    title="Guarded Publish Design Blocking Reasons"
                    items={publishOAuthGateResult.guardedPublishExecutionDesignSummary.blockingReasons}
                    emptyText="blocking reason이 없습니다."
                    isError
                  />
                  <ValidationList
                    title="Guarded Publish Design Warnings"
                    items={publishOAuthGateResult.guardedPublishExecutionDesignSummary.warnings}
                    emptyText="warning이 없습니다."
                    isWarning
                  />
                  <div className="detail-grid">
                    <DetailItem label="Request Method" value={publishOAuthGateResult.guardedPublishExecutionDesignSummary.redactedBloggerRequestPlan.method} />
                    <DetailItem label="Endpoint Kind" value={publishOAuthGateResult.guardedPublishExecutionDesignSummary.redactedBloggerRequestPlan.endpointKind} />
                    <DetailItem
                      label="Request Blog ID"
                      value={publishOAuthGateResult.guardedPublishExecutionDesignSummary.redactedBloggerRequestPlan.bloggerBlogId ?? "-"}
                    />
                    <DetailItem
                      label="Request Post ID"
                      value={publishOAuthGateResult.guardedPublishExecutionDesignSummary.redactedBloggerRequestPlan.bloggerPostId ?? "-"}
                    />
                    <DetailItem
                      label="Uses Access Token"
                      value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.redactedBloggerRequestPlan.usesAccessToken)}
                    />
                    <DetailItem
                      label="Access Token Included"
                      value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.redactedBloggerRequestPlan.accessTokenIncluded)}
                    />
                    <DetailItem
                      label="Request Body Included"
                      value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.redactedBloggerRequestPlan.requestBodyIncluded)}
                    />
                    <DetailItem
                      label="Request Body Hash Only"
                      value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.redactedBloggerRequestPlan.requestBodyHashOnly)}
                    />
                    <DetailItem
                      label="Draft HTML Hash"
                      value={publishOAuthGateResult.guardedPublishExecutionDesignSummary.redactedBloggerRequestPlan.draftHtmlHash ?? "-"}
                    />
                    <DetailItem
                      label="Title Candidate"
                      value={publishOAuthGateResult.guardedPublishExecutionDesignSummary.redactedBloggerRequestPlan.titleCandidate ?? "-"}
                    />
                    <DetailItem
                      label="Retry Eligible By Default"
                      value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.failurePolicyDraft.retryEligibleByDefault)}
                    />
                    <DetailItem
                      label="Retry Requires Readback"
                      value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.failurePolicyDraft.retryRequiresReadback)}
                    />
                    <DetailItem
                      label="Partial Failure Manual Review"
                      value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.failurePolicyDraft.partialFailureRequiresManualReview)}
                    />
                    <DetailItem
                      label="Mutation After Blogger Success Only"
                      value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.failurePolicyDraft.contentMutationAfterBloggerSuccessOnly)}
                    />
                    <DetailItem
                      label="No Mutation On Unknown Result"
                      value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.failurePolicyDraft.noContentMutationOnUnknownBloggerResult)}
                    />
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="DB Read" value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.sideEffectSummary.dbRead)} />
                    <DetailItem label="DB Write" value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.sideEffectSummary.dbWrite)} />
                    <DetailItem label="Blogger Read" value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.sideEffectSummary.bloggerRead)} />
                    <DetailItem label="Blogger Write" value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.sideEffectSummary.bloggerWrite)} />
                    <DetailItem label="Blogger Publish" value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.sideEffectSummary.bloggerPublish)} />
                    <DetailItem label="Blogger Update" value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.sideEffectSummary.bloggerUpdate)} />
                    <DetailItem label="Blogger Draft Save" value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.sideEffectSummary.bloggerDraftSave)} />
                    <DetailItem label="Token Refresh" value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.sideEffectSummary.tokenRefresh)} />
                    <DetailItem label="OAuth Reconnect" value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.sideEffectSummary.oauthReconnect)} />
                    <DetailItem label="Content Mutation" value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.sideEffectSummary.contentMutation)} />
                    <DetailItem label="Approval Mutation" value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.sideEffectSummary.approvalMutation)} />
                    <DetailItem label="Attempt Mutation" value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.sideEffectSummary.attemptMutation)} />
                    <DetailItem label="LLM Call" value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.sideEffectSummary.llmCall)} />
                    <DetailItem label="External Send" value={String(publishOAuthGateResult.guardedPublishExecutionDesignSummary.sideEffectSummary.externalSend)} />
                  </div>
                  <div className="notice">
                    Redacted request plan은 access token, refresh token, client secret, encryptedValue, raw Blogger request/response body, full draftHtml을 포함하지 않습니다.
                  </div>
                </div>
                <ValidationList
                  title="Required Before Publish Execution"
                  items={publishOAuthGateResult.requiredBeforePublishExecution}
                  emptyText="publish execution 전 필수 항목이 없습니다."
                />
                <ValidationList
                  title="Required Before Scheduled Publish Execution"
                  items={publishOAuthGateResult.requiredBeforeScheduledPublishExecution}
                  emptyText="scheduled publish execution 전 필수 항목이 없습니다."
                />
                <div className="detail-grid">
                  <DetailItem label="DB Read" value={String(publishOAuthGateResult.sideEffectSummary.dbRead)} />
                  <DetailItem label="DB Write" value={String(publishOAuthGateResult.sideEffectSummary.dbWrite)} />
                  <DetailItem label="Blogger Read" value={String(publishOAuthGateResult.sideEffectSummary.bloggerRead)} />
                  <DetailItem label="Blogger Write" value={String(publishOAuthGateResult.sideEffectSummary.bloggerWrite)} />
                  <DetailItem label="OAuth Reconnect" value={String(publishOAuthGateResult.sideEffectSummary.oauthReconnect)} />
                  <DetailItem label="Token Refresh" value={String(publishOAuthGateResult.sideEffectSummary.tokenRefresh)} />
                  <DetailItem label="Blogger API Write" value={String(publishOAuthGateResult.sideEffectSummary.bloggerApiWrite)} />
                  <DetailItem label="Blogger Publish" value={String(publishOAuthGateResult.sideEffectSummary.bloggerPublish)} />
                  <DetailItem label="Blogger Scheduled Publish" value={String(publishOAuthGateResult.sideEffectSummary.bloggerScheduledPublish)} />
                  <DetailItem label="Blogger posts.update" value={String(publishOAuthGateResult.sideEffectSummary.bloggerPostsUpdate)} />
                  <DetailItem label="Blogger Draft Save" value={String(publishOAuthGateResult.sideEffectSummary.bloggerDraftSave)} />
                  <DetailItem label="Content Mutation" value={String(publishOAuthGateResult.sideEffectSummary.contentMutation)} />
                  <DetailItem label="Content Item Mutation" value={String(publishOAuthGateResult.sideEffectSummary.contentItemMutation)} />
                  <DetailItem label="LLM Call" value={String(publishOAuthGateResult.sideEffectSummary.llmCall)} />
                </div>
                <div className="notice">
                  Publish OAuth Gate는 access token 원문, refresh token, client secret, encryptedValue, raw OAuth response를 반환하지 않습니다.
                </div>
              </div>
            ) : (
              <div className="notice">
                Check Publish OAuth Gate를 실행하면 saved approval/attempt가 있는 상태에서도 OAuth reconnect 필요 여부를 read-only로 확인합니다.
              </div>
            )}

            {publishApprovalReadbackResult ? (
              <div className="read-block">
                <h3>Saved Publish Approval Readback</h3>
                <div className={publishApprovalReadbackResult.latestApproval ? "notice" : "notice warning"}>
                  <strong>{publishApprovalReadbackResult.latestApproval ? "Saved publish approval snapshot found" : "Saved publish approval snapshot missing"}</strong>
                  <p>
                    Saved publish approval snapshot은 로컬 DB에 저장된 승인 스냅샷입니다. 이 저장은 Blogger publish 실행이 아니며 canPublish=false /
                    canSchedulePublish=false 상태는 유지됩니다.
                  </p>
                  <p>실제 publish는 별도 preflight, OAuth 재연결, 실행 정책, 사용자 승인 후 future patch에서만 가능해야 합니다.</p>
                </div>
                <div className="detail-grid">
                  <DetailItem label="Checked At" value={formatDate(publishApprovalReadbackResult.checkedAt)} />
                  <DetailItem label="Approval Count" value={String(publishApprovalReadbackResult.count)} />
                  <DetailItem label="Active Approval Count" value={String(publishApprovalReadbackResult.activeApprovals.length)} />
                  <DetailItem label="Can Publish" value={publishApprovalReadbackResult.canPublish ? "yes" : "no"} />
                  <DetailItem label="Can Schedule Publish" value={publishApprovalReadbackResult.canSchedulePublish ? "yes" : "no"} />
                  <DetailItem label="DB Read" value={String(publishApprovalReadbackResult.sideEffectSummary.dbRead)} />
                  <DetailItem label="DB Write" value={String(publishApprovalReadbackResult.sideEffectSummary.dbWrite)} />
                  <DetailItem label="Approval Persistence" value={String(publishApprovalReadbackResult.sideEffectSummary.approvalPersistence)} />
                  <DetailItem label="Blogger API Write" value={String(publishApprovalReadbackResult.sideEffectSummary.bloggerApiWrite)} />
                  <DetailItem label="Blogger Publish" value={String(publishApprovalReadbackResult.sideEffectSummary.bloggerPublish)} />
                  <DetailItem label="Blogger Scheduled Publish" value={String(publishApprovalReadbackResult.sideEffectSummary.bloggerScheduledPublish)} />
                  <DetailItem label="Content Item Mutation" value={String(publishApprovalReadbackResult.sideEffectSummary.contentItemMutation)} />
                  <DetailItem label="Token Refresh" value={String(publishApprovalReadbackResult.sideEffectSummary.tokenRefresh)} />
                  <DetailItem label="LLM Call" value={String(publishApprovalReadbackResult.sideEffectSummary.llmCall)} />
                </div>
                {publishApprovalReadbackResult.latestApproval ? (
                  <div className="detail-grid">
                    <DetailItem label="Approval ID" value={publishApprovalReadbackResult.latestApproval.id} />
                    <DetailItem label="Mode" value={publishApprovalReadbackResult.latestApproval.mode} />
                    <DetailItem label="Status" value={publishApprovalReadbackResult.latestApproval.status} />
                    <DetailItem label="Snapshot Hash" value={publishApprovalReadbackResult.latestApproval.snapshotHash} />
                    <DetailItem label="Hash Algorithm" value={publishApprovalReadbackResult.latestApproval.hashAlgorithm} />
                    <DetailItem label="Canonicalization" value={publishApprovalReadbackResult.latestApproval.canonicalization} />
                    <DetailItem label="Target Blog ID" value={publishApprovalReadbackResult.latestApproval.targetBloggerBlogId} />
                    <DetailItem label="Target Blog Name" value={publishApprovalReadbackResult.latestApproval.targetBloggerBlogName ?? "-"} />
                    <DetailItem label="Blogger Post ID" value={publishApprovalReadbackResult.latestApproval.bloggerPostId} />
                    <DetailItem label="Draft HTML Hash" value={publishApprovalReadbackResult.latestApproval.draftHtmlHash} />
                    <DetailItem label="Draft HTML Length" value={String(publishApprovalReadbackResult.latestApproval.draftHtmlLength)} />
                    <DetailItem label="Title Candidate" value={publishApprovalReadbackResult.latestApproval.titleCandidate ?? "-"} />
                    <DetailItem label="Token State" value={publishApprovalReadbackResult.latestApproval.tokenState} />
                    <DetailItem label="Token State Checked At" value={formatDate(publishApprovalReadbackResult.latestApproval.tokenStateCheckedAt)} />
                    <DetailItem label="Rollback Acknowledged" value={String(publishApprovalReadbackResult.latestApproval.rollbackAcknowledged)} />
                    <DetailItem label="Side-effect Acknowledged" value={String(publishApprovalReadbackResult.latestApproval.sideEffectSummaryAcknowledged)} />
                    <DetailItem label="Persistence Acknowledged" value={String(publishApprovalReadbackResult.latestApproval.approvalPersistenceAcknowledged)} />
                    <DetailItem label="Created At" value={formatDate(publishApprovalReadbackResult.latestApproval.createdAt)} />
                    <DetailItem label="Invalidated At" value={publishApprovalReadbackResult.latestApproval.invalidatedAt ? formatDate(publishApprovalReadbackResult.latestApproval.invalidatedAt) : "-"} />
                    <DetailItem label="Invalidated Reason" value={publishApprovalReadbackResult.latestApproval.invalidatedReason ?? "-"} />
                  </div>
                ) : null}
                <ValidationList
                  title="Publish Approval Readback Blocking Reasons"
                  items={publishApprovalReadbackResult.blockingReasons}
                  emptyText="blocking reason이 없습니다."
                  isError
                />
                <ValidationList title="Publish Approval Readback Warnings" items={publishApprovalReadbackResult.warnings} emptyText="warning이 없습니다." isWarning />
              </div>
            ) : (
              <div className="notice">Load Saved Publish Approvals를 실행하면 저장된 local approval snapshot summary를 read-only로 확인합니다.</div>
            )}

            {publishApprovalExecutionGuardResult ? (
              <div className="read-block">
                <h3>Publish Approval Execution Guard</h3>
                <div className={publishApprovalExecutionGuardResult.approvalMatchesCurrentState ? "notice warning" : "notice error"}>
                  <strong>
                    {publishApprovalExecutionGuardResult.approvalMatchesCurrentState
                      ? "Saved publish approval matches current state"
                      : "Saved publish approval may require invalidation"}
                  </strong>
                  <p>
                    Execution Guard는 저장된 publish approval이 현재 content/Blogger draft 상태와 여전히 일치하는지 read-only로 확인합니다.
                    이 점검은 publish를 실행하지 않으며, approval을 무효화하지도 않습니다.
                  </p>
                  <p>
                    현재 canExecutePublish=false, canExecuteScheduledPublish=false입니다. 표시된 invalidation candidates는 read-only 판단 결과이며 이번 단계에서는 DB에
                    invalidatedAt을 기록하지 않습니다.
                  </p>
                </div>
                <div className="detail-grid">
                  <DetailItem label="Checked At" value={formatDate(publishApprovalExecutionGuardResult.checkedAt)} />
                  <DetailItem label="Approval ID" value={publishApprovalExecutionGuardResult.approvalId ?? "-"} />
                  <DetailItem label="Approval Found" value={String(publishApprovalExecutionGuardResult.approvalFound)} />
                  <DetailItem label="Approval Active" value={String(publishApprovalExecutionGuardResult.approvalActive)} />
                  <DetailItem label="Matches Current State" value={String(publishApprovalExecutionGuardResult.approvalMatchesCurrentState)} />
                  <DetailItem label="Can Execute Publish" value={String(publishApprovalExecutionGuardResult.canExecutePublish)} />
                  <DetailItem label="Can Execute Scheduled Publish" value={String(publishApprovalExecutionGuardResult.canExecuteScheduledPublish)} />
                  <DetailItem label="Can Publish" value={String(publishApprovalExecutionGuardResult.canPublish)} />
                  <DetailItem label="Can Schedule Publish" value={String(publishApprovalExecutionGuardResult.canSchedulePublish)} />
                  <DetailItem label="Snapshot Hash" value={publishApprovalExecutionGuardResult.approvalSnapshotHash ?? "-"} />
                </div>
                <div className="detail-grid">
                  <DetailItem label="Draft HTML Hash Matches" value={formatNullableBoolean(publishApprovalExecutionGuardResult.matchSummary.draftHtmlHashMatches)} />
                  <DetailItem label="Draft Markdown Hash Matches" value={formatNullableBoolean(publishApprovalExecutionGuardResult.matchSummary.draftMarkdownHashMatches)} />
                  <DetailItem label="Draft HTML Length Matches" value={formatNullableBoolean(publishApprovalExecutionGuardResult.matchSummary.draftHtmlLengthMatches)} />
                  <DetailItem label="Title Candidate Matches" value={formatNullableBoolean(publishApprovalExecutionGuardResult.matchSummary.titleCandidateMatches)} />
                  <DetailItem label="Target Blog Matches" value={formatNullableBoolean(publishApprovalExecutionGuardResult.matchSummary.targetBloggerBlogMatches)} />
                  <DetailItem label="Blogger Post ID Matches" value={formatNullableBoolean(publishApprovalExecutionGuardResult.matchSummary.bloggerPostIdMatches)} />
                  <DetailItem label="Content Status Matches" value={formatNullableBoolean(publishApprovalExecutionGuardResult.matchSummary.contentStatusMatches)} />
                  <DetailItem label="Mode Matches" value={formatNullableBoolean(publishApprovalExecutionGuardResult.matchSummary.modeMatches)} />
                  <DetailItem label="Scheduled At Matches" value={formatNullableBoolean(publishApprovalExecutionGuardResult.matchSummary.scheduledAtMatches)} />
                  <DetailItem label="Timezone Matches" value={formatNullableBoolean(publishApprovalExecutionGuardResult.matchSummary.timezoneMatches)} />
                  <DetailItem label="Token State Matches" value={formatNullableBoolean(publishApprovalExecutionGuardResult.matchSummary.tokenStateMatches)} />
                </div>
                <div className="detail-grid">
                  <DetailItem label="Approval Status" value={publishApprovalExecutionGuardResult.approvalSummary.status ?? "-"} />
                  <DetailItem label="Approval Mode" value={publishApprovalExecutionGuardResult.approvalSummary.mode ?? "-"} />
                  <DetailItem label="Created At" value={publishApprovalExecutionGuardResult.approvalSummary.createdAt ? formatDate(publishApprovalExecutionGuardResult.approvalSummary.createdAt) : "-"} />
                  <DetailItem label="Invalidated At" value={publishApprovalExecutionGuardResult.approvalSummary.invalidatedAt ? formatDate(publishApprovalExecutionGuardResult.approvalSummary.invalidatedAt) : "-"} />
                  <DetailItem label="Invalidated Reason" value={publishApprovalExecutionGuardResult.approvalSummary.invalidatedReason ?? "-"} />
                  <DetailItem label="Token State" value={publishApprovalExecutionGuardResult.approvalSummary.tokenState ?? "-"} />
                  <DetailItem label="DB Read" value={String(publishApprovalExecutionGuardResult.sideEffectSummary.dbRead)} />
                  <DetailItem label="DB Write" value={String(publishApprovalExecutionGuardResult.sideEffectSummary.dbWrite)} />
                  <DetailItem label="Approval Invalidation" value={String(publishApprovalExecutionGuardResult.sideEffectSummary.approvalInvalidation)} />
                  <DetailItem label="Blogger API Write" value={String(publishApprovalExecutionGuardResult.sideEffectSummary.bloggerApiWrite)} />
                  <DetailItem label="Blogger Publish" value={String(publishApprovalExecutionGuardResult.sideEffectSummary.bloggerPublish)} />
                  <DetailItem label="Blogger Scheduled Publish" value={String(publishApprovalExecutionGuardResult.sideEffectSummary.bloggerScheduledPublish)} />
                  <DetailItem label="Content Item Mutation" value={String(publishApprovalExecutionGuardResult.sideEffectSummary.contentItemMutation)} />
                  <DetailItem label="Token Refresh" value={String(publishApprovalExecutionGuardResult.sideEffectSummary.tokenRefresh)} />
                  <DetailItem label="LLM Call" value={String(publishApprovalExecutionGuardResult.sideEffectSummary.llmCall)} />
                </div>
                <ValidationList
                  title="Execution Guard Blocking Reasons"
                  items={publishApprovalExecutionGuardResult.blockingReasons}
                  emptyText="blocking reason이 없습니다."
                  isError
                />
                <ValidationList
                  title="Invalidation Candidates"
                  items={publishApprovalExecutionGuardResult.invalidationCandidates}
                  emptyText="현재 저장된 approval과 current state mismatch가 없습니다."
                  isWarning
                />
                <ValidationList title="Execution Guard Warnings" items={publishApprovalExecutionGuardResult.warnings} emptyText="warning이 없습니다." isWarning />
                <ValidationList
                  title="Required Before Execution"
                  items={publishApprovalExecutionGuardResult.requiredBeforeExecution}
                  emptyText="execution gate가 없습니다."
                />
              </div>
            ) : (
              <div className="notice">
                Check Publish Approval Execution Guard를 실행하면 저장된 approval과 현재 content/Blogger draft state match를 read-only로 확인합니다.
              </div>
            )}

            <div className="read-block">
              <h3>Publish Approval Invalidation Preview</h3>
              <div className="notice">
                Invalidation Preview는 저장된 publish approval을 실제로 무효화하지 않습니다. 이 점검은 read-only이며, invalidatedAt/invalidatedReason을 DB에
                기록하지 않습니다. 현재 canInvalidate=false입니다.
              </div>
              <label className="field">
                Manual invalidation reason dry-run
                <input
                  value={publishApprovalManualInvalidationReason}
                  onChange={(event) => setPublishApprovalManualInvalidationReason(event.target.value)}
                  placeholder="manual dry-run reason only"
                />
              </label>
              <div className="form-actions">
                <button className="button secondary" type="button" disabled={!canRunPublishApprovalInvalidationPreview} onClick={() => void runPublishApprovalInvalidationPreview(false)}>
                  {runningPublishApprovalInvalidationPreview ? "Invalidation Preview 실행 중" : "Run Normal Invalidation Preview"}
                </button>
                <button className="button secondary" type="button" disabled={!canRunPublishApprovalInvalidationPreview} onClick={() => void runPublishApprovalInvalidationPreview(true)}>
                  {runningPublishApprovalInvalidationPreview ? "Manual Dry-run 실행 중" : "Run Manual Invalidation Dry-run"}
                </button>
                <button className="button secondary" type="button" disabled>
                  Invalidate 실행은 후속 패치에서만 검토
                </button>
              </div>
              <div className="notice warning">
                Manual reason을 입력해도 이번 단계에서는 dry-run plan만 표시됩니다. 실제 approval invalidation persistence는 별도 승인된 future patch에서만
                구현합니다.
              </div>
            </div>

            {publishApprovalInvalidationPreviewResult ? (
              <div className="read-block">
                <h3>Publish Approval Invalidation Dry-run Result</h3>
                <div className={publishApprovalInvalidationPreviewResult.wouldInvalidate ? "notice warning" : "notice"}>
                  <strong>{publishApprovalInvalidationPreviewResult.wouldInvalidate ? "Invalidation would be planned" : "Invalidation is not required"}</strong>
                  <p>
                    wouldInvalidate는 계획/판단 결과입니다. canInvalidate=false이며 이 화면은 DB update를 수행하지 않습니다.
                  </p>
                </div>
                <div className="detail-grid">
                  <DetailItem label="Checked At" value={formatDate(publishApprovalInvalidationPreviewResult.checkedAt)} />
                  <DetailItem label="Approval ID" value={publishApprovalInvalidationPreviewResult.approvalId ?? "-"} />
                  <DetailItem label="Approval Found" value={String(publishApprovalInvalidationPreviewResult.approvalFound)} />
                  <DetailItem label="Approval Active" value={String(publishApprovalInvalidationPreviewResult.approvalActive)} />
                  <DetailItem label="Matches Current State" value={formatNullableBoolean(publishApprovalInvalidationPreviewResult.approvalMatchesCurrentState)} />
                  <DetailItem label="Manual Requested" value={String(publishApprovalInvalidationPreviewResult.manualInvalidationRequested)} />
                  <DetailItem label="Manual Reason" value={publishApprovalInvalidationPreviewResult.manualReason ?? "-"} />
                  <DetailItem label="Would Invalidate" value={String(publishApprovalInvalidationPreviewResult.wouldInvalidate)} />
                  <DetailItem label="Can Invalidate" value={String(publishApprovalInvalidationPreviewResult.canInvalidate)} />
                  <DetailItem label="Can Execute Publish" value={String(publishApprovalInvalidationPreviewResult.canExecutePublish)} />
                  <DetailItem label="Can Execute Scheduled Publish" value={String(publishApprovalInvalidationPreviewResult.canExecuteScheduledPublish)} />
                  <DetailItem label="Plan Table" value={publishApprovalInvalidationPreviewResult.invalidationPlan.updateTable} />
                  <DetailItem label="Plan Invalidated At" value={publishApprovalInvalidationPreviewResult.invalidationPlan.setInvalidatedAt ?? "-"} />
                  <DetailItem label="Plan Invalidated Reason" value={publishApprovalInvalidationPreviewResult.invalidationPlan.setInvalidatedReason ?? "-"} />
                  <DetailItem label="Dry-run Only" value={String(publishApprovalInvalidationPreviewResult.invalidationPlan.dryRunOnly)} />
                  <DetailItem label="DB Update Implemented" value={String(publishApprovalInvalidationPreviewResult.invalidationPlan.dbUpdateImplemented)} />
                </div>
                <div className="detail-grid">
                  <DetailItem label="DB Read" value={String(publishApprovalInvalidationPreviewResult.sideEffectSummary.dbRead)} />
                  <DetailItem label="DB Write" value={String(publishApprovalInvalidationPreviewResult.sideEffectSummary.dbWrite)} />
                  <DetailItem label="Approval Invalidation" value={String(publishApprovalInvalidationPreviewResult.sideEffectSummary.approvalInvalidation)} />
                  <DetailItem label="Blogger API Write" value={String(publishApprovalInvalidationPreviewResult.sideEffectSummary.bloggerApiWrite)} />
                  <DetailItem label="Blogger Publish" value={String(publishApprovalInvalidationPreviewResult.sideEffectSummary.bloggerPublish)} />
                  <DetailItem label="Blogger Scheduled Publish" value={String(publishApprovalInvalidationPreviewResult.sideEffectSummary.bloggerScheduledPublish)} />
                  <DetailItem label="Content Item Mutation" value={String(publishApprovalInvalidationPreviewResult.sideEffectSummary.contentItemMutation)} />
                  <DetailItem label="Token Refresh" value={String(publishApprovalInvalidationPreviewResult.sideEffectSummary.tokenRefresh)} />
                  <DetailItem label="LLM Call" value={String(publishApprovalInvalidationPreviewResult.sideEffectSummary.llmCall)} />
                </div>
                <ValidationList
                  title="Invalidation Reasons"
                  items={publishApprovalInvalidationPreviewResult.invalidationReasons}
                  emptyText="invalidation reason이 없습니다."
                  isWarning
                />
                <ValidationList
                  title="Invalidation Candidates"
                  items={publishApprovalInvalidationPreviewResult.invalidationCandidates}
                  emptyText="current state mismatch candidate가 없습니다."
                  isWarning
                />
                <ValidationList
                  title="Invalidation Preview Blocking Reasons"
                  items={publishApprovalInvalidationPreviewResult.blockingReasons}
                  emptyText="blocking reason이 없습니다."
                  isError
                />
                <ValidationList title="Invalidation Preview Warnings" items={publishApprovalInvalidationPreviewResult.warnings} emptyText="warning이 없습니다." isWarning />
              </div>
            ) : null}

            {publishExecutionAttemptPreviewResult ? (
              <div className="read-block">
                <h3>Publish Execution Attempt Preview</h3>
                <div className="notice warning">
                  <strong>Planning only: no attempt log is created</strong>
                  <p>
                    Publish Execution Attempt Preview는 실제 attempt log를 저장하지 않습니다. future publish execution attempt가 어떤 approval, hash, Blogger
                    post, failure policy와 연결될지 보여주는 read-only 계획입니다.
                  </p>
                  <p>
                    현재 canCreateAttempt=false, canExecutePublish=false, canExecuteScheduledPublish=false입니다. Create attempt, Publish, Schedule Publish,
                    Retry, Token Refresh 버튼은 이번 단계에서 제공하지 않습니다.
                  </p>
                </div>
                <div className="detail-grid">
                  <DetailItem label="Checked At" value={formatDate(publishExecutionAttemptPreviewResult.checkedAt)} />
                  <DetailItem label="Approval ID" value={publishExecutionAttemptPreviewResult.approvalId ?? "-"} />
                  <DetailItem label="Approval Snapshot Hash" value={publishExecutionAttemptPreviewResult.approvalSnapshotHash ?? "-"} />
                  <DetailItem label="Attempt Storage Implemented" value={String(publishExecutionAttemptPreviewResult.attemptStorageImplemented)} />
                  <DetailItem label="Would Create Attempt" value={String(publishExecutionAttemptPreviewResult.wouldCreateAttempt)} />
                  <DetailItem label="Can Create Attempt" value={String(publishExecutionAttemptPreviewResult.canCreateAttempt)} />
                  <DetailItem label="Can Execute Publish" value={String(publishExecutionAttemptPreviewResult.canExecutePublish)} />
                  <DetailItem label="Can Execute Scheduled Publish" value={String(publishExecutionAttemptPreviewResult.canExecuteScheduledPublish)} />
                  <DetailItem label="Can Publish" value={String(publishExecutionAttemptPreviewResult.canPublish)} />
                  <DetailItem label="Can Schedule Publish" value={String(publishExecutionAttemptPreviewResult.canSchedulePublish)} />
                  <DetailItem label="Attempt Plan Hash Preview" value={publishExecutionAttemptPreviewResult.attemptPlanHashPreview} />
                  <DetailItem label="Hash Algorithm" value={publishExecutionAttemptPreviewResult.hashAlgorithm} />
                  <DetailItem label="Canonicalization" value={publishExecutionAttemptPreviewResult.canonicalization} />
                </div>
                <div className="detail-grid">
                  <DetailItem label="Future Table" value={publishExecutionAttemptPreviewResult.plannedAttempt.futureTable} />
                  <DetailItem label="Planned Status" value={publishExecutionAttemptPreviewResult.plannedAttempt.status} />
                  <DetailItem label="Mode" value={publishExecutionAttemptPreviewResult.plannedAttempt.mode ?? "-"} />
                  <DetailItem label="Publish Approval ID" value={publishExecutionAttemptPreviewResult.plannedAttempt.publishApprovalId ?? "-"} />
                  <DetailItem label="Publish Approval Hash" value={publishExecutionAttemptPreviewResult.plannedAttempt.publishApprovalSnapshotHash ?? "-"} />
                  <DetailItem label="Target Blog ID" value={publishExecutionAttemptPreviewResult.plannedAttempt.targetBloggerBlogId ?? "-"} />
                  <DetailItem label="Blogger Post ID" value={publishExecutionAttemptPreviewResult.plannedAttempt.bloggerPostId ?? "-"} />
                  <DetailItem label="Draft HTML Hash" value={publishExecutionAttemptPreviewResult.plannedAttempt.draftHtmlHash ?? "-"} />
                  <DetailItem label="Title Candidate" value={publishExecutionAttemptPreviewResult.plannedAttempt.titleCandidate ?? "-"} />
                  <DetailItem label="Token State At Attempt" value={publishExecutionAttemptPreviewResult.plannedAttempt.tokenStateAtAttempt ?? "-"} />
                  <DetailItem label="Execution Guard Checked At" value={formatDate(publishExecutionAttemptPreviewResult.plannedAttempt.executionGuardCheckedAt)} />
                  <DetailItem label="Approval Matches Current State" value={formatNullableBoolean(publishExecutionAttemptPreviewResult.plannedAttempt.approvalMatchesCurrentState)} />
                  <DetailItem label="Retry Eligible" value={String(publishExecutionAttemptPreviewResult.plannedAttempt.retryEligible)} />
                  <DetailItem label="Content Mutation Planned" value={String(publishExecutionAttemptPreviewResult.plannedAttempt.contentMutationPlanned)} />
                  <DetailItem label="Blogger API Write Planned" value={String(publishExecutionAttemptPreviewResult.plannedAttempt.bloggerApiWritePlanned)} />
                </div>
                <div className="detail-grid">
                  <DetailItem label="DB Read" value={String(publishExecutionAttemptPreviewResult.sideEffectSummary.dbRead)} />
                  <DetailItem label="DB Write" value={String(publishExecutionAttemptPreviewResult.sideEffectSummary.dbWrite)} />
                  <DetailItem label="Attempt Persistence" value={String(publishExecutionAttemptPreviewResult.sideEffectSummary.attemptPersistence)} />
                  <DetailItem label="Blogger API Write" value={String(publishExecutionAttemptPreviewResult.sideEffectSummary.bloggerApiWrite)} />
                  <DetailItem label="Blogger Publish" value={String(publishExecutionAttemptPreviewResult.sideEffectSummary.bloggerPublish)} />
                  <DetailItem label="Blogger Scheduled Publish" value={String(publishExecutionAttemptPreviewResult.sideEffectSummary.bloggerScheduledPublish)} />
                  <DetailItem label="Blogger posts.update" value={String(publishExecutionAttemptPreviewResult.sideEffectSummary.bloggerPostsUpdate)} />
                  <DetailItem label="Blogger Draft Save" value={String(publishExecutionAttemptPreviewResult.sideEffectSummary.bloggerDraftSave)} />
                  <DetailItem label="Content Item Mutation" value={String(publishExecutionAttemptPreviewResult.sideEffectSummary.contentItemMutation)} />
                  <DetailItem label="Token Refresh" value={String(publishExecutionAttemptPreviewResult.sideEffectSummary.tokenRefresh)} />
                  <DetailItem label="LLM Call" value={String(publishExecutionAttemptPreviewResult.sideEffectSummary.llmCall)} />
                </div>
                <ValidationList
                  title="Attempt Preview Blocking Reasons"
                  items={publishExecutionAttemptPreviewResult.blockingReasons}
                  emptyText="blocking reason이 없습니다."
                  isError
                />
                <ValidationList title="Attempt Preview Warnings" items={publishExecutionAttemptPreviewResult.warnings} emptyText="warning이 없습니다." isWarning />
                <ValidationList
                  title="Invalidation Candidates"
                  items={publishExecutionAttemptPreviewResult.plannedAttempt.invalidationCandidates}
                  emptyText="current state mismatch candidate가 없습니다."
                  isWarning
                />
                <ValidationList
                  title="Required Before Attempt Storage"
                  items={publishExecutionAttemptPreviewResult.requiredBeforeAttemptStorage}
                  emptyText="attempt storage 전 필수 항목이 없습니다."
                />
                <ValidationList
                  title="Required Before Execution"
                  items={publishExecutionAttemptPreviewResult.requiredBeforeExecution}
                  emptyText="execution 전 필수 항목이 없습니다."
                />
                <ValidationList
                  title="Retry Eligible Examples"
                  items={publishExecutionAttemptPreviewResult.failurePolicySummary.retryEligibleExamples}
                  emptyText="retry eligible 예시가 없습니다."
                />
                <ValidationList
                  title="Retry Blocked Examples"
                  items={publishExecutionAttemptPreviewResult.failurePolicySummary.retryBlockedExamples}
                  emptyText="retry blocked 예시가 없습니다."
                  isWarning
                />
                <ValidationList
                  title="Partial Failure Examples"
                  items={publishExecutionAttemptPreviewResult.failurePolicySummary.partialFailureExamples}
                  emptyText="partial failure 예시가 없습니다."
                  isWarning
                />
                <ValidationList
                  title="Redaction Policy"
                  items={publishExecutionAttemptPreviewResult.redactionPolicySummary}
                  emptyText="redaction policy가 없습니다."
                />
                <ValidationList
                  title="Content Mutation Ordering"
                  items={publishExecutionAttemptPreviewResult.contentMutationOrdering}
                  emptyText="content mutation ordering policy가 없습니다."
                />
                <div className="read-block">
                  <h3>Publish Execution Attempt Storage</h3>
                  <div className="notice warning">
                    <strong>Local DB attempt plan storage only</strong>
                    <p>이 버튼은 publish execution attempt plan만 로컬 DB에 저장합니다.</p>
                    <p>Blogger publish, scheduled publish, posts.update, token refresh, content status/publishedAt/scheduledAt 변경은 수행하지 않습니다.</p>
                    <p>저장된 attempt가 있어도 실제 publish 실행은 별도 preflight와 별도 승인된 future patch에서만 가능합니다.</p>
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="DB Write Before Click" value="will write attempt plan only" />
                    <DetailItem label="Blogger API Write" value="false" />
                    <DetailItem label="Publish" value="false" />
                    <DetailItem label="Scheduled Publish" value="false" />
                    <DetailItem label="Content Item Mutation" value="false" />
                    <DetailItem label="Token Refresh" value="false" />
                    <DetailItem label="LLM Call" value="false" />
                    <DetailItem label="Can Execute Publish After Save" value="false" />
                    <DetailItem label="Can Execute Scheduled Publish After Save" value="false" />
                  </div>
                  <div className="notice">
                    <label>
                      <input
                        type="checkbox"
                        checked={publishAttemptPersistenceAcknowledged}
                        onChange={(event) => {
                          setPublishAttemptPersistenceAcknowledged(event.target.checked);
                          setPublishExecutionAttemptSaveResult(null);
                          setPublishExecutionAttemptSaveError(null);
                        }}
                      />{" "}
                      이 작업은 publish execution attempt plan을 local DB에 저장하는 작업이며 publish 실행이 아님을 확인했습니다.
                    </label>
                  </div>
                  <div className="notice">
                    <label>
                      <input
                        type="checkbox"
                        checked={publishAttemptNoBloggerWriteAcknowledged}
                        onChange={(event) => {
                          setPublishAttemptNoBloggerWriteAcknowledged(event.target.checked);
                          setPublishExecutionAttemptSaveResult(null);
                          setPublishExecutionAttemptSaveError(null);
                        }}
                      />{" "}
                      이 저장은 Blogger publish, scheduled publish, posts.update, additional draft save, token refresh를 실행하지 않음을 확인했습니다.
                    </label>
                  </div>
                  <div className="notice">
                    <label>
                      <input
                        type="checkbox"
                        checked={publishAttemptNoContentMutationAcknowledged}
                        onChange={(event) => {
                          setPublishAttemptNoContentMutationAcknowledged(event.target.checked);
                          setPublishExecutionAttemptSaveResult(null);
                          setPublishExecutionAttemptSaveError(null);
                        }}
                      />{" "}
                      이 저장은 content_items.status, qualityScore, publishedAt, scheduledAt, draftHtml, draftMarkdown을 변경하지 않음을 확인했습니다.
                    </label>
                  </div>
                  <div className="form-actions">
                    <button className="button secondary" type="button" disabled={!canSavePublishExecutionAttempt} onClick={() => void savePublishExecutionAttemptPlan()}>
                      {savingPublishExecutionAttempt ? "Attempt Plan 저장 중" : "Save Publish Execution Attempt Plan"}
                    </button>
                    <button className="button secondary" type="button" disabled={!canRunPublishExecutionAttemptReadback} onClick={() => void runPublishExecutionAttemptReadback()}>
                      {runningPublishExecutionAttemptReadback ? "Attempt Readback 실행 중" : "Load Saved Execution Attempts"}
                    </button>
                    <button className="button secondary" type="button" disabled>
                      Publish 실행은 후속 패치에서만 검토
                    </button>
                  </div>
                  {publishExecutionAttemptSaveResult ? (
                    <>
                      <div className="notice">
                        <strong>Publish execution attempt plan 저장 완료</strong>
                        <p>
                          attemptId: {publishExecutionAttemptSaveResult.attemptId} / created: {publishExecutionAttemptSaveResult.created ? "yes" : "no"} / existing:{" "}
                          {publishExecutionAttemptSaveResult.existing ? "yes" : "no"}
                        </p>
                        <p>
                          canExecutePublish: {publishExecutionAttemptSaveResult.canExecutePublish ? "yes" : "no"} / canExecuteScheduledPublish:{" "}
                          {publishExecutionAttemptSaveResult.canExecuteScheduledPublish ? "yes" : "no"}
                        </p>
                      </div>
                      <div className="detail-grid">
                        <DetailItem label="Attempt Status" value={publishExecutionAttemptSaveResult.status} />
                        <DetailItem label="Mode" value={publishExecutionAttemptSaveResult.mode} />
                        <DetailItem label="Attempt Plan Hash" value={publishExecutionAttemptSaveResult.attemptPlanHash} />
                        <DetailItem label="Publish Approval ID" value={publishExecutionAttemptSaveResult.publishApprovalId} />
                        <DetailItem label="Publish Approval Hash" value={publishExecutionAttemptSaveResult.savedAttemptSummary.publishApprovalSnapshotHash} />
                        <DetailItem label="Target Blog ID" value={publishExecutionAttemptSaveResult.savedAttemptSummary.targetBloggerBlogId ?? "-"} />
                        <DetailItem label="Blogger Post ID" value={publishExecutionAttemptSaveResult.savedAttemptSummary.bloggerPostId ?? "-"} />
                        <DetailItem label="Draft HTML Hash" value={publishExecutionAttemptSaveResult.savedAttemptSummary.draftHtmlHash ?? "-"} />
                        <DetailItem label="Token State At Attempt" value={publishExecutionAttemptSaveResult.savedAttemptSummary.tokenStateAtAttempt ?? "-"} />
                        <DetailItem
                          label="Approval Matches Current State"
                          value={formatNullableBoolean(publishExecutionAttemptSaveResult.savedAttemptSummary.approvalMatchesCurrentState)}
                        />
                        <DetailItem label="Retry Eligible" value={String(publishExecutionAttemptSaveResult.savedAttemptSummary.retryEligible)} />
                        <DetailItem label="Retry Blocked Reason" value={publishExecutionAttemptSaveResult.savedAttemptSummary.retryBlockedReason ?? "-"} />
                        <DetailItem label="Content Mutation Planned" value={String(publishExecutionAttemptSaveResult.savedAttemptSummary.contentMutationPlanned)} />
                        <DetailItem label="Content Mutation Completed" value={String(publishExecutionAttemptSaveResult.savedAttemptSummary.contentMutationCompleted)} />
                        <DetailItem label="Created At" value={formatDate(publishExecutionAttemptSaveResult.savedAttemptSummary.createdAt)} />
                        <DetailItem label="DB Write" value={String(publishExecutionAttemptSaveResult.sideEffectSummary.dbWrite)} />
                        <DetailItem label="Attempt Persistence" value={String(publishExecutionAttemptSaveResult.sideEffectSummary.attemptPersistence)} />
                        <DetailItem label="Blogger API Write" value={String(publishExecutionAttemptSaveResult.sideEffectSummary.bloggerApiWrite)} />
                        <DetailItem label="Blogger Publish" value={String(publishExecutionAttemptSaveResult.sideEffectSummary.bloggerPublish)} />
                        <DetailItem label="Blogger Scheduled Publish" value={String(publishExecutionAttemptSaveResult.sideEffectSummary.bloggerScheduledPublish)} />
                        <DetailItem label="Content Item Mutation" value={String(publishExecutionAttemptSaveResult.sideEffectSummary.contentItemMutation)} />
                        <DetailItem label="Token Refresh" value={String(publishExecutionAttemptSaveResult.sideEffectSummary.tokenRefresh)} />
                        <DetailItem label="LLM Call" value={String(publishExecutionAttemptSaveResult.sideEffectSummary.llmCall)} />
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="notice">
                Check Publish Execution Attempt Preview를 실행하면 future attempt log schema/policy plan을 read-only로 확인합니다. 실제 attempt insert,
                publish, scheduled publish, Blogger write, content item mutation은 수행하지 않습니다.
              </div>
            )}

            {publishExecutionAttemptReadbackResult ? (
              <div className="read-block">
                <h3>Saved Publish Execution Attempt Readback</h3>
                <div className={publishExecutionAttemptReadbackResult.latestAttempt ? "notice" : "notice warning"}>
                  <strong>{publishExecutionAttemptReadbackResult.latestAttempt ? "Saved attempt plan found" : "Saved attempt plan missing"}</strong>
                  <p>
                    Saved execution attempt는 local DB의 planning-only audit record입니다. 저장되어 있어도 canExecutePublish=false /
                    canExecuteScheduledPublish=false 상태를 유지합니다.
                  </p>
                  <p>Blogger publish, scheduled publish, posts.update, token refresh, content item mutation은 이 readback에서 수행하지 않습니다.</p>
                </div>
                <div className="detail-grid">
                  <DetailItem label="Checked At" value={formatDate(publishExecutionAttemptReadbackResult.checkedAt)} />
                  <DetailItem label="Attempt Count" value={String(publishExecutionAttemptReadbackResult.count)} />
                  <DetailItem label="Active Attempt Count" value={String(publishExecutionAttemptReadbackResult.activeAttempts.length)} />
                  <DetailItem label="Can Execute Publish" value={String(publishExecutionAttemptReadbackResult.canExecutePublish)} />
                  <DetailItem label="Can Execute Scheduled Publish" value={String(publishExecutionAttemptReadbackResult.canExecuteScheduledPublish)} />
                  <DetailItem label="Can Publish" value={String(publishExecutionAttemptReadbackResult.canPublish)} />
                  <DetailItem label="Can Schedule Publish" value={String(publishExecutionAttemptReadbackResult.canSchedulePublish)} />
                  <DetailItem label="DB Read" value={String(publishExecutionAttemptReadbackResult.sideEffectSummary.dbRead)} />
                  <DetailItem label="DB Write" value={String(publishExecutionAttemptReadbackResult.sideEffectSummary.dbWrite)} />
                  <DetailItem label="Attempt Persistence" value={String(publishExecutionAttemptReadbackResult.sideEffectSummary.attemptPersistence)} />
                  <DetailItem label="Blogger API Write" value={String(publishExecutionAttemptReadbackResult.sideEffectSummary.bloggerApiWrite)} />
                  <DetailItem label="Blogger Publish" value={String(publishExecutionAttemptReadbackResult.sideEffectSummary.bloggerPublish)} />
                  <DetailItem label="Blogger Scheduled Publish" value={String(publishExecutionAttemptReadbackResult.sideEffectSummary.bloggerScheduledPublish)} />
                  <DetailItem label="Content Item Mutation" value={String(publishExecutionAttemptReadbackResult.sideEffectSummary.contentItemMutation)} />
                  <DetailItem label="Token Refresh" value={String(publishExecutionAttemptReadbackResult.sideEffectSummary.tokenRefresh)} />
                  <DetailItem label="LLM Call" value={String(publishExecutionAttemptReadbackResult.sideEffectSummary.llmCall)} />
                </div>
                {publishExecutionAttemptReadbackResult.latestAttempt ? (
                  <div className="detail-grid">
                    <DetailItem label="Attempt ID" value={publishExecutionAttemptReadbackResult.latestAttempt.id} />
                    <DetailItem label="Publish Approval ID" value={publishExecutionAttemptReadbackResult.latestAttempt.publishApprovalId} />
                    <DetailItem label="Publish Approval Hash" value={publishExecutionAttemptReadbackResult.latestAttempt.publishApprovalSnapshotHash} />
                    <DetailItem label="Mode" value={publishExecutionAttemptReadbackResult.latestAttempt.mode} />
                    <DetailItem label="Status" value={publishExecutionAttemptReadbackResult.latestAttempt.status} />
                    <DetailItem label="Attempt Number" value={String(publishExecutionAttemptReadbackResult.latestAttempt.attemptNumber)} />
                    <DetailItem label="Attempt Plan Hash" value={publishExecutionAttemptReadbackResult.latestAttempt.attemptPlanHash} />
                    <DetailItem label="Hash Algorithm" value={publishExecutionAttemptReadbackResult.latestAttempt.hashAlgorithm} />
                    <DetailItem label="Canonicalization" value={publishExecutionAttemptReadbackResult.latestAttempt.canonicalization} />
                    <DetailItem label="Target Blog ID" value={publishExecutionAttemptReadbackResult.latestAttempt.targetBloggerBlogId ?? "-"} />
                    <DetailItem label="Blogger Post ID" value={publishExecutionAttemptReadbackResult.latestAttempt.bloggerPostId ?? "-"} />
                    <DetailItem label="Draft HTML Hash" value={publishExecutionAttemptReadbackResult.latestAttempt.draftHtmlHash ?? "-"} />
                    <DetailItem label="Title Candidate" value={publishExecutionAttemptReadbackResult.latestAttempt.titleCandidate ?? "-"} />
                    <DetailItem label="Token State At Attempt" value={publishExecutionAttemptReadbackResult.latestAttempt.tokenStateAtAttempt ?? "-"} />
                    <DetailItem
                      label="Approval Matches Current State"
                      value={formatNullableBoolean(publishExecutionAttemptReadbackResult.latestAttempt.approvalMatchesCurrentState)}
                    />
                    <DetailItem label="Retry Eligible" value={String(publishExecutionAttemptReadbackResult.latestAttempt.retryEligible)} />
                    <DetailItem label="Retry Blocked Reason" value={publishExecutionAttemptReadbackResult.latestAttempt.retryBlockedReason ?? "-"} />
                    <DetailItem label="Content Mutation Planned" value={String(publishExecutionAttemptReadbackResult.latestAttempt.contentMutationPlanned)} />
                    <DetailItem label="Content Mutation Completed" value={String(publishExecutionAttemptReadbackResult.latestAttempt.contentMutationCompleted)} />
                    <DetailItem label="Content Status Before" value={publishExecutionAttemptReadbackResult.latestAttempt.contentStatusBefore ?? "-"} />
                    <DetailItem label="Content Status After" value={publishExecutionAttemptReadbackResult.latestAttempt.contentStatusAfter ?? "-"} />
                    <DetailItem label="Created At" value={formatDate(publishExecutionAttemptReadbackResult.latestAttempt.createdAt)} />
                  </div>
                ) : null}
                <ValidationList
                  title="Execution Attempt Readback Blocking Reasons"
                  items={publishExecutionAttemptReadbackResult.blockingReasons}
                  emptyText="blocking reason이 없습니다."
                  isError
                />
                <ValidationList title="Execution Attempt Readback Warnings" items={publishExecutionAttemptReadbackResult.warnings} emptyText="warning이 없습니다." isWarning />
              </div>
            ) : null}

            {publishReadinessResult ? (
              <>
                <div
                  className={
                    publishReadinessResult.publishReady
                      ? "notice"
                      : publishReadinessResult.contentReady
                        ? "notice warning"
                        : "notice error"
                  }
                >
                  <strong>Publish Readiness Preview</strong>
                  <p>
                    ready: {publishReadinessResult.ready ? "yes" : "no"} / contentReady:{" "}
                    {publishReadinessResult.contentReady ? "yes" : "no"} / publishReady:{" "}
                    {publishReadinessResult.publishReady ? "yes" : "no"}
                  </p>
                  <p>
                    stage: {publishReadinessResult.stage} / {publishReadinessResult.summary}
                  </p>
                  <p>publishReady는 Blogger draft save/publish가 구현되기 전까지 false입니다.</p>
                </div>
                <div className="detail-grid">
                  <DetailItem label="Has Plan" value={publishReadinessResult.metadata.hasPlan ? "yes" : "no"} />
                  <DetailItem label="Has Draft Markdown" value={publishReadinessResult.metadata.hasDraftMarkdown ? "yes" : "no"} />
                  <DetailItem label="Has Draft HTML" value={publishReadinessResult.metadata.hasDraftHtml ? "yes" : "no"} />
                  <DetailItem label="HTML Validation" value={publishReadinessResult.metadata.htmlValidationOk ? "pass" : "fail"} />
                  <DetailItem label="Quality Score Preview" value={String(publishReadinessResult.metadata.qualityScorePreview)} />
                  <DetailItem label="Quality Grade" value={publishReadinessResult.metadata.qualityGrade} />
                  <DetailItem label="Blogger Connection" value={publishReadinessResult.metadata.bloggerConnectionStatus} />
                  <DetailItem label="Manual Approval" value={publishReadinessResult.metadata.manualApprovalStatus} />
                  <DetailItem label="Approval Match" value={publishReadinessResult.metadata.bloggerDraftApprovalMatchesCurrentPreview ? "yes" : "no"} />
                  <DetailItem label="Approval Snapshot" value={publishReadinessResult.metadata.bloggerDraftApprovalSnapshotHash ?? "-"} />
                  <DetailItem label="Approved At" value={publishReadinessResult.metadata.bloggerDraftApprovedAt ? formatDate(publishReadinessResult.metadata.bloggerDraftApprovedAt) : "-"} />
                  <DetailItem label="Blogger Draft Saved" value={publishReadinessResult.metadata.bloggerDraftSaved ? "yes" : "no"} />
                  <DetailItem label="Blogger Draft Post ID" value={publishReadinessResult.metadata.bloggerDraftPostId ?? "-"} />
                  <DetailItem label="Blogger Draft URL" value={publishReadinessResult.metadata.bloggerDraftUrl ?? "-"} />
                  <DetailItem label="Blogger Draft Saved At" value={publishReadinessResult.metadata.bloggerDraftSavedAt ? formatDate(publishReadinessResult.metadata.bloggerDraftSavedAt) : "-"} />
                </div>
                <div className="read-block">
                  <h3>Post-save Publish Readiness Status</h3>
                  <div className={publishReadinessResult.metadata.bloggerDraftSaved ? "notice" : "notice warning"}>
                    <strong>{publishReadinessResult.metadata.bloggerDraftSaved ? "Blogger draft save 완료" : "Blogger draft save 미완료"}</strong>
                    {publishReadinessResult.metadata.bloggerDraftSaved ? (
                      <>
                        <p>
                          Blogger draft save는 완료되었습니다. 이 상태는 publish-ready가 아니라 “초안 저장 완료, 발행 구현 전” 상태입니다.
                        </p>
                        <p>같은 approval에 대한 추가 Blogger draft save는 duplicate protection으로 차단됩니다.</p>
                        <p>publish/scheduled publish/posts.update/token refresh는 아직 구현하지 않습니다.</p>
                      </>
                    ) : (
                      <p>
                        아직 Blogger draft save 성공 기록이 없습니다. Publish Readiness는 화면상 preview이며, 실제 draft save는 Draft Payload Preview + Manual Approval +
                        Draft Save Preflight 이후 별도 승인으로만 수행됩니다.
                      </p>
                    )}
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="Blogger Draft Saved" value={publishReadinessResult.metadata.bloggerDraftSaved ? "yes" : "no"} />
                    <DetailItem label="Blogger Draft Post ID" value={publishReadinessResult.metadata.bloggerDraftPostId ?? "-"} />
                    <DetailItem
                      label="Blogger Draft Saved At"
                      value={publishReadinessResult.metadata.bloggerDraftSavedAt ? formatDate(publishReadinessResult.metadata.bloggerDraftSavedAt) : "-"}
                    />
                    <DetailItem label="Manual Approval Match" value={publishReadinessResult.metadata.bloggerDraftApprovalMatchesCurrentPreview ? "yes" : "no"} />
                    <DetailItem label="Duplicate Save Protection" value={postSaveDuplicateProtectionActive ? "active" : "run Draft Save Preflight to confirm"} />
                    <DetailItem label="Publish Ready" value={publishReadinessResult.publishReady ? "yes" : "no"} />
                    <DetailItem label="Top-level Ready" value={publishReadinessResult.ready ? "yes" : "no"} />
                    <DetailItem label="Publish" value="not implemented" />
                    <DetailItem label="Scheduled Publish" value="not implemented" />
                    <DetailItem label="Publish Readiness Policy" value="planning only" />
                    <DetailItem label="Required Before Publish" value="OAuth reconnect, publish preflight, manual approval, side-effect summary" />
                    <DetailItem label="Content Mutation" value="not allowed in this patch" />
                    <DetailItem label="External Rollback" value="not guaranteed" />
                    <DetailItem label="posts.update" value="not implemented" />
                    <DetailItem label="Token Refresh" value="not implemented" />
                    <DetailItem label="Draft Update Policy" value="planning only" />
                    <DetailItem label="Retry Policy" value="planning only" />
                    <DetailItem label="Duplicate Save" value={postSaveDuplicateProtectionActive ? "blocked for current approval" : "run preflight to confirm"} />
                    <DetailItem label="New Approval Before Draft Mutation" value="required by policy" />
                  </div>
                  {postSaveDuplicateProtectionActive ? (
                    <div className="notice">
                      <strong>Duplicate save protection is active.</strong>
                      <p>현재 approval snapshot으로 이미 성공한 Blogger draft가 있어 같은 approval로는 다시 저장하지 않습니다.</p>
                    </div>
                  ) : null}
                  {publishReadinessResult.metadata.bloggerDraftSaved ? <PublishScheduledPublishPolicyNotice /> : null}
                  {publishReadinessResult.metadata.bloggerDraftSaved ? <BloggerDraftUpdateRetryPolicyNotice /> : null}
                  {postSaveAccessTokenExpired ? (
                    <div className="notice warning">
                      <strong>Blogger OAuth 재연결 필요</strong>
                      <p>
                        Blogger access token이 만료되어 향후 Blogger write 전에 OAuth 재연결이 필요합니다. 이미 저장된 Blogger draft는 유지되며, 같은 approval에 대한
                        중복 저장은 계속 차단됩니다.
                      </p>
                      <p>자동 token refresh는 아직 구현되지 않았고, 이 화면은 재연결 안내와 readiness 상태만 제공합니다.</p>
                      <div className="form-actions">
                        <Link className="button secondary" href="/settings/blogger">
                          Blogger 설정에서 OAuth 재연결 확인
                        </Link>
                      </div>
                    </div>
                  ) : null}
                  {publishReadinessDraftAdminLinks ? (
                    <div className="form-actions">
                      <a className="button secondary" href={publishReadinessDraftAdminLinks.editUrl} target="_blank" rel="noreferrer">
                        Blogger 관리자에서 초안 편집 열기
                      </a>
                      <a className="button secondary" href={publishReadinessDraftAdminLinks.previewUrl} target="_blank" rel="noreferrer">
                        Blogger 초안 미리보기 열기
                      </a>
                    </div>
                  ) : null}
                  <div className="notice">
                    이 상태 블록은 Publish Readiness preview입니다. Blogger API write, publish, scheduled publish, posts.update, token refresh, LLM 호출, DB 저장을 수행하지 않습니다.
                  </div>
                </div>
                <PublishReadinessSummary result={publishReadinessResult} />
                <PublishReadinessTable checks={publishReadinessResult.checks} />
                <div className="notice">publish/scheduled publish는 수행하지 않습니다. readiness 결과도 DB에 저장하지 않습니다.</div>
              </>
            ) : (
              <div className="notice">Publish Readiness Check를 실행하면 발행 준비 gate 결과가 화면에만 생성됩니다.</div>
            )}

            {publishPreflightResult ? (
              <div className="read-block">
                <h3>Publish Preflight Dry-run</h3>
                <div className="notice warning">
                  <strong>Publish / Scheduled Publish are not implemented</strong>
                  <p>
                    canPublish: {publishPreflightResult.canPublish ? "yes" : "no"} / canSchedulePublish:{" "}
                    {publishPreflightResult.canSchedulePublish ? "yes" : "no"}
                  </p>
                  <p>
                    publish/scheduled publish는 아직 구현되지 않았고, OAuth 재연결과 별도 publish approval/preflight 설계가 필요합니다.
                  </p>
                  <p>이 dry-run은 token refresh를 수행하지 않으며 Blogger write, DB mutation, LLM call을 수행하지 않았습니다.</p>
                </div>
                {publishPreflightResult.publishPreflightSummary.accessTokenExpired ? (
                  <div className="notice warning">
                    <strong>Access token expired</strong>
                    <p>Access token이 만료되어 향후 Blogger write 전 OAuth 재연결이 필요합니다. 이 dry-run은 token refresh를 수행하지 않습니다.</p>
                    <div className="form-actions">
                      <Link className="button secondary" href="/settings/blogger">
                        Blogger 설정에서 OAuth 재연결 확인
                      </Link>
                    </div>
                  </div>
                ) : null}
                <div className="detail-grid">
                  <DetailItem label="Checked At" value={formatDate(publishPreflightResult.checkedAt)} />
                  <DetailItem label="Can Publish" value={publishPreflightResult.canPublish ? "yes" : "no"} />
                  <DetailItem label="Can Schedule Publish" value={publishPreflightResult.canSchedulePublish ? "yes" : "no"} />
                  <DetailItem label="Blogger Draft Saved" value={publishPreflightResult.publishPreflightSummary.bloggerDraftSaved ? "yes" : "no"} />
                  <DetailItem label="Blogger Blog ID" value={publishPreflightResult.publishPreflightSummary.bloggerBlogId ?? "-"} />
                  <DetailItem label="Blogger Blog Name" value={publishPreflightResult.publishPreflightSummary.bloggerBlogName ?? "-"} />
                  <DetailItem label="Blogger Post ID" value={publishPreflightResult.publishPreflightSummary.bloggerPostId ?? "-"} />
                  <DetailItem
                    label="Blogger Draft Saved At"
                    value={
                      publishPreflightResult.publishPreflightSummary.bloggerDraftSavedAt
                        ? formatDate(publishPreflightResult.publishPreflightSummary.bloggerDraftSavedAt)
                        : "-"
                    }
                  />
                  <DetailItem label="Manual Approval" value={publishPreflightResult.publishPreflightSummary.manualApprovalStatus} />
                  <DetailItem label="Approval Match" value={publishPreflightResult.publishPreflightSummary.approvalMatchesCurrentPreview ? "yes" : "no"} />
                  <DetailItem label="Approval Snapshot" value={publishPreflightResult.publishPreflightSummary.bloggerDraftApprovalSnapshotHash ?? "-"} />
                  <DetailItem label="draftHtml Hash" value={publishPreflightResult.publishPreflightSummary.draftHtmlHashPrefix ?? "-"} />
                  <DetailItem label="Title Candidate" value={publishPreflightResult.publishPreflightSummary.titleCandidate ?? "-"} />
                  <DetailItem label="Access Token Expired" value={publishPreflightResult.publishPreflightSummary.accessTokenExpired ? "yes" : "no"} />
                  <DetailItem
                    label="Duplicate Save Protection"
                    value={publishPreflightResult.publishPreflightSummary.duplicateSaveProtectionActive ? "active" : "not active"}
                  />
                  <DetailItem label="Publish Implemented" value={String(publishPreflightResult.publishPreflightSummary.publishImplemented)} />
                  <DetailItem label="Scheduled Publish Implemented" value={String(publishPreflightResult.publishPreflightSummary.scheduledPublishImplemented)} />
                  <DetailItem label="Publish Approval Implemented" value={String(publishPreflightResult.publishPreflightSummary.publishApprovalImplemented)} />
                </div>
                <PublishPreflightActionItems result={publishPreflightResult} />
                <ValidationList title="Publish Preflight Blocking Reasons" items={publishPreflightResult.blockingReasons} emptyText="blocking reason이 없습니다." isError />
                <ValidationList title="Publish Preflight Warnings" items={publishPreflightResult.warnings} emptyText="warning이 없습니다." isWarning />
                <ValidationList title="Required Before Publish" items={publishPreflightResult.requiredBeforePublish} emptyText="publish 전 필수 항목이 없습니다." />
                <ValidationList
                  title="Required Before Scheduled Publish"
                  items={publishPreflightResult.requiredBeforeScheduledPublish}
                  emptyText="scheduled publish 전 필수 항목이 없습니다."
                />
                <ValidationList
                  title="Proposed Publish Approval Snapshot Fields"
                  items={publishPreflightResult.proposedPublishApprovalSnapshotFields}
                  emptyText="snapshot field 후보가 없습니다."
                />
                <div className="detail-grid">
                  <DetailItem label="Blogger API Write" value={String(publishPreflightResult.sideEffectSummary.bloggerApiWrite)} />
                  <DetailItem label="Blogger Publish" value={String(publishPreflightResult.sideEffectSummary.bloggerPublish)} />
                  <DetailItem label="Blogger Scheduled Publish" value={String(publishPreflightResult.sideEffectSummary.bloggerScheduledPublish)} />
                  <DetailItem label="Blogger posts.update" value={String(publishPreflightResult.sideEffectSummary.bloggerPostsUpdate)} />
                  <DetailItem label="Blogger Draft Save" value={String(publishPreflightResult.sideEffectSummary.bloggerDraftSave)} />
                  <DetailItem label="Token Refresh" value={String(publishPreflightResult.sideEffectSummary.tokenRefresh)} />
                  <DetailItem label="LLM Call" value={String(publishPreflightResult.sideEffectSummary.llmCall)} />
                  <DetailItem label="Content Item Mutation" value={String(publishPreflightResult.sideEffectSummary.contentItemMutation)} />
                </div>
                <div className="notice">
                  Duplicate save protection은 draft save 안전장치이며 publish 실행 권한을 의미하지 않습니다. publish approval table/schema/migration은 이번 패치에서
                  만들지 않습니다.
                </div>
              </div>
            ) : (
              <div className="notice">Publish Preflight Dry-run을 실행하면 발행 전용 read-only 점검 결과가 화면에만 생성됩니다.</div>
            )}

            {publishApprovalPreviewResult ? (
              <div className="read-block">
                <h3>Publish Approval Snapshot Preview</h3>
                <div className="notice warning">
                  <strong>Approval preview only</strong>
                  <p>
                    canCreatePublishApproval: {publishApprovalPreviewResult.canCreatePublishApproval ? "yes" : "no"} / canPublish:{" "}
                    {publishApprovalPreviewResult.canPublish ? "yes" : "no"} / canSchedulePublish:{" "}
                    {publishApprovalPreviewResult.canSchedulePublish ? "yes" : "no"}
                  </p>
                  <p>
                    Publish approval snapshot preview는 실제 approval을 저장하지 않습니다. 이 preview는 사용자가 나중에 어떤 값에 승인하게 될지 확인하기 위한 read-only
                    점검입니다.
                  </p>
                  <p>
                    Snapshot hash preview는 현재 표시된 non-secret snapshot payload를 기준으로 계산된 미리보기 hash입니다. acknowledgement 후 별도 버튼으로 이
                    snapshot을 local DB에 저장할 수 있지만, 저장해도 publish 실행은 수행하지 않습니다.
                  </p>
                </div>
                {publishApprovalPreviewResult.approvalSnapshotPreview.tokenState === "expired_reauth_required" ? (
                  <div className="notice warning">
                    <strong>Blogger OAuth 재연결 필요</strong>
                    <p>Access token이 만료되어 향후 Blogger write 전 OAuth 재연결이 필요합니다. 이 preview는 token refresh를 수행하지 않습니다.</p>
                    <div className="form-actions">
                      <Link className="button secondary" href="/settings/blogger">
                        Blogger 설정에서 OAuth 재연결 확인
                      </Link>
                    </div>
                  </div>
                ) : null}
                <div className="detail-grid">
                  <DetailItem label="Checked At" value={formatDate(publishApprovalPreviewResult.checkedAt)} />
                  <DetailItem label="Can Create Publish Approval" value={publishApprovalPreviewResult.canCreatePublishApproval ? "yes" : "no"} />
                  <DetailItem label="Can Publish" value={publishApprovalPreviewResult.canPublish ? "yes" : "no"} />
                  <DetailItem label="Can Schedule Publish" value={publishApprovalPreviewResult.canSchedulePublish ? "yes" : "no"} />
                  <DetailItem label="Hash Algorithm" value={publishApprovalPreviewResult.hashAlgorithm} />
                  <DetailItem label="Canonicalization" value={publishApprovalPreviewResult.canonicalization} />
                  <DetailItem label="Snapshot Hash Preview" value={publishApprovalPreviewResult.approvalSnapshotHashPreview} />
                </div>
                <div className="detail-grid">
                  <DetailItem label="Content Item ID" value={publishApprovalPreviewResult.approvalSnapshotPreview.contentItemId} />
                  <DetailItem label="Content Status" value={publishApprovalPreviewResult.approvalSnapshotPreview.contentStatus ?? "-"} />
                  <DetailItem label="Draft Markdown Hash" value={publishApprovalPreviewResult.approvalSnapshotPreview.draftMarkdownHash} />
                  <DetailItem label="Draft HTML Hash" value={publishApprovalPreviewResult.approvalSnapshotPreview.draftHtmlHash} />
                  <DetailItem label="Draft HTML Length" value={String(publishApprovalPreviewResult.approvalSnapshotPreview.draftHtmlLength)} />
                  <DetailItem label="Title Candidate" value={publishApprovalPreviewResult.approvalSnapshotPreview.titleCandidate ?? "-"} />
                  <DetailItem label="Target Blogger Blog ID" value={publishApprovalPreviewResult.approvalSnapshotPreview.targetBloggerBlogId ?? "-"} />
                  <DetailItem label="Target Blogger Blog Name" value={publishApprovalPreviewResult.approvalSnapshotPreview.targetBloggerBlogName ?? "-"} />
                  <DetailItem label="Target Blogger Blog URL" value={publishApprovalPreviewResult.approvalSnapshotPreview.targetBloggerBlogUrl ?? "-"} />
                  <DetailItem label="Blogger Post ID" value={publishApprovalPreviewResult.approvalSnapshotPreview.bloggerPostId ?? "-"} />
                  <DetailItem
                    label="Blogger Draft Saved At"
                    value={
                      publishApprovalPreviewResult.approvalSnapshotPreview.bloggerDraftSavedAt
                        ? formatDate(publishApprovalPreviewResult.approvalSnapshotPreview.bloggerDraftSavedAt)
                        : "-"
                    }
                  />
                  <DetailItem label="Blogger Draft Approval ID" value={publishApprovalPreviewResult.approvalSnapshotPreview.bloggerDraftApprovalId ?? "-"} />
                  <DetailItem
                    label="Blogger Draft Approval Hash"
                    value={publishApprovalPreviewResult.approvalSnapshotPreview.bloggerDraftApprovalSnapshotHash ?? "-"}
                  />
                  <DetailItem
                    label="Approval Matches Current Preview"
                    value={publishApprovalPreviewResult.approvalSnapshotPreview.approvalMatchesCurrentPreview ? "yes" : "no"}
                  />
                  <DetailItem label="Publish Mode" value={publishApprovalPreviewResult.approvalSnapshotPreview.publishMode} />
                  <DetailItem label="Scheduled At" value={publishApprovalPreviewResult.approvalSnapshotPreview.scheduledAt ?? "-"} />
                  <DetailItem label="Timezone" value={publishApprovalPreviewResult.approvalSnapshotPreview.timezone ?? "-"} />
                  <DetailItem label="Rollback Acknowledged" value={String(publishApprovalPreviewResult.approvalSnapshotPreview.rollbackAcknowledged)} />
                  <DetailItem
                    label="Side-effect Summary Acknowledged"
                    value={String(publishApprovalPreviewResult.approvalSnapshotPreview.sideEffectSummaryAcknowledged)}
                  />
                  <DetailItem
                    label="Approval Persistence Acknowledged"
                    value={String(publishApprovalPreviewResult.approvalSnapshotPreview.approvalPersistenceAcknowledged)}
                  />
                  <DetailItem label="Token State" value={publishApprovalPreviewResult.approvalSnapshotPreview.tokenState} />
                  <DetailItem label="Token State Checked At" value={formatDate(publishApprovalPreviewResult.approvalSnapshotPreview.tokenStateCheckedAt)} />
                </div>
                <PublishApprovalPreviewActionItems result={publishApprovalPreviewResult} />
                <ValidationList
                  title="Publish Approval Preview Blocking Reasons"
                  items={publishApprovalPreviewResult.blockingReasons}
                  emptyText="blocking reason이 없습니다."
                  isError
                />
                <ValidationList title="Publish Approval Preview Warnings" items={publishApprovalPreviewResult.warnings} emptyText="warning이 없습니다." isWarning />
                <ValidationList
                  title="Required Before Approval Persistence"
                  items={publishApprovalPreviewResult.requiredBeforeApprovalPersistence}
                  emptyText="approval persistence 전 필수 항목이 없습니다."
                />
                <PublishApprovalPersistencePolicyNotice />
                <div className="read-block">
                  <h3>Save Publish Approval Snapshot</h3>
                  <div className="notice warning">
                    <strong>Local DB approval storage only</strong>
                    <p>이 버튼은 publish approval snapshot만 로컬 DB에 저장합니다.</p>
                    <p>Blogger publish, scheduled publish, posts.update, token refresh, content status 변경은 수행하지 않습니다.</p>
                    <p>저장된 approval이 있어도 실제 publish 실행은 별도 preflight와 별도 승인된 future patch에서만 가능합니다.</p>
                  </div>
                  {!publishApprovalPreviewMatchesOptions ? (
                    <div className="notice warning">현재 mode/schedule 옵션이 preview와 다릅니다. 저장 전 Publish Approval Snapshot Preview를 다시 실행하세요.</div>
                  ) : null}
                  <div className="detail-grid">
                    <DetailItem label="DB Write Before Click" value="will write approval snapshot only" />
                    <DetailItem label="Blogger API Write" value="false" />
                    <DetailItem label="Publish" value="false" />
                    <DetailItem label="Scheduled Publish" value="false" />
                    <DetailItem label="Content Item Mutation" value="false" />
                    <DetailItem label="Token Refresh" value="false" />
                    <DetailItem label="LLM Call" value="false" />
                    <DetailItem label="Can Publish After Save" value="false" />
                    <DetailItem label="Can Schedule Publish After Save" value="false" />
                  </div>
                  <div className="notice">
                    <label>
                      <input
                        type="checkbox"
                        checked={publishApprovalRollbackAcknowledged}
                        onChange={(event) => {
                          setPublishApprovalRollbackAcknowledged(event.target.checked);
                          setPublishApprovalSaveResult(null);
                          setPublishApprovalSaveError(null);
                        }}
                      />{" "}
                      Blogger publish는 외부 서비스 상태를 변경하며 rollback이 자동 보장되지 않는다는 점을 확인했습니다.
                    </label>
                  </div>
                  <div className="notice">
                    <label>
                      <input
                        type="checkbox"
                        checked={publishApprovalSideEffectAcknowledged}
                        onChange={(event) => {
                          setPublishApprovalSideEffectAcknowledged(event.target.checked);
                          setPublishApprovalSaveResult(null);
                          setPublishApprovalSaveError(null);
                        }}
                      />{" "}
                      publish/scheduled publish/content item mutation은 이번 저장에서 실행되지 않으며, future patch에서 별도 side-effect summary가 필요함을 확인했습니다.
                    </label>
                  </div>
                  <div className="notice">
                    <label>
                      <input
                        type="checkbox"
                        checked={publishApprovalPersistenceAcknowledged}
                        onChange={(event) => {
                          setPublishApprovalPersistenceAcknowledged(event.target.checked);
                          setPublishApprovalSaveResult(null);
                          setPublishApprovalSaveError(null);
                        }}
                      />{" "}
                      이 작업은 approval snapshot persistence이며 publish 실행 권한이나 publish-ready 상태를 의미하지 않음을 확인했습니다.
                    </label>
                  </div>
                  <div className="form-actions">
                    <button className="button secondary" type="button" disabled={!canSavePublishApproval} onClick={() => void savePublishApprovalSnapshot()}>
                      {savingPublishApproval ? "Publish Approval Snapshot 저장 중" : "Save Publish Approval Snapshot"}
                    </button>
                  </div>
                  {publishApprovalSaveResult ? (
                    <>
                      <div className="notice">
                        <strong>Publish approval snapshot 저장 완료</strong>
                        <p>
                          approvalId: {publishApprovalSaveResult.approvalId} / created: {publishApprovalSaveResult.created ? "yes" : "no"} / existing:{" "}
                          {publishApprovalSaveResult.existing ? "yes" : "no"}
                        </p>
                        <p>
                          canPublish: {publishApprovalSaveResult.canPublish ? "yes" : "no"} / canSchedulePublish:{" "}
                          {publishApprovalSaveResult.canSchedulePublish ? "yes" : "no"}
                        </p>
                      </div>
                      <div className="detail-grid">
                        <DetailItem label="Approval Status" value={publishApprovalSaveResult.status} />
                        <DetailItem label="Mode" value={publishApprovalSaveResult.mode} />
                        <DetailItem label="Snapshot Hash" value={publishApprovalSaveResult.snapshotHash} />
                        <DetailItem label="Hash Algorithm" value={publishApprovalSaveResult.hashAlgorithm} />
                        <DetailItem label="Canonicalization" value={publishApprovalSaveResult.canonicalization} />
                        <DetailItem label="Target Blog ID" value={publishApprovalSaveResult.savedApprovalSummary.targetBloggerBlogId ?? "-"} />
                        <DetailItem label="Blogger Post ID" value={publishApprovalSaveResult.savedApprovalSummary.bloggerPostId ?? "-"} />
                        <DetailItem label="Draft HTML Hash" value={publishApprovalSaveResult.savedApprovalSummary.draftHtmlHash} />
                        <DetailItem label="Draft HTML Length" value={String(publishApprovalSaveResult.savedApprovalSummary.draftHtmlLength)} />
                        <DetailItem label="Token State" value={publishApprovalSaveResult.savedApprovalSummary.tokenState} />
                        <DetailItem label="Created At" value={formatDate(publishApprovalSaveResult.savedApprovalSummary.createdAt)} />
                        <DetailItem label="DB Write" value={String(publishApprovalSaveResult.sideEffectSummary.dbWrite)} />
                        <DetailItem label="Approval Persistence" value={String(publishApprovalSaveResult.sideEffectSummary.approvalPersistence)} />
                        <DetailItem label="Blogger API Write" value={String(publishApprovalSaveResult.sideEffectSummary.bloggerApiWrite)} />
                        <DetailItem label="Blogger Publish" value={String(publishApprovalSaveResult.sideEffectSummary.bloggerPublish)} />
                        <DetailItem label="Blogger Scheduled Publish" value={String(publishApprovalSaveResult.sideEffectSummary.bloggerScheduledPublish)} />
                        <DetailItem label="Content Item Mutation" value={String(publishApprovalSaveResult.sideEffectSummary.contentItemMutation)} />
                        <DetailItem label="Token Refresh" value={String(publishApprovalSaveResult.sideEffectSummary.tokenRefresh)} />
                        <DetailItem label="LLM Call" value={String(publishApprovalSaveResult.sideEffectSummary.llmCall)} />
                      </div>
                    </>
                  ) : null}
                </div>
                <ValidationList title="Required Before Publish" items={publishApprovalPreviewResult.requiredBeforePublish} emptyText="publish 전 필수 항목이 없습니다." />
                <ValidationList
                  title="Required Before Scheduled Publish"
                  items={publishApprovalPreviewResult.requiredBeforeScheduledPublish}
                  emptyText="scheduled publish 전 필수 항목이 없습니다."
                />
                <div className="detail-grid">
                  <DetailItem label="Blogger API Write" value={String(publishApprovalPreviewResult.sideEffectSummary.bloggerApiWrite)} />
                  <DetailItem label="Blogger Publish" value={String(publishApprovalPreviewResult.sideEffectSummary.bloggerPublish)} />
                  <DetailItem label="Blogger Scheduled Publish" value={String(publishApprovalPreviewResult.sideEffectSummary.bloggerScheduledPublish)} />
                  <DetailItem label="Blogger posts.update" value={String(publishApprovalPreviewResult.sideEffectSummary.bloggerPostsUpdate)} />
                  <DetailItem label="Blogger Draft Save" value={String(publishApprovalPreviewResult.sideEffectSummary.bloggerDraftSave)} />
                  <DetailItem label="Token Refresh" value={String(publishApprovalPreviewResult.sideEffectSummary.tokenRefresh)} />
                  <DetailItem label="LLM Call" value={String(publishApprovalPreviewResult.sideEffectSummary.llmCall)} />
                  <DetailItem label="Content Item Mutation" value={String(publishApprovalPreviewResult.sideEffectSummary.contentItemMutation)} />
                  <DetailItem label="DB Write" value={String(publishApprovalPreviewResult.sideEffectSummary.dbWrite)} />
                  <DetailItem label="Approval Persistence" value={String(publishApprovalPreviewResult.sideEffectSummary.approvalPersistence)} />
                </div>
                <div className="notice">
                  이 preview는 read-only입니다. Blogger API write, publish, scheduled publish, token refresh, DB mutation, approval persistence, LLM call을 수행하지 않습니다.
                </div>
              </div>
            ) : (
              <div className="notice">Publish Approval Snapshot Preview를 실행하면 승인 저장 전 non-secret snapshot/hash preview가 화면에만 생성됩니다.</div>
            )}
          </section>

          <section className="admin-section">
            <div className="section-heading">
              <div>
                <h2>Blogger Draft Payload Preview</h2>
                <p className="muted">
                  저장된 draftHtml과 검증된 Blogger blog 선택 metadata로 draft payload 후보를 확인하고, 승인된 snapshot만 Blogger draft로 저장합니다.
                </p>
              </div>
              <button className="button secondary" type="button" disabled>
                Publish는 후속 패치에서 연결 예정
              </button>
            </div>

            {!contentItem.draftHtml ? <div className="notice error">저장된 draftHtml이 없습니다. 먼저 HTML 후보를 draftHtml에 반영하세요.</div> : null}
            {bloggerDraftPreviewError ? <div className="notice error">{bloggerDraftPreviewError}</div> : null}
            {bloggerDraftSavePreflightError ? <div className="notice error">{bloggerDraftSavePreflightError}</div> : null}
            {bloggerDraftSaveError ? <div className="notice error">{bloggerDraftSaveError}</div> : null}
            <div className="notice">
              저장된 draftHtml 기준으로 HTML validation, Quality Dry Run, Publish Readiness, Blogger Draft Payload Preview, Blogger Draft Save Preflight를 차례로 확인합니다.
              preflight는 점검 전용이며 Blogger API write, draft save, publish, token refresh, LLM 호출을 실행하지 않습니다.
            </div>
            <div className="notice">
              실제 Blogger draft save는 preflight 통과 전에는 저장할 수 없습니다. 다음 단계에서 사용자 명시 승인 후에만 실행되며, publish=false draft 저장만 허용합니다.
              publish/scheduled publish/token refresh는 별도 단계입니다.
            </div>

            <div className="form-actions">
              <button className="button" type="button" disabled={!canRunBloggerDraftPreview} onClick={() => void runBloggerDraftPreview()}>
                {runningBloggerDraftPreview ? "Draft Payload Preview 실행 중" : "Draft Payload Preview"}
              </button>
              <button className="button secondary" type="button" disabled={!canRunBloggerDraftSavePreflight} onClick={() => void runBloggerDraftSavePreflight()}>
                {runningBloggerDraftSavePreflight ? "Draft Save Preflight 실행 중" : "Draft Save Preflight"}
              </button>
              <button className="button secondary" type="button" disabled={!canSaveBloggerDraft} onClick={() => void saveBloggerDraft()}>
                {formatBloggerDraftSaveButtonLabel(savingBloggerDraft, bloggerDraftSaveConfirmationPending)}
              </button>
            </div>
            <div className="notice">
              Preflight 통과 후에만 Blogger Draft 저장 버튼이 활성화됩니다. 이 버튼은 Blogger draft post 1개를 생성합니다. publish, scheduled publish, posts.update,
              token refresh는 실행하지 않습니다.
            </div>
            {bloggerDraftSaveConfirmationPending ? (
              <div className="notice warning">
                Blogger draft 저장 확인 대기 중입니다. 같은 버튼을 한 번 더 누르면 guarded save route가 Blogger draft post 1개를 생성합니다. publish/scheduled
                publish/posts.update/token refresh는 실행하지 않습니다.
              </div>
            ) : null}
            {!bloggerDraftSavePreflightResult ? (
              <div className="notice warning">Blogger Draft 저장 버튼은 Draft Save Preflight가 통과하기 전까지 비활성화됩니다.</div>
            ) : bloggerDraftSavePreflightResult.draftSavePreflightSummary.duplicateSaveBlocked ? (
              <div className="notice">현재 approval에 대한 Blogger draft가 이미 저장되어 중복 저장이 차단되었습니다. 저장 버튼은 보호 상태로 비활성화됩니다.</div>
            ) : !bloggerDraftSavePreflightResult.canSaveDraft ? (
              <div className="notice warning">Draft Save Preflight가 통과하지 않았습니다. blocking reason을 해결하고 다시 실행해야 Blogger draft save를 시도할 수 있습니다.</div>
            ) : (
              <div className="notice">Draft Save Preflight가 통과했습니다. 실제 Blogger draft save는 별도 명시 승인 버튼을 눌러야만 실행됩니다.</div>
            )}

            {latestSuccessfulBloggerDraftSave ? (
              <div className="read-block">
                <h3>Blogger Draft Save Success</h3>
                <div className="notice">
                  <strong>Blogger draft save succeeded</strong>
                  <p>이 글은 Blogger draft로 저장되었고 publish는 수행하지 않았습니다.</p>
                  <p>현재 approval에 대한 Blogger draft가 이미 저장되어 중복 저장이 차단되었습니다.</p>
                  <p>posts.update, publish, scheduled publish, token refresh는 구현/실행하지 않았습니다.</p>
                  <p>content_items status/qualityScore/publishedAt/scheduledAt은 변경하지 않았습니다.</p>
                </div>
                <div className="detail-grid">
                  <DetailItem label="Save Status" value={latestSuccessfulBloggerDraftSave.status} />
                  <DetailItem label="Saved At" value={latestSuccessfulBloggerDraftSave.savedAt ? formatDate(latestSuccessfulBloggerDraftSave.savedAt) : "-"} />
                  <DetailItem label="Approval ID" value={latestSuccessfulBloggerDraftSave.approvalId} />
                  <DetailItem label="Target Blog Name" value={latestSuccessfulBloggerDraftSave.targetBloggerBlogName ?? "-"} />
                  <DetailItem label="Target Blog ID" value={latestSuccessfulBloggerDraftSave.targetBloggerBlogId} />
                  <DetailItem label="Target Blog URL" value={latestSuccessfulBloggerDraftSave.targetBloggerBlogUrl ?? "-"} />
                  <DetailItem label="Title Candidate" value={latestSuccessfulBloggerDraftSave.titleCandidate} />
                  <DetailItem label="Blogger Post ID" value={latestSuccessfulBloggerDraftSave.bloggerPostId ?? "-"} />
                  <DetailItem label="Stored Blogger Post URL" value={latestSuccessfulBloggerDraftSave.bloggerPostUrl ?? "-"} />
                  <DetailItem label="Duplicate Save Blocked" value={bloggerDraftSavePreflightResult?.draftSavePreflightSummary.duplicateSaveBlocked ? "yes" : "yes for same approval"} />
                  <DetailItem label="Publish" value="false" />
                  <DetailItem label="Scheduled Publish" value="false" />
                  <DetailItem label="Publish Readiness Policy" value="planning only" />
                  <DetailItem label="Required Before Publish" value="OAuth reconnect, publish preflight, manual approval, side-effect summary" />
                  <DetailItem label="Content Mutation" value="not allowed in this patch" />
                  <DetailItem label="External Rollback" value="not guaranteed" />
                  <DetailItem label="posts.update" value="not implemented" />
                  <DetailItem label="Token Refresh" value="not implemented" />
                  <DetailItem label="Draft Update Policy" value="planning only" />
                  <DetailItem label="Retry Policy" value="planning only" />
                  <DetailItem label="Duplicate Save" value="blocked for current approval" />
                  <DetailItem label="New Approval Before Draft Mutation" value="required by policy" />
                </div>
                <PublishScheduledPublishPolicyNotice />
                <BloggerDraftUpdateRetryPolicyNotice />
                {latestSuccessfulBloggerDraftUrlLooksLikeHome ? (
                  <div className="notice warning">
                    Blogger가 draft post에 대해 블로그 홈 URL을 반환할 수 있습니다. 초안 관리에는 아래에서 계산한 Blogger 관리자 편집/미리보기 링크가 더 유용합니다.
                  </div>
                ) : null}
                {latestSuccessfulBloggerDraftAdminLinks ? (
                  <div className="form-actions">
                    <a className="button secondary" href={latestSuccessfulBloggerDraftAdminLinks.editUrl} target="_blank" rel="noreferrer">
                      Blogger 관리자에서 초안 편집 열기
                    </a>
                    <a className="button secondary" href={latestSuccessfulBloggerDraftAdminLinks.previewUrl} target="_blank" rel="noreferrer">
                      Blogger 초안 미리보기 열기
                    </a>
                  </div>
                ) : (
                  <div className="notice warning">Blogger 관리자 링크를 계산하려면 target blog id와 Blogger post id가 모두 필요합니다.</div>
                )}
                <div className="notice">
                  다른 draft post를 만들려면 draftHtml을 의도적으로 변경하고 Blogger Draft Payload Preview와 approval snapshot을 새로 생성한 뒤 preflight를 다시 통과해야 합니다.
                </div>
              </div>
            ) : null}

            {bloggerDraftSavePreflightResult ? (
              <div className="read-block">
                <h3>Blogger Draft Save Preflight</h3>
                <div
                  className={
                    bloggerDraftSavePreflightResult.canSaveDraft || bloggerDraftSavePreflightResult.draftSavePreflightSummary.duplicateSaveBlocked
                      ? "notice"
                      : "notice warning"
                  }
                >
                  <strong>Preflight Result</strong>
                  <p>
                    ok: {bloggerDraftSavePreflightResult.ok ? "yes" : "no"} / canSaveDraft:{" "}
                    {bloggerDraftSavePreflightResult.canSaveDraft ? "yes" : "no"}
                  </p>
                  <p>preflight only입니다. Blogger write, draft save, publish, token refresh, LLM 호출, content item mutation은 수행하지 않았습니다.</p>
                </div>
                {bloggerDraftSavePreflightResult.bloggerConnectionSummary.connectionCount === 0 ? (
                  <div className="notice warning">
                    <strong>Blogger 연결이 필요합니다.</strong>
                    <p>설정 화면에서 Blogger OAuth 연결을 완료한 뒤, 대상 Blogger blog를 선택하세요. 이 화면에서는 OAuth start를 자동 호출하지 않습니다.</p>
                    <div className="form-actions">
                      <Link className="button secondary" href="/settings/blogger">
                        Blogger 설정으로 이동
                      </Link>
                    </div>
                  </div>
                ) : null}
                <BloggerDraftSaveReadinessChecklist
                  result={bloggerDraftSavePreflightResult}
                  hasSavedDraftHtml={Boolean(contentItem.draftHtml)}
                  qualityDryRunChecked={Boolean(qualityPreviewResult)}
                  publishReadinessChecked={Boolean(publishReadinessResult)}
                  draftPayloadPreviewChecked={Boolean(bloggerDraftPreviewResult)}
                  draftAlreadySaved={Boolean(bloggerDraftPreviewResult?.draftSaveSummary.draftSaved)}
                />
                <BloggerDraftSaveActionItems result={bloggerDraftSavePreflightResult} />
                <div className="detail-grid">
                  <DetailItem label="HTML Hash" value={bloggerDraftSavePreflightResult.htmlHashPrefix || "-"} />
                  <DetailItem label="HTML Length" value={String(bloggerDraftSavePreflightResult.htmlLength)} />
                  <DetailItem label="HTML Validation" value={bloggerDraftSavePreflightResult.htmlValidation.ok ? "pass" : "fail"} />
                  <DetailItem label="HTML Errors" value={String(bloggerDraftSavePreflightResult.htmlValidation.errorCount)} />
                  <DetailItem label="HTML Warnings" value={String(bloggerDraftSavePreflightResult.htmlValidation.warningCount)} />
                  <DetailItem label="Unsafe Patterns" value={String(bloggerDraftSavePreflightResult.htmlValidation.unsafePatternCount)} />
                  <DetailItem label="Quality Grade" value={bloggerDraftSavePreflightResult.qualitySummary.grade} />
                  <DetailItem label="Quality Score Preview" value={String(bloggerDraftSavePreflightResult.qualitySummary.scorePreview)} />
                  <DetailItem label="Quality Required Fails" value={String(bloggerDraftSavePreflightResult.qualitySummary.requiredFailCount)} />
                  <DetailItem label="Content Ready" value={bloggerDraftSavePreflightResult.qualitySummary.contentReady ? "yes" : "no"} />
                  <DetailItem label="Readiness Stage" value={bloggerDraftSavePreflightResult.publishReadinessSummary.stage} />
                  <DetailItem label="Publish Ready" value={bloggerDraftSavePreflightResult.publishReadinessSummary.publishReady ? "yes" : "no"} />
                  <DetailItem label="Connection Count" value={String(bloggerDraftSavePreflightResult.bloggerConnectionSummary.connectionCount)} />
                  <DetailItem label="Connection Status" value={bloggerDraftSavePreflightResult.bloggerConnectionSummary.status} />
                  <DetailItem label="Connected Email" value={bloggerDraftSavePreflightResult.bloggerConnectionSummary.connectedEmail ?? "-"} />
                  <DetailItem label="Has Client Secret Ref" value={bloggerDraftSavePreflightResult.bloggerConnectionSummary.hasClientSecretRef ? "yes" : "no"} />
                  <DetailItem label="Client Secret Configured" value={bloggerDraftSavePreflightResult.bloggerConnectionSummary.clientSecretConfigured ? "yes" : "no"} />
                  <DetailItem label="Encrypted Client Secret Stored" value={bloggerDraftSavePreflightResult.bloggerConnectionSummary.encryptedClientSecretStored ? "yes" : "no"} />
                  <DetailItem label="Has Access Token" value={bloggerDraftSavePreflightResult.bloggerConnectionSummary.hasAccessToken ? "yes" : "no"} />
                  <DetailItem label="Access Token Expired" value={bloggerDraftSavePreflightResult.bloggerConnectionSummary.accessTokenExpired ? "yes" : "no"} />
                  <DetailItem label="Token Refresh" value={bloggerDraftSavePreflightResult.bloggerConnectionSummary.tokenRefreshImplemented ? "implemented" : "not implemented"} />
                  <DetailItem label="Selected Blog" value={bloggerDraftSavePreflightResult.selectedBlogSummary.selected ? "yes" : "no"} />
                  <DetailItem label="Selected Blog ID" value={bloggerDraftSavePreflightResult.selectedBlogSummary.id ?? "-"} />
                  <DetailItem label="Selected Blog Name" value={bloggerDraftSavePreflightResult.selectedBlogSummary.name ?? "-"} />
                  <DetailItem label="Selected Blog URL" value={bloggerDraftSavePreflightResult.selectedBlogSummary.url ?? "-"} />
                  <DetailItem label="Approval Status" value={bloggerDraftSavePreflightResult.approvalSnapshotStatus.status} />
                  <DetailItem
                    label="Approval Match"
                    value={bloggerDraftSavePreflightResult.approvalSnapshotStatus.approvalMatchesCurrentPreview ? "yes" : "no"}
                  />
                  <DetailItem label="Requires Reapproval" value={bloggerDraftSavePreflightResult.approvalSnapshotStatus.requiresReapproval ? "yes" : "no"} />
                  <DetailItem label="Current Snapshot" value={bloggerDraftSavePreflightResult.approvalSnapshotStatus.currentSnapshotHashPrefix ?? "-"} />
                  <DetailItem label="Current draftHtml Hash" value={bloggerDraftSavePreflightResult.approvalSnapshotStatus.currentDraftHtmlHashPrefix ?? "-"} />
                  <DetailItem label="Payload Ready" value={bloggerDraftSavePreflightResult.draftPayloadPreviewSummary.draftPayloadReady ? "yes" : "no"} />
                  <DetailItem label="Title Candidate" value={bloggerDraftSavePreflightResult.draftPayloadPreviewSummary.titleCandidate ?? "-"} />
                  <DetailItem label="Draft Not Saved Yet" value={bloggerDraftSavePreflightResult.draftSavePreflightSummary.draftNotSavedYetExpected ? "expected" : "no"} />
                  <DetailItem
                    label="Successful Save For Approval"
                    value={bloggerDraftSavePreflightResult.draftSavePreflightSummary.successfulSaveForCurrentApproval ? "yes" : "no"}
                  />
                  <DetailItem label="Duplicate Save Blocked" value={bloggerDraftSavePreflightResult.draftSavePreflightSummary.duplicateSaveBlocked ? "yes" : "no"} />
                </div>
                {bloggerDraftSavePreflightResult.bloggerConnectionSummary.accessTokenExpired ? (
                  <div className="notice warning">
                    <strong>Blogger access token expired</strong>
                    <p>
                      현재 Blogger access token이 만료되어 추가 Blogger draft save는 불가능합니다. 이미 저장된 Blogger draft는 유지되며, 같은 approval에 대한 duplicate
                      protection도 계속 동작합니다.
                    </p>
                    <p>
                      다음 Blogger write를 하려면 Blogger OAuth 재연결이 필요합니다. 자동 token refresh는 아직 구현하지 않았고, 이 preflight는 token refresh나 Blogger
                      write를 수행하지 않습니다.
                    </p>
                    <div className="form-actions">
                      <Link className="button secondary" href="/settings/blogger">
                        Blogger 설정에서 OAuth 재연결 확인
                      </Link>
                    </div>
                  </div>
                ) : null}
                {bloggerDraftSavePreflightResult.draftSavePreflightSummary.draftNotSavedYetExpected ? (
                  <div className="notice">
                    <strong>Draft not saved yet</strong>
                    <p>아직 Blogger draft save 성공 기록이 없는 것은 첫 draft save 전 정상 상태입니다. 이 상태만으로는 draft-save preflight를 막지 않습니다.</p>
                  </div>
                ) : null}
                {bloggerDraftSavePreflightResult.draftSavePreflightSummary.duplicateSaveBlocked ? (
                  <div className="notice">
                    <strong>Duplicate draft save blocked</strong>
                    <p>현재 approval에 대한 Blogger draft가 이미 저장되어 중복 저장이 차단되었습니다.</p>
                    <p>
                      같은 approval에서는 보호 상태로 저장 버튼을 비활성화합니다. 저장된 Blogger draft를 수정하려면 posts.update, 새 approval, 새 draft save 중 어떤 정책을
                      사용할지 별도 승인된 설계가 필요합니다.
                    </p>
                  </div>
                ) : null}
                {bloggerDraftSavePreflightResult.approvalSnapshotStatus.requiresReapproval ? (
                  <div className="notice warning">
                    <strong>Manual approval 재확인이 필요합니다.</strong>
                    <p>
                      draftHtml이 바뀌면 기존 Blogger Draft Payload Preview와 approval snapshot은 stale일 수 있습니다. approval snapshot hash와 현재 draftHtml hash가
                      일치하지 않거나 approval이 없으면 Draft Payload Preview를 다시 실행하고 payload를 수동 승인하세요.
                    </p>
                  </div>
                ) : null}
                <div className="detail-grid">
                  <DetailItem label="Blogger API Write" value={String(bloggerDraftSavePreflightResult.sideEffectSummary.bloggerApiWrite)} />
                  <DetailItem label="Blogger Draft Save" value={String(bloggerDraftSavePreflightResult.sideEffectSummary.bloggerDraftSave)} />
                  <DetailItem label="Publish" value={String(bloggerDraftSavePreflightResult.sideEffectSummary.publish)} />
                  <DetailItem label="Scheduled Publish" value={String(bloggerDraftSavePreflightResult.sideEffectSummary.scheduledPublish)} />
                  <DetailItem label="Token Refresh" value={String(bloggerDraftSavePreflightResult.sideEffectSummary.tokenRefresh)} />
                  <DetailItem label="LLM Call" value={String(bloggerDraftSavePreflightResult.sideEffectSummary.llmCall)} />
                  <DetailItem label="Content Item Mutation" value={String(bloggerDraftSavePreflightResult.sideEffectSummary.contentItemMutation)} />
                </div>
                <ValidationList
                  title="Preflight Blocking Reasons"
                  items={bloggerDraftSavePreflightResult.blockingReasons}
                  emptyText="blocking reason이 없습니다."
                  isError
                />
                <ValidationList
                  title="Preflight Warnings"
                  items={bloggerDraftSavePreflightResult.warnings}
                  emptyText="warning이 없습니다."
                  isWarning
                />
              </div>
            ) : null}

            {bloggerDraftPreviewResult ? (
              <>
                <div className={bloggerDraftPreviewResult.draftPayloadReady ? "notice" : "notice error"}>
                  <strong>Blogger Draft Payload Preview</strong>
                  <p>
                    contentReady: {bloggerDraftPreviewResult.contentReady ? "yes" : "no"} / bloggerConnectionReady:{" "}
                    {bloggerDraftPreviewResult.bloggerConnectionReady ? "yes" : "no"} / selectedBlogReady:{" "}
                    {bloggerDraftPreviewResult.selectedBlogReady ? "yes" : "no"} / draftPayloadReady:{" "}
                    {bloggerDraftPreviewResult.draftPayloadReady ? "yes" : "no"}
                  </p>
                  <p>Blogger draft save는 manual approval snapshot이 현재 preview와 일치할 때만 수행합니다. publish는 수행하지 않습니다.</p>
                </div>
                <div className="detail-grid">
                  <DetailItem label="Target Blog ID" value={bloggerDraftPreviewResult.targetBlog?.id ?? "-"} />
                  <DetailItem label="Target Blog Name" value={bloggerDraftPreviewResult.targetBlog?.name ?? "-"} />
                  <DetailItem label="Target Blog URL" value={bloggerDraftPreviewResult.targetBlog?.url ?? "-"} />
                  <DetailItem label="Verified At" value={bloggerDraftPreviewResult.targetBlog?.verifiedAt ? formatDate(bloggerDraftPreviewResult.targetBlog.verifiedAt) : "-"} />
                  <DetailItem label="Title Candidate" value={bloggerDraftPreviewResult.titleCandidate ?? "-"} />
                  <DetailItem label="HTML Length" value={String(bloggerDraftPreviewResult.htmlLength)} />
                  <DetailItem label="HTML Validation" value={bloggerDraftPreviewResult.htmlSafetySummary.validationOk ? "pass" : "fail"} />
                  <DetailItem label="HTML Issues" value={String(bloggerDraftPreviewResult.htmlSafetySummary.issueCount)} />
                  <DetailItem label="HTML Warnings" value={String(bloggerDraftPreviewResult.htmlSafetySummary.warningCount)} />
                  <DetailItem label="Quality Grade" value={bloggerDraftPreviewResult.htmlSafetySummary.qualityGrade} />
                  <DetailItem label="Quality Score Preview" value={String(bloggerDraftPreviewResult.htmlSafetySummary.qualityScorePreview)} />
                  <DetailItem label="Quality Required Fails" value={String(bloggerDraftPreviewResult.htmlSafetySummary.qualityRequiredFailCount)} />
                  <DetailItem label="Blogger API Write" value={bloggerDraftPreviewResult.bloggerApiWriteImplemented ? "implemented" : "not implemented"} />
                  <DetailItem label="Blogger API Read" value={bloggerDraftPreviewResult.bloggerApiReadImplemented ? "implemented" : "not implemented"} />
                  <DetailItem label="Draft Save" value={bloggerDraftPreviewResult.draftSaveImplemented ? "implemented" : "not implemented"} />
                  <DetailItem label="Publish" value={bloggerDraftPreviewResult.publishImplemented ? "implemented" : "not implemented"} />
                </div>
                <div className={bloggerDraftPreviewResult.draftSaveSummary.draftSaved ? "notice" : "notice warning"}>
                  <strong>Blogger Draft Save</strong>
                  <p>
                    draftSaved: {bloggerDraftPreviewResult.draftSaveSummary.draftSaved ? "yes" : "no"} / publish:{" "}
                    {bloggerDraftPreviewResult.draftSaveSummary.publishImplemented ? "implemented" : "not implemented"} / scheduled publish:{" "}
                    {bloggerDraftPreviewResult.draftSaveSummary.scheduledPublishImplemented ? "implemented" : "not implemented"}
                  </p>
                  <p>posts.insert draft 저장만 지원합니다. posts.update, publish, scheduled publish, token refresh는 수행하지 않습니다.</p>
                </div>
                {bloggerDraftPreviewResult.draftSaveSummary.latestSuccessfulDraftSave ? (
                  <div className="detail-grid">
                    <DetailItem label="Saved Draft Post ID" value={bloggerDraftPreviewResult.draftSaveSummary.latestSuccessfulDraftSave.bloggerPostId ?? "-"} />
                    <DetailItem label="Saved Draft URL" value={bloggerDraftPreviewResult.draftSaveSummary.latestSuccessfulDraftSave.bloggerPostUrl ?? "-"} />
                    <DetailItem
                      label="Saved At"
                      value={
                        bloggerDraftPreviewResult.draftSaveSummary.latestSuccessfulDraftSave.savedAt
                          ? formatDate(bloggerDraftPreviewResult.draftSaveSummary.latestSuccessfulDraftSave.savedAt)
                          : "-"
                      }
                    />
                    <DetailItem label="Save Approval Snapshot" value={bloggerDraftPreviewResult.draftSaveSummary.latestSuccessfulDraftSave.snapshotHashPrefix} />
                  </div>
                ) : null}
                {bloggerDraftPreviewResult.draftSaveSummary.latestDraftSave?.status === "failed" ? (
                  <div className="notice warning">
                    <strong>Latest Draft Save Failure</strong>
                    <p>
                      code: {bloggerDraftPreviewResult.draftSaveSummary.latestDraftSave.errorCode ?? "-"} / retryable:{" "}
                      {bloggerDraftPreviewResult.draftSaveSummary.latestDraftSave.retryable ? "yes" : "no"}
                    </p>
                    <p>{bloggerDraftPreviewResult.draftSaveSummary.latestDraftSave.errorMessage ?? "safe error detail이 없습니다."}</p>
                    <p>
                      {bloggerDraftPreviewResult.draftSaveSummary.latestDraftSave.retryable
                        ? "일시적 실패일 수 있습니다. 같은 approval snapshot으로 재시도할 수 있습니다."
                        : "OAuth 재연결 또는 Blogger blog selection 재확인이 필요합니다."}
                    </p>
                  </div>
                ) : null}
                <ValidationList
                  title="Blogger Draft Preview Blocking Issues"
                  items={bloggerDraftPreviewResult.blockingIssues}
                  emptyText="blocking issue가 없습니다."
                  isError
                />
                <ValidationList
                  title="Blogger Draft Preview Warnings"
                  items={bloggerDraftPreviewResult.warnings}
                  emptyText="warning이 없습니다."
                  isWarning
                />
                <ValidationList
                  title="Labels Candidate"
                  items={bloggerDraftPreviewResult.labelsCandidate}
                  emptyText="labels 후보가 없습니다."
                />
                <div className={getBloggerDraftApprovalNoticeClass(bloggerDraftPreviewResult.approvalSummary.approvalStatus)}>
                  <strong>Blogger Draft Manual Approval</strong>
                  <p>
                    status: {bloggerDraftPreviewResult.approvalSummary.approvalStatus} / matches current preview:{" "}
                    {bloggerDraftPreviewResult.approvalSummary.approvalMatchesCurrentPreview ? "yes" : "no"}
                  </p>
                  {bloggerDraftPreviewResult.approvalSummary.approvalStatus === "stale" ? (
                    <p>draftHtml 또는 target blog/readiness가 변경되어 재승인이 필요합니다.</p>
                  ) : null}
                  {bloggerDraftPreviewResult.approvalSummary.approvalStatus === "approved" ? (
                    <p>manual approval이 현재 preview와 일치하면 Blogger draft save를 실행할 수 있습니다.</p>
                  ) : null}
                </div>
                <div className="detail-grid">
                  <DetailItem label="Current Snapshot" value={bloggerDraftPreviewResult.approvalSummary.currentSnapshotHashPrefix ?? "-"} />
                  <DetailItem label="Current draftHtml Hash" value={bloggerDraftPreviewResult.approvalSummary.currentDraftHtmlHashPrefix ?? "-"} />
                  <DetailItem label="Approval ID" value={bloggerDraftPreviewResult.approvalSummary.approval?.id ?? "-"} />
                  <DetailItem label="Approval Snapshot" value={bloggerDraftPreviewResult.approvalSummary.approval?.snapshotHashPrefix ?? "-"} />
                  <DetailItem label="Approval draftHtml Hash" value={bloggerDraftPreviewResult.approvalSummary.approval?.draftHtmlHashPrefix ?? "-"} />
                  <DetailItem
                    label="Approved At"
                    value={bloggerDraftPreviewResult.approvalSummary.approval?.approvedAt ? formatDate(bloggerDraftPreviewResult.approvalSummary.approval.approvedAt) : "-"}
                  />
                  <DetailItem label="Approved By" value={bloggerDraftPreviewResult.approvalSummary.approval?.approvedBy ?? "-"} />
                  <DetailItem label="Revoked At" value={bloggerDraftPreviewResult.approvalSummary.approval?.revokedAt ? formatDate(bloggerDraftPreviewResult.approvalSummary.approval.revokedAt) : "-"} />
                  <DetailItem label="Revoked Reason" value={bloggerDraftPreviewResult.approvalSummary.approval?.revokedReason ?? "-"} />
                </div>
                <div className="form-actions">
                  <button className="button" type="button" disabled={!canApproveBloggerDraftPayload} onClick={() => void approveBloggerDraftPayload()}>
                    {approvingBloggerDraft ? "승인 저장 중" : "이 payload 승인"}
                  </button>
                  <button className="button secondary" type="button" disabled={!canRevokeBloggerDraftApproval} onClick={() => void revokeBloggerDraftApproval()}>
                    {revokingBloggerDraftApproval ? "승인 취소 중" : "승인 취소"}
                  </button>
                  <button className="button secondary" type="button" disabled={!canSaveBloggerDraft} onClick={() => void saveBloggerDraft()}>
                    {formatBloggerDraftSaveButtonLabel(savingBloggerDraft, bloggerDraftSaveConfirmationPending)}
                  </button>
                </div>
                {!bloggerDraftSavePreflightResult?.canSaveDraft ? (
                  <div className="notice warning">
                    Blogger Draft 저장은 현재 preview approval과 별도로 Draft Save Preflight가 통과해야 활성화됩니다. 이 preflight는 저장된 draftHtml 기준으로 재검증하며 Blogger API를 호출하지 않습니다.
                  </div>
                ) : null}
                <div className="read-block">
                  <h3>HTML Snippet</h3>
                  <pre>{bloggerDraftPreviewResult.htmlSnippet ?? "저장된 draftHtml snippet이 없습니다."}</pre>
                </div>
                <div className="notice">preview는 저장된 draftHtml의 짧은 snippet만 표시합니다. full draftHtml은 승인된 draft save 요청에서만 Blogger API로 전송됩니다.</div>
              </>
            ) : (
              <div className="notice">Draft Payload Preview를 실행하면 Blogger draft 저장 전 payload 후보와 readiness 결과가 화면에만 생성됩니다.</div>
            )}
          </section>

          <section className="admin-section">
            <div className="section-heading">
              <div>
                <h2>Manual Plan JSON</h2>
                <p className="muted">빈 planJson에는 기본 템플릿이 표시됩니다. 저장 전 JSON.parse 검증을 수행합니다.</p>
              </div>
            </div>
            {planError ? <div className="notice error">{planError}</div> : null}
            {notice ? <div className="notice">{notice}</div> : null}
            {!canMarkPlanned ? (
              <div className="notice">planned 전환은 유효한 JSON이며 최소 하나 이상의 기획 항목이 입력된 경우에만 가능합니다.</div>
            ) : null}
            <label className="plan-editor">
              Plan JSON
              <textarea value={planText} onChange={(event) => setPlanText(event.target.value)} spellCheck={false} />
            </label>
            <div className="form-actions">
              <button className="button" type="button" disabled={savingPlan} onClick={() => void savePlanJson()}>
                기획서 저장
              </button>
              <button className="button secondary" type="button" disabled={changingStatus || !canMarkPlanned} onClick={() => void markPlanned()}>
                planned로 전환
              </button>
            </div>
          </section>

          <section className="admin-section">
            <div className="section-heading">
              <div>
                <h2>Content Plan Dry Run</h2>
                <p className="muted">실제 LLM 호출 없이 content_plan route 준비 상태와 prompt preview만 확인합니다. Preview는 DB에 저장되지 않습니다.</p>
              </div>
              <button className="button secondary" type="button" disabled>
                실제 기획서 생성은 후속 패치에서 연결 예정
              </button>
            </div>

            {routeError ? <div className="notice error">{routeError}</div> : null}
            {routesLoading ? <div className="notice">content_plan route 정보를 불러오는 중입니다.</div> : null}

            <div className="detail-grid">
              <DetailItem label="Task Route" value={contentPlanRoute ? "content_plan" : "미등록"} />
              <DetailItem label="Route Status" value={contentPlanRoute?.isEnabled ? "enabled" : contentPlanRoute ? "disabled" : "-"} />
              <DetailItem label="Primary Provider" value={formatProviderName(contentPlanRoute?.primaryProvider)} />
              <DetailItem label="Primary Model" value={formatModelName(contentPlanRoute?.primaryModel)} />
              <DetailItem label="Fallback Provider" value={formatProviderName(contentPlanRoute?.fallbackProvider)} />
              <DetailItem label="Fallback Model" value={formatModelName(contentPlanRoute?.fallbackModel)} />
            </div>

            {contentPlanRoute?.primaryProvider ? <ProviderTestSummary title="Primary Provider Test" provider={contentPlanRoute.primaryProvider} /> : null}
            {contentPlanRoute?.fallbackProvider ? <ProviderTestSummary title="Fallback Provider Test" provider={contentPlanRoute.fallbackProvider} /> : null}

            <div className="form-actions">
              <button className="button" type="button" disabled={routesLoading || loading || assetsLoading} onClick={runContentPlanDryRun}>
                Dry Run
              </button>
              <button className="button secondary" type="button" disabled={!dryRunResult?.ready || generatingPlan} onClick={() => void generatePlanCandidate()}>
                {generatingPlan ? "기획서 생성 중" : "기획서 생성"}
              </button>
            </div>

            {generationError ? <div className="notice error">{generationError}</div> : null}
            {dryRunResult && !dryRunResult.ready ? <div className="notice error">Readiness fail 항목이 있어 기획서 생성 버튼을 비활성화했습니다.</div> : null}

            {dryRunResult ? (
              <>
                <div className={dryRunResult.ready ? "notice" : "notice error"}>
                  {dryRunResult.ready
                    ? "Dry-run 준비 상태가 통과되었습니다. 실제 LLM 호출은 수행하지 않았습니다."
                    : "Dry-run 준비 상태에 실패 항목이 있습니다. 실제 LLM 호출은 수행하지 않았습니다."}
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Check</th>
                        <th>Status</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dryRunResult.checks.map((check) => (
                        <tr key={check.key}>
                          <td>{check.label}</td>
                          <td>{formatReadinessStatus(check.status)}</td>
                          <td>{check.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PromptPreviewBlock title="System" value={dryRunResult.promptPreview.system} />
                <PromptPreviewBlock title="User" value={dryRunResult.promptPreview.user} />
                <PromptPreviewBlock title="Output Format" value={dryRunResult.promptPreview.outputFormat} />
              </>
            ) : (
              <div className="notice">Dry Run을 실행하면 route readiness와 prompt preview가 화면에만 생성됩니다.</div>
            )}

            {generatedPlan ? (
              <div className="read-block">
                <div className={generatedPlan.validation.ok ? "notice" : "notice error"}>
                  <strong>Generated Plan Candidate</strong>
                  <p>
                    validation: {generatedPlan.validation.ok ? "pass" : "fail"} / errors: {generatedPlan.validation.errors.length} / warnings:{" "}
                    {generatedPlan.validation.warnings.length}
                  </p>
                  <p>
                    provider: {generatedPlan.route.providerName} / model: {generatedPlan.route.modelName} / fallback:{" "}
                    {generatedPlan.route.usedFallback ? "yes" : "no"}
                  </p>
                  <p>
                    latency: {generatedPlan.metadata.latencyMs}ms / summary: {generatedPlan.metadata.responseSummary}
                  </p>
                </div>
                {candidateParseError ? (
                  <div className="notice error">{candidateParseError}</div>
                ) : candidateDirty ? (
                  <div className="notice warning">편집된 후보는 재검증 후 반영할 수 있습니다.</div>
                ) : !generatedPlan.validation.ok ? (
                  <div className="notice error">이 후보는 validation error가 있어 planJson에 반영할 수 없습니다.</div>
                ) : generatedPlan.validation.warnings.length > 0 ? (
                  <div className="notice">warning이 있습니다. 내용을 검토한 뒤 planJson에 반영할 수 있습니다.</div>
                ) : (
                  <div className="notice">validation을 통과했습니다. 내용을 검토한 뒤 planJson에 반영할 수 있습니다.</div>
                )}
                <ValidationList title="Validation Errors" items={generatedPlan.validation.errors} emptyText="validation error가 없습니다." isError />
                <ValidationList title="Validation Warnings" items={generatedPlan.validation.warnings} emptyText="validation warning이 없습니다." isWarning />
                <label className="plan-editor read-block">
                  Candidate planJson
                  <textarea
                    value={candidateText}
                    readOnly={!candidateEditMode}
                    onChange={(event) => {
                      setCandidateText(event.target.value);
                      setCandidateDirty(true);
                      setCandidateParseError(null);
                    }}
                    spellCheck={false}
                  />
                </label>
                <div className="form-actions">
                  <button className="button secondary" type="button" onClick={() => setCandidateEditMode((current) => !current)}>
                    {candidateEditMode ? "읽기 모드" : "후보 편집"}
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={revalidatingPlan || !candidateDirty}
                    onClick={() => void revalidateGeneratedPlan()}
                  >
                    {revalidatingPlan ? "재검증 중" : "재검증"}
                  </button>
                  <button
                    className="button"
                    type="button"
                    disabled={!canApplyGeneratedPlan}
                    onClick={() => void applyGeneratedPlan()}
                  >
                    planJson에 반영
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section className="admin-section">
            <div className="section-heading">
              <div>
                <h2>Draft Markdown Dry Run</h2>
                <p className="muted">
                  저장된 planJson을 기반으로 본문 초안 생성 준비 상태와 prompt preview를 확인하고, content_draft route로 초안 후보를 생성합니다.
                </p>
              </div>
              <button className="button secondary" type="button" disabled>
                HTML 변환은 후속 패치에서 연결 예정
              </button>
            </div>

            {!contentItem.planJson ? <div className="notice error">저장된 planJson이 없습니다. 먼저 planJson에 반영하세요.</div> : null}

            <div className="detail-grid">
              <DetailItem label="Task Route" value={contentDraftRoute ? "content_draft" : "미등록"} />
              <DetailItem label="Route Status" value={contentDraftRoute?.isEnabled ? "enabled" : contentDraftRoute ? "disabled" : "-"} />
              <DetailItem label="Primary Provider" value={formatProviderName(contentDraftRoute?.primaryProvider)} />
              <DetailItem label="Primary Model" value={formatModelName(contentDraftRoute?.primaryModel)} />
              <DetailItem label="Fallback Provider" value={formatProviderName(contentDraftRoute?.fallbackProvider)} />
              <DetailItem label="Fallback Model" value={formatModelName(contentDraftRoute?.fallbackModel)} />
              <DetailItem label="Draft Strategy" value={getDraftGenerationStrategyLabel(draftStrategyResolution.strategy)} />
              <DetailItem label="Strategy Reason" value={draftStrategyResolution.strategyReason} />
            </div>

            <div className={draftStrategyResolution.strategy === "local_sectioned_multi_pass" ? "notice warning" : "notice"}>
              {getDraftGenerationStrategyNotice(draftStrategyResolution)}
            </div>

            {contentDraftRoute?.primaryProvider ? <ProviderTestSummary title="Draft Primary Provider Test" provider={contentDraftRoute.primaryProvider} /> : null}
            {contentDraftRoute?.fallbackProvider ? <ProviderTestSummary title="Draft Fallback Provider Test" provider={contentDraftRoute.fallbackProvider} /> : null}

            <div className="form-actions">
              <button className="button" type="button" disabled={routesLoading || loading || assetsLoading} onClick={runDraftMarkdownDryRun}>
                Draft Dry Run
              </button>
              <button className="button secondary" type="button" disabled={!canGenerateDraft} onClick={() => void generateDraftCandidate()}>
                {generatingDraft ? "본문 초안 생성 중" : "본문 초안 생성"}
              </button>
            </div>

            {draftGenerationError ? <div className="notice error">{draftGenerationError}</div> : null}
            {draftDryRunResult && !draftDryRunResult.ready ? <div className="notice error">Readiness fail 항목이 있어 본문 초안 생성 버튼을 비활성화했습니다.</div> : null}

            {draftDryRunResult ? (
              <>
                <div className={draftDryRunResult.ready ? "notice" : "notice error"}>
                  {draftDryRunResult.ready
                    ? "Draft dry-run 준비 상태가 통과되었습니다. 본문 초안 생성 버튼으로 후보를 생성할 수 있습니다."
                    : "Draft dry-run 준비 상태에 실패 항목이 있습니다. 실제 LLM 호출은 수행하지 않았습니다."}
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Check</th>
                        <th>Status</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftDryRunResult.checks.map((check) => (
                        <tr key={check.key}>
                          <td>{check.label}</td>
                          <td>{formatReadinessStatus(check.status)}</td>
                          <td>{check.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <MediaMappingTable mappings={draftDryRunResult.mediaMapping} />
                <PromptPreviewBlock title="Draft System" value={draftDryRunResult.promptPreview.system} />
                <PromptPreviewBlock title="Draft User" value={draftDryRunResult.promptPreview.user} />
                <PromptPreviewBlock title="Draft Output Format" value={draftDryRunResult.promptPreview.outputFormat} />
              </>
            ) : (
              <div className="notice">
                Draft Dry Run을 실행하면 저장된 planJson, content_draft route, 첨부 미디어와 mediaPlan의 연결 상태가 화면에만 생성됩니다.
              </div>
            )}

            {generatedDraft ? (
              <div className="read-block">
                <div className={generatedDraft.validation.ok ? "notice" : "notice error"}>
                  <strong>Generated Draft Candidate</strong>
                  <p>
                    validation: {generatedDraft.validation.ok ? "pass" : "fail"} / errors: {generatedDraft.validation.errors.length} / warnings:{" "}
                    {generatedDraft.validation.warnings.length}
                  </p>
                  <p>
                    provider: {generatedDraft.route.providerName} / model: {generatedDraft.route.modelName} / fallback:{" "}
                    {generatedDraft.route.usedFallback ? "yes" : "no"}
                  </p>
                  <p>
                    latency: {generatedDraft.metadata.latencyMs}ms / length: {generatedDraft.metadata.markdownLength} / summary:{" "}
                    {generatedDraft.metadata.responseSummary}
                  </p>
                  <p>candidate source: {formatDraftCandidateSource(draftCandidateSource)}</p>
                  <p>
                    repair: {generatedDraft.metadata.repairAttempted ? "attempted" : "not attempted"} / result:{" "}
                    {generatedDraft.metadata.repairSucceeded ? "success" : generatedDraft.metadata.repairAttempted ? "not passed" : "-"}
                  </p>
                  <p>
                    strategy: {getDraftGenerationStrategyLabel(generatedDraft.metadata.strategy)} / reason: {generatedDraft.metadata.strategyReason} / local-like:{" "}
                    {generatedDraft.metadata.isLocalLike ? "yes" : "no"}
                  </p>
                  <p>
                    executed steps: {generatedDraft.metadata.stepCount} / planned steps: {generatedDraft.metadata.plannedStepCount} / sectioned generation:{" "}
                    {generatedDraft.metadata.sectionedGenerationImplemented ? "implemented" : "not implemented"} / final polish:{" "}
                    {generatedDraft.metadata.finalPolishImplemented ? "implemented" : "not implemented"}
                  </p>
                </div>
                {generatedDraft.metadata.strategy === "local_sectioned_multi_pass" ? (
                  <div className="notice warning">
                    Local/small-model 전략이 선택되어 skeleton-first sectioned generation을 실행했습니다. 후보는 preview일 뿐이며, 검토 후 수동으로
                    draftMarkdown에 반영해야 합니다.
                  </div>
                ) : (
                  <div className="notice">Remote/commercial route는 기존 one-shot full draft 생성을 유지합니다.</div>
                )}
                <div className="detail-grid">
                  <DetailItem label="Strategy Provider" value={generatedDraft.metadata.providerSummary.providerName ?? "-"} />
                  <DetailItem label="Provider Type" value={generatedDraft.metadata.providerSummary.providerType ?? "-"} />
                  <DetailItem label="Invocation Mode" value={generatedDraft.metadata.providerSummary.invocationMode ?? "-"} />
                  <DetailItem label="API Format" value={generatedDraft.metadata.providerSummary.apiFormat ?? "-"} />
                  <DetailItem label="Strategy Model" value={generatedDraft.metadata.providerSummary.modelName ?? "-"} />
                  <DetailItem label="Section Count" value={String(generatedDraft.metadata.sectionCount)} />
                  <DetailItem label="Section Keys" value={generatedDraft.metadata.sectionKeys.length > 0 ? generatedDraft.metadata.sectionKeys.join(", ") : "-"} />
                  <DetailItem label="Final Polish Applied" value={generatedDraft.metadata.finalPolishApplied ? "yes" : "no"} />
                  <DetailItem label="Final Polish Too Long" value={generatedDraft.metadata.finalPolishInputTooLong ? "yes" : "no"} />
                  <DetailItem label="Fallback Used" value={generatedDraft.metadata.fallbackUsed ? "yes" : "no"} />
                  <DetailItem label="FAQ Required" value={generatedDraft.metadata.faqRequired ? "yes" : "no"} />
                  <DetailItem label="FAQ Detected" value={generatedDraft.metadata.faqSectionDetected ? "yes" : "no"} />
                  <DetailItem label="FAQ Fallback" value={generatedDraft.metadata.faqFallbackAppended ? "appended" : "not appended"} />
                  <DetailItem label="FAQ Count" value={String(generatedDraft.metadata.faqCount)} />
                  <DetailItem label="Safety Scrub" value={generatedDraft.metadata.safetyScrubApplied ? "applied" : "not applied"} />
                  <DetailItem label="Safety Scrub Count" value={String(generatedDraft.metadata.safetyScrubCount)} />
                  <DetailItem
                    label="Safety Scrub Codes"
                    value={generatedDraft.metadata.safetyScrubCodes.length > 0 ? generatedDraft.metadata.safetyScrubCodes.join(", ") : "-"}
                  />
                  <DetailItem label="Timeout Policy" value={generatedDraft.metadata.timeoutPolicy} />
                  <DetailItem label="Overall Timeout" value={formatMs(generatedDraft.metadata.overallTimeoutMs)} />
                  <DetailItem label="Step Timeout" value={formatMs(generatedDraft.metadata.stepTimeoutMs)} />
                  <DetailItem label="Skeleton Timeout" value={formatMs(generatedDraft.metadata.skeletonTimeoutMs)} />
                  <DetailItem label="Section Timeout" value={formatMs(generatedDraft.metadata.sectionTimeoutMs)} />
                  <DetailItem label="Final Polish Timeout" value={formatMs(generatedDraft.metadata.finalPolishTimeoutMs)} />
                  <DetailItem label="Repair Timeout" value={formatMs(generatedDraft.metadata.repairTimeoutMs)} />
                </div>
                {generatedDraft.metadata.finalPolishFallbackReason ? (
                  <div className="notice warning">Final polish fallback: {generatedDraft.metadata.finalPolishFallbackReason}</div>
                ) : null}
                {generatedDraft.metadata.fallbackReasons.length > 0 ? (
                  <ValidationList title="Local Sectioned Fallback Reasons" items={generatedDraft.metadata.fallbackReasons} emptyText="fallback reason이 없습니다." isWarning />
                ) : null}
                {generatedDraft.metadata.stepSummaries.length > 0 ? (
                  <div className="read-block">
                    <h3>Local Sectioned Generation Steps</h3>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Step</th>
                            <th>Section</th>
                            <th>Status</th>
                            <th>Retry</th>
                            <th>Duration</th>
                            <th>Prompt Hash</th>
                            <th>Response Hash</th>
                            <th>Length</th>
                          </tr>
                        </thead>
                        <tbody>
                          {generatedDraft.metadata.stepSummaries.map((step, index) => (
                            <tr key={`${step.stepKey}-${step.sectionKey ?? "none"}-${index}`}>
                              <td>{step.stepKey}</td>
                              <td>{step.sectionKey ?? "-"}</td>
                              <td>{step.status}</td>
                              <td>{step.retryCount}</td>
                              <td>{step.durationMs}ms</td>
                              <td>{step.promptHash ?? "-"}</td>
                              <td>{step.responseHash ?? "-"}</td>
                              <td>{step.responseLength}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
                {generatedDraft.metadata.repairAttempted ? (
                  generatedDraft.metadata.repairSucceeded ? (
                    <div className="notice">초안 후보에서 위험 문구가 감지되어 자동 수정 1회를 수행했고, 자동 수정 후 validation을 통과했습니다.</div>
                  ) : (
                    <div className="notice warning">초안 후보에서 위험 문구가 감지되어 자동 수정 1회를 수행했습니다.</div>
                  )
                ) : null}
                {draftCandidateSource === "stepwise-final-candidate" ? (
                  <div className="notice warning">
                    Stepwise final candidate를 수동 적용 후보로 가져왔습니다. 아직 content item에 저장하지 않았고, LLM/Blogger API를 호출하지 않았습니다.
                    내용을 검토한 뒤 기존 draftMarkdown에 반영 버튼을 별도로 눌러야 저장됩니다.
                  </div>
                ) : null}
                {draftDirty ? (
                  <div className="notice warning">편집된 초안 후보는 재검증 후 반영할 수 있습니다.</div>
                ) : !generatedDraft.validation.ok ? (
                  <div className="notice error">자동 수정 후에도 validation error가 남아 있습니다. 후보 편집 후 재검증하세요.</div>
                ) : generatedDraft.validation.warnings.length > 0 ? (
                  <div className="notice">warning이 있습니다. 내용을 검토한 뒤 draftMarkdown에 반영할 수 있습니다.</div>
                ) : (
                  <div className="notice">validation을 통과했습니다. 내용을 검토한 뒤 draftMarkdown에 반영할 수 있습니다.</div>
                )}
                {generatedDraft.metadata.repairAttempted ? (
                  <div className="detail-grid">
                    <DetailItem label="Initial Errors" value={String(generatedDraft.metadata.initialValidationErrorCount)} />
                    <DetailItem label="Initial Warnings" value={String(generatedDraft.metadata.initialValidationWarningCount)} />
                    <DetailItem label="Final Errors" value={String(generatedDraft.metadata.finalValidationErrorCount)} />
                    <DetailItem label="Final Warnings" value={String(generatedDraft.metadata.finalValidationWarningCount)} />
                  </div>
                ) : null}
                <ValidationList title="Draft Validation Errors" items={generatedDraft.validation.errors} emptyText="draft validation error가 없습니다." isError />
                <ValidationList
                  title="Draft Validation Warnings"
                  items={generatedDraft.validation.warnings}
                  emptyText="draft validation warning이 없습니다."
                  isWarning
                />
                <label className="plan-editor read-block">
                  Candidate draftMarkdown
                  <textarea
                    value={draftCandidateText}
                    readOnly={!draftEditMode}
                    onChange={(event) => {
                      setDraftCandidateText(event.target.value);
                      setDraftCandidateSource("manual-edit");
                      setDraftDirty(true);
                      setBlogPostTemplatePreviewResult(null);
                      setBlogPostTemplatePreviewError(null);
                    }}
                    spellCheck={false}
                  />
                </label>
                <div className="form-actions">
                  <button className="button secondary" type="button" onClick={() => setDraftEditMode((current) => !current)}>
                    {draftEditMode ? "읽기 모드" : "후보 편집"}
                  </button>
                  <button className="button secondary" type="button" disabled={revalidatingDraft || !draftDirty} onClick={() => void revalidateDraftCandidate()}>
                    {revalidatingDraft ? "재검증 중" : "재검증"}
                  </button>
                  <button className="button" type="button" disabled={!canApplyGeneratedDraft} onClick={() => void applyGeneratedDraft()}>
                    draftMarkdown에 반영
                  </button>
                </div>
                <div className="read-block">
                  <div className="section-heading compact">
                    <div>
                      <h3>Blog Post Template HTML Preview</h3>
                      <p className="muted">
                        현재 초안 후보 Markdown을 publish-ready HTML theme preview로 변환합니다. draftHtml에는 저장하지 않고 Blogger API도 호출하지 않습니다.
                      </p>
                    </div>
                    <button className="button secondary" type="button" disabled={!canRunBlogPostTemplatePreview} onClick={() => void runBlogPostTemplatePreview()}>
                      {runningBlogPostTemplatePreview ? "HTML preview 생성 중" : "블로그 HTML preview 생성"}
                    </button>
                  </div>
                  <div className="notice">
                    Preview source: {formatDraftCandidateSource(draftCandidateSource)}. 결과는 화면 확인용입니다. draftHtml 적용은 기존 HTML 후보 검증/수동 반영 흐름에서 별도로
                    진행해야 합니다.
                  </div>
                  {blogPostTemplatePreviewError ? <div className="notice error">{blogPostTemplatePreviewError}</div> : null}
                  {blogPostTemplatePreviewResult ? (
                    <>
                      <div className={blogPostTemplatePreviewResult.validationSummary.ok ? "notice" : "notice error"}>
                        <strong>Template Preview Summary</strong>
                        <p>
                          status: {blogPostTemplatePreviewResult.validationSummary.ok ? "pass" : "fail"} / source:{" "}
                          {formatBlogPostTemplatePreviewSource(blogPostTemplatePreviewResult.sourceSummary.source)} / theme:{" "}
                          {blogPostTemplatePreviewResult.sourceSummary.theme}
                        </p>
                        <p>
                          markdown length: {blogPostTemplatePreviewResult.validationSummary.markdownLength} / html length:{" "}
                          {blogPostTemplatePreviewResult.validationSummary.htmlLength} / title: {blogPostTemplatePreviewResult.sourceSummary.titleCandidate}
                        </p>
                        <p>
                          preview-only: {blogPostTemplatePreviewResult.metadata.previewOnly ? "yes" : "no"} / DB mutation:{" "}
                          {blogPostTemplatePreviewResult.metadata.dbMutation ? "yes" : "no"} / LLM call:{" "}
                          {blogPostTemplatePreviewResult.metadata.llmCall ? "yes" : "no"} / Blogger API:{" "}
                          {blogPostTemplatePreviewResult.metadata.bloggerApiCall ? "yes" : "no"}
                        </p>
                      </div>
                      <div className="detail-grid">
                        <DetailItem label="H1" value={String(blogPostTemplatePreviewResult.validationSummary.h1Count)} />
                        <DetailItem label="H2" value={String(blogPostTemplatePreviewResult.validationSummary.h2Count)} />
                        <DetailItem label="H3" value={String(blogPostTemplatePreviewResult.validationSummary.h3Count)} />
                        <DetailItem label="Paragraphs" value={String(blogPostTemplatePreviewResult.validationSummary.paragraphCount)} />
                        <DetailItem label="FAQ Headings" value={String(blogPostTemplatePreviewResult.validationSummary.faqHeadingCount)} />
                        <DetailItem label="Media Placeholders" value={String(blogPostTemplatePreviewResult.validationSummary.mediaPlaceholderCount)} />
                        <DetailItem label="Matched Media" value={String(blogPostTemplatePreviewResult.validationSummary.matchedMediaCount)} />
                        <DetailItem label="Unmatched Media" value={String(blogPostTemplatePreviewResult.validationSummary.unmatchedMediaPlaceholderCount)} />
                        <DetailItem label="Assets Without Placeholder" value={String(blogPostTemplatePreviewResult.validationSummary.assetWithoutPlaceholderCount)} />
                        <DetailItem label="Unsafe Patterns" value={String(blogPostTemplatePreviewResult.validationSummary.unsafePatternCount)} />
                        <DetailItem label="Raw HTML Escaped" value={blogPostTemplatePreviewResult.validationSummary.rawHtmlEscaped ? "yes" : "no"} />
                      </div>
                      <ValidationList
                        title="Template Preview Errors"
                        items={blogPostTemplatePreviewResult.validationSummary.errors}
                        emptyText="template preview error가 없습니다."
                        isError
                      />
                      <ValidationList
                        title="Template Preview Warnings"
                        items={blogPostTemplatePreviewResult.validationSummary.warnings}
                        emptyText="template preview warning이 없습니다."
                        isWarning
                      />
                      <div className="read-block">
                        <h3>Themed HTML Preview</h3>
                        <iframe className="html-preview-frame" sandbox="" srcDoc={blogPostTemplatePreviewResult.html} title="Blog post template HTML preview" />
                      </div>
                      <label className="plan-editor read-block">
                        Preview HTML (read-only)
                        <textarea value={blogPostTemplatePreviewResult.html} readOnly spellCheck={false} />
                      </label>
                      {blogPostTemplatePreviewResult.validationSummary.errors.length > 0 ? (
                        <div className="notice error">Template preview error가 있어 HTML 후보로 가져올 수 없습니다. 초안 후보를 수정한 뒤 preview를 다시 생성하세요.</div>
                      ) : null}
                      <div className="form-actions">
                        <button
                          className="button secondary"
                          type="button"
                          disabled={!canCopyBlogPostTemplatePreviewToHtmlCandidate}
                          onClick={copyBlogPostTemplatePreviewToHtmlCandidate}
                        >
                          HTML 후보로 사용
                        </button>
                        <button className="button secondary" type="button" disabled>
                          draftHtml 저장은 기존 수동 반영 버튼에서만 수행
                        </button>
                      </div>
                      <div className="notice warning">
                        이 preview는 draftHtml에 자동 반영하지 않습니다. HTML 후보로 가져오기만으로는 content item이 변경되지 않습니다. 기존 HTML 검증 및 수동 반영 버튼을
                        별도로 눌러야 저장되며, Blogger draft save/publish/token refresh는 호출하지 않습니다.
                      </div>
                    </>
                  ) : (
                    <div className="notice">초안 후보를 검토한 뒤 블로그 HTML preview를 생성할 수 있습니다. 이 단계는 DB mutation 없이 실행됩니다.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="notice">본문 초안 후보가 아직 없습니다.</div>
            )}
          </section>

          <StepwiseDraftGenerationSection
            runs={stepwiseRuns}
            selectedRun={selectedStepwiseRun}
            selectedRunId={selectedStepwiseRunId}
            loading={loadingStepwiseRuns}
            creating={creatingStepwiseRun}
            executingStepKey={executingStepwiseStepKey}
            assembling={assemblingStepwiseRun}
            finalPolishing={finalPolishingStepwiseRun}
            busy={stepwiseBusy}
            canCreateRun={canCreateStepwiseRun}
            canAssemble={canAssembleStepwiseRun}
            canFinalPolish={canFinalPolishStepwiseRun}
            error={stepwiseError}
            notice={stepwiseNotice}
            onRefresh={() => void loadStepwiseRuns()}
            onCreate={() => void createStepwiseRun()}
            onSelect={(runId) => void selectStepwiseRun(runId)}
            onExecuteStep={(stepKey) => void executeStepwiseStep(stepKey)}
            onAssemble={() => void assembleStepwiseRun()}
            onFinalPolish={() => void finalPolishStepwiseRun()}
            onUseFinalCandidate={() => copyStepwiseFinalCandidateToDraftCandidate()}
          />

          <section className="admin-section">
            <div className="section-heading">
              <div>
                <h2>Attached Media</h2>
                <p className="muted">첨부 미디어는 읽기 중심으로 표시합니다. 수정은 /content/new의 첨부 관리에서 수행하세요.</p>
              </div>
            </div>
            {assetsError ? <div className="notice error">{assetsError}</div> : null}
            {assetsLoading ? <div className="notice">첨부 미디어를 불러오는 중입니다.</div> : null}
            <div className="asset-grid">
              {assets.length === 0 ? (
                <div className="notice">첨부된 미디어가 없습니다.</div>
              ) : (
                assets.map((asset) => (
                  <article className="asset-card" key={asset.id}>
                    <AssetPreview asset={asset} />
                    <div>
                      <strong>{asset.originalName}</strong>
                      <p className="muted">
                        {asset.mimeType} / {formatBytes(asset.fileSize)}
                      </p>
                      <p className="muted">
                        placement: {asset.placementHint} / order: {asset.sortOrder} / primary: {asset.isPrimary ? "yes" : "no"}
                      </p>
                      <p>caption: {asset.caption || "-"}</p>
                      <p className="muted">alt: {asset.altText || "-"}</p>
                      <p className="muted">note: {asset.userNote || "-"}</p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="admin-section">
            <div className="section-heading">
              <div>
                <h2>HTML Conversion Dry Run</h2>
                <p className="muted">
                  저장된 draftMarkdown을 HTML preview로 변환하고 media placeholder 매핑과 sanitization readiness를 확인합니다. DB에는 저장하지 않습니다.
                </p>
              </div>
              <button className="button secondary" type="button" disabled>
                Blogger 연동은 후속 패치에서 연결 예정
              </button>
            </div>

            {!contentItem.draftMarkdown ? <div className="notice error">저장된 draftMarkdown이 없습니다. 먼저 draftMarkdown에 반영하세요.</div> : null}
            {htmlPreviewError ? <div className="notice error">{htmlPreviewError}</div> : null}
            {htmlApplyError ? <div className="notice error">{htmlApplyError}</div> : null}
            {draftHtmlPostApplyNotice ? (
              <div className="notice warning">
                draftHtml이 변경되었습니다. Quality Dry Run / Publish Readiness / Blogger Draft Payload Preview를 다시 실행하고, Blogger draft save 전 재승인하세요.
              </div>
            ) : null}

            <div className="form-actions">
              <button className="button" type="button" disabled={!canRunHtmlPreview} onClick={() => void runHtmlPreviewDryRun()}>
                {runningHtmlPreview ? "HTML Dry Run 실행 중" : "HTML Dry Run"}
              </button>
              <button className="button secondary" type="button" disabled={!htmlCandidateText || validatingHtml} onClick={() => void revalidateHtmlCandidate()}>
                {validatingHtml ? "재검증 중" : "HTML 후보 재검증"}
              </button>
              <button className="button" type="button" disabled={!canApplyHtmlCandidate} onClick={() => void applyHtmlCandidate()}>
                {formatHtmlApplyButtonLabel(applyingHtml, htmlApplyConfirmationPending)}
              </button>
            </div>
            <div className="notice">
              `draftHtml에 반영` 버튼은 draftHtml만 저장합니다. Blogger draft save/publish는 실행하지 않고, publish/scheduled publish/token refresh는 별도 단계입니다.
              validation을 통과한 HTML 후보만 명시 승인 후 저장할 수 있습니다.
            </div>
            {htmlApplyConfirmationPending ? (
              <div className="notice warning">
                draftHtml 저장 확인 대기 중입니다. 같은 버튼을 한 번 더 누르면 서버가 HTML 후보를 다시 검증한 뒤 draftHtml만 저장합니다. Blogger/LLM/publish/token refresh는
                실행하지 않습니다.
              </div>
            ) : null}
            {lastHtmlApplySummary ? (
              <div className="read-block">
                <h3>Last draftHtml Apply Guard Summary</h3>
                <div className="detail-grid">
                  <DetailItem label="Source" value={`${lastHtmlApplySummary.source} -> ${formatHtmlCandidateSource(htmlCandidateSource)}`} />
                  <DetailItem label="Validation OK" value={lastHtmlApplySummary.validationOk ? "yes" : "no"} />
                  <DetailItem label="HTML Length" value={String(lastHtmlApplySummary.htmlLength)} />
                  <DetailItem label="Unsafe Patterns" value={String(lastHtmlApplySummary.unsafePatternCount)} />
                  <DetailItem label="Applied Field" value={lastHtmlApplySummary.appliedField ?? "-"} />
                  <DetailItem label="Content Side Effect" value={lastHtmlApplySummary.contentItemSideEffect} />
                  <DetailItem label="Blogger Side Effect" value={String(lastHtmlApplySummary.bloggerSideEffect)} />
                  <DetailItem label="LLM Side Effect" value={String(lastHtmlApplySummary.llmSideEffect)} />
                  <DetailItem label="Publish Side Effect" value={String(lastHtmlApplySummary.publishSideEffect)} />
                  <DetailItem label="Token Refresh Side Effect" value={String(lastHtmlApplySummary.tokenRefreshSideEffect)} />
                </div>
              </div>
            ) : null}

            {htmlPreviewResult ? (
              <>
                <div className={htmlPreviewResult.ready ? "notice" : "notice error"}>
                  {htmlPreviewResult.ready
                    ? "HTML dry-run readiness가 통과되었습니다. previewHtml은 화면 표시용이며 DB에 저장하지 않았습니다."
                    : "HTML dry-run readiness에 실패 항목이 있습니다. previewHtml은 화면 표시용이며 DB에 저장하지 않았습니다."}
                </div>
                <div className="detail-grid">
                  <DetailItem label="Markdown Length" value={String(htmlPreviewResult.metadata.draftMarkdownLength)} />
                  <DetailItem label="Preview HTML Length" value={String(htmlPreviewResult.metadata.previewHtmlLength)} />
                  <DetailItem label="Placeholders" value={String(htmlPreviewResult.metadata.placeholderCount)} />
                  <DetailItem label="Matched Placeholders" value={String(htmlPreviewResult.metadata.matchedPlaceholderCount)} />
                  <DetailItem label="Unmatched Placeholders" value={String(htmlPreviewResult.metadata.unmatchedPlaceholderCount)} />
                  <DetailItem label="Assets Without Placeholder" value={String(htmlPreviewResult.metadata.assetWithoutPlaceholderCount)} />
                </div>
                <div className="notice">
                  HTML candidate source: {formatHtmlCandidateSource(htmlCandidateSource)}. {getHtmlCandidateSourceGuidance(htmlCandidateSource)}
                </div>
                <ReadinessTable checks={htmlPreviewResult.checks} />
                <ValidationList title="Markdown Validation Errors" items={htmlPreviewResult.draftValidation.errors} emptyText="draft validation error가 없습니다." isError />
                <ValidationList
                  title="Markdown Validation Warnings"
                  items={htmlPreviewResult.draftValidation.warnings}
                  emptyText="draft validation warning이 없습니다."
                  isWarning
                />
                <SecurityCheckList checks={htmlPreviewResult.securityChecks} />
                <HtmlMediaMappingTable mappings={htmlPreviewResult.mediaMappings} />
                {htmlCandidateValidation ? (
                  <>
                    <div className={htmlCandidateValidation.validation.ok ? "notice" : "notice error"}>
                      <strong>HTML Candidate Validation</strong>
                      <p>
                        validation: {htmlCandidateValidation.validation.ok ? "pass" : "fail"} / errors:{" "}
                        {htmlCandidateValidation.validation.errors.length} / warnings: {htmlCandidateValidation.validation.warnings.length}
                      </p>
                      <p>
                        html length: {htmlCandidateValidation.metadata.htmlLength} / media refs:{" "}
                        {htmlCandidateValidation.metadata.mediaReferenceCount} / matched:{" "}
                        {htmlCandidateValidation.metadata.matchedMediaReferenceCount} / unmatched:{" "}
                        {htmlCandidateValidation.metadata.unmatchedMediaReferenceCount} / unsafe patterns: {htmlCandidateValidation.metadata.unsafePatternCount}
                      </p>
                    </div>
                    {htmlDirty ? (
                      <div className="notice warning">복사 또는 편집된 HTML 후보는 재검증 후 draftHtml에 반영할 수 있습니다.</div>
                    ) : !htmlCandidateValidation.validation.ok ? (
                      <div className="notice error">이 HTML 후보는 validation/security error가 있어 draftHtml에 반영할 수 없습니다.</div>
                    ) : htmlCandidateValidation.validation.warnings.length > 0 ? (
                      <div className="notice">warning이 있습니다. 내용을 검토한 뒤 draftHtml에 반영할 수 있습니다.</div>
                    ) : (
                      <div className="notice">validation/security 검증을 통과했습니다. 내용을 검토한 뒤 draftHtml에 반영할 수 있습니다.</div>
                    )}
                    <ValidationList
                      title="HTML Validation Errors"
                      items={htmlCandidateValidation.validation.errors}
                      emptyText="HTML validation/security error가 없습니다."
                      isError
                    />
                    <ValidationList
                      title="HTML Validation Warnings"
                      items={htmlCandidateValidation.validation.warnings}
                      emptyText="HTML validation warning이 없습니다."
                      isWarning
                    />
                    <SecurityCheckList checks={htmlCandidateValidation.securityChecks} />
                    <HtmlMediaMappingTable mappings={htmlCandidateValidation.mediaMappings} />
                  </>
                ) : (
                  <div className="notice">HTML 후보 재검증 결과가 표시됩니다. {getHtmlCandidateSourceGuidance(htmlCandidateSource)}</div>
                )}
                <div className="read-block">
                  <h3>HTML Candidate Preview</h3>
                  <iframe
                    className="html-preview-frame"
                    sandbox=""
                    srcDoc={htmlCandidateText || htmlPreviewResult.previewHtml}
                    title="HTML conversion candidate preview"
                  />
                </div>
                <label className="plan-editor read-block">
                  HTML Candidate
                  <textarea
                    value={htmlCandidateText}
                    readOnly={!htmlEditMode}
                    onChange={(event) => {
                      setHtmlCandidateText(event.target.value);
                      setHtmlCandidateSource("manual-edit");
                      setHtmlDirty(true);
                      setLastHtmlApplySummary(null);
                      setHtmlApplyConfirmationPending(false);
                    }}
                    spellCheck={false}
                  />
                </label>
                <div className="form-actions">
                  <button className="button secondary" type="button" onClick={() => setHtmlEditMode((current) => !current)}>
                    {htmlEditMode ? "읽기 모드" : "HTML 후보 편집"}
                  </button>
                  <button className="button secondary" type="button" disabled={!htmlCandidateText || validatingHtml} onClick={() => void revalidateHtmlCandidate()}>
                    {validatingHtml ? "재검증 중" : "재검증"}
                  </button>
                  <button className="button" type="button" disabled={!canApplyHtmlCandidate} onClick={() => void applyHtmlCandidate()}>
                    {formatHtmlApplyButtonLabel(applyingHtml, htmlApplyConfirmationPending)}
                  </button>
                </div>
                <div className="notice">draftHtml에 반영해도 Blogger 발행, Blogger draft 저장, LLM 호출, llm_call_logs 생성은 수행하지 않습니다.</div>
              </>
            ) : (
              <div className="notice">HTML Dry Run을 실행하면 저장된 draftMarkdown 기반 previewHtml, media mapping, security readiness가 생성됩니다.</div>
            )}

            {!htmlPreviewResult && htmlCandidateText ? (
              <>
                <div className="notice warning">
                  HTML candidate source: {formatHtmlCandidateSource(htmlCandidateSource)}. HTML Dry Run metadata는 없지만, 기존 validate-html / apply-html 흐름으로 재검증하고
                  수동 반영할 수 있습니다. {getHtmlCandidateSourceGuidance(htmlCandidateSource)}
                </div>
                {htmlCandidateValidation ? (
                  <>
                    <div className={htmlCandidateValidation.validation.ok ? "notice" : "notice error"}>
                      <strong>HTML Candidate Validation</strong>
                      <p>
                        validation: {htmlCandidateValidation.validation.ok ? "pass" : "fail"} / errors:{" "}
                        {htmlCandidateValidation.validation.errors.length} / warnings: {htmlCandidateValidation.validation.warnings.length}
                      </p>
                      <p>
                        html length: {htmlCandidateValidation.metadata.htmlLength} / media refs:{" "}
                        {htmlCandidateValidation.metadata.mediaReferenceCount} / matched:{" "}
                        {htmlCandidateValidation.metadata.matchedMediaReferenceCount} / unmatched:{" "}
                        {htmlCandidateValidation.metadata.unmatchedMediaReferenceCount} / unsafe patterns: {htmlCandidateValidation.metadata.unsafePatternCount}
                      </p>
                    </div>
                    {htmlDirty ? (
                      <div className="notice warning">복사 또는 편집된 HTML 후보는 재검증 후 draftHtml에 반영할 수 있습니다.</div>
                    ) : !htmlCandidateValidation.validation.ok ? (
                      <div className="notice error">이 HTML 후보는 validation/security error가 있어 draftHtml에 반영할 수 없습니다.</div>
                    ) : htmlCandidateValidation.validation.warnings.length > 0 ? (
                      <div className="notice">warning이 있습니다. 내용을 검토한 뒤 draftHtml에 반영할 수 있습니다.</div>
                    ) : (
                      <div className="notice">validation/security 검증을 통과했습니다. 내용을 검토한 뒤 draftHtml에 반영할 수 있습니다.</div>
                    )}
                  </>
                ) : (
                  <div className="notice warning">HTML 후보는 HTML 후보 섹션에서 재검증한 뒤 수동 반영하세요. {getHtmlCandidateSourceGuidance(htmlCandidateSource)}</div>
                )}
                <div className="read-block">
                  <h3>HTML Candidate Preview</h3>
                  <iframe className="html-preview-frame" sandbox="" srcDoc={htmlCandidateText} title="HTML conversion candidate preview" />
                </div>
                <label className="plan-editor read-block">
                  HTML Candidate
                  <textarea
                    value={htmlCandidateText}
                    readOnly={!htmlEditMode}
                    onChange={(event) => {
                      setHtmlCandidateText(event.target.value);
                      setHtmlCandidateSource("manual-edit");
                      setHtmlDirty(true);
                      setLastHtmlApplySummary(null);
                      setHtmlApplyConfirmationPending(false);
                    }}
                    spellCheck={false}
                  />
                </label>
                <div className="form-actions">
                  <button className="button secondary" type="button" onClick={() => setHtmlEditMode((current) => !current)}>
                    {htmlEditMode ? "읽기 모드" : "HTML 후보 편집"}
                  </button>
                  <button className="button secondary" type="button" disabled={!htmlCandidateText || validatingHtml} onClick={() => void revalidateHtmlCandidate()}>
                    {validatingHtml ? "재검증 중" : "재검증"}
                  </button>
                  <button className="button" type="button" disabled={!canApplyHtmlCandidate} onClick={() => void applyHtmlCandidate()}>
                    {formatHtmlApplyButtonLabel(applyingHtml, htmlApplyConfirmationPending)}
                  </button>
                </div>
                <div className="notice">draftHtml에 반영해도 Blogger 발행, Blogger draft 저장, LLM 호출, llm_call_logs 생성은 수행하지 않습니다.</div>
              </>
            ) : null}
          </section>

          <section className="admin-section">
            <div className="section-heading">
              <div>
                <h2>Quality Dry Run</h2>
                <p className="muted">
                  저장된 draftHtml을 기반으로 구조, SEO, 미디어, 안전성, Blogger 호환성 품질을 preview로 검사합니다. DB에는 저장하지 않습니다.
                </p>
              </div>
              <button className="button secondary" type="button" disabled>
                qualityScore 저장은 후속 패치에서 연결 예정
              </button>
            </div>

            {!contentItem.draftHtml ? <div className="notice error">저장된 draftHtml이 없습니다. 먼저 HTML 후보를 draftHtml에 반영하세요.</div> : null}
            {qualityPreviewError ? <div className="notice error">{qualityPreviewError}</div> : null}

            <div className="form-actions">
              <button className="button" type="button" disabled={!canRunQualityPreview} onClick={() => void runQualityPreview()}>
                {runningQualityPreview ? "Quality Dry Run 실행 중" : "Quality Dry Run"}
              </button>
              <button className="button secondary" type="button" disabled>
                Blogger 발행은 수행하지 않음
              </button>
            </div>

            {qualityPreviewResult ? (
              <>
                <div className={qualityPreviewResult.grade === "fail" ? "notice error" : qualityPreviewResult.grade === "warn" ? "notice warning" : "notice"}>
                  <strong>Quality Preview</strong>
                  <p>
                    ready: {qualityPreviewResult.ready ? "yes" : "no"} / grade: {qualityPreviewResult.grade} / score preview:{" "}
                    {qualityPreviewResult.scorePreview}
                  </p>
                  <p>품질검사는 preview이며 DB에 저장하지 않습니다. qualityScore 저장은 후속 패치에서 연결 예정입니다.</p>
                </div>
                <div className="detail-grid">
                  <DetailItem label="HTML Length" value={String(qualityPreviewResult.metadata.draftHtmlLength)} />
                  <DetailItem label="Headings" value={String(qualityPreviewResult.metadata.headingCount)} />
                  <DetailItem label="H1" value={String(qualityPreviewResult.metadata.h1Count)} />
                  <DetailItem label="H2/H3" value={String(qualityPreviewResult.metadata.h2h3Count)} />
                  <DetailItem label="Paragraphs" value={String(qualityPreviewResult.metadata.paragraphCount)} />
                  <DetailItem label="Media Refs" value={String(qualityPreviewResult.metadata.mediaReferenceCount)} />
                  <DetailItem label="Matched Media" value={String(qualityPreviewResult.metadata.matchedMediaReferenceCount)} />
                  <DetailItem label="External Links" value={String(qualityPreviewResult.metadata.externalLinkCount)} />
                </div>
                <QualitySummary checks={qualityPreviewResult.checks} />
                <QualityGroupTable title="Structure" checks={qualityPreviewResult.groups.structure} />
                <QualityGroupTable title="SEO" checks={qualityPreviewResult.groups.seo} />
                <QualityGroupTable title="Media" checks={qualityPreviewResult.groups.media} />
                <QualityGroupTable title="Safety" checks={qualityPreviewResult.groups.safety} />
                <QualityGroupTable title="Blogger Compatibility" checks={qualityPreviewResult.groups.bloggerCompatibility} />
              </>
            ) : (
              <div className="notice">Quality Dry Run을 실행하면 저장된 draftHtml 기반 품질검사 결과가 화면에만 생성됩니다.</div>
            )}
          </section>

          <section className="admin-section">
            <div className="section-heading">
              <div>
                <h2>Quality Repair Preview</h2>
                <p className="muted">
                  저장된 draftMarkdown을 우선 사용해 더 긴 HTML 품질 보강 후보를 생성합니다. 후보만 생성하며 draftHtml은 자동 저장하지 않습니다.
                </p>
              </div>
              <button className="button secondary" type="button" disabled>
                LLM, Blogger API, publish는 수행하지 않음
              </button>
            </div>

            {!contentItem.draftMarkdown && !contentItem.draftHtml ? (
              <div className="notice error">repair 후보를 만들 draftMarkdown 또는 draftHtml이 없습니다.</div>
            ) : null}
            {qualityRepairPreviewError ? <div className="notice error">{qualityRepairPreviewError}</div> : null}

            <div className="form-actions">
              <button className="button" type="button" disabled={!canRunQualityRepairPreview} onClick={() => void runQualityRepairPreview()}>
                {runningQualityRepairPreview ? "Quality Repair Preview 실행 중" : "Quality Repair Preview"}
              </button>
              <button className="button secondary" type="button" disabled={!qualityRepairCandidateText || validatingQualityRepairCandidate} onClick={() => void revalidateQualityRepairCandidate()}>
                {validatingQualityRepairCandidate ? "재검증 중" : "Repair 후보 재검증"}
              </button>
              <button className="button secondary" type="button" disabled={!qualityRepairCandidateText || qualityRepairDirty || !qualityRepairCandidateValidation?.validation.ok} onClick={copyQualityRepairToHtmlCandidate}>
                HTML 후보로 사용
              </button>
            </div>

            {qualityRepairPreviewResult ? (
              <>
                <div
                  className={
                    qualityRepairPreviewResult.afterQuality.grade === "fail"
                      ? "notice error"
                      : qualityRepairPreviewResult.afterQuality.grade === "warn"
                        ? "notice warning"
                        : "notice"
                  }
                >
                  <strong>Quality Repair Candidate</strong>
                  <p>
                    source: {qualityRepairPreviewResult.source} / before length: {qualityRepairPreviewResult.repairSummary.beforeLength} / after length:{" "}
                    {qualityRepairPreviewResult.repairSummary.afterLength}
                  </p>
                  <p>
                    before grade: {qualityRepairPreviewResult.beforeQuality.grade} / after grade: {qualityRepairPreviewResult.afterQuality.grade} / before required fails:{" "}
                    {countRequiredQualityFails(qualityRepairPreviewResult.beforeQuality)} / after required fails:{" "}
                    {countRequiredQualityFails(qualityRepairPreviewResult.afterQuality)}
                  </p>
                  <p>
                    CTA added: {qualityRepairPreviewResult.repairSummary.ctaAdded ? "yes" : "no"} / disclaimer added:{" "}
                    {qualityRepairPreviewResult.repairSummary.disclaimerAdded ? "yes" : "no"} / mutation:{" "}
                    {qualityRepairPreviewResult.repairSummary.mutationPerformed ? "yes" : "no"}
                  </p>
                  <p>후보만 생성합니다. draftHtml은 자동 저장하지 않습니다. HTML 후보로 사용한 뒤 재검증하고 수동 반영하세요.</p>
                  <p>draftHtml을 반영하면 기존 Blogger draft approval snapshot은 stale이 될 수 있습니다.</p>
                </div>
                <div className="detail-grid">
                  <DetailItem label="Target Min Length" value={String(qualityRepairPreviewResult.repairSummary.targetMinLength)} />
                  <DetailItem label="Before Score" value={String(qualityRepairPreviewResult.beforeQuality.scorePreview)} />
                  <DetailItem label="After Score" value={String(qualityRepairPreviewResult.afterQuality.scorePreview)} />
                  <DetailItem label="After Validation" value={qualityRepairPreviewResult.afterValidation.validation.ok ? "pass" : "fail"} />
                  <DetailItem label="After HTML Length" value={String(qualityRepairPreviewResult.afterQuality.metadata.draftHtmlLength)} />
                  <DetailItem label="After CTA Signals" value={String(qualityRepairPreviewResult.afterQuality.metadata.ctaSignalCount)} />
                </div>
                <ValidationList
                  title="Added Repair Sections"
                  items={qualityRepairPreviewResult.repairSummary.addedSections}
                  emptyText="추가된 repair section이 없습니다."
                />
                {qualityRepairCandidateValidation ? (
                  <>
                    <div className={qualityRepairCandidateValidation.validation.ok ? "notice" : "notice error"}>
                      <strong>Repair Candidate Validation</strong>
                      <p>
                        validation: {qualityRepairCandidateValidation.validation.ok ? "pass" : "fail"} / errors:{" "}
                        {qualityRepairCandidateValidation.validation.errors.length} / warnings:{" "}
                        {qualityRepairCandidateValidation.validation.warnings.length}
                      </p>
                    </div>
                    <ValidationList
                      title="Repair Candidate Validation Errors"
                      items={qualityRepairCandidateValidation.validation.errors}
                      emptyText="HTML validation/security error가 없습니다."
                      isError
                    />
                    <ValidationList
                      title="Repair Candidate Validation Warnings"
                      items={qualityRepairCandidateValidation.validation.warnings}
                      emptyText="HTML validation warning이 없습니다."
                      isWarning
                    />
                  </>
                ) : null}
                {qualityRepairDirty ? <div className="notice warning">편집된 repair 후보는 재검증 후 HTML 후보 편집기로 복사할 수 있습니다.</div> : null}
                <label className="plan-editor read-block">
                  Quality Repair Candidate
                  <textarea
                    value={qualityRepairCandidateText}
                    readOnly={!qualityRepairEditMode}
                    onChange={(event) => {
                      setQualityRepairCandidateText(event.target.value);
                      setQualityRepairDirty(true);
                      setQualityRepairCandidateValidation(null);
                    }}
                    spellCheck={false}
                  />
                </label>
                <div className="form-actions">
                  <button className="button secondary" type="button" onClick={() => setQualityRepairEditMode((current) => !current)}>
                    {qualityRepairEditMode ? "읽기 모드" : "Repair 후보 편집"}
                  </button>
                  <button className="button secondary" type="button" disabled={!qualityRepairCandidateText || validatingQualityRepairCandidate} onClick={() => void revalidateQualityRepairCandidate()}>
                    {validatingQualityRepairCandidate ? "재검증 중" : "재검증"}
                  </button>
                  <button className="button" type="button" disabled={!qualityRepairCandidateText || qualityRepairDirty || !qualityRepairCandidateValidation?.validation.ok} onClick={copyQualityRepairToHtmlCandidate}>
                    HTML 후보로 사용
                  </button>
                </div>
                <div className="notice">저장은 기존 HTML 후보 섹션에서 재검증 후 draftHtml에 반영 버튼으로만 수행합니다.</div>
              </>
            ) : (
              <div className="notice">Quality Repair Preview를 실행하면 rule-based HTML 보강 후보가 화면에만 생성됩니다.</div>
            )}
          </section>

          <section className="admin-section">
            <div className="section-heading">
              <div>
                <h2>Draft And Quality</h2>
                <p className="muted">아직 자동 생성, HTML 변환, 품질검사는 연결하지 않았습니다.</p>
              </div>
            </div>
            <div className="read-block">
              <h3>Draft Markdown</h3>
              <pre>{contentItem.draftMarkdown || "아직 본문 생성 전입니다."}</pre>
            </div>
            <div className="read-block">
              <h3>Draft HTML</h3>
              <pre>{contentItem.draftHtml || "아직 HTML 변환 전입니다."}</pre>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}

function StepwiseDraftGenerationSection({
  runs,
  selectedRun,
  selectedRunId,
  loading,
  creating,
  executingStepKey,
  assembling,
  finalPolishing,
  busy,
  canCreateRun,
  canAssemble,
  canFinalPolish,
  error,
  notice,
  onRefresh,
  onCreate,
  onSelect,
  onExecuteStep,
  onAssemble,
  onFinalPolish,
  onUseFinalCandidate
}: {
  runs: StepwiseDraftGenerationRunSummary[];
  selectedRun: StepwiseDraftGenerationRunDetail | null;
  selectedRunId: string | null;
  loading: boolean;
  creating: boolean;
  executingStepKey: string | null;
  assembling: boolean;
  finalPolishing: boolean;
  busy: boolean;
  canCreateRun: boolean;
  canAssemble: boolean;
  canFinalPolish: boolean;
  error: string | null;
  notice: string | null;
  onRefresh: () => void;
  onCreate: () => void;
  onSelect: (runId: string) => void;
  onExecuteStep: (stepKey: string) => void;
  onAssemble: () => void;
  onFinalPolish: () => void;
  onUseFinalCandidate: () => void;
}) {
  const missingSectionKeys = selectedRun ? getMissingStepwiseSectionKeys(selectedRun) : [];
  const canUseFinalCandidate = Boolean(selectedRun?.finalCandidateMarkdown && selectedRun.status === "completed");

  return (
    <section className="admin-section">
      <div className="section-heading">
        <div>
          <h2>Stepwise Draft Generation</h2>
          <p className="muted">로컬 LLM 기반 단계별 장문 초안 생성 run을 조회하고 한 단계씩 실행합니다.</p>
        </div>
        <button className="button secondary" type="button" disabled>
          후보 저장소 only
        </button>
      </div>

      <div className="notice warning">
        <strong>실험적 local stepwise flow</strong>
        <p>content item에는 자동 반영하지 않습니다. draftMarkdown/draftHtml/status/qualityScore/publishedAt/scheduledAt을 변경하지 않습니다.</p>
        <p>Blogger API, Blogger draft save, publish, scheduled publish, token refresh를 호출하지 않습니다.</p>
        <p>생성 결과는 stepwise run candidate에만 저장됩니다. content item 적용 기능은 후속 패치에서 별도로 설계합니다.</p>
      </div>

      {error ? <div className="notice error">{error}</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}
      {loading ? <div className="notice">stepwise run 정보를 불러오는 중입니다.</div> : null}

      <div className="form-actions">
        <button className="button" type="button" disabled={!canCreateRun} onClick={onCreate}>
          {creating ? "새 run 생성 중" : "새 stepwise run 생성"}
        </button>
        <button className="button secondary" type="button" disabled={loading} onClick={onRefresh}>
          Run 목록 새로고침
        </button>
        <button className="button secondary" type="button" disabled>
          content item 적용은 후속 패치
        </button>
      </div>

      <StepwiseRunList runs={runs} selectedRunId={selectedRunId} onSelect={onSelect} />

      {selectedRun ? (
        <>
          <div className="detail-grid">
            <DetailItem label="Selected Run ID" value={selectedRun.id} />
            <DetailItem label="Strategy" value={selectedRun.strategy} />
            <DetailItem label="Status" value={selectedRun.status} />
            <DetailItem label="Current Step" value={selectedRun.currentStepKey ?? "-"} />
            <DetailItem label="Created" value={formatDate(selectedRun.createdAt)} />
            <DetailItem label="Updated" value={formatDate(selectedRun.updatedAt)} />
            <DetailItem label="Completed" value={selectedRun.completedAt ? formatDate(selectedRun.completedAt) : "-"} />
            <DetailItem label="Assembled Candidate" value={selectedRun.assembledCandidateMarkdown ? "yes" : "no"} />
            <DetailItem label="Final Candidate" value={selectedRun.finalCandidateMarkdown ? "yes" : "no"} />
          </div>

          <StepwiseStepTable
            run={selectedRun}
            busy={busy}
            executingStepKey={executingStepKey}
            onExecuteStep={onExecuteStep}
          />

          <div className={missingSectionKeys.length > 0 ? "notice warning" : "notice"}>
            <strong>Assemble readiness</strong>
            {missingSectionKeys.length > 0 ? (
              <p>아직 assemble할 수 없습니다. 빠진 section: {missingSectionKeys.join(", ")}</p>
            ) : (
              <p>모든 section output이 success 상태입니다. deterministic assemble을 실행할 수 있습니다.</p>
            )}
            <p>assemble은 LLM 호출 없이 section output을 고정 순서로 결합합니다.</p>
          </div>

          <div className="form-actions">
            <button className="button" type="button" disabled={!canAssemble} onClick={onAssemble}>
              {assembling ? "Assemble 실행 중" : "Deterministic Assemble"}
            </button>
            <button className="button secondary" type="button" disabled={!canFinalPolish} onClick={onFinalPolish}>
              {finalPolishing ? "Final Polish 실행 중" : "Final Polish 로컬 LLM 호출"}
            </button>
          </div>

          <StepwiseValidationSummary summary={selectedRun.validationSummary} />
          <StepwiseCandidatePreview title="Assembled Candidate Markdown" value={selectedRun.assembledCandidateMarkdown} />
          <StepwiseCandidatePreview title="Final Candidate Markdown" value={selectedRun.finalCandidateMarkdown} />

          <div className={canUseFinalCandidate ? "notice" : "notice warning"}>
            <strong>Manual apply guard</strong>
            <p>finalCandidateMarkdown은 content item에 즉시 저장하지 않습니다. 아래 버튼은 기존 초안 후보 편집기에 client-side로만 복사합니다.</p>
            <p>draftHtml 변환, Blogger API, draft save, publish, token refresh와는 별도 단계입니다.</p>
            <div className="form-actions">
              <button className="button" type="button" disabled={!canUseFinalCandidate} onClick={onUseFinalCandidate}>
                수동 적용 후보로 사용
              </button>
              <button className="button secondary" type="button" disabled>
                자동 저장 없음
              </button>
            </div>
          </div>

          <div className="notice warning">
            <strong>Ollama diagnostics</strong>
            <p>{formatStepwiseErrorCode("provider_first_byte_timeout")}</p>
            <p>다른 큰 모델이 GPU/context를 점유하면 first-byte timeout이 날 수 있습니다.</p>
            <p>실제 LLM 실행 전 `node scripts/smoke_9e4c3c_stepwise_local_ollama.mjs --probe-generate` 확인을 권장합니다.</p>
          </div>
        </>
      ) : (
        <div className="notice">선택된 stepwise run이 없습니다. 기존 run을 선택하거나 새 run을 생성하세요.</div>
      )}
    </section>
  );
}

function StepwiseRunList({
  runs,
  selectedRunId,
  onSelect
}: {
  runs: StepwiseDraftGenerationRunSummary[];
  selectedRunId: string | null;
  onSelect: (runId: string) => void;
}) {
  if (runs.length === 0) {
    return <div className="notice">아직 stepwise run이 없습니다. 새 stepwise run을 생성하세요.</div>;
  }

  return (
    <div className="read-block">
      <h3>Recent Runs</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Run</th>
              <th>Status</th>
              <th>Current</th>
              <th>Steps</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Completed</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>
                  <code>{run.id}</code>
                </td>
                <td>{run.status}</td>
                <td>{run.currentStepKey ?? "-"}</td>
                <td>{run.stepCount ?? "-"}</td>
                <td>{formatDate(run.createdAt)}</td>
                <td>{formatDate(run.updatedAt)}</td>
                <td>{run.completedAt ? formatDate(run.completedAt) : "-"}</td>
                <td>
                  <button className="button secondary" type="button" disabled={selectedRunId === run.id} onClick={() => onSelect(run.id)}>
                    {selectedRunId === run.id ? "선택됨" : "선택"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StepwiseStepTable({
  run,
  busy,
  executingStepKey,
  onExecuteStep
}: {
  run: StepwiseDraftGenerationRunDetail;
  busy: boolean;
  executingStepKey: string | null;
  onExecuteStep: (stepKey: string) => void;
}) {
  const stepsByKey = new Map(run.steps.map((step) => [step.stepKey, step]));

  return (
    <div className="read-block">
      <h3>Step Execution</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Step</th>
              <th>Section</th>
              <th>Status</th>
              <th>Attempt</th>
              <th>Output</th>
              <th>Latency</th>
              <th>Error</th>
              <th>Hashes</th>
              <th>Summary</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {STEPWISE_STEP_ORDER.map((stepKey) => {
              const step = stepsByKey.get(stepKey);
              const canRun = Boolean(step && canRunStepwiseStep(run, stepKey, busy));
              return (
                <tr key={stepKey}>
                  <td>
                    <code>{stepKey}</code>
                  </td>
                  <td>{step?.sectionKey ?? "-"}</td>
                  <td>{step?.status ?? "missing"}</td>
                  <td>{step?.attempt ?? "-"}</td>
                  <td>{step?.hasOutputMarkdown ? "yes" : "no"}</td>
                  <td>{step?.latencyMs ? `${step.latencyMs}ms` : "-"}</td>
                  <td>{step?.errorCode ? formatStepwiseErrorCode(step.errorCode) : "-"}</td>
                  <td>
                    <div>prompt: {step?.promptHash ?? "-"}</div>
                    <div>response: {step?.responseHash ?? "-"}</div>
                  </td>
                  <td>{step?.outputSummary ? step.outputSummary.slice(0, 180) : "-"}</td>
                  <td>
                    <button className="button secondary" type="button" disabled={!canRun} onClick={() => onExecuteStep(stepKey)}>
                      {executingStepKey === stepKey ? "로컬 LLM 호출 중" : step?.status === "success" ? "완료" : "로컬 LLM 호출"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="notice">성공한 step은 이번 UI에서 다시 실행하지 않습니다. retry/force UX는 후속 패치에서 별도로 다룹니다.</div>
    </div>
  );
}

function StepwiseValidationSummary({ summary }: { summary: StepwiseValidationSummary | null }) {
  if (!summary) {
    return <div className="notice">validation summary가 아직 없습니다. assemble 또는 final polish 후 표시됩니다.</div>;
  }

  return (
    <div className={summary.ok ? "notice" : "notice warning"}>
      <strong>Run Candidate Validation Summary</strong>
      <p>
        phase: {summary.phase ?? "-"} / ok: {summary.ok ? "yes" : "no"} / length: {summary.markdownLength ?? "-"} / errors:{" "}
        {summary.errorCount ?? 0} / warnings: {summary.warningCount ?? 0}
      </p>
      {summary.guardSummary ? (
        <p>
          FAQ required: {summary.guardSummary.faqRequired ? "yes" : "no"} / FAQ detected:{" "}
          {summary.guardSummary.faqSectionDetectedAfter ? "yes" : "no"} / safety scrub:{" "}
          {summary.guardSummary.safetyScrubApplied ? `applied ${summary.guardSummary.safetyScrubCount ?? 0}` : "not applied"}
        </p>
      ) : null}
      {summary.errors && summary.errors.length > 0 ? <ValidationList title="Candidate Errors" items={summary.errors} emptyText="error가 없습니다." isError /> : null}
      {summary.warnings && summary.warnings.length > 0 ? <ValidationList title="Candidate Warnings" items={summary.warnings} emptyText="warning이 없습니다." isWarning /> : null}
    </div>
  );
}

function StepwiseCandidatePreview({ title, value }: { title: string; value: string | null }) {
  return (
    <div className="read-block">
      <h3>{title}</h3>
      {value ? <pre style={{ maxHeight: 420, overflow: "auto" }}>{value}</pre> : <div className="notice">아직 candidate가 없습니다.</div>}
    </div>
  );
}

function getMissingStepwiseSectionKeys(run: StepwiseDraftGenerationRunDetail) {
  return STEPWISE_SECTION_KEYS.filter((key) => {
    const step = run.steps.find((item) => item.stepKey === key);
    return step?.status !== "success" || !step.hasOutputMarkdown;
  });
}

function canRunStepwiseStep(run: StepwiseDraftGenerationRunDetail, stepKey: string, busy: boolean) {
  const step = run.steps.find((item) => item.stepKey === stepKey);
  if (!step || busy || run.status === "completed" || run.status === "cancelled" || step.status === "running" || step.status === "success") {
    return false;
  }
  if (stepKey === "skeleton") {
    return true;
  }
  const skeleton = run.steps.find((item) => item.stepKey === "skeleton");
  return Boolean(skeleton?.status === "success" && skeleton.hasOutputMarkdown);
}

function buildStepwiseErrorMessage(code: string) {
  return `${code}: ${formatStepwiseErrorCode(code)}`;
}

function formatStepwiseErrorCode(code: string) {
  if (code === "provider_first_byte_timeout") {
    return "provider_first_byte_timeout - Ollama/model이 첫 응답 byte를 제시간에 반환하지 않았습니다. 다른 큰 모델이 GPU/context를 점유했는지 확인하세요.";
  }
  if (code === "provider_idle_timeout") {
    return "provider_idle_timeout - streaming 응답 도중 provider가 멈췄습니다. Ollama 상태와 모델 부하를 확인하세요.";
  }
  if (code === "provider_timeout") {
    return "provider_timeout - provider 호출 전체 제한 시간을 초과했습니다.";
  }
  if (code === "provider_network_error") {
    return "provider_network_error - local provider endpoint에 연결하지 못했습니다.";
  }
  if (code === "provider_model_not_found") {
    return "provider_model_not_found - 설정된 Ollama model이 /api/tags 결과에 없습니다.";
  }
  if (code === "section_steps_required") {
    return "section_steps_required - assemble 전 모든 section step이 success이고 outputMarkdown이 있어야 합니다.";
  }
  if (code === "assembled_candidate_required") {
    return "assembled_candidate_required - final polish 전 assembled candidate가 필요합니다.";
  }
  if (code === "skeleton_required") {
    return "skeleton_required - section step 실행 전 skeleton step이 먼저 성공해야 합니다.";
  }
  if (code === "local_stepwise_route_required") {
    return "local_stepwise_route_required - stepwise 실행은 local/Ollama/local_http content_draft route에서만 허용됩니다.";
  }
  return code;
}

function buildBloggerDraftAdminLinks(draftSave: BloggerDraftSaveAdmin | null) {
  if (!draftSave?.targetBloggerBlogId || !draftSave.bloggerPostId) {
    return null;
  }

  return buildBloggerDraftAdminLinksFromIds(draftSave.targetBloggerBlogId, draftSave.bloggerPostId);
}

function buildBloggerDraftAdminLinksFromIds(blogId: string | null, postId: string | null) {
  if (!blogId || !postId) {
    return null;
  }

  const encodedBlogId = encodeURIComponent(blogId);
  const encodedPostId = encodeURIComponent(postId);

  return {
    editUrl: `https://www.blogger.com/blog/post/edit/${encodedBlogId}/${encodedPostId}`,
    previewUrl: `https://www.blogger.com/blog/post/edit/preview/${encodedBlogId}/${encodedPostId}`
  };
}

function looksLikeBloggerBlogHomeUrl(draftSave: BloggerDraftSaveAdmin | null) {
  if (!draftSave?.bloggerPostUrl || !draftSave.targetBloggerBlogUrl) {
    return false;
  }

  return normalizeUrlForComparison(draftSave.bloggerPostUrl) === normalizeUrlForComparison(draftSave.targetBloggerBlogUrl);
}

function normalizeUrlForComparison(value: string) {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.protocol.toLowerCase()}//${url.host.toLowerCase()}${pathname}`;
  } catch {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ProviderTestSummary({ title, provider }: { title: string; provider: NonNullable<LlmTaskRouteAdmin["primaryProvider"]> }) {
  return (
    <div className="notice">
      <strong>{title}</strong>
      <p className="muted">
        {provider.name} / {getInvocationModeLabel(provider.invocationMode)} / {getApiFormatLabel(provider.apiFormat)}
      </p>
      <p>
        status: {provider.lastTestStatus} / tested: {provider.lastTestedAt ? formatDate(provider.lastTestedAt) : "not tested"}
      </p>
      {provider.lastTestError ? <p className="muted">last error: {provider.lastTestError}</p> : null}
    </div>
  );
}

function PromptPreviewBlock({ title, value }: { title: string; value: string }) {
  return (
    <label className="plan-editor read-block">
      Prompt Preview: {title}
      <textarea value={value} readOnly spellCheck={false} />
    </label>
  );
}

function ValidationList({
  title,
  items,
  emptyText,
  isError = false,
  isWarning = false
}: {
  title: string;
  items: string[];
  emptyText: string;
  isError?: boolean;
  isWarning?: boolean;
}) {
  const className = isError && items.length > 0 ? "notice error" : isWarning && items.length > 0 ? "notice warning" : "notice";

  return (
    <div className={className}>
      <strong>{title}</strong>
      {items.length === 0 ? (
        <p>{emptyText}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReadinessTable({ checks }: { checks: Array<{ key: string; label: string; status: ReadinessStatus; message: string }> }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Check</th>
            <th>Status</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr key={check.key}>
              <td>{check.label}</td>
              <td>{formatReadinessStatus(check.status)}</td>
              <td>{check.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SecurityCheckList({ checks }: { checks: HtmlPreviewDryRunResult["securityChecks"] }) {
  return (
    <div className="read-block">
      <h3>Sanitization / Security Readiness</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Check</th>
              <th>Status</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => (
              <tr key={check.key}>
                <td>{check.key}</td>
                <td>{formatReadinessStatus(check.status)}</td>
                <td>{check.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HtmlMediaMappingTable({ mappings }: { mappings: HtmlPreviewDryRunResult["mediaMappings"] }) {
  return (
    <div className="read-block">
      <h3>HTML Media Placeholder Mapping</h3>
      {mappings.length === 0 ? (
        <div className="notice">draftMarkdown에 media placeholder가 없습니다.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Placeholder</th>
                <th>Asset</th>
                <th>Type</th>
                <th>Placement</th>
                <th>Caption</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping) => (
                <tr key={`${mapping.placeholder}-${mapping.assetId ?? "missing"}`}>
                  <td>
                    <code>{mapping.placeholder}</code>
                  </td>
                  <td>{mapping.originalName ?? mapping.assetId ?? "-"}</td>
                  <td>{mapping.assetType ?? "-"}</td>
                  <td>{mapping.placement ?? "-"}</td>
                  <td>{mapping.caption || "-"}</td>
                  <td>{mapping.matched ? "matched" : mapping.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function QualitySummary({ checks }: { checks: HtmlQualityPreviewResult["checks"] }) {
  const requiredFailCount = checks.filter((check) => check.severity === "required" && check.status === "fail").length;
  const recommendedIssueCount = checks.filter((check) => check.severity === "recommended" && check.status !== "pass").length;
  const optionalIssueCount = checks.filter((check) => check.severity === "optional" && check.status !== "pass").length;
  const priorityIssues = checks.filter((check) => check.status !== "pass");

  return (
    <div className={requiredFailCount > 0 ? "notice error" : priorityIssues.length > 0 ? "notice warning" : "notice"}>
      <strong>Quality Issue Summary</strong>
      <p>
        required fail: {requiredFailCount} / recommended issues: {recommendedIssueCount} / optional issues: {optionalIssueCount}
      </p>
      {priorityIssues.length === 0 ? (
        <p>실패 또는 경고 항목이 없습니다.</p>
      ) : (
        <ul>
          {priorityIssues.slice(0, 8).map((check) => (
            <li key={check.key}>
              [{check.group}] {check.label}: {check.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function countRequiredQualityFails(result: HtmlQualityPreviewResult) {
  return result.checks.filter((check) => check.status === "fail" && check.severity === "required").length;
}

function formatHtmlCandidateSource(source: HtmlCandidateSource) {
  if (source === "html-preview") {
    return "generated HTML candidate";
  }
  if (source === "quality-repair") {
    return "quality repair HTML candidate";
  }
  if (source === "blog-template-preview") {
    return "blog template preview";
  }
  if (source === "applied-html-candidate") {
    return "applied HTML candidate / saved draftHtml";
  }
  if (source === "manual-edit") {
    return "manual edit";
  }
  return "saved draftHtml / none";
}

function getHtmlCandidateSourceGuidance(source: HtmlCandidateSource) {
  if (source === "blog-template-preview") {
    return "Blog template preview에서 가져온 후보이며, 아직 draftHtml에 저장되지 않았습니다. 재검증 후 기존 수동 반영 버튼을 별도로 눌러야 저장됩니다.";
  }
  if (source === "applied-html-candidate") {
    return "방금 수동 반영으로 draftHtml에 저장된 HTML 후보입니다. Quality Dry Run, Publish Readiness, Blogger Draft Payload Preview를 다시 실행하세요.";
  }
  if (source === "quality-repair") {
    return "Quality repair에서 가져온 후보이며, 아직 draftHtml에 저장되지 않았습니다. 재검증 후 기존 수동 반영 버튼을 별도로 눌러야 저장됩니다.";
  }
  if (source === "html-preview") {
    return "저장된 draftMarkdown에서 생성한 HTML 후보이며, 검토 후 수동 반영 버튼을 눌러야 draftHtml에 저장됩니다.";
  }
  if (source === "manual-edit") {
    return "사용자가 편집한 HTML 후보이며, 재검증 후 수동 반영 버튼을 눌러야 draftHtml에 저장됩니다.";
  }
  return "HTML 후보가 아직 없거나 saved draftHtml만 표시 중입니다.";
}

function formatHtmlApplyButtonLabel(applying: boolean, confirmationPending: boolean) {
  if (applying) {
    return "draftHtml 반영 중";
  }
  if (confirmationPending) {
    return "draftHtml 저장 확정";
  }
  return "draftHtml에 반영";
}

function formatBloggerDraftSaveButtonLabel(saving: boolean, confirmationPending: boolean) {
  if (saving) {
    return "Blogger Draft 저장 중";
  }
  if (confirmationPending) {
    return "Blogger Draft 저장 확정";
  }
  return "Blogger Draft 저장";
}

function formatDraftCandidateSource(source: DraftCandidateSource) {
  if (source === "llm-generated") {
    return "LLM generated draft candidate";
  }
  if (source === "stepwise-final-candidate") {
    return "stepwise final candidate";
  }
  if (source === "manual-edit") {
    return "manual edit";
  }
  return "none";
}

function toBlogPostTemplatePreviewSource(source: DraftCandidateSource): BlogPostTemplatePreviewSource {
  if (source === "stepwise-final-candidate") {
    return "stepwise_final_candidate";
  }
  if (source === "llm-generated" || source === "manual-edit") {
    return "manual_draft_candidate";
  }
  return "saved_draft_markdown";
}

function formatBlogPostTemplatePreviewSource(source: BlogPostTemplatePreviewSource) {
  if (source === "stepwise_final_candidate") {
    return "stepwise final candidate";
  }
  if (source === "saved_draft_markdown") {
    return "saved draftMarkdown";
  }
  return "manual draft candidate";
}

function QualityGroupTable({ title, checks }: { title: string; checks: HtmlQualityPreviewResult["checks"] }) {
  return (
    <div className="read-block">
      <h3>{title}</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Check</th>
              <th>Status</th>
              <th>Severity</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => (
              <tr key={check.key}>
                <td>{check.label}</td>
                <td>{check.status}</td>
                <td>{check.severity}</td>
                <td>{check.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PublishReadinessSummary({ result }: { result: PublishReadinessResult }) {
  return (
    <>
      <div className={result.blockingIssues.length > 0 ? "notice error" : "notice"}>
        <strong>Blocking Issues</strong>
        {result.blockingIssues.length === 0 ? (
          <p>blocking issue가 없습니다.</p>
        ) : (
          <ul>
            {result.blockingIssues.map((issue) => (
              <li key={issue.key}>
                {issue.label}: {issue.message}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={result.warnings.length > 0 ? "notice warning" : "notice"}>
        <strong>Warnings</strong>
        {result.warnings.length === 0 ? (
          <p>warning이 없습니다.</p>
        ) : (
          <ul>
            {result.warnings.map((warning) => (
              <li key={warning.key}>
                {warning.label}: {warning.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function BloggerDraftSaveReadinessChecklist({
  result,
  hasSavedDraftHtml,
  qualityDryRunChecked,
  publishReadinessChecked,
  draftPayloadPreviewChecked,
  draftAlreadySaved
}: {
  result: BloggerDraftSavePreflight;
  hasSavedDraftHtml: boolean;
  qualityDryRunChecked: boolean;
  publishReadinessChecked: boolean;
  draftPayloadPreviewChecked: boolean;
  draftAlreadySaved: boolean;
}) {
  const rows = [
    {
      key: "saved-draft-html",
      label: "Saved draftHtml exists",
      status: hasSavedDraftHtml ? "pass" : "fail",
      message: hasSavedDraftHtml ? "저장된 draftHtml이 있습니다." : "HTML 후보를 검증한 뒤 draftHtml에 수동 반영하세요."
    },
    {
      key: "html-validation",
      label: "HTML validation pass",
      status: result.htmlValidation.ok ? "pass" : "fail",
      message: result.htmlValidation.ok ? "저장된 draftHtml validation이 통과했습니다." : "HTML validation error를 해결하고 다시 반영하세요."
    },
    {
      key: "quality-dry-run",
      label: "Quality Dry Run checked",
      status: qualityDryRunChecked ? "pass" : "warn",
      message: qualityDryRunChecked ? "화면에서 Quality Dry Run을 실행했습니다." : "Quality Dry Run을 실행해 저장된 draftHtml 품질을 확인하세요."
    },
    {
      key: "publish-readiness",
      label: "Publish Readiness checked",
      status: publishReadinessChecked ? "pass" : "warn",
      message: publishReadinessChecked ? "화면에서 Publish Readiness를 실행했습니다." : "Publish Readiness를 실행해 gate 상태를 확인하세요."
    },
    {
      key: "blogger-connection",
      label: "Blogger connection configured",
      status: result.bloggerConnectionSummary.connectionCount > 0 && result.bloggerConnectionSummary.status === "connected" ? "pass" : "fail",
      message:
        result.bloggerConnectionSummary.connectionCount > 0 && result.bloggerConnectionSummary.status === "connected"
          ? "Blogger connection이 connected 상태입니다."
          : "설정 > Blogger에서 연결을 먼저 완료하세요."
    },
    {
      key: "access-token",
      label: "Access token usable",
      status: result.bloggerConnectionSummary.hasAccessToken && !result.bloggerConnectionSummary.accessTokenExpired ? "pass" : "fail",
      message:
        result.bloggerConnectionSummary.hasAccessToken && !result.bloggerConnectionSummary.accessTokenExpired
          ? "Access token이 draft save preflight에서 사용 가능한 상태입니다."
          : result.bloggerConnectionSummary.accessTokenExpired
            ? "Access token이 만료되었습니다. Blogger OAuth 연결을 다시 실행하세요."
            : "Blogger OAuth access token이 필요합니다."
    },
    {
      key: "blog-selection",
      label: "Blog selected",
      status: result.selectedBlogSummary.selected ? "pass" : "fail",
      message: result.selectedBlogSummary.selected ? "검증된 Blogger blog가 선택되어 있습니다." : "연결 후 대상 Blogger blog를 선택하세요."
    },
    {
      key: "payload-preview",
      label: "Draft payload preview ready",
      status: result.draftPayloadPreviewSummary.draftPayloadReady ? "pass" : "fail",
      message: draftPayloadPreviewChecked
        ? result.draftPayloadPreviewSummary.draftPayloadReady
          ? "Draft payload preview가 ready 상태입니다."
          : "Draft payload preview blocking reason을 해결하세요."
        : "Blogger Draft Payload Preview를 실행해 payload 후보를 확인하세요."
    },
    {
      key: "manual-approval",
      label: "Manual approval snapshot matches current draftHtml",
      status: result.approvalSnapshotStatus.status === "approved" && result.approvalSnapshotStatus.approvalMatchesCurrentPreview ? "pass" : "fail",
      message:
        result.approvalSnapshotStatus.status === "approved" && result.approvalSnapshotStatus.approvalMatchesCurrentPreview
          ? "Manual approval snapshot이 현재 draftHtml/payload와 일치합니다."
          : "Blogger Draft Payload Preview를 확인하고 수동 approval snapshot을 생성하세요."
    },
    {
      key: "draft-save-ready",
      label: "Draft already saved or save ready",
      status: draftAlreadySaved || result.canSaveDraft ? "pass" : "fail",
      message: draftAlreadySaved
        ? "현재 preview 기준 draft save 성공 기록이 있습니다."
        : result.canSaveDraft
          ? "Draft save를 시도할 수 있는 상태입니다."
          : result.draftSavePreflightSummary.duplicateSaveBlocked
            ? "현재 approval snapshot으로 이미 성공한 draft save가 있어 중복 저장을 막습니다."
            : "아직 draft save 성공 기록이 없는 것은 첫 저장 전 정상 상태이며, 다른 blocker를 먼저 해결하세요."
    }
  ];

  return (
    <div className="read-block">
      <h3>Draft Save Readiness Checklist</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Step</th>
              <th>Status</th>
              <th>Next action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td>{row.status}</td>
                <td>{row.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BloggerDraftSaveActionItems({ result }: { result: BloggerDraftSavePreflight }) {
  const items = result.blockingReasons.map((reason) => getBloggerDraftSaveActionItem(reason));
  const dedupedItems = items.filter((item, index) => items.findIndex((candidate) => candidate.action === item.action && candidate.label === item.label) === index);

  return (
    <div className={dedupedItems.length > 0 ? "notice warning" : "notice"}>
      <strong>What To Do Next</strong>
      {dedupedItems.length === 0 ? (
        <p>blocking reason이 없습니다. 실제 draft save 전 사용자 승인 문구와 대상 test blog를 다시 확인하세요.</p>
      ) : (
        <ul>
          {dedupedItems.map((item) => (
            <li key={item.reason}>
              <strong>{item.label}</strong>: {item.action} <span className="muted">({item.reason})</span>
            </li>
          ))}
        </ul>
      )}
      {result.bloggerConnectionSummary.connectionCount === 0 ? (
        <p>
          <Link href="/settings/blogger">Blogger 설정</Link>에서 connection을 만든 뒤 이 preflight를 다시 실행하세요.
        </p>
      ) : null}
    </div>
  );
}

function PublishPreflightActionItems({ result }: { result: PublishPreflightDryRun }) {
  const items = result.blockingReasons.map((reason) => getPublishPreflightActionItem(reason));
  const dedupedItems = items.filter((item, index) => items.findIndex((candidate) => candidate.action === item.action && candidate.label === item.label) === index);

  return (
    <div className="notice warning">
      <strong>Publish Preflight Next Actions</strong>
      <ul>
        {dedupedItems.map((item) => (
          <li key={item.reason}>
            <strong>{item.label}</strong>: {item.action} <span className="muted">({item.reason})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PublishApprovalPreviewActionItems({ result }: { result: PublishApprovalPreview }) {
  const items = result.blockingReasons.map((reason) => getPublishApprovalPreviewActionItem(reason));
  const dedupedItems = items.filter((item, index) => items.findIndex((candidate) => candidate.action === item.action && candidate.label === item.label) === index);

  return (
    <div className="notice warning">
      <strong>Publish Approval Preview Next Actions</strong>
      <ul>
        {dedupedItems.map((item) => (
          <li key={item.reason}>
            <strong>{item.label}</strong>: {item.action} <span className="muted">({item.reason})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PublishApprovalPersistencePolicyNotice() {
  return (
    <div className="notice warning">
      <strong>Publish Approval Persistence Policy</strong>
      <p>
        Publish approval snapshot은 acknowledgement 후 local DB에 저장할 수 있습니다. 이 저장은 publish 실행이 아니며 Blogger API write를 수행하지 않습니다.
      </p>
      <p>
        향후 publish approval은 immutable snapshot으로 저장되어야 하며, 저장된 approval이 있어도 publish 실행은 별도 preflight와 사용자 명시 승인 후에만 허용됩니다.
      </p>
      <div className="detail-grid">
        <DetailItem label="Approval Persistence" value="implemented: local DB snapshot only" />
        <DetailItem label="Schema / Migration" value="implemented for blogger_publish_approvals" />
        <DetailItem label="Snapshot Hash" value="stored only after explicit save" />
        <DetailItem label="Invalidation Policy" value="planning only" />
        <DetailItem label="Rollback Acknowledgement" value="required before persistence" />
        <DetailItem label="Side-effect Acknowledgement" value="required before persistence" />
        <DetailItem label="Publish Execution" value="separate future step" />
        <DetailItem label="DB Write" value="approval table only after explicit save" />
      </div>
      <ValidationList
        title="Publish Approval Persistence Design Gates"
        items={[
          "Dedicated publish approval table implemented for snapshot storage",
          "Server regenerated snapshot hash must match client preview hash",
          "Immutable approval snapshot with created/invalidated lifecycle",
          "Rollback acknowledgement capture before approval creation",
          "Side-effect summary acknowledgement capture before approval creation",
          "Approval persistence acknowledgement capture before approval creation",
          "Token state checkedAt persisted without token values",
          "Publish execution attempt audit model remains future work",
          "Partial failure handling policy for real publish remains future work"
        ]}
        emptyText="policy gate가 없습니다."
      />
      <ValidationList
        title="Approval Invalidation Triggers"
        items={[
          "draftHtml hash changes",
          "draftMarkdown hash changes",
          "title candidate changes",
          "target Blogger blog changes",
          "Blogger draft post id changes",
          "Blogger draft is changed by a future posts.update flow",
          "scheduledAt or timezone changes",
          "content status changes",
          "token state becomes expired before publish",
          "newer approval supersedes the current approval"
        ]}
        emptyText="invalidation trigger가 없습니다."
      />
      <ValidationList
        title="Required Manual Acknowledgements"
        items={[
          "Blogger publish changes external service state and rollback is not automatic",
          "Content item status/timestamp mutation policy is separate and not implemented",
          "Publish side-effect summary must be acknowledged before approval persistence",
          "Snapshot hash, blog id, post id, and draft hashes must be reviewed before approval",
          "Token state must be checked again before any future publish write"
        ]}
        emptyText="acknowledgement가 없습니다."
      />
    </div>
  );
}

function BloggerDraftUpdateRetryPolicyNotice() {
  return (
    <div className="notice">
      <strong>Blogger Draft Update / Retry Policy</strong>
      <p>
        이 Blogger draft는 이미 저장되었습니다. 같은 approval snapshot으로는 duplicate protection이 동작하므로 다시 저장하지 않습니다.
      </p>
      <p>
        저장된 Blogger draft를 수정하려면 posts.update, 새 approval, 새 draft save 중 어떤 정책을 사용할지 별도 승인된 설계가 필요합니다. posts.update와 retry 실행은
        아직 구현되지 않았습니다.
      </p>
      <p>
        Retry는 네트워크 오류처럼 Blogger에 draft가 생성되었는지 확인되지 않는 제한된 실패에서만 검토할 수 있습니다. 이미 성공한 approval, content hash 변경,
        approval snapshot 변경, token 만료, publish 단계에서는 retry하지 않습니다.
      </p>
      <p>
        Blogger posts.update는 외부 Blogger draft를 직접 수정하는 작업이며, 로컬 Git/DB처럼 쉽게 rollback된다고 가정하면 안 됩니다. 향후 update/retry 작업은 별도
        preflight, side-effect summary, 사용자 승인, OAuth 재연결 상태 확인이 필요합니다.
      </p>
    </div>
  );
}

function PublishScheduledPublishPolicyNotice() {
  return (
    <div className="notice warning">
      <strong>Publish / Scheduled Publish Policy</strong>
      <p>
        Blogger draft는 저장되었지만 아직 publish-ready 상태는 아닙니다. Publish Readiness의 publishReady=false와 top-level ready=false는 의도적으로 유지됩니다.
      </p>
      <p>
        publish와 scheduled publish는 외부 Blogger 상태와 로컬 content status/publishedAt/scheduledAt를 바꿀 수 있는 단계이므로, 별도 승인된 preflight와 사용자 확인
        없이는 실행하지 않습니다.
      </p>
      <p>
        발행 전에는 OAuth 재연결 또는 유효한 token 상태, publish 전용 manual approval, side-effect summary, rollback 안내가 필요합니다. token 만료 상태에서는
        publish/scheduled publish보다 OAuth 재연결이 우선입니다.
      </p>
      <p>
        posts.update/retry 정책과 publish 정책은 분리합니다. 이번 패치에서는 content_items.status, publishedAt, scheduledAt, qualityScore, draftHtml을 변경하지
        않습니다.
      </p>
    </div>
  );
}

function getBloggerDraftSaveActionItem(reason: string) {
  if (reason === "blogger_connection_not_configured" || reason === "blogger_connection") {
    return {
      reason,
      label: "Blogger connection",
      action: "설정 > Blogger에서 OAuth 연결을 먼저 완료하세요."
    };
  }
  if (reason === "blogger_connection_not_connected") {
    return {
      reason,
      label: "Blogger connection status",
      action: "Blogger connection 상태를 확인하고 필요하면 다시 연결하세요."
    };
  }
  if (reason === "blogger_client_secret_missing") {
    return {
      reason,
      label: "Blogger client secret",
      action: "Blogger 설정의 clientSecretRef가 서버 env에서 해석 가능한지 확인하세요. secret 값은 화면에 표시하지 않습니다."
    };
  }
  if (reason === "blogger_access_token_missing") {
    return {
      reason,
      label: "Blogger access token",
      action: "Blogger OAuth 연결을 다시 실행해 access token을 저장하세요."
    };
  }
  if (reason === "access_token_expired_reauth_required") {
    return {
      reason,
      label: "Blogger OAuth 재연결 필요",
      action: "Access token이 만료되었습니다. 이미 저장된 draft는 유지되며, 다음 Blogger write 전 설정 > Blogger에서 OAuth 재연결을 확인하세요. 자동 token refresh는 아직 구현하지 않습니다."
    };
  }
  if (reason === "blogger_blog_selection" || reason === "blogger_blog_not_verified") {
    return {
      reason,
      label: "Blogger blog selection",
      action: "연결 후 대상 Blogger blog를 선택하세요."
    };
  }
  if (reason === "manual_approval" || reason === "blogger_draft_approval_required") {
    return {
      reason,
      label: "Manual approval",
      action: "Blogger Draft Payload Preview를 확인하고 수동 approval snapshot을 생성하세요."
    };
  }
  if (reason === "blogger_draft_approval_stale") {
    return {
      reason,
      label: "Stale approval",
      action: "draftHtml 또는 target blog가 바뀌었습니다. Draft Payload Preview를 다시 실행하고 재승인하세요."
    };
  }
  if (reason === "draft_payload_not_ready") {
    return {
      reason,
      label: "Draft payload preview",
      action: "Draft Payload Preview를 다시 실행하고 blocking issue를 해결하세요."
    };
  }
  if (reason === "blogger_draft_already_saved_for_approval") {
    return {
      reason,
      label: "Duplicate draft save",
      action: "현재 approval snapshot으로 이미 성공한 Blogger draft가 있어 중복 저장을 막았습니다."
    };
  }
  if (reason === "blogger_draft_saved") {
    return {
      reason,
      label: "Publish readiness draft saved check",
      action: "draft save 전에는 정상적으로 미완료일 수 있습니다. draft-save preflight blocker로 표시되면 분류를 확인하세요."
    };
  }
  if (reason === "draft_html_missing" || reason === "draft_html_validation_failed") {
    return {
      reason,
      label: "Saved draftHtml",
      action: "HTML 후보를 검증하고 draftHtml에 수동 반영한 뒤 preflight를 다시 실행하세요."
    };
  }
  if (reason === "content_readiness_not_passed") {
    return {
      reason,
      label: "Content readiness",
      action: "Quality Dry Run과 Publish Readiness 결과의 required fail을 해결하세요."
    };
  }
  return {
    reason,
    label: "Readiness check",
    action: "관련 readiness 결과를 확인하고 blocking issue를 해결하세요."
  };
}

function getPublishPreflightActionItem(reason: string) {
  if (reason === "publish_not_implemented") {
    return {
      reason,
      label: "Publish implementation",
      action: "Blogger publish 실행 route와 사용자 승인 flow는 아직 구현하지 않습니다. 별도 승인된 패치에서만 추가하세요."
    };
  }
  if (reason === "scheduled_publish_not_implemented") {
    return {
      reason,
      label: "Scheduled publish implementation",
      action: "예약 발행은 timezone, scheduledAt, cancel/update 정책을 먼저 승인한 뒤 별도 패치에서 설계하세요."
    };
  }
  if (reason === "access_token_expired_reauth_required") {
    return {
      reason,
      label: "Blogger OAuth 재연결 필요",
      action: "Access token이 만료되었습니다. 향후 Blogger write 전 설정 > Blogger에서 OAuth 재연결을 확인하세요. 이 dry-run은 token refresh를 수행하지 않습니다."
    };
  }
  if (reason === "publish_approval_not_implemented") {
    return {
      reason,
      label: "Publish approval",
      action: "발행 전용 approval snapshot, rollback acknowledgement, side-effect summary acknowledgement 모델을 먼저 구현해야 합니다."
    };
  }
  if (reason === "content_item_mutation_policy_not_implemented") {
    return {
      reason,
      label: "Local mutation policy",
      action: "publish 성공 후 content_items.status/publishedAt 또는 scheduledAt을 언제 바꿀지 별도 정책 승인이 필요합니다."
    };
  }
  if (reason === "blogger_draft_not_saved") {
    return {
      reason,
      label: "Blogger draft",
      action: "publish 전에는 guarded Blogger draft save 성공 기록과 Blogger post id가 필요합니다."
    };
  }
  if (reason === "blogger_draft_post_id_missing") {
    return {
      reason,
      label: "Blogger post id",
      action: "저장된 Blogger draft의 post id safe metadata가 있어야 publish target을 특정할 수 있습니다."
    };
  }
  if (reason === "blogger_blog_id_missing") {
    return {
      reason,
      label: "Blogger blog id",
      action: "검증된 target Blogger blog id가 필요합니다."
    };
  }
  if (reason === "manual_approval_missing") {
    return {
      reason,
      label: "Manual approval",
      action: "현재 draft payload preview와 일치하는 manual approval snapshot이 필요합니다."
    };
  }
  if (reason === "approval_snapshot_mismatch") {
    return {
      reason,
      label: "Approval snapshot",
      action: "draftHtml, title, target blog가 바뀌었을 수 있습니다. draft payload preview와 approval을 다시 생성하세요."
    };
  }
  return {
    reason,
    label: "Publish preflight",
    action: "관련 publish preflight blocker를 확인하고 후속 설계 패치에서 해결하세요."
  };
}

function getPublishApprovalPreviewActionItem(reason: string) {
  if (reason === "explicit_publish_approval_save_required") {
    return {
      reason,
      label: "Publish approval save",
      action: "세 가지 acknowledgement를 확인한 뒤 Save Publish Approval Snapshot 버튼으로 local DB에 snapshot을 저장하세요."
    };
  }
  if (reason === "publish_not_implemented") {
    return {
      reason,
      label: "Publish implementation",
      action: "Blogger publish 실행 route와 사용자 승인 flow는 후속 패치에서 별도 승인 후 구현합니다."
    };
  }
  if (reason === "scheduled_publish_not_implemented") {
    return {
      reason,
      label: "Scheduled publish implementation",
      action: "예약 발행은 scheduledAt/timezone/cancel-update 정책과 별도 approval 모델을 먼저 설계해야 합니다."
    };
  }
  if (reason === "access_token_expired_reauth_required") {
    return {
      reason,
      label: "Blogger OAuth 재연결 필요",
      action: "Access token이 만료되었습니다. 향후 Blogger write 전 설정 > Blogger에서 OAuth 재연결을 확인하세요. 이 preview는 token refresh를 수행하지 않습니다."
    };
  }
  if (reason === "rollback_acknowledgement_required") {
    return {
      reason,
      label: "Rollback acknowledgement",
      action: "Publish는 외부 Blogger 상태를 바꾸므로 rollback 제한 안내를 확인해야 approval snapshot을 저장할 수 있습니다."
    };
  }
  if (reason === "side_effect_summary_acknowledgement_required") {
    return {
      reason,
      label: "Side-effect acknowledgement",
      action: "이번 저장은 approval table insert만 수행하며, 실제 publish side effect는 future patch에서 별도 확인이 필요함을 acknowledge하세요."
    };
  }
  if (reason === "approval_persistence_acknowledgement_required") {
    return {
      reason,
      label: "Approval persistence acknowledgement",
      action: "저장된 approval이 publish 실행이나 publish-ready 상태를 의미하지 않는다는 점을 acknowledge하세요."
    };
  }
  if (reason === "blogger_draft_not_saved") {
    return {
      reason,
      label: "Blogger draft",
      action: "publish approval 전에는 guarded Blogger draft save 성공 기록이 필요합니다."
    };
  }
  if (reason === "blogger_draft_post_id_missing") {
    return {
      reason,
      label: "Blogger post id",
      action: "저장된 Blogger draft의 post id safe metadata가 있어야 publish approval target을 특정할 수 있습니다."
    };
  }
  if (reason === "blogger_blog_id_missing") {
    return {
      reason,
      label: "Blogger blog id",
      action: "검증된 target Blogger blog id가 필요합니다."
    };
  }
  if (reason === "manual_approval_missing") {
    return {
      reason,
      label: "Draft approval",
      action: "현재 draft payload와 일치하는 Blogger draft approval이 필요합니다."
    };
  }
  if (reason === "approval_snapshot_mismatch") {
    return {
      reason,
      label: "Snapshot mismatch",
      action: "draftHtml/title/target blog 변경 가능성이 있으므로 draft payload preview와 approval을 다시 확인하세요."
    };
  }
  if (reason === "scheduled_at_required_for_scheduled_publish") {
    return {
      reason,
      label: "Scheduled time",
      action: "예약 발행 snapshot에는 미래 scheduledAt 값이 필요합니다."
    };
  }
  if (reason === "timezone_required_for_scheduled_publish") {
    return {
      reason,
      label: "Timezone",
      action: "예약 발행 snapshot에는 명시적인 timezone이 필요합니다."
    };
  }
  return {
    reason,
    label: "Publish approval preview",
    action: "관련 preview blocker를 확인하세요. 저장된 approval이 있어도 publish 실행은 후속 패치에서만 가능합니다."
  };
}

function buildBloggerDraftSaveErrorMessage(message: string, draftSave: BloggerDraftSaveAdmin | null) {
  if (message === "blogger_draft_already_saved_for_approval") {
    return "이 approval snapshot은 이미 Blogger draft로 저장되었습니다.";
  }
  if (draftSave?.status === "failed") {
    return draftSave.retryable
      ? `${message} 일시적 실패일 수 있습니다. 같은 approval snapshot으로 재시도할 수 있습니다.`
      : `${message} OAuth 재연결 또는 Blogger blog selection 재확인이 필요합니다.`;
  }
  if (
    message === "blogger_api_request_failed" ||
    message === "blogger_api_response_missing_post_id"
  ) {
    return `${message} 일시적 실패일 수 있습니다. 같은 approval snapshot으로 재시도할 수 있습니다.`;
  }
  if (
    message === "access_token_missing" ||
    message === "access_token_expired" ||
    message === "blogger_token_expired_or_rejected" ||
    message === "blogger_api_forbidden"
  ) {
    return `${message} OAuth 재연결 또는 Blogger blog selection 재확인이 필요합니다.`;
  }
  return message;
}

function PublishReadinessTable({ checks }: { checks: PublishReadinessResult["checks"] }) {
  return (
    <div className="read-block">
      <h3>Readiness Checks</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Check</th>
              <th>Status</th>
              <th>Severity</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => (
              <tr key={check.key}>
                <td>{check.label}</td>
                <td>{check.status}</td>
                <td>{check.severity}</td>
                <td>{check.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MediaMappingTable({ mappings }: { mappings: DraftMarkdownDryRunResult["mediaMapping"] }) {
  return (
    <div className="read-block">
      <h3>Media Mapping Preview</h3>
      {mappings.length === 0 ? (
        <div className="notice">첨부 미디어가 없어 media placeholder preview가 없습니다.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Type</th>
                <th>Placement</th>
                <th>Matched mediaPlan</th>
                <th>Caption</th>
                <th>Placeholder</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping) => (
                <tr key={mapping.assetId}>
                  <td>{mapping.originalName}</td>
                  <td>{mapping.assetType}</td>
                  <td>
                    {mapping.placementHint} / order {mapping.sortOrder} / primary {mapping.isPrimary ? "yes" : "no"}
                  </td>
                  <td>{mapping.matchedMediaPlan ? "yes" : "no"}</td>
                  <td>{mapping.caption || "-"}</td>
                  <td>
                    <code>{mapping.placeholder}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatProviderName(provider: LlmTaskRouteAdmin["primaryProvider"] | LlmTaskRouteAdmin["fallbackProvider"] | undefined) {
  if (!provider) {
    return "-";
  }
  return provider.name;
}

function formatModelName(model: LlmTaskRouteAdmin["primaryModel"] | LlmTaskRouteAdmin["fallbackModel"] | undefined) {
  if (!model) {
    return "-";
  }
  return model.displayName ?? model.name;
}

function formatReadinessStatus(status: ReadinessStatus) {
  if (status === "pass") {
    return "pass";
  }
  if (status === "warn") {
    return "warning";
  }
  return "fail";
}

function getBloggerDraftApprovalNoticeClass(status: BloggerDraftPayloadPreview["approvalSummary"]["approvalStatus"]) {
  if (status === "approved") {
    return "notice";
  }
  if (status === "missing" || status === "stale") {
    return "notice warning";
  }
  return "notice error";
}

function AssetPreview({ asset }: { asset: ContentAssetAdmin }) {
  const src = `/api/content-assets/${asset.id}/file`;

  if (asset.assetType === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="asset-preview" src={src} alt={asset.altText || asset.caption || asset.originalName} />;
  }

  return <video className="asset-preview" src={src} controls />;
}

function parsePlan(value: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "planJson은 JSON object여야 합니다." };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? `유효하지 않은 JSON입니다: ${error.message}` : "유효하지 않은 JSON입니다." };
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatNullableBoolean(value: boolean | null) {
  if (value === null) {
    return "not checked";
  }
  return value ? "true" : "false";
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)}KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

function formatMs(value: number) {
  if (!value) {
    return "-";
  }
  if (value < 1000) {
    return `${value}ms`;
  }
  return `${Math.round(value / 1000)}s`;
}
