import { NextResponse } from "next/server";
import { buildDailyPlanContentItemFixtureResponse, type DailyPlanContentItemFixtureRequest } from "@/lib/daily-content-plans/content-item-fixture";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as DailyPlanContentItemFixtureRequest;
    const result = await buildDailyPlanContentItemFixtureResponse(body);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Daily plan content item fixture preview failed.", 500) }, { status: 400 });
  }
}

async function parseJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
