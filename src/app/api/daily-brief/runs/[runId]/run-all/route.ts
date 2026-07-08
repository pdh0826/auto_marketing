import { NextResponse } from "next/server";
import { createDailyBriefCapture } from "@/lib/daily-brief/capture";
import { buildDailyBriefGenerationReadiness, createDailyBriefContentItem } from "@/lib/daily-brief/content";
import { collectDailyBriefResearch } from "@/lib/daily-brief/research";
import { getDailyBriefRun, saveDailyBriefRun } from "@/lib/daily-brief/store";
import type { DailyBriefCapture } from "@/lib/daily-brief/types";
import { fetchEtfPicks, fetchKrStockPicks } from "@/lib/daily-brief/upsignal";
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
    if (run.contentItemId) {
      return NextResponse.json({ error: "daily_brief_content_already_generated", contentItemId: run.contentItemId }, { status: 409 });
    }

    const stockPicks = await fetchKrStockPicks(run.stockPickLimit);
    const krCapture = await createDailyBriefCapture({
      runId: run.id,
      marketDate: run.marketDate,
      kind: "kr_board",
      label: `${run.marketDate} 한국장 시그널보드`,
      sourceUrl: run.krBoardUrl,
      fileName: "kr-signal-board.png",
      target: "kr_signal_board"
    });

    const stockCaptures: DailyBriefCapture[] = [];
    const updatedPicks = [...stockPicks];
    for (const pick of updatedPicks.slice(0, run.stockDetailLimit)) {
      const capture = await createDailyBriefCapture({
        runId: run.id,
        marketDate: run.marketDate,
        kind: "stock_chart",
        label: `${pick.name} 신호차트`,
        sourceUrl: pick.detailUrl,
        fileName: `${pick.code}-chart.png`,
        target: "stock_signal_chart"
      });
      pick.chartCaptureId = capture.id;
      stockCaptures.push(capture);
    }

    const etfPicks = run.includeEtfs ? await fetchEtfPicks(run.etfPickLimit) : [];
    const etfCapture = await createDailyBriefCapture({
      runId: run.id,
      marketDate: run.marketDate,
      kind: "etf_board",
      label: `${run.marketDate} ETF 시그널보드`,
      sourceUrl: run.etfBoardUrl,
      fileName: "etf-signal-board.png",
      target: "etf_signal_board"
    });
    const researchItems = await collectDailyBriefResearch(updatedPicks.slice(0, run.stockDetailLimit));
    const captures = [krCapture, ...stockCaptures, etfCapture];
    const prepared = await saveDailyBriefRun({
      ...run,
      status: "researched",
      stockPicks: updatedPicks,
      etfPicks,
      researchItems,
      captures,
      warnings: Array.from(new Set([...run.warnings, ...captures.flatMap((capture) => (capture.warning ? [capture.warning] : []))])),
      sideEffectSummary: {
        ...run.sideEffectSummary,
        upsignalRead: true,
        newsSearchRead: true
      }
    });
    const readiness = buildDailyBriefGenerationReadiness(prepared);
    if (!readiness.ready) {
      return NextResponse.json({ error: "daily_brief_not_ready", data: { run: prepared, readiness } }, { status: 400 });
    }

    const result = await createDailyBriefContentItem(prepared);
    const next = await saveDailyBriefRun({
      ...prepared,
      status: "content_generated",
      contentItemId: result.contentItem.id,
      draftMarkdownLength: result.markdown.length,
      draftHtmlLength: result.html.length,
      visibleTextLength: result.htmlPreview.validationSummary.visibleTextLength,
      warnings: Array.from(new Set([...prepared.warnings, ...readiness.warnings, ...result.htmlPreview.validationSummary.warnings])),
      sideEffectSummary: {
        ...prepared.sideEffectSummary,
        dbWrite: true,
        contentItemCreated: true,
        contentAssetCreated: result.assets.length > 0
      }
    });

    return NextResponse.json({
      data: {
        run: next,
        contentItemId: result.contentItem.id,
        draftMarkdownLength: result.markdown.length,
        draftHtmlLength: result.html.length,
        visibleTextLength: result.htmlPreview.validationSummary.visibleTextLength,
        quality: {
          ready: result.quality.ready,
          grade: result.quality.grade,
          scorePreview: result.quality.scorePreview
        },
        readiness,
        sideEffectSummary: next.sideEffectSummary,
        links: {
          editWizard: `/wizard/edit/${result.contentItem.id}`,
          publishWizard: `/wizard/publish/${result.contentItem.id}`,
          contentDetail: `/content/${result.contentItem.id}`
        }
      }
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Daily brief run-all failed.", 500) }, { status: 400 });
  }
}
