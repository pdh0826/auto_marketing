import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { buildDraftMarkdownDryRun, type DraftPromptPreview } from "@/lib/content/draft-preview";
import { validateDraftMarkdown } from "@/lib/content/draft-validation";
import { validatePlanJson } from "@/lib/content/plan-validation";
import { buildSeoSectionPromptContract, SEO_ARTICLE_TEMPLATE_V1, type SeoArticleSectionKey } from "@/lib/content/seo-article-template";
import { createLlmCallLog } from "@/lib/db/llm-call-logs";
import { prisma } from "@/lib/db/client";
import {
  DEFAULT_LOCAL_SECTIONED_STEPWISE_SECTION_KEYS,
  DEFAULT_LOCAL_SECTIONED_STEPWISE_STEP_KEYS,
  LOCAL_SECTIONED_STEPWISE_STRATEGY,
  completeContentDraftGenerationRun,
  failContentDraftGenerationRun,
  getContentDraftGenerationRunForContentItem,
  markContentDraftGenerationStepFailed,
  markContentDraftGenerationStepPendingRetry,
  markContentDraftGenerationStepRunning,
  markContentDraftGenerationStepSuccess,
  saveAssembledContentDraftGenerationRun,
  toContentDraftGenerationRunDetail,
  toContentDraftGenerationStepSummary,
  updateContentDraftGenerationRunProgress,
  type SafeContentDraftGenerationRunWithSteps,
  type SafeContentDraftGenerationStep
} from "@/lib/db/content-draft-generation-runs";
import { scrubLocalSectionedDraftSafetyPhrases } from "@/lib/llm/local-sectioned-draft-generation";
import type { LlmTaskRouteAdmin } from "@/lib/llm/admin-types";
import { isLocalLikeDraftProvider } from "@/lib/llm/draft-generation-strategy";
import { getOpenAiCompletionTokenParameter } from "@/lib/llm/provider-test";
import { redactSensitiveText, safeErrorMessage } from "@/lib/llm/redaction";
import { decryptSecret } from "@/lib/llm/secrets";

const STEPWISE_STEP_TIMEOUT_SECONDS = 600;
const STEPWISE_OLLAMA_FIRST_BYTE_TIMEOUT_SECONDS = 180;
const STEPWISE_OLLAMA_IDLE_TIMEOUT_SECONDS = 120;
const STEPWISE_OLLAMA_KEEP_ALIVE = "30s";
const STEPWISE_OLLAMA_PREFLIGHT_TIMEOUT_SECONDS = 10;
const SKELETON_MAX_TOKENS = 360;
const SECTION_MAX_TOKENS = 900;
const FINAL_POLISH_MAX_TOKENS = 1400;
const SKELETON_NUM_CTX = 2048;
const SECTION_NUM_CTX = 4096;
const FINAL_POLISH_NUM_CTX = 8192;

export interface ExecuteStepwiseDraftGenerationStepInput {
  contentItemId: string;
  runId: string;
  stepKey: string;
  retry?: boolean;
}

export interface AssembleStepwiseDraftGenerationRunInput {
  contentItemId: string;
  runId: string;
  force?: boolean;
}

export interface FinalPolishStepwiseDraftGenerationRunInput {
  contentItemId: string;
  runId: string;
  force?: boolean;
}

export class StepwiseDraftGenerationError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

interface ProviderCallResult {
  text: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  responseSummary: string;
  requestOptionsSummary: StepwiseRequestOptionsSummary;
}

interface StepwiseRequestOptionsSummary {
  apiFormat: string;
  stream: boolean;
  timeoutSeconds: number;
  firstByteTimeoutSeconds: number | null;
  idleTimeoutSeconds: number | null;
  numPredict: number | null;
  numCtx: number | null;
  keepAlive: string | null;
  inputLength: number;
}

class ProviderCallError extends Error {
  responseSummary: string;
  latencyMs: number;
  requestOptionsSummary: StepwiseRequestOptionsSummary | null;

  constructor(message: string, responseSummary: string, latencyMs: number, requestOptionsSummary: StepwiseRequestOptionsSummary | null = null) {
    super(message);
    this.responseSummary = responseSummary;
    this.latencyMs = latencyMs;
    this.requestOptionsSummary = requestOptionsSummary;
  }
}

type ProviderWithSecrets = NonNullable<Awaited<ReturnType<typeof prisma.llmProvider.findUnique>>> & {
  secrets: Array<{ secretKind: string; encryptedValue: string }>;
};

type StepwiseContentItem = NonNullable<Awaited<ReturnType<typeof loadStepwiseContentItem>>>;
type StepwiseTaskRoute = NonNullable<Awaited<ReturnType<typeof loadContentDraftRoute>>>;

export async function assembleStepwiseDraftGenerationRun(input: AssembleStepwiseDraftGenerationRunInput) {
  const run = await getContentDraftGenerationRunForContentItem(input.contentItemId, input.runId);
  if (!run) {
    throw new StepwiseDraftGenerationError("draft_generation_run_not_found", "Draft generation run not found.", 404);
  }
  assertLocalStepwiseRun(run);
  if (run.status === "cancelled") {
    throw new StepwiseDraftGenerationError("run_not_executable", "Cancelled runs cannot be assembled.", 409);
  }
  if (run.status === "completed" && input.force) {
    throw new StepwiseDraftGenerationError("completed_run_not_force_assembled", "Completed runs cannot be force-assembled.", 409);
  }
  if (run.assembledCandidateMarkdown && !input.force) {
    return {
      run: toContentDraftGenerationRunDetail(run),
      assembledCandidateMarkdown: run.assembledCandidateMarkdown,
      validationSummary: run.validationSummary,
      executed: false,
      reusedExistingAssembled: true
    };
  }

  const contentItem = await loadStepwiseContentItem(input.contentItemId);
  if (!contentItem) {
    throw new StepwiseDraftGenerationError("content_item_not_found", "Content item not found.", 404);
  }

  const planJson = requirePlanJson(contentItem);
  const sectionOutputs = getRequiredSectionOutputs(run);
  const contentItemForValidation = contentItem as unknown as ContentItemAdmin;
  const assembled = buildAssembledCandidateMarkdown({
    title: getDraftTitle(contentItemForValidation, planJson),
    sections: sectionOutputs
  });
  const guarded = applyDeterministicCandidateGuards(assembled, planJson);
  const validationSummary = buildCandidateValidationSummary({
    phase: "assemble",
    markdown: guarded.markdown,
    contentItem: contentItemForValidation,
    assets: contentItem.assets as unknown as ContentAssetAdmin[],
    sectionKeys: sectionOutputs.map((section) => section.key),
    guardSummary: guarded.summary
  });

  const saved = await saveAssembledContentDraftGenerationRun({
    runId: run.id,
    assembledCandidateMarkdown: guarded.markdown,
    validationSummary,
    metadata: {
      lastAction: "deterministic_assemble",
      stepExecutionImplemented: true,
      assemblyImplemented: true,
      finalPolishImplemented: false,
      contentItemAutoApply: false,
      bloggerApiImplemented: false,
      assembledLength: guarded.markdown.length,
      sectionKeys: sectionOutputs.map((section) => section.key),
      validationOk: validationSummary.ok,
      warningCount: validationSummary.warningCount,
      errorCount: validationSummary.errorCount,
      guardSummary: guarded.summary
    }
  });
  const detailedRun = await getContentDraftGenerationRunForContentItem(saved.contentItemId, saved.id);

  return {
    run: detailedRun ? toContentDraftGenerationRunDetail(detailedRun) : toContentDraftGenerationRunDetail(run),
    assembledCandidateMarkdown: guarded.markdown,
    validationSummary,
    executed: true,
    reusedExistingAssembled: false
  };
}

