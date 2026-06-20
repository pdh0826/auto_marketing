import { NextResponse } from "next/server";
import {
  buildDailyContentDraftGenerationExecutionGatePreviewResponse,
  type DailyContentDraftGenerationExecutionGatePreviewRequest
} from "@/lib/daily-content-plans/draft-generation-execution-gate-preview";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as DailyContentDraftGenerationExecutionGatePreviewRequest;
    const result = await buildDailyContentDraftGenerationExecutionGatePreviewResponse(body);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error instanceof Error ? error.message : "Daily content draft generation execution gate preview failed.", 500) },
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
