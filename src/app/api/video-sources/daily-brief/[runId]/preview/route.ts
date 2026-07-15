import { NextResponse } from "next/server";
import { getDailyBriefRun } from "@/lib/daily-brief/store";
import { safeErrorMessage } from "@/lib/llm/redaction";
import { buildDailyBriefVideoSourcePreview } from "@/lib/video-automation/source-collection/daily-brief-collector";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    runId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const run = await getDailyBriefRun(params.runId);
    if (!run) {
      return NextResponse.json({ error: "Daily brief run not found." }, { status: 404 });
    }
    return NextResponse.json({ data: buildDailyBriefVideoSourcePreview(run) });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Daily Brief video source preview failed.") }, { status: 400 });
  }
}
