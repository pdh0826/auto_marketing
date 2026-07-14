import { NextResponse } from "next/server";
import { getDailyBriefRun } from "@/lib/daily-brief/store";
import { safeErrorMessage } from "@/lib/llm/redaction";
import { buildDailyBriefVideoPackagePreview, writeDailyBriefVideoPackage } from "@/lib/video-automation/daily-brief-package";

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
    return NextResponse.json({ data: buildDailyBriefVideoPackagePreview(run) });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Daily brief video package preview failed.") }, { status: 400 });
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const run = await getDailyBriefRun(params.runId);
    if (!run) {
      return NextResponse.json({ error: "Daily brief run not found." }, { status: 404 });
    }
    return NextResponse.json({ data: await writeDailyBriefVideoPackage(run) });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Daily brief video package creation failed.") }, { status: 400 });
  }
}
