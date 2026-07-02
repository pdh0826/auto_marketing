import { NextResponse } from "next/server";
import {
  buildDailyContentDraftHtmlFinanceRiskRepairPreviewResponse,
  type DailyContentDraftHtmlFinanceRiskRepairPreviewRequest
} from "@/lib/daily-content-plans/draft-html-finance-risk-repair-preview";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as DailyContentDraftHtmlFinanceRiskRepairPreviewRequest;
    const result = await buildDailyContentDraftHtmlFinanceRiskRepairPreviewResponse(body);
    return NextResponse.json({ data: result, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error instanceof Error ? error.message : "Daily content draftHtml finance-risk repair preview failed.", 500) },
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
