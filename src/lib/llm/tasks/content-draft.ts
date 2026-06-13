import type { LlmRouter } from "../router";
import type { LlmTaskRoute } from "../types";

export async function generateContentDraft(router: LlmRouter, route: LlmTaskRoute, prompt: string) {
  return router.generate(route, {
    taskType: route.taskType,
    prompt
  });
}
