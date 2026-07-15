import { NextResponse } from "next/server";
import { safeErrorMessage } from "@/lib/llm/redaction";
import { buildSiteRecipeVideoSourcePreview } from "@/lib/video-automation/source-collection/site-recipe-source";
import type { SiteRecipeVideoSourceInput } from "@/lib/video-automation/source-collection/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<SiteRecipeVideoSourceInput>;
    if (!body.recipe || !body.html) {
      return NextResponse.json({ error: "Site recipe and fixture html are required." }, { status: 400 });
    }
    return NextResponse.json({
      data: buildSiteRecipeVideoSourcePreview({
        recipe: body.recipe,
        html: body.html,
        collectedAt: body.collectedAt
      })
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Site recipe video source preview failed.") }, { status: 400 });
  }
}
