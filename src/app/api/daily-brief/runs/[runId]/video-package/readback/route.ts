import { NextResponse } from "next/server";
import { getDailyBriefRun } from "@/lib/daily-brief/store";
import { safeErrorMessage } from "@/lib/llm/redaction";
import { readDailyBriefVideoPackage } from "@/lib/video-automation/daily-brief-upload-package";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    runId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const run = await getDailyBriefRun(params.runId);
    if (!run) {
      return NextResponse.json({ error: "Daily brief run not found." }, { status: 404 });
    }
    return NextResponse.json({ data: await readDailyBriefVideoPackage(run) });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Daily brief video package readback failed.") }, { status: 400 });
  }
}
