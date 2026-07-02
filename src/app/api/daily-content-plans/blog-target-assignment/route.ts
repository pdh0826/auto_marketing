import { NextResponse } from "next/server";
import {
  buildDailyContentBlogTargetAssignmentResponse,
  type DailyContentBlogTargetAssignmentRequest
} from "@/lib/daily-content-plans/blog-target-assignment";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as DailyContentBlogTargetAssignmentRequest;
    const result = await buildDailyContentBlogTargetAssignmentResponse(body);
    return NextResponse.json({ data: result, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error instanceof Error ? error.message : "Daily content Blog target assignment failed.", 500) },
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
