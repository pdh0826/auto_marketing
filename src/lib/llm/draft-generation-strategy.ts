import type { LlmApiFormat, LlmInvocationMode, LlmProviderType } from "@/lib/llm/types";

export type DraftGenerationStrategy = "one_shot_full_draft" | "local_sectioned_multi_pass";

export type DraftGenerationStrategyReason =
  | "explicit_strategy"
  | "local_like_provider"
  | "remote_or_commercial_provider"
  | "missing_provider_default_one_shot";

export interface DraftGenerationStrategyProviderLike {
  providerType?: LlmProviderType | string | null;
  invocationMode?: LlmInvocationMode | string | null;
  apiFormat?: LlmApiFormat | string | null;
  name?: string | null;
}

export interface DraftGenerationStrategyModelLike {
  name?: string | null;
  displayName?: string | null;
}

export interface DraftGenerationStrategyResolution {
  strategy: DraftGenerationStrategy;
  strategyReason: DraftGenerationStrategyReason;
  isLocalLike: boolean;
  stepCount: number;
  plannedStepCount: number;
  sectionedGenerationImplemented: boolean;
  finalPolishImplemented: boolean;
  providerSummary: {
    providerName: string | null;
    providerType: string | null;
    invocationMode: string | null;
    apiFormat: string | null;
    modelName: string | null;
  };
}

export function isLocalLikeDraftProvider(provider?: DraftGenerationStrategyProviderLike | null) {
  if (!provider) {
    return false;
  }

  return (
    provider.providerType === "local" ||
    provider.providerType === "local_http" ||
    provider.providerType === "cli" ||
    provider.invocationMode === "local_http" ||
    provider.invocationMode === "cli" ||
    provider.apiFormat === "ollama_compatible" ||
    provider.apiFormat === "custom_cli"
  );
}

export function resolveDraftGenerationStrategy(input: {
  explicitStrategy?: DraftGenerationStrategy | null;
  provider?: DraftGenerationStrategyProviderLike | null;
  model?: DraftGenerationStrategyModelLike | null;
}): DraftGenerationStrategyResolution {
  const isLocalLike = isLocalLikeDraftProvider(input.provider);
  const strategy = input.explicitStrategy ?? (isLocalLike ? "local_sectioned_multi_pass" : "one_shot_full_draft");
  const strategyReason = input.explicitStrategy
    ? "explicit_strategy"
    : input.provider
      ? isLocalLike
        ? "local_like_provider"
        : "remote_or_commercial_provider"
      : "missing_provider_default_one_shot";

  return {
    strategy,
    strategyReason,
    isLocalLike,
    stepCount: 1,
    plannedStepCount: strategy === "local_sectioned_multi_pass" ? 5 : 1,
    sectionedGenerationImplemented: false,
    finalPolishImplemented: false,
    providerSummary: {
      providerName: input.provider?.name ?? null,
      providerType: input.provider?.providerType ?? null,
      invocationMode: input.provider?.invocationMode ?? null,
      apiFormat: input.provider?.apiFormat ?? null,
      modelName: input.model?.displayName ?? input.model?.name ?? null
    }
  };
}

export function getDraftGenerationStrategyLabel(strategy: DraftGenerationStrategy) {
  if (strategy === "local_sectioned_multi_pass") {
    return "Local sectioned multi-pass";
  }
  return "One-shot full draft";
}

export function getDraftGenerationStrategyNotice(resolution: DraftGenerationStrategyResolution) {
  if (resolution.strategy === "local_sectioned_multi_pass") {
    return "Local/small-model route detected. Draft generation uses skeleton-first sectioned generation with a final polish fallback policy.";
  }
  return "Commercial/high-performance remote route detected. The existing one-shot full draft generation remains the default.";
}