export async function finalPolishStepwiseDraftGenerationRun(input: FinalPolishStepwiseDraftGenerationRunInput) {
  const run = await getContentDraftGenerationRunForContentItem(input.contentItemId, input.runId);
  if (!run) {
    throw new StepwiseDraftGenerationError("draft_generation_run_not_found", "Draft generation run not found.", 404);
  }
  assertLocalStepwiseRun(run);
  if (run.status === "cancelled") {
    throw new StepwiseDraftGenerationError("run_not_executable", "Cancelled runs cannot run final polish.", 409);
  }
  if (!run.assembledCandidateMarkdown?.trim()) {
    throw new StepwiseDraftGenerationError("assembled_candidate_required", "Assembled candidate Markdown is required before final polish.", 409);
  }
  if (run.finalCandidateMarkdown && !input.force) {
    return {
      run: toContentDraftGenerationRunDetail(run),
      finalCandidateMarkdown: run.finalCandidateMarkdown,
      validationSummary: run.validationSummary,
      executed: false,
      reusedExistingFinal: true
    };
  }

  const contentItem = await loadStepwiseContentItem(input.contentItemId);
  if (!contentItem) {
    throw new StepwiseDraftGenerationError("content_item_not_found", "Content item not found.", 404);
  }
  const route = await loadContentDraftRoute();
  assertContentDraftRouteReady(route);

  const provider = route.primaryProvider;
  const model = route.primaryModel;
  if (!isLocalLikeDraftProvider(provider)) {
    throw new StepwiseDraftGenerationError("local_stepwise_route_required", "Stepwise final polish requires a local/Ollama/local_http content_draft route.", 409);
  }

  const contentItemForValidation = contentItem as unknown as ContentItemAdmin;
  const assets = contentItem.assets as unknown as ContentAssetAdmin[];
  const planJson = requirePlanJson(contentItem);
  const planValidation = validatePlanJson(planJson, contentItemForValidation);
  if (!planValidation.ok) {
    throw new StepwiseDraftGenerationError("plan_json_validation_failed", "Saved planJson did not pass validation.", 400);
  }
  const dryRun = buildDraftMarkdownDryRun(contentItemForValidation, assets, route as unknown as LlmTaskRouteAdmin);
  if (!dryRun.ready) {
    throw new StepwiseDraftGenerationError("content_draft_not_ready", "content_draft readiness checks did not pass.", 409);
  }

  await updateContentDraftGenerationRunProgress({
    runId: run.id,
    status: "running",
    currentStepKey: "final_polish",
    metadata: {
      lastStartedStepKey: "final_polish",
      stepExecutionImplemented: true,
      assemblyImplemented: true,
      finalPolishImplemented: true,
      contentItemAutoApply: false,
      bloggerApiImplemented: false
    }
  });

  const prompt = buildStepwiseFinalPolishPrompt({
    contentItem: contentItemForValidation,
    planJson,
    mediaMapping: dryRun.mediaMapping,
    assembledCandidateMarkdown: run.assembledCandidateMarkdown
  });
  const promptHash = hashText(`${prompt.system}\n${prompt.user}\n${prompt.outputFormat}`);

  try {
    const result = await callProvider(
      provider,
      model.name,
      prompt,
      route.temperature,
      getMaxTokensForStep("final_polish", route.maxTokens),
      STEPWISE_STEP_TIMEOUT_SECONDS,
      "final_polish"
    );
    const normalizedFinal = normalizeFinalCandidateMarkdown(result.text, getDraftTitle(contentItemForValidation, planJson));
    const guarded = applyDeterministicCandidateGuards(normalizedFinal, planJson);
    const responseHash = hashText(guarded.markdown);
    const validationSummary = buildCandidateValidationSummary({
      phase: "final_polish",
      markdown: guarded.markdown,
      contentItem: contentItemForValidation,
      assets,
      sectionKeys: getRequiredSectionOutputs(run).map((section) => section.key),
      guardSummary: guarded.summary
    });

    await recordStepwiseDraftLog({
      contentItemId: input.contentItemId,
      providerId: provider.id,
      modelId: model.id,
      status: "success",
      latencyMs: result.latencyMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      errorMessage: null,
      metadata: {
        responseSummary: result.responseSummary,
        runId: run.id,
        stepKey: "final_polish",
        sectionKey: null,
        attempt: input.force ? 2 : 1,
        promptHash,
        responseHash,
        outputLength: guarded.markdown.length,
        outputSummaryLength: summarizeStepOutput("final_polish", guarded.markdown).length,
        requestOptionsSummary: result.requestOptionsSummary,
        provider,
        modelName: model.displayName ?? model.name
      }
    });

    const saved = await completeContentDraftGenerationRun({
      runId: run.id,
      assembledCandidateMarkdown: run.assembledCandidateMarkdown,
      finalCandidateMarkdown: guarded.markdown,
      validationSummary,
      metadata: {
        lastSuccessfulStepKey: "final_polish",
        lastStepLatencyMs: result.latencyMs,
        stepExecutionImplemented: true,
        assemblyImplemented: true,
        finalPolishImplemented: true,
        contentItemAutoApply: false,
        bloggerApiImplemented: false,
        promptHash,
        responseHash,
        finalCandidateLength: guarded.markdown.length,
        validationOk: validationSummary.ok,
        warningCount: validationSummary.warningCount,
        errorCount: validationSummary.errorCount,
        guardSummary: guarded.summary
      }
    });
    const detailedRun = await getContentDraftGenerationRunForContentItem(saved.contentItemId, saved.id);

    return {
      run: detailedRun ? toContentDraftGenerationRunDetail(detailedRun) : toContentDraftGenerationRunDetail(run),
      finalCandidateMarkdown: guarded.markdown,
      validationSummary,
      executed: true,
      reusedExistingFinal: false
    };
  } catch (error) {
    const providerError = error instanceof ProviderCallError ? error : null;
    const failureCode = providerError?.responseSummary ?? "final_polish_provider_call_failed";
    const validationSummary = {
      phase: "final_polish",
      ok: false,
      errorCode: failureCode,
      fallbackCandidateAvailable: true,
      assembledCandidateAvailable: true
    } satisfies Prisma.InputJsonObject;

    await failContentDraftGenerationRun({
      runId: run.id,
      currentStepKey: "final_polish",
      validationSummary,
      metadata: {
        lastFailedStepKey: "final_polish",
        lastFailureCode: failureCode,
        stepExecutionImplemented: true,
        assemblyImplemented: true,
        finalPolishImplemented: true,
        contentItemAutoApply: false,
        bloggerApiImplemented: false,
        requestOptionsSummary: toRequestOptionsJson(providerError?.requestOptionsSummary ?? null),
        promptHash,
        fallbackCandidateAvailable: true
      }
    });
    await recordStepwiseDraftLog({
      contentItemId: input.contentItemId,
      providerId: provider.id,
      modelId: model.id,
      status: "failed",
      latencyMs: providerError?.latencyMs ?? null,
      inputTokens: null,
      outputTokens: null,
      errorMessage: error instanceof Error ? error.message : "final polish provider call failed",
      metadata: {
        responseSummary: failureCode,
        runId: run.id,
        stepKey: "final_polish",
        sectionKey: null,
        attempt: input.force ? 2 : 1,
        promptHash,
        responseHash: null,
        outputLength: 0,
        outputSummaryLength: 0,
        requestOptionsSummary: providerError?.requestOptionsSummary ?? null,
        provider,
        modelName: model.displayName ?? model.name
      }
    });

    throw new StepwiseDraftGenerationError(failureCode, safeErrorMessage(error instanceof Error ? error.message : "Final polish failed.", 240), 400);
  }
}

