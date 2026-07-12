import { NextResponse } from "next/server";
import { buildDailyBriefGenerationReadiness, refreshDailyBriefContentItemFromRun } from "@/lib/daily-brief/content";
import { getDailyBriefRun, saveDailyBriefRun } from "@/lib/daily-brief/store";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    runId: string;
  };
}

const CONFIRMATION_PHRASE = "REFRESH_DAILY_BRIEF_CONTENT";

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json().catch(() => ({}))) as { confirmationPhrase?: unknown };
    if (body.confirmationPhrase !== CONFIRMATION_PHRASE) {
      return NextResponse.json(
        {
          error: "confirmation_phrase_required",
          confirmationPolicy: {
            required: true,
            phrase: CONFIRMATION_PHRASE
          }
        },
        { status: 400 }
      );
    }

    const run = await getDailyBriefRun(params.runId);
    if (!run) {
      return NextResponse.json({ error: "Daily brief run not found." }, { status: 404 });
    }
    if (!run.contentItemId) {
      return NextResponse.json({ error: "daily_brief_content_item_required" }, { status: 400 });
    }

    const result = await refreshDailyBriefContentItemFromRun(run);
    const readiness = buildDailyBriefGenerationReadiness(run);
    const next = await saveDailyBriefRun({
      ...run,
      status: "content_generated",
      draftMarkdownLength: result.markdown.length,
      draftHtmlLength: result.html.length,
      visibleTextLength: result.htmlPreview.validationSummary.visibleTextLength,
      warnings: Array.from(
        new Set([
          ...run.warnings.filter((warning) => warning !== "news_search_link_fallback_present"),
          ...readiness.warnings,
          ...result.htmlPreview.validationSummary.warnings
        ])
      ),
      sideEffectSummary: {
        ...run.sideEffectSummary,
        dbWrite: true
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
        sideEffectSummary: {
          dbRead: true,
          dbWrite: true,
          contentMutation: true,
          mutatedFields: ["title", "targetKeyword", "draftMarkdown", "draftHtml"],
          reusedExistingAssets: true,
          createdContentItem: false,
          createdContentAsset: false,
          bloggerApiRead: false,
          bloggerApiWrite: false,
          bloggerDraftSave: false,
          bloggerPublish: false,
          scheduledPublish: false,
          tokenRefresh: false,
          llmCall: false,
          llmCallLogCreated: false
        },
        links: {
          contentDetail: `/content/${result.contentItem.id}`,
          publishWizard: `/wizard/publish/${result.contentItem.id}`
        }
      }
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Daily brief content refresh failed.", 500) }, { status: 400 });
  }
}
