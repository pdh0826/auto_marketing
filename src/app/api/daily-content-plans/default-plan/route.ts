import { NextResponse } from "next/server";
import { buildDailyContentPlanDefaultResponse, type DailyContentPlanDefaultRequest } from "@/lib/daily-content-plans/default-daily-content-plan";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as DailyContentPlanDefaultRequest;
    const result = await buildDailyContentPlanDefaultResponse(body);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Daily content plan preview failed.", 500) }, { status: 400 });
  }
}

async function parseJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
