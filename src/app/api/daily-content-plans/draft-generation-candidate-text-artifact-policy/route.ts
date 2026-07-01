import { NextResponse } from "next/server";
import {
  buildDailyContentDraftGenerationCandidateTextArtifactPolicyResponse,
  type DailyContentDraftGenerationCandidateTextArtifactPolicyRequest
} from "@/lib/daily-content-plans/draft-generation-candidate-text-artifact-policy";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as DailyContentDraftGenerationCandidateTextArtifactPolicyRequest;
    const result = await buildDailyContentDraftGenerationCandidateTextArtifactPolicyResponse(body);
    return NextResponse.json({ data: result, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error instanceof Error ? error.message : "Daily content draft generation candidate text artifact policy failed.", 500) },
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