export async function executeStepwiseDraftGenerationStep(input: ExecuteStepwiseDraftGenerationStepInput) {
  if (!isAllowedStepKey(input.stepKey)) {
    throw new StepwiseDraftGenerationError("invalid_step_key", "This stepKey is not supported for stepwise draft generation.", 400);
  }

  const run = await getContentDraftGenerationRunForContentItem(input.contentItemId, input.runId);
  if (!run) {
    throw new StepwiseDraftGenerationError("draft_generation_run_not_found", "Draft generation run not found.", 404);
  }

  assertRunExecutable(run);
  const existingStep = getStepFromRun(run, input.stepKey);

  if (existingStep.status === "running") {
    throw new StepwiseDraftGenerationError("step_already_running", "This draft generation step is already running.", 409);
  }

  if (existingStep.status === "success" && !input.retry) {
    return {
      run: toContentDraftGenerationRunDetail(run),
      step: toContentDraftGenerationStepSummary(existingStep),
      executed: false,
      reusedExistingSuccess: true
    };
  }

  if (input.stepKey !== "skeleton") {
    const skeletonStep = getStepFromRun(run, "skeleton");
    if (skeletonStep.status !== "success" || !skeletonStep.outputMarkdown) {
      throw new StepwiseDraftGenerationError("skeleton_required", "Skeleton step must succeed before running section steps.", 409);
    }
  }

  const contentItem = await loadStepwiseContentItem(input.contentItemId);
  if (!contentItem) {
    throw new StepwiseDraftGenerationError("content_item_not_found", "Content item not found.", 404);
  }
  const route = await loadContentDraftRoute();
  assertContentDraftRouteReady(route);

  const provider = route.primaryProvider;
  const model = route.primaryModel;
  if (!isLocalLikeDraftProvider(provider)) {
    throw new StepwiseDraftGenerationError("local_stepwise_route_required", "Stepwise draft generation requires a local/Ollama/local_http content_draft route.", 409);
  }

  const contentItemForValidation = contentItem as unknown as ContentItemAdmin;
  const assets = contentItem.assets as unknown as ContentAssetAdmin[];
  const planJson = requirePlanJson(contentItem);
  const planValidation = validatePlanJson(planJson, contentItemForValidation);
  if (!planValidation.ok) {
    throw new StepwiseDraftGenerationError("plan_json_validation_failed", "Saved planJson did not pass validation.", 400);
  }
  const dryRun = buildDraftMarkdownDryRun(contentItemForValidation, assets, route as unknown as LlmTaskRouteAdmin);
  if (!dryRun.ready) {
    throw new StepwiseDraftGenerationError("content_draft_not_ready", "content_draft readiness checks did not pass.", 409);
  }

  const attempt = existingStep.status === "failed" || input.retry ? existingStep.attempt + 1 : existingStep.attempt;
  if (existingStep.status === "failed" || input.retry) {
    await markContentDraftGenerationStepPendingRetry({
      stepId: existingStep.id,
      attempt,
      metadata: {
        retryRequested: Boolean(input.retry),
        previousStatus: existingStep.status
      }
    });
  }

  const runningStep = await markContentDraftGenerationStepRunning({
    stepId: existingStep.id,
    attempt,
    metadata: {
      runId: run.id,
      stepKey: input.stepKey,
      sectionKey: getSectionKey(input.stepKey),
      strategy: LOCAL_SECTIONED_STEPWISE_STRATEGY,
      timeoutSeconds: STEPWISE_STEP_TIMEOUT_SECONDS
    }
  });
  await updateContentDraftGenerationRunProgress({
    runId: run.id,
    status: "running",
    currentStepKey: input.stepKey,
    metadata: {
      lastStartedStepKey: input.stepKey,
      lastStartedAttempt: attempt,
      stepExecutionImplemented: true,
      assemblyImplemented: false,
      finalPolishImplemented: false,
      contentItemAutoApply: false
    }
  });

  const prompt = buildStepPrompt({
    stepKey: input.stepKey,
    run,
    contentItem: contentItemForValidation,
    planJson,
    mediaMapping: dryRun.mediaMapping
  });
  const promptHash = hashText(`${prompt.system}\n${prompt.user}\n${prompt.outputFormat}`);

  try {
    const result = await callProvider(
      provider,
      model.name,
      prompt,
      route.temperature,
      getMaxTokensForStep(input.stepKey, route.maxTokens),
      STEPWISE_STEP_TIMEOUT_SECONDS,
      input.stepKey
    );
    const normalizedOutput = normalizeStepOutput(input.stepKey, result.text);
    const outputSummary = summarizeStepOutput(input.stepKey, normalizedOutput);
    const responseHash = hashText(normalizedOutput);
    const successStep = await markContentDraftGenerationStepSuccess({
      stepId: runningStep.id,
      outputMarkdown: normalizedOutput,
      outputSummary,
      promptHash,
      responseHash,
      latencyMs: result.latencyMs,
      metadata: {
        runId: run.id,
        stepKey: input.stepKey,
        sectionKey: getSectionKey(input.stepKey),
        strategy: LOCAL_SECTIONED_STEPWISE_STRATEGY,
        attempt,
        timeoutSeconds: STEPWISE_STEP_TIMEOUT_SECONDS,
        requestOptionsSummary: toRequestOptionsJson(result.requestOptionsSummary),
        responseSummary: result.responseSummary,
        outputLength: normalizedOutput.length,
        outputSummaryLength: outputSummary.length,
        promptHash,
        responseHash
      }
    });

    await recordStepwiseDraftLog({
      contentItemId: input.contentItemId,
      providerId: provider.id,
      modelId: model.id,
      status: "success",
      latencyMs: result.latencyMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      errorMessage: null,
      metadata: {
        responseSummary: result.responseSummary,
        runId: run.id,
        stepKey: input.stepKey,
        sectionKey: getSectionKey(input.stepKey),
        attempt,
        promptHash,
        responseHash,
        outputLength: normalizedOutput.length,
        outputSummaryLength: outputSummary.length,
        requestOptionsSummary: result.requestOptionsSummary,
        provider,
        modelName: model.displayName ?? model.name
      }
    });

    const refreshedRun = await updateContentDraftGenerationRunProgress({
      runId: run.id,
      status: "running",
      currentStepKey: getNextStepKey(input.stepKey),
      metadata: {
        lastSuccessfulStepKey: input.stepKey,
        lastSuccessfulAttempt: attempt,
        lastStepLatencyMs: result.latencyMs,
        stepExecutionImplemented: true,
        assemblyImplemented: false,
        finalPolishImplemented: false,
        contentItemAutoApply: false
      }
    });
    const detailedRun = await getContentDraftGenerationRunForContentItem(refreshedRun.contentItemId, refreshedRun.id);

    return {
      run: detailedRun ? toContentDraftGenerationRunDetail(detailedRun) : toContentDraftGenerationRunDetail(run),
      step: toContentDraftGenerationStepSummary(successStep),
      executed: true,
      reusedExistingSuccess: false
    };
  } catch (error) {
    const providerError = error instanceof ProviderCallError ? error : null;
    const latencyMs = providerError?.latencyMs ?? null;
    await markContentDraftGenerationStepFailed({
      stepId: runningStep.id,
      errorCode: providerError?.responseSummary ?? "step_provider_call_failed",
      latencyMs,
      metadata: {
        runId: run.id,
        stepKey: input.stepKey,
        sectionKey: getSectionKey(input.stepKey),
        strategy: LOCAL_SECTIONED_STEPWISE_STRATEGY,
        attempt,
        timeoutSeconds: STEPWISE_STEP_TIMEOUT_SECONDS,
        requestOptionsSummary: toRequestOptionsJson(providerError?.requestOptionsSummary ?? null),
        promptHash,
        responseSummary: providerError?.responseSummary ?? "step_provider_call_failed"
      }
    });
    await updateContentDraftGenerationRunProgress({
      runId: run.id,
      status: "failed",
      currentStepKey: input.stepKey,
      metadata: {
        lastFailedStepKey: input.stepKey,
        lastFailedAttempt: attempt,
        lastFailureCode: providerError?.responseSummary ?? "step_provider_call_failed",
        stepExecutionImplemented: true,
        assemblyImplemented: false,
        finalPolishImplemented: false,
        contentItemAutoApply: false
      }
    });
    await recordStepwiseDraftLog({
      contentItemId: input.contentItemId,
      providerId: provider.id,
      modelId: model.id,
      status: "failed",
      latencyMs,
      inputTokens: null,
      outputTokens: null,
      errorMessage: error instanceof Error ? error.message : "step provider call failed",
      metadata: {
        responseSummary: providerError?.responseSummary ?? "step_provider_call_failed",
        runId: run.id,
        stepKey: input.stepKey,
        sectionKey: getSectionKey(input.stepKey),
        attempt,
        promptHash,
        responseHash: null,
        outputLength: 0,
        outputSummaryLength: 0,
        requestOptionsSummary: providerError?.requestOptionsSummary ?? null,
        provider,
        modelName: model.displayName ?? model.name
      }
    });

    throw new StepwiseDraftGenerationError(
      providerError?.responseSummary ?? "step_provider_call_failed",
      safeErrorMessage(error instanceof Error ? error.message : "Step provider call failed.", 240),
      400
    );
  }
}

