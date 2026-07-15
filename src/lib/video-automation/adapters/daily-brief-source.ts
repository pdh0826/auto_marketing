import type { DailyBriefRun } from "@/lib/daily-brief/types";
import { buildVideoSourceSideEffects, buildVideoSourceSnapshot, compactParts } from "../core/source-bundle";
import { buildSafeVisualMaterial, buildTextCardMaterial } from "../core/visual-materials";
import type { VideoInsight, VideoSourceBundle, VideoSourceProvenance } from "../core/types";

export function buildDailyBriefVideoSourceBundle(run: DailyBriefRun): VideoSourceBundle {
  const insights = buildDailyBriefInsights(run);
  const visualMaterials = [
    ...run.captures.map((capture) =>
      buildSafeVisualMaterial({
        id: `capture-${capture.id}`,
        kind: capture.kind === "stock_chart" ? "chart" : "capture",
        title: capture.label,
        description: compactParts([capture.kind, capture.target, capture.mode]),
        sourceRef: capture.id,
        fileName: capture.fileName,
        mimeType: capture.mimeType,
        width: capture.width,
        height: capture.height,
        safeForPublicUse: true
      })
    ),
    ...insights.slice(0, 6).map((insight) =>
      buildTextCardMaterial({
        id: `text-card-${insight.id}`,
        title: insight.title,
        description: insight.summary,
        sourceRef: insight.id
      })
    )
  ];
  const provenance = buildDailyBriefProvenance(run);
  const sourceInput = buildDailyBriefSourceInput(run, insights, visualMaterials, provenance);
  const sourceSnapshot = buildVideoSourceSnapshot({
    sourceInput,
    includedFields: [
      "Daily Brief run identity/status/date/title/keyword",
      "content generation lengths and content item references",
      "stock/ETF/futures insight display fields",
      "research/disclosure/prewrite summaries",
      "capture safe visual metadata without storagePath",
      "safe side-effect summary"
    ],
    excludedFields: [
      "generatedAt",
      "local output file bytes",
      "local outputDirectory",
      "capture storagePath",
      "content asset storagePath",
      "any env/secret/token material"
    ]
  });
  return {
    sourceType: "daily_brief",
    sourceId: run.id,
    title: run.title,
    summary: buildDailyBriefSummary(run),
    language: "ko",
    sourceSnapshot,
    provenance,
    insights,
    visualMaterials,
    riskNotes: ["이 콘텐츠는 정보 제공 목적이며 투자 조언이 아닙니다. 최종 판단과 책임은 투자자 본인에게 있습니다."],
    sideEffectSummary: buildVideoSourceSideEffects()
  };
}

