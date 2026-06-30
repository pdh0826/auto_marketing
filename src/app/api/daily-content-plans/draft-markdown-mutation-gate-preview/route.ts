import { NextResponse } from "next/server";
import {
  buildDailyContentDraftMarkdownMutationGatePreviewResponse,
  type DailyContentDraftMarkdownMutationGatePreviewRequest
} from "@/lib/daily-content-plans/draft-markdown-mutation-gate-preview";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as DailyContentDraftMarkdownMutationGatePreviewRequest;
    const result = await buildDailyContentDraftMarkdownMutationGatePreviewResponse(body);
    return NextResponse.json({ data: result, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error instanceof Error ? error.message : "Daily content draftMarkdown mutation gate preview failed.", 500) },
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
