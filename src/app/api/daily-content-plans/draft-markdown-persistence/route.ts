import { NextResponse } from "next/server";
import {
  buildDailyContentDraftMarkdownPersistenceResponse,
  type DailyContentDraftMarkdownPersistenceRequest
} from "@/lib/daily-content-plans/draft-markdown-persistence";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as DailyContentDraftMarkdownPersistenceRequest;
    const result = await buildDailyContentDraftMarkdownPersistenceResponse(body);
    return NextResponse.json({ data: result, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error instanceof Error ? error.message : "Daily content draftMarkdown persistence failed.", 500) },
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
