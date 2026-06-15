import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { buildDraftMarkdownDryRun, type DraftPromptPreview } from "@/lib/content/draft-preview";
import { validatePlanJson } from "@/lib/content/plan-validation";
import { createLlmCallLog } from "@/lib/db/llm-call-logs";
import { prisma } from "@/lib/db/client";
import {
  DEFAULT_LOCAL_SECTIONED_STEPWISE_SECTION_KEYS,
  DEFAULT_LOCAL_SECTIONED_STEPWISE_STEP_KEYS,
  LOCAL_SECTIONED_STEPWISE_STRATEGY,
  getContentDraftGenerationRunForContentItem,
  markContentDraftGenerationStepFailed,
  markContentDraftGenerationStepPendingRetry,
  markContentDraftGenerationStepRunning,
  markContentDraftGenerationStepSuccess,
  toContentDraftGenerationRunDetail,
  toContentDraftGenerationStepSummary,
  updateContentDraftGenerationRunProgress,
  type SafeContentDraftGenerationRunWithSteps,
  type SafeContentDraftGenerationStep
} from "@/lib/db/content-draft-generation-runs";
import type { LlmTaskRouteAdmin } from "@/lib/llm/admin-types";
import { isLocalLikeDraftProvider } from "@/lib/llm/draft-generation-strategy";
import { getOpenAiCompletionTokenParameter } from "@/lib/llm/provider-test";
import { redactSensitiveText, safeErrorMessage } from "@/lib/llm/redaction";
import { decryptSecret } from "@/lib/llm/secrets";

const STEPWISE_STEP_TIMEOUT_SECONDS = 600;
const SKELETON_MAX_TOKENS = 900;
const SECTION_MAX_TOKENS = 1400;

export interface ExecuteStepwiseDraftGenerationStepInput {
  contentItemId: string;
  runId: string;
  stepKey: string;
  retry?: boolean;
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
}

class ProviderCallError extends Error {
  responseSummary: string;
  latencyMs: number;

  constructor(message: string, responseSummary: string, latencyMs: number) {
    super(message);
    this.responseSummary = responseSummary;
    this.latencyMs = latencyMs;
  }
}

type ProviderWithSecrets = NonNullable<Awaited<ReturnType<typeof prisma.llmProvider.findUnique>>> & {
  secrets: Array<{ secretKind: string; encryptedValue: string }>;
};

