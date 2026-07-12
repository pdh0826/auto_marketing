import { createHash } from "crypto";
import { spawn } from "node:child_process";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { createLlmCallLog } from "@/lib/db/llm-call-logs";
import { safeErrorMessage } from "@/lib/llm/redaction";
import {
  buildProject300RewritePrompt,
  reviewProject300GeneratedPost,
  runProject300ReviewRewriteLoop,
  summarizeProject300StyleReview,
  type Project300RewriteLoopResult
} from "./project300-style-review";
import { inferProject300CategoryKind, type Project300CategoryKind } from "./project300-voice-variation";

const GPT_CLI_REWRITE_FEATURE_FLAG = "PROJECT300_GPT_CLI_STYLE_REWRITE_ENABLED";
const DEFAULT_GPT_CLI_TIMEOUT_MS = 240_000;

type ProviderWithSecrets = Prisma.LlmProviderGetPayload<{
  include: {
    secrets: true;
  };
}>;

export interface Project300StyleRewritePreviewResult {
  contentItemId: string;
  title: string | null;
  categoryKind: Project300CategoryKind;
  executeLlm: boolean;
  featureFlagEnabled: boolean;
  routeReady: boolean;
  gptCliProviderReady: boolean;
  finalReviewer: "gpt_cli";
  initialReview: ReturnType<typeof summarizeProject300StyleReview>;
  finalReview: ReturnType<typeof summarizeProject300StyleReview>;
  rewriteLoop: Omit<Project300RewriteLoopResult, "finalMarkdown" | "initialReview" | "finalReview"> & {
    finalMarkdownReturned: boolean;
  };
  candidateMarkdown: string | null;
  rewritePromptHash: string;
  rewritePromptLength: number;
  blockingReasons: string[];
  sideEffectSummary: {
    dbRead: true;
    dbWrite: false;
    contentMutation: false;
    tistoryApiWrite: false;
    bloggerApiWrite: false;
    publish: false;
    tokenRefresh: false;
    llmCall: boolean;
    llmCallLogCreated: boolean;
    promptStored: false;
    rawResponseStored: false;
  };
}

export async function previewProject300StyleRewrite(input: {
  contentItemId: string;
  executeLlm?: boolean;
  maxIterations?: number;
  confirmationPhrase?: string;
}): Promise<Project300StyleRewritePreviewResult> {
  const contentItem = await prisma.contentItem.findUnique({
    where: { id: input.contentItemId },
    select: {
      id: true,
      title: true,
      draftMarkdown: true,
      planJson: true,
      _count: {
        select: {
          assets: true
        }
      }
    }
  });

  if (!contentItem) {
    throw new Error("content_item_not_found");
  }
  if (!contentItem.draftMarkdown?.trim()) {
    throw new Error("draft_markdown_required");
  }

  const categoryKind = inferProject300CategoryKind(readSelectionMode(contentItem.planJson));
  const initialReview = reviewProject300GeneratedPost({
    title: contentItem.title ?? "",
    markdown: contentItem.draftMarkdown,
    categoryKind,
    assetImageCount: contentItem._count.assets
  });
  const rewritePrompt = buildProject300RewritePrompt({
    title: contentItem.title ?? "",
    markdown: contentItem.draftMarkdown,
    review: initialReview
  });
  const route = await loadStyleRewriteRoute();
  const provider = route?.primaryProvider ?? null;
  const featureFlagEnabled = process.env[GPT_CLI_REWRITE_FEATURE_FLAG] === "true";
  const executeLlm = Boolean(input.executeLlm);
  const blockingReasons = buildBlockingReasons({
    executeLlm,
    featureFlagEnabled,
    confirmationPhrase: input.confirmationPhrase,
    routeReady: Boolean(route),
    provider
  });

  if (!executeLlm || blockingReasons.length > 0) {
    const noRewriteLoop = await runProject300ReviewRewriteLoop({
      title: contentItem.title ?? "",
      markdown: contentItem.draftMarkdown,
      categoryKind,
      assetImageCount: contentItem._count.assets,
      maxIterations: input.maxIterations
    });
    return buildResult({
      contentItem,
      categoryKind,
      executeLlm,
      featureFlagEnabled,
      routeReady: Boolean(route),
      gptCliProviderReady: isGptCliProviderReady(provider),
      initialReview: noRewriteLoop.initialReview,
      finalReview: noRewriteLoop.finalReview,
      rewriteLoop: noRewriteLoop,
      candidateMarkdown: null,
      rewritePrompt,
      blockingReasons,
      llmCall: false,
      llmCallLogCreated: false
    });
  }

  let llmCallLogCreated = false;
  const rewriteLoop = await runProject300ReviewRewriteLoop({
    title: contentItem.title ?? "",
    markdown: contentItem.draftMarkdown,
    categoryKind,
    assetImageCount: contentItem._count.assets,
    maxIterations: input.maxIterations,
    rewrite: async ({ prompt, iteration, review }) => {
      if (!route || !provider || !route.primaryModel) {
        throw new Error("style_rewrite_route_not_ready");
      }
      const result = await callGptCliProvider({
        provider,
        modelName: route.primaryModel.name,
        prompt,
        timeoutSeconds: route.timeoutSeconds ?? provider.timeoutSeconds,
        contentItemId: contentItem.id,
        iteration,
        reviewScore: review.score
      });
      llmCallLogCreated = true;
      return result.text;
    }
  });

  return buildResult({
    contentItem,
    categoryKind,
    executeLlm,
    featureFlagEnabled,
    routeReady: Boolean(route),
    gptCliProviderReady: isGptCliProviderReady(provider),
    initialReview: rewriteLoop.initialReview,
    finalReview: rewriteLoop.finalReview,
    rewriteLoop,
    candidateMarkdown: rewriteLoop.finalMarkdown,
    rewritePrompt,
    blockingReasons: [],
    llmCall: rewriteLoop.rewriteAttempted,
    llmCallLogCreated
  });
}

