import { createDailyBriefCapture } from "@/lib/daily-brief/capture";
import { buildDailyBriefGenerationReadiness, createDailyBriefContentItem } from "@/lib/daily-brief/content";
import { collectDailyBriefPrewriteContext } from "@/lib/daily-brief/prewrite-context";
import { collectDailyBriefOfficialDisclosures, collectDailyBriefResearch } from "@/lib/daily-brief/research";
import { buildDailyBriefSeoTitle, getDailyBriefRun, isGenericDailyBriefSeoTitle, saveDailyBriefRun } from "@/lib/daily-brief/store";
import type { DailyBriefCapture } from "@/lib/daily-brief/types";
import { fetchEtfPicks, fetchKrStockPicks } from "@/lib/daily-brief/upsignal";

export async function runDailyBriefRunAll(runId: string) {
  const run = await getDailyBriefRun(runId);
  if (!run) {
    throw new Error("daily_brief_run_not_found");
  }
  if (run.contentItemId) {
    throw new Error("daily_brief_content_already_generated");
  }

  const stockPicks = await fetchKrStockPicks(run.stockPickLimit);
  const seoTitle = buildDailyBriefSeoTitle(run.stockPickLimit, {
    marketDate: run.marketDate,
    stockPicks
  });
  const runWithSeoTitle = isGenericDailyBriefSeoTitle(run.title, run.stockPickLimit)
    ? await saveDailyBriefRun({
        ...run,
        title: seoTitle
      })
    : run;
  const krCapture = await createDailyBriefCapture({
    runId: runWithSeoTitle.id,
    marketDate: runWithSeoTitle.marketDate,
    kind: "kr_board",
    label: `${runWithSeoTitle.marketDate} 한국장 시그널보드`,
    sourceUrl: runWithSeoTitle.krBoardUrl,
    fileName: "kr-signal-board.png",
    target: "kr_signal_board"
  });

  const stockCaptures: DailyBriefCapture[] = [];
  const updatedPicks = [...stockPicks];
  for (const pick of updatedPicks.slice(0, runWithSeoTitle.stockDetailLimit)) {
    const capture = await createDailyBriefCapture({
      runId: runWithSeoTitle.id,
      marketDate: runWithSeoTitle.marketDate,
      kind: "stock_chart",
      label: `${pick.name} 신호차트`,
      sourceUrl: pick.detailUrl,
      fileName: `${pick.code}-chart.png`,
      target: "stock_signal_chart"
    });
    pick.chartCaptureId = capture.id;
    stockCaptures.push(capture);
  }

  const etfPicks = runWithSeoTitle.includeEtfs ? await fetchEtfPicks(runWithSeoTitle.etfPickLimit) : [];
  const etfCapture = await createDailyBriefCapture({
    runId: runWithSeoTitle.id,
    marketDate: runWithSeoTitle.marketDate,
    kind: "etf_board",
    label: `${runWithSeoTitle.marketDate} ETF 시그널보드`,
    sourceUrl: runWithSeoTitle.etfBoardUrl,
    fileName: "etf-signal-board.png",
    target: "etf_signal_board"
  });
  const targetPicks = updatedPicks.slice(0, runWithSeoTitle.stockDetailLimit);
  const [researchItems, officialDisclosureItems, prewriteContextItems] = await Promise.all([
    collectDailyBriefResearch(targetPicks),
    collectDailyBriefOfficialDisclosures(targetPicks, runWithSeoTitle.marketDate),
    collectDailyBriefPrewriteContext({
      marketDate: runWithSeoTitle.marketDate,
      stockPicks: targetPicks,
      etfPicks
    })
  ]);
  const captures = [krCapture, ...stockCaptures, etfCapture];
  const prepared = await saveDailyBriefRun({
    ...runWithSeoTitle,
    status: "researched",
    stockPicks: updatedPicks,
    etfPicks,
    researchItems,
    officialDisclosureItems,
    prewriteContextItems,
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
    return {
      ok: false,
      run: prepared,
      readiness
    };
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

  return {
    ok: true,
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
  };
}
