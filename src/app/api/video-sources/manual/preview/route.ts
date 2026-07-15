import { NextResponse } from "next/server";
import { safeErrorMessage } from "@/lib/llm/redaction";
import { buildManualVideoSourcePreview } from "@/lib/video-automation/source-collection/manual-source";
import type { ManualVideoSourceInput } from "@/lib/video-automation/source-collection/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ManualVideoSourceInput>;
    if (!body.title || !body.sourceText) {
      return NextResponse.json({ error: "Manual video source title and sourceText are required." }, { status: 400 });
    }
    return NextResponse.json({
      data: buildManualVideoSourcePreview({
        title: body.title,
        sourceText: body.sourceText,
        notes: body.notes ?? null,
        referenceUrls: body.referenceUrls ?? [],
        visuals: body.visuals ?? [],
        language: body.language ?? "ko",
        toneHint: body.toneHint ?? null,
        platformHint: body.platformHint ?? null
      })
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Manual video source preview failed.") }, { status: 400 });
  }
}
