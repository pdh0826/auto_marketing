import { NextResponse } from "next/server";
import { getTistoryPublisherStatus, updateTistoryPublisherConfig } from "@/lib/tistory/publisher-scheduler";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ data: await getTistoryPublisherStatus() });
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const data = await updateTistoryPublisherConfig({
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      timezone: typeof body.timezone === "string" ? body.timezone : undefined,
      livePublishEnabled: typeof body.livePublishEnabled === "boolean" ? body.livePublishEnabled : undefined,
      headless: typeof body.headless === "boolean" ? body.headless : undefined,
      sessionKeepAliveEnabled: typeof body.sessionKeepAliveEnabled === "boolean" ? body.sessionKeepAliveEnabled : undefined,
      sessionKeepAliveIntervalMinutes: typeof body.sessionKeepAliveIntervalMinutes === "number" ? body.sessionKeepAliveIntervalMinutes : undefined
    });
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "tistory_config_update_failed", 300) }, { status: 400 });
  }
}
