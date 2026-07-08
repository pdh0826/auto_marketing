import { NextResponse } from "next/server";
import { collectDailyBriefResearch } from "@/lib/daily-brief/research";
import { getDailyBriefRun, saveDailyBriefRun } from "@/lib/daily-brief/store";
import { safeErrorMessage } from "@/lib/llm/redaction";

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
    if (run.stockPicks.length === 0) {
      return NextResponse.json({ error: "stock_picks_required" }, { status: 400 });
    }

    const researchItems = await collectDailyBriefResearch(run.stockPicks.slice(0, run.stockDetailLimit));
    const next = await saveDailyBriefRun({
      ...run,
      status: "researched",
      researchItems,
      sideEffectSummary: {
        ...run.sideEffectSummary,
        newsSearchRead: true
      }
    });

    return NextResponse.json({ data: next });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Daily brief research failed.", 500) }, { status: 400 });
  }
}
