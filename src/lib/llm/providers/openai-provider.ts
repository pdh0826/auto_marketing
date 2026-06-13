import type { LlmGenerateRequest, LlmGenerateResponse, LlmProvider, LlmProviderConfig } from "../types";

export class OpenAiProvider implements LlmProvider {
  readonly providerType = "openai" as const;

  async generate(request: LlmGenerateRequest, config: LlmProviderConfig): Promise<LlmGenerateResponse> {
    const startedAt = Date.now();

    // Intentionally left as a safe scaffold.
    // Next patch should implement the OpenAI API call here.
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    return {
      text: `[OpenAI scaffold response for ${request.taskType}]`,
      providerType: "openai",
      model: request.model ?? config.defaultModel,
      latencyMs: Date.now() - startedAt
    };
  }

  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    return {
      ok: Boolean(process.env.OPENAI_API_KEY),
      message: process.env.OPENAI_API_KEY ? "OpenAI API key is configured" : "OPENAI_API_KEY is missing"
    };
  }
}