function assertRunExecutable(run: SafeContentDraftGenerationRunWithSteps) {
  assertLocalStepwiseRun(run);
  if (run.status === "cancelled" || run.status === "completed") {
    throw new StepwiseDraftGenerationError("run_not_executable", "Completed or cancelled runs cannot execute draft generation steps.", 409);
  }
}

function assertLocalStepwiseRun(run: SafeContentDraftGenerationRunWithSteps) {
  if (run.strategy !== LOCAL_SECTIONED_STEPWISE_STRATEGY) {
    throw new StepwiseDraftGenerationError("local_stepwise_run_required", "This run is not a local stepwise draft generation run.", 409);
  }
}

function getStepFromRun(run: SafeContentDraftGenerationRunWithSteps, stepKey: string) {
  const step = run.steps.find((item) => item.stepKey === stepKey);
  if (!step) {
    throw new StepwiseDraftGenerationError("step_not_found", "Draft generation step was not found for this run.", 404);
  }
  return step;
}

function isAllowedStepKey(stepKey: string) {
  return (DEFAULT_LOCAL_SECTIONED_STEPWISE_STEP_KEYS as readonly string[]).includes(stepKey);
}

function getSectionKey(stepKey: string) {
  return stepKey === "skeleton" ? null : stepKey;
}

function getNextStepKey(stepKey: string) {
  const index = (DEFAULT_LOCAL_SECTIONED_STEPWISE_STEP_KEYS as readonly string[]).indexOf(stepKey);
  if (index < 0) {
    return null;
  }
  return DEFAULT_LOCAL_SECTIONED_STEPWISE_STEP_KEYS[index + 1] ?? null;
}

function getRequiredSectionOutputs(run: SafeContentDraftGenerationRunWithSteps) {
  const sections = DEFAULT_LOCAL_SECTIONED_STEPWISE_SECTION_KEYS.map((key) => {
    const step = run.steps.find((item) => item.stepKey === key);
    return { key, step };
  });
  const missing = sections
    .filter((section) => section.step?.status !== "success" || !section.step.outputMarkdown?.trim())
    .map((section) => section.key);

  if (missing.length > 0) {
    throw new StepwiseDraftGenerationError("section_steps_required", `Successful section outputs are required before assembly. Missing: ${missing.join(", ")}.`, 409);
  }

  return sections.map((section) => ({
    key: section.key,
    markdown: section.step?.outputMarkdown ?? ""
  }));
}

function requirePlanJson(contentItem: StepwiseContentItem) {
  if (!contentItem.planJson || typeof contentItem.planJson !== "object" || Array.isArray(contentItem.planJson)) {
    throw new StepwiseDraftGenerationError("plan_json_required", "Saved planJson is required before stepwise draft generation.", 400);
  }
  return contentItem.planJson as Record<string, unknown>;
}

async function loadStepwiseContentItem(contentItemId: string) {
  return prisma.contentItem.findUnique({
    where: { id: contentItemId },
    include: {
      blog: true,
      brandProfile: true,
      assets: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }
    }
  });
}

async function loadContentDraftRoute() {
  return prisma.llmTaskRoute.findUnique({
    where: { taskType: "content_draft" },
    include: {
      primaryProvider: {
        include: { secrets: true }
      },
      primaryModel: true
    }
  });
}

function assertContentDraftRouteReady(route: StepwiseTaskRoute | null): asserts route is StepwiseTaskRoute {
  if (!route || !route.isEnabled || !route.primaryProvider || !route.primaryModel) {
    throw new StepwiseDraftGenerationError("content_draft_route_not_ready", "content_draft route is not ready.", 409);
  }
  if (!route.primaryProvider.isEnabled || !route.primaryModel.isEnabled || route.primaryProvider.lastTestStatus !== "success") {
    throw new StepwiseDraftGenerationError("content_draft_route_not_ready", "Primary provider or model is not ready for content_draft.", 409);
  }
}

function buildStepPrompt(input: {
  stepKey: string;
  run: SafeContentDraftGenerationRunWithSteps;
  contentItem: ContentItemAdmin;
  planJson: Record<string, unknown>;
  mediaMapping: Array<{ assetId: string; placementHint: string; caption: string | null; placeholder: string }>;
}): DraftPromptPreview {
  if (input.stepKey === "skeleton") {
    return buildSkeletonStepPrompt(input.contentItem, input.planJson, input.mediaMapping);
  }
  const skeletonStep = getStepFromRun(input.run, "skeleton");
  return buildSectionStepPrompt({
    sectionKey: input.stepKey,
    skeletonMarkdown: skeletonStep.outputMarkdown ?? "",
    previousSectionSummaries: getPreviousSectionSummaries(input.run, input.stepKey),
    contentItem: input.contentItem,
    planJson: input.planJson,
    mediaMapping: input.mediaMapping
  });
}

function buildSkeletonStepPrompt(
  contentItem: ContentItemAdmin,
  planJson: Record<string, unknown>,
  mediaMapping: Array<{ assetId: string; placementHint: string; caption: string | null; placeholder: string }>
): DraftPromptPreview {
  return {
    system: [
      "You are a careful Korean long-form article architect for Blog Growth Agent.",
      "Create only a concise Markdown skeleton for a future article. Do not write body prose.",
      "Use helpful, original, people-first structure. Do not copy competitor articles.",
      `Design for a real long-form SEO article: target at least ${SEO_ARTICLE_TEMPLATE_V1.targetVisibleTextLength} visible Korean characters and never below ${SEO_ARTICLE_TEMPLATE_V1.minVisibleTextLengthToPublish}.`,
      "For investment or finance content, frame all services as informational/reference tools only.",
      "Do not include buy/sell recommendations, guaranteed profit, return examples, success stories, or risk-free wording.",
      "Use the exact section keys requested. Do not create an H1."
    ].join("\n"),
    user: JSON.stringify(
      {
        context: buildSafePromptContext(contentItem, planJson, mediaMapping),
        requiredSectionKeys: DEFAULT_LOCAL_SECTIONED_STEPWISE_SECTION_KEYS
      },
      null,
      2
    ),
    outputFormat: [
      "Return Markdown only.",
      "Start with ## Stepwise Draft Skeleton.",
      "For each section key, include exactly one bullet shaped like: - section_key: heading — goal.",
      `Required section keys: ${DEFAULT_LOCAL_SECTIONED_STEPWISE_SECTION_KEYS.join(", ")}.`,
      "Do not include article body paragraphs.",
      "Do not wrap in code fences."
    ].join("\n")
  };
}

