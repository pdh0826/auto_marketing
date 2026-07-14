import type { Project300CategoryKind } from "@/lib/tistory/project300-voice-variation";
import {
  buildInvestmentWritingTemporalContext,
  createInvestmentWritingEvidencePack,
  type InvestmentFactEvidence,
  type InvestmentFuturesEvidence,
  type InvestmentSourceReference,
  type InvestmentStockEvidence,
  type InvestmentSystemEvidence,
  type InvestmentWritingChannel
} from "./investment-writing-contract";
import type {
  DailyBriefEtfPick,
  DailyBriefFuturesPick,
  DailyBriefOfficialDisclosureItem,
  DailyBriefPrewriteContextItem,
  DailyBriefResearchItem,
  DailyBriefStockPick
} from "./types";
import type { DailyForeignMarketFlowSnapshot } from "./market-flow";

export function buildDailyBriefInvestmentEvidencePack(input: {
  channel: InvestmentWritingChannel;
  categoryKind: Project300CategoryKind | null;
  marketDate: string;
  generatedAt?: string;
  stocks: DailyBriefStockPick[];
  etfs: DailyBriefEtfPick[];
  futures?: DailyBriefFuturesPick[];
  marketFlow?: DailyForeignMarketFlowSnapshot | null;
  researchItems: DailyBriefResearchItem[];
  disclosureItems: DailyBriefOfficialDisclosureItem[];
  prewriteContextItems: DailyBriefPrewriteContextItem[];
}) {
  const temporalContext = buildInvestmentWritingTemporalContext({ dataDate: input.marketDate, generatedAt: input.generatedAt });
  const internalEditorNotes: string[] = [];
  const unresolvedIssues: string[] = [];
  const marketFacts = input.prewriteContextItems.flatMap((item, index) => {
    if (item.kind !== "market_kr_flow" && item.kind !== "market_us_flow") {
      if (item.kind === "market_supply") {
        internalEditorNotes.push(`market_supply_requires_primary_source:${item.title}`);
      }
      return [];
    }
    if (!item.url || item.confidence === "low") {
      internalEditorNotes.push(`market_context_not_publishable:${item.title}`);
    }
    return [
      factEvidence({
        id: `market-${index}`,
        field: item.kind,
        value: item.summary,
        sourceName: item.sourceName,
        url: item.url ?? null,
        observedAt: input.generatedAt ?? null,
        publishedAt: item.publishedAt ?? null,
        confidence: item.confidence,
        publishable: Boolean(item.url) && item.confidence !== "low"
      })
    ];
  });
  if (input.marketFlow?.ready) {
    const flowSource = {
      sourceName: input.marketFlow.sourceName,
      url: input.marketFlow.sourceUrl,
      observedAt: input.marketFlow.observedAt,
      publishedAt: null
    };
    for (const [field, value] of [
      ["foreign_spot_net", input.marketFlow.foreignSpotNet],
      ["foreign_futures_net", input.marketFlow.foreignFuturesNet],
      ["foreign_call_options_net", input.marketFlow.foreignCallOptionsNet],
      ["foreign_put_options_net", input.marketFlow.foreignPutOptionsNet]
    ] as const) {
      if (!value) continue;
      marketFacts.push({
        id: `market-flow-${field}`,
        informationClass: "FACT",
        subjectCode: "KOREA_MARKET",
        subjectName: "한국장 외국인 수급",
        field,
        value,
        source: flowSource,
        confidence: "high",
        publishable: true,
        editorNote: null
      });
    }
  } else if (input.marketFlow) {
    internalEditorNotes.push(...input.marketFlow.warnings.map((warning) => `optional_market_flow_omitted:${warning}`));
  }

  const stocks = input.stocks.map((pick) => buildStockEvidence(pick, input, internalEditorNotes));
  const futures = (input.futures ?? []).map((pick, index) => buildFuturesEvidence(pick, input, index));
  const etfs = input.etfs.map((pick, index) => ({
    code: pick.code,
    name: normalizeName(pick.name),
    category: pick.category,
    facts: [
      factEvidence({
        id: `etf-${index}-current-price`,
        subjectCode: pick.code,
        subjectName: normalizeName(pick.name),
        field: "current_price",
        value: pick.currentPrice ?? "unknown",
        sourceName: "급등포착 ETF 시그널보드",
        url: "https://upsignal.co.kr/etf/summary",
        observedAt: input.generatedAt ?? null,
        publishedAt: pick.recentBuyDate,
        confidence: pick.currentPrice ? "high" : "low",
        publishable: Boolean(pick.currentPrice)
      })
    ],
    systemValues: [
      systemEvidence(`etf-${index}-score`, pick.code, normalizeName(pick.name), "score", pick.totalScore, "provider_defined", "급등포착 ETF 시그널보드"),
      systemEvidence(`etf-${index}-signal`, pick.code, normalizeName(pick.name), "signal", pick.recentBuyDate, "provider_defined", "급등포착 ETF 시그널보드")
    ].filter((item): item is InvestmentSystemEvidence => Boolean(item)),
    unresolvedIssues: pick.currentPrice ? [] : ["etf_current_price_missing"]
  }));

  if (temporalContext.marketSessionState === "unknown") {
    unresolvedIssues.push("market_session_state_not_verified");
  }
  if (!temporalContext.nextTradingDateVerified) {
    internalEditorNotes.push(`next_trading_date_not_verified:${temporalContext.nextWeekdayCandidate}`);
  }

  return createInvestmentWritingEvidencePack({
    channel: input.channel,
    categoryKind: input.categoryKind,
    temporalContext,
    marketFacts,
    stocks,
    etfs,
    futures,
    unresolvedIssues,
    internalEditorNotes
  });
}

