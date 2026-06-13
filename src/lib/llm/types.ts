export type LlmProviderType = "openai" | "local";

export type LlmTaskType =
  | "content_plan"
  | "content_draft"
  | "html_convert"
  | "quality_check"
  | "style_rewrite"
  | "cta_generate"
  | "keyword_analyze"
  | "serp_analyze"
  | "image_analyze";

export interface LlmProviderConfig {
  id: string;
  providerType: LlmProviderType;
  name: string;
  baseUrl?: string;
  secretRef?: string;
  apiKeyLast4?: string;
  defaultModel: string;
  timeoutSeconds: number;
  maxRetries: number;
  isEnabled: boolean;
}

export interface LlmModelConfig {
  id: string;
  providerId: string;
  name: string;
  displayName?: string;
  isDefault: boolean;
  isEnabled: boolean;
}

export interface LlmTaskRoute {
  taskType: LlmTaskType;
  primaryProvider: LlmProviderConfig;
  primaryModel: string;
  fallbackProvider?: LlmProviderConfig;
  fallbackModel?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutSeconds?: number;
}

export interface LlmGenerateRequest {
  taskType: LlmTaskType;
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
}

export interface LlmGenerateResponse {
  text: string;
  providerType: LlmProviderType;
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

export type LlmCallStatus = "success" | "failed";

export interface LlmCallLog {
  id: string;
  taskType: LlmTaskType;
  providerId?: string;
  modelId?: string;
  contentItemId?: string;
  status: LlmCallStatus;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface LlmProvider {
  readonly providerType: LlmProviderType;
  generate(request: LlmGenerateRequest, config: LlmProviderConfig): Promise<LlmGenerateResponse>;
  healthCheck(config: LlmProviderConfig): Promise<{ ok: boolean; message: string }>;
}