async function callGptCliProvider(input: {
  provider: ProviderWithSecrets;
  modelName: string;
  prompt: string;
  timeoutSeconds: number | null;
  contentItemId: string;
  iteration: number;
  reviewScore: number;
}) {
  const startedAt = Date.now();
  const promptHash = hashText(input.prompt);
  try {
    const output = await runCli({
      executable: input.provider.cliExecutable || "gpt",
      args: buildCliArgs(input.provider.cliArgsJson, input.modelName, input.prompt),
      stdin: shouldWritePromptToStdin(input.provider.cliArgsJson) ? input.prompt : null,
      timeoutMs: (input.timeoutSeconds && input.timeoutSeconds > 0 ? input.timeoutSeconds * 1000 : DEFAULT_GPT_CLI_TIMEOUT_MS)
    });
    const latencyMs = Date.now() - startedAt;
    await createLlmCallLog({
      taskType: "style_rewrite",
      providerId: input.provider.id,
      modelId: null,
      contentItemId: input.contentItemId,
      status: "success",
      latencyMs,
      inputTokens: null,
      outputTokens: null,
      estimatedCost: null,
      errorMessage: null,
      metadata: {
        purpose: "project300_style_rewrite_review_loop",
        phase: "gpt_cli_rewrite",
        finalReviewer: "gpt_cli",
        iteration: input.iteration,
        beforeScore: input.reviewScore,
        promptHash,
        promptLength: input.prompt.length,
        responseHash: hashText(output),
        responseLength: output.length,
        promptStored: false,
        rawResponseStored: false,
        candidateStored: false
      }
    });
    return { text: output, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    await createLlmCallLog({
      taskType: "style_rewrite",
      providerId: input.provider.id,
      modelId: null,
      contentItemId: input.contentItemId,
      status: "failed",
      latencyMs,
      inputTokens: null,
      outputTokens: null,
      estimatedCost: null,
      errorMessage: safeErrorMessage(error instanceof Error ? error.message : "gpt_cli_rewrite_failed", 500),
      metadata: {
        purpose: "project300_style_rewrite_review_loop",
        phase: "gpt_cli_rewrite",
        finalReviewer: "gpt_cli",
        iteration: input.iteration,
        beforeScore: input.reviewScore,
        promptHash,
        promptLength: input.prompt.length,
        responseHash: null,
        responseLength: 0,
        promptStored: false,
        rawResponseStored: false,
        candidateStored: false
      }
    });
    throw error;
  }
}

function runCli(input: { executable: string; args: string[]; stdin: string | null; timeoutMs: number }) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(input.executable, input.args, {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("gpt_cli_timeout"));
    }, input.timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(safeCliError(error.message)));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`gpt_cli_failed:${safeCliError(stderr || String(code ?? "unknown"))}`));
        return;
      }
      resolve(stdout.trim());
    });
    if (input.stdin) {
      child.stdin.write(input.stdin);
    }
    child.stdin.end();
  });
}

