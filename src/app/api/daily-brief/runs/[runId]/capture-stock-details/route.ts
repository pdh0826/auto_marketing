import { NextResponse } from "next/server";
import { createDailyBriefCapture } from "@/lib/daily-brief/capture";
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

    const captures = [];
    const updatedPicks = [...run.stockPicks];
    for (const pick of updatedPicks.slice(0, run.stockDetailLimit)) {
      const capture = await createDailyBriefCapture({
        runId: run.id,
        marketDate: run.marketDate,
        kind: "stock_chart",
        label: `${pick.name} 신호차트`,
        sourceUrl: pick.detailUrl,
        fileName: `${pick.code}-chart.png`
      });
      pick.chartCaptureId = capture.id;
      captures.push(capture);
    }

    const next = await saveDailyBriefRun({
      ...run,
      status: "captured",
      stockPicks: updatedPicks,
      captures: [...run.captures.filter((item) => item.kind !== "stock_chart"), ...captures],
      warnings: Array.from(new Set([...run.warnings, ...captures.flatMap((capture) => (capture.warning ? [capture.warning] : []))]))
    });

    return NextResponse.json({ data: next });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Stock detail capture failed.", 500) }, { status: 400 });
  }
}