function buildSectionStepPrompt(input: {
  sectionKey: string;
  skeletonMarkdown: string;
  previousSectionSummaries: string[];
  contentItem: ContentItemAdmin;
  planJson: Record<string, unknown>;
  mediaMapping: Array<{ assetId: string; placementHint: string; caption: string | null; placeholder: string }>;
}): DraftPromptPreview {
  const faqRequired = input.sectionKey === "faq" && Array.isArray(input.planJson.faq) && input.planJson.faq.length > 0;
  const seoContract = buildSeoSectionPromptContract(input.sectionKey as SeoArticleSectionKey, input.contentItem);
  return {
    system: [
      "You are a careful Korean Markdown section writer.",
      "Write only the requested section fragment.",
      "Do not write an H1. Use H2/H3 and paragraphs only.",
      "Each non-FAQ section must include concrete context, practical criteria, beginner mistakes or examples, and a clear takeaway.",
      "Do not output a thin outline or placeholder. This step is where the article gets its substance.",
      `The full article target is at least ${SEO_ARTICLE_TEMPLATE_V1.targetVisibleTextLength} visible Korean characters and the publish floor is ${SEO_ARTICLE_TEMPLATE_V1.minVisibleTextLengthToPublish}.`,
      seoContract.section
        ? `This section minimum is ${seoContract.section.minVisibleTextLength} visible Korean characters and ${seoContract.section.minParagraphCount} paragraphs. Meet or exceed it.`
        : "Make this section substantial enough to support a long-form SEO article.",
      "Use this expansion pattern: reader problem, concrete scenario, practical checks, beginner mistake, takeaway.",
      "Do not include aggressive CTA wording or investment recommendations.",
      "Do not include guaranteed outcomes, return examples, risk-free wording, or buy/sell recommendations.",
      "Do not delete media placeholders.",
      faqRequired
        ? "This section must include a dedicated ## FAQ heading and ### question headings based on saved FAQ items."
        : "Do not invent an FAQ section unless the requested section is faq and saved FAQ exists."
    ].join("\n"),
    user: JSON.stringify(
      {
        context: buildSafePromptContext(input.contentItem, input.planJson, input.mediaMapping),
        seoSectionContract: seoContract,
        skeletonMarkdown: input.skeletonMarkdown,
        requestedSectionKey: input.sectionKey,
        previousSectionSummaries: input.previousSectionSummaries,
        faqInstruction: faqRequired
          ? {
              required: true,
              format: "Use ## FAQ, then ### question headings with natural answers based on savedPlanJson.faq."
            }
          : { required: false },
        sectionExpansionContract: seoContract.section
          ? {
              minVisibleTextLength: seoContract.section.minVisibleTextLength,
              minParagraphCount: seoContract.section.minParagraphCount,
              expansionPattern: ["reader_problem", "concrete_scenario", "practical_checks", "beginner_mistake", "takeaway"]
            }
          : null
      },
      null,
      2
    ),
    outputFormat: [
      "Return Markdown only.",
      "Start with one H2 for this section.",
      faqRequired ? "Include a dedicated ## FAQ heading and ### question headings for saved FAQ items." : "Do not add FAQ unless requested.",
      "Do not include H1.",
      "Do not wrap in code fences.",
      "Do not include commentary outside the Markdown fragment."
    ].join("\n")
  };
}

function buildSafePromptContext(
  contentItem: ContentItemAdmin,
  planJson: Record<string, unknown>,
  mediaMapping: Array<{ assetId: string; placementHint: string; caption: string | null; placeholder: string }>
) {
  return {
    contentItem: {
      title: contentItem.title,
      mode: contentItem.mode,
      targetKeyword: contentItem.targetKeyword
    },
    blogProfile: contentItem.blog
      ? {
          name: contentItem.blog.name,
          mainTopic: contentItem.blog.mainTopic,
          subTopics: contentItem.blog.subTopics,
          targetReader: contentItem.blog.targetReader,
          tone: contentItem.blog.tone,
          locale: contentItem.blog.locale,
          preferredPhrases: contentItem.blog.preferredPhrases,
          forbiddenPhrases: contentItem.blog.forbiddenPhrases
        }
      : null,
    brandProfile: contentItem.brandProfile
      ? {
          name: contentItem.brandProfile.name,
          serviceName: contentItem.brandProfile.serviceName,
          shortDescription: contentItem.brandProfile.shortDescription,
          targetUsers: contentItem.brandProfile.targetUsers,
          coreFeatures: contentItem.brandProfile.coreFeatures,
          problemsSolved: contentItem.brandProfile.problemsSolved,
          ctaWeak: contentItem.brandProfile.ctaWeak,
          ctaNormal: contentItem.brandProfile.ctaNormal,
          riskDisclaimer: contentItem.brandProfile.riskDisclaimer
        }
      : null,
    savedPlanJson: {
      titleCandidates: planJson.titleCandidates,
      targetKeyword: planJson.targetKeyword,
      searchIntent: planJson.searchIntent,
      audience: planJson.audience,
      coreMessage: planJson.coreMessage,
      outline: planJson.outline,
      ctaPlan: planJson.ctaPlan,
      mediaPlan: planJson.mediaPlan,
      faq: planJson.faq,
      risks: planJson.risks
    },
    mediaMapping: mediaMapping.map((mapping) => ({
      assetId: mapping.assetId,
      placementHint: mapping.placementHint,
      caption: mapping.caption,
      placeholder: mapping.placeholder
    })),
    policy: {
      oneStepOnly: true,
      noDuplicateH1: true,
      moderateInformationalCta: true,
      investmentSafety: "No buy/sell recommendations, guaranteed returns, risk-free wording, or success-rate claims."
    }
  };
}

function buildStepwiseFinalPolishPrompt(input: {
  contentItem: ContentItemAdmin;
  planJson: Record<string, unknown>;
  mediaMapping: Array<{ assetId: string; placementHint: string; caption: string | null; placeholder: string }>;
  assembledCandidateMarkdown: string;
}): DraftPromptPreview {
  const faqRequired = Array.isArray(input.planJson.faq) && input.planJson.faq.length > 0;
  return {
    system: [
      "You are a careful Korean Markdown final editor for Blog Growth Agent.",
      "Polish the assembled draft for tone, transitions, repetition, CTA balance, and disclaimer clarity.",
      `The final article must remain long-form: at least ${SEO_ARTICLE_TEMPLATE_V1.minVisibleTextLengthToPublish} visible Korean characters, preferably ${SEO_ARTICLE_TEMPLATE_V1.targetVisibleTextLength}+ characters.`,
      "If a section is thin, expand it with examples, practical checks, and reader-oriented explanations instead of only rewording.",
      "Do not add unsupported claims, investment recommendations, guaranteed outcomes, return examples, success stories, or aggressive sign-up language.",
      "Use neutral, informational phrasing for finance or investment-related content.",
      "Do not delete media placeholders.",
      faqRequired ? "Preserve a dedicated FAQ-like section with question headings. Do not merge FAQ items into general paragraphs." : "Do not invent FAQ items.",
      "Return one complete Markdown draft with exactly one H1."
    ].join("\n"),
    user: JSON.stringify(
      {
        context: buildSafePromptContext(input.contentItem, input.planJson, input.mediaMapping),
        assembledCandidateMarkdown: input.assembledCandidateMarkdown
      },
      null,
      2
    ),
    outputFormat: [
      "Return Markdown only.",
      "Keep exactly one H1 at the top.",
      "Keep H2/H3 structure.",
      "Keep media placeholders.",
      faqRequired ? "Keep a dedicated FAQ-like section because savedPlanJson.faq exists." : "Do not add FAQ unless already present.",
      "Do not wrap in code fences.",
      "Do not include commentary before or after the Markdown."
    ].join("\n")
  };
}

function buildAssembledCandidateMarkdown(input: { title: string; sections: Array<{ key: string; markdown: string }> }) {
  const seenHeadings = new Set<string>();
  const fragments = input.sections
    .map((section) => normalizeSectionOutputForAssembly(section.markdown))
    .map((section) => removeDuplicateHeadings(section, seenHeadings))
    .filter(Boolean);
  return normalizeMarkdown(`# ${stripMarkdownHeading(input.title || "본문 초안")}\n\n${fragments.join("\n\n")}`);
}

