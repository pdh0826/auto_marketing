import { NextResponse } from "next/server";
import { openTistoryLoginBrowser } from "@/lib/tistory/publisher-scheduler";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const contentItemId = typeof body.contentItemId === "string" ? body.contentItemId : "";
    if (!contentItemId) throw new Error("content_item_id_required");
    return NextResponse.json({ data: await openTistoryLoginBrowser(contentItemId) });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "tistory_login_browser_failed", 300) }, { status: 400 });
  }
}
