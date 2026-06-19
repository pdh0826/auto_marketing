import { NextResponse } from "next/server";
import { buildPublishResultReadbackResponse, type PublishResultReadbackRequest } from "@/lib/content/publish-result-readback";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await parseJsonBody(request)) as PublishResultReadbackRequest;
    const result = await buildPublishResultReadbackResponse(params.id, body);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      {
        error: safeErrorMessage(error instanceof Error ? error.message : "Publish result readback failed.", 500)
      },
      { status: error instanceof Error && error.message === "content_item_not_found" ? 404 : 400 }
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
