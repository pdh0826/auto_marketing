import { NextResponse } from "next/server";
import { tickTistoryPublisherScheduler } from "@/lib/tistory/publisher-scheduler";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const data = await tickTistoryPublisherScheduler({ force: true, entryId: typeof body.entryId === "string" ? body.entryId : undefined });
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "tistory_run_now_failed", 300) }, { status: 400 });
  }
}
