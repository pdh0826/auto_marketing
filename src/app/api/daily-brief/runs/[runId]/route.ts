import { NextResponse } from "next/server";
import { getDailyBriefRun } from "@/lib/daily-brief/store";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    runId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const run = await getDailyBriefRun(params.runId);
  if (!run) {
    return NextResponse.json({ error: "Daily brief run not found." }, { status: 404 });
  }
  return NextResponse.json({ data: run });
}
