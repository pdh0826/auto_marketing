import type { LlmGenerateRequest, LlmGenerateResponse, LlmProvider, LlmProviderConfig } from "../types";

export class LocalLlmProvider implements LlmProvider {
  readonly providerType = "local" as const;

  async generate(request: LlmGenerateRequest, config: LlmProviderConfig): Promise<LlmGenerateResponse> {
    const startedAt = Date.now();

    // Intentionally left as a safe scaffold.
    // Next patch should implement local HTTP endpoint calls here.
    if (!config.baseUrl && !process.env.LOCAL_LLM_BASE_URL) {
      throw new Error("Local LLM base URL is not configured");
    }

    return {
      text: `[Local LLM scaffold response for ${request.taskType}]`,
      providerType: "local",
      model: request.model ?? config.defaultModel,
      latencyMs: Date.now() - startedAt
    };
  }

  async healthCheck(config: LlmProviderConfig): Promise<{ ok: boolean; message: string }> {
    const baseUrl = config.baseUrl ?? process.env.LOCAL_LLM_BASE_URL;
    return {
      ok: Boolean(baseUrl),
      message: baseUrl ? `Local LLM endpoint configured: ${baseUrl}` : "LOCAL_LLM_BASE_URL is missing"
    };
  }
}
