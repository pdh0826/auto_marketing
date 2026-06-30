import { NextResponse } from "next/server";
import {
  buildDailyContentDraftGenerationLlmProviderHealthCheckReadbackResponse,
  type DailyContentDraftGenerationLlmProviderHealthCheckReadbackRequest
} from "@/lib/daily-content-plans/draft-generation-llm-provider-health-check-readback";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as DailyContentDraftGenerationLlmProviderHealthCheckReadbackRequest;
    const result = await buildDailyContentDraftGenerationLlmProviderHealthCheckReadbackResponse(body);
    return NextResponse.json({ data: result, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error instanceof Error ? error.message : "Daily content draft generation LLM provider health-check readback failed.", 500) },
      { status: 400 }
    );
  }
}

async function parseJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
