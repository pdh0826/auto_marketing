import { NextResponse } from "next/server";
import { previewBloggerInvestmentWriting } from "@/lib/daily-brief/content";
import { getDailyBriefRun } from "@/lib/daily-brief/store";

export async function GET(_request: Request, context: { params: { runId: string } }) {
  const run = await getDailyBriefRun(context.params.runId);
  if (!run) {
    return NextResponse.json({ error: "daily_brief_run_not_found" }, { status: 404 });
  }
  const result = previewBloggerInvestmentWriting(run);
  return NextResponse.json({
    ok: result.autoPublishEligible,
    title: run.title,
    markdown: result.markdown,
    preflight: result.preflight,
    outline: result.outline,
    initialReview: result.initialReview,
    repair: result.repair,
    finalReview: result.finalReview,
    blockingReasons: result.blockingReasons,
    sideEffectSummary: {
      dbRead: false,
      dbWrite: false,
      bloggerWrite: false,
      tistoryWrite: false,
      publish: false,
      llmCall: false
    }
  });
}