function buildCliArgs(value: Prisma.JsonValue | null, modelName: string, prompt: string) {
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === "string")) {
    return modelName ? ["--model", modelName] : [];
  }
  return value.map((item) => item.split("{model}").join(modelName).split("{prompt}").join(prompt));
}

function shouldWritePromptToStdin(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value) || value.length === 0) {
    return true;
  }
  return !value.some((item) => typeof item === "string" && item.includes("{prompt}"));
}

function buildBlockingReasons(input: {
  executeLlm: boolean;
  featureFlagEnabled: boolean;
  confirmationPhrase?: string;
  routeReady: boolean;
  provider: ProviderWithSecrets | null;
}) {
  const blockers: string[] = [];
  if (!input.executeLlm) {
    blockers.push("execute_llm_false_preview_only");
  }
  if (!input.featureFlagEnabled) {
    blockers.push("project300_gpt_cli_style_rewrite_feature_flag_disabled");
  }
  if (input.confirmationPhrase !== "PROJECT300 GPT CLI REWRITE") {
    blockers.push("confirmation_phrase_required");
  }
  if (!input.routeReady) {
    blockers.push("style_rewrite_route_not_ready");
  }
  if (!isGptCliProviderReady(input.provider)) {
    blockers.push("gpt_cli_provider_not_ready");
  }
  return blockers;
}

function isGptCliProviderReady(provider: ProviderWithSecrets | null) {
  return Boolean(provider && provider.providerType === "gpt_cli" && provider.invocationMode === "cli" && provider.apiFormat === "custom_cli" && provider.isEnabled);
}

async function loadStyleRewriteRoute() {
  return prisma.llmTaskRoute.findUnique({
    where: { taskType: "style_rewrite" },
    include: {
      primaryProvider: {
        include: {
          secrets: true
        }
      },
      primaryModel: true
    }
  });
}

function buildResult(input: {
  contentItem: { id: string; title: string | null };
  categoryKind: Project300CategoryKind;
  executeLlm: boolean;
  featureFlagEnabled: boolean;
  routeReady: boolean;
  gptCliProviderReady: boolean;
  initialReview: Project300RewriteLoopResult["initialReview"];
  finalReview: Project300RewriteLoopResult["finalReview"];
  rewriteLoop: Project300RewriteLoopResult;
  candidateMarkdown: string | null;
  rewritePrompt: string;
  blockingReasons: string[];
  llmCall: boolean;
  llmCallLogCreated: boolean;
}): Project300StyleRewritePreviewResult {
  return {
    contentItemId: input.contentItem.id,
    title: input.contentItem.title,
    categoryKind: input.categoryKind,
    executeLlm: input.executeLlm,
    featureFlagEnabled: input.featureFlagEnabled,
    routeReady: input.routeReady,
    gptCliProviderReady: input.gptCliProviderReady,
    finalReviewer: "gpt_cli",
    initialReview: summarizeProject300StyleReview(input.initialReview),
    finalReview: summarizeProject300StyleReview(input.finalReview),
    rewriteLoop: {
      iterations: input.rewriteLoop.iterations,
      rewriteAttempted: input.rewriteLoop.rewriteAttempted,
      rewriteSucceeded: input.rewriteLoop.rewriteSucceeded,
      maxIterations: input.rewriteLoop.maxIterations,
      stoppedReason: input.rewriteLoop.stoppedReason,
      finalMarkdownReturned: Boolean(input.candidateMarkdown)
    },
    candidateMarkdown: input.candidateMarkdown,
    rewritePromptHash: hashText(input.rewritePrompt),
    rewritePromptLength: input.rewritePrompt.length,
    blockingReasons: input.blockingReasons,
    sideEffectSummary: {
      dbRead: true,
      dbWrite: false,
      contentMutation: false,
      tistoryApiWrite: false,
      bloggerApiWrite: false,
      publish: false,
      tokenRefresh: false,
      llmCall: input.llmCall,
      llmCallLogCreated: input.llmCallLogCreated,
      promptStored: false,
      rawResponseStored: false
    }
  };
}

function readSelectionMode(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const selection = (value as Record<string, unknown>).selection;
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) {
    return null;
  }
  const mode = (selection as Record<string, unknown>).mode;
  return typeof mode === "string" ? mode : null;
}

function safeCliError(value: string) {
  return value.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]").replace(/\s+/g, " ").slice(0, 240);
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
