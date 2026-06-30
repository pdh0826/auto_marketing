import { NextResponse } from "next/server";
import {
  buildDailyContentDraftGenerationLlmDispatchExecutionPlanLockResponse,
  type DailyContentDraftGenerationLlmDispatchExecutionPlanLockRequest
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-execution-plan-lock";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as DailyContentDraftGenerationLlmDispatchExecutionPlanLockRequest;
    const result = await buildDailyContentDraftGenerationLlmDispatchExecutionPlanLockResponse(body);
    return NextResponse.json({ data: result, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error instanceof Error ? error.message : "Daily content draft generation LLM dispatch execution plan lock failed.", 500) },
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
