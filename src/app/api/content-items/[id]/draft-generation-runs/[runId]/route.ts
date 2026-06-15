import { NextResponse } from "next/server";
import { getContentDraftGenerationRunForContentItem, toContentDraftGenerationRunDetail } from "@/lib/db/content-draft-generation-runs";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
    runId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const run = await getContentDraftGenerationRunForContentItem(params.id, params.runId);
    if (!run) {
      return NextResponse.json({ error: "Draft generation run not found." }, { status: 404 });
    }

    return NextResponse.json({ data: { run: toContentDraftGenerationRunDetail(run) } });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Draft generation run lookup failed.", 500) }, { status: 400 });
  }
}
