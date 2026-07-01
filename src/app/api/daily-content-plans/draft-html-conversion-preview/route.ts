import { NextResponse } from "next/server";
import {
  buildDailyContentDraftHtmlConversionPreviewResponse,
  type DailyContentDraftHtmlConversionPreviewRequest
} from "@/lib/daily-content-plans/draft-html-conversion-preview";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as DailyContentDraftHtmlConversionPreviewRequest;
    const result = await buildDailyContentDraftHtmlConversionPreviewResponse(body);
    return NextResponse.json({ data: result, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error instanceof Error ? error.message : "Daily content draftHtml conversion preview failed.", 500) },
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
