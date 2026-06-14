import { NextResponse } from "next/server";
import { normalizeBloggerConnectionPatchInput } from "@/lib/blogger/input";
import { getBloggerConnection, updateBloggerConnection } from "@/lib/db/blogger-connections";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const connection = await getBloggerConnection(params.id);

  if (!connection) {
    return NextResponse.json({ error: "Blogger connection not found." }, { status: 404 });
  }

  return NextResponse.json({ data: connection });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const connection = await updateBloggerConnection(params.id, normalizeBloggerConnectionPatchInput(body));
    return NextResponse.json({ data: connection });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Blogger connection update failed.", 500) }, { status: 400 });
  }
}