type StepwiseContentItem = NonNullable<Awaited<ReturnType<typeof loadStepwiseContentItem>>>;
type StepwiseTaskRoute = NonNullable<Awaited<ReturnType<typeof loadContentDraftRoute>>>;

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
    const result = await callProvider(provider, model.name, prompt, route.temperature, getMaxTokensForStep(input.stepKey, route.maxTokens), STEPWISE_STEP_TIMEOUT_SECONDS);
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
  if (run.strategy !== LOCAL_SECTIONED_STEPWISE_STRATEGY) {
    throw new StepwiseDraftGenerationError("local_stepwise_run_required", "This run is not a local stepwise draft generation run.", 409);
  }
  if (run.status === "cancelled" || run.status === "completed") {
    throw new StepwiseDraftGenerationError("run_not_executable", "Completed or cancelled runs cannot execute draft generation steps.", 409);
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
      "Required section keys: intro, body_1, body_2, body_3, conclusion_cta_faq.",
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
  const faqRequired = input.sectionKey === "conclusion_cta_faq" && Array.isArray(input.planJson.faq) && input.planJson.faq.length > 0;
  return {
    system: [
      "You are a careful Korean Markdown section writer.",
      "Write only the requested section fragment.",
      "Do not write an H1. Use H2/H3 and paragraphs only.",
      "Do not include aggressive CTA wording or investment recommendations.",
      "Do not include guaranteed outcomes, return examples, risk-free wording, or buy/sell recommendations.",
      "Do not delete media placeholders.",
      faqRequired
        ? "This section must include a dedicated ## FAQ heading and ### question headings based on saved FAQ items."
        : "Do not invent an FAQ section unless the requested section is conclusion_cta_faq and saved FAQ exists."
    ].join("\n"),
    user: JSON.stringify(
      {
        context: buildSafePromptContext(input.contentItem, input.planJson, input.mediaMapping),
        skeletonMarkdown: input.skeletonMarkdown,
        requestedSectionKey: input.sectionKey,
        previousSectionSummaries: input.previousSectionSummaries,
        faqInstruction: faqRequired
          ? {
              required: true,
              format: "Use ## FAQ, then ### question headings with natural answers based on savedPlanJson.faq."
            }
          : { required: false }
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
  const max = stepKey === "skeleton" ? SKELETON_MAX_TOKENS : SECTION_MAX_TOKENS;
  return Math.min(routeMaxTokens ?? max, max);
}

async function callProvider(
  provider: ProviderWithSecrets,
  model: string,
  prompt: DraftPromptPreview,
  temperature: number | null,
  maxTokens: number | null,
  timeoutSeconds: number
) {
  if (provider.apiFormat === "openai_compatible") {
    return callOpenAiCompatible(provider, model, prompt, temperature, maxTokens, timeoutSeconds);
  }

  if (provider.apiFormat === "ollama_compatible") {
    return callOllamaCompatible(provider, model, prompt, temperature, maxTokens, timeoutSeconds);
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
    responseSummary: "openai_chat_completion_received"
  };
}

async function callOllamaCompatible(
  provider: ProviderWithSecrets,
  model: string,
  prompt: DraftPromptPreview,
  temperature: number | null,
  maxTokens: number | null,
  timeoutSeconds: number
): Promise<ProviderCallResult> {
  const startedAt = Date.now();
  const baseUrl = requireBaseUrl(provider.baseUrl);
  const response = await fetchWithTimeout(
    joinUrl(baseUrl, provider.endpointPath || "/api/generate"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: `${prompt.system}\n\nInput:\n${prompt.user}\n\nOutput format:\n${prompt.outputFormat}`,
        stream: false,
        options: {
          temperature: temperature ?? 0.2,
          num_predict: maxTokens ?? SECTION_MAX_TOKENS
        }
      })
    },
    timeoutSeconds
  );

  const body = await readJsonOrText(response);
  const latencyMs = Date.now() - startedAt;

  if (!response.ok) {
    throw new ProviderCallError(safeHttpFailureMessage("Ollama-compatible", response.status), summarizeHttpFailure("ollama_compatible", response.status), latencyMs);
  }

  return {
    text: extractOllamaText(body),
    latencyMs,
    inputTokens: null,
    outputTokens: null,
    responseSummary: "ollama_generate_received"
  };
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
    provider: ProviderWithSecrets;
    modelName: string | null;
  };
}) {
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
      purpose: "content_draft_stepwise_step_execution",
      strategy: LOCAL_SECTIONED_STEPWISE_STRATEGY,
      runId: input.metadata.runId,
      stepKey: input.metadata.stepKey,
      sectionKey: input.metadata.sectionKey,
      attempt: input.metadata.attempt,
      promptHash: input.metadata.promptHash,
      responseHash: input.metadata.responseHash,
      timeoutSeconds: STEPWISE_STEP_TIMEOUT_SECONDS,
      responseSummary: input.metadata.responseSummary,
      outputLength: input.metadata.outputLength,
      outputSummaryLength: input.metadata.outputSummaryLength,
      providerSummary: {
        providerName: input.metadata.provider.name,
        providerType: input.metadata.provider.providerType,
        invocationMode: input.metadata.provider.invocationMode,
        apiFormat: input.metadata.provider.apiFormat,
        modelName: input.metadata.modelName
      },
      stepExecutionImplemented: true,
      assemblyImplemented: false,
      finalPolishImplemented: false,
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

async function fetchWithTimeout(url: string, init: RequestInit, timeoutSeconds: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderCallError("provider_timeout", "provider_timeout", timeoutSeconds * 1000);
    }
    throw new ProviderCallError("provider_network_error", "provider_network_error", 0);
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

function extractOllamaText(body: unknown) {
  const response = body && typeof body === "object" && "response" in body ? (body as { response?: unknown }).response : null;
  if (typeof response !== "string" || !response.trim()) {
    throw new ProviderCallError("provider_empty_response", "provider_empty_response", 0);
  }
  return response;
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
