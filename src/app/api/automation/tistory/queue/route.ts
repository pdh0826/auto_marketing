import { NextResponse } from "next/server";
import { enqueueTistoryPublish } from "@/lib/tistory/publisher-scheduler";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const data = await enqueueTistoryPublish({
      contentItemId: typeof body.contentItemId === "string" ? body.contentItemId : "",
      dueAt: typeof body.dueAt === "string" ? body.dueAt : "",
      approved: body.approved === true
    });
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "tistory_enqueue_failed", 300) }, { status: 400 });
  }
}
