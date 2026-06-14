import { NextResponse } from "next/server";
import { generateContentDraft } from "@/lib/llm/content-draft-generation";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const result = await generateContentDraft({ contentItemId: params.id });
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "content_draft generation failed.", 500) }, { status: 400 });
  }
}
