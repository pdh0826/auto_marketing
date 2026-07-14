import { NextResponse } from "next/server";
import { getDailyBriefRun, saveDailyBriefRun } from "@/lib/daily-brief/store";
import { buildTistoryReviewOutputKey, createDailyTistorySignalReview } from "@/lib/daily-brief/tistory-signal-review";
import { normalizeDailyFuturesEditorialTrack, normalizeDailyMarketReportSession } from "@/lib/daily-brief/market-report-session";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    runId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      forceMode?: unknown;
      reportSession?: unknown;
      futuresEditorialTrack?: unknown;
    };
    const run = await getDailyBriefRun(params.runId);
    if (!run) {
      return NextResponse.json({ error: "Daily brief run not found." }, { status: 404 });
    }
    const requestedMode = typeof body.forceMode === "string" ? body.forceMode : null;
    const requestedSession = normalizeDailyMarketReportSession(body.reportSession);
    const requestedTrack = normalizeDailyFuturesEditorialTrack(body.futuresEditorialTrack);
    const outputKey = requestedMode
      ? buildTistoryReviewOutputKey(
          requestedMode as import("@/lib/daily-brief/types").DailyTistorySignalReviewMode,
          requestedSession ?? undefined,
          requestedTrack
        )
      : null;
    const existingOutput = outputKey && run.tistoryReviewOutputs ? run.tistoryReviewOutputs[outputKey] : null;
    if (existingOutput) {
      return NextResponse.json(
        {
          error: "daily_tistory_signal_review_already_generated",
          contentItemId: existingOutput.contentItemId,
          tistoryPreviewUrl: existingOutput.previewUrl,
          mode: existingOutput.mode
        },
        { status: 409 }
      );
    }

    const result = await createDailyTistorySignalReview(run, {
      forceMode: typeof body.forceMode === "string" ? body.forceMode : undefined,
      reportSession: typeof body.reportSession === "string" ? body.reportSession : undefined,
      futuresEditorialTrack: typeof body.futuresEditorialTrack === "string" ? body.futuresEditorialTrack : undefined
    });
    const next = await saveDailyBriefRun({
      ...run,
      tistoryReviewContentItemId: result.contentItemId,
      tistoryReviewExportUrl: result.tistoryExport.localPreviewUrl,
      tistoryReviewMode: result.selection.mode,
      tistoryReviewOutputs: {
        ...(run.tistoryReviewOutputs ?? {}),
        [buildTistoryReviewOutputKey(result.selection.mode, result.selection.marketReportSession, result.selection.futuresEditorialTrack)]: {
          contentItemId: result.contentItemId,
          previewUrl: result.tistoryExport.localPreviewUrl,
          mode: result.selection.mode,
          selectedStockCodes: result.selection.selectedStockCodes,
          selectedEtfCodes: result.selection.selectedEtfCodes,
          selectedFuturesSymbols: result.selection.selectedFuturesSymbols,
          marketReportSession: result.selection.marketReportSession,
          futuresEditorialTrack: result.selection.futuresEditorialTrack,
          createdAt: new Date().toISOString()
        }
      },
      warnings: Array.from(new Set([...run.warnings, ...result.selection.warnings])),
      sideEffectSummary: {
        ...run.sideEffectSummary,
        dbWrite: true,
        contentItemCreated: true,
        contentAssetCreated: result.sideEffectSummary.contentAssetCreated,
        upsignalRead: true,
        newsSearchRead: true
      }
    });

    return NextResponse.json({
      data: {
        run: next,
        ...result
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error instanceof Error ? error.message : "Daily Tistory signal review generation failed.", 500) },
      { status: 400 }
    );
  }
}
