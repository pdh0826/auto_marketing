import { NextResponse } from "next/server";
import { createBloggerOAuthStartDryRun } from "@/lib/blogger/oauth";
import { getBloggerConnection } from "@/lib/db/blogger-connections";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const connection = await getBloggerConnection(params.id);
    if (!connection) {
      return NextResponse.json({ error: "Blogger connection not found." }, { status: 404 });
    }

    const result = await createBloggerOAuthStartDryRun({
      connection,
      requestUrl: request.url
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Blogger OAuth dry-run start failed.", 500) }, { status: 400 });
  }
}
