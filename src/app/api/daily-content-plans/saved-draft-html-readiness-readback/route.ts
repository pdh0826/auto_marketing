import { NextResponse } from "next/server";
import {
  buildDailyContentSavedDraftHtmlReadinessReadbackResponse,
  type DailyContentSavedDraftHtmlReadinessReadbackRequest
} from "@/lib/daily-content-plans/saved-draft-html-readiness-readback";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as DailyContentSavedDraftHtmlReadinessReadbackRequest;
    const result = await buildDailyContentSavedDraftHtmlReadinessReadbackResponse(body);
    return NextResponse.json({ data: result, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error instanceof Error ? error.message : "Daily content saved draftHtml readiness readback failed.", 500) },
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
