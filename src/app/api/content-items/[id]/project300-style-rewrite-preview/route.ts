import { NextResponse } from "next/server";
import { safeErrorMessage } from "@/lib/llm/redaction";
import { previewProject300StyleRewrite } from "@/lib/tistory/project300-style-rewrite";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      executeLlm?: unknown;
      maxIterations?: unknown;
      confirmationPhrase?: unknown;
    };
    const result = await previewProject300StyleRewrite({
      contentItemId: params.id,
      executeLlm: body.executeLlm === true,
      maxIterations: Number.isFinite(Number(body.maxIterations)) ? Number(body.maxIterations) : undefined,
      confirmationPhrase: typeof body.confirmationPhrase === "string" ? body.confirmationPhrase : undefined
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Project300 style rewrite preview failed.", 500) }, { status: 400 });
  }
}
