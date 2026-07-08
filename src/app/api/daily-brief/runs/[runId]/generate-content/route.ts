import { NextResponse } from "next/server";
import { buildDailyBriefGenerationReadiness, createDailyBriefContentItem } from "@/lib/daily-brief/content";
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
    if (run.contentItemId) {
      return NextResponse.json({ error: "daily_brief_content_already_generated", contentItemId: run.contentItemId }, { status: 409 });
    }
    const readiness = buildDailyBriefGenerationReadiness(run);
    if (!readiness.ready) {
      return NextResponse.json({ error: "daily_brief_not_ready", readiness }, { status: 400 });
    }

    const result = await createDailyBriefContentItem(run);
    const next = await saveDailyBriefRun({
      ...run,
      status: "content_generated",
      contentItemId: result.contentItem.id,
      draftMarkdownLength: result.markdown.length,
      draftHtmlLength: result.html.length,
      visibleTextLength: result.htmlPreview.validationSummary.visibleTextLength,
      warnings: Array.from(new Set([...run.warnings, ...result.htmlPreview.validationSummary.warnings])),
      sideEffectSummary: {
        ...run.sideEffectSummary,
        dbWrite: true,
        contentItemCreated: true,
        contentAssetCreated: result.assets.length > 0
      }
    });

    return NextResponse.json({
      data: {
        run: next,
        contentItemId: result.contentItem.id,
        draftMarkdownLength: result.markdown.length,
        draftHtmlLength: result.html.length,
        visibleTextLength: result.htmlPreview.validationSummary.visibleTextLength,
        quality: {
          ready: result.quality.ready,
          grade: result.quality.grade,
          scorePreview: result.quality.scorePreview
        },
        readiness,
        links: {
          editWizard: `/wizard/edit/${result.contentItem.id}`,
          publishWizard: `/wizard/publish/${result.contentItem.id}`,
          contentDetail: `/content/${result.contentItem.id}`
        }
      }
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Daily brief content generation failed.", 500) }, { status: 400 });
  }
}
