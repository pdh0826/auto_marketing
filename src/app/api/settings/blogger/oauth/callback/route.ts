import { NextResponse } from "next/server";
import { safeBloggerSecretError } from "@/lib/blogger/secrets";
import { exchangeBloggerOAuthCallback } from "@/lib/blogger/token-exchange";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const result = await exchangeBloggerOAuthCallback(url.searchParams.get("state"), url.searchParams.get("code"), url.searchParams.get("error"));
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeBloggerSecretError(error instanceof Error ? error.message : "Blogger OAuth callback token exchange failed.", 500) }, { status: 400 });
  }
}
