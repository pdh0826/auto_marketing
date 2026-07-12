import { NextResponse } from "next/server";
import type { BloggerTokenRefreshReason } from "@/lib/blogger/admin-types";
import { refreshBloggerAccessTokenForConnection } from "@/lib/blogger/token-refresh";
import { safeBloggerSecretError } from "@/lib/blogger/secrets";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = await parseJsonBody(request);
    const result = await refreshBloggerAccessTokenForConnection({
      connectionId: params.id,
      reason: parseRefreshReason(body.reason),
      force: body.force === true
    });
    return NextResponse.json({ data: { tokenRefreshSummary: result } });
  } catch (error) {
    return NextResponse.json(
      {
        error: safeBloggerSecretError(error instanceof Error ? error.message : "Blogger token refresh failed.")
      },
      { status: 400 }
    );
  }
}

async function parseJsonBody(request: Request): Promise<{ reason?: unknown; force?: unknown }> {
  try {
    return (await request.json()) as { reason?: unknown; force?: unknown };
  } catch {
    return {};
  }
}

function parseRefreshReason(value: unknown): BloggerTokenRefreshReason {
  if (
    value === "manual_settings_refresh" ||
    value === "blogger_draft_save" ||
    value === "publish_oauth_gate" ||
    value === "publish_result_readback" ||
    value === "guarded_publish_execution" ||
    value === "scheduled_publish_preflight"
  ) {
    return value;
  }
  return "manual_settings_refresh";
}
