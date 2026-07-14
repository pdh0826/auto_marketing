import { NextResponse } from "next/server";
import { buildInvestmentSeoTitle, reviewInvestmentSeoTitle, type InvestmentSeoTitleTarget } from "@/lib/daily-brief/investment-seo-title";
import { getDailyBriefRun } from "@/lib/daily-brief/store";
import type { DailyFuturesEditorialTrack, DailyMarketReportSession } from "@/lib/daily-brief/market-report-session";

const TARGETS: Array<{
  target: InvestmentSeoTitleTarget;
  channel: "blogger" | "tistory";
  label: string;
  session?: DailyMarketReportSession;
  futuresTrack?: DailyFuturesEditorialTrack;
  requiredKeywords: string[];
}> = [
  { target: "blogger_daily_brief", channel: "blogger", label: "오늘의 투자 유망 종목 리뷰", requiredKeywords: ["국내주식", "관심종목"] },
  { target: "blogger_etf_review", channel: "blogger", label: "오늘의 투자 유망 ETF 리뷰", requiredKeywords: ["ETF"] },
  { target: "blogger_market_intraday_review", channel: "blogger", label: "한국장 장중 분석", session: "korea_intraday", requiredKeywords: ["코스피200", "외국인 수급"] },
  { target: "blogger_market_close_review", channel: "blogger", label: "한국장 마감 분석", session: "korea_close", requiredKeywords: ["코스피200", "외국인"] },
  { target: "blogger_market_us_intraday_review", channel: "blogger", label: "미국장 장중 분석", session: "us_intraday", requiredKeywords: ["나스닥100", "S&P500"] },
  { target: "tistory_daily_stock_review", channel: "tistory", label: "오늘의 관심종목 리뷰", requiredKeywords: ["국내주식", "매매 신호"] },
  { target: "tistory_focused_signal_review", channel: "tistory", label: "종목별 신호 집중분석", requiredKeywords: ["매수 신호", "종목"] },
  { target: "tistory_etf_sector_review", channel: "tistory", label: "ETF 섹터 흐름 리뷰", requiredKeywords: ["ETF"] },
  { target: "tistory_futures_options_signal_record", channel: "tistory", label: "금·오일·유로달러 시그널 기록 · 07:00", session: "morning", futuresTrack: "macro", requiredKeywords: ["선물", "매매타점"] },
  { target: "tistory_futures_options_signal_record", channel: "tistory", label: "선물·옵션 시그널 기록 · 08:00", session: "morning", futuresTrack: "index", requiredKeywords: ["선물", "매매타점"] },
  { target: "tistory_futures_options_signal_record", channel: "tistory", label: "금·오일·유로달러 시그널 기록 · 21:00", session: "us_preopen", futuresTrack: "macro", requiredKeywords: ["선물", "매매타점"] },
  { target: "tistory_futures_options_signal_record", channel: "tistory", label: "선물·옵션 시그널 기록 · 22:00", session: "us_preopen", futuresTrack: "index", requiredKeywords: ["선물", "매매타점"] }
];

export async function GET(_request: Request, context: { params: { runId: string } }) {
  const run = await getDailyBriefRun(context.params.runId);
  if (!run) {
    return NextResponse.json({ error: "daily_brief_run_not_found" }, { status: 404 });
  }

  const stockNames = run.stockPicks.map((pick) => pick.name);
  const etfNames = run.etfPicks.map((pick) => pick.name);
  const titles = TARGETS.map((item) => {
    const futuresNames = item.futuresTrack === "macro" ? ["금", "WTI 크루드오일", "유로/달러"] : ["E-mini NASDAQ100", "E-mini S&P500", "KOSPI200"];
    const title = buildInvestmentSeoTitle({
      target: item.target,
      marketDate: run.marketDate,
      stockNames,
      etfNames,
      futuresNames,
      stockLimit: item.target === "tistory_focused_signal_review" ? 3 : run.stockPickLimit,
      etfLimit: run.etfPickLimit,
      marketReportSession: item.session,
      futuresEditorialTrack: item.futuresTrack
    });
    return {
      ...item,
      title,
      seoReview: reviewInvestmentSeoTitle(title, {
        marketDate: run.marketDate,
        requiredKeywords: item.requiredKeywords
      })
    };
  });

  return NextResponse.json({
    ok: titles.every((item) => item.seoReview.ok),
    runId: run.id,
    marketDate: run.marketDate,
    titles,
    sideEffectSummary: {
      dbRead: true,
      dbWrite: false,
      externalWrite: false,
      bloggerWrite: false,
      tistoryWrite: false,
      publish: false,
      llmCall: false
    }
  });
}
