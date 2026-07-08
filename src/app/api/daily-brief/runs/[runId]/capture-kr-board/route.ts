import { NextResponse } from "next/server";
import { createDailyBriefCapture } from "@/lib/daily-brief/capture";
import { getDailyBriefRun, saveDailyBriefRun } from "@/lib/daily-brief/store";
import { fetchKrStockPicks } from "@/lib/daily-brief/upsignal";
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

    const stockPicks = await fetchKrStockPicks(run.stockPickLimit);
    const capture = await createDailyBriefCapture({
      runId: run.id,
      marketDate: run.marketDate,
      kind: "kr_board",
      label: `${run.marketDate} 한국장 시그널보드`,
      sourceUrl: run.krBoardUrl,
      fileName: "kr-signal-board.png"
    });
    const next = await saveDailyBriefRun({
      ...run,
      status: "captured",
      stockPicks,
      captures: [...run.captures.filter((item) => item.kind !== "kr_board"), capture],
      warnings: Array.from(new Set([...run.warnings, ...(capture.warning ? [capture.warning] : [])])),
      sideEffectSummary: {
        ...run.sideEffectSummary,
        upsignalRead: true
      }
    });

    return NextResponse.json({ data: next });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "KR board capture failed.", 500) }, { status: 400 });
  }
}
