export type DailyMarketReportSession = "morning" | "korea_intraday" | "korea_close" | "us_preopen" | "us_intraday";
export type DailyFuturesEditorialTrack = "index" | "macro";

export interface DailyMarketReportProfile {
  session: DailyMarketReportSession;
  label: string;
  instrumentPriority: string[];
  timeframePriority: string[];
  koreaForeignFlowRequired: boolean;
  proposedTime: string;
}

const REPORT_PROFILES: Record<DailyMarketReportSession, DailyMarketReportProfile> = {
  morning: {
    session: "morning",
    label: "아침 모닝 리포트",
    instrumentPriority: ["NQ", "ES", "KOSPI200", "WTI", "GOLD", "EURUSD"],
    timeframePriority: ["60분봉", "240분봉", "10분봉"],
    koreaForeignFlowRequired: false,
    proposedTime: "07:30"
  },
  korea_intraday: {
    session: "korea_intraday",
    label: "한국장 장중 리포트",
    instrumentPriority: ["KOSPI200", "NQ", "ES", "WTI", "GOLD", "EURUSD"],
    timeframePriority: ["60분봉", "240분봉", "10분봉"],
    koreaForeignFlowRequired: true,
    proposedTime: "12:20"
  },
  korea_close: {
    session: "korea_close",
    label: "한국장 마감 리포트",
    instrumentPriority: ["KOSPI200", "NQ", "ES", "WTI", "GOLD", "EURUSD"],
    timeframePriority: ["60분봉", "240분봉", "10분봉"],
    koreaForeignFlowRequired: true,
    proposedTime: "16:10"
  },
  us_preopen: {
    session: "us_preopen",
    label: "미국장 시작 전 리포트",
    instrumentPriority: ["NQ", "ES", "KOSPI200", "GOLD", "WTI", "EURUSD"],
    timeframePriority: ["60분봉", "240분봉", "10분봉"],
    koreaForeignFlowRequired: false,
    proposedTime: "22:00"
  },
  us_intraday: {
    session: "us_intraday",
    label: "미국장 장중 리포트",
    instrumentPriority: ["NQ", "ES", "KOSPI200", "WTI", "GOLD", "EURUSD"],
    timeframePriority: ["60분봉", "240분봉", "10분봉"],
    koreaForeignFlowRequired: false,
    proposedTime: "23:30"
  }
};

export function getDailyMarketReportProfile(session: DailyMarketReportSession) {
  return REPORT_PROFILES[session];
}

export function resolveDailyMarketReportSession(generatedAt = new Date()): DailyMarketReportSession {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      hour12: false
    }).format(generatedAt)
  );
  if (hour >= 6 && hour < 9) return "morning";
  if (hour >= 9 && hour < 16) return "korea_intraday";
  if (hour >= 16 && hour < 22) return "korea_close";
  return "us_intraday";
}

export function normalizeDailyMarketReportSession(value: unknown): DailyMarketReportSession | null {
  if (value === "morning" || value === "korea_intraday" || value === "korea_close" || value === "us_preopen" || value === "us_intraday") return value;
  return null;
}

export function normalizeDailyFuturesEditorialTrack(value: unknown): DailyFuturesEditorialTrack {
  return value === "macro" ? "macro" : "index";
}

export function getFuturesSymbolsForTrack(track: DailyFuturesEditorialTrack) {
  return track === "macro" ? ["GOLD", "WTI", "EURUSD"] : ["NQ", "ES", "KOSPI200"];
}

export const TISTORY_FUTURES_EDITORIAL_SLOTS = [
  { track: "macro", session: "morning", proposedTime: "07:00", label: "오늘 아침 금·오일·유로 매매타점" },
  { track: "index", session: "morning", proposedTime: "08:00", label: "오늘 아침 나스닥·S&P500·코스피200 매매타점" },
  { track: "macro", session: "us_preopen", proposedTime: "21:00", label: "미국장 시작 전 금·오일·유로 매매타점" },
  { track: "index", session: "us_preopen", proposedTime: "22:00", label: "미국장 시작 전 나스닥·S&P500·코스피200 매매타점" }
] as const satisfies ReadonlyArray<{
  track: DailyFuturesEditorialTrack;
  session: DailyMarketReportSession;
  proposedTime: string;
  label: string;
}>;
