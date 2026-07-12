import { NextResponse } from "next/server";
import { getInvestmentWritingTargetCoverage } from "@/lib/daily-brief/investment-writing-orchestrator";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    data: {
      process: "evidence_preflight_outline_generate_review_repair_rereview_gate",
      targets: getInvestmentWritingTargetCoverage(),
      externalPublishTriggered: false
    },
    sideEffectSummary: {
      dbRead: false,
      dbWrite: false,
      networkRead: false,
      llmCall: false,
      bloggerWrite: false,
      tistoryWrite: false,
      publish: false
    }
  });
}
