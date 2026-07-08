import { NextResponse } from "next/server";
import { stopDailyBriefScheduler } from "@/lib/daily-brief/scheduler";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST() {
  try {
    const status = await stopDailyBriefScheduler();
    return NextResponse.json({ data: status });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Daily Brief scheduler stop failed.", 500) }, { status: 400 });
  }
}
