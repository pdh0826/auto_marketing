import type { LlmCallStatus, LlmProviderType, LlmTaskType } from "./types";

export interface LlmProviderAdmin {
  id: string;
  providerType: LlmProviderType;
  name: string;
  baseUrl: string | null;
  secretRef: string | null;
  apiKeyLast4: string | null;
  isEnabled: boolean;
  timeoutSeconds: number;
  maxRetries: number;
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
