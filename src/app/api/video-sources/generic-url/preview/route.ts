import { NextResponse } from "next/server";
import { safeErrorMessage } from "@/lib/llm/redaction";
import { buildGenericUrlVideoSourcePreview } from "@/lib/video-automation/source-collection/generic-url-source";
import type { GenericUrlVideoSourceInput } from "@/lib/video-automation/source-collection/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<GenericUrlVideoSourceInput>;
    if (!body.url) {
      return NextResponse.json({ error: "Generic URL is required." }, { status: 400 });
    }
    return NextResponse.json({
      data: buildGenericUrlVideoSourcePreview({
        url: body.url,
        title: body.title ?? null,
        description: body.description ?? null,
        excerpt: body.excerpt ?? null,
        htmlSnapshot: body.htmlSnapshot ?? null,
        language: body.language ?? "ko",
        collectedAt: body.collectedAt
      })
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Generic URL video source preview failed.") }, { status: 400 });
  }
}
