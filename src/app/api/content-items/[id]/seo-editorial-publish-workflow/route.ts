import { NextResponse } from "next/server";
import { buildSeoEditorialPublishWorkflow } from "@/lib/content/seo-editorial-publish-workflow";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const result = await buildSeoEditorialPublishWorkflow(params.id);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      {
        error: safeErrorMessage(error instanceof Error ? error.message : "SEO editorial publish workflow readback failed.", 500)
      },
      { status: error instanceof Error && error.message === "content_item_not_found" ? 404 : 400 }
    );
  }
}
