import { NextResponse } from "next/server";
import { TISTORY_FUTURES_EDITORIAL_SLOTS, getDailyMarketReportProfile, type DailyMarketReportSession } from "@/lib/daily-brief/market-report-session";

export const runtime = "nodejs";

const sessions: DailyMarketReportSession[] = ["morning", "korea_intraday", "korea_close", "us_preopen", "us_intraday"];

export async function GET() {
  const marketFlowSourceConfigured = Boolean(process.env.UPSIGNAL_MARKET_FLOW_URL?.trim());
  return NextResponse.json({
    data: {
      version: "daily_market_report_readiness_v1",
      timezone: "Asia/Seoul",
      sessions: sessions.map((session) => {
        const profile = getDailyMarketReportProfile(session);
        return {
          session,
          label: profile.label,
          proposedTime: profile.proposedTime,
          instrumentPriority: profile.instrumentPriority,
          timeframePriority: profile.timeframePriority,
          koreaForeignFlowRecommended: profile.koreaForeignFlowRequired,
          koreaForeignFlowAvailable: marketFlowSourceConfigured,
          generationReady: true,
          blockers: [],
          optionalOmissions: profile.koreaForeignFlowRequired && !marketFlowSourceConfigured ? ["korea_foreign_flow"] : []
        };
      }),
      marketFlowContract: {
        sourceConfigured: marketFlowSourceConfigured,
        optional: true,
        omittedWhenUnavailableOrIncomplete: true,
        estimatedValuesAllowed: false,
        requiredFields: ["observedAt", "foreign.spotNet", "foreign.futuresNet", "foreign.callOptionsNet", "foreign.putOptionsNet"],
        rawResponseExposed: false
      },
      tistoryFuturesSlots: TISTORY_FUTURES_EDITORIAL_SLOTS,
      screenshotPolicy: {
        bloggerKoreaIntraday: ["KOSPI200", "NQ"],
        bloggerKoreaClose: ["KOSPI200", "NQ"],
        bloggerUsIntraday: ["ES", "NQ"],
        tistoryIndex: ["NQ", "ES", "KOSPI200"],
        tistoryMacro: ["GOLD", "WTI", "EURUSD"],
        preferredTimeframes: ["60분봉", "240분봉", "10분봉"]
      },
      scheduler: {
        multiScheduleImplemented: false,
        autoActivationPerformed: false
      },
      sideEffectSummary: {
        dbRead: false,
        dbWrite: false,
        externalRead: false,
        bloggerWrite: false,
        publish: false,
        tokenRefresh: false,
        llmCall: false
      }
    }
  });
}
