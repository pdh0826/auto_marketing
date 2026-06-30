import { NextResponse } from "next/server";
import {
  buildDailyContentDraftGenerationLlmDispatchAttemptCreationResponse,
  type DailyContentDraftGenerationLlmDispatchAttemptCreationRequest
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-attempt-creation";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as DailyContentDraftGenerationLlmDispatchAttemptCreationRequest;
    const result = await buildDailyContentDraftGenerationLlmDispatchAttemptCreationResponse(body);
    return NextResponse.json({ data: result, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error instanceof Error ? error.message : "Daily content draft generation LLM dispatch attempt creation failed.", 500) },
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
