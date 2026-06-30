import { NextResponse } from "next/server";
import {
  buildDailyContentDraftGenerationLlmDispatchResponseReadbackResponse,
  type DailyContentDraftGenerationLlmDispatchResponseReadbackRequest
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-response-readback";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as DailyContentDraftGenerationLlmDispatchResponseReadbackRequest;
    const result = await buildDailyContentDraftGenerationLlmDispatchResponseReadbackResponse(body);
    return NextResponse.json({ data: result, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error instanceof Error ? error.message : "Daily content draft generation LLM dispatch response readback failed.", 500) },
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