function buildFuturesEvidence(
  pick: DailyBriefFuturesPick,
  input: Parameters<typeof buildDailyBriefInvestmentEvidencePack>[0],
  index: number
): InvestmentFuturesEvidence {
  const source: InvestmentSourceReference = {
    sourceName: "급등포착 선물 시그널보드",
    url: pick.sourceUrl,
    observedAt: input.generatedAt ?? null,
    publishedAt: pick.observedAtLabel
  };
  const facts: InvestmentFactEvidence[] = [];
  const systemValues: InvestmentSystemEvidence[] = [];
  const unresolvedIssues: string[] = [...pick.warnings];

  if (pick.currentValue) {
    facts.push({
      id: `${pick.symbol}-futures-current`,
      informationClass: "FACT",
      subjectCode: pick.symbol,
      subjectName: pick.name,
      field: "current_value",
      value: pick.changeRate ? `${pick.currentValue} (${pick.changeRate})` : pick.currentValue,
      source,
      confidence: pick.dataReady ? "high" : "low",
      publishable: pick.dataReady,
      editorNote: pick.dataReady ? null : "futures_value_requires_refresh"
    });
  } else {
    unresolvedIssues.push("futures_current_value_missing");
  }

  for (const item of [
    systemEvidence(`${pick.symbol}-futures-strategy`, pick.symbol, pick.name, "signal", pick.strategyName, "provider_defined", source.sourceName, pick.sourceUrl),
    systemEvidence(`${pick.symbol}-futures-position`, pick.symbol, pick.name, "status", pick.currentPosition, "provider_defined", source.sourceName, pick.sourceUrl),
    systemEvidence(`${pick.symbol}-futures-confidence`, pick.symbol, pick.name, "score", pick.confidence, "provider_defined", source.sourceName, pick.sourceUrl),
    systemEvidence(`${pick.symbol}-futures-market-state`, pick.symbol, pick.name, "other", pick.marketState, "provider_defined", source.sourceName, pick.sourceUrl),
    systemEvidence(`${pick.symbol}-futures-entry`, pick.symbol, pick.name, "entry_price", pick.entryValue, "chart_level", source.sourceName, pick.sourceUrl),
    systemEvidence(`${pick.symbol}-futures-realized`, pick.symbol, pick.name, "other", pick.realizedProfit, "provider_defined", source.sourceName, pick.sourceUrl)
  ]) {
    if (item) systemValues.push(item);
  }

  if (pick.upperLevels.length) {
    systemValues.push(
      systemEvidence(`${pick.symbol}-futures-upper-levels`, pick.symbol, pick.name, "target_price", pick.upperLevels.join(" / "), "chart_level", source.sourceName, pick.sourceUrl)!
    );
  }
  if (pick.lowerLevels.length) {
    systemValues.push(
      systemEvidence(`${pick.symbol}-futures-lower-levels`, pick.symbol, pick.name, "stop_loss", pick.lowerLevels.join(" / "), "chart_level", source.sourceName, pick.sourceUrl)!
    );
  }
  if (!pick.dataReady) unresolvedIssues.push(`futures_not_ready:${pick.symbol}`);

  return {
    symbol: pick.symbol,
    name: pick.name,
    exchange: pick.exchange,
    facts,
    systemValues,
    unresolvedIssues: Array.from(new Set(unresolvedIssues))
  };
}

