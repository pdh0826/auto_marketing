import { NextResponse } from "next/server";
import { validateBloggerOAuthCallbackDryRun } from "@/lib/blogger/oauth";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const result = await validateBloggerOAuthCallbackDryRun(url.searchParams.get("state"), url.searchParams.get("code"), url.searchParams.get("error"));
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Blogger OAuth callback dry-run failed.", 500) }, { status: 400 });
  }
}
