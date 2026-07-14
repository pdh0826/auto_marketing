import type { DailyFuturesEditorialTrack, DailyMarketReportSession } from "./market-report-session";

export type InvestmentSeoTitleTarget =
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

interface BuildInvestmentSeoTitleInput {
  target: InvestmentSeoTitleTarget;
  marketDate: string;
  stockNames?: string[];
  etfNames?: string[];
  futuresNames?: string[];
  stockLimit?: number;
  etfLimit?: number;
  marketReportSession?: DailyMarketReportSession;
  futuresEditorialTrack?: DailyFuturesEditorialTrack;
  marketFlowAvailable?: boolean;
}

const GENERIC_NAMES = new Set(["신호 종목", "관심종목", "ETF", "선물"]);

export function buildInvestmentSeoTitle(input: BuildInvestmentSeoTitleInput) {
  const date = formatDate(input.marketDate);
  const stockNames = normalizeNames(input.stockNames).slice(0, 3);
  const etfNames = normalizeNames(input.etfNames).slice(0, 3);
  const futuresNames = normalizeNames(input.futuresNames).slice(0, 3);
  const futuresList = futuresNames.join("·") || "나스닥100·S&P500·코스피200";

  switch (input.target) {
    case "blogger_daily_brief":
      return withNames(`오늘의 국내주식 관심종목 TOP ${input.stockLimit ?? 8}`, stockNames, date);
    case "blogger_etf_review":
      return withNames(`오늘의 투자 유망 ETF TOP ${input.etfLimit ?? 5}`, etfNames, date);
    case "tistory_daily_stock_review":
      return withNames(`오늘 매매 신호 포착 국내주식 TOP ${input.stockLimit ?? 8}`, stockNames, date);
    case "tistory_focused_signal_review":
      return withNames(`최근 매수 신호 나온 종목 TOP ${Math.min(stockNames.length || 3, 3)}`, stockNames, date);
    case "tistory_etf_sector_review":
      return withNames(`오늘 ETF 투자 흐름 TOP ${input.etfLimit ?? Math.max(etfNames.length, 5)}`, etfNames, date);
    case "blogger_market_intraday_review":
      return input.marketFlowAvailable
        ? `코스피200 선물 장중 매매타점과 외국인 수급 | ${date} 급등포착`
        : `코스피200·나스닥 선물 장중 매매타점 | ${date} 급등포착`;
    case "blogger_market_close_review":
      return input.marketFlowAvailable
        ? `코스피200 선물 마감 분석: 외국인 현물·선물·옵션 수급 | ${date} 급등포착`
        : `코스피200·나스닥 선물 마감 분석 | ${date} 급등포착`;
    case "blogger_market_us_intraday_review":
      return `나스닥100·S&P500 선물 장중 매매타점 | ${date} 급등포착`;
    case "blogger_market_morning_review":
      return `오늘 아침 선물 매매타점: ${futuresList} | ${date} 급등포착`;
    case "tistory_futures_options_signal_record":
      return buildFuturesTitle(
        input.marketReportSession ?? "morning",
        futuresList,
        date,
        input.futuresEditorialTrack ?? "index",
        input.marketFlowAvailable === true
      );
  }
}

export function reviewInvestmentSeoTitle(title: string, input: { marketDate: string; requiredKeywords: string[] }) {
  const normalized = title.trim();
  const date = formatDate(input.marketDate);
  const matchedKeywords = input.requiredKeywords.filter((keyword) => normalized.includes(keyword));
  const warnings: string[] = [];

  if (normalized.length < 24) warnings.push("title_too_short");
  if (normalized.length > 68) warnings.push("title_too_long");
  if (!normalized.includes(date)) warnings.push("market_date_missing");
  if (matchedKeywords.length === 0) warnings.push("primary_keyword_missing");
  if (/분석.{0,6}분석|오늘.{0,6}오늘|급등포착.{0,6}급등포착/.test(normalized)) warnings.push("repeated_phrase");
  if (/[!?]{2,}|\.{3,}/.test(normalized)) warnings.push("clickbait_punctuation");

  return {
    ok: warnings.length === 0,
    score: Math.max(0, 100 - warnings.length * 15),
    titleLength: normalized.length,
    matchedKeywords,
    warnings
  };
}

function buildFuturesTitle(session: DailyMarketReportSession, names: string, date: string, track: DailyFuturesEditorialTrack, marketFlowAvailable: boolean) {
  if (session === "korea_intraday") {
    return marketFlowAvailable
      ? `한국장 장중 코스피200 선물·외국인 수급 분석 | ${date} 급등포착`
      : `한국장 장중 코스피200·나스닥 선물 분석 | ${date} 급등포착`;
  }
  if (session === "korea_close") {
    return marketFlowAvailable
      ? `한국장 마감 코스피200 선물과 외국인 수급 | ${date} 급등포착`
      : `한국장 마감 코스피200·나스닥 선물 분석 | ${date} 급등포착`;
  }
  if (session === "us_intraday") return `미국장 장중 나스닥100·S&P500 선물 매매타점 | ${date} 급등포착`;
  const prefix = session === "us_preopen" ? "미국장 시작 전 선물 시황" : "오늘 아침 선물 시황";
  const trackLabel = track === "macro" ? "금·오일·유로" : names;
  return `${prefix}: ${trackLabel} 매매타점 | ${date} 급등포착`;
}

function withNames(prefix: string, names: string[], date: string) {
  const suffix = ` | ${date} 급등포착`;
  for (let count = Math.min(names.length, 3); count > 0; count -= 1) {
    const candidate = `${prefix}: ${names.slice(0, count).join("·")}${suffix}`;
    if (candidate.length <= 68) return candidate;
  }
  return `${prefix}${suffix}`;
}

function normalizeNames(values: string[] | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.replace(/^E-mini\s+/i, "").replace(/\s*선물$/, "").trim())
        .filter((value) => value && !GENERIC_NAMES.has(value))
    )
  );
}

function formatDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.replaceAll("-", ".") : value;
}