function normalizeSectionOutputForAssembly(value: string) {
  return normalizeMarkdown(stripCodeFences(value).replace(/^#\s+.+$/gm, "").trim());
}

function normalizeFinalCandidateMarkdown(value: string, title: string) {
  const lines = normalizeMarkdown(stripCodeFences(value))
    .split(/\r?\n/)
    .filter((line) => !/^#\s+/.test(line.trim()));
  return normalizeMarkdown(`# ${stripMarkdownHeading(title || "본문 초안")}\n\n${lines.join("\n").trim()}`);
}

function applyDeterministicCandidateGuards(markdown: string, planJson: Record<string, unknown>) {
  const faqItems = getFaqItemsFromPlan(planJson);
  const faqDetectedBefore = hasFaqLikeSection(markdown);
  let nextMarkdown = markdown;
  let faqFallbackAppended = false;

  if (faqItems.length > 0 && !faqDetectedBefore) {
    nextMarkdown = normalizeMarkdown(`${nextMarkdown}\n\n${buildFaqFallbackMarkdown(faqItems)}`);
    faqFallbackAppended = true;
  }

  const scrubResult = scrubLocalSectionedDraftSafetyPhrases(nextMarkdown);
  nextMarkdown = scrubResult.markdown;

  return {
    markdown: nextMarkdown,
    summary: {
      faqRequired: faqItems.length > 0,
      faqCount: faqItems.length,
      faqSectionDetectedBefore: faqDetectedBefore,
      faqSectionDetectedAfter: hasFaqLikeSection(nextMarkdown),
      faqFallbackAppended,
      safetyScrubApplied: scrubResult.scrubApplied,
      safetyScrubCount: scrubResult.scrubCount,
      safetyScrubCodes: scrubResult.scrubCodes,
      h1Count: countMarkdownHeadings(nextMarkdown, 1),
      h2OrH3Count: countMarkdownHeadings(nextMarkdown, 2) + countMarkdownHeadings(nextMarkdown, 3),
      mediaPlaceholderCount: countMediaPlaceholders(nextMarkdown)
    }
  };
}

function buildCandidateValidationSummary(input: {
  phase: "assemble" | "final_polish";
  markdown: string;
  contentItem: ContentItemAdmin;
  assets: ContentAssetAdmin[];
  sectionKeys: string[];
  guardSummary: ReturnType<typeof applyDeterministicCandidateGuards>["summary"];
}) {
  const validation = validateDraftMarkdown(input.markdown, {
    contentItem: input.contentItem,
    assets: input.assets
  });
  return {
    phase: input.phase,
    ok: validation.ok,
    errorCount: validation.errors.length,
    warningCount: validation.warnings.length,
    errors: validation.errors,
    warnings: validation.warnings,
    markdownLength: input.markdown.length,
    sectionKeys: input.sectionKeys,
    guardSummary: input.guardSummary,
    contentItemAutoApply: false,
    bloggerApiImplemented: false
  } satisfies Prisma.InputJsonObject;
}

function getDraftTitle(contentItem: ContentItemAdmin, planJson: Record<string, unknown>) {
  if (contentItem.title?.trim()) {
    return contentItem.title.trim();
  }
  const titleCandidates = Array.isArray(planJson.titleCandidates) ? planJson.titleCandidates : [];
  const first = titleCandidates.find((item): item is string => typeof item === "string" && item.trim().length > 0);
  return first?.trim() ?? "본문 초안";
}

function getFaqItemsFromPlan(planJson: Record<string, unknown>) {
  if (!Array.isArray(planJson.faq)) {
    return [];
  }
  return planJson.faq
    .map((item) => normalizeFaqItem(item))
    .filter((item): item is { question: string; answer: string } => Boolean(item))
    .slice(0, 5);
}

function normalizeFaqItem(item: unknown) {
  if (typeof item === "string") {
    const question = sanitizeMarkdownLine(item);
    return question ? { question, answer: "본문의 핵심 기준을 참고해 자신의 상황에 맞게 차분히 확인하는 것이 좋습니다." } : null;
  }
  if (!item || typeof item !== "object") {
    return null;
  }
  const record = item as Record<string, unknown>;
  const question = firstStringValue(record, ["question", "q", "title", "heading"]);
  const answer = firstStringValue(record, ["answer", "a", "response", "description"]);
  if (!question) {
    return null;
  }
  return {
    question: sanitizeMarkdownLine(question),
    answer: sanitizeMarkdownParagraph(answer || "본문의 핵심 기준을 참고해 자신의 상황에 맞게 판단하는 것이 좋습니다.")
  };
}

function firstStringValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return null;
}

function buildFaqFallbackMarkdown(items: Array<{ question: string; answer: string }>) {
  return [
    "## FAQ",
    "",
    ...items.flatMap((item) => [`### ${item.question}`, "", item.answer, ""])
  ].join("\n").trim();
}

function hasFaqLikeSection(value: string) {
  return /(^|\n)#{2,3}\s*(faq|자주 묻|질문)/i.test(value) || /(^|\n)###\s+.+\?/m.test(value);
}

function removeDuplicateHeadings(value: string, seen: Set<string>) {
  return value
    .split(/\r?\n/)
    .filter((line) => {
      const match = line.match(/^(#{2,3})\s+(.+)$/);
      if (!match) {
        return true;
      }
      const normalized = match[2].trim().toLowerCase();
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    })
    .join("\n")
    .trim();
}

function countMarkdownHeadings(markdown: string, level: number) {
  const hashes = "#".repeat(level);
  const pattern = new RegExp(`(^|\\n)${hashes}\\s+\\S`, "g");
  return markdown.match(pattern)?.length ?? 0;
}

function countMediaPlaceholders(markdown: string) {
  return markdown.match(/<!--\s*media:/gi)?.length ?? 0;
}

function stripMarkdownHeading(value: string) {
  return value.replace(/^#{1,6}\s+/, "").trim();
}

function sanitizeMarkdownLine(value: string) {
  return stripHtml(value)
    .replace(/^#{1,6}\s+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function sanitizeMarkdownParagraph(value: string) {
  return stripHtml(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "");
}

function getPreviousSectionSummaries(run: SafeContentDraftGenerationRunWithSteps, stepKey: string) {
  const targetIndex = DEFAULT_LOCAL_SECTIONED_STEPWISE_SECTION_KEYS.indexOf(stepKey as (typeof DEFAULT_LOCAL_SECTIONED_STEPWISE_SECTION_KEYS)[number]);
  if (targetIndex <= 0) {
    return [];
  }
  const previousKeys = DEFAULT_LOCAL_SECTIONED_STEPWISE_SECTION_KEYS.slice(0, targetIndex);
  return previousKeys
    .map((key) => run.steps.find((step) => step.stepKey === key && step.outputSummary)?.outputSummary)
    .filter((summary): summary is string => Boolean(summary));
}

function getMaxTokensForStep(stepKey: string, routeMaxTokens: number | null) {
  const max = stepKey === "skeleton" ? SKELETON_MAX_TOKENS : stepKey === "final_polish" ? FINAL_POLISH_MAX_TOKENS : SECTION_MAX_TOKENS;
  return Math.min(routeMaxTokens ?? max, max);
}

async function callProvider(
  provider: ProviderWithSecrets,
  model: string,
  prompt: DraftPromptPreview,
  temperature: number | null,
  maxTokens: number | null,
  timeoutSeconds: number,
  stepKey: string
) {
  if (provider.apiFormat === "openai_compatible") {
    return callOpenAiCompatible(provider, model, prompt, temperature, maxTokens, timeoutSeconds);
  }

  if (provider.apiFormat === "ollama_compatible") {
    return callOllamaCompatible(provider, model, prompt, temperature, maxTokens, timeoutSeconds, stepKey);
  }

  throw new ProviderCallError("unsupported_stepwise_provider_api_format", "unsupported_api_format", 0);
}

async function callOpenAiCompatible(
  provider: ProviderWithSecrets,
  model: string,
  prompt: DraftPromptPreview,
  temperature: number | null,
  maxTokens: number | null,
  timeoutSeconds: number
): Promise<ProviderCallResult> {
  const startedAt = Date.now();
  const baseUrl = requireBaseUrl(provider.baseUrl);
  const tokenParameter = getOpenAiCompletionTokenParameter(model);
  const apiKey = getOptionalProviderApiKey(provider);
  const requestOptionsSummary = buildRequestOptionsSummary({
    apiFormat: provider.apiFormat,
    stream: false,
    timeoutSeconds,
    firstByteTimeoutSeconds: null,
    idleTimeoutSeconds: null,
    numPredict: maxTokens ?? SECTION_MAX_TOKENS,
    numCtx: null,
    keepAlive: null,
    inputLength: getPromptInputLength(prompt)
  });
  const response = await fetchWithTimeout(
    joinUrl(baseUrl, provider.endpointPath || "/v1/chat/completions"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: `${prompt.user}\n\nOutput format:\n${prompt.outputFormat}` }
        ],
        temperature: temperature ?? 0.2,
        [tokenParameter]: maxTokens ?? SECTION_MAX_TOKENS
      })
    },
    timeoutSeconds
  );

  const body = await readJsonOrText(response);
  const latencyMs = Date.now() - startedAt;

  if (!response.ok) {
    throw new ProviderCallError(safeHttpFailureMessage("OpenAI-compatible", response.status), summarizeHttpFailure("openai_compatible", response.status), latencyMs);
  }

  return {
    text: extractOpenAiText(body),
    latencyMs,
    inputTokens: extractUsageToken(body, "prompt_tokens"),
    outputTokens: extractUsageToken(body, "completion_tokens"),
    responseSummary: "openai_chat_completion_received",
    requestOptionsSummary
  };
}

async function callOllamaCompatible(
  provider: ProviderWithSecrets,
  model: string,
  prompt: DraftPromptPreview,
  temperature: number | null,
  maxTokens: number | null,
  timeoutSeconds: number,
  stepKey: string
): Promise<ProviderCallResult> {
  const startedAt = Date.now();
  const baseUrl = requireBaseUrl(provider.baseUrl);
  const endpoint = joinUrl(baseUrl, provider.endpointPath || "/api/generate");
  const numPredict = maxTokens ?? getDefaultNumPredictForStep(stepKey);
  const numCtx = getNumCtxForStep(stepKey);
  const requestOptionsSummary = buildRequestOptionsSummary({
    apiFormat: provider.apiFormat,
    stream: true,
    timeoutSeconds,
    firstByteTimeoutSeconds: STEPWISE_OLLAMA_FIRST_BYTE_TIMEOUT_SECONDS,
    idleTimeoutSeconds: STEPWISE_OLLAMA_IDLE_TIMEOUT_SECONDS,
    numPredict,
    numCtx,
    keepAlive: STEPWISE_OLLAMA_KEEP_ALIVE,
    inputLength: getPromptInputLength(prompt)
  });

  await preflightOllamaModel({
    baseUrl,
    model,
    requestOptionsSummary
  });

  const result = await fetchOllamaStream(
    endpoint,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: `${prompt.system}\n\nInput:\n${prompt.user}\n\nOutput format:\n${prompt.outputFormat}`,
        stream: true,
        keep_alive: STEPWISE_OLLAMA_KEEP_ALIVE,
        options: {
          temperature: temperature ?? 0.2,
          num_predict: numPredict,
          num_ctx: numCtx
        }
      })
    },
    requestOptionsSummary
  );

  return {
    text: result.text,
    latencyMs: Date.now() - startedAt,
    inputTokens: null,
    outputTokens: null,
    responseSummary: result.responseSummary,
    requestOptionsSummary
  };
}

