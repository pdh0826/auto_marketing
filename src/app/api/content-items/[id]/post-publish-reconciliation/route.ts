import { NextResponse } from "next/server";
import { buildPostPublishReconciliationResponse, type PostPublishReconciliationRequest } from "@/lib/content/post-publish-reconciliation";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await parseJsonBody(request)) as PostPublishReconciliationRequest;
    const result = await buildPostPublishReconciliationResponse(params.id, body);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      {
        error: safeErrorMessage(error instanceof Error ? error.message : "Post-publish reconciliation failed.", 500)
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
