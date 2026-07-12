import { NextResponse } from "next/server";
import { exportTistoryHtmlForContentItem } from "@/lib/tistory/html-export";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const result = await exportTistoryHtmlForContentItem(params.id);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Tistory HTML export failed.", 500) }, { status: 400 });
  }
}
