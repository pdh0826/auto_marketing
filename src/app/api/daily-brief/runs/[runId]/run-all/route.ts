import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    runId: string;
  };
}

export async function POST(_request: Request, { params }: RouteContext) {
  return NextResponse.json({
    data: {
      runId: params.runId,
      implemented: false,
      reason: "run_all_is_intentionally_not_enabled_yet",
      nextStep: "Use the staged buttons: capture KR board, capture stock charts, capture ETF board, collect research, generate content.",
      sideEffectSummary: {
        bloggerApiWrite: false,
        bloggerDraftSave: false,
        bloggerPublish: false,
        tokenRefresh: false,
        llmCall: false
      }
    }
  });
}
