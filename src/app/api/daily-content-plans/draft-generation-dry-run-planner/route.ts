import { NextResponse } from "next/server";
import {
  buildDailyContentDraftGenerationDryRunPlannerResponse,
  type DailyContentDraftGenerationDryRunPlannerRequest
} from "@/lib/daily-content-plans/draft-generation-dry-run-planner";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as DailyContentDraftGenerationDryRunPlannerRequest;
    const result = await buildDailyContentDraftGenerationDryRunPlannerResponse(body);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error instanceof Error ? error.message : "Daily content draft generation dry-run planner failed.", 500) },
      { status: 400 }
    );
  }
}

async function parseJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
