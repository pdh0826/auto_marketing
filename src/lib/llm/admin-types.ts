import type { LlmApiFormat, LlmCallStatus, LlmInvocationMode, LlmProviderTestStatus, LlmProviderType, LlmTaskType } from "./types";

export interface LlmProviderAdmin {
  id: string;
  providerType: LlmProviderType;
  invocationMode: LlmInvocationMode;
  apiFormat: LlmApiFormat;
  name: string;
  baseUrl: string | null;
  endpointPath: string | null;
  defaultModel: string | null;
  headersJson: Record<string, unknown> | null;
  requestTemplateJson: Record<string, unknown> | null;
  cliExecutable: string | null;
  cliArgsJson: string[] | null;
  secretRef: string | null;
  apiKeyLast4: string | null;
  hasSecret: boolean;
  isEnabled: boolean;
  timeoutSeconds: number;
  maxRetries: number;
  lastTestStatus: LlmProviderTestStatus;
  lastTestedAt: string | null;
  lastTestError: string | null;
  createdAt: string;
  updatedAt: string;
  models?: LlmModelAdmin[];
}

export interface LlmModelAdmin {
  id: string;
  providerId: string;
  name: string;
  displayName: string | null;
  isDefault: boolean;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  provider?: LlmProviderAdmin;
}

export interface LlmTaskRouteAdmin {
  id: string;
  taskType: LlmTaskType;
  primaryProviderId: string;
  primaryModelId: string;
  fallbackProviderId: string | null;
  fallbackModelId: string | null;
  temperature: number | null;
  maxTokens: number | null;
  timeoutSeconds: number | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  primaryProvider?: LlmProviderAdmin;
  primaryModel?: LlmModelAdmin;
  fallbackProvider?: LlmProviderAdmin | null;
  fallbackModel?: LlmModelAdmin | null;
}

export interface LlmCallLogAdmin {
  id: string;
  taskType: LlmTaskType;
  providerId: string | null;
  modelId: string | null;
  contentItemId: string | null;
  status: LlmCallStatus;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCost: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  provider?: LlmProviderAdmin | null;
  model?: LlmModelAdmin | null;
}
