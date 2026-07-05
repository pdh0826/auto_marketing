import { NextResponse } from "next/server";
import {
  buildDailyContentNextItemReadinessResponse,
  type DailyContentNextItemReadinessRequest
} from "@/lib/daily-content-plans/next-item-readiness";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as DailyContentNextItemReadinessRequest;
    const result = await buildDailyContentNextItemReadinessResponse(body);
    return NextResponse.json({ data: result, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error instanceof Error ? error.message : "Daily content next item readiness failed.", 500) },
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