function buildStockEvidence(
  pick: DailyBriefStockPick,
  input: Parameters<typeof buildDailyBriefInvestmentEvidencePack>[0],
  internalEditorNotes: string[]
): InvestmentStockEvidence {
  const name = normalizeName(pick.name);
  const facts: InvestmentFactEvidence[] = [];
  const systemValues: InvestmentSystemEvidence[] = [];
  const unresolvedIssues: string[] = [];
  const source: InvestmentSourceReference = {
    sourceName: "급등포착 종목 신호 화면",
    url: pick.detailUrl,
    observedAt: input.generatedAt ?? null,
    publishedAt: pick.recentSignalDate
  };

  if (pick.currentPrice) {
    facts.push({
      id: `${pick.code}-current-price`,
      informationClass: "FACT",
      subjectCode: pick.code,
      subjectName: name,
      field: "current_price",
      value: pick.currentPrice,
      source,
      confidence: "high",
      publishable: true,
      editorNote: null
    });
  } else {
    unresolvedIssues.push("stock_current_price_missing");
  }

  for (const item of [
    systemEvidence(`${pick.code}-status`, pick.code, name, "status", pick.statusLabel, "provider_defined", source.sourceName, pick.detailUrl),
    systemEvidence(`${pick.code}-entry`, pick.code, name, "entry_price", pick.entryPrice, "unknown", source.sourceName, pick.detailUrl),
    systemEvidence(`${pick.code}-target`, pick.code, name, "target_price", pick.targetPrice, "unknown", source.sourceName, pick.detailUrl),
    systemEvidence(`${pick.code}-stop`, pick.code, name, "stop_loss", pick.stopLoss, "unknown", source.sourceName, pick.detailUrl),
    systemEvidence(`${pick.code}-score`, pick.code, name, "score", pick.totalScore, "provider_defined", source.sourceName, pick.detailUrl),
    systemEvidence(`${pick.code}-signal`, pick.code, name, "signal", pick.recentSignalDate, "provider_defined", source.sourceName, pick.detailUrl)
  ]) {
    if (item) systemValues.push(item);
  }

  const research = input.researchItems.filter((item) => item.symbolCode === pick.code);
  const disclosures = input.disclosureItems.filter((item) => item.symbolCode === pick.code);
  research.forEach((item, index) => {
    if (!item.url || !item.title || !item.sourceName) {
      internalEditorNotes.push(`research_source_incomplete:${pick.code}:${index}`);
      return;
    }
    facts.push(
      factEvidence({
        id: `${pick.code}-research-${index}`,
        subjectCode: pick.code,
        subjectName: name,
        field: "news_headline",
        value: item.title,
        sourceName: item.sourceName,
        url: item.url,
        observedAt: input.generatedAt ?? null,
        publishedAt: item.publishedAt,
        confidence: item.publishedAt ? "high" : "medium",
        publishable: true
      })
    );
  });
  disclosures.forEach((item, index) => {
    facts.push(
      factEvidence({
        id: `${pick.code}-disclosure-${index}`,
        subjectCode: pick.code,
        subjectName: name,
        field: "official_disclosure",
        value: item.title,
        sourceName: item.sourceName,
        url: item.url,
        observedAt: input.generatedAt ?? null,
        publishedAt: item.publishedAt,
        confidence: "high",
        publishable: Boolean(item.url && item.title)
      })
    );
  });

  if (!research.length) internalEditorNotes.push(`news_not_verified:${pick.code}`);
  if (!disclosures.length) internalEditorNotes.push(`disclosure_not_verified:${pick.code}`);

  return {
    code: pick.code,
    name,
    market: pick.market,
    sector: null,
    theme: inferTheme(name),
    facts,
    systemValues,
    unresolvedIssues
  };
}

function factEvidence(input: {
  id: string;
  subjectCode?: string | null;
  subjectName?: string | null;
  field: string;
  value: string;
  sourceName: string;
  url: string | null;
  observedAt: string | null;
  publishedAt: string | null;
  confidence: "high" | "medium" | "low";
  publishable: boolean;
}): InvestmentFactEvidence {
  return {
    id: input.id,
    informationClass: "FACT",
    subjectCode: input.subjectCode ?? null,
    subjectName: input.subjectName ?? null,
    field: input.field,
    value: input.value,
    source: {
      sourceName: input.sourceName,
      url: input.url,
      observedAt: input.observedAt,
      publishedAt: input.publishedAt
    },
    confidence: input.confidence,
    publishable: input.publishable,
    editorNote: input.publishable ? null : "editor_review_only"
  };
}

function systemEvidence(
  id: string,
  subjectCode: string,
  subjectName: string,
  field: InvestmentSystemEvidence["field"],
  value: string | null,
  basis: InvestmentSystemEvidence["basis"],
  sourceName: string,
  url = "https://upsignal.co.kr"
): InvestmentSystemEvidence | null {
  if (!value?.trim()) return null;
  return {
    id,
    informationClass: "SYSTEM",
    subjectCode,
    subjectName,
    field,
    value: value.trim(),
    basis,
    source: { sourceName, url, observedAt: null, publishedAt: null },
    publishable: true,
    editorNote: basis === "unknown" ? "system_value_basis_requires_confirmation" : null
  };
}

function normalizeName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function inferTheme(name: string) {
  if (/금융|은행|지주|증권|보험/.test(name)) return "금융주";
  if (/콜마|화장품|뷰티/.test(name)) return "화장품·소비재";
  if (/항공|여행|레저/.test(name)) return "항공·여행";
  if (/반도체|테크|AI|전자/.test(name)) return "반도체·테크";
  return "개별 종목";
}
