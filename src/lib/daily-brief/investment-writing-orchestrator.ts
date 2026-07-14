import type { Project300CategoryKind } from "@/lib/tistory/project300-voice-variation";
import { createInvestmentJudgmentLedger, type InvestmentJudgmentLedgerInput, type InvestmentWritingChannel } from "./investment-writing-contract";
import { buildDailyBriefInvestmentEvidencePack } from "./investment-writing-evidence";
import { buildInvestmentWritingOutline } from "./investment-writing-outline";
import { buildInvestmentWritingPromptBundle } from "./investment-writing-prompts";
import { validateInvestmentWritingEvidencePack } from "./investment-writing-preflight";
import { repairInvestmentWritingDraft } from "./investment-writing-repair";
import { reviewInvestmentWritingDraft } from "./investment-writing-review";
import { runInvestmentWritingNaturalVoiceSecondPass } from "./investment-writing-natural-voice";
import { renderProject300InvestmentPost } from "./project300-investment-renderer";
import type { DailyForeignMarketFlowSnapshot } from "./market-flow";
import type { DailyMarketReportSession } from "./market-report-session";
import type {
  DailyBriefEtfPick,
  DailyBriefFuturesPick,
  DailyBriefOfficialDisclosureItem,
  DailyBriefPrewriteContextItem,
  DailyBriefResearchItem,
  DailyBriefStockPick
} from "./types";

export const INVESTMENT_WRITING_ORCHESTRATOR_VERSION = "investment_writing_orchestrator_v2";

export type InvestmentWritingTarget =
  | "blogger_daily_brief"
  | "blogger_etf_review"
  | "blogger_market_morning_review"
  | "blogger_market_intraday_review"
  | "blogger_market_close_review"
  | "blogger_market_us_intraday_review"
  | "tistory_daily_stock_review"
  | "tistory_focused_signal_review"
  | "tistory_etf_sector_review"
  | "tistory_futures_options_signal_record";

export function runInvestmentWritingOrchestrator(input: {
  target: InvestmentWritingTarget;
  title: string;
  marketDate: string;
  generatedAt?: string;
  stocks: DailyBriefStockPick[];
  etfs: DailyBriefEtfPick[];
  futures?: DailyBriefFuturesPick[];
  marketFlow?: DailyForeignMarketFlowSnapshot | null;
  marketReportSession?: DailyMarketReportSession;
  researchItems: DailyBriefResearchItem[];
  disclosureItems: DailyBriefOfficialDisclosureItem[];
  prewriteContextItems: DailyBriefPrewriteContextItem[];
  judgmentInput?: InvestmentJudgmentLedgerInput;
  heroMedia: string;
  boardMedia?: string | null;
  stockMediaByCode: Map<string, string>;
  etfMedia: string | null;
  futuresMedia?: string | null;
}) {
  const profile = resolveTargetProfile(input.target);
  const evidencePack = buildDailyBriefInvestmentEvidencePack({
    channel: profile.channel,
    categoryKind: profile.categoryKind,
    marketDate: input.marketDate,
    generatedAt: input.generatedAt,
    stocks: input.stocks,
    etfs: input.etfs,
    futures: input.futures ?? [],
    marketFlow: input.marketFlow ?? null,
    researchItems: input.researchItems,
    disclosureItems: input.disclosureItems,
    prewriteContextItems: input.prewriteContextItems
  });
  const sourceBlocker = resolveTargetSourceBlocker(input.target);
  if (sourceBlocker) {
    evidencePack.unresolvedIssues.push(sourceBlocker);
  }
  const judgmentLedger = createInvestmentJudgmentLedger(input.judgmentInput);
  const preflight = validateInvestmentWritingEvidencePack(evidencePack);
  if (sourceBlocker) {
    preflight.ok = false;
    preflight.blockers.push(sourceBlocker);
  }
  const outline = buildInvestmentWritingOutline({ evidencePack, judgmentLedger, preflight });
  const promptBundle = buildInvestmentWritingPromptBundle({ evidencePack, judgmentLedger, preflight, outline });
  const initialMarkdown = outline.ready
    ? renderProject300InvestmentPost({
        title: input.title,
        evidencePack,
        judgmentLedger,
        outline,
        stocks: input.stocks,
        etfs: input.etfs,
        futures: input.futures ?? [],
        marketFlow: input.marketFlow ?? null,
        marketReportSession: input.marketReportSession,
        researchItems: input.researchItems,
        disclosureItems: input.disclosureItems,
        heroMedia: input.heroMedia,
        boardMedia: input.boardMedia ?? null,
        stockMediaByCode: input.stockMediaByCode,
        etfMedia: input.etfMedia,
        futuresMedia: input.futuresMedia ?? null
      })
    : "";
  const initialReview = reviewInvestmentWritingDraft({
    markdown: initialMarkdown,
    subjectNames: input.stocks.map((item) => item.name),
    judgmentLedger,
    outline,
    allowFirstPerson: true
  });
  const repair = initialMarkdown && !initialReview.ok ? repairInvestmentWritingDraft({ markdown: initialMarkdown, judgmentLedger }) : null;
  const repairedMarkdown = repair?.changed ? repair.markdown : initialMarkdown;
  const naturalVoiceSecondPass = runInvestmentWritingNaturalVoiceSecondPass(repairedMarkdown);
  const finalMarkdown = naturalVoiceSecondPass.markdown;
  const finalReview = reviewInvestmentWritingDraft({
    markdown: finalMarkdown,
    subjectNames: input.stocks.map((item) => item.name),
    judgmentLedger,
    outline,
    allowFirstPerson: true
  });
  const autoPublishEligible = preflight.ok && outline.ready && finalReview.ok && Boolean(finalMarkdown);
  const reviewFallbackBlocker = !finalReview.ok && finalReview.blockers.length === 0
    ? `investment_writing_review_not_passed:score_${finalReview.antiAiScore}:substitution_${finalReview.substitutionTestWarnings.length}:warnings_${finalReview.warnings.length}`
    : null;

  return {
    version: INVESTMENT_WRITING_ORCHESTRATOR_VERSION,
    target: input.target,
    channel: profile.channel,
    categoryKind: profile.categoryKind,
    evidencePack,
    judgmentLedger,
    preflight,
    outline,
    promptBundle,
    initialReview,
    repair,
    naturalVoiceSecondPass,
    gptCliNaturalVoiceRewriteRecommended: !naturalVoiceSecondPass.finalReview.ok,
    finalReview,
    markdown: finalMarkdown,
    autoPublishEligible,
    blockingReasons: Array.from(
      new Set([
        ...preflight.blockers,
        ...finalReview.blockers,
        ...(!outline.ready ? ["investment_writing_outline_not_ready"] : []),
        ...(reviewFallbackBlocker ? [reviewFallbackBlocker] : []),
        ...(!finalMarkdown ? ["investment_writing_markdown_empty"] : [])
      ])
    )
  };
}

