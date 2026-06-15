import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  createLocalStepwiseContentDraftGenerationRun,
  listContentDraftGenerationRunsForContentItem,
  toContentDraftGenerationRunDetail,
  toContentDraftGenerationRunSummary
} from "@/lib/db/content-draft-generation-runs";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const contentItem = await getContentItemForStepwiseRun(params.id);
    if (!contentItem) {
      return NextResponse.json({ error: "Content item not found." }, { status: 404 });
    }

    const runs = await listContentDraftGenerationRunsForContentItem(params.id);
    return NextResponse.json({
      data: {
        contentItemId: params.id,
        runs: runs.map(toContentDraftGenerationRunSummary)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Draft generation runs lookup failed.", 500) }, { status: 400 });
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const contentItem = await getContentItemForStepwiseRun(params.id);
    if (!contentItem) {
      return NextResponse.json({ error: "Content item not found." }, { status: 404 });
    }

    if (!contentItem.planJson || typeof contentItem.planJson !== "object" || Array.isArray(contentItem.planJson)) {
      return NextResponse.json(
        {
          error: "plan_json_required",
          message: "Saved planJson is required before starting a stepwise draft generation run."
        },
        { status: 400 }
      );
    }

    const run = await createLocalStepwiseContentDraftGenerationRun({
      contentItemId: params.id,
      metadata: {
        createdByApi: "content_item_draft_generation_runs",
        stepExecutionImplemented: false,
        assemblyImplemented: false,
        finalPolishImplemented: false,
        uiImplemented: false,
        llmCallImplemented: false,
        contentItemAutoApply: false,
        bloggerApiImplemented: false
      }
    });

    return NextResponse.json({ data: { run: toContentDraftGenerationRunDetail(run) } });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Draft generation run creation failed.", 500) }, { status: 400 });
  }
}

function getContentItemForStepwiseRun(contentItemId: string) {
  return prisma.contentItem.findUnique({
    where: { id: contentItemId },
    select: {
      id: true,
      planJson: true
    }
  });
}
