import { NextResponse } from "next/server";
import { buildDailyBriefSeoTitle, createDailyBriefRun, listDailyBriefRuns } from "@/lib/daily-brief/store";
import type { DailyBriefCreateRequest } from "@/lib/daily-brief/types";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function GET() {
  const runs = await listDailyBriefRuns();
  return NextResponse.json({ data: runs });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as DailyBriefCreateRequest;
    const marketDate = typeof body.marketDate === "string" && body.marketDate.trim() ? body.marketDate.trim().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const targetKeyword =
      typeof body.targetKeyword === "string" && body.targetKeyword.trim() ? body.targetKeyword.trim().slice(0, 80) : "오늘의 국내주식 관심종목";
    const stockPickLimit = parseBoundedNumber(body.stockPickLimit, 8, 1, 20);
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim().slice(0, 140)
        : buildDailyBriefSeoTitle(stockPickLimit, { marketDate });
    const run = await createDailyBriefRun({
      marketDate,
      targetKeyword,
      title,
      stockPickLimit,
      stockDetailLimit: parseBoundedNumber(body.stockDetailLimit, 5, 1, 10),
      etfPickLimit: parseBoundedNumber(body.etfPickLimit, 5, 0, 20),
      includeEtfs: body.includeEtfs !== false
    });

    return NextResponse.json({ data: run }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Daily brief run creation failed.", 500) }, { status: 400 });
  }
}

function parseBoundedNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
