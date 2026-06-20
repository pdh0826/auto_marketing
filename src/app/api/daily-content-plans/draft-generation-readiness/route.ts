import { NextResponse } from "next/server";
import {
  buildDailyContentDraftGenerationReadinessResponse,
  type DailyContentDraftGenerationReadinessRequest
} from "@/lib/daily-content-plans/draft-generation-readiness";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as DailyContentDraftGenerationReadinessRequest;
    const result = await buildDailyContentDraftGenerationReadinessResponse(body);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Daily content draft generation readiness preflight failed.", 500) }, { status: 400 });
  }
}

async function parseJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
