import { NextResponse } from "next/server";
import {
  buildDailyContentQueueOperatorWorkflowResponse,
  type DailyContentQueueOperatorWorkflowRequest
} from "@/lib/daily-content-plans/operator-approval-workflow";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as DailyContentQueueOperatorWorkflowRequest;
    const result = await buildDailyContentQueueOperatorWorkflowResponse(body);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Daily content queue operator workflow preview failed.", 500) }, { status: 400 });
  }
}

async function parseJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
