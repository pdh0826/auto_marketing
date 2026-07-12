import { NextResponse } from "next/server";
import { collectDailyBriefOfficialDisclosures, collectDailyBriefResearch } from "@/lib/daily-brief/research";
import { getDailyBriefRun, saveDailyBriefRun } from "@/lib/daily-brief/store";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    runId: string;
  };
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const run = await getDailyBriefRun(params.runId);
    if (!run) {
      return NextResponse.json({ error: "Daily brief run not found." }, { status: 404 });
    }
    if (run.stockPicks.length === 0) {
      return NextResponse.json({ error: "stock_picks_required" }, { status: 400 });
    }

    const targetPicks = run.stockPicks.slice(0, run.stockDetailLimit);
    const [researchItems, officialDisclosureItems] = await Promise.all([
      collectDailyBriefResearch(targetPicks),
      collectDailyBriefOfficialDisclosures(targetPicks, run.marketDate)
    ]);
    const researchWarnings = researchItems.some((item) => item.source === "naver_news_search_link" || item.source === "search_link")
      ? ["news_search_link_fallback_present"]
      : [];
    const next = await saveDailyBriefRun({
      ...run,
      status: run.contentItemId ? "content_generated" : "researched",
      researchItems,
      officialDisclosureItems,
      warnings: Array.from(new Set([...run.warnings.filter((warning) => warning !== "news_search_link_fallback_present"), ...researchWarnings])),
      sideEffectSummary: {
        ...run.sideEffectSummary,
        newsSearchRead: true
      }
    });

    return NextResponse.json({ data: next });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Daily brief research failed.", 500) }, { status: 400 });
  }
}
