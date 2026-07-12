import { NextResponse } from "next/server";
import { getDailyBriefRun, saveDailyBriefRun } from "@/lib/daily-brief/store";
import { createDailyTistorySignalReview } from "@/lib/daily-brief/tistory-signal-review";
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
    };
    const run = await getDailyBriefRun(params.runId);
    if (!run) {
      return NextResponse.json({ error: "Daily brief run not found." }, { status: 404 });
    }
    const requestedMode = typeof body.forceMode === "string" ? body.forceMode : null;
    const existingOutput = requestedMode && run.tistoryReviewOutputs ? run.tistoryReviewOutputs[requestedMode as keyof typeof run.tistoryReviewOutputs] : null;
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
      forceMode: typeof body.forceMode === "string" ? body.forceMode : undefined
    });
    const next = await saveDailyBriefRun({
      ...run,
      tistoryReviewContentItemId: result.contentItemId,
      tistoryReviewExportUrl: result.tistoryExport.localPreviewUrl,
      tistoryReviewMode: result.selection.mode,
      tistoryReviewOutputs: {
        ...(run.tistoryReviewOutputs ?? {}),
        [result.selection.mode]: {
          contentItemId: result.contentItemId,
          previewUrl: result.tistoryExport.localPreviewUrl,
          mode: result.selection.mode,
          selectedStockCodes: result.selection.selectedStockCodes,
          selectedEtfCodes: result.selection.selectedEtfCodes,
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
