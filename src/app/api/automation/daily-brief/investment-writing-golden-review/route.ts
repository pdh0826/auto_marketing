import { NextResponse } from "next/server";
import { runInvestmentWritingGoldenFixtures } from "@/lib/daily-brief/investment-writing-golden-fixtures";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    data: runInvestmentWritingGoldenFixtures(),
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
