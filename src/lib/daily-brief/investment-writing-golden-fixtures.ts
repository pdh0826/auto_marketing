import { createInvestmentJudgmentLedger } from "./investment-writing-contract";
import { buildDailyBriefInvestmentEvidencePack } from "./investment-writing-evidence";
import { buildInvestmentWritingOutline } from "./investment-writing-outline";
import { getInvestmentWritingTargetCoverage, runInvestmentWritingOrchestrator } from "./investment-writing-orchestrator";
import { validateInvestmentWritingEvidencePack } from "./investment-writing-preflight";
import { renderProject300InvestmentPost } from "./project300-investment-renderer";
import { reviewInvestmentWritingDraft } from "./investment-writing-review";
import { selectTistorySignalReviewCandidates } from "./tistory-signal-review";
import type { DailyBriefEtfPick, DailyBriefStockPick } from "./types";

export const INVESTMENT_WRITING_GOLDEN_FIXTURE_VERSION = "investment_writing_golden_fixture_v1";

export function runInvestmentWritingGoldenFixtures() {
  const stocks = [
    stock(1, "하나금융지주", "086790", "128,500", "126,573", "145,400", "122,075", "88.6"),
    stock(2, "신한지주", "055550", "107,300", "105,691", "122,400", "101,935", "84.3"),
    stock(3, "한국콜마", "161890", "102,800", "101,258", "122,000", "97,660", "88.8")
  ];
  const evidencePack = buildDailyBriefInvestmentEvidencePack({
    channel: "project300_tistory",
    categoryKind: "focused_signal_review",
    marketDate: "2026-07-10",
    generatedAt: "2026-07-12T03:00:00.000Z",
    stocks,
    etfs: [],
    researchItems: [
      {
        symbolCode: "161890",
        symbolName: "한국콜마",
        query: "한국콜마 최근 뉴스",
        searchUrl: "https://example.com/search",
        title: "한국콜마 실적과 수출 흐름 점검",
        source: "fixture",
        sourceName: "골든 fixture 경제지",
        publishedAt: "2026-07-10T00:00:00.000Z",
        url: "https://example.com/news/kolmar",
        shortSummary: "fixture"
      }
    ],
    disclosureItems: [],
    prewriteContextItems: []
  });
  const ledger = createInvestmentJudgmentLedger({
    firstImpression: "금융주가 함께 올라왔으니 둘을 따로 반복해서 보기보다 차이를 비교합니다.",
    mainConcern: "다음 거래일에 가격이 크게 뜨면 따라가지 않습니다.",
    revisitConditions: ["금융주 중 거래가 더 붙는 종목을 다시 봅니다."],
    exclusionConditions: ["시스템 기준 가격 아래로 밀리면 기존 해석을 다시 검토합니다."]
  });
  const preflight = validateInvestmentWritingEvidencePack(evidencePack);
  const outline = buildInvestmentWritingOutline({ evidencePack, judgmentLedger: ledger, preflight });
  const markdown = renderProject300InvestmentPost({
    title: "하나금융·신한지주 둘 다 볼 필요가 있을까 | 2026.07.10 급등포착",
    evidencePack,
    judgmentLedger: ledger,
    outline,
    stocks,
    etfs: [],
    researchItems: [
      {
        symbolCode: "161890",
        symbolName: "한국콜마",
        query: "fixture",
        searchUrl: "https://example.com/search",
        title: "한국콜마 실적과 수출 흐름 점검",
        source: "fixture",
        sourceName: "골든 fixture 경제지",
        publishedAt: "2026-07-10T00:00:00.000Z",
        url: "https://example.com/news/kolmar",
        shortSummary: "fixture"
      }
    ],
    disclosureItems: [],
    heroMedia: "> fixture hero image",
    stockMediaByCode: new Map(stocks.map((item) => [item.code, `> fixture ${item.name} chart`])),
    etfMedia: null
  });
  const review = reviewInvestmentWritingDraft({ markdown, subjectNames: stocks.map((item) => item.name), judgmentLedger: ledger, outline });
  const orchestrated = runInvestmentWritingOrchestrator({
    target: "tistory_focused_signal_review",
    title: "하나금융·신한지주 둘 다 볼 필요가 있을까 | 2026.07.10 급등포착",
    marketDate: "2026-07-10",
    generatedAt: "2026-07-12T03:00:00.000Z",
    stocks,
    etfs: [],
    researchItems: [
      {
        symbolCode: "161890",
        symbolName: "한국콜마",
        query: "fixture",
        searchUrl: "https://example.com/search",
        title: "한국콜마 실적과 수출 흐름 점검",
        source: "fixture",
        sourceName: "골든 fixture 경제지",
        publishedAt: "2026-07-10T00:00:00.000Z",
        url: "https://example.com/news/kolmar",
        shortSummary: "fixture"
      }
    ],
    disclosureItems: [],
    prewriteContextItems: [],
    judgmentInput: {
      firstImpression: ledger.firstImpression,
      mainConcern: ledger.mainConcern,
      revisitConditions: ledger.revisitConditions,
      exclusionConditions: ledger.exclusionConditions
    },
    heroMedia: "> fixture hero image",
    stockMediaByCode: new Map(stocks.map((item) => [item.code, `> fixture ${item.name} chart`])),
    etfMedia: null
  });
  const badInternalReview = reviewInvestmentWritingDraft({
    markdown: `${markdown}\n\n자동 수집 결과가 충분하지 않습니다. RSS 검색 결과를 검토 후보로 남깁니다.`,
    subjectNames: stocks.map((item) => item.name),
    judgmentLedger: ledger,
    outline
  });
  const unsupportedFirstPersonReview = reviewInvestmentWritingDraft({
    markdown: "저는 이 종목을 바로 매수하지 않겠습니다. 제 기준에서는 다음 장을 기다립니다.",
    subjectNames: ["테스트종목"],
    judgmentLedger: createInvestmentJudgmentLedger(),
    outline: null
  });
  const financeComparison = outline.stockAssignments.find((item) => item.role === "comparison");
  const deDupStocks = [...stocks, stock(4, "추가후보A", "100004", "10,000", "9,800", "11,000", "9,300", "80"), stock(5, "추가후보B", "100005", "20,000", "19,500", "22,000", "18,500", "79"), stock(6, "추가후보C", "100006", "30,000", "29,500", "33,000", "28,000", "78")];
  const deDupEtfs = [etf(1, "ETF A", "200001"), etf(2, "ETF B", "200002"), etf(3, "ETF C", "200003"), etf(4, "ETF D", "200004"), etf(5, "ETF E", "200005"), etf(6, "ETF F", "200006")];
  const dailyReviewSelection = selectTistorySignalReviewCandidates(deDupStocks, deDupEtfs, "2026-07-10", "mixed_stock_etf_review");
  const focusedReviewSelection = selectTistorySignalReviewCandidates(deDupStocks, deDupEtfs, "2026-07-10", "stock_signal_top3_review", {
    excludedStockCodes: dailyReviewSelection.selectedStockCodes
  });
  const etfReviewSelection = selectTistorySignalReviewCandidates(deDupStocks, deDupEtfs, "2026-07-10", "etf_sector_review", {
    excludedEtfCodes: dailyReviewSelection.selectedEtfCodes
  });
  const checks = [
    { key: "preflight_passes", pass: preflight.ok },
    { key: "finance_stocks_grouped", pass: Boolean(financeComparison?.subjectCodes.includes("086790") && financeComparison.subjectCodes.includes("055550")) },
    { key: "different_theme_deep_dive", pass: outline.stockAssignments.some((item) => item.role === "deep_dive" && item.subjectCodes.includes("161890")) },
    { key: "generated_draft_has_no_internal_leak", pass: review.internalWorkflowLeaks.length === 0 },
    { key: "generated_draft_has_no_unsupported_first_person", pass: review.unsupportedFirstPersonClaims.length === 0 },
    { key: "internal_leak_fixture_is_blocked", pass: !badInternalReview.ok && badInternalReview.internalWorkflowLeaks.length > 0 },
    { key: "unsupported_first_person_fixture_is_blocked", pass: !unsupportedFirstPersonReview.ok && unsupportedFirstPersonReview.unsupportedFirstPersonClaims.length > 0 },
    { key: "common_orchestrator_auto_publish_eligible", pass: orchestrated.autoPublishEligible },
    { key: "all_nine_targets_registered", pass: getInvestmentWritingTargetCoverage().length === 9 },
    {
      key: "blogger_five_editorial_tracks_registered",
      pass: getInvestmentWritingTargetCoverage().filter((item) => item.channel === "blogger").length === 5
    },
    {
      key: "futures_target_registered_but_source_blocked",
      pass: getInvestmentWritingTargetCoverage().some((item) => item.target === "tistory_futures_options_signal_record" && !item.sourceReady)
    },
    {
      key: "tistory_stock_categories_do_not_overlap",
      pass: !focusedReviewSelection.selectedStockCodes.some((code) => dailyReviewSelection.selectedStockCodes.includes(code))
    },
    {
      key: "tistory_etf_categories_do_not_overlap",
      pass: !etfReviewSelection.selectedEtfCodes.some((code) => dailyReviewSelection.selectedEtfCodes.includes(code))
    }
  ];
  return {
    version: INVESTMENT_WRITING_GOLDEN_FIXTURE_VERSION,
    ok: checks.every((item) => item.pass),
    checks,
    safeMetadata: {
      preflightBlockerCount: preflight.blockers.length,
      outlineAssignmentCount: outline.stockAssignments.length,
      generatedMarkdownLength: markdown.length,
      generatedReviewScore: review.antiAiScore,
      generatedReviewBlockerCount: review.blockers.length,
      badInternalLeakCount: badInternalReview.internalWorkflowLeaks.length,
      unsupportedFirstPersonCount: unsupportedFirstPersonReview.unsupportedFirstPersonClaims.length,
      orchestratorAutoPublishEligible: orchestrated.autoPublishEligible
    },
    previewExcerpt: markdown.slice(0, 500)
  };
}

function etf(rank: number, name: string, code: string): DailyBriefEtfPick {
  return {
    rank,
    name,
    code,
    category: "fixture",
    statusLabel: "관찰 유지",
    currentPrice: "10,000",
    targetPotential: "+10%",
    recentBuyDate: "2026-07-10",
    currentReturn: null,
    totalScore: String(90 - rank)
  };
}

function stock(rank: number, name: string, code: string, currentPrice: string, entryPrice: string, targetPrice: string, stopLoss: string, totalScore: string): DailyBriefStockPick {
  return {
    rank,
    name,
    code,
    market: "KR",
    statusLabel: rank <= 2 ? "진입 준비" : "감시 강화",
    currentPrice,
    entryPrice,
    targetPrice,
    stopLoss,
    recentSignalDate: "2026-07-10",
    trendScore: "80",
    totalScore,
    detailUrl: `https://upsignal.co.kr/kr/stocks/${code}`,
    chartCaptureId: null
  };
}
