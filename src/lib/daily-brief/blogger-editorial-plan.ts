export const BLOGGER_EDITORIAL_PLAN_VERSION = "blogger_editorial_plan_v3";

export const BLOGGER_DAILY_EDITORIAL_TRACKS = [
  {
    key: "stock_review",
    label: "오늘의 투자 유망 종목 리뷰",
    proposedTime: "08:00",
    investmentWritingTarget: "blogger_daily_brief",
    sourceReady: true,
    generationWired: true
  },
  {
    key: "etf_review",
    label: "오늘의 투자 유망 ETF 리뷰",
    proposedTime: "08:20",
    investmentWritingTarget: "blogger_etf_review",
    sourceReady: true,
    generationWired: true
  },
  {
    key: "market_intraday",
    label: "한국장 장중 분석 · 코스피200/나스닥 차트",
    proposedTime: "12:20",
    investmentWritingTarget: "blogger_market_intraday_review",
    sourceReady: true,
    generationWired: true
  },
  {
    key: "market_close",
    label: "한국장 마감 분석 · 코스피200/나스닥 차트",
    proposedTime: "16:10",
    investmentWritingTarget: "blogger_market_close_review",
    sourceReady: true,
    generationWired: true
  },
  {
    key: "market_us_intraday",
    label: "미국장 장중 분석 · S&P500/나스닥 차트",
    proposedTime: "23:30",
    investmentWritingTarget: "blogger_market_us_intraday_review",
    sourceReady: true,
    generationWired: true
  }
] as const;

export function getBloggerEditorialPlan() {
  return {
    version: BLOGGER_EDITORIAL_PLAN_VERSION,
    timezone: "Asia/Seoul",
    requestedPostsPerDay: 5,
    derivedTrackCount: BLOGGER_DAILY_EDITORIAL_TRACKS.length,
    activationReady: true,
    activationBlockers: [],
    tracks: BLOGGER_DAILY_EDITORIAL_TRACKS,
    sideEffectPolicy: {
      scheduleChanged: false,
      contentGenerated: false,
      bloggerWrite: false,
      publish: false
    }
  } as const;
}
