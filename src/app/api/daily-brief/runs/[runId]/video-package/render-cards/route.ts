import { NextResponse } from "next/server";
import { getDailyBriefRun } from "@/lib/daily-brief/store";
import { safeErrorMessage } from "@/lib/llm/redaction";
import { renderDailyBriefVideoCards } from "@/lib/video-automation/daily-brief-card-renderer";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    runId: string;
  };
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const run = await getDailyBriefRun(params.runId);
    if (!run) {
      return NextResponse.json({ error: "Daily brief run not found." }, { status: 404 });
    }
    return NextResponse.json({ data: await renderDailyBriefVideoCards(run) });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Daily brief video card render failed.") }, { status: 400 });
  }
}
