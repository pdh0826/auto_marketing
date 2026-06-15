import { Prisma, type ContentDraftGenerationRunStatus, type ContentDraftGenerationStepStatus } from "@prisma/client";
import { prisma } from "@/lib/db/client";

export const LOCAL_SECTIONED_STEPWISE_STRATEGY = "local_sectioned_stepwise" as const;

export const DEFAULT_LOCAL_SECTIONED_STEPWISE_SECTION_KEYS = ["intro", "body_1", "body_2", "body_3", "conclusion_cta_faq"] as const;

export const DEFAULT_LOCAL_SECTIONED_STEPWISE_STEP_KEYS = ["skeleton", ...DEFAULT_LOCAL_SECTIONED_STEPWISE_SECTION_KEYS] as const;

const runSafeSelect = {
  id: true,
  contentItemId: true,
  strategy: true,
  status: true,
  currentStepKey: true,
  sectionKeys: true,
  assembledCandidateMarkdown: true,
  finalCandidateMarkdown: true,
  validationSummary: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true
} satisfies Prisma.ContentDraftGenerationRunSelect;

const stepSafeSelect = {
  id: true,
  runId: true,
  stepKey: true,
  sectionKey: true,
  status: true,
  attempt: true,
  outputMarkdown: true,
  outputSummary: true,
  promptHash: true,
  responseHash: true,
  latencyMs: true,
  errorCode: true,
  metadata: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.ContentDraftGenerationStepSelect;

const runWithStepsSafeSelect = {
  ...runSafeSelect,
  steps: {
    orderBy: [{ createdAt: "asc" }, { attempt: "asc" }],
    select: stepSafeSelect
  }
} satisfies Prisma.ContentDraftGenerationRunSelect;

const runListSelect = {
  ...runSafeSelect,
  _count: {
    select: {
      steps: true
    }
  }
} satisfies Prisma.ContentDraftGenerationRunSelect;

export type SafeContentDraftGenerationRun = Prisma.ContentDraftGenerationRunGetPayload<{ select: typeof runSafeSelect }>;
export type SafeContentDraftGenerationStep = Prisma.ContentDraftGenerationStepGetPayload<{ select: typeof stepSafeSelect }>;
export type SafeContentDraftGenerationRunWithSteps = Prisma.ContentDraftGenerationRunGetPayload<{ select: typeof runWithStepsSafeSelect }>;
export type SafeContentDraftGenerationRunListItem = Prisma.ContentDraftGenerationRunGetPayload<{ select: typeof runListSelect }>;

export function createContentDraftGenerationRun(input: {
  contentItemId: string;
  strategy: string;
  sectionKeys: Prisma.InputJsonValue;
  currentStepKey?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}) {
  return prisma.contentDraftGenerationRun.create({
    data: {
      contentItemId: input.contentItemId,
      strategy: input.strategy,
      status: "pending",
      currentStepKey: input.currentStepKey ?? null,
      sectionKeys: sanitizeJsonInput(input.sectionKeys),
      metadata: toNullableJsonInput(input.metadata)
    },
    select: runSafeSelect
  });
}

export function createLocalStepwiseContentDraftGenerationRun(input: {
  contentItemId: string;
  metadata?: Prisma.InputJsonValue | null;
}) {
  return prisma.$transaction(async (tx) => {
    const run = await tx.contentDraftGenerationRun.create({
      data: {
        contentItemId: input.contentItemId,
        strategy: LOCAL_SECTIONED_STEPWISE_STRATEGY,
        status: "pending",
        currentStepKey: "skeleton",
        sectionKeys: sanitizeJsonInput([...DEFAULT_LOCAL_SECTIONED_STEPWISE_SECTION_KEYS]),
        metadata: toNullableJsonInput(input.metadata)
      },
      select: runSafeSelect
    });

    await tx.contentDraftGenerationStep.createMany({
      data: DEFAULT_LOCAL_SECTIONED_STEPWISE_STEP_KEYS.map((stepKey) => ({
        runId: run.id,
        stepKey,
        sectionKey: stepKey === "skeleton" ? null : stepKey,
        status: "pending" as const,
        attempt: 1
      }))
    });

    const runWithSteps = await tx.contentDraftGenerationRun.findUnique({
      where: { id: run.id },
      select: runWithStepsSafeSelect
    });

    if (!runWithSteps) {
      throw new Error("content_draft_generation_run_create_failed");
    }

    return runWithSteps;
  });
}

export function getContentDraftGenerationRun(runId: string) {
  return prisma.contentDraftGenerationRun.findUnique({
    where: { id: runId },
    select: runWithStepsSafeSelect
  });
}

export function getContentDraftGenerationRunForContentItem(contentItemId: string, runId: string) {
  return prisma.contentDraftGenerationRun.findFirst({
    where: {
      id: runId,
      contentItemId
    },
    select: runWithStepsSafeSelect
  });
}

export function getContentDraftGenerationStepForRun(runId: string, stepKey: string) {
  return prisma.contentDraftGenerationStep.findFirst({
    where: {
      runId,
      stepKey
    },
    select: stepSafeSelect
  });
}

export function listContentDraftGenerationRunsForContentItem(contentItemId: string) {
  return prisma.contentDraftGenerationRun.findMany({
    where: { contentItemId },
    orderBy: [{ createdAt: "desc" }],
    select: runListSelect
  });
}

export function createContentDraftGenerationStep(input: {
  runId: string;
  stepKey: string;
  sectionKey?: string | null;
  status?: ContentDraftGenerationStepStatus;
  attempt?: number;
  metadata?: Prisma.InputJsonValue | null;
}) {
  return prisma.contentDraftGenerationStep.create({
    data: {
      runId: input.runId,
      stepKey: input.stepKey,
      sectionKey: input.sectionKey ?? null,
      status: input.status ?? "pending",
      attempt: input.attempt ?? 1,
      metadata: toNullableJsonInput(input.metadata)
    },
    select: stepSafeSelect
  });
}

export function markContentDraftGenerationStepRunning(input: {
  stepId: string;
  attempt?: number;
  metadata?: Prisma.InputJsonValue | null;
}) {
  return prisma.contentDraftGenerationStep.update({
    where: { id: input.stepId },
    data: {
      status: "running",
      attempt: input.attempt,
      errorCode: null,
      metadata: toNullableJsonInput(input.metadata)
    },
    select: stepSafeSelect
  });
}

export function markContentDraftGenerationStepPendingRetry(input: {
  stepId: string;
  attempt: number;
  metadata?: Prisma.InputJsonValue | null;
}) {
  return prisma.contentDraftGenerationStep.update({
    where: { id: input.stepId },
    data: {
      status: "pending",
      attempt: input.attempt,
      outputMarkdown: null,
      outputSummary: null,
      promptHash: null,
      responseHash: null,
      latencyMs: null,
      errorCode: null,
      metadata: toNullableJsonInput(input.metadata)
    },
    select: stepSafeSelect
  });
}

export function markContentDraftGenerationStepSuccess(input: {
  stepId: string;
  outputMarkdown?: string | null;
  outputSummary?: string | null;
  promptHash?: string | null;
  responseHash?: string | null;
  latencyMs?: number | null;
  metadata?: Prisma.InputJsonValue | null;
}) {
  return prisma.contentDraftGenerationStep.update({
    where: { id: input.stepId },
    data: {
      status: "success",
      outputMarkdown: input.outputMarkdown ?? null,
      outputSummary: input.outputSummary ?? null,
      promptHash: input.promptHash ?? null,
      responseHash: input.responseHash ?? null,
      latencyMs: input.latencyMs ?? null,
      errorCode: null,
      metadata: toNullableJsonInput(input.metadata)
    },
    select: stepSafeSelect
  });
}

export function markContentDraftGenerationStepFailed(input: {
  stepId: string;
  errorCode: string;
  latencyMs?: number | null;
  metadata?: Prisma.InputJsonValue | null;
}) {
  return prisma.contentDraftGenerationStep.update({
    where: { id: input.stepId },
    data: {
      status: "failed",
      errorCode: input.errorCode,
      latencyMs: input.latencyMs ?? null,
      metadata: toNullableJsonInput(input.metadata)
    },
    select: stepSafeSelect
  });
}

export function updateContentDraftGenerationRunProgress(input: {
  runId: string;
  status?: ContentDraftGenerationRunStatus;
  currentStepKey?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}) {
  return prisma.contentDraftGenerationRun.update({
    where: { id: input.runId },
    data: {
      status: input.status,
      currentStepKey: input.currentStepKey,
      metadata: toNullableJsonInput(input.metadata)
    },
    select: runSafeSelect
  });
}

export function completeContentDraftGenerationRun(input: {
  runId: string;
  assembledCandidateMarkdown?: string | null;
  finalCandidateMarkdown?: string | null;
  validationSummary?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
}) {
  return prisma.contentDraftGenerationRun.update({
    where: { id: input.runId },
    data: {
      status: "completed",
      currentStepKey: null,
      assembledCandidateMarkdown: input.assembledCandidateMarkdown ?? null,
      finalCandidateMarkdown: input.finalCandidateMarkdown ?? null,
      validationSummary: toNullableJsonInput(input.validationSummary),
      metadata: toNullableJsonInput(input.metadata),
      completedAt: new Date()
    },
    select: runSafeSelect
  });
}

export function cancelContentDraftGenerationRun(runId: string) {
  return prisma.contentDraftGenerationRun.update({
    where: { id: runId },
    data: {
      status: "cancelled",
      currentStepKey: null,
      completedAt: new Date()
    },
    select: runSafeSelect
  });
}

export function toContentDraftGenerationRunSummary(run: SafeContentDraftGenerationRun | SafeContentDraftGenerationRunListItem) {
  return {
    id: run.id,
    contentItemId: run.contentItemId,
    strategy: run.strategy,
    status: run.status,
    currentStepKey: run.currentStepKey,
    sectionKeys: run.sectionKeys,
    hasAssembledCandidateMarkdown: Boolean(run.assembledCandidateMarkdown),
    hasFinalCandidateMarkdown: Boolean(run.finalCandidateMarkdown),
    validationSummary: run.validationSummary,
    metadata: run.metadata,
    stepCount: "_count" in run ? run._count.steps : null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null
  };
}

export function toContentDraftGenerationRunDetail(run: SafeContentDraftGenerationRunWithSteps) {
  return {
    ...toContentDraftGenerationRunSummary(run),
    stepCount: run.steps.length,
    assembledCandidateMarkdown: run.assembledCandidateMarkdown,
    finalCandidateMarkdown: run.finalCandidateMarkdown,
    steps: run.steps.map(toContentDraftGenerationStepSummary)
  };
}

export function toContentDraftGenerationStepSummary(step: SafeContentDraftGenerationStep) {
  return {
    id: step.id,
    runId: step.runId,
    stepKey: step.stepKey,
    sectionKey: step.sectionKey,
    status: step.status,
    attempt: step.attempt,
    outputMarkdown: step.outputMarkdown,
    outputSummary: step.outputSummary,
    hasOutputMarkdown: Boolean(step.outputMarkdown),
    promptHash: step.promptHash,
    responseHash: step.responseHash,
    latencyMs: step.latencyMs,
    errorCode: step.errorCode,
    metadata: step.metadata,
    createdAt: step.createdAt.toISOString(),
    updatedAt: step.updatedAt.toISOString()
  };
}

function toNullableJsonInput(value: Prisma.InputJsonValue | null | undefined) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.JsonNull;
  }
  return sanitizeJsonInput(value);
}

function sanitizeJsonInput(value: Prisma.InputJsonValue): Prisma.InputJsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => (item === null ? null : sanitizeJsonInput(item)));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const sanitized: Record<string, Prisma.InputJsonValue | null> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined || isSensitiveMetadataKey(key)) {
      continue;
    }
    sanitized[key] = item === null ? null : sanitizeJsonInput(item as Prisma.InputJsonValue);
  }
  return sanitized;
}

function isSensitiveMetadataKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized === "prompthash" || normalized === "responsehash") {
    return false;
  }
  return [
    "prompt",
    "rawresponse",
    "responsebody",
    "requestbody",
    "body",
    "secret",
    "apikey",
    "token",
    "authorization",
    "headers",
    "requesttemplate",
    "sourcememo",
    "planjson",
    "draftmarkdown",
    "drafthtml",
    "candidate",
    "sectionfragment",
    "encryptedvalue"
  ].some((sensitiveKey) => normalized.includes(sensitiveKey));
}
