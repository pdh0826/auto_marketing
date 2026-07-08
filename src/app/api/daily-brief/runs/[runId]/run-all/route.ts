import { NextResponse } from "next/server";
import { runDailyBriefRunAll } from "@/lib/daily-brief/run-all";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    runId: string;
  };
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const result = await runDailyBriefRunAll(params.runId);
    if (!result.ok) {
      return NextResponse.json({ error: "daily_brief_not_ready", data: result }, { status: 400 });
    }
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Daily brief run-all failed.", 500) }, { status: 400 });
  }
}