async function preflightOllamaModel(input: {
  baseUrl: string;
  model: string;
  requestOptionsSummary: StepwiseRequestOptionsSummary;
}) {
  const tagsUrl = joinUrl(input.baseUrl, "/api/tags");
  const response = await fetchWithTimeout(tagsUrl, { method: "GET" }, STEPWISE_OLLAMA_PREFLIGHT_TIMEOUT_SECONDS, input.requestOptionsSummary);
  const body = await readJsonOrText(response);

  if (!response.ok) {
    throw new ProviderCallError("provider_tags_unreachable", "provider_tags_unreachable", 0, input.requestOptionsSummary);
  }

  const models = body && typeof body === "object" && "models" in body ? (body as { models?: Array<{ name?: unknown; model?: unknown }> }).models : null;
  const names = Array.isArray(models)
    ? models.map((item) => (typeof item.name === "string" ? item.name : typeof item.model === "string" ? item.model : null)).filter((name): name is string => Boolean(name))
    : [];
  if (!names.includes(input.model)) {
    throw new ProviderCallError("provider_model_not_found", "provider_model_not_found", 0, input.requestOptionsSummary);
  }
}

async function fetchOllamaStream(url: string, init: RequestInit, requestOptionsSummary: StepwiseRequestOptionsSummary) {
  const controller = new AbortController();
  let timeoutKind: "provider_timeout" | "provider_first_byte_timeout" | "provider_idle_timeout" = "provider_timeout";
  const overallTimeout = setTimeout(() => {
    timeoutKind = "provider_timeout";
    controller.abort();
  }, requestOptionsSummary.timeoutSeconds * 1000);
  const firstByteTimeout = setTimeout(() => {
    timeoutKind = "provider_first_byte_timeout";
    controller.abort();
  }, (requestOptionsSummary.firstByteTimeoutSeconds ?? requestOptionsSummary.timeoutSeconds) * 1000);
  let idleTimeout: ReturnType<typeof setTimeout> | null = null;

  const resetIdleTimeout = () => {
    if (idleTimeout) {
      clearTimeout(idleTimeout);
    }
    if (requestOptionsSummary.idleTimeoutSeconds) {
      idleTimeout = setTimeout(() => {
        timeoutKind = "provider_idle_timeout";
        controller.abort();
      }, requestOptionsSummary.idleTimeoutSeconds * 1000);
    }
  };

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(firstByteTimeout);

    if (!response.ok) {
      throw new ProviderCallError(
        safeHttpFailureMessage("Ollama-compatible", response.status),
        summarizeHttpFailure("ollama_compatible", response.status),
        0,
        requestOptionsSummary
      );
    }

    if (!response.body) {
      throw new ProviderCallError("provider_empty_response", "provider_empty_response", 0, requestOptionsSummary);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let output = "";
    resetIdleTimeout();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      resetIdleTimeout();
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const parsed = parseOllamaStreamLine(line, requestOptionsSummary);
        output += parsed.response;
      }
    }

    const finalChunk = decoder.decode();
    if (finalChunk) {
      buffer += finalChunk;
    }
    if (buffer.trim()) {
      output += parseOllamaStreamLine(buffer, requestOptionsSummary).response;
    }

    if (!output.trim()) {
      throw new ProviderCallError("provider_empty_response", "provider_empty_response", 0, requestOptionsSummary);
    }

    return {
      text: output,
      responseSummary: "ollama_stream_generate_received"
    };
  } catch (error) {
    if (error instanceof ProviderCallError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderCallError(timeoutKind, timeoutKind, requestOptionsSummary.timeoutSeconds * 1000, requestOptionsSummary);
    }
    throw new ProviderCallError("provider_network_error", "provider_network_error", 0, requestOptionsSummary);
  } finally {
    clearTimeout(overallTimeout);
    clearTimeout(firstByteTimeout);
    if (idleTimeout) {
      clearTimeout(idleTimeout);
    }
  }
}

