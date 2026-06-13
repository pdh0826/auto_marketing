import { NextResponse } from "next/server";
import { generateContentPlan } from "@/lib/llm/content-plan-generation";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const result = await generateContentPlan({ contentItemId: params.id });
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "content_plan generation failed.", 500) }, { status: 400 });
  }
}