function buildDailyBriefInsights(run: DailyBriefRun): VideoInsight[] {
  const insights: VideoInsight[] = [];
  for (const pick of run.stockPicks.slice(0, 6)) {
    const score = compactParts([pick.totalScore ? `종합 점수 ${pick.totalScore}` : null, pick.trendScore ? `추세 ${pick.trendScore}` : null]);
    const price = compactParts([
      pick.currentPrice ? `현재가 ${pick.currentPrice}` : null,
      pick.entryPrice ? `진입 기준 ${pick.entryPrice}` : null,
      pick.targetPrice ? `목표 ${pick.targetPrice}` : null,
      pick.stopLoss ? `손절 ${pick.stopLoss}` : null
    ]);
    insights.push({
      id: `stock-${pick.code}`,
      priority: pick.rank,
      title: `${pick.rank}순위 ${pick.name}`,
      summary: compactParts([pick.market, pick.statusLabel, score, price]) || `${pick.name}의 시그널을 확인합니다.`,
      evidenceText: compactParts([`종목코드 ${pick.code}`, pick.recentSignalDate ? `최근 신호 ${pick.recentSignalDate}` : null, pick.detailUrl]),
      sourceRefs: [pick.chartCaptureId ?? `stock-${pick.code}`],
      tags: ["stock", pick.market, pick.statusLabel ?? "status_unknown"].filter(Boolean)
    });
  }
  for (const pick of run.etfPicks.slice(0, 3)) {
    insights.push({
      id: `etf-${pick.code}`,
      priority: 100 + pick.rank,
      title: `ETF ${pick.name}`,
      summary: compactParts([pick.category, pick.statusLabel, pick.currentPrice ? `현재가 ${pick.currentPrice}` : null, pick.currentReturn ? `수익률 ${pick.currentReturn}` : null, pick.totalScore ? `점수 ${pick.totalScore}` : null]),
      evidenceText: compactParts([pick.recentBuyDate ? `최근 매수 ${pick.recentBuyDate}` : null, pick.targetPotential ? `목표 여력 ${pick.targetPotential}` : null]),
      sourceRefs: ["etf-board"],
      tags: ["etf", pick.category ?? "category_unknown"]
    });
  }
  for (const pick of (run.futuresPicks ?? []).slice(0, 2)) {
    insights.push({
      id: `futures-${pick.symbol}`,
      priority: 200 + pick.rank,
      title: `선물 ${pick.name}`,
      summary: compactParts([pick.strategyName, pick.timeframe, pick.marketState, pick.signalLabel, pick.changeRate]),
      evidenceText: compactParts([pick.sourceName, pick.observedAtLabel, pick.sourceUrl]),
      sourceRefs: [`futures-${pick.symbol}`],
      tags: ["futures", pick.exchange, pick.strategyStatus ?? "strategy_unknown"].filter(Boolean)
    });
  }
  run.researchItems.slice(0, 4).forEach((item, index) => {
    insights.push({
      id: `research-${index + 1}-${item.symbolCode}`,
      priority: 300 + index,
      title: `${item.symbolName} 뉴스`,
      summary: item.shortSummary || item.title,
      evidenceText: compactParts([item.sourceName, item.publishedAt, item.url]),
      sourceRefs: [`research-${index + 1}`],
      tags: ["research", item.symbolCode]
    });
  });
  run.officialDisclosureItems.slice(0, 3).forEach((item, index) => {
    insights.push({
      id: `disclosure-${index + 1}-${item.symbolCode}`,
      priority: 400 + index,
      title: `${item.symbolName} 공시`,
      summary: item.shortSummary || item.title,
      evidenceText: compactParts([item.sourceName, item.publishedAt, item.receiptNo, item.url]),
      sourceRefs: [`disclosure-${index + 1}`],
      tags: ["disclosure", item.symbolCode]
    });
  });
  run.prewriteContextItems.slice(0, 4).forEach((item, index) => {
    insights.push({
      id: `context-${index + 1}`,
      priority: 500 + index,
      title: item.title,
      summary: item.summary,
      evidenceText: compactParts([item.sourceName, item.publishedAt ?? null, item.url ?? null, item.confidence]),
      sourceRefs: [`context-${index + 1}`],
      tags: ["context", item.kind, item.confidence]
    });
  });
  return insights;
}

function buildDailyBriefProvenance(run: DailyBriefRun): VideoSourceProvenance[] {
  return [
    {
      id: run.id,
      kind: "run",
      title: run.title,
      sourceName: "Daily Brief",
      url: null,
      publishedAt: run.updatedAt
    },
    ...run.researchItems.slice(0, 6).map((item, index) => ({
      id: `research-${index + 1}`,
      kind: "research" as const,
      title: item.title,
      sourceName: item.sourceName ?? item.source,
      url: item.url,
      publishedAt: item.publishedAt
    })),
    ...run.officialDisclosureItems.slice(0, 4).map((item, index) => ({
      id: `disclosure-${index + 1}`,
      kind: "disclosure" as const,
      title: item.title,
      sourceName: item.sourceName,
      url: item.url,
      publishedAt: item.publishedAt
    }))
  ];
}

function buildDailyBriefSourceInput(
  run: DailyBriefRun,
  insights: VideoInsight[],
  visualMaterials: VideoSourceBundle["visualMaterials"],
  provenance: VideoSourceProvenance[]
) {
  return {
    sourceType: "daily_brief",
    sourceId: run.id,
    status: run.status,
    marketDate: run.marketDate,
    title: run.title,
    targetKeyword: run.targetKeyword,
    contentItemId: run.contentItemId,
    tistoryReviewContentItemId: run.tistoryReviewContentItemId ?? null,
    tistoryReviewMode: run.tistoryReviewMode ?? null,
    draftMarkdownLength: run.draftMarkdownLength,
    draftHtmlLength: run.draftHtmlLength,
    visibleTextLength: run.visibleTextLength,
    warnings: run.warnings,
    sideEffectSummary: run.sideEffectSummary,
    insights,
    visualMaterials,
    provenance
  };
}

function buildDailyBriefSummary(run: DailyBriefRun) {
  return compactParts([
    run.marketDate,
    `${run.stockPicks.length} stock picks`,
    `${run.etfPicks.length} ETF picks`,
    `${run.futuresPicks?.length ?? 0} futures picks`,
    `${run.researchItems.length} research items`,
    `${run.captures.length} captures`
  ]);
}
