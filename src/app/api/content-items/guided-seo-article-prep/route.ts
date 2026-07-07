import { NextResponse } from "next/server";
import { createGuidedSeoArticlePrep, type GuidedSeoArticlePrepRequest } from "@/lib/content/guided-seo-article-prep";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as GuidedSeoArticlePrepRequest;
    const result = await createGuidedSeoArticlePrep(body);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: safeErrorMessage(error instanceof Error ? error.message : "Guided SEO article prep failed.", 500)
      },
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
