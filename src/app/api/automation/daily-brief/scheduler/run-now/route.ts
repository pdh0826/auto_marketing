import { NextResponse } from "next/server";
import { tickDailyBriefScheduler } from "@/lib/daily-brief/scheduler";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await tickDailyBriefScheduler({ force: true, regenerate: body.regenerate === true });
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Daily Brief scheduler run-now failed.", 500) }, { status: 400 });
  }
}
