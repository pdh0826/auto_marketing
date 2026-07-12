export const BLOGGER_EDITORIAL_PLAN_VERSION = "blogger_editorial_plan_v1";

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
    generationWired: false
  },
  {
    key: "market_morning",
    label: "미국장·한국장·주요 선물옵션 아침 분석",
    proposedTime: "07:30",
    investmentWritingTarget: "blogger_market_morning_review",
    sourceReady: false,
    generationWired: false,
    blocker: "verified_market_signal_source_not_ready"
  },
  {
    key: "market_intraday",
    label: "장중 시그널 리뷰",
    proposedTime: "12:20",
    investmentWritingTarget: "blogger_market_intraday_review",
    sourceReady: false,
    generationWired: false,
    blocker: "verified_market_signal_source_not_ready"
  },
  {
    key: "market_close",
    label: "장마감 시그널 리뷰",
    proposedTime: "16:10",
    investmentWritingTarget: "blogger_market_close_review",
    sourceReady: false,
    generationWired: false,
    blocker: "verified_market_signal_source_not_ready"
  }
] as const;

export function getBloggerEditorialPlan() {
  return {
    version: BLOGGER_EDITORIAL_PLAN_VERSION,
    timezone: "Asia/Seoul",
    requestedPostsPerDay: 4,
    derivedTrackCount: BLOGGER_DAILY_EDITORIAL_TRACKS.length,
    activationReady: false,
    activationBlockers: ["requested_post_count_4_but_derived_track_count_5", "verified_market_signal_source_not_ready"],
    tracks: BLOGGER_DAILY_EDITORIAL_TRACKS,
    sideEffectPolicy: {
      scheduleChanged: false,
      contentGenerated: false,
      bloggerWrite: false,
      publish: false
    }
  } as const;
}