function parseOllamaStreamLine(line: string, requestOptionsSummary: StepwiseRequestOptionsSummary) {
  const trimmed = line.trim();
  if (!trimmed) {
    return { response: "" };
  }
  try {
    const parsed = JSON.parse(trimmed) as { response?: unknown; error?: unknown };
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      throw new ProviderCallError("provider_stream_error", "provider_stream_error", 0, requestOptionsSummary);
    }
    return {
      response: typeof parsed.response === "string" ? parsed.response : ""
    };
  } catch (error) {
    if (error instanceof ProviderCallError) {
      throw error;
    }
    throw new ProviderCallError("provider_stream_parse_error", "provider_stream_parse_error", 0, requestOptionsSummary);
  }
}

async function recordStepwiseDraftLog(input: {
  contentItemId: string;
  providerId: string | null;
  modelId: string | null;
  status: "success" | "failed";
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  errorMessage: string | null;
  metadata: {
    responseSummary: string;
    runId: string;
    stepKey: string;
    sectionKey: string | null;
    attempt: number;
    promptHash: string;
    responseHash: string | null;
    outputLength: number;
    outputSummaryLength: number;
    requestOptionsSummary: StepwiseRequestOptionsSummary | null;
    provider: ProviderWithSecrets;
    modelName: string | null;
  };
}) {
  const isFinalPolish = input.metadata.stepKey === "final_polish";
  await createLlmCallLog({
    taskType: "content_draft",
    contentItemId: input.contentItemId,
    providerId: input.providerId,
    modelId: input.modelId,
    status: input.status,
    latencyMs: input.latencyMs,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    estimatedCost: null,
    errorMessage: input.errorMessage ? safeErrorMessage(input.errorMessage, 500) : null,
    metadata: {
      purpose: isFinalPolish ? "content_draft_stepwise_final_polish" : "content_draft_stepwise_step_execution",
      phase: isFinalPolish ? "final_polish" : "step_execution",
      strategy: LOCAL_SECTIONED_STEPWISE_STRATEGY,
      runId: input.metadata.runId,
      stepKey: input.metadata.stepKey,
      sectionKey: input.metadata.sectionKey,
      attempt: input.metadata.attempt,
      promptHash: input.metadata.promptHash,
      responseHash: input.metadata.responseHash,
      timeoutSeconds: STEPWISE_STEP_TIMEOUT_SECONDS,
      requestOptionsSummary: input.metadata.requestOptionsSummary,
      responseSummary: input.metadata.responseSummary,
      outputLength: input.metadata.outputLength,
      outputSummaryLength: input.metadata.outputSummaryLength,
      providerSummary: {
        providerName: input.metadata.provider.name,
        providerType: input.metadata.provider.providerType,
        invocationMode: input.metadata.provider.invocationMode,
        apiFormat: input.metadata.provider.apiFormat,
        baseUrlHostOnly: getBaseUrlHostOnly(input.metadata.provider.baseUrl),
        endpointPath: input.metadata.provider.endpointPath,
        modelName: input.metadata.modelName
      },
      stepExecutionImplemented: true,
      assemblyImplemented: isFinalPolish,
      finalPolishImplemented: isFinalPolish,
      contentItemAutoApply: false,
      bloggerApiImplemented: false
    } as Prisma.InputJsonObject
  });
}

function normalizeStepOutput(stepKey: string, value: string) {
  const normalized = normalizeMarkdown(stripCodeFences(value));
  if (stepKey === "skeleton") {
    return normalized.replace(/^#\s+.+$/gm, "").trim();
  }
  return normalized.replace(/^#\s+.+$/gm, "").trim();
}

function summarizeStepOutput(stepKey: string, markdown: string) {
  const text = markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/[#*_>`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 320);
  return `${stepKey}: ${text}`;
}

function getOptionalProviderApiKey(provider: ProviderWithSecrets) {
  const apiKeySecret = provider.secrets.find((secret) => secret.secretKind === "api_key");
  return apiKeySecret ? decryptSecret(apiKeySecret.encryptedValue) : null;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutSeconds: number, requestOptionsSummary: StepwiseRequestOptionsSummary | null = null) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderCallError("provider_timeout", "provider_timeout", timeoutSeconds * 1000, requestOptionsSummary);
    }
    throw new ProviderCallError("provider_network_error", "provider_network_error", 0, requestOptionsSummary);
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonOrText(response: Response) {
  const rawText = await response.text();
  if (!rawText) {
    return null;
  }
  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return rawText;
  }
}

function extractOpenAiText(body: unknown) {
  const choices = body && typeof body === "object" && "choices" in body ? (body as { choices?: Array<{ message?: { content?: unknown }; text?: unknown }> }).choices : null;
  const content = choices?.[0]?.message?.content ?? choices?.[0]?.text;
  if (typeof content !== "string" || !content.trim()) {
    throw new ProviderCallError("provider_empty_response", "provider_empty_response", 0);
  }
  return content;
}

function extractUsageToken(body: unknown, key: "prompt_tokens" | "completion_tokens") {
  const usage = body && typeof body === "object" && "usage" in body ? (body as { usage?: Record<string, unknown> }).usage : null;
  const value = usage?.[key];
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null;
}

function requireBaseUrl(value: string | null) {
  if (!value) {
    throw new ProviderCallError("missing_base_url", "missing_base_url", 0);
  }
  return value;
}

function joinUrl(baseUrl: string, endpointPath: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`;
  return `${normalizedBase}${normalizedPath}`;
}

function safeHttpFailureMessage(label: string, status: number) {
  if (status === 401 || status === 403) {
    return `${label} stepwise content_draft generation failed with HTTP ${status}. Authentication failed. Check the provider credentials.`;
  }
  if (status === 400) {
    return `${label} stepwise content_draft generation failed with HTTP ${status}. Check provider parameters.`;
  }
  if (status === 404) {
    return `${label} stepwise content_draft generation failed with HTTP ${status}. Endpoint or model was not found.`;
  }
  return `${label} stepwise content_draft generation failed with HTTP ${status}.`;
}

function summarizeHttpFailure(apiFormat: string, status: number) {
  if (status === 401 || status === 403) {
    return "authentication_failed";
  }
  if (status === 400) {
    return "parameter_error";
  }
  if (status === 404) {
    return apiFormat === "ollama_compatible" ? "not_found_or_model_unavailable" : "not_found";
  }
  if (status >= 500) {
    return "provider_server_error";
  }
  return redactSensitiveText("provider_http_error");
}

function buildRequestOptionsSummary(input: StepwiseRequestOptionsSummary): StepwiseRequestOptionsSummary {
  return input;
}

function toRequestOptionsJson(value: StepwiseRequestOptionsSummary | null): Prisma.InputJsonObject | null {
  if (!value) {
    return null;
  }
  return {
    apiFormat: value.apiFormat,
    stream: value.stream,
    timeoutSeconds: value.timeoutSeconds,
    firstByteTimeoutSeconds: value.firstByteTimeoutSeconds,
    idleTimeoutSeconds: value.idleTimeoutSeconds,
    numPredict: value.numPredict,
    numCtx: value.numCtx,
    keepAlive: value.keepAlive,
    inputLength: value.inputLength
  };
}

function getPromptInputLength(prompt: DraftPromptPreview) {
  return prompt.system.length + prompt.user.length + prompt.outputFormat.length;
}

function getDefaultNumPredictForStep(stepKey: string) {
  if (stepKey === "skeleton") {
    return SKELETON_MAX_TOKENS;
  }
  if (stepKey === "final_polish") {
    return FINAL_POLISH_MAX_TOKENS;
  }
  return SECTION_MAX_TOKENS;
}

function getNumCtxForStep(stepKey: string) {
  if (stepKey === "skeleton") {
    return SKELETON_NUM_CTX;
  }
  if (stepKey === "final_polish") {
    return FINAL_POLISH_NUM_CTX;
  }
  return SECTION_NUM_CTX;
}

function getBaseUrlHostOnly(value: string | null) {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).host;
  } catch {
    return "invalid_url";
  }
}

function stripCodeFences(value: string) {
  return value.replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/i, "");
}

function normalizeMarkdown(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
