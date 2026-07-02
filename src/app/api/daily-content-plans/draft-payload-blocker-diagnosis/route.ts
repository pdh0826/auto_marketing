import { NextResponse } from "next/server";
import {
  buildDailyContentDraftPayloadBlockerDiagnosisResponse,
  type DailyContentDraftPayloadBlockerDiagnosisRequest
} from "@/lib/daily-content-plans/draft-payload-blocker-diagnosis";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as DailyContentDraftPayloadBlockerDiagnosisRequest;
    const result = await buildDailyContentDraftPayloadBlockerDiagnosisResponse(body);
    return NextResponse.json({ data: result, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error instanceof Error ? error.message : "Daily content draft payload blocker diagnosis failed.", 500) },
      { status: 400 }
    );
  }
}

async function parseJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
