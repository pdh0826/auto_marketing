import type { LlmGenerateRequest, LlmGenerateResponse, LlmProvider, LlmTaskRoute } from "./types";

export class LlmRouter {
  constructor(private readonly providers: Record<string, LlmProvider>) {}

  async generate(route: LlmTaskRoute, request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    const primary = this.providers[route.primaryProvider.providerType];
    if (!primary) {
      throw new Error(`LLM provider not registered: ${route.primaryProvider.providerType}`);
    }

    try {
      return await primary.generate(
        {
          ...request,
          model: request.model ?? route.primaryModel,
          temperature: request.temperature ?? route.temperature,
          maxTokens: request.maxTokens ?? route.maxTokens
        },
        route.primaryProvider
      );
    } catch (error) {
      if (!route.fallbackProvider || !route.fallbackModel) {
        throw error;
      }

      const fallback = this.providers[route.fallbackProvider.providerType];
      if (!fallback) {
        throw error;
      }

      return fallback.generate(
        {
          ...request,
          model: route.fallbackModel,
          metadata: {
            ...request.metadata,
            fallbackFrom: route.primaryProvider.providerType
          }
        },
        route.fallbackProvider
      );
    }
  }
}
