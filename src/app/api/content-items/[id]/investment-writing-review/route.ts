import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { createInvestmentJudgmentLedger } from "@/lib/daily-brief/investment-writing-contract";
import type { InvestmentWritingOutline } from "@/lib/daily-brief/investment-writing-outline";
import { getContentItem } from "@/lib/db/content-items";
import { safeErrorMessage } from "@/lib/llm/redaction";
import { reviewProject300GeneratedPost, summarizeProject300StyleReview } from "@/lib/tistory/project300-style-review";
import { inferProject300CategoryKind } from "@/lib/tistory/project300-voice-variation";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const contentItem = await getContentItem(params.id);
    if (!contentItem) return NextResponse.json({ error: "content_item_not_found" }, { status: 404 });
    if (!contentItem.draftMarkdown?.trim()) return NextResponse.json({ error: "saved_draft_markdown_required" }, { status: 400 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const judgmentLedger = createInvestmentJudgmentLedger({
      firstImpression: readText(body.firstImpression),
      mostInterestingSubject: readText(body.mostInterestingSubject),
      noActionReason: readText(body.noActionReason),
      mainConcern: readText(body.mainConcern),
      revisitConditions: readLines(body.revisitConditions),
      exclusionConditions: readLines(body.exclusionConditions),
      preservedExpressions: readLines(body.preservedExpressions)
    });
    const context = readPlanContext(contentItem.planJson);
    const review = reviewProject300GeneratedPost({
      title: contentItem.title ?? "",
      markdown: contentItem.draftMarkdown,
      categoryKind: inferProject300CategoryKind(context.mode),
      subjectNames: context.subjectNames,
      judgmentLedger,
      investmentOutline: context.outline
    });
    return NextResponse.json({
      data: {
        judgmentLedger,
        review: summarizeProject300StyleReview(review),
        publishGate: {
          ready: review.ok && judgmentLedger.userInputPresent,
          blockers: [
            ...review.blockers,
            ...(!judgmentLedger.userInputPresent ? ["user_judgment_input_required"] : []),
            ...(!context.outline?.ready ? ["investment_writing_outline_not_ready"] : [])
          ]
        },
        sideEffectSummary: {
          dbRead: true,
          dbWrite: false,
          contentMutation: false,
          llmCall: false,
          bloggerWrite: false,
          tistoryWrite: false,
          publish: false
        }
      }
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "investment_writing_review_failed", 300) }, { status: 400 });
  }
}

function readPlanContext(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { mode: null, subjectNames: [] as string[], outline: null as InvestmentWritingOutline | null };
  const root = value as Record<string, unknown>;
  const selection = root.selection && typeof root.selection === "object" && !Array.isArray(root.selection) ? (root.selection as Record<string, unknown>) : {};
  const writing = root.investmentWriting && typeof root.investmentWriting === "object" && !Array.isArray(root.investmentWriting)
    ? (root.investmentWriting as Record<string, unknown>)
    : null;
  return {
    mode: typeof selection.mode === "string" ? selection.mode : null,
    subjectNames: Array.isArray(selection.selectedStockNames) ? selection.selectedStockNames.filter((item): item is string => typeof item === "string") : [],
    outline: writing?.outline && typeof writing.outline === "object" ? (writing.outline as InvestmentWritingOutline) : null
  };
}

function readText(value: unknown) {
  return typeof value === "string" ? value.slice(0, 2000).trim() || null : null;
}

function readLines(value: unknown) {
  return typeof value === "string" ? value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 20) : [];
}