export function getInvestmentWritingTargetCoverage() {
  return [
    { target: "blogger_daily_brief", editorialTrack: "stock_review", channel: "blogger", processEnabled: true, sourceReady: true, generationWired: true },
    { target: "blogger_etf_review", editorialTrack: "etf_review", channel: "blogger", processEnabled: true, sourceReady: true, generationWired: false },
    { target: "blogger_market_morning_review", editorialTrack: "market_morning", channel: "blogger", processEnabled: true, sourceReady: true, generationWired: false, sourceUrl: "https://upsignal.co.kr/futures" },
    { target: "blogger_market_intraday_review", editorialTrack: "market_intraday", channel: "blogger", processEnabled: true, sourceReady: true, generationWired: false, sourceUrl: "https://upsignal.co.kr/futures" },
    { target: "blogger_market_close_review", editorialTrack: "market_close", channel: "blogger", processEnabled: true, sourceReady: true, generationWired: false, sourceUrl: "https://upsignal.co.kr/futures" },
    { target: "blogger_market_us_intraday_review", editorialTrack: "market_us_intraday", channel: "blogger", processEnabled: true, sourceReady: true, generationWired: false, sourceUrl: "https://upsignal.co.kr/futures" },
    { target: "tistory_daily_stock_review", channel: "tistory", processEnabled: true, sourceReady: true, generationWired: true },
    { target: "tistory_focused_signal_review", channel: "tistory", processEnabled: true, sourceReady: true, generationWired: true },
    { target: "tistory_etf_sector_review", channel: "tistory", processEnabled: true, sourceReady: true, generationWired: true },
    {
      target: "tistory_futures_options_signal_record",
      channel: "tistory",
      processEnabled: true,
      sourceReady: true,
      generationWired: true,
      sourceUrl: "https://upsignal.co.kr/futures"
    }
  ] as const;
}

function resolveTargetProfile(target: InvestmentWritingTarget): { channel: InvestmentWritingChannel; categoryKind: Project300CategoryKind | null } {
  if (target === "blogger_daily_brief") return { channel: "blogger_daily_brief", categoryKind: "daily_stock_review" };
  if (target === "blogger_etf_review") return { channel: "blogger_daily_brief", categoryKind: "etf_sector_review" };
  if (
    target === "blogger_market_morning_review" ||
    target === "blogger_market_intraday_review" ||
    target === "blogger_market_close_review" ||
    target === "blogger_market_us_intraday_review"
  ) {
    return { channel: "blogger_daily_brief", categoryKind: "futures_options_signal_record" };
  }
  if (target === "tistory_focused_signal_review") return { channel: "project300_tistory", categoryKind: "focused_signal_review" };
  if (target === "tistory_etf_sector_review") return { channel: "project300_tistory", categoryKind: "etf_sector_review" };
  if (target === "tistory_futures_options_signal_record") return { channel: "project300_tistory", categoryKind: "futures_options_signal_record" };
  return { channel: "project300_tistory", categoryKind: "daily_stock_review" };
}

function resolveTargetSourceBlocker(target: InvestmentWritingTarget) {
  void target;
  return null;
}
