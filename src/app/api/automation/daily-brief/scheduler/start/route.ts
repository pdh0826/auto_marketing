import { NextResponse } from "next/server";
import { startDailyBriefScheduler } from "@/lib/daily-brief/scheduler";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST() {
  try {
    const status = await startDailyBriefScheduler();
    return NextResponse.json({ data: status });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Daily Brief scheduler start failed.", 500) }, { status: 400 });
  }
}
