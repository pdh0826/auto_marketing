import { NextResponse } from "next/server";
import { normalizeBloggerConnectionInput } from "@/lib/blogger/input";
import { createBloggerConnection, listBloggerConnections } from "@/lib/db/blogger-connections";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function GET() {
  const connections = await listBloggerConnections();
  return NextResponse.json({ data: connections });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const connection = await createBloggerConnection(normalizeBloggerConnectionInput(body));
    return NextResponse.json({ data: connection }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Blogger connection create failed.", 500) }, { status: 400 });
  }
}
