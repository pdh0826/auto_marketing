import { NextResponse } from "next/server";
import {
  buildDailyContentDraftGenerationFinalExecutionChecklistResponse,
  type DailyContentDraftGenerationFinalExecutionChecklistRequest
} from "@/lib/daily-content-plans/draft-generation-final-execution-checklist";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as DailyContentDraftGenerationFinalExecutionChecklistRequest;
    const result = await buildDailyContentDraftGenerationFinalExecutionChecklistResponse(body);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error instanceof Error ? error.message : "Daily content draft generation final execution checklist failed.", 500) },
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
