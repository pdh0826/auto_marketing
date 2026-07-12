import type { Project300CategoryKind } from "@/lib/tistory/project300-voice-variation";
import {
  buildInvestmentWritingTemporalContext,
  createInvestmentWritingEvidencePack,
  type InvestmentFactEvidence,
  type InvestmentSourceReference,
  type InvestmentStockEvidence,
  type InvestmentSystemEvidence,
  type InvestmentWritingChannel
} from "./investment-writing-contract";
import type { DailyBriefEtfPick, DailyBriefOfficialDisclosureItem, DailyBriefPrewriteContextItem, DailyBriefResearchItem, DailyBriefStockPick } from "./types";

export function buildDailyBriefInvestmentEvidencePack(input: {
  channel: InvestmentWritingChannel;
  categoryKind: Project300CategoryKind | null;
  marketDate: string;
  generatedAt?: string;
  stocks: DailyBriefStockPick[];
  etfs: DailyBriefEtfPick[];
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

  const stocks = input.stocks.map((pick) => buildStockEvidence(pick, input, internalEditorNotes));
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
    unresolvedIssues,
    internalEditorNotes
  });
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
