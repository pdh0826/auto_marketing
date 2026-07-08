import { NextResponse } from "next/server";
import { createDailyBriefCapture } from "@/lib/daily-brief/capture";
import { getDailyBriefRun, saveDailyBriefRun } from "@/lib/daily-brief/store";
import { fetchEtfPicks } from "@/lib/daily-brief/upsignal";
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

    const etfPicks = run.includeEtfs ? await fetchEtfPicks(run.etfPickLimit) : [];
    const capture = await createDailyBriefCapture({
      runId: run.id,
      marketDate: run.marketDate,
      kind: "etf_board",
      label: `${run.marketDate} ETF 시그널보드`,
      sourceUrl: run.etfBoardUrl,
      fileName: "etf-signal-board.png"
    });
    const next = await saveDailyBriefRun({
      ...run,
      status: "captured",
      etfPicks,
      captures: [...run.captures.filter((item) => item.kind !== "etf_board"), capture],
      warnings: Array.from(new Set([...run.warnings, ...(capture.warning ? [capture.warning] : [])])),
      sideEffectSummary: {
        ...run.sideEffectSummary,
        upsignalRead: true
      }
    });

    return NextResponse.json({ data: next });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "ETF board capture failed.", 500) }, { status: 400 });
  }
}
